// Менеджер управления видимостью экранов
import { SCREEN_IDS } from '../utils/constants.js';

export class ScreenManager {
    constructor() {
        this.screens = new Map();
        this.currentScreen = null;
        this.initializeScreens();
    }

    /**
     * Инициализирует все экраны из DOM
     */
    initializeScreens() {
        // Собираем все экраны по их ID
        Object.values(SCREEN_IDS).forEach(screenId => {
            const element = document.getElementById(screenId);
            if (element) {
                this.screens.set(screenId, element);
            } else {
                console.warn(`Экран с ID "${screenId}" не найден в DOM`);
            }
        });

        console.log(`ScreenManager: загружено ${this.screens.size} экранов`);
    }

    /**
     * Показывает указанный экран, скрывая все остальные
     * @param {string} screenId - ID экрана из SCREEN_IDS
     * @returns {boolean} успешность операции
     */
    show(screenId) {
        const screenElement = this.screens.get(screenId);
        
        if (!screenElement) {
            console.error(`Экран "${screenId}" не найден`);
            return false;
        }

        // Скрываем все экраны
        this.hideAll();

        // Показываем целевой экран
        screenElement.classList.remove('hidden');
        this.currentScreen = screenId;

        console.log(`ScreenManager: показан экран "${screenId}"`);

        // Вызываем событие смены экрана
        this.dispatchScreenChangeEvent(screenId, screenElement);

        return true;
    }

    /**
     * Скрывает все экраны
     */
    hideAll() {
        this.screens.forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    /**
     * Получает DOM-элемент экрана по ID
     * @param {string} screenId 
     * @returns {HTMLElement|null}
     */
    getScreenElement(screenId) {
        return this.screens.get(screenId) || null;
    }

    /**
     * Получает ID текущего экрана
     * @returns {string|null}
     */
    getCurrentScreenId() {
        return this.currentScreen;
    }

    /**
     * Проверяет, является ли экран видимым
     * @param {string} screenId 
     * @returns {boolean}
     */
    isScreenVisible(screenId) {
        const screen = this.screens.get(screenId);
        return screen ? !screen.classList.contains('hidden') : false;
    }

    /**
     * Переключает видимость экрана
     * @param {string} screenId 
     * @returns {boolean} новое состояние видимости
     */
    toggleScreen(screenId) {
        const screen = this.screens.get(screenId);
        if (!screen) return false;

        if (this.isScreenVisible(screenId)) {
            screen.classList.add('hidden');
            this.currentScreen = null;
            return false;
        } else {
            this.show(screenId);
            return true;
        }
    }

    /**
     * Вызывает событие смены экрана
     * @param {string} screenId 
     * @param {HTMLElement} screenElement 
     */
    dispatchScreenChangeEvent(screenId, screenElement) {
        const event = new CustomEvent('screenchange', {
            detail: {
                screenId,
                screenElement,
                previousScreen: this.currentScreen
            },
            bubbles: true
        });
        
        screenElement.dispatchEvent(event);
        document.dispatchEvent(event);
    }

    /**
     * Добавляет слушатель события смены экрана
     * @param {Function} callback 
     */
    onScreenChange(callback) {
        document.addEventListener('screenchange', callback);
    }

    /**
     * Удаляет слушатель события смены экрана
     * @param {Function} callback 
     */
    offScreenChange(callback) {
        document.removeEventListener('screenchange', callback);
    }
}

// Создаем и экспортируем глобальный экземпляр
let screenManagerInstance = null;

/**
 * Получает или создает экземпляр ScreenManager
 * @returns {ScreenManager}
 */
export function getScreenManager() {
    if (!screenManagerInstance) {
        screenManagerInstance = new ScreenManager();
    }
    return screenManagerInstance;
}

/**
 * Показывает экран (удобная функция для быстрого доступа)
 * @param {string} screenId 
 */
export function showScreen(screenId) {
    const manager = getScreenManager();
    return manager.show(screenId);
}

/**
 * Получает текущий экран
 * @returns {string|null}
 */
export function getCurrentScreen() {
    const manager = getScreenManager();
    return manager.getCurrentScreenId();
}

// Экспортируем константы для удобства
export { SCREEN_IDS };