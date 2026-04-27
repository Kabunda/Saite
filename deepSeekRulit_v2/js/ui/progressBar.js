// Управление прогресс-баром игры
import { PROGRESS_COLORS, ANIMATION_DURATIONS } from '../utils/constants.js';

export class ProgressBar {
    /**
     * Создает экземпляр прогресс-бара
     * @param {HTMLElement} container - контейнер для прогресс-бара
     * @param {Object} options - опции
     */
    constructor(container, options = {}) {
        if (!container) {
            throw new Error('ProgressBar: container element is required');
        }
        
        this.container = container;
        this.options = {
            cellClass: 'progress-cell',
            currentClass: 'progress-cell--current',
            correctClass: 'progress-cell--ok',
            incorrectClass: 'progress-cell--bad',
            animationClass: 'shake',
            ...options
        };
        
        this.cells = [];
        this.totalRounds = 0;
        this.currentIndex = 0;
        
        this.initStyles();
    }
    
    /**
     * Инициализирует прогресс-бар
     * @param {number} totalRounds - общее количество раундов
     */
    init(totalRounds) {
        if (totalRounds <= 0) {
            throw new Error('ProgressBar: totalRounds must be positive');
        }
        
        this.totalRounds = totalRounds;
        this.currentIndex = 0;
        this.cells = [];
        
        // Очищаем контейнер
        this.container.innerHTML = '';
        this.container.style.gridTemplateColumns = `repeat(${totalRounds}, 1fr)`;
        
        // Создаем ячейки
        for (let i = 0; i < totalRounds; i++) {
            const cell = document.createElement('div');
            cell.className = this.options.cellClass;
            cell.setAttribute('role', 'progressbar');
            cell.setAttribute('aria-valuemin', '0');
            cell.setAttribute('aria-valuemax', totalRounds.toString());
            cell.setAttribute('aria-valuenow', '0');
            cell.setAttribute('aria-label', `Вопрос ${i + 1} из ${totalRounds}`);
            
            // Устанавливаем начальные стили
            cell.style.backgroundColor = PROGRESS_COLORS.NEUTRAL;
            
            this.container.appendChild(cell);
            this.cells.push(cell);
        }
        
        // Выделяем первую ячейку как текущую
        this.setCurrent(0);
        
        console.log(`ProgressBar: инициализирован с ${totalRounds} ячейками`);
    }
    
    /**
     * Устанавливает текущую ячейку
     * @param {number} index - индекс ячейки (0-based)
     */
    setCurrent(index) {
        if (index < 0 || index >= this.totalRounds) {
            console.warn(`ProgressBar: индекс ${index} вне диапазона`);
            return;
        }
        
        // Снимаем выделение с предыдущей ячейки
        if (this.currentIndex < this.cells.length) {
            const prevCell = this.cells[this.currentIndex];
            prevCell.classList.remove(this.options.currentClass);
            prevCell.style.borderColor = '';
        }
        
        // Выделяем новую текущую ячейку
        this.currentIndex = index;
        const currentCell = this.cells[index];
        
        if (currentCell) {
            currentCell.classList.add(this.options.currentClass);
            currentCell.style.borderColor = PROGRESS_COLORS.CURRENT;
            currentCell.setAttribute('aria-valuenow', (index + 1).toString());
            
            // Прокручиваем к ячейке, если она не видна
            this.scrollToCell(index);
        }
    }
    
