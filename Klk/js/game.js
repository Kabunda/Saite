import {
  ref,
  onValue,
  update,
  get,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { db } from "./config.js";
import { getCurrentUser } from "./auth.js";
import { showScreen } from "./ui.js";
import { updateStats } from "./profile.js";

let gameRef = null;
let gameListener = null;
let currentRoomId = null;

// Локальное состояние
let questionsList = [];          // массив объектов { text, answer }
let currentQuestionIndex = 0;    // индекс текущего вопроса (0..N-1)
let currentAnswer = "";
let isWaitingForAnswer = true;
let questionStartTime = 0;       // timestamp начала текущего вопроса (performance)
let totalResponseTime = 0;       // сумма времени ответов (мс)
let playerFinished = false;       // завершил ли текущий игрок все вопросы

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
  totalResponseTime = 0;
  playerFinished = false;
  questionStartTime = 0;

  attachKeyboardHandlers();

  // Загружаем вопросы из комнаты
  get(gameRef).then(snapshot => {
    const room = snapshot.val();
    if (room && room.questions && Array.isArray(room.questions) && room.questions.length) {
      questionsList = room.questions;
      // Инициализируем запись ответов игрока, если её нет
      const playerAnswersRef = ref(db, `rooms/${roomId}/playerAnswers/${user.uid}`);
      get(playerAnswersRef).then(snap => {
        if (!snap.exists()) {
          // Создаём структуру для ответов
          update(ref(db, `rooms/${roomId}/playerAnswers`), {
            [user.uid]: {
              answers: [],
              totalTimeMs: 0,
              finished: false
            }
          });
        }
      });
      displayCurrentQuestion();
    } else {
      console.error("[Game] Вопросы не найдены в комнате");
      leaveLobbyAndBack();
    }
  }).catch(err => {
    console.error(err);
    leaveLobbyAndBack();
  });

  // Слушаем изменения комнаты (прогресс соперника, завершение игры)
  gameListener = onValue(gameRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      cleanupGame();
      showScreen('menu-screen');
      return;
    }

    const players = room.players;
    const playerAnswers = room.playerAnswers || {};
    if (!players) return;

    const myUid = user.uid;
    const opponentId = Object.keys(players).find(id => id !== myUid);
    
    // Обновляем прогресс игроков (сколько вопросов отвечено)
    const myProgress = playerAnswers[myUid]?.answers?.length || 0;
    const oppProgress = opponentId ? (playerAnswers[opponentId]?.answers?.length || 0) : 0;
    
    const myProgressSpan = document.getElementById('my-progress');
    const oppProgressSpan = document.getElementById('opponent-progress');
    if (myProgressSpan) myProgressSpan.textContent = `${myProgress}/${questionsList.length}`;
    if (oppProgressSpan) oppProgressSpan.textContent = `${oppProgress}/${questionsList.length}`;

    // Проверяем, завершили ли оба игрока
    const myFinished = playerAnswers[myUid]?.finished || false;
    const oppFinished = opponentId ? (playerAnswers[opponentId]?.finished || false) : false;

    if (myFinished && oppFinished) {
      // Игра окончена, определяем победителя
      const myTotalTime = playerAnswers[myUid]?.totalTimeMs || 0;
      const oppTotalTime = playerAnswers[opponentId]?.totalTimeMs || 0;
      const winnerUid = myTotalTime < oppTotalTime ? myUid : opponentId;
      finishGame(winnerUid, myUid, opponentId);
    } else if (myFinished && !playerFinished) {
      // Текущий игрок только что завершил, но второй ещё нет
      playerFinished = true;
      document.getElementById('feedback-message').textContent = "Вы ответили на все вопросы! Ожидаем соперника...";
      document.getElementById('feedback-message').style.color = "#3498db";
      isWaitingForAnswer = false; // блокируем дальнейшие ответы
    }
  });
}

