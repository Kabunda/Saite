// Модуль игрового экрана
import { GameLogic } from '../game/gameLogic.js';
import { buildUniqueQuestionList } from '../game/taskGenerator.js';
import { getKeypad } from '../ui/keypad.js';
import { getProgressBar } from '../ui/progressBar.js';
import { getTimer } from '../ui/timer.js';
import { getSoundManager } from '../media/sound.js';
import { getVibrationManager } from '../media/vibration.js';
import { getModalManager } from '../ui/modal.js';
import * as storage from '../data/storage.js';
import { showToast } from '../utils/dom.js';
import { SCREEN_IDS } from '../utils/constants.js';
import { getScreenManager } from './screenManager.js';

class GameScreen {
    constructor() {
        this.gameLogic = null;
        this.keypad = null;
        this.progressBar = null;
        this.timer = null;
        this.soundManager = null;
        this.vibrationManager = null;
        
        this.isInitialized = false;
        this.isActive = false;
        this.onGameFinishCallback = null;
        this.onBackToMenuCallback = null;
        
        // DOM элементы
        this.elements = null;
        
        // Привязка контекста
        this.handleBackClick = this.handleBackClick.bind(this);
        this.handleFullscreenClick = this.handleFullscreenClick.bind(this);
        this.handleKeypadDigit = this.handleKeypadDigit.bind(this);
        this.handleKeypadAction = this.handleKeypadAction.bind(this);
        this.handleKeypadConfirm = this.handleKeypadConfirm.bind(this);
        this.handlePhysicalKeyboard = this.handlePhysicalKeyboard.bind(this);
        this.handleEscapeKey = this.handleEscapeKey.bind(this);
    }
    
    /**
     * Инициализирует игровой экран
     * @param {Object} options
     * @param {Function} options.onGameFinish - колбэк при завершении игры
     * @param {Function} options.onBackToMenu - колбэк при возврате в меню
     * @returns {GameScreen} экземпляр экрана
     */
    init(options = {}) {
        if (this.isInitialized) {
            console.warn('GameScreen: уже инициализирован');
            return this;
        }
        
        this.onGameFinishCallback = options.onGameFinish || null;
        this.onBackToMenuCallback = options.onBackToMenu || null;
        
        this.loadElements();
        this.setupEventHandlers();
        this.isInitialized = true;
        
        console.log('GameScreen: инициализирован');
        return this;
    }
    
    /**
     * Загружает DOM элементы
     */
    loadElements() {
        this.elements = {
            gameScreen: document.getElementById('gameScreen'),
            backBtn: document.getElementById('backBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            questionText: document.getElementById('questionText'),
            answerText: document.getElementById('answerText'),
            feedbackEl: document.getElementById('feedback'),
            keypadContainer: document.getElementById('keypad'),
            progressTrack: document.getElementById('progressTrack'),
            timerEl: document.getElementById('timer')
        };
        
        if (!this.elements.gameScreen) {
            console.error('GameScreen: не найден элемент игрового экрана');
        }
    }
    
    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        if (!this.elements) return;
        
        const { backBtn, fullscreenBtn } = this.elements;
        
        backBtn.addEventListener('click', this.handleBackClick);
        fullscreenBtn.addEventListener('click', this.handleFullscreenClick);
        
        // Глобальные обработчики клавиатуры
        document.addEventListener('keydown', this.handlePhysicalKeyboard);
        document.addEventListener('keydown', this.handleEscapeKey);
    }
    
    /**
     * Инициализирует игровые компоненты (keypad, progressBar, timer)
     */
    async initGameComponents() {
        // Инициализируем keypad
        if (this.elements.keypadContainer) {
            this.keypad = getKeypad(this.elements.keypadContainer);
            this.keypad.onDigit(this.handleKeypadDigit);
            this.keypad.onAction(this.handleKeypadAction);
            this.keypad.onConfirm(this.handleKeypadConfirm);
        }
        
        // Инициализируем progressBar
        if (this.elements.progressTrack) {
            this.progressBar = getProgressBar(this.elements.progressTrack);
        }
        
        // Инициализируем timer
        if (this.elements.timerEl) {
            this.timer = getTimer(this.elements.timerEl);
        }
        
        // Получаем менеджеры звука и вибрации
        this.soundManager = await getSoundManager();
        this.vibrationManager = await getVibrationManager();
        
        console.log('GameScreen: компоненты инициализированы');
    }
    
