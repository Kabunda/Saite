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
  console.log("[Game] startGame вызван", { roomId, hostUid });
  showScreen('game-screen');
  currentRoomId = roomId;
  gameRef = ref(db, `rooms/${roomId}`);
  const user = getCurrentUser();
  console.log("[Game] Текущий пользователь", user?.uid);
  
  // Сброс состояния
  currentQuestionIndex = 0;
  currentAnswer = "";
  isWaitingForAnswer = true;
  questionsList = [];
  totalResponseTime = 0;
  playerFinished = false;
  questionStartTime = 0;
  console.log("[Game] Состояние сброшено", { currentQuestionIndex, playerFinished });

  attachKeyboardHandlers();

  // Загружаем вопросы из комнаты
  console.log("[Game] Загрузка вопросов из комнаты", roomId);
  get(gameRef).then(snapshot => {
    const room = snapshot.val();
    if (room && room.questions && Array.isArray(room.questions) && room.questions.length) {
      questionsList = room.questions;
      console.log("[Game] Вопросы загружены", { count: questionsList.length });
      
      // Инициализируем запись ответов игрока, если её нет
      const playerAnswersRef = ref(db, `rooms/${roomId}/playerAnswers/${user.uid}`);
      get(playerAnswersRef).then(snap => {
        if (!snap.exists()) {
          console.log("[Game] Создаём запись ответов для игрока", user.uid);
          update(ref(db, `rooms/${roomId}/playerAnswers`), {
            [user.uid]: {
              answers: [],
              totalTimeMs: 0,
              finished: false
            }
          }).then(() => {
            console.log("[Game] Запись ответов создана");
          });
        } else {
          console.log("[Game] Запись ответов уже существует");
        }
      });
      displayCurrentQuestion();
    } else {
      console.error("[Game] Вопросы не найдены в комнате", room);
      leaveLobbyAndBack();
    }
  }).catch(err => {
    console.error("[Game] Ошибка загрузки вопросов", err);
    leaveLobbyAndBack();
  });

  // Слушаем изменения комнаты (прогресс соперника, завершение игры)
  console.log("[Game] Установка слушателя onValue для комнаты", roomId);
  gameListener = onValue(gameRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      console.warn("[Game] Комната удалена или не существует");
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
    console.log("[Game] Прогресс", { myProgress, oppProgress, total: questionsList.length });
    
    const myProgressSpan = document.getElementById('my-progress');
    const oppProgressSpan = document.getElementById('opponent-progress');
    if (myProgressSpan) myProgressSpan.textContent = `${myProgress}/${questionsList.length}`;
    if (oppProgressSpan) oppProgressSpan.textContent = `${oppProgress}/${questionsList.length}`;

    // Проверяем, завершили ли оба игрока
    const myFinished = playerAnswers[myUid]?.finished || false;
    const oppFinished = opponentId ? (playerAnswers[opponentId]?.finished || false) : false;
    console.log("[Game] Статус завершения", { myFinished, oppFinished, playerFinished });

    if (myFinished && oppFinished) {
      // Игра окончена, определяем победителя
      const myTotalTime = playerAnswers[myUid]?.totalTimeMs || 0;
      const oppTotalTime = playerAnswers[opponentId]?.totalTimeMs || 0;
      const winnerUid = myTotalTime < oppTotalTime ? myUid : opponentId;
      console.log("[Game] Оба игрока завершили. Победитель", winnerUid, { myTotalTime, oppTotalTime });
      finishGame(winnerUid, myUid, opponentId);
    } else if (myFinished && !playerFinished) {
      // Текущий игрок только что завершил, но второй ещё нет
      playerFinished = true;
      console.log("[Game] Игрок завершил все вопросы, ожидание соперника");
      document.getElementById('feedback-message').textContent = "Вы ответили на все вопросы! Ожидаем соперника...";
      document.getElementById('feedback-message').style.color = "#3498db";
      isWaitingForAnswer = false; // блокируем дальнейшие ответы
    }
  });
}

function displayCurrentQuestion() {
  console.log("[Game] displayCurrentQuestion вызван", { 
    currentQuestionIndex, 
    totalQuestions: questionsList.length,
    playerFinished 
  });
  
  if (!questionsList.length) {
    console.warn("[Game] Нет вопросов для отображения");
    return;
  }
  if (currentQuestionIndex >= questionsList.length) {
    console.log("[Game] Все вопросы уже отвечены, отображение нового вопроса не требуется");
    return;
  }
  const q = questionsList[currentQuestionIndex];
  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = `${q.text} = ?`;
  console.log("[Game] Отображён вопрос", { index: currentQuestionIndex, text: q.text, answer: q.answer });
  
  currentAnswer = "";
  updateAnswerDisplay();
  const feedbackEl = document.getElementById('feedback-message');
  if (feedbackEl) feedbackEl.textContent = "";
  isWaitingForAnswer = true;
  
  // Засекаем время начала вопроса
  questionStartTime = performance.now();
  console.log("[Game] Время вопроса засечено", questionStartTime);
}

function updateAnswerDisplay() {
  const display = document.getElementById('answer-input');
  if (display) display.textContent = currentAnswer || "_";
}

