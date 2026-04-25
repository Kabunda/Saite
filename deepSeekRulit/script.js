import {
  FIRST_MULTIPLIERS,
  SECOND_MIN,
  SECOND_MAX,
  DEFAULT_ROUNDS,
  buildUniqueQuestionList
} from './task-generator.js';

// DOM элементы
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
const nameError = document.getElementById("nameError");

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
  leaderboard: "mt_leaderboard",
  soundEnabled: "mt_sound_enabled",
  vibrationEnabled: "mt_vibration_enabled"
};

// Игровые переменные
let currentRound = 0;
let score = 0;
let currentA = 0;
let currentB = 0;
let currentAnswer = "";
let isLocked = false;
let timerIntervalId = null;
let progressCells = [];
let streak = 0;
let bestStreak = 0;
let currentQuestions = [];
let mistakesInCurrentGame = [];
let answersLog = [];
let audioCtx = null;
let gameStartTime = 0;         // Время старта текущей игры

// ---------- Вспомогательные функции ----------
function getPlayerName() {
  const value = localStorage.getItem(STORAGE_KEYS.playerName);
  return value?.trim() || "Игрок";
}

function setPlayerName(name) {
  localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
}

function getLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setLeaderboard(items) {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(items));
}

function renderLeaderboard() {
  const items = getLeaderboard();
  if (!items.length) {
    leaderboardBody.innerHTML = `<tr><td colspan="4">Пока нет результатов.</td></tr>`;
    return;
  }
  leaderboardBody.innerHTML = items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(item.playerName)}</td>
      <td>${item.totalTimeSec.toFixed(1)} сек</td>
      <td>${item.score}/${item.rounds}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function saveResult(result) {
  const current = getLeaderboard();
  const next = [...current, result]
    .sort((a, b) => a.totalTimeSec - b.totalTimeSec || b.score - a.score)
    .slice(0, 10);
  setLeaderboard(next);
}

