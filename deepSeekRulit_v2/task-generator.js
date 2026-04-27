export const FIRST_MULTIPLIERS = [5, 8, 11, 17, 35];
export const SECOND_MIN = 2;
export const SECOND_MAX = 20;
export const DEFAULT_ROUNDS = 20;

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

export function buildUniqueQuestionList(rounds = DEFAULT_ROUNDS) {
  const all = [];
  for (const a of FIRST_MULTIPLIERS) {
    for (let b = SECOND_MIN; b <= SECOND_MAX; b++) {
      all.push({ a, b });
    }
  }
  // Перемешивание
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

export function isCorrectAnswer(a, b, answer) {
  return a * b === answer;
}