import { GameCore } from './game/core.js';
import { UIManager } from './ui/manager.js';
import { StorageService } from './services/storage.js';
import { audioService } from './services/audio.js';
import { networkSessionService } from './services/network-session.js';
import { DELAYS } from './utils/constants.js';
import { requestFullscreenOnMobile, showNotification } from './utils/helpers.js';

/**
 * Главный класс приложения
 */
class MultiplicationTrainer {
  constructor() {
    this.game = new GameCore();
    this.ui = new UIManager();
    this.progressCells = [];
    this.timerInterval = null;
    this.networkSession = networkSessionService;
    this.isNetworkGame = false;
    this.networkParticipants = {};
    
    this.init();
  }

  /**
   * Инициализирует приложение
   */
  init() {
    // Инициализируем настройки
    this.ui.initSettings();
    this.ui.enhanceAccessibility();
    
    // Устанавливаем начальные значения
    this.ui.updateMenuStatus();
    this.ui.renderLeaderboard().catch(err => console.error('Ошибка загрузки таблицы лидеров:', err));
    
    // Инициализируем обработчики событий
    this.setupEventListeners();
    
    // Устанавливаем имя игрока по умолчанию если не установлено
    if (!localStorage.getItem('mt_player_name')) {
      StorageService.setPlayerName('Игрок');
    }
  }

