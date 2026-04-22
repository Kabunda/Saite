import { createElement, addAriaAttributes } from '../utils/helpers.js';

/**
 * Сервис для работы с модальными окнами и уведомлениями
 */
export class ModalService {
  /**
   * Показывает модальное окно с вводом текста
   * @param {Object} options - параметры модального окна
   * @returns {Promise<string|null>} введенный текст или null если отменено
   */
  static async showPrompt(options) {
    const {
      title = 'Введите значение',
      message = '',
      defaultValue = '',
      placeholder = '',
      confirmText = 'OK',
      cancelText = 'Отмена',
      validate = null
    } = options;

    return new Promise((resolve) => {
      // Создаем оверлей
      const overlay = createElement('div', {
        className: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'modal-title'
      });

      // Создаем модальное окно
      const modal = createElement('div', { className: 'modal' });
      
      // Заголовок
      const titleEl = createElement('h3', { id: 'modal-title' }, title);
      
      // Сообщение (если есть)
      let messageEl = null;
      if (message) {
        messageEl = createElement('p', {}, message);
      }
      
      // Поле ввода
      const input = createElement('input', {
        type: 'text',
        className: 'modal-input',
        value: defaultValue,
        placeholder: placeholder,
        autofocus: true
      });
      addAriaAttributes(input, {
        'aria-label': 'Введите текст'
      });
      
      // Кнопки
      const buttonsContainer = createElement('div', { className: 'modal-buttons' });
      
      const cancelBtn = createElement('button', {
        className: 'modal-btn modal-btn-secondary',
        type: 'button'
      }, cancelText);
      addAriaAttributes(cancelBtn, {
        'aria-label': 'Отменить ввод'
      });
      
      const confirmBtn = createElement('button', {
        className: 'modal-btn modal-btn-primary',
        type: 'button',
        disabled: !defaultValue.trim()
      }, confirmText);
      addAriaAttributes(confirmBtn, {
        'aria-label': 'Подтвердить ввод'
      });
      
      // Обработчики событий
      const handleConfirm = () => {
        const value = input.value.trim();
        if (validate) {
          const error = validate(value);
          if (error) {
            alert(error); // Временное решение, можно улучшить
            return;
          }
        }
        cleanup();
        resolve(value);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter' && input.value.trim()) {
          handleConfirm();
        }
      };
      
      const handleInput = () => {
        confirmBtn.disabled = !input.value.trim();
      };
      
      // Назначаем обработчики
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      input.addEventListener('input', handleInput);
      document.addEventListener('keydown', handleKeyDown);
      
      // Функция очистки
      const cleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.removeChild(overlay);
      };
      
      // Собираем модальное окно
      buttonsContainer.appendChild(cancelBtn);
      buttonsContainer.appendChild(confirmBtn);
      
      modal.appendChild(titleEl);
      if (messageEl) modal.appendChild(messageEl);
      modal.appendChild(input);
      modal.appendChild(buttonsContainer);
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Фокусируемся на поле ввода
      setTimeout(() => input.focus(), 10);
    });
  }

  /**
   * Показывает уведомление
   * @param {Object} options - параметры уведомления
   */
  static showNotification(options) {
    const {
      message,
      type = 'info',
      duration = 3000
    } = options;
    
    // Создаем уведомление
    const notification = createElement('div', {
      className: `notification notification-${type}`,
      role: 'alert',
      'aria-live': 'polite'
    });
    
    // Иконка в зависимости от типа
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    
    const icon = createElement('span', { className: 'notification-icon' }, icons[type] || icons.info);
    
    const messageEl = createElement('span', {}, message);
    
    const closeBtn = createElement('button', {
      className: 'notification-close',
      'aria-label': 'Закрыть уведомление'
    }, '×');
    
    // Обработчики
    const closeNotification = () => {
      notification.style.animation = 'notification-slide 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    };
    
    closeBtn.addEventListener('click', closeNotification);
    
    // Автоматическое закрытие
    let timeoutId;
    if (duration > 0) {
      timeoutId = setTimeout(closeNotification, duration);
    }
    
    // Собираем уведомление
    notification.appendChild(icon);
    notification.appendChild(messageEl);
    notification.appendChild(closeBtn);
    
    // Добавляем на страницу
    document.body.appendChild(notification);
    
    // Возвращаем объект для управления уведомлением
    return {
      close: closeNotification,
      element: notification
    };
  }

  /**
   * Показывает подтверждение
   * @param {Object} options - параметры подтверждения
   * @returns {Promise<boolean>} результат подтверждения
   */
  static async showConfirm(options) {
    const {
      title = 'Подтверждение',
      message = 'Вы уверены?',
      confirmText = 'Да',
      cancelText = 'Нет'
    } = options;
    
    return new Promise((resolve) => {
      const overlay = createElement('div', {
        className: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'confirm-title'
      });
      
      const modal = createElement('div', { className: 'modal' });
      
      const titleEl = createElement('h3', { id: 'confirm-title' }, title);
      const messageEl = createElement('p', {}, message);
      
      const buttonsContainer = createElement('div', { className: 'modal-buttons' });
      
      const cancelBtn = createElement('button', {
        className: 'modal-btn modal-btn-secondary',
        type: 'button'
      }, cancelText);
      
      const confirmBtn = createElement('button', {
        className: 'modal-btn modal-btn-primary',
        type: 'button'
      }, confirmText);
      
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter') {
          handleConfirm();
        }
      };
      
      const cleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.removeChild(overlay);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleKeyDown);
      
      buttonsContainer.appendChild(cancelBtn);
      buttonsContainer.appendChild(confirmBtn);
      
      modal.appendChild(titleEl);
      modal.appendChild(messageEl);
      modal.appendChild(buttonsContainer);
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Фокусируемся на кнопке подтверждения
      setTimeout(() => confirmBtn.focus(), 10);
    });
  }
}