// Вспомогательные функции

/**
 * Генерирует случайное целое число в диапазоне [min, max]
 * @param {number} min - минимальное значение
 * @param {number} max - максимальное значение
 * @returns {number} случайное целое число
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Форматирует время в секундах в строку MM:SS
 * @param {number} totalSec - общее время в секундах
 * @returns {string} отформатированное время
 */
export function formatTime(totalSec) {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Получает булево значение из localStorage
 * @param {string} key - ключ
 * @param {boolean} defaultValue - значение по умолчанию
 * @returns {boolean} значение
 */
export function getBoolSetting(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === "true";
}

/**
 * Устанавливает значение в localStorage
 * @param {string} key - ключ
 * @param {any} value - значение
 */
export function setSetting(key, value) {
  localStorage.setItem(key, String(value));
}

/**
 * Проверяет, является ли устройство мобильным (по ширине экрана)
 * @returns {boolean} true если мобильное устройство
 */
export function isMobileDevice() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/**
 * Запрашивает полноэкранный режим на мобильных устройствах
 */
export function requestFullscreenOnMobile() {
  if (!isMobileDevice()) return;
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) return;
  
  document.documentElement.requestFullscreen().catch((err) => {
    console.warn("Не удалось перейти в полноэкранный режим:", err);
  });
}

/**
 * Создает элемент DOM с заданными атрибутами
 * @param {string} tag - тег элемента
 * @param {Object} attributes - атрибуты элемента
 * @param {string} text - текстовое содержимое
 * @returns {HTMLElement} созданный элемент
 */
export function createElement(tag, attributes = {}, text = "") {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === "className") {
      element.className = value;
    } else if (key === "dataset") {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (text) {
    element.textContent = text;
  }
  
  return element;
}

/**
 * Добавляет ARIA-атрибуты для улучшения доступности
 * @param {HTMLElement} element - элемент
 * @param {Object} ariaAttributes - ARIA-атрибуты
 */
export function addAriaAttributes(element, ariaAttributes) {
  Object.entries(ariaAttributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Показывает уведомление
 * @param {string} message - сообщение
 * @param {string} type - тип (info, warning, error, success)
 */
export function showNotification(message, type = "info") {
  // Используем ModalService для показа уведомлений
  // Импортируем динамически, чтобы избежать циклических зависимостей
  import('../ui/modals.js').then(({ ModalService }) => {
    ModalService.showNotification({ message, type });
  }).catch(() => {
    // Fallback на alert если ModalService не доступен
    alert(message);
  });
}

/**
 * Дебаунс функция
 * @param {Function} func - функция для вызова
 * @param {number} wait - время ожидания в мс
 * @returns {Function} дебаунсированная функция
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}