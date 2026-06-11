// Генератор уникальных текстовых вопросов (умножение)
export const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
export const SECOND_MIN = 2;
export const SECOND_MAX = 20;

/**
 * Возвращает массив уникальных вопросов.
 * Каждый вопрос: { text: string, answer: number }
 * @param {number} rounds - количество вопросов
 * @returns {Array<{text: string, answer: number}>}
 */
export function buildUniqueQuestionList(rounds) {
  // Генерируем все возможные комбинации множителей
  const all = [];
  for (const a of FIRST_MULTIPLIERS) {
    for (let b = SECOND_MIN; b <= SECOND_MAX; b++) {
      all.push({
        text: `${a} × ${b} = ?`,
        answer: a * b
      });
    }
  }

  // Перемешивание (Fisher–Yates)
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

// Генератор случайных примеров на умножение (таблица до 10)
export function generateMultiplicationQuestion() {
  const a = Math.floor(Math.random() * 9) + 2; // 2..10
  const b = Math.floor(Math.random() * 9) + 2; // 2..10
  return {
    text: `${a} × ${b}`,
    answer: a * b
  };
}