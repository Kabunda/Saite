// storage.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, query, orderByChild, limitToFirst, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ================== НАСТРОЙКА FIREBASE ==================
const firebaseConfig = {
    apiKey: "AIzaSyDQ1Wzpw-cDOG8okWEbDez2AMLNTzk89q8",
    authDomain: "testds-b169f.firebaseapp.com",
    databaseURL: "https://testds-b169f-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "testds-b169f",
    storageBucket: "testds-b169f.firebasestorage.app",
    messagingSenderId: "726631928847",
    appId: "1:726631928847:web:d4e5eb7af866398796ff7a"
};

let db = null;
let useFirebase = false;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        useFirebase = true;
        console.log("Firebase инициализирован.");
    } else {
        console.warn("Firebase не настроен.");
    }
} catch (error) {
    console.error("Ошибка инициализации Firebase:", error);
}

// ================== КЛЮЧИ LOCAL STORAGE ==================
const LS_KEYS = {
    playerName: 'mt_playerName',
    selectedRounds: 'mt_selectedRounds',
    soundEnabled: 'mt_sound_enabled',
    vibrationEnabled: 'mt_vibration_enabled',
    theme: 'mt_theme_dark',
    offlineResults: 'mt_offline_results'
};

// ================== ИМЯ ИГРОКА ==================
export async function getPlayerName() {
    return localStorage.getItem(LS_KEYS.playerName) || "Игрок";
}

export async function setPlayerName(name) {
    localStorage.setItem(LS_KEYS.playerName, name);
}

// ================== НАСТРОЙКИ ==================
export async function getBoolSetting(key, defaultValue) {
    const mapping = {
        'mt_sound_enabled': { ls: LS_KEYS.soundEnabled, default: true },
        'mt_vibration_enabled': { ls: LS_KEYS.vibrationEnabled, default: true },
        'mt_theme_dark': { ls: LS_KEYS.theme, default: false }
    };
    const config = mapping[key];
    if (!config) return defaultValue;
    const raw = localStorage.getItem(config.ls);
    return raw !== null ? JSON.parse(raw) : config.default;
}

export async function setSetting(key, value) {
    const mapping = {
        'mt_sound_enabled': LS_KEYS.soundEnabled,
        'mt_vibration_enabled': LS_KEYS.vibrationEnabled,
        'mt_theme_dark': LS_KEYS.theme
    };
    const lsKey = mapping[key];
    if (lsKey) {
        localStorage.setItem(lsKey, JSON.stringify(value));
    }
}

// ================== КОЛИЧЕСТВО ВОПРОСОВ ==================
export async function getSelectedRounds() {
    return parseInt(localStorage.getItem(LS_KEYS.selectedRounds), 10) || 20;
}

export async function setSelectedRounds(rounds) {
    localStorage.setItem(LS_KEYS.selectedRounds, String(rounds));
}

// ================== ТЕМА ==================
export async function getTheme() {
    return (await getBoolSetting('mt_theme_dark', false));
}

export async function setTheme(dark) {
    await setSetting('mt_theme_dark', dark);
}

// ================== ТАБЛИЦА ЛИДЕРОВ И СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ==================

/**
 * Добавить новый результат игры.
 * При доступном Firebase – сохраняет напрямую.
 * При ошибке – помещает в локальную очередь.
 */
export async function addResult(result) {
    if (useFirebase && db) {
        try {
            const resultsRef = ref(db, 'results');
            await push(resultsRef, result);
            console.log("Результат сохранён в Firebase.");
            return;
        } catch (error) {
            console.error("Ошибка сохранения в Firebase. Результат помещён в локальную очередь.", error);
        }
    }
    const offline = getOfflineResults();
    offline.push(result);
    localStorage.setItem(LS_KEYS.offlineResults, JSON.stringify(offline));
}

/**
 * Получить топ-10 лидеров, отсортированных по штрафному времени (время + 5 сек за ошибку).
 * Использует серверную сортировку по totalTimeSec (если настроен индекс),
 * но финальная сортировка всё равно выполняется на клиенте по штрафному времени.
 * Возвращает null при полной недоступности Firebase.
 */
export async function getLeaderboard() {
    if (!useFirebase || !db) return null;
    try {
        const resultsRef = ref(db, 'results');
        // Попробуем запрос с серверной сортировкой и ограничением
        const topQuery = query(resultsRef, orderByChild('totalTimeSec'), limitToFirst(10));
        const snapshot = await get(topQuery);

        const leaderboard = [];
        snapshot.forEach(child => {
            const data = child.val();
            leaderboard.push({
                playerName: data.playerName || "Игрок",
                totalTimeSec: data.totalTimeSec,
                score: data.score,
                rounds: data.rounds,
                bestStreak: data.bestStreak || 0,
                finishedAt: data.finishedAt || 0
            });
        });

        // Сортировка по штрафному времени: реальное время + 5 секунд за каждую ошибку
        leaderboard.sort((a, b) => {
            const penaltyA = a.totalTimeSec + (a.rounds - a.score) * 5;
            const penaltyB = b.totalTimeSec + (b.rounds - b.score) * 5;
            return penaltyA - penaltyB || b.score - a.score;
        });
        return leaderboard.slice(0, 10);
    } catch (error) {
        // Если ошибка связана с отсутствием индекса, делаем fallback на клиентскую сортировку
        if (error.message && error.message.includes('Index not defined')) {
            console.warn("Индекс для 'totalTimeSec' не настроен. Загружаем все записи и сортируем на клиенте.");
            return getLeaderboardFallback();
        }
        console.error("Ошибка загрузки лидеров из Firebase:", error);
        return null;
    }
}

/**
 * Fallback-загрузка всех результатов и клиентская сортировка по штрафному времени.
 */
async function getLeaderboardFallback() {
    if (!useFirebase || !db) return null;
    try {
        const resultsRef = ref(db, 'results');
        const snapshot = await get(resultsRef);
        const leaderboard = [];
        snapshot.forEach(child => {
            const data = child.val();
            leaderboard.push({
                playerName: data.playerName || "Игрок",
                totalTimeSec: data.totalTimeSec,
                score: data.score,
                rounds: data.rounds,
                bestStreak: data.bestStreak || 0,
                finishedAt: data.finishedAt || 0
            });
        });
        leaderboard.sort((a, b) => {
            const penaltyA = a.totalTimeSec + (a.rounds - a.score) * 5;
            const penaltyB = b.totalTimeSec + (b.rounds - b.score) * 5;
            return penaltyA - penaltyB || b.score - a.score;
        });
        return leaderboard.slice(0, 10);
    } catch (error) {
        console.error("Ошибка в fallback-загрузке:", error);
        return null;
    }
}

/**
 * Синхронизация локально сохранённых результатов с Firebase.
 */
export async function syncLocalResults() {
    if (!useFirebase || !db) return;
    const offline = getOfflineResults();
    if (offline.length === 0) return;

    console.log(`Синхронизация ${offline.length} офлайн-результатов...`);
    const resultsRef = ref(db, 'results');
    for (const result of offline) {
        try {
            await push(resultsRef, result);
        } catch (error) {
            console.error("Ошибка при синхронизации результата:", error);
            return;
        }
    }
    localStorage.removeItem(LS_KEYS.offlineResults);
    console.log("Офлайн-результаты синхронизированы.");
}

// ================== ВСПОМОГАТЕЛЬНЫЕ ==================
function getOfflineResults() {
    const raw = localStorage.getItem(LS_KEYS.offlineResults);
    return raw ? JSON.parse(raw) : [];
}

export { db, useFirebase };