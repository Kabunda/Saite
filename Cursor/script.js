const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const connectBtn = document.getElementById("connectBtn");
const renameBtn = document.getElementById("renameBtn");
const networkBtn = document.getElementById("networkBtn");
const backBtn = document.getElementById("backBtn");
const pauseBtn = document.getElementById("pauseBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const toMenuBtn = document.getElementById("toMenuBtn");
const soundToggle = document.getElementById("soundToggle");
const vibrationToggle = document.getElementById("vibrationToggle");

const playerInfo = document.getElementById("playerInfo");
const connectStatus = document.getElementById("connectStatus");
const networkStatus = document.getElementById("networkStatus");
const leaderboardBody = document.getElementById("leaderboardBody");

const progressTrackEl = document.getElementById("progressTrack");
const timerEl = document.getElementById("timer");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const feedbackEl = document.getElementById("feedback");
const keypad = document.getElementById("keypad");
const streakEl = document.getElementById("streak");
const resultSummary = document.getElementById("resultSummary");
const answersList = document.getElementById("answersList");

const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
const SECOND_MIN = 2;
const SECOND_MAX = 20;
const ROUNDS = 5;

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
let isPaused = false;
let currentQuestions = [];
let mistakesInCurrentGame = [];
let answersLog = [];
let audioCtx = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPlayerName() {
  const value = localStorage.getItem(STORAGE_KEYS.playerName);
  return value && value.trim() ? value : "Игрок";
}

function setPlayerName(name) {
  localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
}

function isConnected() {
  return localStorage.getItem(STORAGE_KEYS.connected) === "true";
}

function setConnected(flag) {
  localStorage.setItem(STORAGE_KEYS.connected, String(flag));
}

function isNetworkMode() {
  return localStorage.getItem(STORAGE_KEYS.networkMode) === "true";
}

function setNetworkMode(flag) {
  localStorage.setItem(STORAGE_KEYS.networkMode, String(flag));
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
  playerInfo.textContent = `Игрок: ${getPlayerName()}`;
  connectStatus.textContent = isConnected()
    ? "Подключение: активно"
    : "Подключение: отключено";
  networkStatus.textContent = isNetworkMode()
    ? "Сетевой режим: включен"
    : "Сетевой режим: выключен";
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

  currentQuestions = buildQuestionList();
  currentRound = 0;
  score = 0;
  currentAnswer = "";
  elapsedMs = 0;
  roundStartAt = Date.now();
  isLocked = false;
  isPaused = false;
  streak = 0;
  bestStreak = 0;
  mistakesInCurrentGame = [];
  answersLog = [];
  initProgressTrack();
  applyPauseState();

  resetFeedback();
  updateHeaderMeta();
  renderAnswer();
  setCurrentQuestion();
  startTimer();
  requestFullscreenOnMobile();
}

function backToMenu() {
  stopTimer();
  isLocked = true;
  isPaused = false;
  gameScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
  updateMenuStatus();
  renderLeaderboard();
}

function buildQuestionList() {
  const list = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    list.push({
      a: FIRST_MULTIPLIERS[randomInt(0, FIRST_MULTIPLIERS.length - 1)],
      b: randomInt(SECOND_MIN, SECOND_MAX)
    });
  }
  return list;
}

function setCurrentQuestion() {
  const question = currentQuestions[currentRound];
  currentA = question.a;
  currentB = question.b;
  questionText.textContent = `${currentA} × ${currentB} = ?`;
}

function updateHeaderMeta() {
  streakEl.textContent = `Серия: ${streak}`;
}

function initProgressTrack() {
  progressTrackEl.innerHTML = "";
  progressCells = [];
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
  const runningPart = isPaused ? 0 : Date.now() - roundStartAt;
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
  if (isLocked || isPaused) return;

  // Легкий тактильный отклик на каждую клавишу ввода.
  vibrate([10]);

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
  updateHeaderMeta();

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
  updateHeaderMeta();
  renderAnswer();
  setCurrentQuestion();
}

function finishGame() {
  stopTimer();
  isLocked = true;
  const runningPart = isPaused ? 0 : Date.now() - roundStartAt;
  const totalTimeSec = (elapsedMs + runningPart) / 1000;
  const playerName = getPlayerName();
  saveResult({
    playerName,
    totalTimeSec,
    score,
    rounds: currentQuestions.length,
    finishedAt: Date.now()
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

function applyPauseState() {
  pauseBtn.textContent = isPaused ? "Продолжить" : "Пауза";
  keypad.classList.toggle("paused", isPaused);
}

function togglePause() {
  if (gameScreen.classList.contains("hidden") || isLocked) return;
  if (isPaused) {
    roundStartAt = Date.now();
    isPaused = false;
  } else {
    elapsedMs += Date.now() - roundStartAt;
    isPaused = true;
  }
  applyPauseState();
  updateTimerView();
}

function getBoolSetting(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === "true";
}

function initSettingsUi() {
  soundToggle.checked = getBoolSetting(STORAGE_KEYS.soundEnabled, true);
  vibrationToggle.checked = getBoolSetting(STORAGE_KEYS.vibrationEnabled, true);
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

connectBtn.addEventListener("click", () => {
  const newState = !isConnected();
  setConnected(newState);
  updateMenuStatus();
});

networkBtn.addEventListener("click", () => {
  if (!isConnected()) {
    alert("Сначала нажмите «Подключить».");
    return;
  }
  setNetworkMode(!isNetworkMode());
  updateMenuStatus();
});

renameBtn.addEventListener("click", () => {
  const current = getPlayerName();
  const entered = prompt("Введите новое имя игрока:", current);
  if (entered === null) return;
  const trimmed = entered.trim();
  if (!trimmed) {
    alert("Имя не может быть пустым.");
    return;
  }
  setPlayerName(trimmed);
  updateMenuStatus();
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
backBtn.addEventListener("click", backToMenu);
playAgainBtn.addEventListener("click", startGame);
toMenuBtn.addEventListener("click", backToMenu);
soundToggle.addEventListener("change", () => {
  setSetting(STORAGE_KEYS.soundEnabled, soundToggle.checked);
});
vibrationToggle.addEventListener("change", () => {
  setSetting(STORAGE_KEYS.vibrationEnabled, vibrationToggle.checked);
});

keypad.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const key = target.dataset.key;
  if (!key) return;
  handleKeyPress(key);
});

document.addEventListener("keydown", (event) => {
  if (gameScreen.classList.contains("hidden")) return;
  if (event.key.toLowerCase() === "p") {
    togglePause();
    return;
  }
  if (isLocked || isPaused) return;

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

if (!localStorage.getItem(STORAGE_KEYS.playerName)) {
  setPlayerName("Игрок");
}
initSettingsUi();
updateTimerView();
updateMenuStatus();
renderLeaderboard();
