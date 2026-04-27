// Модуль экрана ввода имени
import * as storage from '../data/storage.js';
import { showToast } from '../utils/dom.js';
import { SCREEN_IDS } from '../utils/constants.js';
import { getScreenManager } from './screenManager.js';

class NameScreen {
    constructor() {
        this.playerName = '';
        this.onCompleteCallback = null;
        this.isInitialized = false;
        
        // DOM элементы (ленивая загрузка)
        this.elements = null;
        
        // Привязка контекста для обработчиков
        this.handleContinueClick = this.handleContinueClick.bind(this);
        this.handleInputKeydown = this.handleInputKeydown.bind(this);
        this.handleInputInput = this.handleInputInput.bind(this);
    }
    
    /**
     * Инициализирует экран ввода имени
     * @param {Function} onComplete - колбэк, вызываемый после успешного сохранения имени
     * @returns {Object} API экрана
     */
    init(onComplete) {
        if (this.isInitialized) {
            console.warn('NameScreen: уже инициализирован');
            return this;
        }
        
        this.onCompleteCallback = onComplete;
        this.loadElements();
        this.setupEventHandlers();
        this.isInitialized = true;
        
        console.log('NameScreen: инициализирован');
        return this;
    }
    
    /**
     * Загружает DOM элементы
     */
    loadElements() {
        this.elements = {
            nameInput: document.getElementById('playerNameInput'),
            continueBtn: document.getElementById('continueBtn'),
            nameError: document.getElementById('nameError')
        };
        
        if (!this.elements.nameInput || !this.elements.continueBtn) {
            console.error('NameScreen: не найдены необходимые DOM элементы');
        }
    }
    
    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        if (!this.elements) return;
        
        const { nameInput, continueBtn, nameError } = this.elements;
        
        continueBtn.addEventListener('click', this.handleContinueClick);
        nameInput.addEventListener('keydown', this.handleInputKeydown);
        nameInput.addEventListener('input', this.handleInputInput);
        
        // Скрываем ошибку при вводе
        nameInput.addEventListener('input', () => {
            nameError.classList.add('hidden');
        });
    }
    
    /**
     * Обрабатывает клик по кнопке "Продолжить"
     */
    async handleContinueClick() {
        await this.saveName();
    }
    
    /**
     * Обрабатывает нажатие клавиши в поле ввода
     * @param {KeyboardEvent} event
     */
    handleInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveName();
        }
    }
    
    /**
     * Обрабатывает ввод в поле (валидация в реальном времени)
     */
    handleInputInput() {
        // Опционально: можно добавить live validation
    }
    
    /**
     * Валидирует имя
     * @param {string} name
     * @returns {{isValid: boolean, error: string|null}}
     */
    validateName(name) {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return { isValid: false, error: 'Имя не может быть пустым' };
        }
        if (trimmed.length > 20) {
            return { isValid: false, error: 'Имя не должно превышать 20 символов' };
        }
        return { isValid: true, error: null };
    }
    
    /**
     * Сохраняет имя игрока
     */
    async saveName() {
        if (!this.elements) return;
        
        const { nameInput, nameError } = this.elements;
        const name = nameInput.value.trim();
        
        const validation = this.validateName(name);
        if (!validation.isValid) {
            nameError.textContent = validation.error;
            nameError.classList.remove('hidden');
            nameInput.focus();
            return;
        }
        
        try {
            await storage.setPlayerName(name);
            this.playerName = name;
            
            // Скрываем ошибку
            nameError.classList.add('hidden');
            
            // Уведомление
            showToast(`Имя сохранено: ${name}`, 'success', 1500);
            
            // Вызываем колбэк завершения
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            
            console.log(`NameScreen: имя сохранено - ${name}`);
        } catch (error) {
            console.error('NameScreen: ошибка сохранения имени:', error);
            showToast('Не удалось сохранить имя', 'error', 2000);
        }
    }
    
    /**
     * Показывает экран ввода имени
     */
    show() {
        const screenManager = getScreenManager();
        screenManager.show(SCREEN_IDS.NAME_INPUT);
        
        // Фокусируем поле ввода
        if (this.elements && this.elements.nameInput) {
            setTimeout(() => {
                this.elements.nameInput.focus();
                this.elements.nameInput.select();
            }, 100);
        }
        
        console.log('NameScreen: показан');
    }
    
    /**
     * Скрывает экран ввода имени
     */
    hide() {
        const screenManager = getScreenManager();
        screenManager.hide(SCREEN_IDS.NAME_INPUT);
        console.log('NameScreen: скрыт');
    }
    
    /**
     * Получает текущее имя игрока
     * @returns {string}
     */
    getPlayerName() {
        return this.playerName;
    }
    
    /**
     * Устанавливает имя игрока (программно)
     * @param {string} name
     */
    setPlayerName(name) {
        this.playerName = name;
        if (this.elements && this.elements.nameInput) {
            this.elements.nameInput.value = name;
        }
    }
    
    /**
     * Сбрасывает состояние экрана
     */
    reset() {
        if (this.elements && this.elements.nameInput) {
            this.elements.nameInput.value = '';
            this.elements.nameError.classList.add('hidden');
        }
        this.playerName = '';
    }
    
    /**
     * Уничтожает экран (удаляет обработчики)
     */
    destroy() {
        if (!this.elements) return;
        
        const { nameInput, continueBtn } = this.elements;
        
        continueBtn.removeEventListener('click', this.handleContinueClick);
        nameInput.removeEventListener('keydown', this.handleInputKeydown);
        nameInput.removeEventListener('input', this.handleInputInput);
        
        this.isInitialized = false;
        console.log('NameScreen: уничтожен');
    }
}

// Синглтон экземпляр
let instance = null;

/**
 * Инициализирует экран ввода имени
 * @param {Function} onComplete - колбэк, вызываемый после успешного сохранения имени
 * @returns {NameScreen} экземпляр экрана
 */
export function initNameScreen(onComplete) {
    if (!instance) {
        instance = new NameScreen();
    }
    return instance.init(onComplete);
}

/**
 * Получает экземпляр экрана (если уже инициализирован)
 * @returns {NameScreen|null}
 */
export function getNameScreen() {
    return instance;
}

/**
 * Показывает экран ввода имени
 */
export function showNameScreen() {
    if (instance) {
        instance.show();
    } else {
        console.warn('NameScreen: экземпляр не инициализирован');
    }
}

/**
 * Скрывает экран ввода имени
 */
export function hideNameScreen() {
    if (instance) {
        instance.hide();
    }
}

/**
 * Получает текущее имя игрока
 * @returns {string}
 */
export function getPlayerName() {
    return instance ? instance.getPlayerName() : '';
}

/**
 * Устанавливает имя игрока
 * @param {string} name
 */
export function setPlayerName(name) {
    if (instance) {
        instance.setPlayerName(name);
    }
}