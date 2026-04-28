import {
    FIRST_MULTIPLIERS,
    SECOND_MIN,
    SECOND_MAX,
    buildUniqueQuestionList
} from './task-generator.js';
import * as storage from './storage.js';
import { initPresence,
    subscribeToOnlineUsers,
    updatePresenceStatus, 
    getPlayerId,
    removePresence } from './online-presence.js';

import { startSearch, 
    subscribeOpponentProgress, 
    updateMyProgress } from './multiplayer.js';    

// Экранирование HTML-символов для безопасного отображения имени игрока
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// DOM elements
const nameInputScreen = document.getElementById("nameInputScreen");
const menuScreen = document.getElementById("menuScreen");
const waitScreen = document.getElementById("waitScreen");               // новый экран
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
const cancelWaitBtn = document.getElementById("cancelWaitBtn");        // кнопка отмены ожидания
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
const countdownEl = document.getElementById("countdown");               // элемент обратного отсчёта

const opponentPanel = document.querySelector('.opponent-progress');     // Добавляем ссылку на панель соперника

// Глобальное состояние, загружаемое из хранилища
let playerName = "Игрок";
let leaderboard = null;
let soundEnabled = true;
let vibrationEnabled = true;
let selectedRounds = 20;
let themeDark = false;

// Игровое состояние
let currentRound = 0;
let score = 0;
let currentA = 0;
let currentB = 0;
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
let waitIntervalId = null;         // идентификатор таймера обратного отсчёта
let cancelMatchmaking = null;   // функция отмены поиска из multiplayer
let multiplayerSessionId = null;
let multiplayerOpponentId = null;
let opponentUnsubscribe = null;

// ----- Загрузка данных при старте -----
async function loadInitialData() {
    playerName = await storage.getPlayerName();
    leaderboard = await storage.getLeaderboard();
    soundEnabled = await storage.getBoolSetting('mt_sound_enabled', true);
    vibrationEnabled = await storage.getBoolSetting('mt_vibration_enabled', true);
    selectedRounds = await storage.getSelectedRounds();
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
        leaderboardBody.innerHTML = `<tr><td colspan="5" class="leaderboard-error">⚠️ Не удалось загрузить таблицу лидеров. Проверьте подключение к интернету.</td></tr>`;
        return;
    }
    if (!leaderboard.length) {
        leaderboardBody.innerHTML = `<tr><td colspan="5">Пока нет результатов.</td></tr>`;
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    leaderboardBody.innerHTML = leaderboard.slice(0, 10).map((item, idx) => {
        const penalty = item.rounds - item.score;
        const penaltyText = penalty > 0 ? ` (+${penalty * 5})` : '';
        return `
        <tr>
            <td>${idx < 3 ? medals[idx] : idx + 1}</td>
            <td title="${escapeHtml(item.playerName)}">${escapeHtml(item.playerName.substring(0, 12))}${item.playerName.length > 12 ? '…' : ''}</td>
            <td>${item.totalTimeSec.toFixed(1)} сек${penaltyText}</td>
            <td>${item.score}/${item.rounds}</td>
            <td>${item.bestStreak ?? '—'}</td>
        </tr>
        `;
    }).join('');
}

// ----- Добавляем отображение онлайн-пользователей -----
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

// ----- Игровая логика -----
function setCurrentQuestion() {
    const q = currentQuestions[currentRound];
    currentA = q.a;
    currentB = q.b;
    questionText.textContent = `${currentA} × ${currentB} = ?`;
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

// --- Игровая логика (изменена) ---
function startGame() {
    // Отменяем предыдущий поиск, если есть
    if (cancelMatchmaking) {
        cancelMatchmaking();
        cancelMatchmaking = null;
    }

    showOnlyScreen(waitScreen);
    updatePresenceStatus('waiting');

    // Запускаем обратный отсчёт (5 секунд)
    if (waitIntervalId) clearInterval(waitIntervalId);
    let countdown = 5;
    countdownEl.textContent = countdown;
    waitIntervalId = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            // Отменяем поиск и начинаем одиночную игру
            if (cancelMatchmaking) {
                cancelMatchmaking();
                cancelMatchmaking = null;
            }
            startGameReal();
        }
    }, 1000);

    // Запускаем поиск соперника
    const { cancel, promise } = startSearch(playerName, selectedRounds);
    cancelMatchmaking = cancel;

    promise
        .then(({ sessionId, questions, opponentId, opponentName, startTime }) => {
            // Соперник найден, отменяем обратный отсчёт
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            cancelMatchmaking = null;

            // Ждём startTime (может прийти сразу или быть переданным)
            if (startTime) {
                startMultiplayerGame(sessionId, questions, opponentId, opponentName, startTime);
            } else {
                // Подписываемся на startTime
                const unsub = subscribeToGameStart(sessionId, (st) => {
                    unsub();
                    startMultiplayerGame(sessionId, questions, opponentId, opponentName, st);
                });
                // На случай отмены
                const originalCancel = cancel;
                cancelMatchmaking = () => {
                    unsub();
                    originalCancel();
                };
            }
        })
        .catch((err) => {
            console.warn('Мультиплеер недоступен, начинаем одиночную игру:', err);
            cancelMatchmaking = null;
            clearInterval(waitIntervalId);
            waitIntervalId = null;
            startGameReal();
        });
}

