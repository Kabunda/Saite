// Утилиты для работы с DOM

/**
 * Экранирование HTML-символов для безопасного отображения текста
 * @param {string} text - исходный текст
 * @returns {string} экранированный текст
 */
export function escapeHtml(text) {
    const map = {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Показывает временное уведомление (toast)
 * @param {string} message - текст сообщения
 * @param {string} type - тип: 'info', 'success', 'error', 'warning'
 * @param {number} duration - длительность показа в миллисекундах
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Создаем элемент toast, если его еще нет
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Создаем toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : 
                     type === 'success' ? '#4caf50' : 
                     type === 'warning' ? '#ff9800' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-break: break-word;
    `;

    // Добавляем в контейнер
    toastContainer.appendChild(toast);

    // Удаляем через указанное время
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);

    // Добавляем CSS анимации, если их еще нет
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Переключает класс у элемента
 * @param {HTMLElement} element - DOM элемент
 * @param {string} className - имя класса
 * @param {boolean} force - принудительно добавить/удалить (true - добавить, false - удалить)
 */
export function toggleClass(element, className, force) {
    if (force === undefined) {
        element.classList.toggle(className);
    } else if (force) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * Создает элемент с заданными атрибутами и содержимым
 * @param {string} tag - тег элемента
 * @param {Object} attributes - атрибуты {id: '...', class: '...'}
 * @param {string|HTMLElement|Array} children - дочерние элементы
 * @returns {HTMLElement} созданный элемент
 */
export function createElement(tag, attributes = {}, children = null) {
    const element = document.createElement(tag);
    
    // Устанавливаем атрибуты
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className' || key === 'class') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    }
    
    // Добавляем дочерние элементы
    if (children) {
        if (Array.isArray(children)) {
            children.forEach(child => {
                if (child instanceof HTMLElement) {
                    element.appendChild(child);
                } else if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                }
            });
        } else if (children instanceof HTMLElement) {
            element.appendChild(children);
        } else if (typeof children === 'string') {
            element.textContent = children;
        }
    }
    
    return element;
}

/**
 * Проверяет, является ли элемент видимым в viewport
 * @param {HTMLElement} element 
 * @returns {boolean}
 */
export function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}