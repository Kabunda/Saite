// multiplayer.js — модуль для сетевой игры с соперником через Firebase Realtime Database.
// Отвечает за:
//   - поиск / создание игрового лобби (startMatchmaking);
//   - подписку на прогресс соперника (subscribeOpponentProgress);
//   - отправку собственного прогресса в лобби (updateMyProgress).

import { db, useFirebase } from './storage.js';
import {
    ref, set, update, get, onValue, remove, push, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getPlayerId } from './presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

// =============================================================================
// ActivityManager — сборщик функций очистки (подписки, интервалы)
// Используется для гарантированной отмены всех слушателей при завершении/отмене
// =============================================================================
class ActivityManager {
    constructor() {
        this.cleanups = [];
    }

    /**
     * Добавить функцию или идентификатор интервала для очистки.
     * @param {Function|number} fnOrInterval
     */
    add(fnOrInterval) {
        this.cleanups.push(fnOrInterval);
    }

    /** Выполнить все зарегистрированные очистки и очистить список. */
    clear() {
        this.cleanups.forEach(item => {
            if (typeof item === 'function') {
                try { item(); } catch (e) { /* ignore */ }
            } else {
                clearInterval(item);
            }
        });
        this.cleanups = [];
    }
}

// =============================================================================
// Вспомогательные функции
// =============================================================================

/**
 * Безопасно создаёт слушатель на значение startTime в лобби.
 * Возвращает объект с функцией отписки, которую можно вызывать даже до того,
 * как реальный слушатель будет присвоен (защита от синхронного вызова колбэка).
 *
 * @param {string} lobbyId - идентификатор лобби
 * @param {function} onStartReady - колбэк, вызывается когда startTime > 0
 * @returns {{ unsubscribe: function }} объект с методом unsubscribe()
 */
function listenForStartTime(lobbyId, onStartReady) {
    const startTimeRef = ref(db, `lobbies/${lobbyId}/startTime`);
    let unsub = null;

    // Безопасная функция отписки: вызывает unsub, только если он уже функция
    const safeUnsubscribe = () => {
        if (typeof unsub === 'function') {
            unsub();
            unsub = null;
        }
    };

    unsub = onValue(startTimeRef, (snapshot) => {
        const st = snapshot.val();
        if (st && typeof st === 'number' && st > 0) {
            safeUnsubscribe();    // убираем слушатель
            onStartReady(st);     // оповещаем о готовности
        }
    });

    return { unsubscribe: safeUnsubscribe };
}

// =============================================================================
// Основная функция поиска/создания игры
// =============================================================================

/**
 * Запускает процесс подбора соперника.
 * Если Firebase недоступен, сразу возвращает отменяемый ошибочный промис.
 *
 * @param {string} playerName - имя текущего игрока
 * @param {number} selectedRounds - количество вопросов
 * @returns {{ cancel: Function, promise: Promise<object> }}
 */
