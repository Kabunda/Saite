import { firebaseConfig, DB_PATHS } from './firebase-config.js';

/**
 * Сервис для работы с Firebase Realtime Database
 */
export class FirebaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this._initPromise = null;
  }

  /**
   * Инициализирует Firebase (идемпотентно)
   * @returns {Promise<boolean>} true если успешно
   */
  async init() {
    if (this.initialized) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        // Проверяем, что Firebase доступен глобально
        if (typeof firebase === 'undefined') {
          console.warn('Firebase SDK не загружен. Проверьте подключение скриптов.');
          return false;
        }

        // Инициализируем Firebase App
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }

        // Получаем ссылку на базу данных
        this.db = firebase.database();
        this.initialized = true;
        console.log('Firebase инициализирован');
        return true;
      } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        return false;
      }
    })();

    return this._initPromise;
  }

  /**
   * Проверяет, доступна ли сеть (упрощённо)
   * @returns {boolean}
   */
  isOnline() {
    return navigator.onLine;
  }

  /**
   * Сохраняет результат игры в Firebase
   * @param {Object} result - объект результата игры
   * @returns {Promise<string|null>} ID сохранённой записи или null при ошибке
   */
  async saveResult(result) {
    if (!(await this.init()) || !this.isOnline()) {
      return null;
    }

    try {
      const record = {
        ...result,
        syncedAt: Date.now(),
        deviceId: this._getDeviceId()
      };

      const ref = this.db.ref(DB_PATHS.RESULTS).push();
      await ref.set(record);
      console.log('Результат сохранён в Firebase с ID:', ref.key);
      return ref.key;
    } catch (error) {
      console.error('Ошибка сохранения результата в Firebase:', error);
      return null;
    }
  }

  /**
   * Получает таблицу лидеров (топ N)
   * @param {number} limit - максимальное количество записей
   * @returns {Promise<Array>} массив результатов
   */
  async getLeaderboard(limit = 10) {
    if (!(await this.init())) {
      return [];
    }

    try {
      const snapshot = await this.db.ref(DB_PATHS.RESULTS)
        .orderByChild('totalTimeSec')
        .limitToFirst(limit)
        .once('value');

      const results = [];
      snapshot.forEach(childSnapshot => {
        const data = childSnapshot.val();
        results.push({
          id: childSnapshot.key,
          ...data
        });
      });

      // Сортируем по времени (на всякий случай)
      results.sort((a, b) => a.totalTimeSec - b.totalTimeSec);
      return results;
    } catch (error) {
      console.error('Ошибка загрузки таблицы лидеров из Firebase:', error);
      return [];
    }
  }

  /**
   * Подписывается на обновления таблицы лидеров в реальном времени
   * @param {Function} callback - функция, вызываемая при изменении данных
   * @returns {Function} функция отписки
   */
  subscribeToLeaderboard(callback, limit = 10) {
    if (!this.initialized) {
      console.warn('Firebase не инициализирован для подписки');
      return () => {};
    }

    const query = this.db.ref(DB_PATHS.RESULTS)
      .orderByChild('totalTimeSec')
      .limitToFirst(limit);

    const handleSnapshot = (snapshot) => {
      const results = [];
      snapshot.forEach(childSnapshot => {
        results.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      callback(results);
    };

    query.on('value', handleSnapshot);
    return () => query.off('value', handleSnapshot);
  }

  /**
   * Генерирует уникальный идентификатор устройства (упрощённо)
   * @returns {string}
   */
  _getDeviceId() {
    let id = localStorage.getItem('mt_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('mt_device_id', id);
    }
    return id;
  }
}

// Экспортируем синглтон экземпляр
export const firebaseService = new FirebaseService();