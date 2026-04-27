// Управление вибрацией
import { VIBRATION_PATTERNS } from '../utils/constants.js';
import { getSettingsManager } from '../settings/settingsManager.js';

export class VibrationManager {
    constructor() {
        this.isEnabled = true;
        this.isSupported = false;
        this.isInitialized = false;
        
        this.init();
    }
    
    /**
     * Инициализирует менеджер вибрации
     */
    async init() {
        // Проверяем поддержку вибрации
        this.isSupported = 'vibrate' in navigator;
        
        if (!this.isSupported) {
            console.warn('VibrationManager: вибрация не поддерживается в этом браузере');
            this.isInitialized = true;
            return;
        }
        
        // Проверяем настройки вибрации
        try {
            const settings = await getSettingsManager();
            this.isEnabled = settings.get('vibration');
            
            // Слушаем изменения настроек
            settings.addListener('vibration', (newValue) => {
                this.isEnabled = newValue;
                console.log(`VibrationManager: вибрация ${newValue ? 'включена' : 'выключена'}`);
            });
        } catch (error) {
            console.warn('VibrationManager: не удалось загрузить настройки, используем значение по умолчанию', error);
        }
        
        this.isInitialized = true;
        console.log('VibrationManager: инициализирован', {
            supported: this.isSupported,
            enabled: this.isEnabled
        });
    }
    
    /**
     * Проверяет, доступна ли вибрация
     * @returns {boolean}
     */
    isAvailable() {
        return this.isSupported && this.isEnabled;
    }
    
    /**
     * Вызывает вибрацию с заданным паттерном
     * @param {number|number[]} pattern - паттерн вибрации в миллисекундах
     * @returns {boolean} успешность выполнения
     */
    vibrate(pattern) {
        if (!this.isAvailable()) {
            return false;
        }
        
        try {
            // Если передано число, преобразуем в массив [время вибрации, пауза]
            if (typeof pattern === 'number') {
                pattern = [pattern];
            }
            
            // Проверяем, что паттерн является массивом чисел
            if (!Array.isArray(pattern) || pattern.some(p => typeof p !== 'number')) {
                console.error('VibrationManager: некорректный паттерн вибрации', pattern);
                return false;
            }
            
            navigator.vibrate(pattern);
            return true;
        } catch (error) {
            console.error('VibrationManager: ошибка вибрации:', error);
            return false;
        }
    }
    
    /**
     * Останавливает текущую вибрацию
     */
    stop() {
        if (this.isSupported) {
            try {
                navigator.vibrate(0);
            } catch (error) {
                console.error('VibrationManager: ошибка остановки вибрации:', error);
            }
        }
    }
    
    /**
     * Вибрация для правильного ответа
     * @returns {boolean}
     */
    vibrateCorrect() {
        return this.vibrate(VIBRATION_PATTERNS.CORRECT);
    }
    
    /**
     * Вибрация для неправильного ответа
     * @returns {boolean}
     */
    vibrateIncorrect() {
        return this.vibrate(VIBRATION_PATTERNS.INCORRECT);
    }
    
    /**
     * Вибрация для клика/нажатия
     * @returns {boolean}
     */
    vibrateClick() {
        return this.vibrate(VIBRATION_PATTERNS.CLICK);
    }
    
    /**
     * Вибрация для уведомления
     * @returns {boolean}
     */
    vibrateNotification() {
        return this.vibrate([200, 100, 200, 100, 200]);
    }
    
    /**
     * Вибрация для завершения игры
     * @returns {boolean}
     */
    vibrateCompletion() {
        return this.vibrate([100, 50, 100, 50, 100, 50, 100]);
    }
    
    /**
     * Включает или выключает вибрацию
     * @param {boolean} enabled 
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        // Если выключаем, останавливаем текущую вибрацию
        if (!enabled) {
            this.stop();
        }
    }
    
    /**
     * Переключает состояние вибрации
     * @returns {boolean} новое состояние
     */
    toggle() {
        const newState = !this.isEnabled;
        this.setEnabled(newState);
        return newState;
    }
    
    /**
     * Проверяет разрешение на вибрацию (только для HTTPS)
     * @returns {boolean}
     */
    hasPermission() {
        // В современных браузерах вибрация обычно разрешена без явного запроса
        // Но для длительных вибраций может потребоваться жесты пользователя
        return this.isSupported;
    }
    
    /**
     * Запрашивает разрешение на вибрацию (если требуется)
     * @returns {Promise<boolean>}
     */
    async requestPermission() {
        if (!this.isSupported) {
            return false;
        }
        
        // В большинстве браузеров явного API для запроса разрешения на вибрацию нет
        // Разрешение обычно дается автоматически при жестах пользователя
        // Мы можем симулировать запрос, попробовав выполнить короткую вибрацию
        try {
            // Пытаемся выполнить очень короткую вибрацию
            navigator.vibrate(10);
            return true;
        } catch (error) {
            console.warn('VibrationManager: не удалось запросить разрешение:', error);
            return false;
        }
    }
    
    /**
     * Получает текущее состояние вибрации
     * @returns {Object}
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            supported: this.isSupported,
            available: this.isAvailable(),
            permission: this.hasPermission()
        };
    }
}

// Создаем и экспортируем глобальный экземпляр
let vibrationManagerInstance = null;

/**
 * Получает или создает экземпляр VibrationManager
 * @returns {Promise<VibrationManager>}
 */
export async function getVibrationManager() {
    if (!vibrationManagerInstance) {
        vibrationManagerInstance = new VibrationManager();
        // Ждем инициализации
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return vibrationManagerInstance;
}

/**
 * Вызывает вибрацию для правильного ответа
 * @returns {Promise<boolean>}
 */
export async function vibrateCorrect() {
    const manager = await getVibrationManager();
    return manager.vibrateCorrect();
}

/**
 * Вызывает вибрацию для неправильного ответа
 * @returns {Promise<boolean>}
 */
export async function vibrateIncorrect() {
    const manager = await getVibrationManager();
    return manager.vibrateIncorrect();
}

/**
 * Вызывает вибрацию для клика
 * @returns {Promise<boolean>}
 */
export async function vibrateClick() {
    const manager = await getVibrationManager();
    return manager.vibrateClick();
}

/**
 * Включает или выключает вибрацию
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export async function setVibrationEnabled(enabled) {
    const manager = await getVibrationManager();
    manager.setEnabled(enabled);
}