// Централизованное состояние приложения
export const state = {
    playerName: 'Игрок',
    soundEnabled: true,
    vibrationEnabled: true,
    themeDark: false,
    selectedRounds: 20,
    leaderboard: null,
    onlineUsers: [],
    // Игровая сессия (устанавливается при старте)
    gameSession: null,
    // Информация о мультиплеере
    multiplayer: {
        active: false,
        sessionId: null,
        opponentId: null,
        opponentName: '',
        startTime: 0
    },
    // Служебные флаги
    isLocked: false
};

// Вспомогательные функции для обновления
export function resetMultiplayer() {
    state.multiplayer = { active: false, sessionId: null, opponentId: null, opponentName: '', startTime: 0 };
}

export function setGameSession(session) {
    state.gameSession = session;
}