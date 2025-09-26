// game-multiple.js

// В начало game-multiple.js добавьте
const APP_VERSION = '0.61';
const BUILD_TIME = '27.09.2025 02:18'; // Обновляйте вручную при каждом изменении

// И обновите функцию displayVersion
function displayVersion() {
    const versionInfo = document.getElementById('versionInfo');
    if (versionInfo) {
        versionInfo.textContent = `v${APP_VERSION} (${BUILD_TIME})`;
        versionInfo.title = `Версия: ${APP_VERSION}, Сборка: ${BUILD_TIME}`;
    }
}

// game-multiple.js - добавляем многопользовательский функционал
import { 
  saveGameResult, 
  getHighscores,
  createSession,
  joinSession,
  getSession,
  subscribeToSession,
  updatePlayerProgress,
  startSession,
  endSession
} from './firebase.js';

// Инициализация переменных
let startTime;
let timerInterval;
let currentQuestion = 1;
let score = 0;
let answersHistory = [];
let playerName = "";
let gameDifficulty = "midle";
let questions = [];
let isGameActive = false;

// ... добавляем многопользовательский функционал переменные
let currentSessionId = null;
let isHost = false;
let sessionUnsubscribe = null;
let players = [];
let gameStartTimeout = null;

// Получение элементов DOM
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const playerNameInput = document.getElementById('playerName');
const startBtn = document.getElementById('startBtn');
const checkBtn = document.getElementById('checkBtn');
const resetBtn = document.getElementById('resetBtn');
const levelElement = document.getElementById('level');
const scoreElement = document.getElementById('score');
const questionCounterElement = document.getElementById('questionCounter');
const gameContent = document.getElementById('gameContent');
const messageElement = document.getElementById('message');
const finalTimeElement = document.getElementById('finalTime');
const answersListElement = document.getElementById('answersList');
const highscoreListElement = document.getElementById('highscoreList');
const nameErrorElement = document.getElementById('nameError');
const questionText = document.getElementById('questionText');

// Добавляем элементы DOM для многопользовательского режима
const sessionScreen = document.getElementById('sessionScreen');
const sessionIdElement = document.getElementById('sessionId');
const playersListElement = document.getElementById('playersList');
const countdownElement = document.getElementById('countdown');
const waitingMessageElement = document.getElementById('waitingMessage');

// Новая функция для отображения экрана ожидания сессии
function showSessionScreen(sessionId, isHost) {
  startScreen.classList.add('hidden');
  sessionScreen.classList.remove('hidden');
  sessionIdElement.textContent = sessionId;
  
  if (isHost) {
    waitingMessageElement.textContent = "Ожидание игроков... (максимум 4)";
  } else {
    waitingMessageElement.textContent = "Ожидание начала игры...";
  }
}

// Функция для отображения списка игроков
function updatePlayersList(players) {
  playersListElement.innerHTML = '';
  players.forEach((player, index) => {
    const playerElement = document.createElement('div');
    playerElement.className = 'player-item';
    playerElement.innerHTML = `
      <span class="player-name">${player.name}</span>
      <span class="player-status">${index === 0 ? '👑' : '👤'}</span>
    `;
    playersListElement.appendChild(playerElement);
  });
}

// Функция для отображения прогресса игроков во время игры
function updatePlayersProgress(players) {
  const opponentProgress = document.getElementById('opponentProgress');
  opponentProgress.innerHTML = '';
  
  // Фильтруем текущего игрока
  const otherPlayers = players.filter(player => player.name !== playerName);
  
  otherPlayers.forEach(player => {
    const playerProgress = document.createElement('div');
    playerProgress.className = 'player-progress';
    
    const playerNameElement = document.createElement('div');
    playerNameElement.className = 'player-name-small';
    playerNameElement.textContent = player.name;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    for (let i = 0; i < 20; i++) {
      const brick = document.createElement('div');
      brick.className = 'progress-brick';
      
      if (i < player.progress) {
        // Находим ответ для этого вопроса
        const answer = player.answers[i];
        brick.classList.add(answer && answer.isCorrect ? 'correct' : 'incorrect');
      }
      
      progressBar.appendChild(brick);
    }
    
    playerProgress.appendChild(playerNameElement);
    playerProgress.appendChild(progressBar);
    opponentProgress.appendChild(playerProgress);
  });
}

