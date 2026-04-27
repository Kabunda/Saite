// Модуль экрана результатов
import * as storage from '../data/storage.js';
import { escapeHtml } from '../utils/dom.js';
import { SCREEN_IDS } from '../utils/constants.js';
import { getScreenManager } from './screenManager.js';

class ResultScreen {
    constructor() {
        this.isInitialized = false;
        this.onPlayAgainCallback = null;
        this.onBackToMenuCallback = null;
        
        // DOM элементы
        this.elements = null;
        
        // Привязка контекста
        this.handlePlayAgainClick = this.handlePlayAgainClick.bind(this);
        this.handleToMenuClick = this.handleToMenuClick.bind(this);
    }
    
    /**
     * Инициализирует экран результатов
     * @param {Object} options
     * @param {Function} options.onPlayAgain - колбэк при нажатии "Играть снова"
     * @param {Function} options.onBackToMenu - колбэк при нажатии "В главное меню"
     * @returns {ResultScreen} экземпляр экрана
     */
    init(options = {}) {
        if (this.isInitialized) {
            console.warn('ResultScreen: уже инициализирован');
            return this;
        }
        
        this.onPlayAgainCallback = options.onPlayAgain || null;
        this.onBackToMenuCallback = options.onBackToMenu || null;
        
        this.loadElements();
        this.setupEventHandlers();
        this.isInitialized = true;
        
        console.log('ResultScreen: инициализирован');
        return this;
    }
    
    /**
     * Загружает DOM элементы
     */
    loadElements() {
        this.elements = {
            resultScreen: document.getElementById('resultScreen'),
            resultSummary: document.getElementById('resultSummary'),
            timeScale: document.getElementById('timeScale'),
            timeScaleFill: document.querySelector('.time-scale-fill'),
            timeScaleText: document.querySelector('.time-scale-text'),
            answersList: document.getElementById('answersList'),
            playAgainBtn: document.getElementById('playAgainBtn'),
            toMenuBtn: document.getElementById('toMenuBtn')
        };
        
        if (!this.elements.resultScreen) {
            console.error('ResultScreen: не найден элемент экрана результатов');
        }
    }
    
    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        if (!this.elements) return;
        
        const { playAgainBtn, toMenuBtn } = this.elements;
        
