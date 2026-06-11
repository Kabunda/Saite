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

// Локальное состояние для вопросов (общий список из комнаты)
let questionsList = [];          // массив объектов { text, answer }
let currentQuestionIndex = 0;    // какой вопрос сейчас решаем
let currentAnswer = "";
let isWaitingForAnswer = true;

export function startGame(roomId, hostUid) {
  showScreen('game-screen');
  currentRoomId = roomId;
  gameRef = ref(db, `rooms/${roomId}`);
  const user = getCurrentUser();
  
  // Сброс состояния
  currentQuestionIndex = 0;
  currentAnswer = "";
  isWaitingForAnswer = true;
  questionsList = [];

  // Очистим и наполним интерфейс (без перерисовки всей разметки, только обновим данные)
  // Но нам нужно убедиться, что обработчики клавиатуры есть.
  attachKeyboardHandlers();

  // Сначала загружаем вопросы из комнаты, затем подписываемся на изменения счёта
  get(gameRef).then(snapshot => {
    const room = snapshot.val();
    if (room && room.questions && Array.isArray(room.questions) && room.questions.length) {
      questionsList = room.questions;
      // Отображаем первый вопрос
      displayCurrentQuestion();
    } else {
      console.error("[Game] Вопросы не найдены в комнате");
      // Можно вернуться в меню или сгенерировать локально, но лучше выйти
      leaveLobbyAndBack();
    }
  }).catch(err => {
    console.error(err);
    leaveLobbyAndBack();
  });

  // Слушаем изменения комнаты (счёт игроков)
  gameListener = onValue(gameRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      cleanupGame();
      showScreen('menu-screen');
      return;
    }
    const players = room.players;
    if (!players) return;

    const myData = players[user.uid];
    const opponentId = Object.keys(players).find(id => id !== user.uid);
    const opponentData = opponentId ? players[opponentId] : null;

    // Обновляем отображение счёта
    const myScoreSpan = document.getElementById('my-score');
    const oppScoreSpan = document.getElementById('opponent-score');
    if (myScoreSpan) myScoreSpan.textContent = myData?.score || 0;
    if (oppScoreSpan) oppScoreSpan.textContent = opponentData?.score || 0;

    const myScore = myData?.score || 0;
    const oppScore = opponentData?.score || 0;
    if (myScore >= 5 || oppScore >= 5) {
      finishGame(myScore, oppScore, user.uid, opponentId);
    }
  });
}

function displayCurrentQuestion() {
  if (!questionsList.length || currentQuestionIndex >= questionsList.length) {
    // Если вопросы кончились, а игра ещё не завершена – повторяем список циклически
    if (questionsList.length > 0) {
      currentQuestionIndex = currentQuestionIndex % questionsList.length;
    } else {
      return;
    }
  }
  const q = questionsList[currentQuestionIndex];
  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = `${q.text} = ?`;
  
  // Сброс ввода и фидбека
  currentAnswer = "";
  updateAnswerDisplay();
  const feedbackEl = document.getElementById('feedback-message');
  if (feedbackEl) feedbackEl.textContent = "";
  isWaitingForAnswer = true;
}

function updateAnswerDisplay() {
  const display = document.getElementById('answer-input');
  if (display) display.textContent = currentAnswer || "_";
}

function attachKeyboardHandlers() {
  const keypad = document.getElementById('multiplication-keypad');
  if (!keypad) return;
  // Убираем старые обработчики через замену элемента
  const newKeypad = keypad.cloneNode(true);
  keypad.parentNode.replaceChild(newKeypad, keypad);
  newKeypad.addEventListener('click', (e) => {
    const keyDiv = e.target.closest('.key');
    if (!keyDiv) return;
    const key = keyDiv.dataset.key;
    if (key) handleKeyPress(key);
  });
}

function handleKeyPress(key) {
  if (!isWaitingForAnswer) return;

  if (key === 'del') {
    currentAnswer = currentAnswer.slice(0, -1);
    updateAnswerDisplay();
  } else if (key === 'clear') {
    currentAnswer = "";
    updateAnswerDisplay();
  } else if (key === 'enter') {
    if (currentAnswer === "") return;
    submitAnswer();
  } else if (/^\d$/.test(key)) {
    if (currentAnswer.length < 3) {
      currentAnswer += key;
      updateAnswerDisplay();
    }
  }
}

async function submitAnswer() {
  const user = getCurrentUser();
  if (!user || !currentRoomId) return;
  if (!questionsList.length) return;
  if (currentQuestionIndex >= questionsList.length) {
    // Циклический повтор, если вдруг кончились
    currentQuestionIndex = 0;
  }

  const q = questionsList[currentQuestionIndex];
  const userAnswer = parseInt(currentAnswer, 10);
  if (isNaN(userAnswer)) return;

  const isCorrect = (userAnswer === q.answer);
  const feedbackEl = document.getElementById('feedback-message');

  if (isCorrect) {
    // Увеличиваем счёт в Firebase
    const scoreRef = ref(db, `rooms/${currentRoomId}/players/${user.uid}/score`);
    const snapshot = await get(scoreRef);
    const currentScore = snapshot.val() || 0;
    if (currentScore >= 5) return; // игра уже окончена

    await update(ref(db, `rooms/${currentRoomId}/players/${user.uid}`), {
      score: currentScore + 1
    });

    if (feedbackEl) {
      feedbackEl.textContent = "✓ Верно! +1 очко";
      feedbackEl.style.color = "#2ecc71";
    }
    playSoundEffect(true);
  } else {
    if (feedbackEl) {
      feedbackEl.textContent = `✗ Неверно. Правильно: ${q.answer}`;
      feedbackEl.style.color = "#e74c3c";
    }
    playSoundEffect(false);
  }

  isWaitingForAnswer = false;

  // Переход к следующему вопросу (независимо от правильности)
  currentQuestionIndex++;

  // Задержка перед следующим вопросом
  setTimeout(() => {
    // Проверяем, не закончилась ли игра (счёт может быть уже 5)
    const myScoreSpan = document.getElementById('my-score');
    if (myScoreSpan && parseInt(myScoreSpan.textContent) >= 5) {
      return;
    }
    displayCurrentQuestion();
  }, 800);
}

function playSoundEffect(correct) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = correct ? 880 : 240;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function finishGame(myScore, oppScore, myUid, oppUid) {
  if (!gameListener) return;
  gameListener(); // отписываемся
  gameListener = null;

  const winner = myScore > oppScore ? myUid : oppUid;
  const isWin = winner === myUid;

  updateStats(myUid, isWin);

  update(gameRef, {
    'meta/status': 'finished',
    'gameState/winner': winner
  });

  const resultText = isWin ? 'Победа!' : 'Поражение...';
  const resultEl = document.getElementById('result-text');
  if (resultEl) resultEl.textContent = resultText;
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

function leaveLobbyAndBack() {
  // Импортируем leaveLobby динамически, чтобы избежать циклической зависимости
  import("./lobby.js").then(module => {
    module.leaveLobby();
    showScreen('menu-screen');
  });
}