  /**
   * Настраивает обработчики событий
   */
  setupEventListeners() {
    const { elements } = this.ui;

    // Кнопки меню
    elements.startBtn.addEventListener('click', () => this.startGame());
    elements.connectBtn.addEventListener('click', () => this.toggleConnection());
    elements.renameBtn.addEventListener('click', () => this.renamePlayer());
    elements.networkBtn.addEventListener('click', () => this.toggleNetworkMode());
    
    // Кнопки игры
    elements.pauseBtn.addEventListener('click', () => this.togglePause());
    elements.backBtn.addEventListener('click', () => this.backToMenu());
    
    // Кнопки результатов
    elements.playAgainBtn.addEventListener('click', () => this.startGame());
    elements.toMenuBtn.addEventListener('click', () => this.backToMenu());
    
    // Настройки
    elements.soundToggle.addEventListener('change', (e) => {
      StorageService.setSoundEnabled(e.target.checked);
    });
    
    elements.vibrationToggle.addEventListener('change', (e) => {
      StorageService.setVibrationEnabled(e.target.checked);
    });
    
    // Клавиатура
    elements.keypad.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      
      const key = target.dataset.key;
      if (!key) return;
      
      // Анимируем нажатие клавиши
      this.ui.animateKeyPress(target);
      
      this.handleKeyPress(key);
    });
    
    // Клавиатура компьютера
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardEvent(e);
    });
  }

  /**
   * Начинает новую игру
   */
  startGame() {
    // Сбрасываем состояние игры
    this.game.startNewGame();
    
    // Показываем экран игры
    this.ui.showScreen('game');
    
    // Инициализируем трек прогресса
    this.progressCells = this.ui.initProgressTrack(this.game.currentQuestions.length);
    
    // Обновляем UI
    this.ui.updateQuestion(this.game.setCurrentQuestion());
    this.ui.updateAnswer('');
    this.ui.resetFeedback();
    this.updateGameUI();
    
    // Запускаем таймер
    this.startTimer();
    
    // Запрашиваем полноэкранный режим на мобильных устройствах
    requestFullscreenOnMobile();
  }

  /**
   * Запускает таймер
   */
  startTimer() {
    this.stopTimer();
    
    this.timerInterval = setInterval(() => {
      const timeInfo = this.game.updateTimer();
      this.ui.updateTimer(timeInfo.totalSec);
    }, 1000);
  }

  /**
   * Останавливает таймер
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Обрабатывает нажатие клавиши
   * @param {string} key - нажатая клавиша
   */
  handleKeyPress(key) {
    const result = this.game.handleKeyPress(key);
    
    switch (result.type) {
      case 'digit':
      case 'delete':
      case 'clear':
        this.ui.updateAnswer(result.answer);
        break;
        
      case 'submit':
        this.handleAnswerSubmission(result);
        break;
        
      case 'empty':
        // Ничего не делаем для пустого ответа
        break;
        
      case 'max_length':
        // Можно показать уведомление о максимальной длине
        break;
        
      case 'ignored':
        // Игнорируем нажатие (игра заблокирована или на паузе)
        break;
    }
  }

  /**
   * Обрабатывает отправку ответа
   * @param {Object} result - результат проверки
   */
  handleAnswerSubmission(result) {
    const { isCorrect, correctAnswer } = result;
    
    // Показываем обратную связь
    const feedbackText = isCorrect 
      ? "Верно!" 
      : `Неверно. Правильно: ${correctAnswer}`;
    
    this.ui.showFeedback(feedbackText, isCorrect);
    
    // Обновляем прогресс
    this.ui.updateProgressCell(
      this.progressCells, 
      this.game.currentRound, 
      isCorrect
    );
    
    // Обновляем UI
    this.updateGameUI();
    
    // Обновляем сетевой прогресс
    this.updateNetworkProgress();
    
    // Переходим к следующему вопросу или завершаем игру
    setTimeout(() => {
      const gameFinished = this.game.nextQuestion();
      
      if (gameFinished) {
        this.finishGame();
      } else {
        this.ui.updateQuestion(this.game.setCurrentQuestion());
        this.ui.updateAnswer('');
        this.ui.resetFeedback();
      }
    }, DELAYS.feedback);
  }

  /**
   * Обновляет UI игры
   */
  updateGameUI() {
    const progress = this.game.getProgress();
    this.ui.updateStreak(progress.streak);
  }

  /**
   * Обновляет сетевой прогресс
   */
  async updateNetworkProgress() {
    if (!this.isNetworkGame) return;
    
    try {
      const progress = this.game.getNetworkProgress();
      await this.networkSession.updateProgress(
        progress.progress,
        progress.score
      );
    } catch (error) {
      console.error('Ошибка обновления сетевого прогресса:', error);
    }
  }

  /**
   * Завершает игру
   */
  async finishGame() {
    this.stopTimer();
    
    // Получаем результаты (асинхронно)
    const result = await this.game.finishGame();
    const answersLog = this.game.getAnswersLog();
    
    // Обновляем сетевой прогресс при завершении
    if (this.isNetworkGame) {
      try {
        await this.networkSession.finishGame(
          result.score,
          result.totalTimeSec
        );
      } catch (error) {
        console.error('Ошибка завершения сетевой игры:', error);
      }
    }
    
    // Показываем экран результатов
    this.ui.showScreen('result');
    this.ui.showResults(result, answersLog);
    
    // Обновляем таблицу лидеров
    this.ui.renderLeaderboard().catch(err => console.error('Ошибка загрузки таблицы лидеров:', err));
  }

  /**
   * Возвращает в меню
   */
  backToMenu() {
    this.stopTimer();
    this.ui.showScreen('menu');
    this.ui.updateMenuStatus();
    this.ui.renderLeaderboard().catch(err => console.error('Ошибка загрузки таблицы лидеров:', err));
  }

  /**
   * Переключает паузу
   */
  togglePause() {
    const isPaused = this.game.togglePause();
    this.ui.updatePauseState(isPaused);
    
    if (isPaused) {
      this.stopTimer();
      audioService.suspend();
    } else {
      this.startTimer();
      audioService.resume();
    }
  }

  /**
   * Переключает подключение
   */
  toggleConnection() {
    const newState = !StorageService.isConnected();
    StorageService.setConnected(newState);
    this.ui.updateMenuStatus();
    
    showNotification(
      newState ? 'Подключение активировано' : 'Подключение отключено',
      newState ? 'success' : 'info'
    );
  }

  /**
   * Переключает сетевой режим
   */
  async toggleNetworkMode() {
    if (!StorageService.isConnected()) {
      showNotification('Сначала нажмите «Подключить».', 'warning');
      return;
    }
    
    const newState = !StorageService.isNetworkMode();
    StorageService.setNetworkMode(newState);
    this.ui.updateMenuStatus();
    
    if (newState) {
      // Включаем сетевой режим - ищем или создаем сессию
      await this.startNetworkSession();
    } else {
      // Выключаем сетевой режим - покидаем сессию
      await this.leaveNetworkSession();
    }
    
    showNotification(
      newState ? 'Сетевой режим включен' : 'Сетевой режим выключен',
      'info'
    );
  }

  /**
   * Запускает сетевую сессию (поиск или создание)
   */
  async startNetworkSession() {
    try {
      // Ищем активные сессии
      const activeSessions = await this.networkSession.findActiveSessions();
      
      if (activeSessions.length > 0) {
        // Присоединяемся к первой доступной сессии
        const session = activeSessions[0];
        const joined = await this.networkSession.joinSession(session.id);
        
        if (joined) {
          this.isNetworkGame = true;
          this.setupNetworkListeners();
          showNotification(`Присоединились к сессии ${session.hostName}`, 'success');
        } else {
          // Если не удалось присоединиться, создаем свою сессию
          await this.createNetworkSession();
        }
      } else {
        // Создаем новую сессию
        await this.createNetworkSession();
      }
    } catch (error) {
      console.error('Ошибка запуска сетевой сессии:', error);
      showNotification('Ошибка подключения к сетевой сессии', 'error');
    }
  }

  /**
   * Создает новую сетевую сессию
   */
  async createNetworkSession() {
    try {
      const sessionId = await this.networkSession.createSession();
      this.isNetworkGame = true;
      this.setupNetworkListeners();
      showNotification('Создана новая сессия. Ожидание участников...', 'info');
    } catch (error) {
      console.error('Ошибка создания сессии:', error);
      showNotification('Ошибка создания сессии', 'error');
    }
  }

  /**
   * Покидает сетевую сессию
   */
  async leaveNetworkSession() {
    try {
      await this.networkSession.leaveSession();
      this.isNetworkGame = false;
      this.networkParticipants = {};
      this.ui.hideNetworkProgress();
    } catch (error) {
      console.error('Ошибка выхода из сессии:', error);
    }
  }

  /**
   * Настраивает слушатели сетевых событий
   */
  setupNetworkListeners() {
    // Обновление участников
    this.networkSession.onParticipantsChange = (participants) => {
      this.networkParticipants = participants;
      this.ui.updateNetworkProgress(participants);
    };

    // Начало игры
    this.networkSession.onGameStart = (questions) => {
      showNotification('Игра началась!', 'success');
      // TODO: синхронизировать вопросы и начать игру
      this.startNetworkGame(questions);
    };

    // Обновление состояния сессии
    this.networkSession.onSessionUpdate = (session) => {
      if (session && session.status === 'finished') {
        this.finishNetworkGame(session);
      }
    };
  }

  /**
   * Начинает сетевую игру
   */
  startNetworkGame(questions) {
    // Устанавливаем вопросы для игры
    this.game.setNetworkQuestions(questions);
    
    // Начинаем игру
    this.startGame();
    
    // Обновляем UI для сетевого режима
    this.ui.showNetworkProgress();
  }

  /**
   * Завершает сетевую игру
   */
  finishNetworkGame(session) {
    // Показываем результаты всех участников
    this.ui.showNetworkResults(session);
  }

  /**
   * Переименовывает игрока
   */
  async renamePlayer() {
    const currentName = StorageService.getPlayerName();
    
    try {
      // Используем кастомное модальное окно
      const { ModalService } = await import('./ui/modals.js');
      
      const newName = await ModalService.showPrompt({
        title: 'Сменить имя игрока',
        message: 'Введите новое имя:',
        defaultValue: currentName,
        placeholder: 'Имя игрока',
        confirmText: 'Сохранить',
        cancelText: 'Отмена',
        validate: (value) => {
          if (!value.trim()) {
            return 'Имя не может быть пустым.';
          }
          if (value.length > 50) {
            return 'Имя слишком длинное (максимум 50 символов).';
          }
          return null;
        }
      });
      
      if (newName === null) return; // Пользователь отменил
      
      StorageService.setPlayerName(newName);
      this.ui.updateMenuStatus();
      
      // Используем уведомление через ModalService
      ModalService.showNotification({
        message: `Имя изменено на: ${newName}`,
        type: 'success',
        duration: 3000
      });
      
    } catch (error) {
      console.error('Ошибка при смене имени:', error);
      // Fallback на старый prompt
      const newName = prompt('Введите новое имя игрока:', currentName);
      if (newName !== null && newName.trim()) {
        StorageService.setPlayerName(newName.trim());
        this.ui.updateMenuStatus();
        showNotification(`Имя изменено на: ${newName.trim()}`, 'success');
      }
    }
  }

  /**
   * Обрабатывает события клавиатуры
   * @param {KeyboardEvent} event - событие клавиатуры
   */
  handleKeyboardEvent(event) {
    // Проверяем, активен ли экран игры
    if (this.ui.elements.gameScreen.classList.contains('hidden')) return;
    
    // Обработка специальных клавиш
    if (event.key.toLowerCase() === 'p') {
      this.togglePause();
      return;
    }
    
    if (event.key === 'Escape') {
      this.backToMenu();
      return;
    }
    
    // Игнорируем если игра заблокирована или на паузе
    if (this.game.isLocked || this.game.isPaused) return;
    
    // Обработка цифровых клавиш и управляющих клавиш
    if (event.key >= '0' && event.key <= '9') {
      this.handleKeyPress(event.key);
      return;
    }
    
    if (event.key === 'Backspace') {
      this.handleKeyPress('del');
      return;
    }
    
    if (event.key === 'Delete') {
      this.handleKeyPress('clear');
      return;
    }
    
    if (event.key === 'Enter') {
      this.handleKeyPress('enter');
      return;
    }
  }
}

// Инициализируем приложение когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MultiplicationTrainer();
});