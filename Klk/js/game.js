// game.js
// Модуль управления игровым процессом: отображение вопросов, обработка ответов,
// синхронизация с Firebase, определение победителя.

import {
  ref,
  onValue,
  get,
  update,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { db } from "./config.js";
import { getCurrentUser } from "./auth.js";
import { showScreen } from "./ui.js";
import { updateStats } from "./profile.js";

// ---------- Внутреннее состояние модуля ----------
let currentRoomId = null;          // ID текущей комнаты
let gameListener = null;           // Слушатель изменений комнаты
let questionsList = [];            // Массив вопросов [{ text, answer }]
let currentQuestionIdx = 0;        // Индекс текущего вопроса (0-based)
let currentAnswer = "";            // Вводимый ответ (строка)
let isWaitingForAnswer = true;     // Ожидание ответа на текущий вопрос
let questionStartTime = 0;         // Время начала вопроса (performance.now)
let totalResponseTimeMs = 0;       // Суммарное время ответов (мс)
let playerFinishedLocally = false; // Флаг, что игрок локально завершил все вопросы

// ---------- Вспомогательные функции ----------
// Обновление отображения введённого ответа
function updateAnswerDisplay() {
  const display = document.getElementById("answer-input");
  if (display) display.textContent = currentAnswer || "_";
}

// Отображение текущего вопроса на экране
function displayCurrentQuestion() {
  if (!questionsList.length || currentQuestionIdx >= questionsList.length) {
    console.warn("[Game] displayCurrentQuestion: нет вопросов или индекс вне диапазона");
    return;
  }

  const q = questionsList[currentQuestionIdx];
  const questionEl = document.getElementById("question-text");
  if (questionEl) questionEl.textContent = `${q.text} = ?`;

  currentAnswer = "";
  updateAnswerDisplay();

  const feedbackEl = document.getElementById("feedback-message");
  if (feedbackEl) feedbackEl.textContent = "";

  isWaitingForAnswer = true;
  questionStartTime = performance.now();

  console.log(`[Game] Вопрос ${currentQuestionIdx + 1}/${questionsList.length}: ${q.text}`);
}

// Воспроизведение звукового сигнала (правильно/неправильно)
function playSoundEffect(correct) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();

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

// Сохранение ответа в Firebase и обновление прогресса игрока
async function submitAnswerToDB(userAnswerNum, isCorrect, responseTimeMs) {
  const user = getCurrentUser();
  if (!user || !currentRoomId) {
    throw new Error("Нет пользователя или ID комнаты");
  }

  const answerRecord = {
    questionIndex: currentQuestionIdx,
    answer: userAnswerNum,
    isCorrect: isCorrect,
    responseTimeMs: responseTimeMs,
    timestamp: serverTimestamp(),
  };

  const playerAnswersRef = ref(db, `rooms/${currentRoomId}/playerAnswers/${user.uid}`);

  // Получаем текущие данные игрока
  const snapshot = await get(playerAnswersRef);
  const currentData = snapshot.val() || { answers: [], totalTimeMs: 0, finished: false };

  const newAnswers = [...currentData.answers, answerRecord];
  const newTotalTime = currentData.totalTimeMs + responseTimeMs;
  const isFinished = newAnswers.length === questionsList.length;

  // Обновляем запись
  await update(playerAnswersRef, {
    answers: newAnswers,
    totalTimeMs: newTotalTime,
    finished: isFinished,
  });

  console.log(`[Game] Ответ сохранён. Прогресс: ${newAnswers.length}/${questionsList.length}, завершён: ${isFinished}`);
  return { isFinished, newTotalTime };
}

// Обработка ответа пользователя (вызывается при нажатии Enter)
async function handleSubmitAnswer() {
  if (!isWaitingForAnswer || playerFinishedLocally) {
    console.log("[Game] Ответ не принимается (ожидание или уже завершён)");
    return;
  }

  const user = getCurrentUser();
  if (!user || !currentRoomId || !questionsList.length) {
    console.error("[Game] Невозможно отправить ответ: недостающие данные");
    return;
  }

  if (currentAnswer === "") {
    console.log("[Game] Пустой ответ");
    return;
  }

  const q = questionsList[currentQuestionIdx];
  const userAnswerNum = parseInt(currentAnswer, 10);
  if (isNaN(userAnswerNum)) {
    console.log("[Game] Ответ не является числом");
    return;
  }

  const isCorrect = (userAnswerNum === q.answer);
  const responseTimeMs = performance.now() - questionStartTime;
  totalResponseTimeMs += responseTimeMs;

  // Отображаем обратную связь
  const feedbackEl = document.getElementById("feedback-message");
  if (isCorrect) {
    feedbackEl.textContent = `✓ Верно! +${responseTimeMs.toFixed(0)} мс`;
    feedbackEl.style.color = "#2ecc71";
    playSoundEffect(true);
  } else {
    feedbackEl.textContent = `✗ Неверно. Правильно: ${q.answer} (${responseTimeMs.toFixed(0)} мс)`;
    feedbackEl.style.color = "#e74c3c";
    playSoundEffect(false);
  }

  isWaitingForAnswer = false;

  // Сохраняем ответ в БД
  let isFinished = false;
  try {
    const result = await submitAnswerToDB(userAnswerNum, isCorrect, responseTimeMs);
    isFinished = result.isFinished;
  } catch (err) {
    console.error("[Game] Ошибка сохранения ответа:", err);
    feedbackEl.textContent = "Ошибка сохранения ответа, попробуйте ещё раз";
    isWaitingForAnswer = true; // Разрешаем повторную попытку
    return;
  }

  // Переход к следующему вопросу или завершение
  currentQuestionIdx++;

  if (!isFinished) {
    // Задержка перед следующим вопросом
    setTimeout(() => {
      displayCurrentQuestion();
    }, 800);
  } else {
    // Игрок завершил все вопросы – ждём соперника
    playerFinishedLocally = true;
    feedbackEl.textContent = "Вы ответили на все вопросы! Ожидаем соперника...";
    feedbackEl.style.color = "#3498db";
    // Блокируем дальнейший ввод (isWaitingForAnswer уже false)
  }
}

// Обработка нажатий клавиш (цифры, Del, Clear, Enter)
function handleKeyPress(key) {
  if (!isWaitingForAnswer || playerFinishedLocally) return;

  if (key === "del") {
    currentAnswer = currentAnswer.slice(0, -1);
    updateAnswerDisplay();
  } else if (key === "clear") {
    currentAnswer = "";
    updateAnswerDisplay();
  } else if (key === "enter") {
    if (currentAnswer !== "") handleSubmitAnswer();
  } else if (/^\d$/.test(key)) {
    if (currentAnswer.length < 3) { // Максимум 3 цифры (произведение до 700)
      currentAnswer += key;
      updateAnswerDisplay();
    }
  }
}

// Прикрепление обработчиков к клавиатуре (виртуальной)
function attachKeyboardHandlers() {
  const keypad = document.getElementById("multiplication-keypad");
  if (!keypad) {
    console.warn("[Game] Элемент #multiplication-keypad не найден");
    return;
  }
  // Удаляем старые обработчики, чтобы избежать дублирования
  const newKeypad = keypad.cloneNode(true);
  keypad.parentNode.replaceChild(newKeypad, keypad);

  newKeypad.addEventListener("click", (e) => {
    const keyDiv = e.target.closest(".key");
    if (!keyDiv) return;
    const key = keyDiv.dataset.key;
    if (key) handleKeyPress(key);
  });
}

// ---------- Логика завершения игры ----------
async function finishGame(winnerUid, myUid, opponentId) {
  console.log(`[Game] Игра завершена. Победитель: ${winnerUid}`);

  if (gameListener) {
    gameListener(); // Отписываемся от изменений комнаты
    gameListener = null;
  }

  // Обновляем статистику побед/поражений текущего игрока
  const isWin = (winnerUid === myUid);
  updateStats(myUid, isWin);

  // Меняем статус комнаты на finished и записываем победителя
  await update(ref(db, `rooms/${currentRoomId}/meta`), {
    status: "finished",
    winner: winnerUid,
  });

  // Показываем экран результата
  const resultText = isWin ? "Победа!" : "Поражение...";
  const resultEl = document.getElementById("result-text");
  if (resultEl) resultEl.textContent = resultText;
  showScreen("result-screen");

  cleanupGame();
}

// Проверка, завершили ли оба игрока, и определение победителя
function checkBothFinishedAndDetermineWinner(roomData, myUid) {
  const players = roomData.players || {};
  const opponentId = Object.keys(players).find(id => id !== myUid);
  if (!opponentId) return false;

  const playerAnswers = roomData.playerAnswers || {};
  const myAnswers = playerAnswers[myUid];
  const oppAnswers = playerAnswers[opponentId];

  if (!myAnswers || !oppAnswers) return false;

  const myFinished = myAnswers.finished === true;
  const oppFinished = oppAnswers.finished === true;

  if (myFinished && oppFinished) {
    const myTotalTime = myAnswers.totalTimeMs || 0;
    const oppTotalTime = oppAnswers.totalTimeMs || 0;
    const winnerUid = (myTotalTime < oppTotalTime) ? myUid : opponentId;
    finishGame(winnerUid, myUid, opponentId);
    return true;
  }
  return false;
}

// Обновление отображения прогресса на экране
function updateProgressDisplay(roomData, myUid) {
  const playerAnswers = roomData.playerAnswers || {};
  const myAnswers = playerAnswers[myUid];
  if (!myAnswers) return;

  const myProgress = myAnswers.answers?.length || 0;

  const players = roomData.players || {};
  const opponentId = Object.keys(players).find(id => id !== myUid);
  let oppProgress = 0;
  if (opponentId && playerAnswers[opponentId]) {
    oppProgress = playerAnswers[opponentId].answers?.length || 0;
  }

  const total = questionsList.length;
  const mySpan = document.getElementById("my-progress");
  const oppSpan = document.getElementById("opponent-progress");
  if (mySpan) mySpan.textContent = `${myProgress}/${total}`;
  if (oppSpan) oppSpan.textContent = `${oppProgress}/${total}`;
}

// Слушатель изменений комнаты (прогресс, завершение игры)
function attachGameListener(roomId, myUid) {
  const roomRef = ref(db, `rooms/${roomId}`);
  gameListener = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      console.warn("[Game] Комната удалена или не существует");
      cleanupGame();
      showScreen("menu-screen");
      return;
    }

    // Обновляем отображение прогресса
    updateProgressDisplay(room, myUid);

    // Проверяем, не завершили ли оба игрока
    const finished = checkBothFinishedAndDetermineWinner(room, myUid);
    if (finished) return;

    // Дополнительно: если локально игрок завершил, но соперник ещё нет – показываем ожидание
    const playerAnswers = room.playerAnswers || {};
    const myFinished = playerAnswers[myUid]?.finished || false;
    if (myFinished && !playerFinishedLocally) {
      playerFinishedLocally = true;
      const feedbackEl = document.getElementById("feedback-message");
      if (feedbackEl) {
        feedbackEl.textContent = "Вы ответили на все вопросы! Ожидаем соперника...";
        feedbackEl.style.color = "#3498db";
      }
      isWaitingForAnswer = false;
    }
  });
}

