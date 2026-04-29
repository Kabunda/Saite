// multiplayer.js – полностью переработанный модуль сетевой игры
import { db, useFirebase } from './storage.js';
import {
    ref, set, update, get, onValue, remove, push, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getPlayerId } from './presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

// -----------------------------------------------------------------------------
// ActivityManager – сборщик функций очистки (подписки, интервалы)
// -----------------------------------------------------------------------------
class ActivityManager {
    constructor() {
        this.cleanups = [];
    }
    add(fnOrInterval) {
        this.cleanups.push(fnOrInterval);
    }
    clear() {
        this.cleanups.forEach(item => {
            if (typeof item === 'function') {
                try { item(); } catch (e) { /* игнорируем */ }
            } else {
                clearInterval(item);
            }
        });
        this.cleanups = [];
    }
}

// -----------------------------------------------------------------------------
// startMatchmaking – главная точка входа для поиска / создания игры
// -----------------------------------------------------------------------------
export function startMatchmaking(playerName, selectedRounds) {
    if (!useFirebase || !db) {
        return {
            cancel: () => {},
            promise: Promise.reject(new Error('Firebase недоступен'))
        };
    }

    const playerId = getPlayerId();
    const activity = new ActivityManager();
    let settled = false;      // флаг завершения (успех / ошибка / отмена)
    let lobbyRef = null;      // ссылка на собственное лобби, если мы хост
    let myPlayerRef = null;   // ссылка на /players/<мой id> (присоединившийся)

    // Функция финальной очистки (вызывается при любом исходе)
    const finalCleanup = () => {
        activity.clear();
        if (myPlayerRef) {
            // Если мы присоединились к чужому лобби, удаляем свою запись при отмене
            remove(myPlayerRef).catch(() => {});
        }
        if (lobbyRef) {
            // Если мы создали лобби, удаляем его
            remove(lobbyRef).catch(() => {});
        }
    };

    const promise = new Promise(async (resolve, reject) => {
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
            reject(err);
            return;
        }

        // ---------------------------------------------------------------------
        // Сценарий А: найдено открытое лобби – присоединяемся как второй игрок
        // ---------------------------------------------------------------------
        if (openLobbyId) {
            const lobbySnap = await get(ref(db, `lobbies/${openLobbyId}`));
            const lobby = lobbySnap.val();
            // Двойная проверка: вдруг лобби успело измениться
            if (!lobby || lobby.status !== 'waiting') {
                reject(new Error('Лобби уже недоступно'));
                return;
            }
            const players = lobby.players || {};
            if (players[playerId]) {
                reject(new Error('Вы уже в этом лобби'));
                return;
            }
            if (Object.keys(players).length >= 2) {
                reject(new Error('Лобби заполнено'));
                return;
            }

            const hostId = lobby.hostId;
            const questions = lobby.questions;
            const hostName = lobby.hostName;

            // Атомарно добавляем себя в players (Firebase не поддерживает транзакции,
            // но update относительно безопасен, т.к. ключ уникален)
            myPlayerRef = ref(db, `lobbies/${openLobbyId}/players/${playerId}`);
            await set(myPlayerRef, {
                name: playerName,
                progress: 0,
                score: 0,
                finished: false,
                totalTimeSec: 0,
                answers: []
            });

            // Слушаем установку startTime хостом
            const startTimeRef = ref(db, `lobbies/${openLobbyId}/startTime`);
            const unsubStart = onValue(startTimeRef, (s) => {
                if (settled) return;
                const st = s.val();
                if (st && typeof st === 'number' && st > 0) {
                    settled = true;
                    unsubStart();
                    activity.clear();
                    myPlayerRef = null;  // больше не удаляем себя при cancel
                    resolve({
                        sessionId: openLobbyId,
                        questions,
                        opponentId: hostId,
                        opponentName: hostName,
                        startTime: st
                    });
                }
            });
            activity.add(unsubStart);

            // Если лобби удаляется (хост отменил или ушёл)
            const lobbyListenerRef = ref(db, `lobbies/${openLobbyId}`);
            const unsubLobby = onValue(lobbyListenerRef, (snap) => {
                if (settled) return;
                if (!snap.exists()) {
                    settled = true;
                    unsubLobby();
                    activity.clear();
                    myPlayerRef = null;
                    reject(new Error('Создатель игры вышел'));
                }
            });
            activity.add(unsubLobby);
            return;
        }

        // ---------------------------------------------------------------------
        // Сценарий Б: открытых лобби нет – создаём новое (становимся хостом)
        // ---------------------------------------------------------------------
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
            reject(err);
            return;
        }

        // Слушаем появление второго игрока
        const playersRef = ref(db, `lobbies/${newLobbyRef.key}/players`);
        const unsubPlayers = onValue(playersRef, (snap) => {
            if (settled) return;
            const players = snap.val() || {};
            const ids = Object.keys(players);
            if (ids.length >= 2) {
                unsubPlayers();
                const opponentId = ids.find(id => id !== playerId);
                const opponentName = players[opponentId]?.name || 'Игрок';

                // Активируем лобби (только хост)
                update(ref(db, `lobbies/${newLobbyRef.key}`), {
                    status: 'active',
                    startTime: serverTimestamp()
                }).catch(() => {});

                // Ждём, пока сервер вернёт реальное значение startTime
                const startTimeRef = ref(db, `lobbies/${newLobbyRef.key}/startTime`);
                const unsubStart = onValue(startTimeRef, (s) => {
                    if (settled) return;
                    const st = s.val();
                    if (st && typeof st === 'number' && st > 0) {
                        settled = true;
                        unsubStart();
                        activity.clear();
                        lobbyRef = null;  // лобби остаётся активным, не удаляем
                        resolve({
                            sessionId: newLobbyRef.key,
                            questions,
                            opponentId,
                            opponentName,
                            startTime: st
                        });
                    }
                });
                activity.add(unsubStart);
            }
        });
        activity.add(unsubPlayers);

        // Если наше лобби почему‑то удалили извне
        const lobbyWatcher = onValue(ref(db, `lobbies/${newLobbyRef.key}`), (snap) => {
            if (settled) return;
            if (!snap.exists()) {
                settled = true;
                activity.clear();
                lobbyRef = null;
                reject(new Error('Лобби удалено'));
            }
        });
        activity.add(lobbyWatcher);
    });

    // Функция отмены поиска
    const cancel = () => {
        if (settled) return;
        settled = true;
        finalCleanup();
    };

    // Дополнительная очистка при разрешении промиса (успех / ошибка)
    promise
        .then(() => { activity.clear(); })
        .catch(() => { activity.clear(); });

    return { cancel, promise };
}

// -----------------------------------------------------------------------------
// subscribeOpponentProgress – подписка на обновления соперника
// -----------------------------------------------------------------------------
export function subscribeOpponentProgress(sessionId, myPlayerId, callback) {
    const playersRef = ref(db, `lobbies/${sessionId}/players`);
    return onValue(playersRef, (snapshot) => {
        const players = snapshot.val() || {};
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
            // Соперник отсутствует (дисконнект) – передаём нули
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

// -----------------------------------------------------------------------------
// updateMyProgress – отправка своего прогресса в лобби
// -----------------------------------------------------------------------------
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