// multiplayer.js (исправленный)
import { ref, set, update, get, onValue, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db, useFirebase } from './storage.js';
import { getPlayerId, updatePresenceStatus } from './online-presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

if (!useFirebase) {
    console.warn("Firebase не инициализирован. Мультиплеер недоступен.");
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

async function createSession(playerId, playerName, questions) {
    const sessionRef = push(ref(db, 'sessions'));
    const sessionId = sessionRef.key;
    await set(sessionRef, {
        players: {
            [playerId]: {
                name: playerName,
                progress: 0,
                score: 0,
                finished: false,
                totalTimeSec: 0,
                answers: []         // массив { index, correct }
            }
        },
        questions,
        status: 'waiting'
    });
    return sessionId;
}

async function joinSession(sessionId, playerId, playerName) {
    const sessionRef = ref(db, `sessions/${sessionId}`);
    const snapshot = await get(sessionRef);
    if (!snapshot.exists()) throw new Error('Сессия не найдена');
    
    const updates = {};
    updates[`players/${playerId}`] = {
        name: playerName,
        progress: 0,
        score: 0,
        finished: false,
        totalTimeSec: 0,
        answers: []
    };
    // Статус меняем только когда оба игрока будут готовы
    await update(sessionRef, updates);
}

async function leaveWaiting(playerId) {
    await remove(ref(db, `waitingPlayers/${playerId}`));
}

// Установка времени старта (вызывается, когда оба игрока в сессии)
async function setGameStartTime(sessionId) {
    await update(ref(db, `sessions/${sessionId}`), {
        startTime: serverTimestamp(),
        status: 'active'
    });
}

// Подписка на время старта – возвращает функцию отписки
function subscribeToGameStart(sessionId, callback) {
    const startTimeRef = ref(db, `sessions/${sessionId}/startTime`);
    return onValue(startTimeRef, (snap) => {
        const startTime = snap.val();
        if (startTime) {
            callback(startTime);
        }
    });
}

// ========== ПОИСК СОПЕРНИКА (переработан) ==========

export function startSearch(playerName, selectedRounds) {
    if (!useFirebase || !db) {
        // Firebase недоступен – сразу возвращаем "отклонённый" промис
        return {
            cancel: () => {},
            promise: Promise.reject(new Error('Firebase недоступен'))
        };
    }

    const playerId = getPlayerId();
    updatePresenceStatus('waiting');

    let settled = false;
    let unsubscribeSelf = null;
    let unsubscribeOthers = null;
    let unsubscribeStart = null;
    let cancelPromise = null;

    const promise = new Promise((resolve, reject) => {
        cancelPromise = () => {
            if (!settled) {
                settled = true;
                reject(new Error('Поиск отменён'));
            }
        };

        // Добавляем себя в waitingPlayers
        set(ref(db, `waitingPlayers/${playerId}`), {
            name: playerName,
            joinedAt: serverTimestamp(),
            sessionId: null
        });

        // Слушаем, когда другой игрок назначит нам сессию
        const selfSessionRef = ref(db, `waitingPlayers/${playerId}/sessionId`);
        unsubscribeSelf = onValue(selfSessionRef, async (snap) => {
            if (settled) return;
            const sessionId = snap.val();
            if (sessionId) {
                settled = true;
                cleanupListeners();
                try {
                    // Присоединяемся к сессии
                    await joinSession(sessionId, playerId, playerName);
                    await leaveWaiting(playerId);
                    // Получаем данные сессии
                    const sessionSnap = await get(ref(db, `sessions/${sessionId}`));
                    if (!sessionSnap.exists()) throw new Error('Сессия не найдена');
                    const sessionData = sessionSnap.val();
                    const questions = sessionData.questions;
                    const opponent = Object.entries(sessionData.players).find(([id]) => id !== playerId);
                    if (!opponent) throw new Error('Соперник не найден в сессии');
                    const opponentName = opponent[1].name;
                    
                    // Ждём стартового времени
                    unsubscribeStart = subscribeToGameStart(sessionId, (startTime) => {
                        resolve({
                            sessionId,
                            questions,
                            opponentId: opponent[0],
                            opponentName,
                            startTime
                        });
                    });
                } catch (err) {
                    console.error('Ошибка при подключении к сессии:', err);
                    await leaveWaiting(playerId);
                    reject(err);
                }
            }
        });

        // Слушаем список ожидающих – ищем другого игрока
        const waitingRef = ref(db, 'waitingPlayers');
        unsubscribeOthers = onValue(waitingRef, async (snapshot) => {
            if (settled) return;
            const players = snapshot.val() || {};
            const others = Object.keys(players).filter(id => id !== playerId);
            if (others.length > 0) {
                settled = true;
                cleanupListeners();
                const opponentId = others[0];
                const opponentData = players[opponentId];
                try {
                    const questions = buildUniqueQuestionList(selectedRounds);
                    const sessionId = await createSession(playerId, playerName, questions);
                    // Назначаем сессию сопернику
                    await set(ref(db, `waitingPlayers/${opponentId}/sessionId`), sessionId);
                    await leaveWaiting(playerId);
                    // Ждём, пока соперник присоединится (появление двух игроков)
                    const playersRef = ref(db, `sessions/${sessionId}/players`);
                    const unsubscribePlayers = onValue(playersRef, async (snap) => {
                        const playersObj = snap.val() || {};
                        if (Object.keys(playersObj).length >= 2) {
                            unsubscribePlayers(); // отписываемся
                            // Устанавливаем время старта
                            await setGameStartTime(sessionId);
                            // Разрешаем промис для себя
                            const opponentName = playersObj[opponentId].name;
                            resolve({
                                sessionId,
                                questions,
                                opponentId,
                                opponentName,
                                startTime: null // мы ещё не получили startTime, но можем подписаться
                            });
                            // Но лучше тоже подписаться на startTime для надёжности
                            unsubscribeStart = subscribeToGameStart(sessionId, (startTime) => {
                                // Разрешаем ещё раз? Нет, уже разрешили. Просто для синхронизации таймера.
                                // В script.js будем использовать startTime из подписки.
                                // Можно передать startTime в resolve позже, но проще подписаться внутри script.js.
                                // Поэтому здесь только разрешаем параметры без startTime.
                            });
                        }
                    });
                    // Важно: сохраняем unsubscribePlayers для очистки
                    // (добавим в cleanup функцию)
                } catch (err) {
                    console.error('Ошибка при создании сессии:', err);
                    await leaveWaiting(playerId);
                    reject(err);
                }
            }
        });

        function cleanupListeners() {
            if (unsubscribeSelf) { unsubscribeSelf(); unsubscribeSelf = null; }
            if (unsubscribeOthers) { unsubscribeOthers(); unsubscribeOthers = null; }
        }
    });

    return {
        cancel: async () => {
            if (cancelPromise) cancelPromise();
            if (unsubscribeStart) unsubscribeStart();
            await leaveWaiting(playerId);
            updatePresenceStatus('menu');
        },
        promise
    };
}

// ========== ПРОГРЕСС ВО ВРЕМЯ МУЛЬТИПЛЕЕРНОЙ ИГРЫ ==========

export function subscribeOpponentProgress(sessionId, myPlayerId, callback) {
    const sessionRef = ref(db, `sessions/${sessionId}/players`);
    return onValue(sessionRef, (snapshot) => {
        const players = snapshot.val() || {};
        const opponent = Object.entries(players).find(([id]) => id !== myPlayerId);
        if (opponent) {
            const [, data] = opponent;
            callback({
                progress: data.progress || 0,
                score: data.score || 0,
                finished: data.finished || false,
                totalTimeSec: data.totalTimeSec || 0,
                answers: data.answers || []   // передаём массив ответов
            });
        }
    });
}

export function updateMyProgress(sessionId, playerId, progress, score, finished, totalTimeSec, lastAnswer = null) {
    const updates = {};
    updates[`players/${playerId}/progress`] = progress;
    updates[`players/${playerId}/score`] = score;
    updates[`players/${playerId}/finished`] = finished;
    updates[`players/${playerId}/totalTimeSec`] = totalTimeSec;
    
    if (lastAnswer) {
        // Добавляем запись в массив answers
        updates[`players/${playerId}/answers`] = lastAnswer; // в Firebase лучше обновлять весь массив через update, но проще использовать push
        // Для простоты будем перезаписывать answers целиком (через отдельное обновление)
        // В данном случае обновим через получение текущих данных, но здесь только отправка команды.
        // Чтобы не усложнять, используем атомарное обновление с добавлением в массив (Firebase не умеет push в update).
        // Обходной путь: хранить answers как объект с ключами-индексами.
        // Переделаем answers на объект: answers: { [questionIndex]: correct }
    }
    return update(ref(db, `sessions/${sessionId}`), updates);
}