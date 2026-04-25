/**
 * Модуль генератора задач для тренажера умножения.
 * Экспортирует функции и константы для создания списка задач.
 */

// Конфигурация генерации задач
export const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
export const SECOND_MIN = 2;
export const SECOND_MAX = 20;
export const DEFAULT_ROUNDS = 20;

/**
 * Генерирует случайное целое число в диапазоне [min, max] включительно.
 * @param {number} min - минимальное значение
 * @param {number} max - максимальное значение
 * @returns {number} случайное целое число
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Создает список задач для игры.
 * @param {number} rounds - количество задач (по умолчанию DEFAULT_ROUNDS)
 * @param {number[]} multipliers - массив первых множителей (по умолчанию FIRST_MULTIPLIERS)
 * @param {number} secondMin - минимальное значение второго множителя (по умолчанию SECOND_MIN)
 * @param {number} secondMax - максимальное значение второго множителя (по умолчанию SECOND_MAX)
 * @returns {Array<{a: number, b: number}>} массив объектов с полями a и b
 */
export function buildQuestionList(
  rounds = DEFAULT_ROUNDS,
  multipliers = FIRST_MULTIPLIERS,
  secondMin = SECOND_MIN,
  secondMax = SECOND_MAX
) {
  const list = [];
  for (let i = 0; i < rounds; i += 1) {
    list.push({
      a: multipliers[randomInt(0, multipliers.length - 1)],
      b: randomInt(secondMin, secondMax)
    });
  }
  return list;
}

/**
 * Генерирует уникальные задачи (без повторений) в пределах одного раунда.
 * @param {number} rounds - количество задач
 * @returns {Array<{a: number, b: number}>} массив уникальных задач
 */
export function buildUniqueQuestionList(rounds = DEFAULT_ROUNDS) {
  const all = [];
  for (const a of FIRST_MULTIPLIERS) {
    for (let b = SECOND_MIN; b <= SECOND_MAX; b++) {
      all.push({ a, b });
    }
  }
  // Перемешиваем весь массив
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  // Берём первые rounds штук (гарантированно уникальные)
  return all.slice(0, rounds);
}

/**
 * Проверяет, правильно ли решена задача.
 * @param {number} a - первый множитель
 * @param {number} b - второй множитель
 * @param {number} answer - ответ игрока
 * @returns {boolean} true, если ответ верный
 */
export function isCorrectAnswer(a, b, answer) {
  return a * b === answer;
}
