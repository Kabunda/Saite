class MathSprint {
    constructor() {
// Инициализация элементов
        this.elements = {
            problem: document.getElementById('problem'),
            answers: [
                document.getElementById('answer1'),
                document.getElementById('answer2'),
                document.getElementById('answer3'),
                document.getElementById('answer4')
            ],
            result: document.getElementById('result'),
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            highscore: document.getElementById('highscore'),
            level: document.getElementById('level'),
            startBtn: document.getElementById('startBtn'),
            resetBtn: document.getElementById('resetBtn'),
            checkBtn: document.getElementById('checkBtn'),
            closeHnt: document.getElementById('closeHnt'),
            hintModal: document.getElementById('hintModal'),
            correctNumbers: document.getElementById('correctNumbers')
        };
// Состояние игры
        this.state = {
            timeLeft: 180,
            score: 0,
            level: 1,
            intervalId: null,
            isPlaying: false,
            timeoutId: null
        };
        this.state.highscore = (() => {
            try {
                return JSON.parse(localStorage.getItem('highscore_nei')) || { 
                    value: 0, 
                    date: "не установлен", 
                    name: "неизвестен" 
                };
            } catch {
                return { value: 0, date: "не установлен", name: "неизвестен" };
            }
        })();
// Экранные блоки
        this.screens = {
            start: document.getElementById('startScreen'),
             game: document.getElementById('gameScreen'),
              end: document.getElementById('endScreen')
        };

        this.init();
    }

    init() {
// Настройка событий
        this.elements.resetBtn.addEventListener('click', () => this.resetGame());
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.checkBtn.addEventListener('click', () => this.processAnswer());
        this.elements.closeHnt.addEventListener('click', () => this.elements.hintModal.classList.add('hidden'));
// Обработчики ввода
        this.elements.answers.forEach(input => {
            input.addEventListener('input', (e) => this.handleInput(e));
        });
// Добавляем обработчики нажатия Enter
        this.elements.answers.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.processAnswer();
            });
        });
        this.updateHighscoreDisplay();
// Очистка таймера при закрытии        
//        this.elements.closeHnt.addEventListener('click', () => {
//            clearTimeout(this.state.timeoutId);
//            this.elements.hintModal.classList.add('hidden');
//        });
    }

    // Основные методы
    startGame() {
        const selectedTime = parseInt(document.querySelector('input[name="time"]:checked').value);
        this.state.timeLeft = selectedTime;
        this.resetGameState();
        this.toggleScreens('game');
        this.startTimer();
        this.generateProblem();
    }

    toggleScreens(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.add('hidden'));
        this.screens[screenName].classList.remove('hidden');
    }

    handleInput(e) {
        if (!this.state.isPlaying) return; 
        // Автопереход между полями
        const index = this.elements.answers.indexOf(e.target);
        if (e.target.value.length === 2 && index < 3) {
            this.elements.answers[index + 1].focus();
        }
        if (e.target.value.length === 2 && index === 3) {
            this.processAnswer();
        }
    }

    processAnswer() {
        const userNumbers = this.elements.answers.map(input => {
            const value = parseInt(input.value);
            return isNaN(value) ? -1 : value; // Невалидные значения станут -1
        });
        userNumbers.push(this.currentNumber);
        userNumbers.sort((a, b) => a - b);
        const sortedCorrect = [...this.correctNumbers].sort((a, b) => a - b);
        const isCorrect = JSON.stringify(userNumbers) === JSON.stringify(sortedCorrect);
        isCorrect ? this.handleCorrectAnswer() : this.handleWrongAnswer();
    }

    // Вспомогательные методы
    resetGameState() {
        this.state.isPlaying = true;
        this.state.score = 0;
        this.state.level = 1;
        this.elements.answers.forEach(input => input.value = '');
        this.updateUI();

        //document.getElementById('playerName').value = ''; // Очистка имени
        this.elements.answers.forEach(input => input.value = ''); // Очистка полей
    }

    updateHighscoreDisplay() {
        this.elements.highscore.innerHTML = this.state.highscore.value > 0 
            ? `🏆 Рекорд: ${this.state.highscore.value}<br>
               📛 Имя: ${this.state.highscore.name}<br>
               📅 Дата: ${this.state.highscore.date}`
            : "🏆 Рекорд не установлен";
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
        this.elements.answers.forEach(input => input.value = '');
        this.elements.answers[0].focus({preventScroll: true}); // Фикс скролла на iOS
    }

    handleCorrectAnswer() {
        this.state.score += this.state.level * 50;
        this.state.level++;
        this.updateUI();
        this.showResult(this.currentNumber, 'correct');
        this.generateProblem();
    }

    handleWrongAnswer() {
        this.state.score = Math.max(0, this.state.score - 30);
        this.state.level = Math.max(1, this.state.level - 1);
        this.updateUI();
        this.showResult(this.currentNumber, 'wrong');
        this.generateProblem();
    }

    showResult(text, className) {
        this.elements.correctNumbers.textContent = this.correctNumbers.join(' ');
        this.elements.hintModal.classList.remove('hidden');
        this.elements.hintModal.classList.add(className);
        this.state.timeoutId = setTimeout(() => {
            this.elements.hintModal.classList.remove(className);
            this.elements.hintModal.classList.add('hidden');
        }, 3000);
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
        // Сбрасываем состояние
        this.state.score = 0;
        this.state.level = 1;
        this.state.isPlaying = false;
        this.updateUI();    
        this.screens.end.classList.add('hidden');
        this.screens.start.classList.remove('hidden');
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
        for(let i = -2; i <= 2; i++) {
            let neighborIndex = (index + i + wheelLayout.length) % wheelLayout.length;
            neighbors.push(wheelLayout[neighborIndex]);
        }
        return neighbors;
    }

}

new MathSprint();
