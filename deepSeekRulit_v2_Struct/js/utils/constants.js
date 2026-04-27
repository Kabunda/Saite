// Общие константы приложения

// Настройки игры
export const DEFAULT_ROUNDS = 20;
export const MIN_ROUNDS = 5;
export const MAX_ROUNDS = 50;

// Множители для генерации вопросов
export const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
export const SECOND_MIN = 2;
export const SECOND_MAX = 20;

// Ключи LocalStorage
export const LS_KEYS = {
    PLAYER_NAME: 'mt_playerName',
    SELECTED_ROUNDS: 'mt_selectedRounds',
    SOUND_ENABLED: 'mt_sound_enabled',
    VIBRATION_ENABLED: 'mt_vibration_enabled',
    THEME_DARK: 'mt_theme_dark',
    OFFLINE_RESULTS: 'mt_offline_results'
};

// Идентификаторы экранов
export const SCREEN_IDS = {
    NAME_INPUT: 'nameInputScreen',
    MENU: 'menuScreen',
    GAME: 'gameScreen',
    RESULT: 'resultScreen'
};

// Идентификаторы модальных окон
export const MODAL_IDS = {
    SETTINGS: 'settingsModal',
    EDIT_NAME: 'editNameModal'
};

// Настройки звука
export const SOUND_FREQUENCIES = {
    CORRECT: 880,   // Ля 5 октавы
    INCORRECT: 220, // Ля 3 октавы
    CLICK: 440      // Ля 4 октавы
};

// Паттерны вибрации (в миллисекундах)
export const VIBRATION_PATTERNS = {
    CORRECT: [100, 50, 100],
    INCORRECT: [200, 100, 200],
    CLICK: [50]
};

// Цвета для прогресс-бара
export const PROGRESS_COLORS = {
    CORRECT: '#4caf50',
    INCORRECT: '#f44336',
    CURRENT: '#2196f3',
    NEUTRAL: '#e0e0e0'
};

// Время анимаций (мс)
export const ANIMATION_DURATIONS = {
    FEEDBACK: 800,
    PROGRESS_CELL: 300,
    SCREEN_TRANSITION: 300,
    TOAST: 3000
};

// Штрафное время за ошибку (секунды)
export const PENALTY_PER_MISTAKE = 5;

// Ограничения
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_LEADERBOARD_ENTRIES = 10;

// Firebase конфигурация (заполняется в storage.js)
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQ1Wzpw-cDOG8okWEbDez2AMLNTzk89q8",
    authDomain: "testds-b169f.firebaseapp.com",
    databaseURL: "https://testds-b169f-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "testds-b169f",
    storageBucket: "testds-b169f.firebasestorage.app",
    messagingSenderId: "726631928847",
    appId: "1:726631928847:web:d4e5eb7af866398796ff7a"
};

// Сообщения об ошибках
export const ERROR_MESSAGES = {
    NAME_REQUIRED: "Имя не может быть пустым",
    NAME_TOO_LONG: `Имя не должно превышать ${MAX_PLAYER_NAME_LENGTH} символов`,
    FIREBASE_UNAVAILABLE: "Не удалось подключиться к серверу. Результаты будут сохранены локально.",
    OFFLINE_MODE: "Работаем в офлайн-режиме. Результаты будут синхронизированы при восстановлении соединения."
};

// Тексты интерфейса
export const UI_TEXTS = {
    START_GAME: "Начать игру",
    CONTINUE: "Продолжить",
    BACK_TO_MENU: "В главное меню",
    PLAY_AGAIN: "Играть снова",
    SAVE: "Сохранить",
    CANCEL: "Отмена",
    SETTINGS: "Настройки",
    LEADERBOARD: "Топ игроков",
    TIME: "Время",
    SCORE: "Очки",
    STREAK: "Серия",
    BEST_STREAK: "Лучшая серия"
};