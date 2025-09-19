// game-multiple.js

// Импорт Firebase функций (предполагая, что firebase.js уже настроен)
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { app } from './firebase.js';

// Инициализация переменных
let startTime;
let timerInterval;
let currentQuestion = 1;
let score = 0;
let answersHistory = [];
let playerName = "";
let gameDifficulty = "midle";
let questions = [];
let db;

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

// Генерация примеров на умножение
function generateQuestions(difficulty) {
  const questions = [];
  let min, max;
  
  // Устанавливаем диапазон чисел в зависимости от сложности
  switch(difficulty) {
    case 'easy':
      min = 1;
      max = 5;
      break;
    case 'hard':
      min = 6;
      max = 15;
      break;
    default: // midle
      min = 2;
      max = 9;
  }
  
  // Генерируем 20 случайных примеров
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(Math.random() * (max - min + 1)) + min;
    const b = Math.floor(Math.random() * (max - min + 1)) + min;
    questions.push({
      question: `${a} × ${b} = ?`,
      correctAnswer: a * b
    });
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
  
  gameContent.innerHTML = `
    <div class="question">${question.question}</div>
    <input type="number" id="answerInput" placeholder="Ваш ответ" autocomplete="off">
  `;
  
  // Фокус на поле ввода
  setTimeout(() => {
    document.getElementById('answerInput').focus();
  }, 100);
}

// Проверка ответа
function checkAnswer() {
  const answerInput = document.getElementById('answerInput');
  const userAnswer = parseInt(answerInput.value);
  
  if (isNaN(userAnswer)) {
    messageElement.textContent = "Пожалуйста, введите число!";
    return;
  }
  
  const currentQ = questions[currentQuestion - 1];
  const isCorrect = userAnswer === currentQ.correctAnswer;
  
  // Записываем в историю
  answersHistory.push({
    question: currentQ.question,
    userAnswer: userAnswer,
    correctAnswer: currentQ.correctAnswer,
    isCorrect: isCorrect
  });
  
  // Обновляем счет
  if (isCorrect) {
    score++;
    scoreElement.textContent = score;
    messageElement.textContent = "Верно!";
  } else {
    messageElement.textContent = `Неверно! Правильный ответ: ${currentQ.correctAnswer}`;
  }
  
  // Переходим к следующему вопросу
  currentQuestion++;
  
  // Очищаем сообщение через 1 секунду
  setTimeout(() => {
    messageElement.textContent = "";
    displayQuestion();
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

// Завершение игры
function endGame() {
  clearInterval(timerInterval);
  const endTime = new Date();
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  
  // Сохраняем результат в Firebase
  saveResult(playerName, score, totalSeconds, gameDifficulty);
  
  // Показываем итоги
  finalTimeElement.textContent = formatTime(totalSeconds);
  
  // Показываем историю ответов
  answersListElement.innerHTML = '';
  answersHistory.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      ${index + 1}. ${item.question} 
      <span class="${item.isCorrect ? 'correct' : 'incorrect'}">
        Ваш ответ: ${item.userAnswer} ${item.isCorrect ? '✓' : `✗ (Правильно: ${item.correctAnswer})`}
      </span>
    `;
    answersListElement.appendChild(li);
  });
  
  // Переходим на экран завершения
  gameScreen.classList.add('hidden');
  endScreen.classList.remove('hidden');
}

// Сохранение результата в Firebase
function saveResult(name, score, time, difficulty) {
  if (!db) return;
  
  const resultId = Date.now().toString();
  const resultRef = ref(db, `results/${difficulty}/${resultId}`);
  
  set(resultRef, {
    name: name,
    score: score,
    time: time,
    timestamp: Date.now()
  });
}

// Загрузка рекордов из Firebase
function loadHighscores() {
  if (!db) return;
  
  // Для каждой сложности
  ['easy', 'midle', 'hard'].forEach(difficulty => {
    const scoresRef = ref(db, `results/${difficulty}`);
    onValue(scoresRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      // Преобразуем в массив и сортируем
      const results = [];
      for (let id in data) {
        results.push({...data[id], id});
      }
      
      // Сортируем по очкам (по убыванию) и времени (по возрастанию)
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
      });
      
      // Показываем топ-5 для каждой сложности
      if (difficulty === 'midle') { // По умолчанию показываем среднюю сложность
        displayHighscores(results.slice(0, 5));
      }
    });
  });
}

// Отображение таблицы рекордов
function displayHighscores(scores) {
  highscoreListElement.innerHTML = '';
  
  if (scores.length === 0) {
    highscoreListElement.innerHTML = '<p>Рекордов пока нет</p>';
    return;
  }
  
  scores.forEach((score, index) => {
    const div = document.createElement('div');
    div.className = 'highscore-item';
    div.innerHTML = `
      <span class="rank">${index + 1}.</span>
      <span class="name">${score.name}</span>
      <span class="score">${score.score}/20</span>
      <span class="time">${formatTime(score.time)}</span>
    `;
    highscoreListElement.appendChild(div);
  });
}

// Инициализация игры
function initGame() {
  // Инициализация Firebase
  try {
    db = getDatabase(app);
    loadHighscores();
  } catch (error) {
    console.error("Ошибка инициализации Firebase:", error);
  }
  
  // Обработчик кнопки "Старт"
  startBtn.addEventListener('click', () => {
    playerName = playerNameInput.value.trim() || 'Аноним';
    
    // Получаем выбранную сложность
    const difficultyRadios = document.getElementsByName('game');
    for (let radio of difficultyRadios) {
      if (radio.checked) {
        gameDifficulty = radio.value;
        break;
      }
    }
    
    // Генерируем вопросы
    questions = generateQuestions(gameDifficulty);
    
    // Сбрасываем состояние игры
    currentQuestion = 1;
    score = 0;
    answersHistory = [];
    scoreElement.textContent = score;
    
    // Переключаем экраны
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Запускаем таймер и показываем первый вопрос
    startTimer();
    displayQuestion();
  });
  
  // Обработчик кнопки "Готово"
  checkBtn.addEventListener('click', checkAnswer);
  
  // Обработчик нажатия Enter в поле ответа
  gameContent.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkAnswer();
    }
  });
  
  // Обработчик кнопки "Хорошо!" (перезапуск игры)
  resetBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    
    // Обновляем таблицу рекордов
    if (db) {
      loadHighscores();
    }
  });
  
  // Обработчики изменения сложности для обновления таблицы рекордов
  const difficultyRadios = document.getElementsByName('game');
  for (let radio of difficultyRadios) {
    radio.addEventListener('change', () => {
      // При изменении сложности нужно обновлять таблицу рекордов
      // Реализация будет добавлена после настройки Firebase
    });
  }
}

// Запуск инициализации при загрузке документа
document.addEventListener('DOMContentLoaded', initGame);