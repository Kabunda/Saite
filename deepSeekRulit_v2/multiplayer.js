import { ref, set, update, get, onValue, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db, useFirebase } from './storage.js';
import { getPlayerId, updatePresenceStatus } from './online-presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

if (!useFirebase) {
    console.warn("Firebase не инициализирован. Мультиплеер недоступен.");
}

// Создаёт новую сессию и записывает в базу
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

// Присоединяется к существующей сессии
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

// Удаляет себя из waitingPlayers
async function leaveWaiting(playerId) {
    await remove(ref(db, `waitingPlayers/${playerId}`));
}

// Подписывается на изменения прогресса соперника
function subscribeOpponentProgress(sessionId, myPlayerId, callback) {
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

// Обновляет свой прогресс в сессии
function updateMyProgress(sessionId, playerId, progress, score, finished, totalTimeSec) {
    const updates = {};
    updates[`players/${playerId}/progress`] = progress;
    updates[`players/${playerId}/score`] = score;
    updates[`players/${playerId}/finished`] = finished;
    updates[`players/${playerId}/totalTimeSec`] = totalTimeSec;
    return update(ref(db, `sessions/${sessionId}`), updates);
}

// Основная функция поиска соперника
export async function startMultiplayerOrSolo(playerName, selectedRounds, onSoloGame, onMultiplayerGame) {
    if (!useFirebase) {
        onSoloGame();
        return;
    }

    const playerId = getPlayerId();
    updatePresenceStatus('waiting');
    
    // Добавляем себя в waitingPlayers
    await set(ref(db, `waitingPlayers/${playerId}`), {
        name: playerName,
        joinedAt: serverTimestamp(),
        sessionId: null   // пока нет сессии
    });

    let opponentFound = false;
    let timeoutId = null;

    // Слушаем, не появилась ли для нас сессия от другого игрока
    const myWaitingRef = ref(db, `waitingPlayers/${playerId}/sessionId`);
    const unsubscribeSelf = onValue(myWaitingRef, async (snap) => {
        if (opponentFound) return;
        const sessionId = snap.val();
        if (sessionId) {
            // Соперник создал сессию и указал её для нас
            opponentFound = true;
            if (timeoutId) clearTimeout(timeoutId);
            unsubscribeSelf();
            // Забираем информацию о вопросах и сопернике
            const sessionSnap = await get(ref(db, `sessions/${sessionId}`));
            if (!sessionSnap.exists()) return;
            const sessionData = sessionSnap.val();
            const questions = sessionData.questions;
            const opponentPlayer = Object.entries(sessionData.players).find(([id]) => id !== playerId);
            if (!opponentPlayer) return;
            const opponentName = opponentPlayer[1].name;
            await joinSession(sessionId, playerId, playerName);
            await leaveWaiting(playerId);
            onMultiplayerGame(sessionId, questions, opponentPlayer[0], opponentName);
        }
    });

    // Слушаем других ожидающих игроков
    const waitingRef = ref(db, 'waitingPlayers');
    const unsubscribeOthers = onValue(waitingRef, async (snapshot) => {
        if (opponentFound) return;
        const players = snapshot.val() || {};
        const otherPlayers = Object.keys(players).filter(id => id !== playerId);
        
        if (otherPlayers.length > 0) {
            // Выбираем первого попавшегося соперника
            const opponentId = otherPlayers[0];
            const opponentData = players[opponentId];
            
            opponentFound = true;
            if (timeoutId) clearTimeout(timeoutId);
            unsubscribeSelf();
            unsubscribeOthers();
            
            // Генерируем вопросы
            const questions = buildUniqueQuestionList(selectedRounds);
            const sessionId = await createSession(playerId, playerName, questions);
            
            // Сообщаем сопернику ID сессии
            await set(ref(db, `waitingPlayers/${opponentId}/sessionId`), sessionId);
            
            // Удаляем обоих из waitingPlayers
            await leaveWaiting(playerId);
            await leaveWaiting(opponentId);
            
            onMultiplayerGame(sessionId, questions, opponentId, opponentData.name);
        }
    });

    // Таймаут 5 секунд – если соперник не найден, играем соло
    timeoutId = setTimeout(async () => {
        if (!opponentFound) {
            unsubscribeSelf();
            unsubscribeOthers();
            await leaveWaiting(playerId);
            updatePresenceStatus('playing');
            onSoloGame();
        }
    }, 5000);
}

export { subscribeOpponentProgress, updateMyProgress };