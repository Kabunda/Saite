// storage.js
// Модуль для работы с хранилищем данных (сейчас localStorage, в будущем Firebase)

const STORAGE_KEYS = {
    playerName: "mt_player_name",
    leaderboard: "mt_leaderboard",
    soundEnabled: "mt_sound_enabled",
    vibrationEnabled: "mt_vibration_enabled",
    selectedRounds: "mt_selected_rounds",
    theme: "mt_theme"
};

// Асинхронные обёртки над localStorage
// Позже можно заменить на вызовы Firebase без изменения сигнатур

export async function getPlayerName() {
    const value = localStorage.getItem(STORAGE_KEYS.playerName);
    return value?.trim() || "Игрок";
}

export async function setPlayerName(name) {
    localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
}

export async function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) || "[]");
    } catch {
        return [];
    }
}

export async function setLeaderboard(items) {
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(items));
}

export async function getBoolSetting(key, defaultValue = true) {
    const value = localStorage.getItem(key);
    return value === null ? defaultValue : value === "true";
}

export async function setSetting(key, value) {
    localStorage.setItem(key, String(value));
}

export async function getSelectedRounds() {
    return parseInt(localStorage.getItem(STORAGE_KEYS.selectedRounds) || "20", 10);
}

export async function setSelectedRounds(rounds) {
    localStorage.setItem(STORAGE_KEYS.selectedRounds, String(rounds));
}

export async function getTheme() {
    const value = localStorage.getItem(STORAGE_KEYS.theme);
    return value === "true";
}

export async function setTheme(dark) {
    localStorage.setItem(STORAGE_KEYS.theme, String(dark));
}