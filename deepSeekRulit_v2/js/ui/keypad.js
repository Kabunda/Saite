// Управление экранной и физической клавиатурой
export class Keypad {
    /**
     * Создает экземпляр клавиатуры
     * @param {HTMLElement} container - контейнер клавиатуры
     * @param {Object} options - опции
     */
    constructor(container, options = {}) {
        if (!container) {
            throw new Error('Keypad: container element is required');
        }
        
        this.container = container;
        this.options = {
            keyClass: 'key',
            digitClass: 'key-digit',
            actionClass: 'key-action',
            zeroClass: 'key-zero',
            confirmClass: 'key-confirm',
            activeClass: 'active',
            ...options
        };
        
        this.keys = new Map(); // key -> элемент
        this.listeners = {
            digit: [],
            action: [],
            confirm: []
        };
        
        this.isListeningPhysical = false;
        this.physicalKeyHandler = null;
        
        this.initialize();
    }
    
    /**
     * Инициализирует клавиатуру
     */
    initialize() {
        // Собираем все клавиши
        const keyElements = this.container.querySelectorAll(`.${this.options.keyClass}`);
        
        keyElements.forEach(keyElement => {
            const key = keyElement.dataset.key;
            if (!key) return;
            
            this.keys.set(key, keyElement);
            
            // Добавляем обработчик клика
            keyElement.addEventListener('click', () => {
                this.handleKeyPress(key, keyElement);
            });
            
            // Добавляем обработчик касания для мобильных устройств
            keyElement.addEventListener('touchstart', (e) => {
                e.preventDefault();
                keyElement.classList.add(this.options.activeClass);
                this.handleKeyPress(key, keyElement);
            });
            
            keyElement.addEventListener('touchend', (e) => {
                e.preventDefault();
                keyElement.classList.remove(this.options.activeClass);
            });
            
            keyElement.addEventListener('touchcancel', () => {
                keyElement.classList.remove(this.options.activeClass);
            });
        });
        
        console.log(`Keypad: инициализировано ${this.keys.size} клавиш`);
    }
    
    /**
     * Обрабатывает нажатие клавиши
     * @param {string} key - идентификатор клавиши
     * @param {HTMLElement} keyElement - элемент клавиши
     */
    handleKeyPress(key, keyElement) {
        // Визуальная обратная связь
        this.animateKeyPress(keyElement);
        
        // Определяем тип клавиши
        if (key === 'enter') {
            this.emit('confirm', key);
        } else if (key === 'del' || key === 'clear') {
            this.emit('action', key);
        } else if (/^\d$/.test(key)) {
            this.emit('digit', parseInt(key, 10));
        } else {
            console.warn(`Keypad: неизвестная клавиша "${key}"`);
        }
    }
    
    /**
     * Анимирует нажатие клавиши
     * @param {HTMLElement} keyElement 
     */
    animateKeyPress(keyElement) {
        keyElement.classList.add(this.options.activeClass);
        
        setTimeout(() => {
            keyElement.classList.remove(this.options.activeClass);
        }, 150);
    }
    
