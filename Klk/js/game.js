import {
  ref,
  onValue,
  update,
  get,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { db } from "./config.js";
import { getCurrentUser } from "./auth.js";
import { showScreen } from "./ui.js";
import { updateStats } from "./profile.js";

let gameRef = null;
let gameListener = null;
let currentRoomId = null;

export function startGame(roomId, hostUid) {
  showScreen('game-screen');
  currentRoomId = roomId;
  gameRef = ref(db, `rooms/${roomId}`);
  const user = getCurrentUser();

  document.getElementById('game-actions').innerHTML = `
    <button id="action-btn">Сделать ход (+1 очко)</button>
    <p id="my-score">Мой счёт: 0</p>
    <p id="opponent-score">Счёт соперника: 0</p>
    <p id="turn-indicator"></p>
  `;

  document.getElementById('action-btn').addEventListener('click', makeMove);

  gameListener = onValue(gameRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // Комната удалена
      cleanupGame();
      showScreen('menu-screen');
      return;
    }
    const players = room.players;
    if (!players) return;

    const myData = players[user.uid];
    const opponentId = Object.keys(players).find(id => id !== user.uid);
    const opponentData = opponentId ? players[opponentId] : null;

    document.getElementById('my-score').textContent = `Мой счёт: ${myData?.score || 0}`;
    document.getElementById('opponent-score').textContent = `Счёт соперника: ${opponentData?.score || 0}`;

    // Проверка завершения (кто первый набрал 5 очков)
    const myScore = myData?.score || 0;
    const oppScore = opponentData?.score || 0;
    if (myScore >= 5 || oppScore >= 5) {
      finishGame(myScore, oppScore, user.uid, opponentId);
    }
  });
}

function makeMove() {
  const user = getCurrentUser();
  if (!currentRoomId) return;
  const scoreRef = ref(db, `rooms/${currentRoomId}/players/${user.uid}/score`);
  get(scoreRef).then(snapshot => {
    const current = snapshot.val() || 0;
    // Не даём увеличивать счёт после завершения (простая проверка)
    if (current >= 5) return;
    update(ref(db, `rooms/${currentRoomId}/players/${user.uid}`), {
      score: current + 1
    });
  });
}

function finishGame(myScore, oppScore, myUid, oppUid) {
  if (!gameListener) return; // уже завершена
  // Отписываемся от слушателя
  gameListener(); // теперь корректно
  gameListener = null;

  const winner = myScore > oppScore ? myUid : oppUid;
  const isWin = winner === myUid;

  updateStats(myUid, isWin);

  update(gameRef, {
    'meta/status': 'finished',
    'gameState/winner': winner
  });

  document.getElementById('result-text').textContent =
    isWin ? 'Победа!' : 'Поражение...';
  showScreen('result-screen');
  cleanupGame();
}

function cleanupGame() {
  gameRef = null;
  currentRoomId = null;
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
}