// Отмена ожидания – возврат в меню
cancelWaitBtn.addEventListener('click', () => {
    if (waitIntervalId) {
        clearInterval(waitIntervalId);
        waitIntervalId = null;
    }
    if (cancelMatchmaking) {
        cancelMatchmaking();
        cancelMatchmaking = null;
    }
    backToMenu();
});

function startGameReal() {
    // Скрываем панель соперника
    if (opponentPanel) opponentPanel.style.display = 'none';

    currentQuestions = buildUniqueQuestionList(selectedRounds);
    resetGameState();
    updatePresenceStatus('playing');
    showOnlyScreen(gameScreen);
    initProgressTrack();
    resetFeedback();
    renderAnswer();
    setCurrentQuestion();
    startTimer();
    requestFullscreenOnMobile();
}

function startMultiplayerGame(sessionId, questions, opponentId, opponentName, startTime) {
    // Показываем панель соперника
    if (opponentPanel) opponentPanel.style.display = '';

    multiplayerSessionId = sessionId;
    multiplayerOpponentId = opponentId;

    currentQuestions = questions;
    resetGameState();

    // Синхронизация времени: используем серверное время старта
    gameStartTime = startTime; // startTime уже в миллисекундах по серверу
    // Корректировка локального таймера: вычисляем offset
    const serverTime = startTime;
    const localTime = Date.now();
    // Для корректного отображения таймера будем хранить смещение
    gameStartTime = localTime - (localTime - serverTime); // по сути serverTime
    // Но проще хранить serverTime и вычислять elapsed = (Date.now() - (serverTime - offset)), но offset неизвестен.
    // Однако разница между клиентами будет минимальна, используем просто триггер старта:
    // сбрасываем timer на 0 при старте реального игрового цикла.
    // Установим gameStartTime = Date.now() в момент получения startTime – это даст почти одновременный старт.
    gameStartTime = Date.now();

    updatePresenceStatus('playing');
    showOnlyScreen(gameScreen);

    initProgressTrack();
    initOpponentProgressBar(opponentName, questions.length);

    opponentUnsubscribe = subscribeOpponentProgress(sessionId, getPlayerId(), (data) => {
        updateOpponentProgressBar(data.progress, data.score, data.answers, currentQuestions.length);
        if (data.finished) {
            showOpponentFinishedMessage(opponentName, data.score, data.totalTimeSec);
        }
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
    if (opponentUnsubscribe) {
        opponentUnsubscribe();
        opponentUnsubscribe = null;
    }
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
    // Сначала сбрасываем все классы
    cells.forEach(cell => {
        cell.classList.remove('progress-cell--ok', 'progress-cell--bad');
    });
    // Применяем результаты из answers
    if (answers && Array.isArray(answers)) {
        answers.forEach(ans => {
            const idx = ans.index;
            if (idx >= 0 && idx < cells.length) {
                cells[idx].classList.add(ans.correct ? 'progress-cell--ok' : 'progress-cell--bad');
            }
        });
    } else {
        // Если answers нет, закрашиваем только отвеченные как успешные (старое поведение)
        for (let i = 0; i < progress && i < cells.length; i++) {
            cells[i].classList.add('progress-cell--ok');
        }
    }
    document.getElementById('opponentScore').textContent = `${score}/${total}`;
}

function checkAnswer() {
    const value = Number(currentAnswer);
    const correct = currentA * currentB;
    const isCorrect = value === correct;
    isLocked = true;
    answersLog.push({ a: currentA, b: currentB, playerAnswer: value, correctAnswer: correct, isCorrect });
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
        mistakesInCurrentGame.push({ a: currentA, b: currentB });
        feedbackEl.textContent = `✗ Неверно. Правильно: ${correct}`;
        feedbackEl.classList.add("bad");
        playTone(240, 0.3);
        vibrate([100, 50, 100]);
        document.querySelector(".game-area")?.classList.add("shake-area");
        setTimeout(() => document.querySelector(".game-area")?.classList.remove("shake-area"), 400);
    }
    paintProgressCell(isCorrect);

    if (multiplayerSessionId) {
        // Отправляем прогресс + последний ответ
        updateMyProgress(
            multiplayerSessionId,
            getPlayerId(),
            currentRound + 1,
            score,
            false,
            0,
            { answers: answersLog.map((item, i) => ({ index: i, correct: item.isCorrect })) } // отправляем весь массив
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

    answersList.innerHTML = answersLog.map((item, idx) => {
        const status = item.isCorrect ? "Верно" : "Неверно";
        return `<li class="${item.isCorrect ? 'answer-ok' : 'answer-bad'}">
            ${idx + 1}) ${item.a} × ${item.b} = ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
        </li>`;
    }).join('');
}

// Обновлённая функция возврата в меню
function backToMenu() {
    // Если игра активна – требуется подтверждение
    if (!gameScreen.classList.contains("hidden")) {
        //if (!confirm("Вы уверены, что хотите выйти? Прогресс будет потерян.")) return;
    }
    // Если активен экран ожидания – просто останавливаем таймер и возвращаемся
    if (!waitScreen.classList.contains("hidden")) {
        if (waitIntervalId) {
            clearInterval(waitIntervalId);
            waitIntervalId = null;
        }
    }

    if (opponentUnsubscribe) {
        opponentUnsubscribe();
        opponentUnsubscribe = null;
    }
// При возврате в меню также безопасно отменяем поиск, если он ещё активен:
    if (cancelMatchmaking) {
        cancelMatchmaking();
        cancelMatchmaking = null;
    }
    
    stopTimer();
    gameStartTime = 0;
    isLocked = true;
    updatePresenceStatus('menu');
    showOnlyScreen(menuScreen);
    updateMenuStatus();
    // Обновить таблицу лидеров
    (async () => {
        leaderboard = await storage.getLeaderboard();
        renderLeaderboard();
    })();
}

// -----Меню настроек-----
function openSettingsModal() {
    modalSoundToggle.checked = soundEnabled;
    modalVibrationToggle.checked = vibrationEnabled;
    modalSoundToggle.focus();
    playerNameInput.value = playerName;
    showOnlyScreen(nameInputScreen);
}

function openEditNameModal() {        
    playerNameInput.value = playerName;
    showOnlyScreen(nameInputScreen);
    playerNameInput.focus();
}

function updateMenuStatus() {
    currentPlayerName.textContent = playerName;
    document.getElementById("roundsSubtitle").textContent = `${selectedRounds} вопросов: 5, 8, 11, 17, 35 × 2..20`;
}

// ----- Выбор количества вопросов -----
document.querySelectorAll(".rounds-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
        selectedRounds = parseInt(btn.dataset.rounds, 10);
        await storage.setSelectedRounds(selectedRounds);
        document.querySelectorAll(".rounds-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateMenuStatus();
    });
});
document.querySelector(`.rounds-btn[data-rounds="${selectedRounds}"]`)?.classList.add("active");

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

    showOnlyScreen(menuScreen);
    updateMenuStatus();
    leaderboard = await storage.getLeaderboard();
    renderLeaderboard();
});
playerNameInput.addEventListener("input", () => nameError.classList.add("hidden"));
playerNameInput.addEventListener("keydown", e => e.key === "Enter" && continueBtn.click());