// ---------- Таймер (исправленный) ----------
function startTimer() {
  stopTimer();
  updateTimerDisplay();
  timerIntervalId = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function updateTimerDisplay() {
  if (!gameStartTime) {
    timerEl.textContent = "Время: 00:00";
    return;
  }
  const elapsedSec = Math.floor((Date.now() - gameStartTime) / 1000);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  timerEl.textContent = `Время: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---------- Игровая логика ----------
function initProgressTrack() {
  progressTrackEl.innerHTML = "";
  progressCells = [];
  progressTrackEl.style.gridTemplateColumns = `repeat(${currentQuestions.length}, 1fr)`;
  for (let i = 0; i < currentQuestions.length; i++) {
    const cell = document.createElement("div");
    cell.className = "progress-cell";
    if (i === currentRound) cell.classList.add("progress-cell--current");
    progressTrackEl.appendChild(cell);
    progressCells.push(cell);
  }
}

function updateProgressCurrentHighlight() {
  progressCells.forEach((cell, idx) => {
    cell.classList.remove("progress-cell--current");
    if (idx === currentRound) cell.classList.add("progress-cell--current");
  });
}

function paintProgressCell(isCorrect) {
  const cell = progressCells[currentRound];
  if (!cell) return;
  cell.classList.add(isCorrect ? "progress-cell--ok" : "progress-cell--bad");
}

function setCurrentQuestion() {
  const q = currentQuestions[currentRound];
  currentA = q.a;
  currentB = q.b;
  questionText.textContent = `${currentA} × ${currentB} = ?`;
  updateProgressCurrentHighlight();
}

function renderAnswer() {
  answerText.textContent = currentAnswer.length ? currentAnswer : "_";
}

function resetFeedback() {
  feedbackEl.textContent = "";
  feedbackEl.classList.remove("ok", "bad");
}

function playTone(freq, durationSec) {
  if (!isSoundEnabled()) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gain.gain.value = 0.15;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  // Плавное затухание
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationSec);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + durationSec);
}

function vibrate(pattern) {
  if (!isVibrationEnabled()) return;
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function checkAnswer() {
  const value = Number(currentAnswer);
  const correct = currentA * currentB;
  const isCorrect = value === correct;
  isLocked = true;
  answersLog.push({
    a: currentA, b: currentB, playerAnswer: value,
    correctAnswer: correct, isCorrect
  });

  if (isCorrect) {
    score++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    feedbackEl.textContent = "✓ Верно!";
    feedbackEl.classList.add("ok");
    playTone(880, 0.2);
    vibrate([30]);
  } else {
    streak = 0;
    mistakesInCurrentGame.push({ a: currentA, b: currentB });
    feedbackEl.textContent = `✗ Неверно. Правильно: ${correct}`;
    feedbackEl.classList.add("bad");
    playTone(240, 0.3);
    vibrate([100, 50, 100]);
  }
  paintProgressCell(isCorrect);

  setTimeout(() => nextQuestion(), 650);
}

function nextQuestion() {
  currentRound++;
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
  const totalTimeSec = (Date.now() - gameStartTime) / 1000;
  const playerName = getPlayerName();
  saveResult({
    playerName, totalTimeSec, score,
    rounds: currentQuestions.length,
    finishedAt: Date.now()
  });

  gameScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  resultSummary.innerHTML = `${playerName}, результат: ${score}/${currentQuestions.length}. ` +
    `Время: ${totalTimeSec.toFixed(1)} сек. Лучшая серия: ${bestStreak}. Ошибок: ${mistakesInCurrentGame.length}.`;
  
  answersList.innerHTML = answersLog.map((item, idx) => {
    const status = item.isCorrect ? "Верно" : "Неверно";
    return `<li class="${item.isCorrect ? 'answer-ok' : 'answer-bad'}">
      ${idx+1}) ${item.a} × ${item.b} = ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
    </li>`;
  }).join('');
}

function startGame() {
  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentQuestions = buildUniqueQuestionList(20);
  currentRound = 0;
  score = 0;
  currentAnswer = "";
  isLocked = false;
  streak = 0;
  bestStreak = 0;
  mistakesInCurrentGame = [];
  answersLog = [];
  gameStartTime = Date.now();   // ✅ старт времени
  
  initProgressTrack();
  resetFeedback();
  renderAnswer();
  setCurrentQuestion();
  startTimer();
  requestFullscreenOnMobile();
}

function backToMenu() {
  if (gameScreen && !gameScreen.classList.contains("hidden")) {
    if (!confirm("Вы уверены, что хотите выйти? Прогресс будет потерян.")) return;
  }
  stopTimer();
  gameStartTime = 0;
  isLocked = true;
  gameScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuStatus();
  renderLeaderboard();
}

// ---------- Настройки ----------
function getBoolSetting(key, defaultValue) {
  const raw = localStorage.getItem(key);
  return raw === null ? defaultValue : raw === "true";
}
function setSetting(key, value) { localStorage.setItem(key, String(value)); }
function isSoundEnabled() { return getBoolSetting(STORAGE_KEYS.soundEnabled, true); }
function isVibrationEnabled() { return getBoolSetting(STORAGE_KEYS.vibrationEnabled, true); }

function initSettingsUi() {
  modalSoundToggle.checked = isSoundEnabled();
  modalVibrationToggle.checked = isVibrationEnabled();
}
function openSettingsModal() {
  modalSoundToggle.checked = isSoundEnabled();
  modalVibrationToggle.checked = isVibrationEnabled();
  settingsModal.classList.remove("hidden");
}
function closeSettingsModal() { settingsModal.classList.add("hidden"); }
function saveSettings() {
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
function closeEditNameModal() { editNameModal.classList.add("hidden"); }
function saveName() {
  const newName = editNameInput.value.trim();
  if (!newName) {
    alert("Имя не может быть пустым");
    editNameInput.focus();
    return;
  }
  setPlayerName(newName);
  updateMenuStatus();
  closeEditNameModal();
}

function updateMenuStatus() {
  currentPlayerName.textContent = getPlayerName();
}

function checkAndShowNameInput() {
  const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
  if (!savedName?.trim()) {
    nameInputScreen.classList.remove("hidden");
    menuScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");   // ✅ явно скрываем игровой экран
    resultScreen.classList.add("hidden");
    playerNameInput.focus();
  } else {
    nameInputScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    gameScreen.classList.add("hidden");   // ✅ игровой экран скрыт
    resultScreen.classList.add("hidden");
    updateMenuStatus();
    renderLeaderboard();
  }
}

// Обработчики ввода имени (без alert)
continueBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    nameError.classList.remove("hidden");
    playerNameInput.focus();
    return;
  }
  nameError.classList.add("hidden");
  setPlayerName(name);
  nameInputScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuStatus();
  renderLeaderboard();
});
playerNameInput.addEventListener("input", () => nameError.classList.add("hidden"));
playerNameInput.addEventListener("keydown", (e) => e.key === "Enter" && continueBtn.click());

// События
startBtn.addEventListener("click", startGame);
backBtn.addEventListener("click", backToMenu);
playAgainBtn.addEventListener("click", startGame);
toMenuBtn.addEventListener("click", backToMenu);

keypad.addEventListener("click", (e) => {
  const key = e.target?.dataset?.key;
  if (!key) return;
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  handleKeyPress(key);
});

function handleKeyPress(key) {
  if (isLocked) return;
  if (key !== "enter") vibrate([10]);

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
  if (/^\d$/.test(key)) {
    currentAnswer += key;
    renderAnswer();
  }
}

document.addEventListener("keydown", (e) => {
  if (gameScreen.classList.contains("hidden")) return;
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  if (isLocked) return;
  if (e.key >= "0" && e.key <= "9") handleKeyPress(e.key);
  else if (e.key === "Backspace") handleKeyPress("del");
  else if (e.key === "Delete") handleKeyPress("clear");
  else if (e.key === "Enter") handleKeyPress("enter");
  else if (e.key === "Escape") backToMenu();
});

settingsBtn.addEventListener("click", openSettingsModal);
closeSettingsBtn.addEventListener("click", closeSettingsModal);
saveSettingsBtn.addEventListener("click", saveSettings);
editNameBtn.addEventListener("click", openEditNameModal);
closeEditNameBtn.addEventListener("click", closeEditNameModal);
cancelEditNameBtn.addEventListener("click", closeEditNameModal);
saveNameBtn.addEventListener("click", saveName);
editNameInput.addEventListener("keydown", (e) => e.key === "Enter" && saveName());

[settingsModal, editNameModal].forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
});

function requestFullscreenOnMobile() {
  if (window.matchMedia("(max-width: 640px)").matches && document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

initSettingsUi();
checkAndShowNameInput();