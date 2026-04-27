// Генератор вопросов для игры
import {
    FIRST_MULTIPLIERS,
    SECOND_MIN,
    SECOND_MAX,
    DEFAULT_ROUNDS
} from '../utils/constants.js';

/**
 * Генерирует случайное целое число в диапазоне [min, max]
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Создает список вопросов со случайными множителями
 * @param {number} rounds - количество вопросов
 * @param {number[]} multipliers - массив первых множителей
 * @param {number} secondMin - минимальное значение второго множителя
 * @param {number} secondMax - максимальное значение второго множителя
 * @returns {Array<{a: number, b: number}>} список вопросов
 */
export function buildQuestionList(
    rounds = DEFAULT_ROUNDS,
    multipliers = FIRST_MULTIPLIERS,
    secondMin = SECOND_MIN,
    secondMax = SECOND_MAX
) {
    const list = [];
    for (let i = 0; i < rounds; i++) {
        list.push({
            a: multipliers[randomInt(0, multipliers.length - 1)],
            b: randomInt(secondMin, secondMax)
        });
    }
    return list;
}

/**
 * Создает список уникальных вопросов (без повторений, пока не исчерпаны все комбинации)
 * @param {number} rounds - количество вопросов
 * @returns {Array<{a: number, b: number}>} список уникальных вопросов
 */
export function buildUniqueQuestionList(rounds = DEFAULT_ROUNDS) {
    // Генерируем все возможные комбинации
    const all = [];
    for (const a of FIRST_MULTIPLIERS) {
        for (let b = SECOND_MIN; b <= SECOND_MAX; b++) {
            all.push({ a, b });
        }
    }
    
    // Перемешиваем
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    
    // Если запрошено больше, чем уникальных комбинаций – повторяем список циклически
    if (rounds > all.length) {
        const repeated = [];
        while (repeated.length < rounds) {
            repeated.push(...all.slice(0, rounds - repeated.length));
        }
        return repeated;
    }
    
    return all.slice(0, rounds);
}

/**
 * Проверяет правильность ответа
 * @param {number} a - первый множитель
 * @param {number} b - второй множитель
 * @param {number} answer - ответ игрока
 * @returns {boolean}
 */
export function isCorrectAnswer(a, b, answer) {
    return a * b === answer;
}

/**
 * Форматирует вопрос в текстовый вид
 * @param {number} a 
 * @param {number} b 
 * @returns {string}
 */
export function formatQuestion(a, b) {
    return `${a} × ${b} = ?`;
}

/**
 * Вычисляет правильный ответ
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export function calculateAnswer(a, b) {
    return a * b;
}

/**
 * Создает вопросы с балансировкой по сложности
 * @param {number} rounds - количество вопросов
 * @param {Object} options - опции
 * @param {boolean} options.ensureVariety - гарантировать разнообразие первых множителей
 * @param {boolean} options.avoidRepeats - избегать повторений подряд
 * @returns {Array<{a: number, b: number}>}
 */
export function buildBalancedQuestionList(rounds = DEFAULT_ROUNDS, options = {}) {
    const { ensureVariety = true, avoidRepeats = true } = options;
    const questions = [];
    const usedCombinations = new Set();
    let lastA = null;
    
    for (let i = 0; i < rounds; i++) {
        let a, b;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            // Выбираем первый множитель
            if (ensureVariety && i < FIRST_MULTIPLIERS.length) {
                // Гарантируем, что каждый первый множитель появится хотя бы раз в начале
                a = FIRST_MULTIPLIERS[i % FIRST_MULTIPLIERS.length];
            } else {
                a = FIRST_MULTIPLIERS[randomInt(0, FIRST_MULTIPLIERS.length - 1)];
            }
            
            // Избегаем повторений подряд
            if (avoidRepeats && a === lastA && attempts < maxAttempts / 2) {
                attempts++;
                continue;
            }
            
            b = randomInt(SECOND_MIN, SECOND_MAX);
            attempts++;
        } while (usedCombinations.has(`${a},${b}`) && attempts < maxAttempts);
        
        questions.push({ a, b });
        usedCombinations.add(`${a},${b}`);
        lastA = a;
    }
    
    return questions;
}

/**
 * Экспортирует константы для обратной совместимости
 */
export {
    FIRST_MULTIPLIERS,
    SECOND_MIN,
    SECOND_MAX,
    DEFAULT_ROUNDS
};