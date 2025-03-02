import { db, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from './firebase.js';

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
            isTimeout: false,
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

        const currentInput = e.target;
        const index = this.elements.answers.indexOf(currentInput);
        const inputValue = currentInput.value;

        // Ограничиваем ввод двумя цифрами
        if (inputValue.length > 2) {
            currentInput.value = inputValue.slice(0, 2);
            return;
        }

        // Автопереход только при добавлении символов
        if (inputValue.length === 2) {
            let nextIndex = -1;

            // Ищем следующее поле, начиная с текущего (включая текущее)
            for (let i = index; i < this.elements.answers.length; i++) {
                if (i === index) continue; // Пропускаем текущее поле
                if (this.elements.answers[i].value.length < 2) {
                    nextIndex = i;
                    break;
                }
            }

            // Если не нашли - проверяем с начала
            if (nextIndex === -1) {
                for (let i = 0; i < index; i++) {
                    if (this.elements.answers[i].value.length < 2) {
                        nextIndex = i;
                        break;
                    }
                }
            }

            if (nextIndex !== -1) {
                this.elements.answers[nextIndex].focus();
            } else {
                // Все поля заполнены - отправляем ответ
                if (this.elements.answers.every(a => a.value.length === 2)) {
                    this.processAnswer();
                }
            }
        }

        /*// Автоматический бэкспейс
        if (inputValue.length === 0 && index > 0) {
            this.elements.answers[index - 1].focus();
        }*/
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
        if (this.state.isTimeout) this.gameOver();
    }

    resetGameState() {
        this.state.isPlaying = true;
        this.state.score = 0;
        this.state.level = 1;
        this.elements.answers.forEach(input => input.value = '');
        this.updateUI();
    }

    updateHighscoreDisplay() {
      const list = document.getElementById('highscoreList');
      list.innerHTML = "";

      this.state.highscores.forEach((record) => {
        const li = document.createElement('div');

        // Создаем элементы безопасно
        const nameDiv = document.createElement('div');
        nameDiv.className = "hs_nam";
        nameDiv.textContent = record.name; // textContent экранирует HTML

        const levelDisplay = record.level ? record.level : "空";
        const valueDiv = document.createElement('div');
        valueDiv.className = "hs_val";
        valueDiv.textContent = `${record.value} ${levelDisplay}`;

        const dateDiv = document.createElement('div');
        dateDiv.className = "hs_dat";
        if (record.date?.toDate) { // Проверяем, является ли date Timestamp
            const date = record.date.toDate(); // Конвертируем в объект Date
            dateDiv.textContent = date.toLocaleString("ru-RU", {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            // Если date уже строка (для старых записей)
            dateDiv.textContent = record.date || "Дата не указана";
        }

        li.append(nameDiv, valueDiv, dateDiv);
        list.appendChild(li);
      });
    }

    startTimer() {
        this.state.isTimeout = false;
        this.state.intervalId = setInterval(() => {
            this.state.timeLeft--;
            this.elements.timer.textContent = 
                `${Math.floor(this.state.timeLeft / 60).toString().padStart(2, '0')}:` +
                `${(this.state.timeLeft % 60).toString().padStart(2, '0')}`;
            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.intervalId);
                this.state.isTimeout = true;
            }
        }, 1000);
    }

    generateProblem() {
        if (this.state.isTimeout) return;
        this.currentNumber = this.getRandom(0, 36);
        this.elements.problem.textContent = this.currentNumber;
        this.correctNumbers = this.getNeighbors(this.currentNumber);
        this.elements.answers.forEach(input => input.value = '');
        this.elements.answers[0].focus();
    }

    handleCorrectAnswer(isCorrectAbs) {
        let basePoints = this.state.level * 50;
        // +50% бонус за правильный порядок
        basePoints = isCorrectAbs ? Math.floor(basePoints * 1.5) : basePoints;
        // половина за ответ по истечении времени
        basePoints = this.state.isTimeout ? Math.floor(basePoints * 0.5) : basePoints;
        this.state.score += basePoints;
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
        clearTimeout(this.state.timeoutId);
        const fullNeighbors = this.getNeighbors(this.currentNumber, true); // 5 чисел с центральным
        this.elements.correctNumbers.textContent = fullNeighbors.join(' ');
        this.elements.hintModal.classList.remove('correct');
        this.elements.hintModal.classList.remove('wrong');
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
        document.getElementById('playerName').focus();
        document.getElementById('finalScore').textContent = this.state.score;
        document.getElementById('finalHighscore').textContent = this.state.highscores[0]?.value || 0;
    }

    async resetGame() {
        clearInterval(this.state.intervalId);
        const finalScore = this.state.score;
        const finalLevel = this.state.level;
        const playerName = document.getElementById('playerName').value.trim() || "Аноним";
        const sanitizedName = playerName.replace(/<[^>]*>?/gm, ""); // Удаление HTML-тегов
            const recordData = {
                level: finalLevel,
                value: finalScore,
                name: sanitizedName,
                date: serverTimestamp()
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

    getNeighbors(num, includeCentral = false) {
        const wheelLayout = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
            11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
            22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        
        const index = wheelLayout.indexOf(num);
        const neighbors = [];
        
        // Для формата 4: два предыдущих и два следующих (без центрального)
        const range = includeCentral ? [-2, -1, 0, 1, 2] : [-2, -1, 1, 2];
        
        range.forEach(i => {
            const neighborIndex = (index + i + wheelLayout.length) % wheelLayout.length;
            neighbors.push(wheelLayout[neighborIndex]);
        });
        
        return neighbors;
    }
}

new MathSprint();