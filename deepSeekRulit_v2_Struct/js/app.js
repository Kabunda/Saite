// Основная точка входа приложения
// Импортирует все модули и инициализирует приложение

import { getScreenManager, showScreen, SCREEN_IDS } from './screens/screenManager.js';
import { getModalManager } from './ui/modal.js';
import { getSettingsManager, applyCurrentTheme } from './settings/settingsManager.js';
import { getSoundManager } from './media/sound.js';
import { getVibrationManager } from './media/vibration.js';
import * as storage from './data/storage.js';
import { showToast } from './utils/dom.js';

// Импорты для экранов
import { initNameScreen } from './screens/nameScreen.js';
import { initMenuScreen } from './screens/menuScreen.js';
import { initGameScreen } from './screens/gameScreen.js';
import { initResultScreen } from './screens/resultScreen.js';

class MultiplicationTrainerApp {
    constructor() {
        this.screenManager = null;
        this.modalManager = null;
        this.settingsManager = null;
        this.soundManager = null;
        this.vibrationManager = null;
        
        // Экранные модули
        this.nameScreen = null;
        this.menuScreen = null;
        this.gameScreen = null;
        this.resultScreen = null;
        
        this.isInitialized = false;
        this.isLoading = false;
        
        // Состояние приложения
        this.state = {
            playerName: 'Игрок',
            currentGame: null,
            leaderboard: null
        };
    }
    
    /**
     * Инициализирует приложение
     */
    async init() {
        if (this.isInitialized || this.isLoading) {
            console.warn('App: уже инициализируется или инициализировано');
            return;
        }
        
        this.isLoading = true;
        console.log('App: начата инициализация...');
        
        try {
            // 1. Инициализируем менеджеры
            await this.initManagers();
            
            // 2. Загружаем начальные данные
            await this.loadInitialData();
            
            // 3. Настраиваем обработчики событий
            this.setupEventHandlers();
            
            // 4. Инициализируем экраны
            await this.initScreens();
            
            // 5. Применяем тему
            await applyCurrentTheme();
            
            // 6. Показываем начальный экран
            await this.showInitialScreen();
            
            this.isInitialized = true;
            this.isLoading = false;
            
            console.log('App: успешно инициализировано');
            showToast('Приложение готово!', 'success', 2000);
            
        } catch (error) {
            this.isLoading = false;
            console.error('App: ошибка инициализации:', error);
            showToast('Ошибка инициализации приложения', 'error', 3000);
            
            // Показываем экран ошибки или fallback
            this.showErrorScreen(error);
        }
    }
    
    /**
     * Инициализирует менеджеры
     */
    async initManagers() {
        console.log('App: инициализация менеджеров...');
        
        // Screen Manager
        this.screenManager = getScreenManager();
        
        // Modal Manager
        this.modalManager = getModalManager();
        
        // Settings Manager
        this.settingsManager = await getSettingsManager();
        
        // Sound Manager
        this.soundManager = await getSoundManager();
        
        // Vibration Manager
        this.vibrationManager = await getVibrationManager();
        
        console.log('App: менеджеры инициализированы');
    }
    
    /**
     * Загружает начальные данные
     */
    async loadInitialData() {
        console.log('App: загрузка начальных данных...');
        
        // Загружаем имя игрока
        this.state.playerName = await storage.getPlayerName();
        
        // Загружаем таблицу лидеров (асинхронно, не блокируем запуск)
        this.loadLeaderboardAsync();
        
        // Синхронизируем офлайн-результаты
        this.syncOfflineResultsAsync();
        
        console.log('App: начальные данные загружены');
    }
    
    /**
     * Асинхронно загружает таблицу лидеров
     */
    async loadLeaderboardAsync() {
        try {
            this.state.leaderboard = await storage.getLeaderboard();
            console.log('App: таблица лидеров загружена', 
                this.state.leaderboard ? `(${this.state.leaderboard.length} записей)` : '(недоступна)');
        } catch (error) {
            console.warn('App: не удалось загрузить таблицу лидеров:', error);
            this.state.leaderboard = null;
        }
    }
    
    /**
     * Асинхронно синхронизирует офлайн-результаты
     */
    async syncOfflineResultsAsync() {
        try {
            const syncedCount = await storage.syncOfflineResults();
            if (syncedCount > 0) {
                console.log(`App: синхронизировано ${syncedCount} офлайн-результатов`);
                showToast(`Синхронизировано ${syncedCount} результатов`, 'info', 2000);
                
                // Обновляем таблицу лидеров после синхронизации
                this.loadLeaderboardAsync();
            }
        } catch (error) {
            console.warn('App: ошибка синхронизации офлайн-результатов:', error);
        }
    }
    
    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        console.log('App: настройка обработчиков событий...');
        
        // Глобальные обработчики клавиатуры
        this.setupGlobalKeyboardHandlers();
        
