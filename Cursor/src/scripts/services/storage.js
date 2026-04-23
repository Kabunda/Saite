import { STORAGE_KEYS } from '../utils/constants.js';
import { getBoolSetting } from '../utils/helpers.js';
import { firebaseService } from './firebase.js';

/**
 * Сервис для работы с localStorage
 */
export class StorageService {
  /**
   * Получает имя игрока
   * @returns {string} имя игрока (может быть пустой строкой если не установлено)
   */
  static getPlayerName() {
    const value = localStorage.getItem(STORAGE_KEYS.playerName);
    return value || "";
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
   * @returns {Promise<Array>} массив записей
   */
  static async getLeaderboard() {
    // Если включён сетевой режим и есть подключение, пытаемся загрузить из Firebase
    if (this.isNetworkMode() && this.isConnected()) {
      try {
        const remote = await firebaseService.getLeaderboard(10);
        if (remote.length > 0) {
          // Сохраняем локально для офлайн-доступа
          this.setLeaderboard(remote);
          return remote;
        }
      } catch (error) {
        console.warn('Не удалось загрузить таблицу лидеров из Firebase:', error);
        // Продолжаем с локальными данными
      }
    }

    // Локальный fallback
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
  static async saveResult(result) {
    // Всегда сохраняем локально
    const current = await this.getLeaderboard();
    const next = [...current, result]
      .sort((a, b) => {
        if (a.totalTimeSec !== b.totalTimeSec) return a.totalTimeSec - b.totalTimeSec;
        return b.score - a.score;
      })
      .slice(0, 10); // Сохраняем только топ-10
    this.setLeaderboard(next);

    // Если включён сетевой режим, синхронизируем с Firebase
    if (this.isNetworkMode() && this.isConnected()) {
      try {
        await firebaseService.saveResult(result);
      } catch (error) {
        console.warn('Не удалось синхронизировать результат с Firebase:', error);
        // Можно добавить в очередь для повторной попытки
        this._addToSyncQueue(result);
      }
    }
  }

  /**
   * Добавляет результат в очередь для последующей синхронизации
   * @param {Object} result - результат игры
   */
  static _addToSyncQueue(result) {
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.syncQueue) || '[]');
    queue.push({
      ...result,
      timestamp: Date.now()
    });
    localStorage.setItem(STORAGE_KEYS.syncQueue, JSON.stringify(queue));
  }

  /**
   * Пытается синхронизировать результаты из очереди
   */
  static async syncPendingResults() {
    if (!this.isNetworkMode() || !this.isConnected()) return;

    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.syncQueue) || '[]');
    if (queue.length === 0) return;

    const successful = [];
    for (const item of queue) {
      try {
        await firebaseService.saveResult(item);
        successful.push(item);
      } catch (error) {
        console.warn('Ошибка синхронизации отложенного результата:', error);
        break; // Прерываем при первой ошибке (можно продолжить)
      }
    }

    // Удаляем успешно синхронизированные
    const newQueue = queue.filter(item => !successful.some(s => s.timestamp === item.timestamp));
    localStorage.setItem(STORAGE_KEYS.syncQueue, JSON.stringify(newQueue));
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