    /**
     * Начинает новую игру
     * @param {number} rounds - количество вопросов
     * @param {string} playerName - имя игрока
     */
    async startGame(rounds, playerName) {
        if (this.isActive) {
            console.warn('GameScreen: игра уже активна');
            return;
        }
        
        console.log(`GameScreen: начало игры, ${rounds} вопросов, игрок: ${playerName}`);
        
        // Генерируем вопросы
        const questions = buildUniqueQuestionList(rounds);
        
        // Создаем игровую логику
        this.gameLogic = new GameLogic(questions);
        this.gameLogic.start();
        
        // Инициализируем компоненты, если еще не инициализированы
        if (!this.keypad) {
            await this.initGameComponents();
        }
        
        // Сбрасываем компоненты
        if (this.progressBar) {
            this.progressBar.reset();
            this.progressBar.setTotal(rounds);
        }
        
        if (this.timer) {
            this.timer.reset();
            this.timer.start();
        }
        
        // Показываем экран
        this.show();
        
        // Устанавливаем первый вопрос
        this.setCurrentQuestion();
        
        this.isActive = true;
        
        // Запрашиваем полноэкранный режим на мобильных устройствах
        this.requestFullscreenOnMobile();
        
        console.log('GameScreen: игра начата');
    }
    
    /**
     * Устанавливает текущий вопрос на экране
     */
    setCurrentQuestion() {
        if (!this.gameLogic || !this.elements) return;
        
        const currentQuestion = this.gameLogic.getCurrentQuestion();
        if (!currentQuestion) return;
        
        const { questionText, answerText } = this.elements;
        const { a, b } = currentQuestion;
        
        if (questionText) {
            questionText.textContent = `${a} × ${b} = ?`;
        }
        
        if (answerText) {
            answerText.textContent = '_';
        }
        
        // Сбрасываем feedback
        this.resetFeedback();
        
        // Обновляем прогресс-бар
        if (this.progressBar) {
            this.progressBar.setCurrent(this.gameLogic.getCurrentIndex());
        }
    }
    
    /**
     * Обрабатывает ввод цифры с клавиатуры
     * @param {string} digit
     */
    handleKeypadDigit(digit) {
        if (!this.isActive || !this.gameLogic || this.gameLogic.isLocked()) return;
        
        const currentAnswer = this.gameLogic.getCurrentAnswer();
        if (currentAnswer.length >= 3) return;
        
        this.gameLogic.setCurrentAnswer(currentAnswer + digit);
        this.renderAnswer();
        
        // Воспроизводим звук и вибрацию
        this.playClickFeedback();
    }
    
    /**
     * Обрабатывает действие клавиатуры (del, clear)
     * @param {string} action
     */
    handleKeypadAction(action) {
        if (!this.isActive || !this.gameLogic || this.gameLogic.isLocked()) return;
        
        if (action === 'del') {
            const currentAnswer = this.gameLogic.getCurrentAnswer();
            this.gameLogic.setCurrentAnswer(currentAnswer.slice(0, -1));
            this.renderAnswer();
            this.playClickFeedback();
        } else if (action === 'clear') {
            this.gameLogic.setCurrentAnswer('');
            this.renderAnswer();
            this.playClickFeedback();
        }
    }
    
    /**
     * Обрабатывает подтверждение ответа (Enter)
     */
    handleKeypadConfirm() {
        if (!this.isActive || !this.gameLogic || this.gameLogic.isLocked()) return;
        
        const currentAnswer = this.gameLogic.getCurrentAnswer();
        if (!currentAnswer) return;
        
        this.checkAnswer();
    }
    
    /**
     * Обрабатывает физическую клавиатуру
     * @param {KeyboardEvent} event
     */
    handlePhysicalKeyboard(event) {
        if (!this.isActive || !this.gameLogic || this.gameLogic.isLocked()) return;
        
        // Проверяем, не открыто ли модальное окно
        const modalManager = getModalManager();
        if (modalManager && modalManager.isAnyOpen()) return;
        
        const key = event.key;
        
        if (key >= '0' && key <= '9') {
            event.preventDefault();
            this.handleKeypadDigit(key);
        } else if (key === 'Backspace') {
            event.preventDefault();
            this.handleKeypadAction('del');
        } else if (key === 'Delete') {
            event.preventDefault();
            this.handleKeypadAction('clear');
        } else if (key === 'Enter') {
            event.preventDefault();
            this.handleKeypadConfirm();
        }
    }
    
