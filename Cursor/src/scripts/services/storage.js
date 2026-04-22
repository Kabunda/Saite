import { STORAGE_KEYS } from '../utils/constants.js';
import { getBoolSetting } from '../utils/helpers.js';

/**
 * Сервис для работы с localStorage
 */
export class StorageService {
  /**
   * Получает имя игрока
   * @returns {string} имя игрока
   */
  static getPlayerName() {
    const value = localStorage.getItem(STORAGE_KEYS.playerName);
    return value && value.trim() ? value : "Игрок";
  }

  /**
   * Устанавливает имя игрока
   * @param {string} name - имя игрока
   */
  static setPlayerName(name) {
    localStorage.setItem(STORAGE_KEYS.playerName, name.trim());
  }

  /**
   * Проверяет, подключен ли игрок
   * @returns {boolean} true если подключен
   */
  static isConnected() {
    return localStorage.getItem(STORAGE_KEYS.connected) === "true";
  }

  /**
   * Устанавливает статус подключения
   * @param {boolean} flag - статус
   */
  static setConnected(flag) {
    localStorage.setItem(STORAGE_KEYS.connected, String(flag));
  }

  /**
   * Проверяет, включен ли сетевой режим
   * @returns {boolean} true если включен
   */
  static isNetworkMode() {
    return localStorage.getItem(STORAGE_KEYS.networkMode) === "true";
  }

  /**
   * Устанавливает сетевой режим
   * @param {boolean} flag - статус
   */
  static setNetworkMode(flag) {
    localStorage.setItem(STORAGE_KEYS.networkMode, String(flag));
  }

  /**
   * Получает таблицу лидеров
   * @returns {Array} массив записей
   */
  static getLeaderboard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.leaderboard);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Сохраняет таблицу лидеров
   * @param {Array} items - массив записей
   */
  static setLeaderboard(items) {
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(items));
  }

  /**
   * Добавляет результат в таблицу лидеров
   * @param {Object} result - результат игры
   */
  static saveResult(result) {
    const current = this.getLeaderboard();
    const next = [...current, result]
      .sort((a, b) => {
        if (a.totalTimeSec !== b.totalTimeSec) return a.totalTimeSec - b.totalTimeSec;
        return b.score - a.score;
      })
      .slice(0, 10); // Сохраняем только топ-10
    this.setLeaderboard(next);
  }

  /**
   * Проверяет, включен ли звук
   * @returns {boolean} true если включен
   */
  static isSoundEnabled() {
    return getBoolSetting(STORAGE_KEYS.soundEnabled, true);
  }

  /**
   * Проверяет, включена ли вибрация
   * @returns {boolean} true если включена
   */
  static isVibrationEnabled() {
    return getBoolSetting(STORAGE_KEYS.vibrationEnabled, true);
  }

  /**
   * Устанавливает настройку звука
   * @param {boolean} enabled - включен ли звук
   */
  static setSoundEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.soundEnabled, String(enabled));
  }

  /**
   * Устанавливает настройку вибрации
   * @param {boolean} enabled - включена ли вибрация
   */
  static setVibrationEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.vibrationEnabled, String(enabled));
  }

  /**
   * Очищает все данные (для отладки)
   */
  static clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}