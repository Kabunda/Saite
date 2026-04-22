// Константы игры
export const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
export const SECOND_MIN = 2;
export const SECOND_MAX = 20;
export const ROUNDS = 5;

// Ключи для localStorage
export const STORAGE_KEYS = {
  playerName: "mt_player_name",
  connected: "mt_connected",
  networkMode: "mt_network_mode",
  leaderboard: "mt_leaderboard",
  soundEnabled: "mt_sound_enabled",
  vibrationEnabled: "mt_vibration_enabled"
};

// Настройки звука
export const SOUND_SETTINGS = {
  correct: { freq: 880, duration: 0.07 },
  incorrect: { freq: 240, duration: 0.14 }
};

// Настройки вибрации
export const VIBRATION_PATTERNS = {
  keyPress: [10],
  correct: [45],
  incorrect: [120, 50, 120]
};

// Временные задержки
export const DELAYS = {
  feedback: 650, // мс перед переходом к следующему вопросу
  animation: 300 // мс для анимаций
};

// Классы CSS
export const CSS_CLASSES = {
  hidden: "hidden",
  ok: "ok",
  bad: "bad",
  paused: "paused",
  progressOk: "progress-cell--ok",
  progressBad: "progress-cell--bad",
  answerOk: "answer-ok",
  answerBad: "answer-bad"
};

// ID элементов DOM
export const DOM_IDS = {
  menuScreen: "menuScreen",
  gameScreen: "gameScreen",
  resultScreen: "resultScreen",
  startBtn: "startBtn",
  connectBtn: "connectBtn",
  renameBtn: "renameBtn",
  networkBtn: "networkBtn",
  backBtn: "backBtn",
  pauseBtn: "pauseBtn",
  playAgainBtn: "playAgainBtn",
  toMenuBtn: "toMenuBtn",
  soundToggle: "soundToggle",
  vibrationToggle: "vibrationToggle",
  playerInfo: "playerInfo",
  connectStatus: "connectStatus",
  networkStatus: "networkStatus",
  leaderboardBody: "leaderboardBody",
  progressTrack: "progressTrack",
  timer: "timer",
  questionText: "questionText",
  answerText: "answerText",
  feedback: "feedback",
  keypad: "keypad",
  streak: "streak",
  resultSummary: "resultSummary",
  answersList: "answersList"
};