export function startMatchmaking(playerName, selectedRounds) {
    // Firebase не настроен – игра по сети невозможна
    if (!useFirebase || !db) {
        return {
            cancel: () => {},
            promise: Promise.reject(new Error('Firebase недоступен'))
        };
    }

    const playerId = getPlayerId();
    const activity = new ActivityManager();   // сюда будем добавлять очистки
    let settled = false;                      // true – процесс завершён (успех/ошибка/отмена)
    let myPlayerRef = null;                   // ссылка на свою запись в players чужого лобби
    let lobbyRef = null;                      // ссылка на собственное лобби (когда мы хост)

    /**
     * Финальная очистка: вызывается при любом исходе (успех, ошибка, отмена).
     * Удаляет временные записи в Firebase, отписывается от всех слушателей.
     */
    const finalCleanup = () => {
        activity.clear();
        if (myPlayerRef) {
            remove(myPlayerRef).catch(() => {});
            myPlayerRef = null;
        }
        if (lobbyRef) {
            remove(lobbyRef).catch(() => {});
            lobbyRef = null;
        }
    };

    /**
     * Корректно завершает процесс с ошибкой.
     * @param {string|Error} reason
     */
    const rejectAndClean = (reason) => {
        if (!settled) {
            settled = true;
            finalCleanup();
            reject(reason instanceof Error ? reason : new Error(reason));
        }
    };

    /**
     * Успешное завершение: передаём данные созданной игры.
     * @param {object} gameData
     */
    const resolveAndClean = (gameData) => {
        if (!settled) {
            settled = true;
            activity.clear();        // оставляем лобби (оно теперь активное), поэтому не вызываем finalCleanup
            resolve(gameData);
        }
    };

    const promise = new Promise((resolve, reject) => {
        (async () => {
            // 1. Поиск открытого лобби
            const lobbiesRef = ref(db, 'lobbies');
            let openLobbyId = null;
            try {
                const snap = await get(lobbiesRef);
                const lobbies = snap.val() || {};
                for (const id in lobbies) {
                    if (lobbies[id].status === 'waiting') {
                        openLobbyId = id;
                        break;
                    }
                }
            } catch (err) {
                rejectAndClean(err);
                return;
            }

            // -----------------------------------------------------------------
            // Сценарий А: найдено открытое лобби – присоединяемся вторым игроком
            // -----------------------------------------------------------------
            if (openLobbyId) {
                const lobbySnap = await get(ref(db, `lobbies/${openLobbyId}`));
                const lobby = lobbySnap.val();

                // Проверка на случай гонки состояний
                if (!lobby || lobby.status !== 'waiting') {
                    rejectAndClean('Лобби уже недоступно');
                    return;
                }

                const players = lobby.players || {};
                if (players[playerId]) {
                    rejectAndClean('Вы уже находитесь в этом лобби');
                    return;
                }
                if (Object.keys(players).length >= 2) {
                    rejectAndClean('Лобби уже заполнено');
                    return;
                }

                const hostId = lobby.hostId;
                const questions = lobby.questions;
                const hostName = lobby.hostName;

                // Добавляем себя в players лобби
                myPlayerRef = ref(db, `lobbies/${openLobbyId}/players/${playerId}`);
                try {
                    await set(myPlayerRef, {
                        name: playerName,
                        progress: 0,
                        score: 0,
                        finished: false,
                        totalTimeSec: 0,
                        answers: []
                    });
                } catch (err) {
                    rejectAndClean(err);
                    return;
                }

                // Слушаем установку startTime хостом
                const startListener = listenForStartTime(openLobbyId, (startTime) => {
                    resolveAndClean({
                        sessionId: openLobbyId,
                        questions,
                        opponentId: hostId,
                        opponentName: hostName,
                        startTime
                    });
                });
                activity.add(startListener.unsubscribe);

                // Если лобби внезапно удалится (хост вышел)
                const lobbyWatcherRef = ref(db, `lobbies/${openLobbyId}`);
                const unsubLobby = onValue(lobbyWatcherRef, (snap) => {
                    if (settled) return;
                    if (!snap.exists()) {
                        rejectAndClean('Создатель игры вышел');
                    }
                });
                activity.add(unsubLobby);
                return;
            }

            // -----------------------------------------------------------------
            // Сценарий Б: открытых лобби нет – создаём новое (становимся хостом)
            // -----------------------------------------------------------------
            const newLobbyRef = push(ref(db, 'lobbies'));
            lobbyRef = newLobbyRef;
            const questions = buildUniqueQuestionList(selectedRounds);

            try {
                await set(newLobbyRef, {
                    hostId: playerId,
                    hostName: playerName,
                    status: 'waiting',
                    questions,
                    players: {
                        [playerId]: {
                            name: playerName,
                            progress: 0,
                            score: 0,
                            finished: false,
                            totalTimeSec: 0,
                            answers: []
                        }
                    },
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                rejectAndClean(err);
                return;
            }

            // Ждём появления второго игрока
            const playersRef = ref(db, `lobbies/${newLobbyRef.key}/players`);
            const unsubPlayers = onValue(playersRef, (snap) => {
                if (settled) return;
                const players = snap.val() || {};
                const ids = Object.keys(players);
                if (ids.length >= 2) {
                    // Отписываемся от players
                    unsubPlayers();
                    activity.cleanups = activity.cleanups.filter(f => f !== unsubPlayers);

                    const opponentId = ids.find(id => id !== playerId);
                    const opponentName = players[opponentId]?.name || 'Игрок';

                    // Активируем лобби (устанавливаем startTime)
                    update(ref(db, `lobbies/${newLobbyRef.key}`), {
                        status: 'active',
                        startTime: serverTimestamp()
                    }).catch(() => {});

                    // Теперь слушаем появление реального startTime от сервера
                    const startListener = listenForStartTime(newLobbyRef.key, (startTime) => {
                        resolveAndClean({
                            sessionId: newLobbyRef.key,
                            questions,
                            opponentId,
                            opponentName,
                            startTime
                        });
                    });
                    activity.add(startListener.unsubscribe);
                }
            });
            activity.add(unsubPlayers);

            // Следим, не удалили ли наше лобби извне
            const lobbyWatcher = onValue(ref(db, `lobbies/${newLobbyRef.key}`), (snap) => {
                if (settled) return;
                if (!snap.exists()) {
                    rejectAndClean('Лобби было удалено');
                }
            });
            activity.add(lobbyWatcher);

        })().catch((err) => {
            // Любая необработанная ошибка в async IIFE
            rejectAndClean(err);
        });
    });

    // Функция отмены поиска (вызывается извне)
    const cancel = () => {
        if (!settled) {
            settled = true;
            finalCleanup();
        }
    };

    // Дополнительная гарантия очистки при разрешении промиса
    promise
        .then(() => activity.clear())
        .catch(() => activity.clear());

    return { cancel, promise };
}

// =============================================================================
// Подписка на прогресс соперника
// =============================================================================

/**
 * Подписывает на изменения данных соперника в лобби.
 * Возвращает функцию для отписки.
 *
 * @param {string} sessionId - идентификатор сессии (лобби)
 * @param {string} myPlayerId - идентификатор текущего игрока
 * @param {function} callback - функция, принимающая объект с полями:
 *   { progress, score, finished, totalTimeSec, answers }
 * @returns {Function} функция отписки
 */
export function subscribeOpponentProgress(sessionId, myPlayerId, callback) {
    const playersRef = ref(db, `lobbies/${sessionId}/players`);
    return onValue(playersRef, (snapshot) => {
        const players = snapshot.val() || {};
        // Ищем запись соперника (любой id, не равный myPlayerId)
        const opponentEntry = Object.entries(players).find(([id]) => id !== myPlayerId);
        if (opponentEntry) {
            const [, data] = opponentEntry;
            callback({
                progress: data.progress || 0,
                score: data.score || 0,
                finished: data.finished || false,
                totalTimeSec: data.totalTimeSec || 0,
                answers: data.answers || []
            });
        } else {
            // Соперник отсутствует (дисконнект) – передаём нулевые значения
            callback({
                progress: 0,
                score: 0,
                finished: false,
                totalTimeSec: 0,
                answers: []
            });
        }
    });
}

// =============================================================================
// Отправка собственного прогресса
// =============================================================================

/**
 * Обновляет прогресс текущего игрока в лобби.
 *
 * @param {string} sessionId - идентификатор сессии (лобби)
 * @param {string} playerId - идентификатор игрока
 * @param {number} progress - сколько вопросов отвечено
 * @param {number} score - количество правильных ответов
 * @param {boolean} finished - завершил ли игрок все вопросы
 * @param {number} totalTimeSec - общее затраченное время в секундах
 * @param {Array|null} answersArray - массив вида [{ index, correct }] или null
 */
export async function updateMyProgress(sessionId, playerId, progress, score, finished, totalTimeSec, answersArray = null) {
    const updates = {};
    updates[`players/${playerId}/progress`] = progress;
    updates[`players/${playerId}/score`] = score;
    updates[`players/${playerId}/finished`] = finished;
    updates[`players/${playerId}/totalTimeSec`] = totalTimeSec;
    if (answersArray !== null) {
        updates[`players/${playerId}/answers`] = answersArray;
    }
    await update(ref(db, `lobbies/${sessionId}`), updates);
}