    /**
     * Обрабатывает клавишу Escape
     * @param {KeyboardEvent} event
     */
    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.isActive) {
            event.preventDefault();
            this.handleBackClick();
        }
    }
    
    /**
     * Обрабатывает клик по кнопке "Назад"
     */
    handleBackClick() {
        if (!this.isActive) return;
        
        const modalManager = getModalManager();
        if (modalManager) {
            modalManager.confirm(
                'Выйти из игры?',
                'Текущий прогресс будет потерян.',
                () => {
                    this.finishGame(true); // forced finish
                    if (this.onBackToMenuCallback) {
                        this.onBackToMenuCallback();
                    }
                }
            );
        } else {
            if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян.')) {
                this.finishGame(true);
                if (this.onBackToMenuCallback) {
                    this.onBackToMenuCallback();
                }
            }
        }
    }
    
    /**
     * Обрабатывает клик по кнопке полноэкранного режима
     */
    handleFullscreenClick() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('GameScreen: не удалось перейти в полноэкранный режим', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Рендерит текущий ответ
     */
    renderAnswer() {
        if (!this.elements.answerText || !this.gameLogic) return;
        
        const currentAnswer = this.gameLogic.getCurrentAnswer();
        this.elements.answerText.textContent = currentAnswer.length ? currentAnswer : '_';
        
        if (currentAnswer.length) {
            this.elements.answerText.classList.add('pop');
            setTimeout(() => {
                if (this.elements.answerText) {
                    this.elements.answerText.classList.remove('pop');
                }
            }, 100);
        }
    }
    
    /**
     * Сбрасывает feedback
     */
    resetFeedback() {
        if (!this.elements.feedbackEl) return;
        
        this.elements.feedbackEl.textContent = '';
        this.elements.feedbackEl.classList.remove('ok', 'bad');
    }
    
    /**
     * Проверяет ответ
     */
    async checkAnswer() {
        if (!this.gameLogic || !this.isActive) return;
        
        const result = this.gameLogic.checkAnswer();
        
        // Отображаем результат
        this.showFeedback(result.isCorrect, result.correctAnswer);
        
        // Воспроизводим звук и вибрацию
        if (result.isCorrect) {
            this.playCorrectFeedback();
        } else {
            this.playIncorrectFeedback();
        }
        
        // Обновляем прогресс-бар
        if (this.progressBar) {
            this.progressBar.markCurrent(result.isCorrect);
        }
        
        // Ждем паузу и переходим к следующему вопросу
        setTimeout(() => {
            this.nextQuestion();
        }, 650);
    }
    
    /**
     * Показывает feedback
     * @param {boolean} isCorrect
     * @param {number} correctAnswer
     */
    showFeedback(isCorrect, correctAnswer) {
        if (!this.elements.feedbackEl) return;
        
        if (isCorrect) {
            this.elements.feedbackEl.textContent = '✓ Верно!';
            this.elements.feedbackEl.classList.add('ok');
        } else {
            this.elements.feedbackEl.textContent = `✗ Неверно. Правильно: ${correctAnswer}`;
            this.elements.feedbackEl.classList.add('bad');
            
            // Анимация тряски
            const gameArea = document.querySelector('.game-area');
            if (gameArea) {
                gameArea.classList.add('shake-area');
                setTimeout(() => gameArea.classList.remove('shake-area'), 400);
            }
        }
    }
    
    /**
     * Переходит к следующему вопросу
     */
    nextQuestion() {
        if (!this.gameLogic) return;
        
        const hasNext = this.gameLogic.nextQuestion();
        
        if (!hasNext) {
            // Игра завершена
            this.finishGame();
            return;
        }
        
        this.setCurrentQuestion();
        this.renderAnswer();
        this.resetFeedback();
    }
    
    /**
     * Завершает игру
     * @param {boolean} forced - принудительное завершение (без сохранения)
     */
    async finishGame(forced = false) {
        if (!this.isActive) return;
        
        console.log(`GameScreen: завершение игры (forced: ${forced})`);
        
        this.isActive = false;
        
        // Останавливаем таймер
        if (this.timer) {
            this.timer.stop();
        }
        
        if (!forced && this.gameLogic) {
            // Завершаем игру в логике
            this.gameLogic.finish();
            
            // Сохраняем результат
            await this.saveGameResult();
            
            // Вызываем колбэк завершения игры
            if (this.onGameFinishCallback) {
                this.onGameFinishCallback(this.gameLogic.getStats());
            }
        }
        
        // Сбрасываем состояние
        this.gameLogic = null;
        
        console.log('GameScreen: игра завершена');
    }
    
    /**
     * Сохраняет результат игры
     */
    async saveGameResult() {
        if (!this.gameLogic) return;
        
        const stats = this.gameLogic.getStats();
        const playerName = await storage.getPlayerName();
        
        const result = {
            playerName,
            score: stats.score,
            rounds: stats.totalQuestions,
            totalTimeSec: stats.totalTimeSec,
            totalTimeWithPenalty: stats.totalTimeWithPenalty,
            bestStreak: stats.bestStreak,
            timestamp: Date.now()
        };
        
        try {
            await storage.saveResult(result);
            console.log('GameScreen: результат сохранен', result);
        } catch (error) {
            console.error('GameScreen: ошибка сохранения результата', error);
            showToast('Не удалось сохранить результат', 'error', 2000);
        }
    }
    
    /**
     * Воспроизводит звук и вибрацию для клика
     */
    playClickFeedback() {
        if (this.soundManager) {
            this.soundManager.playClick();
        }
        if (this.vibrationManager) {
            this.vibrationManager.playClick();
        }
    }
    
    /**
     * Воспроизводит feedback для правильного ответа
     */
    playCorrectFeedback() {
        if (this.soundManager) {
            this.soundManager.playCorrect();
        }
        if (this.vibrationManager) {
            this.vibrationManager.playCorrect();
        }
    }
    
    /**
     * Воспроизводит feedback для неправильного ответа
     */
    playIncorrectFeedback() {
        if (this.soundManager) {
            this.soundManager.playIncorrect();
        }
        if (this.vibrationManager) {
            this.vibrationManager.playIncorrect();
        }
    }
    
    /**
     * Запрашивает полноэкранный режим на мобильных устройствах
     */
    requestFullscreenOnMobile() {
        // Только для мобильных устройств
        if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return;
        }
        
        // Запрос полноэкранного режима при взаимодействии с пользователем
        const requestFullscreen = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {
                    // Игнорируем ошибки
                });
            }
        };
        
        // Запрашиваем после первого взаимодействия
        document.addEventListener('click', requestFullscreen, { once: true });
    }
    
    /**
     * Показывает игровой экран
     */
    show() {
        const screenManager = getScreenManager();
        screenManager.show(SCREEN_IDS.GAME);
        console.log('GameScreen: показан');
    }
    
    /**
     * Скрывает игровой экран
     */
    hide() {
        const screenManager = getScreenManager();
        screenManager.hide(SCREEN_IDS.GAME);
        console.log('GameScreen: скрыт');
    }
    
    /**
     * Уничтожает экран (удаляет обработчики)
     */
    destroy() {
        if (!this.elements) return;
        
        const { backBtn, fullscreenBtn } = this.elements;
        
        backBtn.removeEventListener('click', this.handleBackClick);
        fullscreenBtn.removeEventListener('click', this.handleFullscreenClick);
        
        document.removeEventListener('keydown', this.handlePhysicalKeyboard);
        document.removeEventListener('keydown', this.handleEscapeKey);
        
        if (this.keypad) {
            this.keypad.destroy();
        }
        
        if (this.timer) {
            this.timer.stop();
        }
        
        this.isInitialized = false;
        console.log('GameScreen: уничтожен');
    }
}