// Функция для запуска обратного отсчета
function startCountdown(seconds, callback) {
  let count = seconds;
  countdownElement.textContent = `Игра начнется через: ${count}с`;
  countdownElement.classList.remove('hidden');
  
  const countdownInterval = setInterval(() => {
    count--;
    countdownElement.textContent = `Игра начнется через: ${count}с`;
    
    if (count <= 0) {
      clearInterval(countdownInterval);
      countdownElement.classList.add('hidden');
      callback();
    }
  }, 1000);
}

// Добавим после объявления переменных
function validateName(input) {
  const value = input.value.trim();
  if (value.length > 20) {
    input.value = value.substring(0, 20);
  }
}

// Генерация примеров на умножение
function generateQuestions(difficulty) {
  const questions = [];
  let multiplier = [];
  let min, max;
  
  // Устанавливаем диапазон чисел в зависимости от сложности
  switch(difficulty) {
    case 'in8':
      min = 2;
      max = 30;
      multiplier = [8];
      break;
    case 'in17':
      min = 2;
      max = 30;
      multiplier = [17];
      break;
    case 'in35':
      min = 2;
      max = 30;
      multiplier = [35];
      break;
    default: // all
      min = 5;
      max = 20;
      multiplier = [5, 8, 11, 17, 17, 17, 35, 35];
  }
  
// Для отслеживания уникальных вопросов
  const usedQuestions = new Set();
  
  // Генерируем 20 уникальных примеров
  let attempts = 0;
  const maxAttempts = 100; // Защита от бесконечного цикла
  
  while (questions.length < 20 && attempts < maxAttempts) {
    attempts++;
    
    const b = multiplier[Math.floor(Math.random() * multiplier.length)];
    const a = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Проверяем, чтобы ответ был не слишком большим (максимум 3 цифры)
    if (a * b > 999) {
      continue;
    }
    
    // Создаем уникальный идентификатор вопроса
    const questionKey = `${a}-${b}`;
    
    // Пропускаем, если вопрос уже использовался
    if (usedQuestions.has(questionKey)) {
      continue;
    }
    
    // Добавляем вопрос в использованные
    usedQuestions.add(questionKey);
    
    questions.push({
      question: `${a} × ${b} = ?`,
      correctAnswer: a * b
    });
  }
  
  // Если не удалось сгенерировать достаточно уникальных вопросов,
  // дополняем оставшиеся места не уникальными
  if (questions.length < 20) {
    const needed = 20 - questions.length;
    
    for (let i = 0; i < needed; i++) {
      const b = multiplier[Math.floor(Math.random() * multiplier.length)];
      const a = Math.floor(Math.random() * (max - min + 1)) + min;
      
      // Проверяем, чтобы ответ был не слишком большим
      if (a * b > 999) {
        i--; // Повторяем итерацию
        continue;
      }
      
      questions.push({
        question: `${a} × ${b} = ?`,
        correctAnswer: a * b
      });
    }
  }
  
  return questions;
}

// Отображение текущего вопроса
function displayQuestion() {
  if (currentQuestion > 20) {
    endGame();
    return;
  }
  
  const question = questions[currentQuestion - 1];
  levelElement.textContent = currentQuestion;
  questionCounterElement.textContent = `${currentQuestion}/20`;
  if (questionText) questionText.textContent = question.question;

  // Фокус на поле ввода
  setTimeout(() => {
    const answerInput = document.getElementById('answerInput');
    if (answerInput) answerInput.focus();
  }, 100);
}

// Модифицируем функцию checkAnswer() для многопользовательского режима
async function checkAnswer() {
  const answerInput = document.getElementById('answerInput');
  const userAnswer = parseInt(answerInput.value);
  
  if (isNaN(userAnswer)) {
    messageElement.textContent = "Пожалуйста, введите число!";
    answerInput.value = '';
    answerInput.focus();
    return;
  }
  
  const currentQ = questions[currentQuestion - 1];
  const isCorrect = userAnswer === currentQ.correctAnswer;
  
  const answerData = {
    question: currentQ.question,
    userAnswer: userAnswer,
    correctAnswer: currentQ.correctAnswer,
    isCorrect: isCorrect
  };
  
  answersHistory.push(answerData);
  
  if (isCorrect) {
    score++;
    scoreElement.textContent = score;
    messageElement.textContent = "Верно!";
  } else {
    messageElement.textContent = `Неверно! Правильный ответ: ${currentQ.correctAnswer}`;
  }
  
  // Обновляем прогресс в сессии
  if (currentSessionId) {
    try {
      await updatePlayerProgress(
        currentSessionId, 
        playerName, 
        currentQuestion, // Уже увеличенный на 1
        score, 
        answersHistory
      );
    } catch (error) {
      console.error("Ошибка обновления прогресса:", error);
    }
  }
  
  currentQuestion++;
  
  setTimeout(() => {
    messageElement.textContent = "";
    if (currentQuestion > 20) {
      endGame();
    } else {
      displayQuestion();
    }
  }, 1000);
}