function attachKeyboardHandlers() {
  console.log("[Game] Прикрепление обработчиков клавиатуры");
  const keypad = document.getElementById('multiplication-keypad');
  if (!keypad) {
    console.warn("[Game] Элемент multiplication-keypad не найден");
    return;
  }
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
  if (!isWaitingForAnswer || playerFinished) {
    console.log("[Game] Клавиша игнорируется", { isWaitingForAnswer, playerFinished, key });
    return;
  }
  console.log("[Game] Нажата клавиша", key, "текущий ответ", currentAnswer);

  if (key === 'del') {
    currentAnswer = currentAnswer.slice(0, -1);
    updateAnswerDisplay();
  } else if (key === 'clear') {
    currentAnswer = "";
    updateAnswerDisplay();
  } else if (key === 'enter') {
    if (currentAnswer === "") {
      console.log("[Game] Пустой ответ, игнорируем enter");
      return;
    }
    submitAnswer();
  } else if (/^\d$/.test(key)) {
    if (currentAnswer.length < 3) {
      currentAnswer += key;
      updateAnswerDisplay();
    } else {
      console.log("[Game] Ответ слишком длинный, больше 3 цифр");
    }
  }
}

async function submitAnswer() {
  console.log("[Game] submitAnswer начат");
  const user = getCurrentUser();
  if (!user || !currentRoomId) {
    console.error("[Game] Нет пользователя или ID комнаты", { user: user?.uid, currentRoomId });
    return;
  }
  if (!questionsList.length) {
    console.error("[Game] Нет вопросов");
    return;
  }
  if (currentQuestionIndex >= questionsList.length) {
    console.warn("[Game] Индекс вопроса вне диапазона", currentQuestionIndex);
    return;
  }
  if (playerFinished) {
    console.log("[Game] Игрок уже завершил, ответ не принимается");
    return;
  }

  const q = questionsList[currentQuestionIndex];
  const userAnswer = parseInt(currentAnswer, 10);
  if (isNaN(userAnswer)) {
    console.log("[Game] Нечисловой ответ", currentAnswer);
    return;
  }

  const isCorrect = (userAnswer === q.answer);
  const responseTimeMs = performance.now() - questionStartTime;
  totalResponseTime += responseTimeMs;
  console.log("[Game] Ответ", { 
    questionIndex: currentQuestionIndex, 
    userAnswer, 
    correctAnswer: q.answer, 
    isCorrect, 
    responseTimeMs,
    totalResponseTimeSoFar: totalResponseTime
  });

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
  console.log("[Game] Получение текущих ответов из Firebase");
  const snapshot = await get(playerAnswersRef);
  const currentData = snapshot.val() || { answers: [], totalTimeMs: 0, finished: false };
  const newAnswers = [...currentData.answers, answerRecord];
  
  const isFinished = newAnswers.length === questionsList.length;
  const newTotalTime = currentData.totalTimeMs + responseTimeMs;
  
  console.log("[Game] Сохранение ответа", { 
    answersCount: newAnswers.length, 
    totalQuestions: questionsList.length, 
    isFinished, 
    newTotalTime 
  });
  
  await update(playerAnswersRef, {
    answers: newAnswers,
    totalTimeMs: newTotalTime,
    finished: isFinished
  });
  console.log("[Game] Ответ сохранён в Firebase");

  isWaitingForAnswer = false;
  currentQuestionIndex++;
  console.log("[Game] Переход к следующему вопросу, новый индекс", currentQuestionIndex);

  if (!isFinished) {
    // Переход к следующему вопросу через небольшую задержку
    console.log("[Game] Запланирован переход к следующему вопросу через 800 мс");
    setTimeout(() => {
      console.log("[Game] Таймер сработал, вызов displayCurrentQuestion");
      displayCurrentQuestion();
    }, 800);
  } else {
    // Игрок завершил все вопросы – не показываем новый вопрос, ждём соперника
    console.log("[Game] Игрок завершил все вопросы, ожидание соперника");
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
  console.log("[Game] finishGame вызван", { winnerUid, myUid, opponentId });
  if (!gameListener) {
    console.warn("[Game] gameListener уже отсутствует");
    return;
  }
  gameListener(); // отписываемся
  gameListener = null;
  console.log("[Game] Слушатель отключён");

  const isWin = winnerUid === myUid;
  console.log("[Game] Обновление статистики", { isWin });
  updateStats(myUid, isWin);
  
  // Обновляем статус комнаты
  console.log("[Game] Обновление статуса комнаты на finished, победитель", winnerUid);
  update(ref(db, `rooms/${currentRoomId}/meta`), {
    status: 'finished',
    winner: winnerUid
  }).then(() => console.log("[Game] Статус комнаты обновлён"));

  const resultText = isWin ? 'Победа!' : 'Поражение...';
  const resultEl = document.getElementById('result-text');
  if (resultEl) resultEl.textContent = resultText;
  showScreen('result-screen');
  cleanupGame();
}

function cleanupGame() {
  console.log("[Game] cleanupGame вызван");
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
  currentRoomId = null;
  gameRef = null;
  console.log("[Game] Ресурсы очищены");
}

function leaveLobbyAndBack() {
  console.log("[Game] leaveLobbyAndBack вызван");
  import("./lobby.js").then(module => {
    module.leaveLobby();
    showScreen('menu-screen');
  });
}