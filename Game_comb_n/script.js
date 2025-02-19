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
            highscore: JSON.parse(localStorage.getItem('highscore_nei')) || { 
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
        this.elements.answer.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkAnswer(e);
        });
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
        this.currentNumber = this.getRandom(0, 36);

        this.elements.problem.textContent = this.currentNumber;
        this.correctNumbers = this.getNeighbors(this.currentNumber);

        this.elements.answer.value = '';
        this.elements.answer.focus();
        // Сбрасываем анимацию результата
        //this.elements.result.classList.remove('hidden');
    }

    checkAnswer(e) {
        if (!this.state.isPlaying) return;

        // Для события input (автопроверка)
        if (e.type === 'input') {
            const input = e.target.value;
            // Автопроверка только если введено 4 числа
            if (input.split(/[\s,]+/).filter(x => x).length === 4) {
                this.processAnswer();
            }
            return;
        }

        // Для события нажатия Enter
        if (e.type === 'keypress') {
            this.processAnswer();
        }
    }

    processAnswer() {
        const userNumbers = this.elements.answer.value
            .split(/[\s,]+/)
            .map(Number)
            .filter(n => !isNaN(n) && n >= 0 && n <= 36)
            .slice(0, 4); // Берем только первые 4 числа

        if (userNumbers.length !== 4) {
            this.showResult('Введите 4 числа!', 'wrong');
            return;
        }

        const correct = this.correctNumbers.every(n => userNumbers.includes(n));
        
        if (correct) {
            this.handleCorrectAnswer();
        } else {
            this.handleWrongAnswer();
        }
    }

    handleCorrectAnswer() {
        this.state.score += this.state.level * 50;
        this.state.level++;
        this.updateUI();
        this.showResult('✓ Верно!', 'correct');
        setTimeout(() => {
            this.generateProblem();
            //this.elements.answer.value = ''; // Очищаем поле только после задержки
        }, 300);
    }

    handleWrongAnswer() {
        this.state.score = Math.max(0, this.state.score - 30);
        this.state.level = Math.max(1, this.state.level - 1);
        this.updateUI();
        this.showResult('✕ Неверно!', 'wrong');
        setTimeout(() => {
            this.generateProblem();
            //this.elements.answer.value = ''; // Очищаем поле только после задержки
        }, 300);
    }

    showResult(text, className) {
        
        //this.elements.answer.value = '';
        this.elements.result.textContent = text;
        this.elements.result.className = `${className} visible`;
        
        // Сбрасываем предыдущую анимацию
        this.elements.result.classList.remove('hidden');
        //void this.elements.result.offsetWidth; // Trigger reflow
        
        // Запускаем анимацию исчезновения
        setTimeout(() => {
            this.elements.result.classList.add('hidden');
        }, 1000); // Начинаем исчезать через 1 секунду

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
                    
                localStorage.setItem('highscore_nei', JSON.stringify(recordData));
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

    getNeighbors(num) {
        // Расположение чисел на рулетке по секторам
        const wheelLayout = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
            11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
            22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        
        const index = wheelLayout.indexOf(num);
        const neighbors = [];
        
        // Добавляем 2 соседа слева и 2 справа от числа
        for(let i = -2; i <= 2; i++) {
            if (i != 0) {
                let neighborIndex = (index + i + wheelLayout.length) % wheelLayout.length;
                neighbors.push(wheelLayout[neighborIndex]);
            }
        }
        return neighbors.sort((a, b) => a - b);
    }

}

new MathSprint();
