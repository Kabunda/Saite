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
                gameLogic.submitAnswer(parseInt(this.dataset.id), parseInt(this.value));
            });
            container.appendChild(div);
        });
    }

    static updateProgress(players) {
        const container = document.getElementById('progress-container');
        container.innerHTML = '';
        for (let name in players) {
            const player = players[name];
            const div = document.createElement('div');
            div.className = 'player-progress';
            const count = player.answers ? Object.keys(player.answers).length : 0;
            div.textContent = `${name}: ${count} из ${gameLogic.examples.length}`;
            container.appendChild(div);
        }
    }

    static updateTimer(timeMs) {
        const seconds = Math.floor(timeMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('time-display').textContent = display;
    }

    static showResults(winner) {
        document.getElementById('results').style.display = 'block';
        const list = document.getElementById('results-list');
        list.innerHTML = `<li>Победитель: ${winner}</li>`;
    }
}