        playAgainBtn.addEventListener('click', this.handlePlayAgainClick);
        toMenuBtn.addEventListener('click', this.handleToMenuClick);
    }
    
    /**
     * Обрабатывает клик по кнопке "Играть снова"
     */
    handlePlayAgainClick() {
        if (this.onPlayAgainCallback) {
            this.onPlayAgainCallback();
        } else {
            console.warn('ResultScreen: колбэк onPlayAgain не установлен');
        }
    }
    
    /**
     * Обрабатывает клик по кнопке "В главное меню"
     */
    handleToMenuClick() {
        if (this.onBackToMenuCallback) {
            this.onBackToMenuCallback();
        } else {
            console.warn('ResultScreen: колбэк onBackToMenu не установлен');
        }
    }
    
    /**
     * Показывает экран результатов с данными игры
     * @param {Object} gameStats - статистика игры
     * @param {string} playerName - имя игрока
     * @param {Array} answersLog - лог ответов
     */
    async showResults(gameStats, playerName, answersLog) {
        if (!this.elements) return;
        
        const {
            resultSummary,
            timeScale,
            timeScaleFill,
            timeScaleText,
            answersList
        } = this.elements;
        
        // Формируем текст результата
        const streakHtml = gameStats.bestStreak > 0 ? ` 🔥 Серия: ${gameStats.bestStreak}` : '';
        const mistakesCount = gameStats.totalQuestions - gameStats.score;
        const resultText = `${playerName}, результат: ${gameStats.score}/${gameStats.totalQuestions}. ` +
            `Время: ${gameStats.totalTimeSec.toFixed(1)} сек.${streakHtml} Ошибок: ${mistakesCount}.`;
        
        if (resultSummary) {
            resultSummary.textContent = resultText;
        }
        
        // Загружаем таблицу лидеров для сравнения с личным рекордом
        let leaderboard = null;
        try {
            leaderboard = await storage.getLeaderboard();
        } catch (error) {
            console.warn('ResultScreen: не удалось загрузить таблицу лидеров', error);
        }
        
        // Шкала времени относительно личного рекорда
        const personalBest = leaderboard && leaderboard.length > 0
            ? leaderboard.find(e => e.playerName === playerName)?.totalTimeSec
            : null;
        
        if (personalBest && personalBest > 0 && timeScale && timeScaleFill && timeScaleText) {
            timeScale.classList.remove('hidden');
            const pct = Math.min(100, (personalBest / gameStats.totalTimeSec) * 100);
            timeScaleFill.style.width = `${pct}%`;
            timeScaleText.textContent = `Ваш лучший: ${personalBest.toFixed(1)} сек`;
        } else if (timeScale) {
            timeScale.classList.add('hidden');
        }
        
        // Список вопросов и ответов
        if (answersList) {
            answersList.innerHTML = answersLog.map((item, idx) => {
                const status = item.isCorrect ? 'Верно' : 'Неверно';
                const className = item.isCorrect ? 'answer-ok' : 'answer-bad';
                return `
                    <li class="${className}">
                        ${idx + 1}) ${item.a} × ${item.b} = ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
                    </li>
                `;
            }).join('');
        }
        
        // Показываем экран
        this.show();
        
        console.log('ResultScreen: результаты показаны', gameStats);
    }
    
    /**
     * Показывает экран результатов
     */
    show() {
        const screenManager = getScreenManager();
        screenManager.show(SCREEN_IDS.RESULT);
        console.log('ResultScreen: показан');
    }
    
    /**
     * Скрывает экран результатов
     */
    hide() {
        const screenManager = getScreenManager();
        screenManager.hide(SCREEN_IDS.RESULT);
        console.log('ResultScreen: скрыт');
    }
    
    /**
     * Сбрасывает состояние экрана
     */
    reset() {
        const { resultSummary, timeScale, answersList } = this.elements;
        if (!resultSummary || !timeScale || !answersList) return;
        
        resultSummary.textContent = '';
        timeScale.classList.add('hidden');
        answersList.innerHTML = '';
    }
    
    /**
     * Уничтожает экран (удаляет обработчики)
     */
    destroy() {
        if (!this.elements) return;
        
        const { playAgainBtn, toMenuBtn } = this.elements;
        
        playAgainBtn.removeEventListener('click', this.handlePlayAgainClick);
        toMenuBtn.removeEventListener('click', this.handleToMenuClick);
        
        this.isInitialized = false;
        console.log('ResultScreen: уничтожен');
    }
}

// Синглтон экземпляр
let instance = null;

/**
 * Инициализирует экран результатов
 * @param {Object} options
 * @param {Function} options.onPlayAgain - колбэк при нажатии "Играть снова"
 * @param {Function} options.onBackToMenu - колбэк при нажатии "В главное меню"
 * @returns {ResultScreen} экземпляр экрана
 */
export function initResultScreen(options = {}) {
    if (!instance) {
        instance = new ResultScreen();
    }
    return instance.init(options);
}

/**
 * Получает экземпляр экрана результатов (если уже инициализирован)
 * @returns {ResultScreen|null}
 */
export function getResultScreen() {
    return instance;
}

/**
 * Показывает экран результатов с данными игры
 * @param {Object} gameStats - статистика игры
 * @param {string} playerName - имя игрока
 * @param {Array} answersLog - лог ответов
 */
export async function showResults(gameStats, playerName, answersLog) {
    if (instance) {
        await instance.showResults(gameStats, playerName, answersLog);
    } else {
        console.warn('ResultScreen: экземпляр не инициализирован');
    }
}

/**
 * Показывает экран результатов
 */
export function showResultScreen() {
    if (instance) {
        instance.show();
    } else {
        console.warn('ResultScreen: экземпляр не инициализирован');
    }
}

/**
 * Скрывает экран результатов
 */
export function hideResultScreen() {
    if (instance) {
        instance.hide();
    }
}

/**
 * Сбрасывает состояние экрана результатов
 */
export function resetResultScreen() {
    if (instance) {
        instance.reset();
    }
}