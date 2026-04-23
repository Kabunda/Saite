import { FirebaseService } from './firebase.js';
import { StorageService } from './storage.js';
import { showNotification } from '../utils/helpers.js';
import { DB_PATHS } from './firebase-config.js';

/**
 * Сервис для управления сетевыми сессиями
 */
export class NetworkSessionService {
  constructor() {
    this.firebase = new FirebaseService();
    this.sessionId = null;
    this.participantId = null;
    this.isHost = false;
    this.sessionRef = null;
    this.participantsRef = null;
    this.gameStateRef = null;
    this.unsubscribeCallbacks = [];
    this.maxParticipants = 5;
    this.waitingTimeout = null;
  }

  /**
   * Инициализирует сервис
   */
  async init() {
    return await this.firebase.init();
  }

  /**
   * Генерирует уникальный ID для участника
   */
  generateParticipantId() {
    return 'participant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Генерирует уникальный ID для сессии
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Ищет активные сессии
   * @returns {Promise<Array>} массив активных сессий
   */
  async findActiveSessions() {
    if (!(await this.init())) {
      return [];
    }

    try {
      const snapshot = await this.firebase.db.ref(DB_PATHS.ACTIVE_SESSIONS)
        .orderByChild('status')
        .equalTo('waiting')
        .once('value');

      const sessions = [];
      snapshot.forEach(childSnapshot => {
        const session = childSnapshot.val();
        sessions.push({
          id: childSnapshot.key,
          ...session
        });
      });

      // Фильтруем сессии, где есть место
      return sessions.filter(session => 
        session.participantCount < this.maxParticipants
      );
    } catch (error) {
      console.error('Ошибка поиска активных сессий:', error);
      return [];
    }
  }

  /**
   * Создает новую сессию
   * @param {Object} options - параметры сессии
   * @returns {Promise<string>} ID созданной сессии
   */
  async createSession(options = {}) {
    if (!(await this.init())) {
      throw new Error('Firebase не инициализирован');
    }

    const sessionId = this.generateSessionId();
    this.participantId = this.generateParticipantId();
    this.isHost = true;

    const playerName = StorageService.getPlayerName();
    const sessionData = {
      hostId: this.participantId,
      hostName: playerName,
      createdAt: Date.now(),
      status: 'waiting',
      participantCount: 1,
      maxParticipants: this.maxParticipants,
      gameStarted: false,
      questions: null,
      ...options
    };

    try {
      // Создаем сессию
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${sessionId}`).set(sessionData);
      
      // Добавляем в список активных сессий
      await this.firebase.db.ref(`${DB_PATHS.ACTIVE_SESSIONS}/${sessionId}`).set({
        status: 'waiting',
        participantCount: 1,
        createdAt: Date.now(),
        hostName: playerName
      });

      // Добавляем первого участника
      await this.addParticipant(sessionId, this.participantId, playerName);

      this.sessionId = sessionId;
      this.setupSessionListeners();

      showNotification('Сессия создана. Ожидание участников...', 'info');
      
      // Запускаем таймер ожидания (5 секунд)
      this.startWaitingTimer();

      return sessionId;
    } catch (error) {
      console.error('Ошибка создания сессии:', error);
      throw error;
    }
  }

  /**
   * Присоединяется к существующей сессии
   * @param {string} sessionId - ID сессии
   * @returns {Promise<boolean>} успешность подключения
   */
  async joinSession(sessionId) {
    if (!(await this.init())) {
      throw new Error('Firebase не инициализирован');
    }

    this.participantId = this.generateParticipantId();
    this.isHost = false;
    const playerName = StorageService.getPlayerName();

    try {
      // Проверяем, есть ли место в сессии
      const sessionSnapshot = await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${sessionId}`).once('value');
      const session = sessionSnapshot.val();
      
      if (!session || session.status !== 'waiting' || session.participantCount >= this.maxParticipants) {
        showNotification('Невозможно присоединиться к сессии', 'error');
        return false;
      }

      // Добавляем участника
      await this.addParticipant(sessionId, this.participantId, playerName);

      // Обновляем счетчик участников
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${sessionId}/participantCount`).set(session.participantCount + 1);
      await this.firebase.db.ref(`${DB_PATHS.ACTIVE_SESSIONS}/${sessionId}/participantCount`).set(session.participantCount + 1);

      this.sessionId = sessionId;
      this.setupSessionListeners();

      showNotification(`Присоединились к сессии ${session.hostName}`, 'success');
      return true;
    } catch (error) {
      console.error('Ошибка присоединения к сессии:', error);
      throw error;
    }
  }

  /**
   * Добавляет участника в сессию
   */
  async addParticipant(sessionId, participantId, playerName) {
    const participantData = {
      id: participantId,
      name: playerName,
      joinedAt: Date.now(),
      progress: 0,
      score: 0,
      finished: false
    };

    await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${sessionId}/participants/${participantId}`).set(participantData);
  }

  /**
   * Запускает таймер ожидания (5 секунд)
   */
  startWaitingTimer() {
    if (this.waitingTimeout) {
      clearTimeout(this.waitingTimeout);
    }

    this.waitingTimeout = setTimeout(() => {
      if (this.isHost && this.sessionId) {
        this.startGame();
      }
    }, 5000); // 5 секунд
  }