// Запуск таймера
function startTimer() {
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
}

// Обновление таймера
function updateTimer() {
  const currentTime = new Date();
  const elapsedTime = Math.floor((currentTime - startTime) / 1000);
  document.getElementById('nazvanie').textContent = `Время: ${formatTime(elapsedTime)}`;
}

// Форматирование времени в мм:сс
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Модифицируем функцию endGame() для многопользовательского режима
async function endGame() {
  isGameActive = false;
  clearInterval(timerInterval);
  
  if (gameStartTimeout) {
    clearTimeout(gameStartTimeout);
  }
  
  if (sessionUnsubscribe) {
    sessionUnsubscribe();
  }
  
  const endTime = new Date();
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  
  finalTimeElement.textContent = formatTime(totalSeconds);
  
  // В функции endGame обновим отображение истории ответов
  answersListElement.innerHTML = '';
  answersHistory.forEach((item, index) => {
    const li = document.createElement('li');
    li.classList.add(item.isCorrect ? 'correct' : 'incorrect');
    li.innerHTML = `
      <strong>${index + 1}.</strong> ${item.question.replace('?', '')}
      <br>
      <span class="answer-result">
        Ваш ответ: ${item.userAnswer} 
        ${item.isCorrect ? 
          '<span class="result-icon">✓</span>' : 
          `<span class="result-icon">✗</span> (Правильно: ${item.correctAnswer})`
        }
      </span>
    `;
    answersListElement.appendChild(li);
  });
  
  // Сохраняем результат в Firebase
  try {
    const saveSuccess = await saveGameResult(playerName, score, totalSeconds, gameDifficulty);
    if (!saveSuccess) {
      showError("Не удалось сохранить результат. Проверьте подключение к интернету.");
    }
  } catch (error) {
    showError("Ошибка при сохранении результата: " + error.message);
  }
  
  // Завершаем сессию, если мы хост
  if (isHost && currentSessionId) {
    await endSession(currentSessionId);
  }
  
  // Переходим на экран завершения
  gameScreen.classList.add('hidden');
  endScreen.classList.remove('hidden');
  
  // Убираем обработчик beforeunload
  window.removeEventListener('beforeunload', confirmExit);
}

// Добавим функцию подтверждения выхода
function confirmExit(e) {
  if (isGameActive) {
    e.preventDefault();
    e.returnValue = 'Вы уверены, что хотите покинуть страницу? Ваш прогресс будет потерян.';
    return e.returnValue;
  }
}

// Отображение таблицы рекордов
function displayHighscores(scores) {
  highscoreListElement.innerHTML = '';
  
  if (scores.length === 0) {
    highscoreListElement.innerHTML = '<p>Рекордов пока нет</p>';
    return;
  }
  
  scores.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'highscore-item';
    div.innerHTML = `
      <span class="rank">${index + 1}.</span>
      <span class="name">${item.name}</span>
      <span class="score">${item.score}/20</span>
      <span class="time">${formatTime(item.time)}</span>
    `;
    highscoreListElement.appendChild(div);
  });
}

// Загрузка рекордов из Firebase
async function loadHighscores(difficulty = 'all') {
  try {
    const scores = await getHighscores(difficulty, 5);
    displayHighscores(scores);
  } catch (error) {
    console.error("Ошибка при загрузке рекордов:", error);
  }
}

// Обработчик изменения сложности
function handleDifficultyChange() {
  const difficultyRadios = document.getElementsByName('game');
  for (let radio of difficultyRadios) {
    if (radio.checked) {
      loadHighscores(radio.value);
      break;
    }
  }
}

// Обновим обработчик input для playerNameInput
playerNameInput.addEventListener('input', () => {
  validateName(playerNameInput);
  if (playerNameInput.value.trim()) {
    nameErrorElement.style.display = 'none';
  }
});

// Добавим функции для работы с модальным окном
function showError(message) {
  const errorModal = document.getElementById('errorModal');
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorModal.classList.remove('hidden');
}

