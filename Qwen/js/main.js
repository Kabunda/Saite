let gameLogic = null;

document.getElementById('start-btn').addEventListener('click', async () => {
    const playerName = document.getElementById('player-name').value.trim();
    if (!playerName) {
        alert("Введите имя");
        return;
    }

    const roomId = Date.now().toString();
    gameLogic = new GameLogic(roomId, playerName);

    // Проверим, есть ли активные комнаты
    const lastRoomRef = database.ref('rooms').orderByKey().limitToLast(1);
    const snapshot = await lastRoomRef.once('value');
    const rooms = snapshot.val();

    if (rooms) {
        // Присоединяемся к последней комнате
        await gameLogic.joinRoom();
    } else {
        // Нет комнат — становимся хостом
        await gameLogic.createRoom();
    }

    UI.showGame(gameLogic.roomId);
    UI.renderExamples(gameLogic.examples, gameLogic);
});