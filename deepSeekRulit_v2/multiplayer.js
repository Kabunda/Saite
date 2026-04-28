// multiplayer.js — новая логика поиска через лобби
import { ref, set, update, get, onValue, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db, useFirebase } from './storage.js';
import { getPlayerId, updatePresenceStatus } from './online-presence.js';
import { buildUniqueQuestionList } from './task-generator.js';

if (!useFirebase) {
    console.warn("Firebase не инициализирован. Мультиплеер недоступен.");
}

/**
 * Запускает поиск игры: ищет свободное лобби или создаёт новое.
 * Возвращает { cancel, promise }.
 * promise разрешается объектом мультиплеера или reject при ошибке/отмене.
 */
export function startMatchmaking(playerName, selectedRounds) {
    if (!useFirebase || !db) {
        return {
            cancel: () => {},
            promise: Promise.reject(new Error('Firebase недоступен'))
        };
    }

    const playerId = getPlayerId();
    let settled = false;
    let cleanup = () => {};
    let lobbyRef = null;

    const promise = new Promise(async (resolve, reject) => {
        // 1. Ищем открытое лобби (статус 'waiting')
        const lobbiesRef = ref(db, 'lobbies');
        try {
            const snap = await get(lobbiesRef);
            const lobbies = snap.val() || {};
            let openLobbyId = null;
            for (const id in lobbies) {
                if (lobbies[id].status === 'waiting') {
                    openLobbyId = id;
                    break;
                }
            }

            if (openLobbyId) {
                // Присоединяемся к существующему лобби
                const lobbySnap = await get(ref(db, `lobbies/${openLobbyId}`));
                const lobby = lobbySnap.val();
                const hostId = lobby.hostId;
                const questions = lobby.questions;
                const hostName = lobby.hostName;

                await update(ref(db, `lobbies/${openLobbyId}`), {
                    [`players/${playerId}`]: {
                        name: playerName,
                        progress: 0,
                        score: 0,
                        finished: false,
                        totalTimeSec: 0,
                        answers: []
                    },
                    status: 'active',
                    startTime: serverTimestamp()
                });

                // Синхронизируемся по серверному времени старта
                const unsub = onValue(ref(db, `lobbies/${openLobbyId}/startTime`), (s) => {
                    const st = s.val();
                    if (st && typeof st === 'number') {
                        unsub();
                        if (!settled) {
                            settled = true;
                            resolve({
                                sessionId: openLobbyId,
                                questions,
                                opponentId: hostId,
                                opponentName: hostName,
                                startTime: st
                            });
                        }
                    }
                });

                cleanup = () => {
                    unsub();
                    // не удаляем чужое лобби
                };
                return;
            }
        } catch (err) {
            reject(err);
            return;
        }

        // 2. Нет открытых лобби — создаём своё
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
            const players = snap.val() || {};
            const ids = Object.keys(players);
            if (ids.length >= 2 && !settled) {
                const opponentId = ids.find(id => id !== playerId);
                const opponentName = players[opponentId].name;

                // Запускаем игру: статус 'active', startTime
                update(ref(db, `lobbies/${newLobbyRef.key}`), {
                    status: 'active',
                    startTime: serverTimestamp()
                });

                const unsubStart = onValue(ref(db, `lobbies/${newLobbyRef.key}/startTime`), (s) => {
                    const st = s.val();
                    if (st && typeof st === 'number') {
                        unsubStart();
                        if (!settled) {
                            settled = true;
                            resolve({
                                sessionId: newLobbyRef.key,
                                questions,
                                opponentId,
                                opponentName,
                                startTime: st
                            });
                        }
                    }
                });

                const prevCleanup = cleanup;
                cleanup = () => {
                    unsubPlayers();
                    unsubStart();
                    prevCleanup();
                };
            }
        });

        cleanup = () => {
            unsubPlayers();
            if (lobbyRef) {
                remove(lobbyRef).catch(() => {});
            }
        };
    });

    const cancel = () => {
        if (!settled) {
            settled = true;
            cleanup();
        }
    };

    return { cancel, promise };
}

// ----- Далее остальные функции остаются без изменений -----

export function subscribeOpponentProgress(sessionId, myPlayerId, callback) {
    const sessionRef = ref(db, `lobbies/${sessionId}/players`);
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
                answers: data.answers || []
            });
        }
    });
}

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