    /**
     * Помечает ячейку как правильную или неправильную
     * @param {number} index - индекс ячейки
     * @param {boolean} isCorrect - true для правильного ответа
     */
    markCell(index, isCorrect) {
        if (index < 0 || index >= this.cells.length) {
            console.warn(`ProgressBar: индекс ${index} вне диапазона`);
            return;
        }
        
        const cell = this.cells[index];
        if (!cell) return;
        
        // Удаляем предыдущие классы
        cell.classList.remove(this.options.correctClass, this.options.incorrectClass, this.options.animationClass);
        
        // Добавляем соответствующий класс
        if (isCorrect) {
            cell.classList.add(this.options.correctClass);
            cell.style.backgroundColor = PROGRESS_COLORS.CORRECT;
        } else {
            cell.classList.add(this.options.incorrectClass);
            cell.classList.add(this.options.animationClass);
            cell.style.backgroundColor = PROGRESS_COLORS.INCORRECT;
            
            // Удаляем класс анимации после завершения
            setTimeout(() => {
                cell.classList.remove(this.options.animationClass);
            }, ANIMATION_DURATIONS.PROGRESS_CELL);
        }
        
        // Обновляем ARIA
        cell.setAttribute('aria-label', `Вопрос ${index + 1} из ${this.totalRounds}: ${isCorrect ? 'правильно' : 'неправильно'}`);
    }
    
    /**
     * Прокручивает к указанной ячейке
     * @param {number} index - индекс ячейки
     */
    scrollToCell(index) {
        if (index < 0 || index >= this.cells.length) {
            return;
        }
        
        const cell = this.cells[index];
        if (!cell) return;
        
        // Используем smooth scroll, если поддерживается
        cell.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }
    
    /**
     * Сбрасывает прогресс-бар
     */
    reset() {
        this.cells.forEach((cell, index) => {
            cell.classList.remove(
                this.options.correctClass,
                this.options.incorrectClass,
                this.options.currentClass,
                this.options.animationClass
            );
            cell.style.backgroundColor = PROGRESS_COLORS.NEUTRAL;
            cell.setAttribute('aria-valuenow', '0');
            cell.setAttribute('aria-label', `Вопрос ${index + 1} из ${this.totalRounds}`);
        });
        
        this.currentIndex = 0;
        this.setCurrent(0);
    }
    
    /**
     * Получает текущий прогресс (0-1)
     * @returns {number}
     */
    getProgress() {
        if (this.totalRounds === 0) return 0;
        return this.currentIndex / this.totalRounds;
    }
    
    /**
     * Получает количество отмеченных ячеек
     * @returns {Object} {correct: number, incorrect: number}
     */
    getMarkedCount() {
        let correct = 0;
        let incorrect = 0;
        
        this.cells.forEach(cell => {
            if (cell.classList.contains(this.options.correctClass)) {
                correct++;
            } else if (cell.classList.contains(this.options.incorrectClass)) {
                incorrect++;
            }
        });
        
        return { correct, incorrect };
    }
    
    /**
     * Инициализирует стили, если их еще нет
     */
    initStyles() {
        // Проверяем, добавлены ли уже стили
        if (document.getElementById('progress-bar-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'progress-bar-styles';
        style.textContent = `
            .progress-cell {
                height: 12px;
                border-radius: 3px;
                transition: background-color 0.3s, transform 0.2s;
                border: 2px solid transparent;
            }
            
            .progress-cell--current {
                border-color: ${PROGRESS_COLORS.CURRENT};
                transform: scale(1.1);
            }
            
            .progress-cell--ok {
                background-color: ${PROGRESS_COLORS.CORRECT} !important;
            }
            
            .progress-cell--bad {
                background-color: ${PROGRESS_COLORS.INCORRECT} !important;
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                20%, 40%, 60%, 80% { transform: translateX(2px); }
            }
            
            .shake {
                animation: shake 0.5s ease;
            }
        `;
        
        document.head.appendChild(style);
    }
}

/**
 * Создает и возвращает экземпляр ProgressBar
 * @param {string|HTMLElement} container - селектор или элемент контейнера
 * @param {Object} options - опции
 * @returns {ProgressBar}
 */
export function createProgressBar(container, options = {}) {
    let containerElement;
    
    if (typeof container === 'string') {
        containerElement = document.querySelector(container);
    } else {
        containerElement = container;
    }
    
    if (!containerElement) {
        throw new Error(`ProgressBar: container "${container}" not found`);
    }
    
    return new ProgressBar(containerElement, options);
}