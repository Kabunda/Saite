import {
  FIRST_MULTIPLIERS,
  SECOND_MIN,
  SECOND_MAX,
  DEFAULT_ROUNDS,
  buildUniqueQuestionList
} from './task-generator.js';

const nameInputScreen = document.getElementById("nameInputScreen");
const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const toMenuBtn = document.getElementById("toMenuBtn");
const playerNameInput = document.getElementById("playerNameInput");
const continueBtn = document.getElementById("continueBtn");
const editNameBtn = document.getElementById("editNameBtn");
const settingsBtn = document.getElementById("settingsBtn");
const currentPlayerName = document.getElementById("currentPlayerName");

// Модальные окна
const settingsModal = document.getElementById("settingsModal");
const editNameModal = document.getElementById("editNameModal");
const modalSoundToggle = document.getElementById("modalSoundToggle");
const modalVibrationToggle = document.getElementById("modalVibrationToggle");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const closeEditNameBtn = document.getElementById("closeEditNameBtn");
const saveNameBtn = document.getElementById("saveNameBtn");
const cancelEditNameBtn = document.getElementById("cancelEditNameBtn");
const editNameInput = document.getElementById("editNameInput");

const leaderboardBody = document.getElementById("leaderboardBody");

const progressTrackEl = document.getElementById("progressTrack");
const timerEl = document.getElementById("timer");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const feedbackEl = document.getElementById("feedback");
const keypad = document.getElementById("keypad");
const resultSummary = document.getElementById("resultSummary");
const answersList = document.getElementById("answersList");

const STORAGE_KEYS = {
  playerName: "mt_player_name",
  connected: "mt_connected",
  networkMode: "mt_network_mode",
  leaderboard: "mt_leaderboard",
  soundEnabled: "mt_sound_enabled",
  vibrationEnabled: "mt_vibration_enabled"
};

let currentRound = 0;
let score = 0;
let currentA = 0;
let currentB = 0;
let currentAnswer = "";
let roundStartAt = 0;
let elapsedMs = 0;
let isLocked = false;
let timerIntervalId = null;
let progressCells = [];
let streak = 0;
let bestStreak = 0;
let currentQuestions = [];
let mistakesInCurrentGame = [];
let answersLog = [];
let audioCtx = null;


function getPlayerName() {
  const value = localStorage.getItem(STORAGE_KEYS.playerName);
  return value && value.trim() ? value : "Игрок";
}

function setPlayerName(name) {
  localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
}

function getLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLeaderboard(items) {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(items));
}

function updateMenuStatus() {
  // Обновляем отображение имени игрока в новой панели
  currentPlayerName.textContent = getPlayerName();
}

