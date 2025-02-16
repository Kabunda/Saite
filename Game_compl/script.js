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
        this.elements.timeSelect = document.querySelector('input[name="time"]:checked');
        this.state = {
            timeLeft: 180,
            score: 0,
            highscore: JSON.parse(localStorage.getItem('highscore')) || { value: 0, date: null },
            level: 1,
            intervalId: null,
            isPlaying: false
        };

        this.screens = {
            start: document.getElementById('startScreen'),
            game: document.querySelector('.game-screen'),
            end: document.getElementById('endScreen')
        };

        this.init();
    }

    init() {
        document.querySelector('.restart').addEventListener('click', () => this.resetGame());
        // Обновляем отображение рекорда с учетом нового формата
        this.elements.highscore.textContent = `🏆 ${this.state.highscore.value.toString().padStart(3, '0')}`;
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.answer.addEventListener('input', (e) => this.checkAnswer(e));
    }

    startGame() {

        // Получение выбранного времени
            const selectedTime = parseInt(document.querySelector('input[name="time"]:checked').value);
        this.screens.start.classList.add('hidden');
        this.screens.game.classList.remove('hidden');
        if (this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        this.state.timeLeft = selectedTime;
        this.state.score = 0;
        this.state.level = 1;
        
                    // Обновление отображения таймера
        this.elements.timer.textContent = 
            `${Math.floor(selectedTime / 60).toString().padStart(2, '0')}:` +
            `${(selectedTime % 60).toString().padStart(2, '0')}`;

        this.updateUI();
        this.generateProblem();
        this.startTimer();
    }

    startTimer() {
        this.state.intervalId = setInterval(() => {
            this.state.timeLeft--;
            this.elements.timer.textContent = 
                `${Math.floor(this.state.timeLeft / 60).toString().padStart(2, '0')}:` +
                `${(this.state.timeLeft % 60).toString().padStart(2, '0')}`;

            if (this.state.timeLeft <= 0) this.gameOver();
        }, 1000);
    }

    generateProblem() {
        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
        const s_v = document.querySelector('input[name="stavka_viplata"]:checked').value;
        const m = [10, 100, 200, 300, 25, 50, 75, 125, 150, 175, 225, 250, 275];
        const ranges = { easy: [0, 3], medium: [0, 6], hard: [2, 12] };
        
        const a = m[this.getRandom(...ranges[difficulty])];
        const b = this.getRandom(0, 36);
        
        const multipliers = {
            stavka: this.c_stavka(b),
            viplata: this.c_coplit(b),
            s_v: this.c_stavka(b) + this.c_coplit(b)
        };

        this.currentAnswer = a * multipliers[s_v];
        this.elements.problem.textContent = `${b} по ${a}`;
        this.elements.answer.value = '';
        this.elements.answer.focus();
    }

    checkAnswer(e) {
        if (!this.state.isPlaying) return;
        const userAnswer = parseFloat(e.target.value);

        if (parseInt(userAnswer) === this.currentAnswer) {
            this.handleCorrectAnswer();
        } else if (userAnswer.toString().length >= this.currentAnswer.toString().length) {
            this.handleWrongAnswer();
        }
    }

    handleCorrectAnswer() {
        this.state.score += this.state.level * 10;
        this.state.level++;
        this.updateUI();
        this.showResult('✓ Верно!', 'correct');
        setTimeout(() => this.generateProblem(), 300);
    }

    handleWrongAnswer() {
        this.state.score = Math.max(0, this.state.score - 5);
        this.state.level = Math.max(1, this.state.level - 1);
        this.updateUI();
        this.showResult('✕ Неверно!', 'wrong');
    }

    showResult(text, className) {
        this.elements.result.textContent = text;
        this.elements.result.className = className;
        this.elements.answer.value = '';
    }

    updateUI() {
        this.elements.score.textContent = this.state.score;
        this.elements.level.textContent = this.state.level;
    }

    gameOver() {
        clearInterval(this.state.intervalId);
        this.state.isPlaying = false;
        
        // Проверяем и сохраняем рекорд с датой
        if (this.state.score > this.state.highscore.value) {
            const recordData = {
                value: this.state.score,
                date: new Date().toLocaleString('ru-RU')
            };
            localStorage.setItem('highscore', JSON.stringify(recordData));
            this.state.highscore = recordData;
            // Обновляем отображение на стартовом экране
            this.elements.highscore.textContent = `🏆 ${recordData.value.toString().padStart(3, '0')}`;
        }

        this.screens.game.classList.add('hidden');
        this.screens.end.classList.remove('hidden');
        
        document.getElementById('finalScore').textContent = this.state.score;
        document.getElementById('finalHighscore').textContent = this.state.highscore.value;
    }

    resetGame() {
        clearInterval(this.state.intervalId);
        this.state.score = 0;
        this.state.level = 1;
        this.state.isPlaying = false;
        this.updateUI();
        this.screens.end.classList.add('hidden');
        this.screens.start.classList.remove('hidden');
        this.elements.timer.textContent = '03:00';
    }

    getRandom(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    c_coplit(num) {
        const rules = {
            0: 235,
            1: 297,
            2: 396,
            3: 297,
            34: 198,
            35: 264,
            36: 198
        };
        return rules[num] || ((num - 5) % 3 === 0 ? 392 : 294);
    }

    c_stavka(num) {
        const rules = {
            0: 17,
            1: 27,
            2: 36,
            3: 27,
            34: 18,
            35: 24,
            36: 18
        };
        return rules[num] || ((num - 5) % 3 === 0 ? 40 : 30);
    }
}

new MathSprint();