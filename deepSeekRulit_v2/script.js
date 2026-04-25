import {
  FIRST_MULTIPLIERS,
  SECOND_MIN,
  SECOND_MAX,
  buildUniqueQuestionList
} from './task-generator.js';

// DOM elements
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
const timeScale = document.getElementById("timeScale");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const themeToggle = document.getElementById("themeToggle");

const STORAGE_KEYS = {
  playerName: "mt_player_name",
  leaderboard: "mt_leaderboard",
  soundEnabled: "mt_sound_enabled",
  vibrationEnabled: "mt_vibration_enabled",
  selectedRounds: "mt_selected_rounds",
  theme: "mt_theme"
};

// State
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
let gameStartTime = 0;
let selectedRounds = parseInt(localStorage.getItem(STORAGE_KEYS.selectedRounds) || "20", 10);

// ----- Utilities -----
function getPlayerName() {
  const value = localStorage.getItem(STORAGE_KEYS.playerName);
  return value?.trim() || "Игрок";
}
function setPlayerName(name) {
  localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
}
function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) || "[]");
  } catch { return []; }
}
function setLeaderboard(items) {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(items));
}
function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
function getBoolSetting(key, def) {
  const v = localStorage.getItem(key);
  return v === null ? def : v === "true";
}
function setSetting(key, value) { localStorage.setItem(key, String(value)); }

// ----- Theme -----
function applyTheme() {
  const dark = getBoolSetting(STORAGE_KEYS.theme, false);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  if (themeToggle) themeToggle.checked = dark;
}
applyTheme();
themeToggle?.addEventListener("change", () => {
  setSetting(STORAGE_KEYS.theme, themeToggle.checked);
  applyTheme();
});

// ----- Leaderboard rendering -----
function renderLeaderboard() {
  const items = getLeaderboard();
  if (!items.length) {
    leaderboardBody.innerHTML = `<tr><td colspan="5">Пока нет результатов.</td></tr>`;
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  leaderboardBody.innerHTML = items.slice(0, 10).map((item, idx) => `
    <tr>
      <td>${idx < 3 ? medals[idx] : idx + 1}</td>
      <td title="${escapeHtml(item.playerName)}">${escapeHtml(item.playerName.substring(0, 12))}${item.playerName.length > 12 ? '…' : ''}</td>
      <td>${item.totalTimeSec.toFixed(1)} сек</td>
      <td>${item.score}/${item.rounds}</td>
      <td>${item.bestStreak ?? '—'}</td>
    </tr>
  `).join('');
}

// ----- Timer -----
function startTimer() {
  stopTimer();
  updateTimerDisplay();
  timerIntervalId = setInterval(updateTimerDisplay, 1000);
}
function stopTimer() {
  if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
}
function updateTimerDisplay() {
  if (!gameStartTime) { timerEl.textContent = "Время: 00:00"; return; }
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  timerEl.textContent = `Время: ${m}:${s}`;
}

// ----- Progress track -----
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
  progressTrackEl.setAttribute("aria-valuemax", currentQuestions.length);
  progressTrackEl.setAttribute("aria-valuenow", 0);
}
function updateProgressCurrentHighlight() {
  progressCells.forEach((cell, idx) => {
    cell.classList.remove("progress-cell--current");
    if (idx === currentRound) cell.classList.add("progress-cell--current");
  });
  progressTrackEl?.setAttribute("aria-valuenow", currentRound);
}
function paintProgressCell(isCorrect) {
  const cell = progressCells[currentRound];
  if (!cell) return;
  cell.classList.add(isCorrect ? "progress-cell--ok" : "progress-cell--bad");
  if (!isCorrect) cell.classList.add("shake");
}

