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
            boost: 1,
            highscore: JSON.parse(localStorage.getItem('highscore_comp')) || { 
                value: 0, 
                date: "не установлен", 
                name: "неизвестен" 
            },
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
        // Обновляем отображение рекорда при загрузке
        this.elements.highscore.innerHTML = this.state.highscore.value > 0 
            ? `🏆 Рекорд: ${this.state.highscore.value} <br>
               📛 Имя: ${this.state.highscore.name} <br>
               📅 Дата: ${this.state.highscore.date}`
            : "🏆 Рекорд не установлен";
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
        const mode = document.querySelector('input[name="mode"]:checked').value;
        let a, b, c;
        const multipliers = [10, 100, 200, 300, 25, 50, 75, 125, 150, 175, 225, 250, 275];
        b = this.getRandom(0, 36);
        switch(difficulty) {
            case 'easy':
                a = multipliers[this.getRandom(0, 3)];
                this.state.boost = 1;
                break;
            case 'medium':
                a = multipliers[this.getRandom(0, 6)];
                this.state.boost = 2;
                break;
            case 'hard':
                a = multipliers[this.getRandom(2, 12)];
                this.state.boost = 3;
                break;
        }
        if (mode == "stavka") {
            c = this.c_stavka(b);
        }   else {
            c = this.c_coplit(b);
        }

        this.currentAnswer = a * c;
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
        this.state.score += this.state.level * 10 * this.state.boost;
        this.state.score += Math.floor(this.currentAnswer / 10);
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
        setTimeout(() => this.generateProblem(), 300);
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
        this.screens.game.classList.add('hidden');
        this.screens.end.classList.remove('hidden');
        document.getElementById('finalScore').textContent = this.state.score;
        document.getElementById('finalHighscore').textContent = this.state.highscore.value;
    }

    resetGame() {
        clearInterval(this.state.intervalId);
        
        // Сохраняем финальный счет перед сбросом
        const finalScore = this.state.score;
        
        // Сбрасываем состояние
        this.state.score = 0;
        this.state.level = 1;
        this.state.isPlaying = false;
        this.updateUI();

        // Получаем имя игрока
        const playerName = document.getElementById('playerName').value.trim() || "Аноним";
        
        // Проверяем и обновляем рекорд
        if (finalScore > this.state.highscore.value) {
            const recordData = {
                value: finalScore,
                date: new Date().toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                name: playerName
            };
                    
                localStorage.setItem('highscore_comp', JSON.stringify(recordData));
                this.state.highscore = recordData;
                
                // Обновляем отображение рекорда
                this.elements.highscore.innerHTML = 
                    `🏆 Рекорд: ${recordData.value} <br>
                    📛 Имя: ${recordData.name} <br>
                    📅 Дата: ${recordData.date}`;
            }
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
