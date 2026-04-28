import { ref, set, update, get, onValue, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db, useFirebase } from './storage.js';
import { getPlayerId, updatePresenceStatus } from './online-presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

if (!useFirebase) {
    console.warn("Firebase не инициализирован. Мультиплеер недоступен.");
}

// ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================

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
                totalTimeSec: 0
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
        totalTimeSec: 0
    };
    updates.status = 'active';
    await update(sessionRef, updates);
}

async function leaveWaiting(playerId) {
    await remove(ref(db, `waitingPlayers/${playerId}`));
}

// ================== НОВЫЙ ПОИСК СОПЕРНИКА ==================

/**
 * Начинает поиск соперника.
 * @param {string} playerName - имя текущего игрока
 * @param {number} selectedRounds - количество вопросов
 * @param {function} onOpponentFound - колбэк при обнаружении соперника.
 *   Получает (sessionId, questions, opponentId, opponentName)
 * @param {function} onError - вызывается при ошибке или невозможности мультиплеера
 * @returns {function} cancel - вызов отменяет поиск, удаляет игрока из очереди
 */
export function startSearch(playerName, selectedRounds, onOpponentFound, onError) {
    if (!useFirebase || !db) {
        // Если Firebase недоступен, сразу сообщаем об ошибке → одиночная игра
        onError && onError(new Error('Firebase недоступен'));
        return () => {}; // пустая функция отмены
    }

    const playerId = getPlayerId();
    updatePresenceStatus('waiting');

    // Флаг, предотвращающий повторные действия
    let settled = false;
    // Ссылки для отписки
    let unsubscribeSelf = null;
    let unsubscribeOthers = null;

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
                const sessionSnap = await get(ref(db, `sessions/${sessionId}`));
                if (!sessionSnap.exists()) {
                    throw new Error('Сессия не найдена');
                }
                const sessionData = sessionSnap.val();
                const questions = sessionData.questions;
                const opponent = Object.entries(sessionData.players).find(([id]) => id !== playerId);
                if (!opponent) {
                    throw new Error('Соперник не найден в сессии');
                }
                const opponentName = opponent[1].name;
                await joinSession(sessionId, playerId, playerName);
                await leaveWaiting(playerId);
                onOpponentFound(sessionId, questions, opponent[0], opponentName);
            } catch (err) {
                console.error('Ошибка при подключении к сессии:', err);
                await leaveWaiting(playerId);
                onError && onError(err);
            }
        }
    });

    // Слушаем список ожидающих — ищем другого игрока, чтобы создать сессию
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
                await set(ref(db, `waitingPlayers/${opponentId}/sessionId`), sessionId);
                await leaveWaiting(playerId);
                await leaveWaiting(opponentId);
                onOpponentFound(sessionId, questions, opponentId, opponentData.name);
            } catch (err) {
                console.error('Ошибка при создании сессии:', err);
                await leaveWaiting(playerId);
                onError && onError(err);
            }
        }
    });

    // Функция очистки подписок
    function cleanupListeners() {
        if (unsubscribeSelf) {
            unsubscribeSelf();
            unsubscribeSelf = null;
        }
        if (unsubscribeOthers) {
            unsubscribeOthers();
            unsubscribeOthers = null;
        }
    }

    // Возвращаем функцию отмены поиска
    return async () => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        await leaveWaiting(playerId);
        updatePresenceStatus('menu'); // или 'idle'
    };
}

// ================== ПРОГРЕСС ВО ВРЕМЯ МУЛЬТИПЛЕЕРНОЙ ИГРЫ ==================

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
                totalTimeSec: data.totalTimeSec || 0
            });
        }
    });
}

export function updateMyProgress(sessionId, playerId, progress, score, finished, totalTimeSec) {
    const updates = {};
    updates[`players/${playerId}/progress`] = progress;
    updates[`players/${playerId}/score`] = score;
    updates[`players/${playerId}/finished`] = finished;
    updates[`players/${playerId}/totalTimeSec`] = totalTimeSec;
    return update(ref(db, `sessions/${sessionId}`), updates);
}