import { db, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from './firebase.js';

export class GameCore {
    constructor(gameModes) {
        this.gameModes = gameModes;
        this.currentGame = null;
        this.currentGameMode = 'multiple'; // Режим по умолчанию
        this.initCommonElements();
        this.switchGame(this.currentGameMode); // Инициализация первой игры
    }

    initCommonElements() {
        this.elements = {
            startScreen: document.getElementById('startScreen'),
            gameScreen: document.getElementById('gameScreen'),
            endScreen: document.getElementById('endScreen'),
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            level: document.getElementById('level'),
            result: document.getElementById('message'),
            highscoreList: document.getElementById('highscoreList'),
            playerName: document.getElementById('playerName'),
            finalScore: document.getElementById('finalScore'),
            finalHighscore: document.getElementById('finalHighscore'),
            gameContent: document.getElementById('gameContent'),
            checkBtn: document.getElementById('checkBtn'),
            nazvanie: document.getElementById('nazvanie'),
            rules: document.getElementById('rules')
        };

        this.state = {
            timeLeft: 0,
            score: 0,
            level: 1,
            intervalId: null,
            isPlaying: false,
            highscores: []
        };

        this.initEventListeners();
        // Загружаем сохраненное имя из localStorage
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            this.elements.playerName.value = savedName;
        }
        // Сохраняем имя при вводе
        this.elements.playerName.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '');
            const name = e.target.value.trim().slice(0, 20);
            if (name) {
                localStorage.setItem('playerName', name);
            } else {
                localStorage.removeItem('playerName'); // Очищаем, если поле пустое
            }
        });
    }

    initEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.querySelectorAll('input[name="game"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.switchGame(e.target.value));
        });
        this.elements.timer.addEventListener('click', () => this.handleTimerClick());
    }

    switchGame(gameMode) {
        if (!this.gameModes[gameMode]) return;
        this.currentGameMode = gameMode;
        if (this.currentGame) this.currentGame.destroy?.();
        this.currentGame = new this.gameModes[gameMode](this);
        this.currentGame.init();
        this.fetchGlobalHighscore(gameMode);
    }

    startGame() {
        this.state = { timeLeft: 60, score: 0, level: 1, intervalId: null, isPlaying: true };
        this.toggleScreens('game');
        this.startTimer();
        this.currentGame.generateProblem();
    }

    toggleScreens(screenName) {
        ['startScreen', 'gameScreen', 'endScreen'].forEach(screen => {
            this.elements[screen].classList.add('hidden');
        });
        this.elements[`${screenName}Screen`].classList.remove('hidden');
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

    handleTimerClick() {
        if (this.state.isPlaying) {
            clearInterval(this.state.intervalId);
            this.state.timeLeft = 0; // Останавливаем таймер
            this.state.isPlaying = false;
            this.elements.timer.textContent = '∞'
        }
    }
    
    handleAnswer(isCorrect, points = 111, message = 'пусто') {
        console.log(isCorrect,points,message)
        if (isCorrect) {
            let basePoints = this.state.level * points;
            // половина за ответ по истечении времени
            basePoints = this.state.isTimeout ? Math.floor(basePoints * 0.5) : basePoints;
            this.state.score += basePoints;
            this.state.level++;
            this.updateUI();
            this.showResult(`+${basePoints}`, 'correct');
        } else {
            this.state.score = Math.max(0, this.state.score - 10);
            this.state.level = Math.max(1, this.state.level - 1);
            this.updateUI();
            this.showResult(message, 'wrong');   
        }
        this.currentGame.generateProblem();
        if (this.state.isTimeout) this.gameOver();
    }

    showResult(text, className) {
        clearTimeout(this.state.timeoutId);
        this.elements.result.textContent = text;
        this.elements.result.classList.remove('correct');
        this.elements.result.classList.remove('wrong');
        this.elements.result.classList.remove('empty');
        this.elements.result.classList.add(className);
        this.state.timeoutId = setTimeout(() => {
            this.elements.result.classList.remove(className);
            this.elements.result.classList.add('empty');
        }, 4500);
    }

    updateUI() {
        this.elements.score.textContent = this.state.score;
        this.elements.level.textContent = this.state.level;
    }

    async gameOver() {
        clearInterval(this.state.intervalId);  
        this.toggleScreens('end');
        document.getElementById('finalScore').textContent = this.state.score;
        const finalScore = this.state.score;
        const finalLevel = this.state.level;
        const playerName = document.getElementById('playerName').value.trim() || "Аноним";
        let sanitizedName = playerName.slice(0, 20).replace(/[^a-zA-Zа-яА-Я0-9 ]/g, "");
        if (this.state.isPlaying) {
            if (!sanitizedName) sanitizedName = "Аноним";
            const recordData = {
                level: finalLevel,
                value: finalScore,
                name: sanitizedName,
                date: serverTimestamp()
            };
            const collectionName = {
                multiple: 'records_mult',
                neighbors: 'records_neighbors',
                complit: 'records_complit'
            }[this.currentGameMode];
            try {
                await addDoc(collection(db, collectionName), recordData);
                await this.fetchGlobalHighscore(this.currentGameMode);
            } catch (error) {
                console.error("Ошибка сохранения:", error);
                this.showResult('Ошибка соединения', 'wrong');
            }
        }
        this.state.isPlaying = false;
    }

    resetGame() {
        this.state.score = 0;
        this.state.level = 1;
        this.state.isPlaying = false;
        this.updateUI();    
        this.toggleScreens('start');
    }

    async fetchGlobalHighscore(gameMode) {
        try {
            const collectionName = {
                multiple: 'records_mult',
                neighbors: 'records_neighbors',
                complit: 'records_complit'
            }[gameMode];
            const recordsRef = collection(db, collectionName);
            const q = query(recordsRef, orderBy("value", "desc"), limit(5));
            const snapshot = await getDocs(q);
            this.state.highscores = []; // Теперь храним массив
            snapshot.forEach(doc => {
                this.state.highscores.push(doc.data());
            });
            this.updateHighscoreDisplay();
        } catch (error) {
            console.error("Ошибка загрузки рекорда:", error);
            this.showResult('Ошибка соединения', 'wrong');
        }
    }

    getRandom(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}