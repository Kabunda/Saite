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
            timeLeft: 180,
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
        this.state.timeLeft = 180;
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
        const s_v = document.querySelector('input[name="stavka_viplata"]:checked').value;
        let a, b;
        const m = [10, 100, 200, 300, 25, 50, 75, 125, 150, 175, 225, 250, 275];
        switch(difficulty) {
            case 'easy':
                a = m[this.getRandom(0, 3)];
                b = this.getRandom(0, 36);
                break;
            case 'medium':
                a = m[this.getRandom(0, 6)];
                b = this.getRandom(0, 36);
                break;
            case 'hard':
                a = m[this.getRandom(2, 12)];
                b = this.getRandom(0, 36);
                break;
        }
        switch(s_v) {
            case 'stavka':
                this.currentAnswer = a * this.c_stavka(b);
                break;
            case 'viplata':
                this.currentAnswer = a * this.c_coplit(b);
                break;
            case 's_v':
                this.currentAnswer = a * this.c_stavka(b) + a * this.c_coplit(b);
                break;
        }
        this.elements.problem.textContent = `${b} по ${a}`;
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

    c_coplit(num){
        let ans = 0
        if (num == 0) {
            ans = 235
        } else if (num == 1 || num == 3) {
            ans = 297
        } else if (num == 2) {
            ans = 396
        } else if (num == 34 || num == 36){
            ans = 198
        } else if (num == 35) {
            ans = 264
        } else if ((num - 5) % 3 == 0) {
            ans = 392
        } else {
            ans = 294
        }
        return ans;
    }
    c_stavka(num){
        let ans = 0
        if (num == 0) {
            ans = 17
        } else if (num == 1 || num == 3) {
            ans = 27
        } else if (num == 2) {
            ans = 36
        } else if (num == 34 || num == 36){
            ans = 18
        } else if (num == 35) {
            ans = 24
        } else if ((num - 5) % 3 == 0) {
            ans = 40
        } else {
            ans = 30
        }
        return ans;
    }

}

// Запуск игры
new MathSprint();
