import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

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
            endBtn: document.getElementById('endBtn'),
            hintModal: document.getElementById('hintModal'),
            correctNumbers: document.getElementById('correctNumbers')
        };
// Состояние игры
        this.state = {
            highscores: [],
            timeLeft: 180,
            score: 0,
            level: 1,
            intervalId: null,
            isPlaying: false,
            timeoutId: null
        };
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
        this.elements.endBtn.addEventListener('click', () => this.gameOver());
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
        this.fetchGlobalHighscore();
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
            return isNaN(value) ? -1 : value;
        });
        
        // Проверка абсолютно правильного порядка
        const isCorrectAbs = JSON.stringify(userNumbers) === JSON.stringify(this.correctNumbers);
        
        // Проверка наличия всех чисел (без учета порядка)
        const sortedUser = [...userNumbers, this.currentNumber].sort((a, b) => a - b);
        const sortedCorrect = [...this.correctNumbers, this.currentNumber].sort((a, b) => a - b);
        const isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
        
        isCorrect ? this.handleCorrectAnswer(isCorrectAbs) : this.handleWrongAnswer();
    }

    // Вспомогательные методы
    resetGameState() {
        this.state.isPlaying = true;
        this.state.score = 0;
        this.state.level = 1;
        this.elements.answers.forEach(input => input.value = '');
        this.updateUI();
    }

    updateHighscoreDisplay() {
        const list = document.getElementById('highscoreList');
        list.innerHTML = ""; // Очищаем список
        if (this.state.highscores?.length > 0) {
            this.state.highscores.forEach((record, index) => {
                const li = document.createElement('div');
                li.innerHTML = `
                    <div id = "hs_nam">${record.name}</div> 
                    <div id = "hs_val">${record.value}</div> 
                    <div id = "hs_dat">${record.date}</div>
                `;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = "<li>Рекорды не найдены</li>";
        }
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
        this.correctNumbers = this.getNeighbors(this.currentNumber, 4);
        this.elements.answers.forEach(input => input.value = '');
        this.elements.answers[0].focus({preventScroll: true}); // Фикс скролла на iOS
    }

    handleCorrectAnswer(isCorrectAbs) {
        const basePoints = this.state.level * 50;
        // +50% бонус за правильный порядок
        this.state.score += isCorrectAbs ? Math.floor(basePoints * 1.5) : basePoints;
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
        const fullNeighbors = this.getNeighbors(this.currentNumber, 5); // 5 чисел с центральным
        this.elements.correctNumbers.textContent = fullNeighbors.join(' ');
        this.elements.hintModal.classList.remove('hidden');
        this.elements.hintModal.classList.add(className);
        this.state.timeoutId = setTimeout(() => {
            this.elements.hintModal.classList.remove(className);
            this.elements.hintModal.classList.add('hidden');
        }, 2500);
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
        document.getElementById('finalHighscore').textContent = this.state.highscores[0]?.value || 0;
    }

    async resetGame() {
        clearInterval(this.state.intervalId);
        const finalScore = this.state.score;
        const playerName = document.getElementById('playerName').value.trim() || "Аноним";
            const recordData = {
                value: finalScore,
                name: playerName,
                date: new Date().toLocaleString("ru-RU")
            };

            try {
                await addDoc(
                    collection(db, "records"), 
                    recordData
                );
                await this.fetchGlobalHighscore();
            } catch (error) {
                console.error("Ошибка сохранения:", error);
            }
        this.state.score = 0;
        this.state.level = 1;
        this.state.isPlaying = false;
        this.updateUI();    
        this.screens.end.classList.add('hidden');
        this.screens.start.classList.remove('hidden');
    }

    async fetchGlobalHighscore() {
        try {
            const recordsRef = collection(db, "records");
            const q = query(
                recordsRef, 
                orderBy("value", "desc"), 
                limit(10)
            );
            const snapshot = await getDocs(q);
            this.state.highscores = []; // Теперь храним массив
            snapshot.forEach(doc => {
                this.state.highscores.push(doc.data());
            });
            this.updateHighscoreDisplay();
        } catch (error) {
            console.error("Ошибка загрузки рекорда:", error);
        }
    }

    getRandom(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    getNeighbors(num, format) {
        const wheelLayout = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
            11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
            22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        
        const index = wheelLayout.indexOf(num);
        const neighbors = [];
        
        // Для формата 4: два предыдущих и два следующих (без центрального)
        const range = (format === 4) ? [-2, -1, 1, 2] : [-2, -1, 0, 1, 2];
        
        range.forEach(i => {
            const neighborIndex = (index + i + wheelLayout.length) % wheelLayout.length;
            neighbors.push(wheelLayout[neighborIndex]);
        });
        
        return neighbors;
    }

}

new MathSprint();
