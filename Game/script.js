class MathSprint {
    constructor() {
        this.elements = {
            problem: document.getElementById('problem'),
            answer: document.getElementById('answer'),
            result: document.getElementById('result'),
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            highscore: document.getElementById('highscore'),
            level: document.getElementById('level'),
            startBtn: document.getElementById('startBtn')
        };

        this.state = {
            timeLeft: 60,
            score: 0,
            highscore: localStorage.getItem('highscore') || 0,
            level: 1,
            intervalId: null,
            isPlaying: false
        };

        this.init();
    }

    init() {
        this.elements.highscore.textContent = this.state.highscore;
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.answer.addEventListener('input', (e) => this.checkAnswer(e));
    }

    startGame() {
        if (this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        this.state.timeLeft = 60;
        this.state.score = 0;
        this.state.level = 1;
        
        this.updateUI();
        this.elements.startBtn.disabled = true;
        this.generateProblem();
        this.startTimer();
    }

    startTimer() {
        this.state.intervalId = setInterval(() => {
            this.state.timeLeft--;
            this.elements.timer.textContent = 
                `${String(Math.floor(this.state.timeLeft / 60)).padStart(2, '0')}:` +
                `${String(this.state.timeLeft % 60).padStart(2, '0')}`;

            if (this.state.timeLeft <= 0) this.gameOver();
        }, 1000);
    }

    generateProblem() {
        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
        let a, b;
        const m = [5, 11, 8, 17, 35];
        switch(difficulty) {
            case 'easy':
                a = m[this.getRandom(0, 4)];
                b = this.getRandom(2, 10);
                break;
            case 'medium':
                a = m[this.getRandom(0, 4)];
                b = this.getRandom(3, 20);
                break;
            case 'hard':
                a = m[this.getRandom(2, 4)];
                b = this.getRandom(3, 20);
                break;
        }

        this.currentAnswer = a * b;
        this.elements.problem.textContent = `${a} × ${b}`;
        this.elements.answer.value = '';
        this.elements.answer.focus();
    }

    checkAnswer(e) {
        if (!this.state.isPlaying) return;

        const userAnswer = parseFloat(e.target.value);
        if (Math.abs(userAnswer - this.currentAnswer) < 0.01) {
            this.handleCorrectAnswer();
        } else if (userAnswer.toString().length >= this.currentAnswer.toString().length) {
            this.handleWrongAnswer();
        }
    }

    handleCorrectAnswer() {
        this.state.score += this.state.level * 10;
        this.state.level++;
        this.updateUI();
        this.elements.result.textContent = '✓ Верно!';
        this.elements.result.className = 'correct';
        setTimeout(() => this.generateProblem(), 300);
    }

    handleWrongAnswer() {
        this.state.score = Math.max(0, this.state.score - 5);
        this.state.level = Math.max(1, this.state.level - 1);
        this.updateUI();
        this.elements.result.textContent = '✕ Неверно!';
        this.elements.result.className = 'wrong';
        this.elements.answer.value = '';
    }

    updateUI() {
        this.elements.score.textContent = this.state.score;
        this.elements.level.textContent = this.state.level;
    }

    gameOver() {
        clearInterval(this.state.intervalId);
        this.state.isPlaying = false;
        this.elements.startBtn.disabled = false;
        
        if (this.state.score > this.state.highscore) {
            this.state.highscore = this.state.score;
            localStorage.setItem('highscore', this.state.highscore);
            this.elements.highscore.textContent = this.state.highscore;
        }
        
        this.elements.problem.textContent = 'Всё!';
        this.elements.answer.value = '';
        this.elements.result.textContent = `Ваш результат: ${this.state.score} очков`;
    }

    getRandom(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

// Запуск игры
new MathSprint();
