// Логика игры - управление состоянием игры
import { PENALTY_PER_MISTAKE } from '../utils/constants.js';

export class GameLogic {
    /**
     * Создает экземпляр игры
     * @param {Array} questions - массив вопросов {a, b}
     */
    constructor(questions) {
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            throw new Error('GameLogic: questions must be a non-empty array');
        }
        
        this.questions = questions;
        this.reset();
    }
    
    /**
     * Сбрасывает состояние игры
     */
    reset() {
        this.currentIndex = 0;
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.mistakes = [];
        this.answersLog = [];
        this.startTime = null;
        this.endTime = null;
        this.isActive = false;
    }
    
    /**
     * Начинает игру (запускает таймер)
     */
    start() {
        if (this.isActive) {
            console.warn('GameLogic: игра уже активна');
            return;
        }
        
        this.startTime = Date.now();
        this.isActive = true;
        console.log(`GameLogic: игра начата с ${this.questions.length} вопросами`);
    }
    
    /**
     * Завершает игру (останавливает таймер)
     */
    finish() {
        if (!this.isActive) {
            console.warn('GameLogic: игра не активна');
            return;
        }
        
        this.endTime = Date.now();
        this.isActive = false;
        console.log(`GameLogic: игра завершена, результат: ${this.score}/${this.questions.length}`);
    }
    
    /**
     * Проверяет ответ на текущий вопрос
     * @param {number} userAnswer - ответ игрока
     * @returns {Object} результат {isCorrect, correctAnswer, streak, bestStreak}
     */
    checkAnswer(userAnswer) {
        if (!this.isActive) {
            throw new Error('GameLogic: игра не активна');
        }
        
        if (this.isFinished()) {
            throw new Error('GameLogic: игра уже завершена');
        }
        
        const currentQuestion = this.getCurrentQuestion();
        if (!currentQuestion) {
            throw new Error('GameLogic: текущий вопрос не найден');
        }
        
        const { a, b } = currentQuestion;
        const correctAnswer = a * b;
        const isCorrect = userAnswer === correctAnswer;
        
        // Обновляем статистику
        if (isCorrect) {
            this.score++;
            this.streak++;
            if (this.streak > this.bestStreak) {
                this.bestStreak = this.streak;
            }
        } else {
            this.streak = 0;
            this.mistakes.push({
                question: { a, b },
                userAnswer,
                correctAnswer,
                timestamp: Date.now()
            });
        }
        
        // Сохраняем в историю
        this.answersLog.push({
            question: { a, b },
            userAnswer,
            isCorrect,
            timestamp: Date.now()
        });
        
        return {
            isCorrect,
            correctAnswer,
            streak: this.streak,
            bestStreak: this.bestStreak,
            question: { a, b }
        };
    }
    
    /**
     * Переходит к следующему вопросу
     * @returns {Object|null} следующий вопрос {a, b} или null если игра завершена
     */
    nextQuestion() {
        if (!this.isActive) {
            throw new Error('GameLogic: игра не активна');
        }
        
        if (this.isFinished()) {
            return null;
        }
        
        this.currentIndex++;
        
        if (this.isFinished()) {
            this.finish();
            return null;
        }
        
        return this.getCurrentQuestion();
    }
    
    /**
     * Возвращает текущий вопрос
     * @returns {Object|null} {a, b} или null если игра завершена
     */
    getCurrentQuestion() {
        if (this.currentIndex >= this.questions.length) {
            return null;
        }
        
        return this.questions[this.currentIndex];
    }
    
    /**
     * Возвращает индекс текущего вопроса (0-based)
     * @returns {number}
     */
    getCurrentQuestionIndex() {
        return this.currentIndex;
    }
    
    /**
     * Возвращает общее количество вопросов
     * @returns {number}
     */
    getTotalQuestions() {
        return this.questions.length;
    }
    
    /**
     * Проверяет, завершена ли игра
     * @returns {boolean}
     */
    isFinished() {
        return this.currentIndex >= this.questions.length;
    }
    
    /**
     * Возвращает прогресс игры (0-1)
     * @returns {number}
     */
    getProgress() {
        return this.questions.length > 0 ? this.currentIndex / this.questions.length : 0;
    }
    
    /**
     * Возвращает статистику игры
     * @returns {Object} статистика
     */
    getStats() {
        const totalTime = this.getTotalTime();
        const penaltyTime = this.mistakes.length * PENALTY_PER_MISTAKE;
        const totalTimeWithPenalty = totalTime + penaltyTime;
        
        return {
            score: this.score,
            totalRounds: this.questions.length,
            accuracy: this.questions.length > 0 ? (this.score / this.questions.length) * 100 : 0,
            streak: this.streak,
            bestStreak: this.bestStreak,
            mistakes: [...this.mistakes],
            mistakesCount: this.mistakes.length,
            answersLog: [...this.answersLog],
            startTime: this.startTime,
            endTime: this.endTime,
            totalTime,
            penaltyTime,
            totalTimeWithPenalty,
            isActive: this.isActive,
            isFinished: this.isFinished()
        };
    }
    
    /**
     * Возвращает общее время игры в секундах
     * @returns {number}
     */
    getTotalTime() {
        if (!this.startTime) {
            return 0;
        }
        
        const endTime = this.endTime || Date.now();
        return (endTime - this.startTime) / 1000;
    }
    
    /**
     * Возвращает отформатированное время игры
     * @returns {string} "MM:SS"
     */
    getFormattedTime() {
        const totalSeconds = Math.floor(this.getTotalTime());
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Возвращает вопросы, на которые были даны неправильные ответы
     * @returns {Array}
     */
    getIncorrectQuestions() {
        return this.mistakes.map(mistake => mistake.question);
    }
    
    /**
     * Возвращает процент правильных ответов
     * @returns {number}
     */
    getAccuracy() {
        if (this.questions.length === 0) return 0;
        return (this.score / this.questions.length) * 100;
    }
}

/**
 * Создает экземпляр игры с вопросами
 * @param {number} rounds - количество вопросов
 * @param {boolean} unique - использовать уникальные вопросы
 * @returns {Promise<GameLogic>}
 */
export async function createGame(rounds, unique = true) {
    // Динамический импорт для избежания циклических зависимостей
    const { buildUniqueQuestionList, buildQuestionList } = await import('./taskGenerator.js');
    
    const questions = unique 
        ? buildUniqueQuestionList(rounds)
        : buildQuestionList(rounds);
    
    return new GameLogic(questions);
}

/**
 * Рассчитывает штрафное время
 * @param {number} mistakes - количество ошибок
 * @param {number} totalTime - общее время в секундах
 * @returns {number} итоговое время с штрафами
 */
export function calculatePenaltyTime(mistakes, totalTime) {
    return totalTime + (mistakes * PENALTY_PER_MISTAKE);
}

/**
 * Форматирует результат для таблицы лидеров
 * @param {Object} gameStats - статистика игры
 * @param {string} playerName - имя игрока
 * @returns {Object} данные для сохранения
 */
export function formatResultForLeaderboard(gameStats, playerName) {
    return {
        playerName,
        score: gameStats.score,
        rounds: gameStats.totalRounds,
        totalTimeSec: gameStats.totalTime,
        totalTimeWithPenalty: gameStats.totalTimeWithPenalty,
        bestStreak: gameStats.bestStreak,
        accuracy: gameStats.accuracy,
        mistakes: gameStats.mistakesCount,
        timestamp: Date.now()
    };
}