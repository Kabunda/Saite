// game-multiple.js
class MultipleGame {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.correctAnswers = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.answersHistory = [];
        this.timerInterval = null;
        this.elapsedTime = 0;
    }

    init() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.correctAnswers = 0;
        this.answersHistory = [];
        this.elapsedTime = 0;
        
        // Генерация 20 вопросов на умножение (числа от 2 до 9)
        for (let i = 0; i < 20; i++) {
            const a = Math.floor(Math.random() * 8) + 2;
            const b = Math.floor(Math.random() * 8) + 2;
            this.questions.push({
                question: `${a} × ${b}`,
                correctAnswer: a * b
            });
        }
        
        // Обновляем счетчик вопросов
        document.getElementById('questionCounter').textContent = '1/20';
        document.getElementById('score').textContent = '0';
    }

    start() {
        this.startTime = Date.now();
        
        // Запускаем таймер
        this.timerInterval = setInterval(() => {
            this.elapsedTime = (Date.now() - this.startTime) / 1000;
            document.getElementById('level').textContent = this.formatTime(this.elapsedTime);
        }, 100);
        
        this.showQuestion();
    }

    showQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            this.finishGame();
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        const questionElement = `
            <div class="question">${question.question} = ?</div>
            <input type="number" id="answerInput" class="answer-input" placeholder="Ваш ответ">
        `;
        
        document.getElementById('gameContent').innerHTML = questionElement;
        document.getElementById('questionCounter').textContent = 
            `${this.currentQuestionIndex + 1}/20`;
        
        // Фокус на поле ввода
        setTimeout(() => {
            const input = document.getElementById('answerInput');
            if (input) {
                input.focus();
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById('checkBtn').click();
                    }
                });
            }
        }, 100);
    }

    checkAnswer() {
        const input = document.getElementById('answerInput');
        const userAnswer = parseInt(input.value);
        
        if (isNaN(userAnswer)) {
            this.showMessage("Введите число!", "error");
            return false;
        }

        const currentQuestion = this.questions[this.currentQuestionIndex];
        const isCorrect = userAnswer === currentQuestion.correctAnswer;
        
        // Сохраняем историю ответов
        this.answersHistory.push({
            question: currentQuestion.question,
            userAnswer: userAnswer,
            correctAnswer: currentQuestion.correctAnswer,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            this.correctAnswers++;
            this.showMessage("Правильно!", "success");
        } else {
            this.showMessage(`Неверно! Правильный ответ: ${currentQuestion.correctAnswer}`, "error");
        }

        this.currentQuestionIndex++;
        
        // Обновляем счет
        document.getElementById('score').textContent = this.correctAnswers;
        
        // Показываем следующий вопрос после задержки
        setTimeout(() => {
            this.showQuestion();
        }, 1500);
        
        return isCorrect;
    }

    showMessage(text, type) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = text;
        messageElement.className = `hintContainer ${type}`;
    }

    finishGame() {
        clearInterval(this.timerInterval);
        this.endTime = Date.now();
        const totalTime = (this.endTime - this.startTime) / 1000; // в секундах
        
        // Сохраняем результаты
        if (typeof saveResult === 'function') {
            const playerName = document.getElementById('playerName').value || 'Аноним';
            saveResult(playerName, totalTime, this.correctAnswers, 'multiple');
        }
        
        // Показываем экран завершения
        showEndScreen(totalTime, this.answersHistory);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Создаем экземпляр игры
const multipleGame = new MultipleGame();