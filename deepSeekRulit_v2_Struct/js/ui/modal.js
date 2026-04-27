// Универсальный менеджер модальных окон
import { MODAL_IDS } from '../utils/constants.js';
import { escapeHtml } from '../utils/dom.js';

export class ModalManager {
    constructor() {
        this.modals = new Map();
        this.currentModal = null;
        this.overlay = null;
        this.initializeModals();
        this.setupGlobalHandlers();
    }

    /**
     * Инициализирует все модальные окна из DOM
     */
    initializeModals() {
        // Собираем все модальные окна по их ID
        Object.values(MODAL_IDS).forEach(modalId => {
            const element = document.getElementById(modalId);
            if (element) {
                this.modals.set(modalId, element);
                this.setupModalHandlers(modalId, element);
            } else {
                console.warn(`Модальное окно с ID "${modalId}" не найдено в DOM`);
            }
        });

        // Создаем оверлей, если его нет
        this.createOverlay();

        console.log(`ModalManager: загружено ${this.modals.size} модальных окон`);
    }

    /**
     * Создает оверлей для модальных окон
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay hidden';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Закрытие по клику на оверлей
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeCurrent();
            }
        });

        document.body.appendChild(this.overlay);
    }

    /**
     * Настраивает обработчики для конкретного модального окна
     * @param {string} modalId 
     * @param {HTMLElement} modalElement 
     */
    setupModalHandlers(modalId, modalElement) {
        // Закрытие по кнопкам с классом .modal-close
        const closeButtons = modalElement.querySelectorAll('.modal-close, [data-modal-close]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close(modalId));
        });

        // Закрытие по Escape (будет обработано глобально)
        modalElement.setAttribute('data-modal-id', modalId);
    }

    /**
     * Настраивает глобальные обработчики (Escape)
     */
    setupGlobalHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeCurrent();
            }
        });
    }

    /**
     * Открывает модальное окно
     * @param {string} modalId - ID модального окна
     * @param {Object} options - опции
     * @param {Function} onClose - колбэк при закрытии
     * @param {Function} onOpen - колбэк при открытии
     * @returns {boolean} успешность операции
     */
    open(modalId, options = {}, onClose = null, onOpen = null) {
        const modalElement = this.modals.get(modalId);
        
        if (!modalElement) {
            console.error(`Модальное окно "${modalId}" не найдено`);
            return false;
        }

        // Закрываем текущее модальное окно, если есть
        if (this.currentModal && this.currentModal !== modalId) {
            this.close(this.currentModal);
        }

        // Применяем опции
        this.applyOptions(modalElement, options);

        // Показываем оверлей и модальное окно
        this.showOverlay();
        modalElement.classList.remove('hidden');
        this.currentModal = modalId;

        // Фокусируемся на первом интерактивном элементе
        setTimeout(() => {
            const focusElement = modalElement.querySelector('input, button, [autofocus]');
            if (focusElement) focusElement.focus();
        }, 10);

        // Сохраняем колбэки
        if (onClose) {
            modalElement.dataset.onClose = 'custom';
            modalElement.addEventListener('modalclose', onClose, { once: true });
        }

        if (onOpen) {
            onOpen(modalElement);
        }

        // Вызываем событие открытия
        this.dispatchModalEvent(modalId, 'open', modalElement);

        console.log(`ModalManager: открыто модальное окно "${modalId}"`);
        return true;
    }

    /**
     * Закрывает модальное окно
     * @param {string} modalId - ID модального окна
     * @returns {boolean} успешность операции
     */
    close(modalId) {
        const modalElement = this.modals.get(modalId);
        
        if (!modalElement || !modalElement.classList.contains('hidden')) {
            return false;
        }

        // Скрываем модальное окно
        modalElement.classList.add('hidden');
        
        // Если это текущее модальное окно, сбрасываем
        if (this.currentModal === modalId) {
            this.currentModal = null;
        }

        // Скрываем оверлей, если нет других модальных окон
        if (!this.currentModal) {
            this.hideOverlay();
        }

        // Вызываем событие закрытия
        this.dispatchModalEvent(modalId, 'close', modalElement);

        console.log(`ModalManager: закрыто модальное окно "${modalId}"`);
        return true;
    }

    /**
     * Закрывает текущее модальное окно
     */
    closeCurrent() {
        if (this.currentModal) {
            this.close(this.currentModal);
        }
    }

    /**
     * Показывает оверлей
     */
    showOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
            setTimeout(() => {
                this.overlay.style.opacity = '1';
            }, 10);
        }
    }

    /**
     * Скрывает оверлей
     */
    hideOverlay() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.overlay.classList.add('hidden');
            }, 300);
        }
    }

    /**
     * Применяет опции к модальному окну
     * @param {HTMLElement} modalElement 
     * @param {Object} options 
     */
    applyOptions(modalElement, options) {
        // Установка заголовка
        if (options.title) {
            const titleEl = modalElement.querySelector('.modal-title, .modal-header h3');
            if (titleEl) {
                titleEl.textContent = escapeHtml(options.title);
            }
        }

        // Установка содержимого
        if (options.content) {
            const contentEl = modalElement.querySelector('.modal-content, .modal-body');
            if (contentEl) {
                if (typeof options.content === 'string') {
                    contentEl.innerHTML = options.content;
                } else if (options.content instanceof HTMLElement) {
                    contentEl.innerHTML = '';
                    contentEl.appendChild(options.content);
                }
            }
        }

        // Установка данных
        if (options.data) {
            for (const [key, value] of Object.entries(options.data)) {
                modalElement.dataset[key] = value;
            }
        }
    }

    /**
     * Вызывает событие модального окна
     * @param {string} modalId 
     * @param {string} eventType 
     * @param {HTMLElement} modalElement 
     */
    dispatchModalEvent(modalId, eventType, modalElement) {
        const event = new CustomEvent(`modal${eventType}`, {
            detail: {
                modalId,
                modalElement,
                timestamp: Date.now()
            },
            bubbles: true
        });
        
        modalElement.dispatchEvent(event);
        document.dispatchEvent(event);
    }

    /**
     * Проверяет, открыто ли модальное окно
     * @param {string} modalId 
     * @returns {boolean}
     */
    isOpen(modalId) {
        const modalElement = this.modals.get(modalId);
        return modalElement ? !modalElement.classList.contains('hidden') : false;
    }

    /**
     * Получает текущее открытое модальное окно
     * @returns {string|null}
     */
    getCurrentModal() {
        return this.currentModal;
    }
}

// Создаем и экспортируем глобальный экземпляр
let modalManagerInstance = null;

/**
 * Получает или создает экземпляр ModalManager
 * @returns {ModalManager}
 */
export function getModalManager() {
    if (!modalManagerInstance) {
        modalManagerInstance = new ModalManager();
    }
    return modalManagerInstance;
}

/**
 * Открывает модальное окно (удобная функция для быстрого доступа)
 * @param {string} modalId 
 * @param {Object} options 
 * @param {Function} onClose 
 * @param {Function} onOpen 
 */
export function openModal(modalId, options = {}, onClose = null, onOpen = null) {
    const manager = getModalManager();
    return manager.open(modalId, options, onClose, onOpen);
}

/**
 * Закрывает модальное окно (удобная функция для быстрого доступа)
 * @param {string} modalId 
 */
export function closeModal(modalId) {
    const manager = getModalManager();
    return manager.close(modalId);
}

/**
 * Закрывает текущее модальное окно
 */
export function closeCurrentModal() {
    const manager = getModalManager();
    manager.closeCurrent();
}

// Экспортируем константы для удобства
export { MODAL_IDS };