        // Обработчики изменения сети
        this.setupNetworkHandlers();
        
        // Обработчики изменения настроек
        this.setupSettingsHandlers();
        
        console.log('App: обработчики событий настроены');
    }
    
    /**
     * Настраивает глобальные обработчики клавиатуры
     */
    setupGlobalKeyboardHandlers() {
        document.addEventListener('keydown', (event) => {
            // Escape для возврата в меню
            if (event.key === 'Escape') {
                this.handleEscapeKey();
            }
            
            // F11 для полноэкранного режима
            if (event.key === 'F11') {
                event.preventDefault();
                this.toggleFullscreen();
            }
            
            // Ctrl+S для сохранения (отладка)
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                this.saveDebugInfo();
            }
        });
    }
    
    /**
     * Настраивает обработчики изменения сети
     */
    setupNetworkHandlers() {
        window.addEventListener('online', () => {
            console.log('App: соединение восстановлено');
            showToast('Соединение восстановлено', 'success', 2000);
            
            // Синхронизируем офлайн-результаты
            this.syncOfflineResultsAsync();
        });
        
        window.addEventListener('offline', () => {
            console.log('App: потеряно соединение');
            showToast('Работаем в офлайн-режиме', 'warning', 3000);
        });
    }
    
    /**
     * Настраивает обработчики изменения настроек
     */
    setupSettingsHandlers() {
        if (!this.settingsManager) return;
        
        // Обработчик изменения темы
        this.settingsManager.addListener('theme', (newValue) => {
            console.log(`App: тема изменена на ${newValue ? 'темную' : 'светлую'}`);
            this.applyTheme(newValue);
        });
        
        // Обработчик изменения звука
        this.settingsManager.addListener('sound', (newValue) => {
            console.log(`App: звук ${newValue ? 'включен' : 'выключен'}`);
            if (this.soundManager) {
                this.soundManager.setEnabled(newValue);
            }
        });
        
        // Обработчик изменения вибрации
        this.settingsManager.addListener('vibration', (newValue) => {
            console.log(`App: вибрация ${newValue ? 'включена' : 'выключена'}`);
            if (this.vibrationManager) {
                this.vibrationManager.setEnabled(newValue);
            }
        });
    }
    
    /**
     * Инициализирует экраны
     */
    async initScreens() {
        console.log('App: инициализация экранов...');
        
        // Инициализируем экран ввода имени
        this.nameScreen = await initNameScreen(() => {
            // После успешного ввода имени переходим в меню
            this.menuScreen.show();
        });
        
        // Инициализируем главное меню
        this.menuScreen = await initMenuScreen({
            onStartGame: (rounds) => {
                // Начинаем игру с выбранным количеством вопросов
                this.startGame(rounds);
            },
            onEditName: () => {
                // Показываем экран редактирования имени (через модальное окно)
                this.nameScreen.show();
            }
        });
        
        // Инициализируем игровой экран
        this.gameScreen = await initGameScreen({
            onGameFinish: (gameStats) => {
                // Игра завершена, показываем результаты
                this.showGameResults(gameStats);
            },
            onBackToMenu: () => {
                // Возврат в меню
                this.menuScreen.show();
            }
        });
        
        // Инициализируем экран результатов
        this.resultScreen = await initResultScreen({
            onPlayAgain: () => {
                // Играть снова с теми же настройками
                const rounds = this.menuScreen.getSelectedRounds();
                this.startGame(rounds);
            },
            onBackToMenu: () => {
                // Возврат в меню
                this.menuScreen.show();
            }
        });
        
        console.log('App: экраны инициализированы');
    }
    
    /**
     * Показывает начальный экран
     */
    async showInitialScreen() {
        console.log('App: показ начального экрана...');
        
        // Проверяем, есть ли сохраненное имя игрока
        const playerName = await storage.getPlayerName();
        
        if (!playerName || playerName === 'Игрок') {
            // Показываем экран ввода имени
            if (this.nameScreen) {
                this.nameScreen.show();
            } else {
                // Fallback: используем screenManager
                showScreen(SCREEN_IDS.NAME_INPUT);
            }
        } else {
            // Показываем главное меню
            if (this.menuScreen) {
                this.menuScreen.show();
            } else {
                // Fallback: используем screenManager
                showScreen(SCREEN_IDS.MENU);
            }
        }
        
        console.log('App: начальный экран показан');
    }
    
    /**
     * Обрабатывает нажатие Escape
     */
    handleEscapeKey() {
        const currentScreen = this.screenManager.getCurrentScreenId();
        
        switch (currentScreen) {
            case SCREEN_IDS.GAME:
                // Выход из игры в меню
                this.showConfirmationModal(
                    'Выйти из игры?',
                    'Текущий прогресс будет потерян.',
                    () => {
                        showScreen(SCREEN_IDS.MENU);
                    }
                );
                break;
                
            case SCREEN_IDS.RESULT:
                // Возврат в меню
                showScreen(SCREEN_IDS.MENU);
                break;
                
            default:
                // Закрыть модальное окно, если открыто
                if (this.modalManager.getCurrentModal()) {
                    this.modalManager.closeCurrent();
                }
                break;
        }
    }
    
    /**
     * Переключает полноэкранный режим
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('App: ошибка перехода в полноэкранный режим:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Применяет тему
     * @param {boolean} isDark - true для темной темы
     */
    applyTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
    
    /**
     * Показывает модальное окно подтверждения
     * @param {string} title - заголовок
     * @param {string} message - сообщение
     * @param {Function} onConfirm - обработчик подтверждения
     */
    showConfirmationModal(title, message, onConfirm) {
        // TODO: Реализовать универсальное модальное окно подтверждения
        const confirmed = confirm(`${title}\n\n${message}`);
        if (confirmed && onConfirm) {
            onConfirm();
        }
    }
    
    /**
     * Сохраняет отладочную информацию
     */
    saveDebugInfo() {
        const debugInfo = {
            appState: this.state,
            settings: this.settingsManager ? this.settingsManager.getAll() : null,
            storageStatus: storage.getStorageStatus(),
            timestamp: Date.now()
        };
        
        console.log('App: отладочная информация:', debugInfo);
        showToast('Отладочная информация сохранена в консоли', 'info', 2000);
    }
    
    /**
     * Показывает экран ошибки
     * @param {Error} error - ошибка
     */
    showErrorScreen(error) {
        // TODO: Реализовать экран ошибки
        console.error('App: критическая ошибка:', error);
        
        // Fallback: показываем меню
        if (this.screenManager) {
            showScreen(SCREEN_IDS.MENU);
        }
    }
    
    /**
     * Получает состояние приложения
     * @returns {Object}
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Обновляет состояние приложения
     * @param {Object} newState - новое состояние
     */
    updateState(newState) {
        this.state = { ...this.state, ...newState };
    }
    
    /**
     * Начинает новую игру
     * @param {number} rounds - количество вопросов
     */
    async startGame(rounds) {
        console.log(`App: начало игры, ${rounds} вопросов`);
        
        const playerName = await storage.getPlayerName();
        
        if (this.gameScreen) {
            await this.gameScreen.startGame(rounds, playerName);
        } else {
            console.error('App: игровой экран не инициализирован');
        }
    }
    
    /**
     * Показывает результаты игры
     * @param {Object} gameStats - статистика игры
     */
    async showGameResults(gameStats) {
        console.log('App: показ результатов игры', gameStats);
        
        const playerName = await storage.getPlayerName();
        
        // Получаем лог ответов из gameLogic (пока заглушка)
        const answersLog = gameStats.answersLog || [];
        
        if (this.resultScreen) {
            await this.resultScreen.showResults(gameStats, playerName, answersLog);
        } else {
            console.error('App: экран результатов не инициализирован');
        }
    }
    
    /**
     * Получает менеджер экранов
     * @returns {ScreenManager}
     */
    getScreenManager() {
        return this.screenManager;
    }
    
    /**
     * Получает менеджер модальных окон
     * @returns {ModalManager}
     */
    getModalManager() {
        return this.modalManager;
    }
    
    /**
     * Получает менеджер настроек
     * @returns {SettingsManager}
     */
    getSettingsManager() {
        return this.settingsManager;
    }
    
    /**
     * Получает менеджер звука
     * @returns {SoundManager}
     */
    getSoundManager() {
        return this.soundManager;
    }
    
    /**
     * Получает менеджер вибрации
     * @returns {VibrationManager}
     */
    getVibrationManager() {
        return this.vibrationManager;
    }
}

// Создаем и экспортируем глобальный экземпляр приложения
let appInstance = null;

/**
 * Получает или создает экземпляр приложения
 * @returns {MultiplicationTrainerApp}
 */
export function getApp() {
    if (!appInstance) {
        appInstance = new MultiplicationTrainerApp();
    }
    return appInstance;
}

/**
 * Инициализирует приложение
 * @returns {Promise<void>}
 */
export async function initApp() {
    const app = getApp();
    await app.init();
}

/**
 * Получает текущее состояние приложения
 * @returns {Object}
 */
export function getAppState() {
    const app = getApp();
    return app.getState();
}

// Экспортируем утилиты для удобства
export { showScreen, SCREEN_IDS } from './screens/screenManager.js';
export { showToast } from './utils/dom.js';

// Инициализируем приложение при загрузке модуля
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('App: DOM загружен, начинаем инициализацию...');
        initApp().catch(error => {
            console.error('App: ошибка при инициализации:', error);
        });
    });
} else {
    // DOM уже загружен
    console.log('App: DOM уже загружен, начинаем инициализацию...');
    initApp().catch(error => {
        console.error('App: ошибка при инициализации:', error);
    });
}