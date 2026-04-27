// Единый интерфейс для работы с данными (Firebase + LocalStorage)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, query, orderByChild, limitToFirst, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { LS_KEYS, FIREBASE_CONFIG, ERROR_MESSAGES } from '../utils/constants.js';

// ================== НАСТРОЙКА FIREBASE ==================
let db = null;
let useFirebase = false;
let isOnline = navigator.onLine;

// Отслеживаем состояние сети
window.addEventListener('online', () => {
    isOnline = true;
    console.log('Storage: соединение восстановлено');
    syncOfflineResults();
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('Storage: потеряно соединение, переходим в офлайн-режим');
});

try {
    if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(FIREBASE_CONFIG);
        db = getDatabase(app);
        useFirebase = true;
        console.log("Storage: Firebase инициализирован.");
    } else {
        console.warn("Storage: Firebase не настроен.");
    }
} catch (error) {
    console.error("Storage: ошибка инициализации Firebase:", error);
}

// ================== ОСНОВНОЙ ИНТЕРФЕЙС ==================

/**
 * Сохраняет результат игры
 * @param {Object} result - результат игры
 * @param {string} result.playerName - имя игрока
 * @param {number} result.score - количество правильных ответов
 * @param {number} result.rounds - общее количество вопросов
 * @param {number} result.totalTimeSec - общее время в секундах
 * @param {number} result.totalTimeWithPenalty - время с штрафами
 * @param {number} result.bestStreak - лучшая серия
 * @returns {Promise<boolean>} успешность сохранения
 */
export async function saveResult(result) {
    const resultWithTimestamp = {
        ...result,
        timestamp: Date.now(),
        finishedAt: Date.now()
    };

    // Пытаемся сохранить в Firebase, если доступен
    if (useFirebase && db && isOnline) {
        try {
            const resultsRef = ref(db, 'results');
            await push(resultsRef, resultWithTimestamp);
            console.log("Storage: результат сохранён в Firebase.");
            return true;
        } catch (error) {
            console.error("Storage: ошибка сохранения в Firebase:", error);
            // Продолжаем с локальным сохранением
        }
    }

    // Сохраняем локально
    return saveResultOffline(resultWithTimestamp);
}

/**
 * Сохраняет результат в локальное хранилище
 * @param {Object} result 
 * @returns {boolean}
 */
function saveResultOffline(result) {
    try {
        const offlineResults = getOfflineResults();
        offlineResults.push(result);
        localStorage.setItem(LS_KEYS.OFFLINE_RESULTS, JSON.stringify(offlineResults));
        console.log("Storage: результат сохранён локально.");
        return true;
    } catch (error) {
        console.error("Storage: ошибка локального сохранения:", error);
        return false;
    }
}

/**
 * Получает таблицу лидеров
 * @param {number} limit - максимальное количество записей
 * @returns {Promise<Array|null>} массив результатов или null при ошибке
 */
export async function getLeaderboard(limit = 10) {
    // Если Firebase недоступен, возвращаем null
    if (!useFirebase || !db) {
        console.warn("Storage: Firebase недоступен, таблица лидеров не загружена");
        return null;
    }

    try {
        const resultsRef = ref(db, 'results');
        const topQuery = query(resultsRef, orderByChild('totalTimeSec'), limitToFirst(limit * 2)); // Берем больше для фильтрации
        const snapshot = await get(topQuery);

        const leaderboard = [];
        snapshot.forEach(child => {
            const data = child.val();
            leaderboard.push({
                playerName: data.playerName || "Игрок",
                totalTimeSec: data.totalTimeSec || 0,
                score: data.score || 0,
                rounds: data.rounds || 0,
                bestStreak: data.bestStreak || 0,
                finishedAt: data.finishedAt || data.timestamp || 0
            });
        });

        // Сортировка по штрафному времени: реальное время + 5 секунд за каждую ошибку
        leaderboard.sort((a, b) => {
            const penaltyA = a.totalTimeSec + (a.rounds - a.score) * 5;
            const penaltyB = b.totalTimeSec + (b.rounds - b.score) * 5;
            return penaltyA - penaltyB || b.score - a.score;
        });

        return leaderboard.slice(0, limit);
    } catch (error) {
        console.error("Storage: ошибка загрузки таблицы лидеров:", error);
        return null;
    }
}

/**
 * Синхронизирует офлайн-результаты с Firebase
 * @returns {Promise<number>} количество синхронизированных результатов
 */
export async function syncOfflineResults() {
    if (!useFirebase || !db || !isOnline) {
        return 0;
    }

    const offlineResults = getOfflineResults();
    if (offlineResults.length === 0) {
        return 0;
    }

    console.log(`Storage: синхронизация ${offlineResults.length} офлайн-результатов...`);

    let syncedCount = 0;
    const failedResults = [];

    for (const result of offlineResults) {
        try {
            const resultsRef = ref(db, 'results');
            await push(resultsRef, result);
            syncedCount++;
        } catch (error) {
            console.error("Storage: ошибка синхронизации результата:", error);
            failedResults.push(result);
        }
    }

    // Сохраняем неудачные результаты обратно
    localStorage.setItem(LS_KEYS.OFFLINE_RESULTS, JSON.stringify(failedResults));

    console.log(`Storage: синхронизировано ${syncedCount} результатов`);
    return syncedCount;
}

