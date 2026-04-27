// Таймер игры
export class GameTimer {
    /**
     * Создает экземпляр таймера
     * @param {HTMLElement} displayElement - элемент для отображения времени
     * @param {Object} options - опции
     */
    constructor(displayElement, options = {}) {
        if (!displayElement) {
            throw new Error('GameTimer: displayElement is required');
        }
        
        this.displayElement = displayElement;
        this.options = {
            updateInterval: 1000, // интервал обновления в мс
            format: 'mm:ss',     // формат отображения
            showMilliseconds: false,
            autoStart: false,
            ...options
        };
        
        this.startTime = null;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.onTickCallbacks = [];
        
        // Инициализируем отображение
        this.updateDisplay();
        
        if (this.options.autoStart) {
            this.start();
        }
    }
    
    /**
     * Запускает таймер
     */
    start() {
        if (this.isRunning) {
            console.warn('GameTimer: таймер уже запущен');
            return;
        }
        
        this.startTime = Date.now() - this.elapsedTime;
        this.isRunning = true;
        
        this.intervalId = setInterval(() => {
            this.update();
        }, this.options.updateInterval);
        
        console.log('GameTimer: таймер запущен');
    }
    
    /**
     * Останавливает таймер
     */
    stop() {
        if (!this.isRunning) {
            console.warn('GameTimer: таймер уже остановлен');
            return;
        }
        
        this.update(); // Обновляем elapsedTime перед остановкой
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('GameTimer: таймер остановлен');
    }
    
    /**
     * Сбрасывает таймер
     */
    reset() {
        this.stop();
        this.startTime = null;
        this.elapsedTime = 0;
        this.updateDisplay();
        console.log('GameTimer: таймер сброшен');
    }
    
    /**
     * Обновляет состояние таймера
     */
    update() {
        if (!this.isRunning || !this.startTime) {
            return;
        }
        
        this.elapsedTime = Date.now() - this.startTime;
        this.updateDisplay();
        
        // Вызываем колбэки
        this.onTickCallbacks.forEach(callback => {
            callback(this.elapsedTime);
        });
    }
    
    /**
     * Обновляет отображение времени
     */
    updateDisplay() {
        if (!this.displayElement) {
            return;
        }
        
        const formattedTime = this.formatTime(this.elapsedTime);
        this.displayElement.textContent = formattedTime;
        this.displayElement.setAttribute('aria-label', `Время игры: ${formattedTime}`);
    }
    
    /**
     * Форматирует время в строку
     * @param {number} milliseconds - время в миллисекундах
     * @returns {string} отформатированное время
     */
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        if (this.options.showMilliseconds) {
            const ms = Math.floor((milliseconds % 1000) / 10);
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Получает текущее время в секундах
     * @returns {number} время в секундах
     */
    getTimeInSeconds() {
        return this.elapsedTime / 1000;
    }
    
    /**
     * Получает текущее время в миллисекундах
     * @returns {number} время в миллисекундах
     */
    getTimeInMilliseconds() {
        return this.elapsedTime;
    }
    
    /**
     * Добавляет колбэк, вызываемый при каждом обновлении таймера
     * @param {Function} callback - функция, принимающая время в мс
     */
    onTick(callback) {
        if (typeof callback === 'function') {
            this.onTickCallbacks.push(callback);
        }
    }
    
    /**
     * Удаляет колбэк
     * @param {Function} callback - функция для удаления
     */
    offTick(callback) {
        const index = this.onTickCallbacks.indexOf(callback);
        if (index !== -1) {
            this.onTickCallbacks.splice(index, 1);
        }
    }
    
    /**
     * Устанавливает формат отображения
     * @param {string} format - формат ('mm:ss', 'hh:mm:ss', 'mm:ss.ms')
     */
    setFormat(format) {
        this.options.format = format;
        this.options.showMilliseconds = format.includes('ms');
        this.updateDisplay();
    }
    
    /**
     * Устанавливает элемент отображения
     * @param {HTMLElement} displayElement - новый элемент
     */
    setDisplayElement(displayElement) {
        if (!displayElement) {
            console.error('GameTimer: displayElement cannot be null');
            return;
        }
        
        this.displayElement = displayElement;
        this.updateDisplay();
    }
    
    /**
     * Проверяет, запущен ли таймер
     * @returns {boolean}
     */
    isActive() {
        return this.isRunning;
    }
    
    /**
     * Уничтожает таймер, освобождая ресурсы
     */
    destroy() {
        this.stop();
        this.onTickCallbacks = [];
        console.log('GameTimer: уничтожен');
    }
}

/**
 * Создает и возвращает экземпляр GameTimer
 * @param {string|HTMLElement} displayElement - селектор или элемент для отображения
 * @param {Object} options - опции
 * @returns {GameTimer}
 */
export function createTimer(displayElement, options = {}) {
    let displayElementInstance;
    
    if (typeof displayElement === 'string') {
        displayElementInstance = document.querySelector(displayElement);
    } else {
        displayElementInstance = displayElement;
    }
    
    if (!displayElementInstance) {
        throw new Error(`GameTimer: display element "${displayElement}" not found`);
    }
    
    return new GameTimer(displayElementInstance, options);
}

/**
 * Форматирует время в секундах в строку MM:SS
 * @param {number} seconds - время в секундах
 * @returns {string} отформатированное время
 */
export function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Форматирует время в миллисекундах в строку MM:SS.ms
 * @param {number} milliseconds - время в миллисекундах
 * @returns {string} отформатированное время
 */
export function formatMilliseconds(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}