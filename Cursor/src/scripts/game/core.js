import { 
  FIRST_MULTIPLIERS, 
  SECOND_MIN, 
  SECOND_MAX, 
  ROUNDS,
  DELAYS 
} from '../utils/constants.js';
import { randomInt } from '../utils/helpers.js';
import { StorageService } from '../services/storage.js';
import { audioService } from '../services/audio.js';

/**
 * Основная логика игры
 */
export class GameCore {
  constructor() {
    this.currentRound = 0;
    this.score = 0;
    this.currentA = 0;
    this.currentB = 0;
    this.currentAnswer = "";
    this.roundStartAt = 0;
    this.elapsedMs = 0;
    this.isLocked = false;
    this.timerIntervalId = null;
    this.progressCells = [];
    this.streak = 0;
    this.bestStreak = 0;
    this.isPaused = false;
    this.currentQuestions = [];
    this.mistakesInCurrentGame = [];
    this.answersLog = [];
  }

  /**
   * Создает список вопросов для игры
   * @returns {Array} массив вопросов
   */
  buildQuestionList() {
    const list = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      list.push({
        a: FIRST_MULTIPLIERS[randomInt(0, FIRST_MULTIPLIERS.length - 1)],
        b: randomInt(SECOND_MIN, SECOND_MAX)
      });
    }
    return list;
  }

  /**
   * Устанавливает текущий вопрос
   */
  setCurrentQuestion() {
    const question = this.currentQuestions[this.currentRound];
    this.currentA = question.a;
    this.currentB = question.b;
    return `${this.currentA} × ${this.currentB} = ?`;
  }

  /**
   * Проверяет ответ
   * @returns {Object} результат проверки
   */
  checkAnswer() {
    const value = Number(this.currentAnswer);
    const correct = this.currentA * this.currentB;
    const isCorrect = value === correct;
    
    this.isLocked = true;
    
    // Логируем ответ
    this.answersLog.push({
      a: this.currentA,
      b: this.currentB,
      playerAnswer: value,
      correctAnswer: correct,
      isCorrect
    });

    if (isCorrect) {
      this.score += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      
      // Воспроизводим звук и вибрацию
      audioService.playCorrectSound();
      audioService.vibrateCorrect();
    } else {
      this.streak = 0;
      this.mistakesInCurrentGame.push({ a: this.currentA, b: this.currentB });
      
      // Воспроизводим звук и вибрацию
      audioService.playIncorrectSound();
      audioService.vibrateIncorrect();
    }

    return {
      isCorrect,
      correctAnswer: correct,
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak
    };
  }

  /**
   * Переходит к следующему вопросу
   * @returns {boolean} true если игра завершена
   */
  nextQuestion() {
    this.currentRound += 1;
    if (this.currentRound >= this.currentQuestions.length) {
      return true; // Игра завершена
    }

    this.isLocked = false;
    this.currentAnswer = "";
    return false; // Игра продолжается
  }

  /**
   * Завершает игру и возвращает результат
   * @returns {Promise<Object>} результат игры
   */
  async finishGame() {
    const runningPart = this.isPaused ? 0 : Date.now() - this.roundStartAt;
    const totalTimeSec = (this.elapsedMs + runningPart) / 1000;
    const playerName = StorageService.getPlayerName();
    
    const result = {
      playerName,
      totalTimeSec,
      score: this.score,
      rounds: this.currentQuestions.length,
      bestStreak: this.bestStreak,
      mistakes: this.mistakesInCurrentGame.length,
      finishedAt: Date.now()
    };
    
    // Сохраняем результат (асинхронно)
    await StorageService.saveResult(result);
    
    return result;
  }

  /**
   * Обрабатывает нажатие клавиши
   * @param {string} key - нажатая клавиша
   * @returns {Object} информация об изменении состояния
   */
  handleKeyPress(key) {
    if (this.isLocked || this.isPaused) {
      return { type: 'ignored' };
    }

    // Легкая вибрация при нажатии
    audioService.vibrateKeyPress();

    if (key === "del") {
      this.currentAnswer = this.currentAnswer.slice(0, -1);
      return { type: 'delete', answer: this.currentAnswer };
    }

    if (key === "clear") {
      this.currentAnswer = "";
      return { type: 'clear', answer: "" };
    }

    if (key === "enter") {
      if (!this.currentAnswer) return { type: 'empty' };
      const result = this.checkAnswer();
      return { type: 'submit', ...result };
    }

    if (this.currentAnswer.length >= 3) {
      return { type: 'max_length' };
    }
    
    this.currentAnswer += key;
    return { type: 'digit', answer: this.currentAnswer };
  }

  /**
   * Начинает новую игру
   */
  startNewGame() {
    this.currentQuestions = this.buildQuestionList();
    this.currentRound = 0;
    this.score = 0;
    this.currentAnswer = "";
    this.elapsedMs = 0;
    this.roundStartAt = Date.now();
    this.isLocked = false;
    this.isPaused = false;
    this.streak = 0;
    this.bestStreak = 0;
    this.mistakesInCurrentGame = [];
    this.answersLog = [];
  }

  /**
   * Переключает паузу
   */
  togglePause() {
    if (this.isLocked) return;
    
    if (this.isPaused) {
      this.roundStartAt = Date.now();
      this.isPaused = false;
    } else {
      this.elapsedMs += Date.now() - this.roundStartAt;
      this.isPaused = true;
    }
    
    return this.isPaused;
  }

  /**
   * Обновляет таймер
   * @returns {Object} информация о времени
   */
  updateTimer() {
    if (!this.roundStartAt && this.elapsedMs === 0) {
      return { formatted: "00:00", totalSec: 0 };
    }
    
    const runningPart = this.isPaused ? 0 : Date.now() - this.roundStartAt;
    const totalSec = Math.floor((this.elapsedMs + runningPart) / 1000);
    
    return { totalSec };
  }

  /**
   * Получает текущий прогресс
   * @returns {Object} информация о прогрессе
   */
  getProgress() {
    return {
      current: this.currentRound + 1,
      total: this.currentQuestions.length,
      score: this.score,
      streak: this.streak,
      bestStreak: this.bestStreak
    };
  }

  /**
   * Получает историю ответов
   * @returns {Array} история ответов
   */
  getAnswersLog() {
    return this.answersLog;
  }
}