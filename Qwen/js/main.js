let gameLogic = null;

document.getElementById('create-btn').addEventListener('click', async () => {
    const roomId = Date.now().toString(); // простой ID
    const playerId = `player-${Math.floor(Math.random() * 10000)}`;
    gameLogic = new GameLogic(roomId, playerId);
    await gameLogic.createRoom();
    UI.showGame(roomId);
    UI.renderExamples(gameLogic.examples, gameLogic);
});

document.getElementById('join-btn').addEventListener('click', async () => {
    const roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Введите ID комнаты");
    const playerId = `player-${Math.floor(Math.random() * 10000)}`;
    gameLogic = new GameLogic(roomId, playerId);
    await gameLogic.joinRoom();
    UI.showGame(roomId);
    UI.renderExamples(gameLogic.examples, gameLogic);
});