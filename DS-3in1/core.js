import { 
    db, 
    doc, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    serverTimestamp, 
    runTransaction, 
    updateDoc, 
    increment, 
    onSnapshot 
  } from './firebase.js';

class CollaborationManager {
    constructor(core) {
        this.core = core;
        this.sessionRef = null;
        this.unsubscribe = null;
    }

    async createSession() {
        const session = {
            problems: this.generate20Problems(),
            status: 'waiting',
            players: {},
            startTime: null,
            createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'sessions'), session);
        this.sessionRef = docRef;
        this.listenSession();
        return docRef.id;
    }

    async joinSession(sessionId) {
        this.sessionRef = doc(db, 'sessions', sessionId);
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(this.sessionRef);
            if (!docSnap.exists() || docSnap.data().status !== 'waiting') {
                throw "Session not available";
            }
            
            transaction.update(this.sessionRef, {
                'status': 'in_progress',
                'startTime': new Date(Date.now() + 10000)
            });
        });
        
        this.listenSession();
    }

    generate20Problems() {
        const problems = [];
        const mnogitel = [5, 8, 11, 17, 35];
        for (let i = 0; i < 20; i++) {
            const a = mnogitel[Math.floor(Math.random() * mnogitel.length)];
            const b = this.core.getRandom(3, 20);
            problems.push({
                question: `${a} × ${b}`,
                answer: a * b,
                solved: false
            });
        }
        return problems;
    }

    listenSession() {
        this.unsubscribe = onSnapshot(this.sessionRef, (doc) => {
            const data = doc.data();

            if (data.status === 'completed') {
                this.showResults(data);
            }

            if (!data) return;

            if (data.status === 'in_progress' && data.startTime) {
                this.startCountdown(data.startTime.toDate());
            }
            
            this.updateGameUI(data);
        });
    }

    startCountdown(targetTime) {
        const timer = setInterval(() => {
            const diff = targetTime - new Date();
            if (diff <= 0) {
                clearInterval(timer);
                this.startSession();
            }
        }, 1000);
    }

    startSession() {
        this.core.state.collabMode = true;
        this.core.startGame();
    }

    updateGameUI(sessionData) {
        if (!this.core.elements.opponentProgress) return;
        const players = sessionData.players;
        let progressHTML = '';
        
        Object.entries(players).forEach(([id, data]) => {
        if (id !== this.core.elements.playerName.value) {
            progressHTML += `<div>Игрок ${id}: ${data.progress || 0}/20</div>`;
        }
        });
        
        this.core.elements.opponentProgress.innerHTML = progressHTML;
    }

    showResults(sessionData) {
        const players = Object.entries(sessionData.players)
            .map(([id, data]) => ({
                id,
                time: (data.endTime - data.startTime) / 1000,
                correct: data.correct
            }));
        
        players.sort((a, b) => a.time - b.time);
        
        // Отобразить таблицу результатов
    }
}

export class GameCore {
    constructor(gameModes) {
        this.gameModes = gameModes;
        this.currentGame = null;
        this.currentGameMode = 'multiple'; // Режим по умолчанию
        this.answerHistory = []; // Сохранение лога игры
        this.initCommonElements();
        this.switchGame(this.currentGameMode); // Инициализация первой игры
        this.collabManager = new CollaborationManager(this);    // для совместной игры
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
            opponentProgress: document.getElementById('opponentProgress'),
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
        // В GameCore.initEventListeners()
        document.getElementById('createSession').addEventListener('click', () => {
            this.collabManager.createSession();
        });
        document.getElementById('joinSession').addEventListener('click', () => {
            const sessionId = this.elements.playerName.value;
            this.collabManager.joinSession(sessionId);
        });
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
        this.answerHistory = []; // Очищаем историю
        this.state = { timeLeft: 180, score: 0, level: 1, intervalId: null, isPlaying: true };
        this.toggleScreens('game');
        this.startTimer();
        this.currentGame.generateProblem();
        this.setFocusToInput();
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
            this.elements.timer.textContent = '--:--'
        }
    }

    setFocusToInput() {
        setTimeout(() => {
            const firstInput = this.elements.gameContent.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 10);
    }
    
    handleAnswer(isCorrect, points = 111, message = 'пусто', answer = 'введено') {
        console.log(isCorrect,points,message);
        console.log(answer);
        if (isCorrect) {
            let basePoints = this.state.level * points;
            // половина за ответ по истечении времени
            basePoints = this.state.isTimeout ? Math.floor(basePoints * 0.5) : basePoints;
            this.state.score += basePoints;
            this.state.level++;
            this.updateUI();
            this.showResult(message, 'correct');
        } else {
            this.state.score = Math.max(0, this.state.score - 10);
            this.state.level = Math.max(1, this.state.level - 1);
            this.updateUI();
            this.showResult(message, 'wrong');   
        }
        // Добавляем запись в лог истории
        this.answerHistory.push({
            answer: answer,     //  это введенный ответ
            correct: isCorrect, //  стиль отображения
            message: message,   //  сообщение системы
            timestamp: new Date().toLocaleTimeString()
        });

        this.currentGame.generateProblem();
        if (this.state.isTimeout) this.gameOver();
        this.setFocusToInput();
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
        // Отображаем историю ответов
        const list = document.getElementById('answersList');
        list.innerHTML = this.answerHistory.map((answer, index) => `
            <li class="${answer.correct ? 'correct' : 'wrong'}">
                ${answer.answer} <br>
                ${answer.message}
                <span class="time">${answer.timestamp}</span>
            </li>
        `).join('');
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