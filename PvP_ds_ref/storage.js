import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
export let useFirebase = false;

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

export { db };

// ---------- localStorage ----------
const LS_KEYS = {
    playerName: 'mt_playerName',
    soundEnabled: 'mt_sound_enabled',
    vibrationEnabled: 'mt_vibration_enabled',
    theme: 'mt_theme_dark',
    offlineResults: 'mt_offline_results'
};

export async function getPlayerName() {
    return localStorage.getItem(LS_KEYS.playerName) || "Игрок";
}

export async function setPlayerName(name) {
    localStorage.setItem(LS_KEYS.playerName, name);
}

export async function getBoolSetting(key, defaultValue) {
    const mapping = {
        'mt_sound_enabled': LS_KEYS.soundEnabled,
        'mt_vibration_enabled': LS_KEYS.vibrationEnabled,
        'mt_theme_dark': LS_KEYS.theme
    };
    const lsKey = mapping[key];
    if (!lsKey) return defaultValue;
    const raw = localStorage.getItem(lsKey);
    return raw !== null ? JSON.parse(raw) : defaultValue;
}

export async function setSetting(key, value) {
    const mapping = {
        'mt_sound_enabled': LS_KEYS.soundEnabled,
        'mt_vibration_enabled': LS_KEYS.vibrationEnabled,
        'mt_theme_dark': LS_KEYS.theme
    };
    const lsKey = mapping[key];
    if (lsKey) localStorage.setItem(lsKey, JSON.stringify(value));
}

export async function getTheme() {
    return await getBoolSetting('mt_theme_dark', false);
}

export async function setTheme(dark) {
    await setSetting('mt_theme_dark', dark);
}

// Сохранение результата
export async function addResult(result) {
    if (useFirebase && db) {
        try {
            const resultsRef = ref(db, 'results');
            await push(resultsRef, result);
            return;
        } catch (e) {
            console.error("Ошибка сохранения в Firebase, сохраняем локально", e);
        }
    }
    // локальное сохранение
    const offline = getOfflineResults();
    offline.push(result);
    localStorage.setItem(LS_KEYS.offlineResults, JSON.stringify(offline));
}

function getOfflineResults() {
    return JSON.parse(localStorage.getItem(LS_KEYS.offlineResults) || '[]');
}

export async function syncLocalResults() {
    if (!useFirebase || !db) return;
    const offline = getOfflineResults();
    if (!offline.length) return;
    const resultsRef = ref(db, 'results');
    for (const result of offline) {
        try {
            await push(resultsRef, result);
        } catch (e) {
            console.error("Ошибка синхронизации", e);
            return; // прерываем, останутся на следующий раз
        }
    }
    localStorage.removeItem(LS_KEYS.offlineResults);
}