// ----- Audio & vibration -----
function playTone(freq, duration) {
  if (!getBoolSetting(STORAGE_KEYS.soundEnabled, true)) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
function playClickSound() {
  if (!getBoolSetting(STORAGE_KEYS.soundEnabled, true)) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}
function vibrate(pattern) {
  if (getBoolSetting(STORAGE_KEYS.vibrationEnabled, true) && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// ----- Game logic -----
function setCurrentQuestion() {
  const q = currentQuestions[currentRound];
  currentA = q.a;
  currentB = q.b;
  questionText.textContent = `${currentA} × ${currentB} = ?`;
  questionText.classList.remove("fade-in");
  void questionText.offsetWidth; // trigger reflow
  questionText.classList.add("fade-in");
  updateProgressCurrentHighlight();
}
function renderAnswer() {
  answerText.textContent = currentAnswer.length ? currentAnswer : "_";
  if (currentAnswer.length) {
    answerText.classList.add("pop");
    setTimeout(() => answerText.classList.remove("pop"), 100);
  }
}
function resetFeedback() {
  feedbackEl.textContent = "";
  feedbackEl.classList.remove("ok", "bad");
}

function checkAnswer() {
  const value = Number(currentAnswer);
  const correct = currentA * currentB;
  const isCorrect = value === correct;
  isLocked = true;
  answersLog.push({ a: currentA, b: currentB, playerAnswer: value, correctAnswer: correct, isCorrect });
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
    document.querySelector(".game-area")?.classList.add("shake-area");
    setTimeout(() => document.querySelector(".game-area")?.classList.remove("shake-area"), 400);
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
    bestStreak,
    finishedAt: Date.now()
  });
  gameScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  const streakHtml = bestStreak > 0 ? ` 🔥 Серия: ${bestStreak}` : '';
  resultSummary.innerHTML = `${playerName}, результат: ${score}/${currentQuestions.length}. ` +
    `Время: ${totalTimeSec.toFixed(1)} сек.${streakHtml} Ошибок: ${mistakesInCurrentGame.length}.`;

  // Time scale
  const personalBest = getLeaderboard().find(e => e.playerName === playerName)?.totalTimeSec;
  if (personalBest && personalBest > 0) {
    timeScale.classList.remove("hidden");
    const pct = Math.min(100, (personalBest / totalTimeSec) * 100);
    timeScale.querySelector(".time-scale-fill").style.width = `${pct}%`;
    timeScale.querySelector(".time-scale-text").textContent = `Ваш лучший: ${personalBest.toFixed(1)} сек`;
  } else {
    timeScale.classList.add("hidden");
  }

  answersList.innerHTML = answersLog.map((item, idx) => {
    const status = item.isCorrect ? "Верно" : "Неверно";
    return `<li class="${item.isCorrect ? 'answer-ok' : 'answer-bad'}">
      ${idx+1}) ${item.a} × ${item.b} = ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
    </li>`;
  }).join('');
}

function saveResult(result) {
  const current = getLeaderboard();
  const next = [...current, result]
    .sort((a, b) => a.totalTimeSec - b.totalTimeSec || b.score - a.score)
    .slice(0, 10);
  setLeaderboard(next);
}

function startGame() {
  menuScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentQuestions = buildUniqueQuestionList(selectedRounds);
  currentRound = 0;
  score = 0;
  currentAnswer = "";
  isLocked = false;
  streak = 0;
  bestStreak = 0;
  mistakesInCurrentGame = [];
  answersLog = [];
  gameStartTime = Date.now();

  initProgressTrack();
  resetFeedback();
  renderAnswer();
  setCurrentQuestion();
  startTimer();
  requestFullscreenOnMobile();
}

function backToMenu() {
  if (!gameScreen.classList.contains("hidden")) {
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

// ----- Settings modals -----
function openSettingsModal() {
  modalSoundToggle.checked = getBoolSetting(STORAGE_KEYS.soundEnabled, true);
  modalVibrationToggle.checked = getBoolSetting(STORAGE_KEYS.vibrationEnabled, true);
  settingsModal.classList.remove("hidden");
  modalSoundToggle.focus();
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
  showToast("Имя обновлено ✅");
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function updateMenuStatus() {
  currentPlayerName.textContent = getPlayerName();
  document.getElementById("roundsSubtitle").textContent = `${selectedRounds} вопросов: 5, 8, 11, 17, 35 × 2..20`;
}

// ----- Rounds selector -----
document.querySelectorAll(".rounds-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedRounds = parseInt(btn.dataset.rounds, 10);
    localStorage.setItem(STORAGE_KEYS.selectedRounds, selectedRounds);
    document.querySelectorAll(".rounds-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    updateMenuStatus();
  });
});
// Set initial active
document.querySelector(`.rounds-btn[data-rounds="${selectedRounds}"]`)?.classList.add("active");
updateMenuStatus();

// ----- Name input screen -----
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
playerNameInput.addEventListener("keydown", e => e.key === "Enter" && continueBtn.click());

// ----- Game controls -----
startBtn.addEventListener("click", startGame);
backBtn.addEventListener("click", backToMenu);
playAgainBtn.addEventListener("click", startGame);
toMenuBtn.addEventListener("click", backToMenu);

// Keypad handler
keypad.addEventListener("click", (e) => {
  const key = e.target?.dataset?.key;
  if (!key) return;
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  handleKeyPress(key);
});

function handleKeyPress(key) {
  if (isLocked) return;
  if (key !== "enter") {
    playClickSound();
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
  if (/^\d$/.test(key)) {
    currentAnswer += key;
    renderAnswer();
  }
}

// Keyboard support
document.addEventListener("keydown", (e) => {
  if (gameScreen.classList.contains("hidden")) return;
  if (!settingsModal.classList.contains("hidden") || !editNameModal.classList.contains("hidden")) return;
  if (isLocked) return;
  const key = e.key;
  if (key >= "0" && key <= "9") handleKeyPress(key);
  else if (key === "Backspace") { e.preventDefault(); handleKeyPress("del"); }
  else if (key === "Delete") { e.preventDefault(); handleKeyPress("clear"); }
  else if (key === "Enter") handleKeyPress("enter");
  else if (key === "Escape") backToMenu();
});

// Modals
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
  // Focus trapping basic: close on Escape
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.classList.add("hidden");
  });
});

// When opening modals, focus first input
settingsModal.addEventListener("transitionend", () => {
  if (!settingsModal.classList.contains("hidden")) modalSoundToggle?.focus();
});
editNameModal.addEventListener("transitionend", () => {
  if (!editNameModal.classList.contains("hidden")) editNameInput?.focus();
});

// Fullscreen
fullscreenBtn?.addEventListener("click", () => {
  if (document.fullscreenEnabled) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }
});
function requestFullscreenOnMobile() {
  if (window.matchMedia("(max-width: 640px)").matches && document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// Initial
checkAndShowNameInput();
function checkAndShowNameInput() {
  const saved = localStorage.getItem(STORAGE_KEYS.playerName);
  if (!saved?.trim()) {
    nameInputScreen.classList.remove("hidden");
    menuScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    playerNameInput.focus();
  } else {
    nameInputScreen.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    updateMenuStatus();
    renderLeaderboard();
  }
}