    /**
     * Добавляет слушатель событий клавиатуры
     * @param {string} eventType - тип события: 'digit', 'action', 'confirm'
     * @param {Function} callback - функция-обработчик
     */
    on(eventType, callback) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].push(callback);
        }
    }
    
    /**
     * Удаляет слушатель событий
     * @param {string} eventType - тип события
     * @param {Function} callback - функция-обработчик
     */
    off(eventType, callback) {
        if (this.listeners[eventType]) {
            const index = this.listeners[eventType].indexOf(callback);
            if (index !== -1) {
                this.listeners[eventType].splice(index, 1);
            }
        }
    }
    
    /**
     * Вызывает событие
     * @param {string} eventType - тип события
     * @param {any} data - данные события
     */
    emit(eventType, data) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Keypad: ошибка в обработчике события ${eventType}:`, error);
                }
            });
        }
    }
    
    /**
     * Начинает слушать физическую клавиатуру
     */
    startListeningPhysical() {
        if (this.isListeningPhysical) {
            console.warn('Keypad: уже слушаем физическую клавиатуру');
            return;
        }
        
        this.physicalKeyHandler = (event) => {
            this.handlePhysicalKey(event);
        };
        
        document.addEventListener('keydown', this.physicalKeyHandler);
        this.isListeningPhysical = true;
        
        console.log('Keypad: начато прослушивание физической клавиатуры');
    }
    
    /**
     * Останавливает прослушивание физической клавиатуры
     */
    stopListeningPhysical() {
        if (!this.isListeningPhysical || !this.physicalKeyHandler) {
            return;
        }
        
        document.removeEventListener('keydown', this.physicalKeyHandler);
        this.physicalKeyHandler = null;
        this.isListeningPhysical = false;
        
        console.log('Keypad: остановлено прослушивание физической клавиатуры');
    }
    
    /**
     * Обрабатывает нажатие физической клавиши
     * @param {KeyboardEvent} event 
     */
    handlePhysicalKey(event) {
        // Игнорируем нажатия в полях ввода
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = event.key;
        
        // Цифры 0-9
        if (/^\d$/.test(key)) {
            event.preventDefault();
            this.emit('digit', parseInt(key, 10));
            this.highlightKey(key);
        }
        // Enter
        else if (key === 'Enter') {
            event.preventDefault();
            this.emit('confirm', 'enter');
            this.highlightKey('enter');
        }
        // Backspace
        else if (key === 'Backspace') {
            event.preventDefault();
            this.emit('action', 'del');
            this.highlightKey('del');
        }
        // Delete или Escape
        else if (key === 'Delete' || key === 'Escape') {
            event.preventDefault();
            this.emit('action', 'clear');
            this.highlightKey('clear');
        }
        // Пробел (альтернатива Enter)
        else if (key === ' ') {
            event.preventDefault();
            this.emit('confirm', 'enter');
            this.highlightKey('enter');
        }
    }
    
    /**
     * Подсвечивает клавишу на экранной клавиатуре
     * @param {string} key - идентификатор клавиши
     */
    highlightKey(key) {
        const keyElement = this.keys.get(key);
        if (keyElement) {
            this.animateKeyPress(keyElement);
        }
    }
    
    /**
     * Включает или выключает клавиатуру
     * @param {boolean} enabled 
     */
    setEnabled(enabled) {
        this.container.style.opacity = enabled ? '1' : '0.5';
        this.container.style.pointerEvents = enabled ? 'auto' : 'none';
        
        if (enabled) {
            this.startListeningPhysical();
        } else {
            this.stopListeningPhysical();
        }
    }
    
    /**
     * Получает элемент клавиши по идентификатору
     * @param {string} key 
     * @returns {HTMLElement|null}
     */
    getKeyElement(key) {
        return this.keys.get(key) || null;
    }
    
    /**
     * Уничтожает клавиатуру, освобождая ресурсы
     */
    destroy() {
        this.stopListeningPhysical();
        this.listeners = { digit: [], action: [], confirm: [] };
        this.keys.clear();
        
        console.log('Keypad: уничтожен');
    }
}

/**
 * Создает и возвращает экземпляр Keypad
 * @param {string|HTMLElement} container - селектор или элемент контейнера
 * @param {Object} options - опции
 * @returns {Keypad}
 */
export function createKeypad(container, options = {}) {
    let containerElement;
    
    if (typeof container === 'string') {
        containerElement = document.querySelector(container);
    } else {
        containerElement = container;
    }
    
    if (!containerElement) {
        throw new Error(`Keypad: container "${container}" not found`);
    }
    
    return new Keypad(containerElement, options);
}

/**
 * Создает DOM-элемент клавиатуры
 * @param {Object} options - опции
 * @returns {HTMLElement} элемент клавиатуры
 */
export function createKeypadDOM(options = {}) {
    const {
        id = 'keypad',
        className = 'keypad',
        showConfirm = true
    } = options;
    
    const keypad = document.createElement('div');
    keypad.id = id;
    keypad.className = className;
    
    // Основная сетка цифр
    const digitGrid = document.createElement('div');
    digitGrid.className = 'digit-grid';
    
    // Цифры 1-9
    for (let i = 1; i <= 9; i++) {
        const key = document.createElement('button');
        key.className = 'key key-digit';
        key.dataset.key = i.toString();
        key.textContent = i.toString();
        key.setAttribute('type', 'button');
        key.setAttribute('aria-label', `Цифра ${i}`);
        digitGrid.appendChild(key);
    }
    
    // Цифра 0
    const zeroKey = document.createElement('button');
    zeroKey.className = 'key key-digit key-zero';
    zeroKey.dataset.key = '0';
    zeroKey.textContent = '0';
    zeroKey.setAttribute('type', 'button');
    zeroKey.setAttribute('aria-label', 'Цифра 0');
    digitGrid.appendChild(zeroKey);
    
    // Сетка действий
    const actionGrid = document.createElement('div');
    actionGrid.className = 'action-grid';
    
    // Кнопка удаления
    const delKey = document.createElement('button');
    delKey.className = 'key key-action key-del';
    delKey.dataset.key = 'del';
    delKey.textContent = '⌫';
    delKey.setAttribute('type', 'button');
    delKey.setAttribute('aria-label', 'Удалить последнюю цифру');
    actionGrid.appendChild(delKey);
    
    // Кнопка очистки
    const clearKey = document.createElement('button');
    clearKey.className = 'key key-action key-ac';
    clearKey.dataset.key = 'clear';
    clearKey.textContent = 'AC';
    clearKey.setAttribute('type', 'button');
    clearKey.setAttribute('aria-label', 'Очистить ответ');
    actionGrid.appendChild(clearKey);
    
    // Основной контейнер
    const mainContainer = document.createElement('div');
    mainContainer.className = 'keypad-main';
    mainContainer.appendChild(digitGrid);
    mainContainer.appendChild(actionGrid);
    
    keypad.appendChild(mainContainer);
    
    // Кнопка подтверждения (если нужна)
    if (showConfirm) {
        const confirmKey = document.createElement('button');
        confirmKey.className = 'key key-confirm key-ok-side';
        confirmKey.dataset.key = 'enter';
        confirmKey.textContent = 'OK';
        confirmKey.setAttribute('type', 'button');
        confirmKey.setAttribute('aria-label', 'Подтвердить ответ');
        keypad.appendChild(confirmKey);
    }
    
    return keypad;
}