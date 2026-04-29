import { buildUniqueQuestionList } from './task-generator.js';
import * as storage from './storage.js';
import { escapeHtml } from './script_base.js';
import { initPresence,
    subscribeToOnlineUsers,
    updatePresenceStatus, 
    getPlayerId,
    removePresence } from './online-presence.js';
import { startMatchmaking, 
    subscribeOpponentProgress, 
    updateMyProgress } from './multiplayer.js';  
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// DOM elements
const nameInputScreen = document.getElementById("nameInputScreen");
const menuScreen = document.getElementById("menuScreen");
const waitScreen = document.getElementById("waitScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const toMenuBtn = document.getElementById("toMenuBtn");
const playerNameInput = document.getElementById("playerNameInput");
const continueBtn = document.getElementById("continueBtn");
const editNameBtn = document.getElementById("editNameBtn");
const settingsBtn = document.getElementById("settingsBtn");
const cancelWaitBtn = document.getElementById("cancelWaitBtn");
const currentPlayerName = document.getElementById("currentPlayerName");
const nameError = document.getElementById("nameError");

const modalSoundToggle = document.getElementById("modalSoundToggle");
const modalVibrationToggle = document.getElementById("modalVibrationToggle");

const leaderboardBody = document.getElementById("leaderboardBody");
const progressTrackEl = document.getElementById("progressTrack");
const timerEl = document.getElementById("timer");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const feedbackEl = document.getElementById("feedback");
const keypad = document.getElementById("keypad");
const resultSummary = document.getElementById("resultSummary");
const answersList = document.getElementById("answersList");
const timeScale = document.getElementById("timeScale");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const themeToggle = document.getElementById("themeToggle");
const countdownEl = document.getElementById("countdown");

const opponentPanel = document.querySelector('.opponent-progress');

// Глобальное состояние
let playerName = "Игрок";
let leaderboard = null;
let soundEnabled = true;
let vibrationEnabled = true;
let selectedRounds = 20;
let themeDark = false;

// Игровое состояние
let currentRound = 0;
let score = 0;
let currentQuestion = null;        // ИЗМЕНЕНО: объект { text, answer }
let currentAnswer = "";
let isLocked = false;
let timerIntervalId = null;
let progressCells = [];
let streak = 0;
let bestStreak = 0;
let currentQuestions = [];
let mistakesInCurrentGame = [];
let answersLog = [];
let audioCtx = null;
let gameStartTime = 0;
let waitIntervalId = null;
let cancelMatchmaking = null;
let multiplayerSessionId = null;
let multiplayerOpponentId = null;
let opponentUnsubscribe = null;
let countdownToGameInterval = null;
let lobbyUnsubscribe = null;

// ----- Загрузка данных при старте -----
async function loadInitialData() {
    playerName = await storage.getPlayerName();
    currentPlayerName.textContent = playerName;
    leaderboard = await storage.getLeaderboard();
    soundEnabled = await storage.getBoolSetting('mt_sound_enabled', true);
    vibrationEnabled = await storage.getBoolSetting('mt_vibration_enabled', true);
    themeDark = await storage.getTheme();
    applyTheme();
}

// ----- Управление экранами -----
const ALL_SCREENS = [nameInputScreen, menuScreen, waitScreen, gameScreen, resultScreen];
function showOnlyScreen(screenElement) {
    ALL_SCREENS.forEach(s => s.classList.add("hidden"));
    screenElement.classList.remove("hidden");
}

// ----- Тема -----
function applyTheme() {
    document.documentElement.setAttribute("data-theme", themeDark ? "dark" : "light");
    if (themeToggle) themeToggle.checked = themeDark;
}
themeToggle?.addEventListener("change", async () => {
    themeDark = themeToggle.checked;
    await storage.setTheme(themeDark);
    applyTheme();
});

// ----- Таблица лидеров -----
function renderLeaderboard() {
    if (leaderboard === null) {
        leaderboardBody.innerHTML = `<tr><td colspan="4" class="leaderboard-error">⚠️ Не удалось загрузить таблицу лидеров.</td></tr>`;
        return;
    }
    if (!leaderboard.length) {
        leaderboardBody.innerHTML = `<tr><td colspan="4">Пока нет результатов.</td></tr>`;
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    leaderboardBody.innerHTML = leaderboard.slice(0, 10).map((item, idx) => {
        const dateStr = item.finishedAt
            ? new Date(item.finishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        const answersJson = encodeURIComponent(JSON.stringify(item.answers));
        return `
        <tr class="leader-row" data-answers="${answersJson}">
            <td>${idx < 3 ? medals[idx] : idx + 1}</td>
            <td>${escapeHtml(item.playerName.substring(0, 12))}${item.playerName.length > 12 ? '…' : ''}</td>
            <td>${item.totalTimeSec.toFixed(1)} сек</td>
            <td>${dateStr}</td>
        </tr>`;
    }).join('');

    // Обработчики для тултипа
    const tooltip = document.getElementById('leaderboardTooltip');
    document.querySelectorAll('.leader-row').forEach(row => {
        row.addEventListener('mouseenter', e => {
            const answers = JSON.parse(decodeURIComponent(row.dataset.answers));
            if (!answers.length) return;
            const list = answers.map((a, i) => `${i+1}) ${a.a} × ${a.b} = ${a.playerAnswer}`).join('<br>');
            tooltip.innerHTML = list;
            tooltip.classList.remove('hidden');
        });
        row.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
        row.addEventListener('mousemove', e => {
            tooltip.style.left = e.pageX + 15 + 'px';
            tooltip.style.top = e.pageY + 15 + 'px';
        });
    });
}

// ----- Онлайн-пользователи -----
function timeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'только что';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ч назад`;
}

function renderOnlineUsers(users) {
    const listEl = document.getElementById('onlinePlayersList');
    if (!listEl) return;

    if (users.length === 0) {
        listEl.innerHTML = '<li>Никого нет в сети</li>';
        return;
    }

    listEl.innerHTML = users.map(u => {
        const statusText = u.status === 'playing' ? '🎮 Играет' :
                           u.status === 'waiting' ? '⏳ Ожидание игры' : '📋 В меню';
        const joinedTime = u.joinedAt ? timeAgo(u.joinedAt) : '';
        return `<li><strong>${escapeHtml(u.name)}</strong> — <em>${statusText}</em> ${joinedTime ? `<small>(${joinedTime})</small>` : ''}</li>`;
    }).join('');
}

// ----- Таймер -----
function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerIntervalId = setInterval(updateTimerDisplay, 1000);
}
function stopTimer() {
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
}
function updateTimerDisplay() {
    if (!gameStartTime) { timerEl.textContent = "Время: 00:00"; return; }
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    timerEl.textContent = `Время: ${m}:${s}`;
}

// ----- Прогресс -----
function initProgressTrack() {
    progressTrackEl.innerHTML = "";
    progressCells = [];
    progressTrackEl.style.gridTemplateColumns = `repeat(${currentQuestions.length}, 1fr)`;
    for (let i = 0; i < currentQuestions.length; i++) {
        const cell = document.createElement("div");
        cell.className = "progress-cell";
        if (i === currentRound) cell.classList.add("progress-cell--current");
        progressTrackEl.appendChild(cell);
        progressCells.push(cell);
    }
    progressTrackEl.setAttribute("aria-valuemax", currentQuestions.length);
    progressTrackEl.setAttribute("aria-valuenow", 0);
}
function updateProgressCurrentHighlight() {
    progressCells.forEach((cell, idx) => {
        cell.classList.remove("progress-cell--current");
        if (idx === currentRound) cell.classList.add("progress-cell--current");
    });
    progressTrackEl?.setAttribute("aria-valuenow", currentRound);
}
function paintProgressCell(isCorrect) {
    const cell = progressCells[currentRound];
    if (!cell) return;
    cell.classList.add(isCorrect ? "progress-cell--ok" : "progress-cell--bad");
    if (!isCorrect) cell.classList.add("shake");
}

// ----- Звук и вибрация -----
function playTone(freq, duration) {
    if (!soundEnabled) return;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}
function playClickSound() {
    if (!soundEnabled) return;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
}
function vibrate(pattern) {
    if (vibrationEnabled && "vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
}

// ----- Игровая логика (работа с текстовыми вопросами) -----
function setCurrentQuestion() {
    currentQuestion = currentQuestions[currentRound];       // ИЗМЕНЕНО
    questionText.textContent = currentQuestion.text;       // ИЗМЕНЕНО
    questionText.classList.remove("fade-in");
    void questionText.offsetWidth;
    questionText.classList.add("fade-in");
    updateProgressCurrentHighlight();
}
function renderAnswer() {
    answerText.textContent = currentAnswer.length ? currentAnswer : "_";
    if (currentAnswer.length) {
        answerText.classList.add("pop");
        setTimeout(() => answerText.classList.remove("pop"), 100);
    }
}
function resetFeedback() {
    feedbackEl.textContent = "";
    feedbackEl.classList.remove("ok", "bad");
}

// ----- Старт игры с поиском соперника -----
function startGame() {
    if (waitIntervalId) {
        clearInterval(waitIntervalId);
        waitIntervalId = null;
    }
    if (cancelMatchmaking) {
        cancelMatchmaking();
        cancelMatchmaking = null;
    }

    showOnlyScreen(waitScreen);
    updatePresenceStatus('waiting');

    const waitMessage = document.getElementById("waitMessage");
    const opponentInfoDiv = document.getElementById("opponentInfo");
    const countdownEl = document.getElementById("countdown");
    waitMessage.textContent = "Поиск соперника...";
    opponentInfoDiv.style.display = "none";
    countdownEl.textContent = "3";
    countdownEl.style.fontSize = "";

    let isResolved = false;
    const matchmaking = startMatchmaking(playerName, selectedRounds);
    cancelMatchmaking = matchmaking.cancel;

    let countdown = 3; // время на поиск соперника
    countdownEl.textContent = countdown;
    waitIntervalId = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            if (!isResolved) {
                isResolved = true;
                matchmaking.cancel();
                startGameReal();
            }
        }
    }, 1000);

    matchmaking.promise.then(data => {
        if (!isResolved) {
            isResolved = true;
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            cancelMatchmaking = null;
            startCountdownBeforeGame(data);
        }
    }).catch(err => {
        if (!isResolved) {
            isResolved = true;
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            if (cancelMatchmaking) cancelMatchmaking();
            cancelMatchmaking = null;
            startGameReal();
        }
    });
}

function startCountdownBeforeGame(data) {
    if (countdownToGameInterval) clearInterval(countdownToGameInterval);
    if (lobbyUnsubscribe) lobbyUnsubscribe();

    const waitMessage = document.getElementById("waitMessage");
    const opponentInfoDiv = document.getElementById("opponentInfo");
    const opponentNameSpan = document.getElementById("opponentNameSpan");
    const countdownEl = document.getElementById("countdown");

    waitMessage.textContent = "Соперник найден!";
    opponentNameSpan.textContent = data.opponentName;
    opponentInfoDiv.style.display = "block";
    countdownEl.style.fontSize = "3rem";

    const targetStart = data.startTime + 3000;
    const updateCountdown = () => {
        const now = Date.now();
        let remaining = Math.max(0, targetStart - now);
        countdownEl.textContent = Math.ceil(remaining / 1000);
        if (remaining <= 0) {
            if (countdownToGameInterval) clearInterval(countdownToGameInterval);
            if (lobbyUnsubscribe) lobbyUnsubscribe();
            startMultiplayerGame(data.sessionId, data.questions, data.opponentId, data.opponentName, data.startTime);
        }
    };

    updateCountdown();
    countdownToGameInterval = setInterval(updateCountdown, 200);

    if (storage.useFirebase && storage.db) {
        const lobbyRef = ref(storage.db, `lobbies/${data.sessionId}`);
        lobbyUnsubscribe = onValue(lobbyRef, (snap) => {
            if (!snap.exists()) {
                cancelCountdownAndBack("Соперник отменил игру");
            }
        });
    }
}

function cancelCountdownAndBack(message) {
    if (countdownToGameInterval) {
        clearInterval(countdownToGameInterval);
        countdownToGameInterval = null;
    }
    if (lobbyUnsubscribe) {
        lobbyUnsubscribe();
        lobbyUnsubscribe = null;
    }
    alert(message);
    backToMenu();
}

function backToMenu() {
    if (countdownToGameInterval) {
        clearInterval(countdownToGameInterval);
        countdownToGameInterval = null;
    }
    if (lobbyUnsubscribe) {
        lobbyUnsubscribe();
        lobbyUnsubscribe = null;
    }
    if (waitIntervalId) {
        clearInterval(waitIntervalId);
        waitIntervalId = null;
    }
    if (cancelMatchmaking) {
        cancelMatchmaking();
        cancelMatchmaking = null;
    }
    if (opponentUnsubscribe) {
        opponentUnsubscribe();
        opponentUnsubscribe = null;
    }
    stopTimer();
    gameStartTime = 0;
    isLocked = true;
    updatePresenceStatus('menu');
    showOnlyScreen(menuScreen);
    updateMenuStatus();
    (async () => {
        leaderboard = await storage.getLeaderboard();
        renderLeaderboard();
    })();
}

// --- Одиночная игра ---
function startGameReal() {
    if (opponentPanel) opponentPanel.style.display = 'none';
    multiplayerSessionId = null;
    multiplayerOpponentId = null;
    if (opponentUnsubscribe) {
        opponentUnsubscribe();
        opponentUnsubscribe = null;
    }

    currentQuestions = buildUniqueQuestionList(selectedRounds);
    resetGameState();
    updatePresenceStatus('playing');
    showOnlyScreen(gameScreen);
    initProgressTrack();
    resetFeedback();
    renderAnswer();
    setCurrentQuestion();
    gameStartTime = Date.now();
    startTimer();
    requestFullscreenOnMobile();
}

// --- Мультиплеерная игра ---
function startMultiplayerGame(sessionId, questions, opponentId, opponentName, startTime) {
    if (opponentPanel) opponentPanel.style.display = '';
    multiplayerSessionId = sessionId;
    multiplayerOpponentId = opponentId;

    currentQuestions = questions;
    resetGameState();

    gameStartTime = startTime ? startTime : Date.now();
    if (startTime && typeof startTime === 'number') {
        gameStartTime = startTime;
    } else {
        gameStartTime = Date.now();
    }

    updatePresenceStatus('playing');
    showOnlyScreen(gameScreen);

    initProgressTrack();
    initOpponentProgressBar(opponentName, questions.length);

    opponentUnsubscribe = subscribeOpponentProgress(sessionId, getPlayerId(), (data) => {
        updateOpponentProgressBar(data.progress, data.score, data.answers, currentQuestions.length);
    });

    resetFeedback();
    renderAnswer();
    setCurrentQuestion();
    startTimer();
    requestFullscreenOnMobile();
}

function resetGameState() {
    currentRound = 0;
    score = 0;
    currentAnswer = "";
    isLocked = false;
    streak = 0;
    bestStreak = 0;
    mistakesInCurrentGame = [];
    answersLog = [];
    currentQuestion = null;
}

function initOpponentProgressBar(name, total) {
    const oppTrack = document.getElementById('opponentProgressTrack');
    oppTrack.innerHTML = '';
    oppTrack.style.gridTemplateColumns = `repeat(${total}, 1fr)`;
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'progress-cell';
        oppTrack.appendChild(cell);
    }
    document.querySelector('.opponent-label').textContent = `Соперник (${name}): `;
    document.getElementById('opponentScore').textContent = `0/${total}`;
}

function updateOpponentProgressBar(progress, score, answers, total) {
    const cells = document.querySelectorAll('#opponentProgressTrack .progress-cell');
    cells.forEach(cell => {
        cell.classList.remove('progress-cell--ok', 'progress-cell--bad');
    });
    if (answers && Array.isArray(answers)) {
        answers.forEach(ans => {
            const idx = ans.index;
            if (idx >= 0 && idx < cells.length) {
                cells[idx].classList.add(ans.correct ? 'progress-cell--ok' : 'progress-cell--bad');
            }
        });
    } else {
        for (let i = 0; i < progress && i < cells.length; i++) {
            cells[i].classList.add('progress-cell--ok');
        }
    }
    document.getElementById('opponentScore').textContent = `${score}/${total}`;
}

function checkAnswer() {
    const value = Number(currentAnswer);
    const correctAnswer = currentQuestion.answer;      // ИЗМЕНЕНО
    const isCorrect = value === correctAnswer;
    isLocked = true;
    
    // ИЗМЕНЕНО: сохраняем текст вопроса вместо a,b
    answersLog.push({ 
        questionText: currentQuestion.text, 
        playerAnswer: value, 
        correctAnswer: correctAnswer, 
        isCorrect 
    });
    
    if (isCorrect) {
        score++;
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        feedbackEl.textContent = "✓ Верно!";
        feedbackEl.classList.add("ok");
        playTone(880, 0.2);
        vibrate([30]);
    } else {
        streak = 0;
        mistakesInCurrentGame.push(currentQuestion.text);   // ИЗМЕНЕНО
        feedbackEl.textContent = `✗ Неверно. Правильно: ${correctAnswer}`;
        feedbackEl.classList.add("bad");
        playTone(240, 0.3);
        vibrate([100, 50, 100]);
        document.querySelector(".game-area")?.classList.add("shake-area");
        setTimeout(() => document.querySelector(".game-area")?.classList.remove("shake-area"), 400);
    }
    paintProgressCell(isCorrect);

    if (multiplayerSessionId) {
        const answersForFirebase = answersLog.map((item, i) => ({ index: i, correct: item.isCorrect }));
        updateMyProgress(
            multiplayerSessionId,
            getPlayerId(),
            currentRound + 1,
            score,
            false,
            0,
            answersForFirebase
        );
    }

    setTimeout(() => nextQuestion(), 450);
}

function nextQuestion() {
    currentRound++;
    if (currentRound >= currentQuestions.length) {
        finishGame();
        return;
    }
    isLocked = false;
    currentAnswer = "";
    resetFeedback();
    renderAnswer();
    setCurrentQuestion();
}

async function finishGame() {
    stopTimer();
    isLocked = true;
    const totalTimeSec = (Date.now() - gameStartTime) / 1000;

    const result = {
        playerName,
        totalTimeSec,
        score,
        rounds: currentQuestions.length,
        bestStreak,
        finishedAt: Date.now(),
        answers: answersLog
    };

    await storage.addResult(result);
    leaderboard = await storage.getLeaderboard();
    renderLeaderboard();

    showOnlyScreen(resultScreen);

    if (multiplayerSessionId) {
        await updateMyProgress(
            multiplayerSessionId,
            getPlayerId(),
            currentRound,
            score,
            true,
            totalTimeSec,
            null
        );
    }

    const streakHtml = bestStreak > 0 ? ` 🔥 Серия: ${bestStreak}` : '';
    resultSummary.innerHTML = `${playerName}, результат: ${score}/${currentQuestions.length}. ` +
        `Время: ${totalTimeSec.toFixed(1)} сек.${streakHtml} Ошибок: ${mistakesInCurrentGame.length}.`;

    const personalBest = leaderboard && leaderboard.length > 0
        ? leaderboard.find(e => e.playerName === playerName)?.totalTimeSec
        : null;
    if (personalBest && personalBest > 0) {
        timeScale.classList.remove("hidden");
        const pct = Math.min(100, (personalBest / totalTimeSec) * 100);
        timeScale.querySelector(".time-scale-fill").style.width = `${pct}%`;
        timeScale.querySelector(".time-scale-text").textContent = `Ваш лучший: ${personalBest.toFixed(1)} сек`;
    } else {
        timeScale.classList.add("hidden");
    }

    // ИЗМЕНЕНО: отображаем текст вопроса
    answersList.innerHTML = answersLog.map((item, idx) => {
        const status = item.isCorrect ? "Верно" : "Неверно";
        return `<li class="${item.isCorrect ? 'answer-ok' : 'answer-bad'}">
            ${idx + 1}) ${item.questionText} ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
        </li>`;
    }).join('');
}

settingsBtn.addEventListener("click", openSettingsModal);

// ----- Настройки и меню -----
function openSettingsModal() {
    modalSoundToggle.checked = soundEnabled;
    modalVibrationToggle.checked = vibrationEnabled;
    playerNameInput.value = playerName;
    showOnlyScreen(nameInputScreen);
}

// ----- Экран ввода имени -----
continueBtn.addEventListener("click", async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        nameError.classList.remove("hidden");
        playerNameInput.focus();
        return;
    }
    nameError.classList.add("hidden");
    playerName = name;
    await storage.setPlayerName(name);
    initPresence(name);

    soundEnabled = modalSoundToggle.checked;
    vibrationEnabled = modalVibrationToggle.checked;
    await storage.setSetting('mt_sound_enabled', soundEnabled);
    await storage.setSetting('mt_vibration_enabled', vibrationEnabled);
    currentPlayerName.textContent = playerName;
    showOnlyScreen(menuScreen);
    leaderboard = await storage.getLeaderboard();
    renderLeaderboard();
});
playerNameInput.addEventListener("input", () => nameError.classList.add("hidden"));
playerNameInput.addEventListener("keydown", e => e.key === "Enter" && continueBtn.click());

// ----- Игровые кнопки -----
startBtn.addEventListener("click", startGame);
backBtn.addEventListener("click", backToMenu);
playAgainBtn.addEventListener("click", startGame);
toMenuBtn.addEventListener("click", backToMenu);
cancelWaitBtn.addEventListener("click", backToMenu);

// Клавиатура
keypad.addEventListener("click", (e) => {
    const key = e.target?.dataset?.key;
    if (!key) return;
    handleKeyPress(key);
});
function handleKeyPress(key) {
    if (isLocked) return;
    if (key !== "enter") {
        playClickSound();
        vibrate([10]);
    }
    if (key === "del") {
        currentAnswer = currentAnswer.slice(0, -1);
        renderAnswer();
        return;
    }
    if (key === "clear") {
        currentAnswer = "";
        renderAnswer();
        return;
    }
    if (key === "enter") {
        if (!currentAnswer) return;
        checkAnswer();
        return;
    }
    if (currentAnswer.length >= 3) return;
    if (/^\d$/.test(key)) {
        currentAnswer += key;
        renderAnswer();
    }
}

// Физическая клавиатура
document.addEventListener("keydown", (e) => {
    if (gameScreen.classList.contains("hidden")) return;
    if (isLocked) return;
    const key = e.key;
    if (key >= "0" && key <= "9") handleKeyPress(key);
    else if (key === "Backspace") { e.preventDefault(); handleKeyPress("del"); }
    else if (key === "Delete") { e.preventDefault(); handleKeyPress("clear"); }
    else if (key === "Enter") handleKeyPress("enter");
    else if (key === "Escape") backToMenu();
});



fullscreenBtn?.addEventListener("click", () => {
    if (document.fullscreenEnabled) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }
});
function requestFullscreenOnMobile() {
    if (window.matchMedia("(max-width: 640px)").matches && document.fullscreenEnabled && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
}

// Инициализация
(async () => {
    await loadInitialData();
    await storage.syncLocalResults();
    leaderboard = await storage.getLeaderboard();
    const savedName = playerName;
    if (!savedName || savedName === "Игрок") {
        showOnlyScreen(nameInputScreen);
        playerNameInput.focus();
    } else {
        showOnlyScreen(menuScreen);
        renderLeaderboard();
    }

    if (playerName && playerName !== 'Игрок') {
        initPresence(playerName);
    }
    subscribeToOnlineUsers(renderOnlineUsers);
})();