  /**
   * Начинает игру в сессии
   */
  async startGame() {
    if (!this.isHost || !this.sessionId) {
      return;
    }

    try {
      // Генерируем вопросы для всех участников
      const questions = this.generateQuestions();
      
      // Обновляем состояние сессии
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}`).update({
        status: 'playing',
        gameStarted: true,
        questions: questions,
        startedAt: Date.now()
      });

      await this.firebase.db.ref(`${DB_PATHS.ACTIVE_SESSIONS}/${this.sessionId}`).update({
        status: 'playing'
      });

      showNotification('Игра началась!', 'success');
    } catch (error) {
      console.error('Ошибка начала игры:', error);
    }
  }

  /**
   * Генерирует вопросы для сетевой игры
   */
  generateQuestions() {
    // Генерируем 10 вопросов умножения
    const questions = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.floor(Math.random() * 9) + 2; // от 2 до 10
      const b = Math.floor(Math.random() * 9) + 2;
      questions.push({
        id: i,
        question: `${a} × ${b}`,
        answer: a * b,
        answered: false,
        userAnswer: null
      });
    }
    return questions;
  }

  /**
   * Обновляет прогресс текущего участника
   */
  async updateProgress(progress, score) {
    if (!this.sessionId || !this.participantId) {
      return;
    }

    try {
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}/participants/${this.participantId}`).update({
        progress,
        score,
        lastUpdate: Date.now()
      });
    } catch (error) {
      console.error('Ошибка обновления прогресса:', error);
    }
  }

  /**
   * Отмечает завершение игры для участника
   */
  async finishGame(finalScore, totalTime) {
    if (!this.sessionId || !this.participantId) {
      return;
    }

    try {
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}/participants/${this.participantId}`).update({
        finished: true,
        finalScore: finalScore,
        totalTime: totalTime,
        finishedAt: Date.now()
      });
    } catch (error) {
      console.error('Ошибка завершения игры:', error);
    }
  }

  /**
   * Настраивает слушатели изменений в сессии
   */
  setupSessionListeners() {
    if (!this.sessionId) {
      return;
    }

    // Слушатель изменений участников
    this.participantsRef = this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}/participants`);
    const participantsCallback = this.participantsRef.on('value', (snapshot) => {
      const participants = snapshot.val() || {};
      this.onParticipantsUpdate(participants);
    });
    this.unsubscribeCallbacks.push(() => this.participantsRef.off('value', participantsCallback));

    // Слушатель состояния игры
    this.gameStateRef = this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}`);
    const gameStateCallback = this.gameStateRef.on('value', (snapshot) => {
      const session = snapshot.val();
      this.onGameStateUpdate(session);
    });
    this.unsubscribeCallbacks.push(() => this.gameStateRef.off('value', gameStateCallback));
  }

  /**
   * Обработчик обновления списка участников
   */
  onParticipantsUpdate(participants) {
    // Можно обновить UI с прогрессом участников
    if (typeof this.onParticipantsChange === 'function') {
      this.onParticipantsChange(participants);
    }
  }

  /**
   * Обработчик обновления состояния игры
   */
  onGameStateUpdate(session) {
    if (session && session.status === 'playing' && !this.gameStarted) {
      this.gameStarted = true;
      if (typeof this.onGameStart === 'function') {
        this.onGameStart(session.questions);
      }
    }

    if (typeof this.onSessionUpdate === 'function') {
      this.onSessionUpdate(session);
    }
  }

  /**
   * Покидает сессию
   */
  async leaveSession() {
    if (!this.sessionId || !this.participantId) {
      return;
    }

    try {
      // Удаляем участника
      await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}/participants/${this.participantId}`).remove();

      // Обновляем счетчик участников
      const sessionSnapshot = await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}`).once('value');
      const session = sessionSnapshot.val();
      
      if (session) {
        const newCount = Math.max(0, session.participantCount - 1);
        await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}/participantCount`).set(newCount);
        await this.firebase.db.ref(`${DB_PATHS.ACTIVE_SESSIONS}/${this.sessionId}/participantCount`).set(newCount);

        // Если участников не осталось, удаляем сессию
        if (newCount === 0) {
          await this.firebase.db.ref(`${DB_PATHS.SESSIONS}/${this.sessionId}`).remove();
          await this.firebase.db.ref(`${DB_PATHS.ACTIVE_SESSIONS}/${this.sessionId}`).remove();
        }
      }

      this.cleanup();
      showNotification('Вы покинули сессию', 'info');
    } catch (error) {
      console.error('Ошибка при выходе из сессии:', error);
    }
  }

  /**
   * Очищает ресурсы
   */
  cleanup() {
    // Отписываемся от слушателей
    this.unsubscribeCallbacks.forEach(callback => callback());
    this.unsubscribeCallbacks = [];

    if (this.waitingTimeout) {
      clearTimeout(this.waitingTimeout);
      this.waitingTimeout = null;
    }

    this.sessionId = null;
    this.participantId = null;
    this.isHost = false;
    this.sessionRef = null;
    this.participantsRef = null;
    this.gameStateRef = null;
  }

  /**
   * Получает текущую сессию
   */
  getCurrentSession() {
    return {
      sessionId: this.sessionId,
      participantId: this.participantId,
      isHost: this.isHost
    };
  }
}

// Глобальный экземпляр
export const networkSessionService = new NetworkSessionService();