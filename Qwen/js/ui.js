class UI {
    static showGame(roomId) {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        document.getElementById('current-room').textContent = roomId;
    }

    static renderExamples(examples, gameLogic) {
        const container = document.getElementById('examples-container');
        container.innerHTML = '';

        examples.forEach((ex, idx) => {
            const div = document.createElement('div');
            div.className = 'example';
            div.innerHTML = `
                <span>${ex.question} = </span>
                <input type="number" id="answer-${idx}" data-id="${ex.id}" placeholder="Ответ">
            `;
            div.querySelector('input').addEventListener('change', function() {
                gameLogic.submitAnswer(ex.id, parseInt(this.value));
            });
            container.appendChild(div);
        });
    }

    static updateProgress(players) {
        const container = document.getElementById('progress-container');
        container.innerHTML = '';
        for (let pid in players) {
            const player = players[pid];
            const div = document.createElement('div');
            div.className = 'player-progress';
            div.textContent = `Игрок ${pid}: ${player.answers ? Object.keys(player.answers).length : 0} из ${gameLogic.examples.length}`;
            container.appendChild(div);
        }
    }

    static showResults(winner) {
        document.getElementById('results').style.display = 'block';
        const list = document.getElementById('results-list');
        list.innerHTML = `<li>Победитель: Игрок ${winner}</li>`;
    }
}