function hideError() {
  const errorModal = document.getElementById('errorModal');
  errorModal.classList.add('hidden');
}

// Инициализация игры
function initGame() {

    // Показываем версию
  displayVersion();

  // Загрузка сохраненного имени из localStorage
  const savedName = localStorage.getItem('playerName');
  if (savedName) {
    playerNameInput.value = savedName;
  }
  
  // Загрузка рекордов по умолчанию
  loadHighscores();

    // Инициализация модального окна
  const errorModal = document.getElementById('errorModal');
  const closeModalBtn = errorModal.querySelector('.close');
  
  closeModalBtn.addEventListener('click', hideError);
  errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) hideError();
  });
  
  // Обработчик кнопки "Старт" - теперь создает/присоединяется к сессии
  startBtn.addEventListener('click', async () => {
    playerName = playerNameInput.value.trim();

    // Проверка на пустое имя
    if (!playerName) {
      nameErrorElement.style.display = 'block';
      playerNameInput.focus();
      return;
    }
    
    // Проверка на длину имени
    if (playerName.length > 20) {
      nameErrorElement.textContent = "Имя не должно превышать 20 символов";
      nameErrorElement.style.display = 'block';
      playerNameInput.focus();
      return;
    }
    
    // Сохраняем имя в localStorage
    localStorage.setItem('playerName', playerName);
    
    // Скрываем ошибку если имя введено
    nameErrorElement.style.display = 'none';
    
    // Получаем выбранную сложность
    const difficultyRadios = document.getElementsByName('game');
    for (let radio of difficultyRadios) {
      if (radio.checked) {
        gameDifficulty = radio.value;
        break;
      }
    }
    
    // Пытаемся присоединиться к сессии или создать новую
    // currentSessionId = playerName; // Используем имя как идентификатор сессии
    // Риск конфликта имен. Лучше генерировать случайный ID:
    currentSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();


    const existingSession = await getSession(currentSessionId);
    
    if (existingSession && existingSession.status === "waiting") {
      // Присоединяемся к существующей сессии
      const success = await joinSession(currentSessionId, playerName);
      if (!success) {
        showError("Не удалось присоединиться к сессии");
        return;
      }
      isHost = false;
    } else {
      // Создаем новую сессию
      const success = await createSession(currentSessionId, playerName, gameDifficulty);
      if (!success) {
        showError("Не удалось создать сессию");
        return;
      }
      isHost = true;
      
      // Автоматически запускаем игру через 5 секунд
      gameStartTimeout = setTimeout(async () => {
        await startSession(currentSessionId);
      }, 5000);
    }
    
    showSessionScreen(currentSessionId, isHost);
    
    // Подписываемся на изменения сессии
    sessionUnsubscribe = subscribeToSession(currentSessionId, (session) => {
      if (!session) return;
      
      players = session.players;
      updatePlayersList(players);
      
      if (session.status === "starting") {
        startCountdown(3, () => {
          startMultiplayerGame(session);
        });
      } else if (session.status === "active") {
        updatePlayersProgress(players);
      }
    });
  });
  
  // Обработчик кнопки "Готово"
  checkBtn.addEventListener('click', checkAnswer);
  
  // Обработчик нажатия Enter в поле ответа
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !gameScreen.classList.contains('hidden')) {
      if (document.activeElement.id === 'answerInput' && isGameActive) {
        checkAnswer();
      } else {
        // Если поле ввода не в фокусе, фокусируемся на нем
        const answerInput = document.getElementById('answerInput');
        if (answerInput) answerInput.focus();
      }
    }
  });
  
  // Обработчик кнопки "Хорошо!" (перезапуск игры)
  resetBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    // Обновляем таблицу рекордов
    loadHighscores(gameDifficulty);
  });
  
  // Обработчики изменения сложности для обновления таблицы рекордов
  const difficultyRadios = document.getElementsByName('game');
  for (let radio of difficultyRadios) {
    radio.addEventListener('change', handleDifficultyChange);
  }
}

// Новая функция для запуска многопользовательской игры
function startMultiplayerGame(session) {
  questions = generateQuestions(session.difficulty);
  currentQuestion = 1;
  score = 0;
  answersHistory = [];
  scoreElement.textContent = score;
  isGameActive = true;
  
  sessionScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  
  window.addEventListener('beforeunload', confirmExit);
  startTimer();
  displayQuestion();
}

// Запуск инициализации при загрузке документа
document.addEventListener('DOMContentLoaded', initGame);