// Менеджер настроек приложения
import * as storage from '../data/storage.js';

export class SettingsManager {
    constructor() {
        this.settings = {
            sound: true,
            vibration: true,
            theme: false, // false = светлая, true = темная
            rounds: 20
        };
        
        this.listeners = {
            sound: [],
            vibration: [],
            theme: [],
            rounds: []
        };
        
        this.isInitialized = false;
    }
    
    /**
     * Инициализирует менеджер настроек
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // Загружаем настройки из хранилища
            this.settings.sound = await storage.getSoundEnabled();
            this.settings.vibration = await storage.getVibrationEnabled();
            this.settings.theme = await storage.getTheme();
            this.settings.rounds = await storage.getSelectedRounds();
            
            this.isInitialized = true;
            console.log('SettingsManager: инициализирован', this.settings);
        } catch (error) {
            console.error('SettingsManager: ошибка инициализации:', error);
            // Используем значения по умолчанию
        }
    }
    
    /**
     * Получает значение настройки
     * @param {string} key - ключ настройки
     * @returns {any} значение
     */
    get(key) {
        if (!(key in this.settings)) {
            console.warn(`SettingsManager: неизвестная настройка "${key}"`);
            return null;
        }
        
        return this.settings[key];
    }
    
    /**
     * Устанавливает значение настройки
     * @param {string} key - ключ настройки
     * @param {any} value - значение
     * @param {boolean} saveImmediately - сохранить немедленно в хранилище
     * @returns {Promise<void>}
     */
    async set(key, value, saveImmediately = true) {
        if (!(key in this.settings)) {
            console.warn(`SettingsManager: неизвестная настройка "${key}"`);
            return;
        }
        
        const oldValue = this.settings[key];
        
        // Проверяем, изменилось ли значение
        if (oldValue === value) {
            return;
        }
        
        // Устанавливаем новое значение
        this.settings[key] = value;
        
        // Сохраняем в хранилище, если требуется
        if (saveImmediately) {
            await this.saveToStorage(key, value);
        }
        
        // Вызываем слушателей
        this.notifyListeners(key, value, oldValue);
        
        console.log(`SettingsManager: настройка "${key}" изменена:`, { oldValue, newValue: value });
    }
    
    /**
     * Сохраняет настройку в хранилище
     * @param {string} key 
     * @param {any} value 
     */
    async saveToStorage(key, value) {
        try {
            switch (key) {
                case 'sound':
                    await storage.setSoundEnabled(value);
                    break;
                case 'vibration':
                    await storage.setVibrationEnabled(value);
                    break;
                case 'theme':
                    await storage.setTheme(value);
                    break;
                case 'rounds':
                    await storage.setSelectedRounds(value);
                    break;
                default:
                    console.warn(`SettingsManager: неизвестный ключ для сохранения "${key}"`);
            }
        } catch (error) {
            console.error(`SettingsManager: ошибка сохранения настройки "${key}":`, error);
        }
    }
    
    /**
     * Добавляет слушатель изменений настройки
     * @param {string} key - ключ настройки
     * @param {Function} callback - функция-обработчик
     */
    addListener(key, callback) {
        if (!(key in this.listeners)) {
            console.warn(`SettingsManager: неизвестный ключ для слушателя "${key}"`);
            return;
        }
        
        if (typeof callback !== 'function') {
            console.warn('SettingsManager: callback должен быть функцией');
            return;
        }
        
        this.listeners[key].push(callback);
    }
    
    /**
     * Удаляет слушатель
     * @param {string} key - ключ настройки
     * @param {Function} callback - функция-обработчик
     */
    removeListener(key, callback) {
        if (!(key in this.listeners)) {
            return;
        }
        
        const index = this.listeners[key].indexOf(callback);
        if (index !== -1) {
            this.listeners[key].splice(index, 1);
        }
    }
    
    /**
     * Уведомляет слушателей об изменении настройки
     * @param {string} key - ключ настройки
     * @param {any} newValue - новое значение
     * @param {any} oldValue - старое значение
     */
    notifyListeners(key, newValue, oldValue) {
        if (!(key in this.listeners)) {
            return;
        }
        
        this.listeners[key].forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error(`SettingsManager: ошибка в обработчике настройки "${key}":`, error);
            }
        });
    }
    
    /**
     * Получает все настройки
     * @returns {Object} объект с настройками
     */
    getAll() {
        return { ...this.settings };
    }
    
    /**
     * Сбрасывает настройки к значениям по умолчанию
     * @returns {Promise<void>}
     */
    async resetToDefaults() {
        const defaults = {
            sound: true,
            vibration: true,
            theme: false,
            rounds: 20
        };
        
        for (const [key, value] of Object.entries(defaults)) {
            await this.set(key, value, true);
        }
        
        console.log('SettingsManager: сброшены настройки по умолчанию');
    }
    
    /**
     * Применяет тему к документу
     */
    applyTheme() {
        const isDark = this.settings.theme;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Сохраняем в localStorage для быстрого применения при загрузке
        localStorage.setItem('preferred-theme', isDark ? 'dark' : 'light');
        
        console.log(`SettingsManager: применена ${isDark ? 'темная' : 'светлая'} тема`);
    }
    
    /**
     * Переключает тему
     * @returns {Promise<void>}
     */
    async toggleTheme() {
        const newTheme = !this.settings.theme;
        await this.set('theme', newTheme);
        this.applyTheme();
    }
    
    /**
     * Переключает звук
     * @returns {Promise<void>}
     */
    async toggleSound() {
        const newSound = !this.settings.sound;
        await this.set('sound', newSound);
    }
    
    /**
     * Переключает вибрацию
     * @returns {Promise<void>}
     */
    async toggleVibration() {
        const newVibration = !this.settings.vibration;
        await this.set('vibration', newVibration);
    }
    
    /**
     * Устанавливает количество вопросов
     * @param {number} rounds 
     * @returns {Promise<void>}
     */
    async setRounds(rounds) {
        if (rounds < 5 || rounds > 50) {
            console.warn(`SettingsManager: некорректное количество вопросов: ${rounds}`);
            return;
        }
        
        await this.set('rounds', rounds);
    }
}

// Создаем и экспортируем глобальный экземпляр
let settingsManagerInstance = null;

/**
 * Получает или создает экземпляр SettingsManager
 * @returns {Promise<SettingsManager>}
 */
export async function getSettingsManager() {
    if (!settingsManagerInstance) {
        settingsManagerInstance = new SettingsManager();
        await settingsManagerInstance.init();
    }
    return settingsManagerInstance;
}

/**
 * Получает значение настройки
 * @param {string} key 
 * @returns {Promise<any>}
 */
export async function getSetting(key) {
    const manager = await getSettingsManager();
    return manager.get(key);
}

/**
 * Устанавливает значение настройки
 * @param {string} key 
 * @param {any} value 
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
    const manager = await getSettingsManager();
    await manager.set(key, value);
}

/**
 * Добавляет слушатель изменений настройки
 * @param {string} key 
 * @param {Function} callback 
 * @returns {Promise<void>}
 */
export async function addSettingListener(key, callback) {
    const manager = await getSettingsManager();
    manager.addListener(key, callback);
}

/**
 * Применяет текущую тему к документу
 * @returns {Promise<void>}
 */
export async function applyCurrentTheme() {
    const manager = await getSettingsManager();
    manager.applyTheme();
}