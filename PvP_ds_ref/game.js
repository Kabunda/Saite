import { buildUniqueQuestionList } from './task-generator.js';
import { state, setGameSession, resetMultiplayer } from './state.js';
import { playTone, vibrate } from './audio.js';
import { updateMyProgress } from './multiplayer.js';
import { getPlayerId } from './presence.js';

export class GameSession {
    constructor(questions, isMultiplayer = false) {
        this.questions = questions;          // массив { text, answer }
        this.isMultiplayer = isMultiplayer;
        this.round = 0;
        this.score = 0;
        this.answersLog = [];               // [{ questionText, playerAnswer, correctAnswer, isCorrect }]
        this.streak = 0;
        this.bestStreak = 0;
        this.mistakes = [];
        this.startTime = 0;
        this.finished = false;
    }

    get currentQuestion() {
        return this.questions[this.round];
    }

    submitAnswer(answerValue) {
        // Убрана проверка state.isLocked, чтобы не блокировать саму обработку
        if (this.isFinished()) return;   // игра уже завершена – ничего не делаем
        const correctAnswer = this.currentQuestion.answer;
        const isCorrect = answerValue === correctAnswer;

        this.answersLog.push({
            questionText: this.currentQuestion.text,
            playerAnswer: answerValue,
            correctAnswer,
            isCorrect
        });

        if (isCorrect) {
            this.score++;
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            playTone(880, 0.2);
            vibrate([30]);
            return { correct: true, feedback: "✓ Верно!" };
        } else {
            this.streak = 0;
            this.mistakes.push(this.currentQuestion.text);
            playTone(240, 0.3);
            vibrate([100, 50, 100]);
            return { correct: false, feedback: `✗ Неверно. Правильно: ${correctAnswer}` };
        }
    }

    nextRound() {
        this.round++;
        return this.isFinished();
    }

    isFinished() {
        return this.round >= this.questions.length;
    }

    finish() {
        this.finished = true;
        const totalTimeSec = (Date.now() - this.startTime) / 1000;
        return {
            playerName: state.playerName,
            totalTimeSec,
            score: this.score,
            rounds: this.questions.length,
            bestStreak: this.bestStreak,
            finishedAt: Date.now(),
            answers: this.answersLog
        };
    }

    // Сохранить прогресс в мультиплеере
    async syncProgress(sessionId) {
        if (!this.isMultiplayer || !sessionId) return;
        const answersForFirebase = this.answersLog.map((a, i) => ({ index: i, correct: a.isCorrect }));
        await updateMyProgress(
            sessionId,
            getPlayerId(),
            this.round,
            this.score,
            this.finished,
            (Date.now() - this.startTime) / 1000,
            answersForFirebase
        );
    }
}

export function createSinglePlayerGame(rounds = 20) {
    resetMultiplayer();
    const questions = buildUniqueQuestionList(rounds);
    const session = new GameSession(questions, false);
    session.startTime = Date.now();
    setGameSession(session);
    return session;
}

export function createMultiplayerGame(data) {
    const { sessionId, questions, opponentId, opponentName, startTime } = data;
    const session = new GameSession(questions, true);
    session.startTime = startTime;
    state.multiplayer = {
        active: true,
        sessionId,
        opponentId,
        opponentName,
        startTime
    };
    setGameSession(session);
    return session;
}

export function getCurrentSession() {
    return state.gameSession;
}