/**
 * Получает офлайн-результаты из LocalStorage
 * @returns {Array}
 */
export function getOfflineResults() {
    try {
        const raw = localStorage.getItem(LS_KEYS.OFFLINE_RESULTS);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error("Storage: ошибка чтения офлайн-результатов:", error);
        return [];
    }
}

/**
 * Очищает офлайн-результаты
 */
export function clearOfflineResults() {
    localStorage.removeItem(LS_KEYS.OFFLINE_RESULTS);
}

// ================== НАСТРОЙКИ ИГРОКА ==================

/**
 * Получает имя игрока
 * @returns {Promise<string>}
 */
export async function getPlayerName() {
    return localStorage.getItem(LS_KEYS.PLAYER_NAME) || "Игрок";
}

/**
 * Устанавливает имя игрока
 * @param {string} name 
 * @returns {Promise<void>}
 */
export async function setPlayerName(name) {
    localStorage.setItem(LS_KEYS.PLAYER_NAME, name);
}

/**
 * Получает выбранное количество вопросов
 * @returns {Promise<number>}
 */
export async function getSelectedRounds() {
    return parseInt(localStorage.getItem(LS_KEYS.SELECTED_ROUNDS), 10) || 20;
}

/**
 * Устанавливает количество вопросов
 * @param {number} rounds 
 * @returns {Promise<void>}
 */
export async function setSelectedRounds(rounds) {
    localStorage.setItem(LS_KEYS.SELECTED_ROUNDS, String(rounds));
}

// ================== НАСТРОЙКИ ПРИЛОЖЕНИЯ ==================

/**
 * Получает значение настройки
 * @param {string} key - ключ настройки
 * @param {any} defaultValue - значение по умолчанию
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue) {
    const mapping = {
        'sound': LS_KEYS.SOUND_ENABLED,
        'vibration': LS_KEYS.VIBRATION_ENABLED,
        'theme': LS_KEYS.THEME_DARK
    };

    const lsKey = mapping[key];
    if (!lsKey) return defaultValue;

    try {
        const raw = localStorage.getItem(lsKey);
        return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch (error) {
        console.error(`Storage: ошибка чтения настройки "${key}":`, error);
        return defaultValue;
    }
}

/**
 * Устанавливает значение настройки
 * @param {string} key - ключ настройки
 * @param {any} value - значение
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
    const mapping = {
        'sound': LS_KEYS.SOUND_ENABLED,
        'vibration': LS_KEYS.VIBRATION_ENABLED,
        'theme': LS_KEYS.THEME_DARK
    };

    const lsKey = mapping[key];
    if (!lsKey) return;

    try {
        localStorage.setItem(lsKey, JSON.stringify(value));
    } catch (error) {
        console.error(`Storage: ошибка сохранения настройки "${key}":`, error);
    }
}

// Удобные функции для конкретных настроек

/**
 * Получает состояние звука
 * @returns {Promise<boolean>}
 */
export async function getSoundEnabled() {
    return await getSetting('sound', true);
}

/**
 * Устанавливает состояние звука
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export async function setSoundEnabled(enabled) {
    await setSetting('sound', enabled);
}

/**
 * Получает состояние вибрации
 * @returns {Promise<boolean>}
 */
export async function getVibrationEnabled() {
    return await getSetting('vibration', true);
}

/**
 * Устанавливает состояние вибрации
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export async function setVibrationEnabled(enabled) {
    await setSetting('vibration', enabled);
}

/**
 * Получает тему (true - темная, false - светлая)
 * @returns {Promise<boolean>}
 */
export async function getTheme() {
    return await getSetting('theme', false);
}

/**
 * Устанавливает тему
 * @param {boolean} dark - true для темной темы
 * @returns {Promise<void>}
 */
export async function setTheme(dark) {
    await setSetting('theme', dark);
}

// ================== СЛУЖЕБНЫЕ ФУНКЦИИ ==================

/**
 * Проверяет, доступен ли Firebase
 * @returns {boolean}
 */
export function isFirebaseAvailable() {
    return useFirebase && db !== null;
}

/**
 * Проверяет, есть ли соединение с интернетом
 * @returns {boolean}
 */
export function isOnlineMode() {
    return isOnline;
}

/**
 * Получает статус хранилища
 * @returns {Object}
 */
export function getStorageStatus() {
    return {
        firebaseAvailable: isFirebaseAvailable(),
        online: isOnlineMode(),
        offlineResultsCount: getOfflineResults().length,
        playerName: localStorage.getItem(LS_KEYS.PLAYER_NAME) || "Игрок",
        selectedRounds: parseInt(localStorage.getItem(LS_KEYS.SELECTED_ROUNDS), 10) || 20
    };
}

/**
 * Очищает все данные (для отладки)
 */
export function clearAllData() {
    Object.values(LS_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    console.log("Storage: все данные очищены");
}

// Экспортируем константы для обратной совместимости
export { LS_KEYS };