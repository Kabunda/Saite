class GameLogic {
    constructor(roomId, playerId) {
        this.roomId = roomId;
        this.playerId = playerId;
        this.examples = [];
        this.isHost = false;
    }

    async createRoom() {
        this.isHost = true;
        this.examples = this.generateExamples(5); // 5 задач
        await database.ref(`rooms/${this.roomId}`).set({
            host: this.playerId,
            examples: this.examples,
            status: 'waiting',
        });
        this.startListeningForPlayers();
    }

    async joinRoom() {
        const roomRef = database.ref(`rooms/${this.roomId}`);
        const snapshot = await roomRef.once('value');
        const data = snapshot.val();

        if (!data) {
            alert("Комната не найдена");
            return;
        }

        this.examples = data.examples;
        this.isHost = (data.host === this.playerId);
        this.startListeningForPlayers();
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

    startListeningForPlayers() {
        database.ref(`rooms/${this.roomId}/players`).on('value', (snapshot) => {
            const players = snapshot.val() || {};
            UI.updateProgress(players);
        });
    }

    async submitAnswer(exampleId, answer) {
        const ref = database.ref(`rooms/${this.roomId}/players/${this.playerId}/answers/${exampleId}`);
        await ref.set({ answer });
    }

    async finishGame() {
        const finishTime = Date.now();
        await database.ref(`rooms/${this.roomId}/players/${this.playerId}/finishTime`).set(finishTime);

        if (this.isHost) {
            this.listenForResults();
        }
    }

    listenForResults() {
        database.ref(`rooms/${this.roomId}/players`).on('value', (snapshot) => {
            const players = snapshot.val() || {};
            let minTime = Infinity;
            let winner = null;

            for (let pid in players) {
                const time = players[pid].finishTime;
                if (time && time < minTime) {
                    minTime = time;
                    winner = pid;
                }
            }

            if (winner) {
                UI.showResults(winner);
            }
        });
    }
}