// Инициализация записи ответов для игрока (если отсутствует)
async function initPlayerData(roomId, userId, totalQuestions) {
  const playerAnswersRef = ref(db, `rooms/${roomId}/playerAnswers/${userId}`);
  const snapshot = await get(playerAnswersRef);
  if (!snapshot.exists()) {
    await update(ref(db, `rooms/${roomId}/playerAnswers`), {
      [userId]: {
        answers: [],
        totalTimeMs: 0,
        finished: false,
      },
    });
    console.log("[Game] Создана запись ответов для игрока", userId);
  }
}

// Загрузка вопросов из комнаты
async function loadQuestions(roomId) {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  const room = snapshot.val();
  if (!room || !room.questions || !Array.isArray(room.questions) || room.questions.length === 0) {
    throw new Error("В комнате нет вопросов");
  }
  return room.questions;
}

// ---------- Основная функция запуска игры ----------
export async function startGame(roomId, hostUid) {
  console.log("[Game] startGame вызван", { roomId, hostUid });

  const user = getCurrentUser();
  if (!user) {
    console.error("[Game] Пользователь не авторизован");
    showScreen("menu-screen");
    return;
  }

  // Сброс локального состояния
  currentRoomId = roomId;
  questionsList = [];
  currentQuestionIdx = 0;
  currentAnswer = "";
  isWaitingForAnswer = true;
  questionStartTime = 0;
  totalResponseTimeMs = 0;
  playerFinishedLocally = false;

  // Очищаем старый слушатель, если был
  if (gameListener) {
    gameListener();
    gameListener = null;
  }

  showScreen("game-screen");
  attachKeyboardHandlers();

  try {
    // Загружаем вопросы
    questionsList = await loadQuestions(roomId);
    console.log(`[Game] Загружено ${questionsList.length} вопросов`);

    // Инициализируем данные игрока в БД
    await initPlayerData(roomId, user.uid, questionsList.length);

    // Отображаем первый вопрос
    displayCurrentQuestion();

    // Устанавливаем слушатель изменений комнаты (для прогресса и завершения)
    attachGameListener(roomId, user.uid);
  } catch (err) {
    console.error("[Game] Ошибка при старте игры:", err);
    const feedbackEl = document.getElementById("feedback-message");
    if (feedbackEl) feedbackEl.textContent = "Ошибка загрузки игры. Возврат в меню.";
    setTimeout(() => {
      import("./lobby.js").then(module => module.leaveLobby());
      showScreen("menu-screen");
    }, 2000);
  }
}

// Очистка ресурсов (выход из игры)
function cleanupGame() {
  console.log("[Game] cleanupGame");
  if (gameListener) {
    gameListener();
    gameListener = null;
  }
  currentRoomId = null;
  questionsList = [];
  currentQuestionIdx = 0;
  playerFinishedLocally = false;
}