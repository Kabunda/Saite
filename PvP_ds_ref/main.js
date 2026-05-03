import { state, setGameSession } from './state.js';
import * as storage from './storage.js';
import { getLeaderboard } from './leaderboard.js';
import { initPresence, updatePresenceStatus, subscribeToOnlineUsers, removePresence, getPlayerId } from './presence.js';
import { startMatchmaking } from './multiplayer.js';
import { buildUniqueQuestionList } from './task-generator.js';
import { createSinglePlayerGame, createMultiplayerGame, getCurrentSession } from './game.js';
import {
    showScreen, applyTheme, initThemeToggle, renderLeaderboard, renderOnlineUsers,
    els, startTimer, stopTimer, initProgressTrack, displayQuestion, updateAnswerDisplay,
    showFeedback, clearFeedback, paintProgressCell, updateProgressCurrentHighlight,
    initOpponentProgressBar, startOpponentProgressListener, stopOpponentProgressListener,
    showResultScreen, bindKeypad, bindFullscreenButton, requestFullscreenIfMobile
} from './ui.js';

// ---------- Глобальные переменные ----------
let cancelMatchmaking = null;
let countdownInterval = null;
let lobbyWatcher = null;

// ---------- Переключение на главное меню ----------
async function backToMenu() {
    stopTimer();
    stopOpponentProgressListener();
    if (countdownInterval) clearInterval(countdownInterval);
    if (lobbyWatcher) { lobbyWatcher(); lobbyWatcher = null; }
    if (cancelMatchmaking) { cancelMatchmaking(); cancelMatchmaking = null; }

    setGameSession(null);
    updatePresenceStatus('menu');
    showScreen('menu');
    renderOnlineUsers(state.onlineUsers);
    const board = await getLeaderboard();
    state.leaderboard = board;
    renderLeaderboard();
}

// ---------- Начало игры (из меню) ----------
async function startGameFlow() {
    console.log("Запущен поиск игры");
    showScreen('wait');
    updatePresenceStatus('waiting');
    const waitMessage = document.getElementById('waitMessage');
    const countdownEl = document.getElementById('countdown');
    waitMessage.textContent = "Поиск соперника...";
    els.opponentInfo.style.display = "none";
    countdownEl.textContent = "30";

    let resolved = false;
    const matchmaking = startMatchmaking(state.playerName, state.selectedRounds);
    cancelMatchmaking = matchmaking.cancel;

    let countdown = 30;
    countdownEl.textContent = countdown;
    countdownInterval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (!resolved) {
                resolved = true;
                matchmaking.cancel();
                console.log("Игра запущена в соло, соперник не найден");
                startSinglePlayerGame();
            }
        }
    }, 1000);

    matchmaking.promise.then(data => {
        if (!resolved) {
            resolved = true;
            if (countdownInterval) clearInterval(countdownInterval);
            cancelMatchmaking = null;
            console.log("Игра запущена в мультиплеере");
            startCountdownBeforeMultiplayer(data);
        }
    }).catch(() => {
        if (!resolved) {
            resolved = true;
            if (countdownInterval) clearInterval(countdownInterval);
            cancelMatchmaking = null;
            console.log("Игра запущена с соло, что-то пошло не так");
            startSinglePlayerGame();
        }
    });
}

// Обратный отсчёт перед мультиплеерной игрой
async function startCountdownBeforeMultiplayer(data) {
    
    if (countdownInterval) clearInterval(countdownInterval);
    if (lobbyWatcher) lobbyWatcher();

    els.waitMessage.textContent = "Соперник найден!";
    els.opponentNameSpan.textContent = data.opponentName;
    els.opponentInfo.style.display = "block";
    els.countdown.style.fontSize = "3rem";

    const targetStart = data.startTime + 3000;
    const updateCountdown = () => {
        const remaining = Math.max(0, targetStart - Date.now());
        els.countdown.textContent = Math.ceil(remaining / 1000);
        if (remaining <= 0) {
            if (countdownInterval) clearInterval(countdownInterval);
            if (lobbyWatcher) { lobbyWatcher(); lobbyWatcher = null; }
            startMultiplayerGame(data);
        }
    };
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 200);

    // Слушаем удаление лобби (соперник ушёл)
    if (storage.useFirebase && storage.db) {
        const { ref, onValue } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
        const lobbyRef = ref(storage.db, `lobbies/${data.sessionId}`);
        lobbyWatcher = onValue(lobbyRef, (snap) => {
            if (!snap.exists()) {
                cancelCountdownAndBack("Соперник отменил игру");
            }
        });
    }
}

function cancelCountdownAndBack(message) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (lobbyWatcher) { lobbyWatcher(); lobbyWatcher = null; }
    alert(message);
    backToMenu();
}

// ---------- Запуск одиночной игры ----------
function startSinglePlayerGame() {
    const session = createSinglePlayerGame(state.selectedRounds);
    // ИСПРАВЛЕНО: сбрасываем блокировку перед началом новой игры
    state.isLocked = false;
    currentAnswer = '';
    setupGameScreen(false);
    requestFullscreenIfMobile();
}

// ---------- Запуск мультиплеерной игры ----------
async function startMultiplayerGame(data) {
    const session = createMultiplayerGame(data);
    // ИСПРАВЛЕНО: сбрасываем блокировку перед началом новой игры
    state.isLocked = false;
    currentAnswer = '';
    setupGameScreen(true, data.opponentName, session.questions.length);
    startOpponentProgressListener(data.sessionId);
    requestFullscreenIfMobile();
}

