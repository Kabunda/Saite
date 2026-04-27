// Модуль главного меню
import * as storage from '../data/storage.js';
import { showToast, escapeHtml } from '../utils/dom.js';
import { SCREEN_IDS, DEFAULT_ROUNDS } from '../utils/constants.js';
import { getScreenManager } from './screenManager.js';
import { getModalManager } from '../ui/modal.js';
import { getSettingsManager } from '../settings/settingsManager.js';
import { getSoundManager } from '../media/sound.js';
import { getVibrationManager } from '../media/vibration.js';

class MenuScreen {
    constructor() {
        this.playerName = '';
        this.selectedRounds = DEFAULT_ROUNDS;
        this.leaderboard = null;
        this.onStartGameCallback = null;
        this.onEditNameCallback = null;
        this.isInitialized = false;
        
        // DOM элементы
        this.elements = null;
        
        // Привязка контекста
        this.handleStartClick = this.handleStartClick.bind(this);
        this.handleSettingsClick = this.handleSettingsClick.bind(this);
        this.handleEditNameClick = this.handleEditNameClick.bind(this);
        this.handleRoundsClick = this.handleRoundsClick.bind(this);
        this.handleThemeToggle = this.handleThemeToggle.bind(this);
        this.handleFullscreenClick = this.handleFullscreenClick.bind(this);
    }
    
    /**
     * Инициализирует экран меню
     * @param {Object} options
     * @param {Function} options.onStartGame - колбэк при начале игры
     * @param {Function} options.onEditName - колбэк при редактировании имени
     * @returns {MenuScreen} экземпляр экрана
     */
    init(options = {}) {
        if (this.isInitialized) {
            console.warn('MenuScreen: уже инициализирован');
            return this;
        }
        
        this.onStartGameCallback = options.onStartGame || null;
        this.onEditNameCallback = options.onEditName || null;
        
        this.loadElements();
        this.setupEventHandlers();
        this.isInitialized = true;
        
        console.log('MenuScreen: инициализирован');
        return this;
    }
    