// ----- Игровые кнопки -----
startBtn.addEventListener("click", startGame);
backBtn.addEventListener("click", backToMenu);
playAgainBtn.addEventListener("click", startGame);   // При повторной игре тоже запускает отсчёт
toMenuBtn.addEventListener("click", backToMenu);

// Клавиатура на экране
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

// Физическая клавиатура – работает только на игровом экране
document.addEventListener("keydown", (e) => {
    if (gameScreen.classList.contains("hidden")) return;   // игровой экран скрыт (включая экран ожидания)
    if (isLocked) return;
    const key = e.key;
    if (key >= "0" && key <= "9") handleKeyPress(key);
    else if (key === "Backspace") { e.preventDefault(); handleKeyPress("del"); }
    else if (key === "Delete") { e.preventDefault(); handleKeyPress("clear"); }
    else if (key === "Enter") handleKeyPress("enter");
    else if (key === "Escape") backToMenu();
});

// Открывает начальный экран с настройками
settingsBtn.addEventListener("click", openSettingsModal);
editNameBtn.addEventListener("click", openEditNameModal);

// Полноэкранный режим
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

// Инициализация приложения
(async () => {
    await loadInitialData();
    await storage.syncLocalResults();
    leaderboard = await storage.getLeaderboard();

    updateMenuStatus();
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