import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

class MathSprint {
    constructor() {
            // Инициализация элементов
        this.elements = {
            problem: document.getElementById('problem'),
            answers: [
                document.getElementById('answer1'),
                document.getElementById('answer2')
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
        if(e.target.value < 0) e.target.value = '';
    }

    processAnswer() {
        const userNumbers = this.elements.answers.map(input => {
            const value = parseInt(input.value);
            return isNaN(value) ? -1 : value;
        });
        var isCorrect = false;
        if (userNumbers[0] == this.currentStavka && userNumbers[1] == this.currentViplata) 
            isCorrect = true;
        
        isCorrect ? this.handleCorrectAnswer() : this.handleWrongAnswer();
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
        dateDiv.textContent = record.date;

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

        const multipliers = [10, 100, 200, 300, 25, 50, 75, 150, 250];
        const nomer = this.getRandom(0, 36);
        const nominal = multipliers[this.getRandom(0, 8)];

        this.currentStavka = this.c_stavka(nomer) * nominal;
        this.currentViplata = this.c_coplit(nomer) * nominal;

        this.elements.problem.textContent = `${nomer} по ${nominal}`;
        this.elements.answers.forEach(input => input.value = '');
        this.elements.answers[0].focus();
    }

    handleCorrectAnswer() {
        let basePoints = this.state.level * this.currentStavka;
        // половина за ответ по истечении времени
        basePoints = this.state.isTimeout ? Math.floor(basePoints * 0.5) : basePoints;
        this.state.score += basePoints;
        this.state.level++;
        this.updateUI();
        this.showResult('Верно!', 'correct');
        this.generateProblem();
    }

    handleWrongAnswer() {
        this.state.score = Math.max(0, this.state.score - 500);
        this.state.level = Math.max(1, this.state.level - 1);
        this.updateUI();
        this.showResult(`${this.currentStavka} ${this.currentViplata}`, 'wrong');
        this.generateProblem();
    }

    showResult(text, className) {
        clearTimeout(this.state.timeoutId);
        this.elements.correctNumbers.textContent = text;
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
                date: new Date().toLocaleString("ru-RU")
            };

            try {
                await addDoc(
                    collection(db, "records_complit"), 
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
            const recordsRef = collection(db, "records_complit");
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

    c_coplit(num) {
        if(num >=4 && num <=33) {
            return (num - 5) % 3 === 0 ? 392 : 294;
        }
        const rules = {
            0: 235,
            1: 297,
            2: 396,
            3: 297,
            34: 198,
            35: 264,
            36: 198
        };
        return rules[num];
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