function renderLeaderboard() {
  const items = getLeaderboard();
  if (!items.length) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="4">Пока нет результатов.</td>
      </tr>
    `;
    return;
  }

  leaderboardBody.innerHTML = "";
  items.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.playerName}</td>
      <td>${item.totalTimeSec.toFixed(1)} сек</td>
      <td>${item.score}/${item.rounds}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

function saveResult(result) {
  const current = getLeaderboard();
  const next = [...current, result]
    .sort((a, b) => {
      if (a.totalTimeSec !== b.totalTimeSec) return a.totalTimeSec - b.totalTimeSec;
      return b.score - a.score;
    })
    .slice(0, 10);
  setLeaderboard(next);
}

function startGame() {
  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentQuestions = buildUniqueQuestionList(20);
  currentRound = 0;
  score = 0;
  currentAnswer = "";
  elapsedMs = 0;
  roundStartAt = Date.now();
  isLocked = false;
  streak = 0;
  bestStreak = 0;
  mistakesInCurrentGame = [];
  answersLog = [];
  initProgressTrack();

  resetFeedback();
  renderAnswer();
  setCurrentQuestion();
  startTimer();
  requestFullscreenOnMobile();
}

function backToMenu() {
  stopTimer();
  isLocked = true;
  gameScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuStatus();
  renderLeaderboard();
}


function setCurrentQuestion() {
  const question = currentQuestions[currentRound];
  currentA = question.a;
  currentB = question.b;
  questionText.textContent = `${currentA} × ${currentB} = ?`;
}


function initProgressTrack() {
  progressTrackEl.innerHTML = "";
  progressCells = [];
  // Динамически устанавливаем количество колонок
  progressTrackEl.style.gridTemplateColumns = `repeat(${currentQuestions.length}, 1fr)`;
  for (let i = 0; i < currentQuestions.length; i += 1) {
    const cell = document.createElement("div");
    cell.className = "progress-cell";
    progressTrackEl.appendChild(cell);
    progressCells.push(cell);
  }
}

function paintProgressCell(isCorrect) {
  const cell = progressCells[currentRound];
  if (!cell) return;
  cell.classList.remove("progress-cell--ok", "progress-cell--bad");
  cell.classList.add(isCorrect ? "progress-cell--ok" : "progress-cell--bad");
}

function formatTime(totalSec) {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimerView() {
  if (!roundStartAt && elapsedMs === 0) {
    timerEl.textContent = "Время: 00:00";
    return;
  }
  const runningPart = Date.now() - roundStartAt;
  const elapsedSec = Math.floor((elapsedMs + runningPart) / 1000);
  timerEl.textContent = `Время: ${formatTime(elapsedSec)}`;
}

function startTimer() {
  stopTimer();
  updateTimerView();
  timerIntervalId = setInterval(updateTimerView, 1000);
}

function stopTimer() {
  if (!timerIntervalId) return;
  clearInterval(timerIntervalId);
  timerIntervalId = null;
}

function renderAnswer() {
  answerText.textContent = currentAnswer.length ? currentAnswer : "_";
}

function resetFeedback() {
  feedbackEl.textContent = "";
  feedbackEl.classList.remove("ok", "bad");
}

function handleKeyPress(key) {
  if (isLocked) return;

  // Легкий тактильный отклик на каждую клавишу ввода, кроме Enter
  // (вибрация для Enter будет в checkAnswer, чтобы избежать двойной).
  if (key !== "enter") {
    vibrate([10]);
  }

  if (key === "del") {
    currentAnswer = currentAnswer.slice(0, -1);
    renderAnswer();
    return;
  }

  if (key === "clear") {
    currentAnswer = "";
    renderAnswer();
    return;
  }

  if (key === "enter") {
    if (!currentAnswer) return;
    checkAnswer();
    return;
  }

  if (currentAnswer.length >= 3) return;
  currentAnswer += key;
  renderAnswer();
}

function checkAnswer() {
  const value = Number(currentAnswer);
  const correct = currentA * currentB;
  const isCorrect = value === correct;
  isLocked = true;
  answersLog.push({
    a: currentA,
    b: currentB,
    playerAnswer: value,
    correctAnswer: correct,
    isCorrect
  });

  if (isCorrect) {
    score += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    feedbackEl.textContent = "Верно!";
    feedbackEl.classList.add("ok");
    playTone(880, 0.07);
    vibrate([45]);
  } else {
    streak = 0;
    mistakesInCurrentGame.push({ a: currentA, b: currentB });
    feedbackEl.textContent = `Неверно. Правильно: ${correct}`;
    feedbackEl.classList.add("bad");
    playTone(240, 0.14);
    vibrate([120, 50, 120]);
  }
  paintProgressCell(isCorrect);

  setTimeout(nextQuestion, 650);
}

function nextQuestion() {
  currentRound += 1;
  if (currentRound >= currentQuestions.length) {
    finishGame();
    return;
  }

  isLocked = false;
  currentAnswer = "";
  resetFeedback();
  renderAnswer();
  setCurrentQuestion();
}

function finishGame() {
  stopTimer();
  isLocked = true;
  const runningPart = Date.now() - roundStartAt;
  const totalTimeSec = (elapsedMs + runningPart) / 1000;
  const playerName = getPlayerName();
  saveResult({
    playerName,
    totalTimeSec,
    score,
    rounds: currentQuestions.length,
    finishedAt: Date.now(),
    gameId: Date.now()       // Уникальный идентификатор игры
  });

  gameScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  resultSummary.textContent =
    `${playerName}, результат: ${score}/${currentQuestions.length}. ` +
    `Время: ${totalTimeSec.toFixed(1)} сек. ` +
    `Лучшая серия: ${bestStreak}. Ошибок: ${mistakesInCurrentGame.length}.`;
  renderAnswersLog();
}

function renderAnswersLog() {
  answersList.innerHTML = "";
  answersLog.forEach((item, index) => {
    const li = document.createElement("li");
    const status = item.isCorrect ? "Верно" : "Неверно";
    li.className = item.isCorrect ? "answer-ok" : "answer-bad";
    li.textContent =
      `${index + 1}) ${item.a} × ${item.b} = ${item.playerAnswer} ` +
      `(${status}, правильно: ${item.correctAnswer})`;
    answersList.appendChild(li);
  });
}


function getBoolSetting(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === "true";
}

function initSettingsUi() {
  // Инициализируем модальные переключатели
  if (modalSoundToggle) {
    modalSoundToggle.checked = getBoolSetting(STORAGE_KEYS.soundEnabled, true);
  }
  if (modalVibrationToggle) {
    modalVibrationToggle.checked = getBoolSetting(STORAGE_KEYS.vibrationEnabled, true);
  }
  // Старые переключатели (если остались) - игнорируем
}

function setSetting(key, value) {
  localStorage.setItem(key, String(value));
}

function isSoundEnabled() {
  return getBoolSetting(STORAGE_KEYS.soundEnabled, true);
}

function isVibrationEnabled() {
  return getBoolSetting(STORAGE_KEYS.vibrationEnabled, true);
}

function playTone(freq, durationSec) {
  if (!isSoundEnabled()) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  // Возобновляем контекст, если он приостановлен (требуется жестом пользователя)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gain.gain.value = 0.07;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + durationSec);
}

function requestFullscreenOnMobile() {
  const isMobileWidth = window.matchMedia("(max-width: 640px)").matches;
  if (!isMobileWidth) return;
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen().catch(() => {});
}

function vibrate(pattern) {
  if (!isVibrationEnabled()) return;
  if (!("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}


startBtn.addEventListener("click", startGame);
backBtn.addEventListener("click", () => {
  if (confirm("Вы уверены, что хотите выйти? Прогресс игры будет потерян.")) {
    backToMenu();
  }
});
playAgainBtn.addEventListener("click", startGame);
toMenuBtn.addEventListener("click", backToMenu);

keypad.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const key = target.dataset.key;
  if (!key) return;
  // Игнорируем ввод, если открыто модальное окно
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  handleKeyPress(key);
});

document.addEventListener("keydown", (event) => {
  if (gameScreen.classList.contains("hidden")) return;
  // Игнорируем ввод, если открыто модальное окно
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  if (isLocked) return;

  if (event.key >= "0" && event.key <= "9") {
    handleKeyPress(event.key);
    return;
  }
  if (event.key === "Backspace") {
    handleKeyPress("del");
    return;
  }
  if (event.key === "Delete") {
    handleKeyPress("clear");
    return;
  }
  if (event.key === "Enter") {
    handleKeyPress("enter");
    return;
  }
  if (event.key === "Escape") {
    backToMenu();
  }
});

// Функции для управления модальными окнами
function openSettingsModal() {
  // Синхронизируем состояние переключателей с текущими настройками
  modalSoundToggle.checked = isSoundEnabled();
  modalVibrationToggle.checked = isVibrationEnabled();
  settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  settingsModal.classList.add("hidden");
}

function saveSettings() {
  // Сохраняем настройки из модального окна
  setSetting(STORAGE_KEYS.soundEnabled, modalSoundToggle.checked);
  setSetting(STORAGE_KEYS.vibrationEnabled, modalVibrationToggle.checked);
  closeSettingsModal();
}

function openEditNameModal() {
  editNameInput.value = getPlayerName();
  editNameModal.classList.remove("hidden");
  editNameInput.focus();
  editNameInput.select();
}

function closeEditNameModal() {
  editNameModal.classList.add("hidden");
}

function saveName() {
  const newName = editNameInput.value.trim();
  if (newName === "") {
    alert("Имя не может быть пустым");
    editNameInput.focus();
    return;
  }
  setPlayerName(newName);
  updateMenuStatus();
  closeEditNameModal();
}

// Обработчики для модальных окон
settingsBtn.addEventListener("click", openSettingsModal);
closeSettingsBtn.addEventListener("click", closeSettingsModal);
saveSettingsBtn.addEventListener("click", saveSettings);

editNameBtn.addEventListener("click", openEditNameModal);
closeEditNameBtn.addEventListener("click", closeEditNameModal);
cancelEditNameBtn.addEventListener("click", closeEditNameModal);
saveNameBtn.addEventListener("click", saveName);

// Закрытие модальных окон по клику вне контента
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettingsModal();
  }
});

editNameModal.addEventListener("click", (event) => {
  if (event.target === editNameModal) {
    closeEditNameModal();
  }
});

// Обработка Enter в поле изменения имени
editNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveName();
  }
});

// Функция для проверки и отображения экрана ввода имени
function checkAndShowNameInput() {
  const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
  if (!savedName || savedName.trim() === "") {
    // Показываем экран ввода имени
    nameInputScreen.classList.remove("hidden");
    menuScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    playerNameInput.focus();
  } else {
    // Показываем главное меню
    nameInputScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    updateMenuStatus();
    renderLeaderboard();
  }
}

// Обработчик кнопки "Продолжить" на экране ввода имени
continueBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim();
  if (name === "") {
    alert("Пожалуйста, введите ваше имя");
    playerNameInput.focus();
    return;
  }
  setPlayerName(name);
  nameInputScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuStatus();
  renderLeaderboard();
});

// Обработка нажатия Enter в поле ввода
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    continueBtn.click();
  }
});

initSettingsUi();
updateTimerView();
checkAndShowNameInput();