// ---------- Общая инициализация игрового экрана ----------
function setupGameScreen(isMultiplayer, opponentName = '', totalOpp = 0) {
    clearFeedback();
    updateAnswerDisplay('');
    const session = getCurrentSession();
    if (!session) return;
    showScreen('game');
    initProgressTrack(session.questions.length);
    if (isMultiplayer) {
        document.querySelector('.opponent-progress').style.display = '';
        initOpponentProgressBar(opponentName, totalOpp);
    } else {
        document.querySelector('.opponent-progress').style.display = 'none';
    }
    displayQuestion(session.currentQuestion);
    startTimer();
}

// ---------- Основной игровой цикл ----------
let currentAnswer = '';

function handleKeyPress(key) {
    const session = getCurrentSession();
    if (!session || session.isFinished() || state.isLocked) return;

    if (key === 'del') {
        currentAnswer = currentAnswer.slice(0, -1);
        updateAnswerDisplay(currentAnswer);
    } else if (key === 'clear') {
        currentAnswer = '';
        updateAnswerDisplay(currentAnswer);
    } else if (key === 'enter') {
        if (!currentAnswer) return;
        state.isLocked = true;
        const result = session.submitAnswer(Number(currentAnswer));
        if (result) {
            showFeedback(result.feedback, result.correct);
            paintProgressCell(session.round, result.correct);
        }
        if (state.multiplayer.active) {
            session.syncProgress(state.multiplayer.sessionId);
        }
        setTimeout(() => advanceRound(session), 450);
    } else if (/^\d$/.test(key) && currentAnswer.length < 3) {
        currentAnswer += key;
        updateAnswerDisplay(currentAnswer);
    }
}

function advanceRound(session) {
    currentAnswer = '';
    clearFeedback();
    const finished = session.nextRound();
    if (finished) {
        endGame(session);
        return;
    }
    state.isLocked = false;
    updateAnswerDisplay(currentAnswer);
    displayQuestion(session.currentQuestion);
    updateProgressCurrentHighlight(session.round);
}

async function endGame(session) {
    stopTimer();
    stopOpponentProgressListener();
    state.isLocked = true;
    session.finish();
    const finalResult = {
        playerName: state.playerName,
        totalTimeSec: (Date.now() - session.startTime) / 1000,
        score: session.score,
        rounds: session.questions.length,
        bestStreak: session.bestStreak,
        finishedAt: Date.now(),
        answers: session.answersLog
    };

    await storage.addResult(finalResult);
    const leaderboard = await getLeaderboard();
    state.leaderboard = leaderboard;
    renderLeaderboard();

    if (state.multiplayer.active) {
        await session.syncProgress(state.multiplayer.sessionId);
    }

    const personalBest = leaderboard?.find(e => e.playerName === state.playerName)?.totalTimeSec;
    showResultScreen({ ...finalResult, mistakes: session.mistakes }, personalBest);
    showScreen('result');
}

// ---------- Привязка событий ----------
function bindEvents() {
    els.continueBtn.addEventListener('click', async () => {
        const name = els.playerNameInput.value.trim();
        if (!name) {
            els.nameError.classList.remove('hidden');
            els.playerNameInput.focus();
            return;
        }
        els.nameError.classList.add('hidden');
        state.playerName = name;
        await storage.setPlayerName(name);
        initPresence(name);
        state.soundEnabled = els.modalSoundToggle.checked;
        state.vibrationEnabled = els.modalVibrationToggle.checked;
        await storage.setSetting('mt_sound_enabled', state.soundEnabled);
        await storage.setSetting('mt_vibration_enabled', state.vibrationEnabled);
        els.currentPlayerName.textContent = state.playerName;
        showScreen('menu');
        const board = await getLeaderboard();
        state.leaderboard = board;
        renderLeaderboard();
    });
    els.playerNameInput.addEventListener('input', () => els.nameError.classList.add('hidden'));
    els.playerNameInput.addEventListener('keydown', e => e.key === 'Enter' && els.continueBtn.click());

    els.startBtn.addEventListener('click', startGameFlow);
    els.settingsBtn.addEventListener('click', () => {
        els.playerNameInput.value = state.playerName;
        els.modalSoundToggle.checked = state.soundEnabled;
        els.modalVibrationToggle.checked = state.vibrationEnabled;
        showScreen('nameInput');
    });

    els.cancelWaitBtn.addEventListener('click', backToMenu);
    els.backBtn.addEventListener('click', backToMenu);
    els.playAgainBtn.addEventListener('click', startGameFlow);
    els.toMenuBtn.addEventListener('click', backToMenu);

    bindKeypad(handleKeyPress);
    initThemeToggle();
    bindFullscreenButton();
}

// ---------- Инициализация приложения ----------
(async () => {
    const savedName = await storage.getPlayerName();
    state.playerName = savedName;
    els.currentPlayerName.textContent = state.playerName;
    state.soundEnabled = await storage.getBoolSetting('mt_sound_enabled', true);
    state.vibrationEnabled = await storage.getBoolSetting('mt_vibration_enabled', true);
    state.themeDark = await storage.getTheme();
    els.modalSoundToggle.checked = state.soundEnabled;
    els.modalVibrationToggle.checked = state.vibrationEnabled;
    applyTheme();

    await storage.syncLocalResults();

    if (savedName && savedName !== 'Игрок') {
        initPresence(savedName);
    }

    subscribeToOnlineUsers((users) => {
        state.onlineUsers = users;
        if (!document.getElementById('menuScreen').classList.contains('hidden')) {
            renderOnlineUsers(users);
        }
    });

    if (!savedName || savedName === 'Игрок') {
        showScreen('nameInput');
        els.playerNameInput.focus();
    } else {
        showScreen('menu');
        const board = await getLeaderboard();
        state.leaderboard = board;
        renderLeaderboard();
        renderOnlineUsers(state.onlineUsers);
    }

    bindEvents();
})();