    /**
     * Загружает DOM элементы
     */
    loadElements() {
        this.elements = {
            menuScreen: document.getElementById('menuScreen'),
            startBtn: document.getElementById('startBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            editNameBtn: document.getElementById('editNameBtn'),
            themeToggle: document.getElementById('themeToggle'),
            currentPlayerName: document.getElementById('currentPlayerName'),
            leaderboardBody: document.getElementById('leaderboardBody'),
            roundsSubtitle: document.getElementById('roundsSubtitle'),
            roundsButtons: document.querySelectorAll('.rounds-btn'),
            fullscreenBtn: document.getElementById('fullscreenBtn')
        };
        
        if (!this.elements.menuScreen) {
            console.error('MenuScreen: не найден элемент меню');
        }
    }
    
    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        if (!this.elements) return;
        
        const { startBtn, settingsBtn, editNameBtn, themeToggle, roundsButtons, fullscreenBtn } = this.elements;
        
        startBtn.addEventListener('click', this.handleStartClick);
        settingsBtn.addEventListener('click', this.handleSettingsClick);
        editNameBtn.addEventListener('click', this.handleEditNameClick);
        
        if (themeToggle) {
            themeToggle.addEventListener('change', this.handleThemeToggle);
        }
        
        if (roundsButtons) {
            roundsButtons.forEach(btn => {
                btn.addEventListener('click', this.handleRoundsClick);
            });
        }
        
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.handleFullscreenClick);
        }
        
        // Обработчики для модальных окон уже настроены в modal.js
    }
    
    /**
     * Обрабатывает клик по кнопке "Начать игру"
     */
    handleStartClick() {
        if (this.onStartGameCallback) {
            this.onStartGameCallback(this.selectedRounds);
        } else {
            console.warn('MenuScreen: колбэк onStartGame не установлен');
        }
    }
    
    /**
     * Обрабатывает клик по кнопке настроек
     */
    handleSettingsClick() {
        const modalManager = getModalManager();
        if (modalManager) {
            modalManager.open('settingsModal');
        } else {
            console.warn('MenuScreen: modalManager не доступен');
        }
    }
    
    /**
     * Обрабатывает клик по кнопке редактирования имени
     */
    handleEditNameClick() {
        if (this.onEditNameCallback) {
            this.onEditNameCallback();
        } else {
            // Открываем модальное окно редактирования имени
            const modalManager = getModalManager();
            if (modalManager) {
                modalManager.open('editNameModal');
            }
        }
    }
    
    /**
     * Обрабатывает клик по кнопке выбора количества вопросов
     * @param {Event} event
     */
    handleRoundsClick(event) {
        const rounds = parseInt(event.target.dataset.rounds);
        if (isNaN(rounds) || rounds < 5 || rounds > 50) {
            console.warn('MenuScreen: некорректное количество вопросов', rounds);
            return;
        }
        
        this.setSelectedRounds(rounds);
        
        // Визуальное выделение активной кнопки
        const { roundsButtons } = this.elements;
        if (roundsButtons) {
            roundsButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
        }
        
        // Обновляем подзаголовок
        this.updateRoundsSubtitle();
        
        // Сохраняем настройку
        storage.setSelectedRounds(rounds).catch(err => {
            console.warn('MenuScreen: не удалось сохранить количество вопросов', err);
        });
    }
    
    /**
     * Обрабатывает переключение темы
     * @param {Event} event
     */
    handleThemeToggle(event) {
        const isDark = event.target.checked;
        const settingsManager = getSettingsManager();
        if (settingsManager) {
            settingsManager.set('theme', isDark);
        } else {
            // Fallback: напрямую в storage
            storage.setTheme(isDark).catch(err => {
                console.warn('MenuScreen: не удалось сохранить тему', err);
            });
        }
    }
    
    /**
     * Обрабатывает клик по кнопке полноэкранного режима
     */
    handleFullscreenClick() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('MenuScreen: не удалось перейти в полноэкранный режим', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Устанавливает выбранное количество вопросов
     * @param {number} rounds
     */
    setSelectedRounds(rounds) {
        this.selectedRounds = rounds;
        console.log(`MenuScreen: выбрано ${rounds} вопросов`);
    }
    
    /**
     * Обновляет подзаголовок с информацией о вопросах
     */
    updateRoundsSubtitle() {
        const { roundsSubtitle } = this.elements;
        if (!roundsSubtitle) return;
        
        roundsSubtitle.textContent = `${this.selectedRounds} вопросов: 5, 8, 11, 17, 35 × 2..20`;
    }
    
    /**
     * Обновляет отображение имени игрока
     * @param {string} name
     */
    updatePlayerName(name) {
        this.playerName = name;
        const { currentPlayerName } = this.elements;
        if (currentPlayerName) {
            currentPlayerName.textContent = escapeHtml(name);
        }
    }
    
    /**
     * Загружает и отображает таблицу лидеров
     */
    async loadLeaderboard() {
        try {
            this.leaderboard = await storage.getLeaderboard();
            this.renderLeaderboard();
        } catch (error) {
            console.warn('MenuScreen: не удалось загрузить таблицу лидеров', error);
            this.renderLeaderboardError();
        }
    }
    
    /**
     * Рендерит таблицу лидеров
     */
    renderLeaderboard() {
        const { leaderboardBody } = this.elements;
        if (!leaderboardBody) return;
        
        if (this.leaderboard === null) {
            this.renderLeaderboardError();
            return;
        }
        
        if (!this.leaderboard.length) {
            leaderboardBody.innerHTML = `<tr><td colspan="5">Пока нет результатов.</td></tr>`;
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        const html = this.leaderboard.slice(0, 10).map((item, idx) => {
            const penalty = item.rounds - item.score;
            const penaltyText = penalty > 0 ? ` (+${penalty * 5})` : '';
            const displayName = escapeHtml(item.playerName.substring(0, 12));
            const fullName = escapeHtml(item.playerName);
            const truncatedName = item.playerName.length > 12 ? `${displayName}…` : displayName;
            
            return `
            <tr>
                <td>${idx < 3 ? medals[idx] : idx + 1}</td>
                <td title="${fullName}">${truncatedName}</td>
                <td>${item.totalTimeSec.toFixed(1)} сек${penaltyText}</td>
                <td>${item.score}/${item.rounds}</td>
                <td>${item.bestStreak ?? '—'}</td>
            </tr>
            `;
        }).join('');
        
        leaderboardBody.innerHTML = html;
    }
    
    /**
     * Рендерит ошибку загрузки таблицы лидеров
     */
    renderLeaderboardError() {
        const { leaderboardBody } = this.elements;
        if (!leaderboardBody) return;
        
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="5" class="leaderboard-error">
                    ⚠️ Не удалось загрузить таблицу лидеров. Проверьте подключение к интернету.
                </td>
            </tr>
        `;
    }
    
    /**
     * Обновляет состояние меню (имя, тема, выбранные раунды)
     */
    async updateMenuStatus() {
        // Загружаем имя игрока
        try {
            const name = await storage.getPlayerName();
            this.updatePlayerName(name);
        } catch (error) {
            console.warn('MenuScreen: не удалось загрузить имя игрока', error);
        }
        
        // Загружаем выбранное количество вопросов
        try {
            const rounds = await storage.getSelectedRounds();
            this.setSelectedRounds(rounds);
            
            // Обновляем активную кнопку
            const { roundsButtons } = this.elements;
            if (roundsButtons) {
                roundsButtons.forEach(btn => {
                    const btnRounds = parseInt(btn.dataset.rounds);
                    btn.classList.toggle('active', btnRounds === rounds);
                });
            }
            
            this.updateRoundsSubtitle();
        } catch (error) {
            console.warn('MenuScreen: не удалось загрузить количество вопросов', error);
        }
        
        // Загружаем тему
        try {
            const themeDark = await storage.getTheme();
            const { themeToggle } = this.elements;
            if (themeToggle) {
                themeToggle.checked = themeDark;
            }
        } catch (error) {
            console.warn('MenuScreen: не удалось загрузить тему', error);
        }
        
        // Загружаем таблицу лидеров
        this.loadLeaderboard();
    }
    
    /**
     * Показывает экран меню
     */
    show() {
        const screenManager = getScreenManager();
        screenManager.show(SCREEN_IDS.MENU);
        
        // Обновляем состояние меню
        this.updateMenuStatus();
        
        console.log('MenuScreen: показан');
    }
    
    /**
     * Скрывает экран меню
     */
    hide() {
        const screenManager = getScreenManager();
        screenManager.hide(SCREEN_IDS.MENU);
        console.log('MenuScreen: скрыт');
    }
    
    /**
     * Получает выбранное количество вопросов
     * @returns {number}
     */
    getSelectedRounds() {
        return this.selectedRounds;
    }
    
    /**
     * Получает имя игрока
     * @returns {string}
     */
    getPlayerName() {
        return this.playerName;
    }
    
    /**
     * Устанавливает колбэк начала игры
     * @param {Function} callback
     */
    setOnStartGame(callback) {
        this.onStartGameCallback = callback;
    }
    
    /**
     * Устанавливает колбэк редактирования имени
     * @param {Function} callback
     */
    setOnEditName(callback) {
        this.onEditNameCallback = callback;
    }
    
    /**
     * Уничтожает экран (удаляет обработчики)
     */
    destroy() {
        if (!this.elements) return;
        
        const { startBtn, settingsBtn, editNameBtn, themeToggle, roundsButtons, fullscreenBtn } = this.elements;
        
        startBtn.removeEventListener('click', this.handleStartClick);
        settingsBtn.removeEventListener('click', this.handleSettingsClick);
        editNameBtn.removeEventListener('click', this.handleEditNameClick);
        
        if (themeToggle) {
            themeToggle.removeEventListener('change', this.handleThemeToggle);
        }
        
        if (roundsButtons) {
            roundsButtons.forEach(btn => {
                btn.removeEventListener('click', this.handleRoundsClick);
            });
        }
        
        if (fullscreenBtn) {
            fullscreenBtn.removeEventListener('click', this.handleFullscreenClick);
        }
        
        this.isInitialized = false;
        console.log('MenuScreen: уничтожен');
    }
}

// Синглтон экземпляр
let instance = null;

/**
 * Инициализирует экран меню
 * @param {Object} options
 * @param {Function} options.onStartGame - колбэк при начале игры
 * @param {Function} options.onEditName - колбэк при редактировании имени
 * @returns {MenuScreen} экземпляр экрана
 */
export function initMenuScreen(options = {}) {
    if (!instance) {
        instance = new MenuScreen();
    }
    return instance.init(options);
}

/**
 * Получает экземпляр экрана меню (если уже инициализирован)
 * @returns {MenuScreen|null}
 */
export function getMenuScreen() {
    return instance;
}

/**
 * Показывает экран меню
 */
export function showMenuScreen() {
    if (instance) {
        instance.show();
    } else {
        console.warn('MenuScreen: экземпляр не инициализирован');
    }
}

/**
 * Скрывает экран меню
 */
export function hideMenuScreen() {
    if (instance) {
        instance.hide();
    }
}

/**
 * Обновляет состояние меню (имя, тема, таблица лидеров)
 */
export function updateMenuStatus() {
    if (instance) {
        instance.updateMenuStatus();
    }
}

/**
 * Получает выбранное количество вопросов
 * @returns {number}
 */
export function getSelectedRounds() {
    return instance ? instance.getSelectedRounds() : DEFAULT_ROUNDS;
}

/**
 * Получает имя игрока из меню
 * @returns {string}
 */
export function getPlayerName() {
    return instance ? instance.getPlayerName() : '';
}