// Синглтон экземпляр
let instance = null;

/**
 * Инициализирует игровой экран
 * @param {Object} options
 * @param {Function} options.onGameFinish - колбэк при завершении игры
 * @param {Function} options.onBackToMenu - колбэк при возврате в меню
 * @returns {GameScreen} экземпляр экрана
 */
export function initGameScreen(options = {}) {
    if (!instance) {
        instance = new GameScreen();
    }
    return instance.init(options);
}

/**
 * Получает экземпляр игрового экрана (если уже инициализирован)
 * @returns {GameScreen|null}
 */
export function getGameScreen() {
    return instance;
}

/**
 * Начинает новую игру
 * @param {number} rounds - количество вопросов
 * @param {string} playerName - имя игрока
 */
export async function startGame(rounds, playerName) {
    if (instance) {
        await instance.startGame(rounds, playerName);
    } else {
        console.warn('GameScreen: экземпляр не инициализирован');
    }
}

/**
 * Показывает игровой экран
 */
export function showGameScreen() {
    if (instance) {
        instance.show();
    } else {
        console.warn('GameScreen: экземпляр не инициализирован');
    }
}

/**
 * Скрывает игровой экран
 */
export function hideGameScreen() {
    if (instance) {
        instance.hide();
    }
}

/**
 * Завершает текущую игру
 * @param {boolean} forced - принудительное завершение
 */
export async function finishGame(forced = false) {
    if (instance) {
        await instance.finishGame(forced);
    }
}