class GameLogic {
    constructor(roomId, playerName) {
        this.roomId = roomId;
        this.playerName = playerName;
        this.examples = [];
        this.isHost = false;
        this.startTime = null;
        this.timerInterval = null;
        this.timeElapsed = 0;
    }

    async createRoom() {
        this.isHost = true;
        this.examples = this.generateExamples(5);
        await database.ref(`rooms/${this.roomId}`).set({
            host: this.playerName,
            examples: this.examples,
            status: 'waiting',
            startTime: null
        });
        this.startListeningForPlayers();
        this.waitAndStart();
    }

    async joinRoom() {
        const lastRoomRef = database.ref('rooms').orderByKey().limitToLast(1);
        const snapshot = await lastRoomRef.once('value');
        const rooms = snapshot.val();

        if (!rooms) {
            // Нет комнат — становимся хостом
            this.roomId = Date.now().toString();
            await this.createRoom();
            return;
        }

        const roomId = Object.keys(rooms)[0];
        this.roomId = roomId;

        const roomRef = database.ref(`rooms/${this.roomId}`);
        const roomSnapshot = await roomRef.once('value');
        const data = roomSnapshot.val();

        if (data.status === 'playing') {
            alert("Игра уже началась, нельзя присоединиться.");
            return;
        }

        this.examples = data.examples;
        this.isHost = (data.host === this.playerName);
        this.startListeningForPlayers();
        this.startGameIfReady();
    }

    startListeningForPlayers() {
        database.ref(`rooms/${this.roomId}/players`).on('value', (snapshot) => {
            const players = snapshot.val() || {};
            UI.updateProgress(players);
        });

        // Следим за началом игры
        database.ref(`rooms/${this.roomId}/startTime`).on('value', (snapshot) => {
            const startTime = snapshot.val();
            if (startTime && !this.startTime) {
                this.startTime = startTime;
                this.startTimer();
            }
        });
    }

    waitAndStart() {
        setTimeout(() => {
            database.ref(`rooms/${this.roomId}/status`).set('playing');
            const startTime = Date.now();
            database.ref(`rooms/${this.roomId}/startTime`).set(startTime);
        }, 5000);
    }

    startGameIfReady() {
        database.ref(`rooms/${this.roomId}/status`).on('value', (snapshot) => {
            const status = snapshot.val();
            if (status === 'playing' && !this.startTime) {
                this.startTimer();
            }
        });
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.timeElapsed = Date.now() - this.startTime;
            UI.updateTimer(this.timeElapsed);
        }, 100);
    }

    generateExamples(count) {
        const examples = [];
        for (let i = 0; i < count; i++) {
            const a = Math.floor(Math.random() * 10) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            examples.push({
                question: `${a} + ${b}`,
                answer: a + b,
                id: i,
            });
        }
        return examples;
    }

    async submitAnswer(exampleId, answer) {
        const ref = database.ref(`rooms/${this.roomId}/players/${this.playerName}/answers/${exampleId}`);
        await ref.set({ answer });

        // Проверяем, все ли решены
        const playerRef = database.ref(`rooms/${this.roomId}/players/${this.playerName}/answers`);
        const answers = (await playerRef.once('value')).val();
        if (answers && Object.keys(answers).length === this.examples.length) {
            clearInterval(this.timerInterval);
            const finishTime = this.timeElapsed;
            await database.ref(`rooms/${this.roomId}/players/${this.playerName}/finishTime`).set(finishTime);

            if (this.isHost) {
                this.listenForResults();
            }
        }
    }

    listenForResults() {
        database.ref(`rooms/${this.roomId}/players`).on('value', (snapshot) => {
            const players = snapshot.val() || {};
            let fastest = null;
            let minTime = Infinity;

            for (let name in players) {
                const time = players[name].finishTime;
                if (time && time < minTime) {
                    minTime = time;
                    fastest = name;
                }
            }

            if (fastest) {
                UI.showResults(fastest);
            }
        });
    }
}