function displayCurrentQuestion() {
  if (!questionsList.length) return;
  if (currentQuestionIndex >= questionsList.length) {
    // Все вопросы уже отвечены – ничего не делаем, ждём завершения игры
    return;
  }
  const q = questionsList[currentQuestionIndex];
  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = `${q.text} = ?`;
  
  currentAnswer = "";
  updateAnswerDisplay();
  const feedbackEl = document.getElementById('feedback-message');
  if (feedbackEl) feedbackEl.textContent = "";
  isWaitingForAnswer = true;
  
  // Засекаем время начала вопроса
  questionStartTime = performance.now();
}

function updateAnswerDisplay() {
  const display = document.getElementById('answer-input');
  if (display) display.textContent = currentAnswer || "_";
}

function attachKeyboardHandlers() {
  const keypad = document.getElementById('multiplication-keypad');
  if (!keypad) return;
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
  if (!isWaitingForAnswer || playerFinished) return;

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
  if (currentQuestionIndex >= questionsList.length) return;
  if (playerFinished) return;

  const q = questionsList[currentQuestionIndex];
  const userAnswer = parseInt(currentAnswer, 10);
  if (isNaN(userAnswer)) return;

  const isCorrect = (userAnswer === q.answer);
  const responseTimeMs = performance.now() - questionStartTime;
  totalResponseTime += responseTimeMs;

  const feedbackEl = document.getElementById('feedback-message');
  if (isCorrect) {
    if (feedbackEl) {
      feedbackEl.textContent = `✓ Верно! +${responseTimeMs.toFixed(0)} мс`;
      feedbackEl.style.color = "#2ecc71";
    }
    playSoundEffect(true);
  } else {
    if (feedbackEl) {
      feedbackEl.textContent = `✗ Неверно. Правильно: ${q.answer} (${responseTimeMs.toFixed(0)} мс)`;
      feedbackEl.style.color = "#e74c3c";
    }
    playSoundEffect(false);
  }

  // Сохраняем ответ в Firebase
  const answerRecord = {
    questionIndex: currentQuestionIndex,
    answer: userAnswer,
    isCorrect: isCorrect,
    responseTimeMs: responseTimeMs,
    timestamp: serverTimestamp()
  };
  
  const playerAnswersRef = ref(db, `rooms/${currentRoomId}/playerAnswers/${user.uid}`);
  const snapshot = await get(playerAnswersRef);
  const currentData = snapshot.val() || { answers: [], totalTimeMs: 0, finished: false };
  const newAnswers = [...currentData.answers, answerRecord];
  
  const isFinished = newAnswers.length === questionsList.length;
  const newTotalTime = currentData.totalTimeMs + responseTimeMs;
  
  await update(playerAnswersRef, {
    answers: newAnswers,
    totalTimeMs: newTotalTime,
    finished: isFinished
  });

  isWaitingForAnswer = false;
  currentQuestionIndex++;

  if (!isFinished) {
    // Переход к следующему вопросу через небольшую задержку
    setTimeout(() => {
      displayCurrentQuestion();
    }, 800);
  } else {
    // Игрок завершил все вопросы – не показываем новый вопрос, ждём соперника
    // Сообщение будет показано в основном listener'е
    // Дополнительно обновим интерфейс
    const feedbackEl = document.getElementById('feedback-message');
    if (feedbackEl) {
      feedbackEl.textContent = "Вы ответили на все вопросы! Ожидаем соперника...";
      feedbackEl.style.color = "#3498db";
    }
    // Скрываем клавиатуру или делаем её неактивной (уже isWaitingForAnswer = false)
  }
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

function finishGame(winnerUid, myUid, opponentId) {
  if (!gameListener) return;
  gameListener(); // отписываемся
  gameListener = null;

  const isWin = winnerUid === myUid;
  updateStats(myUid, isWin);
  
  // Обновляем статус комнаты
  update(ref(db, `rooms/${currentRoomId}/meta`), {
    status: 'finished',
    winner: winnerUid
  });

  const resultText = isWin ? 'Победа!' : 'Поражение...';
  const resultEl = document.getElementById('result-text');
  if (resultEl) resultEl.textContent = resultText;
  showScreen('result-screen');
  cleanupGame();
}

function cleanupGame() {
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
  currentRoomId = null;
  gameRef = null;
}

function leaveLobbyAndBack() {
  import("./lobby.js").then(module => {
    module.leaveLobby();
    showScreen('menu-screen');
  });
}