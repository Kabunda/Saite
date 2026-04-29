// Модуль управления интерфейсом
import { state } from './state.js';
import { escapeHtml } from './escapeHtml.js';
import { playClickSound } from './audio.js';
import { getCurrentSession } from './game.js';
import { getLeaderboard } from './leaderboard.js';
import { getPlayerId } from './presence.js';
import { subscribeOpponentProgress } from './multiplayer.js';

// ---------- Кэш DOM-элементов ----------
const screens = {
    nameInput: document.getElementById('nameInputScreen'),
    menu: document.getElementById('menuScreen'),
    wait: document.getElementById('waitScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen')
};

export const els = {
    // name input
    playerNameInput: document.getElementById('playerNameInput'),
    nameError: document.getElementById('nameError'),
    continueBtn: document.getElementById('continueBtn'),
    // toggles
    themeToggle: document.getElementById('themeToggle'),
    modalSoundToggle: document.getElementById('modalSoundToggle'),
    modalVibrationToggle: document.getElementById('modalVibrationToggle'),
    // menu
    currentPlayerName: document.getElementById('currentPlayerName'),
    startBtn: document.getElementById('startBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    onlinePlayersList: document.getElementById('onlinePlayersList'),
    leaderboardBody: document.getElementById('leaderboardBody'),
    // wait
    waitMessage: document.getElementById('waitMessage'),
    countdown: document.getElementById('countdown'),
    opponentInfo: document.getElementById('opponentInfo'),
    opponentNameSpan: document.getElementById('opponentNameSpan'),
    cancelWaitBtn: document.getElementById('cancelWaitBtn'),
    // game
    progressTrack: document.getElementById('progressTrack'),
    opponentProgressTrack: document.getElementById('opponentProgressTrack'),
    opponentScore: document.getElementById('opponentScore'),
    timer: document.getElementById('timer'),
    questionText: document.getElementById('questionText'),
    answerText: document.getElementById('answerText'),
    feedback: document.getElementById('feedback'),
    keypad: document.getElementById('keypad'),
    backBtn: document.getElementById('backBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    // result
    resultSummary: document.getElementById('resultSummary'),
    timeScale: document.getElementById('timeScale'),
    answersList: document.getElementById('answersList'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    toMenuBtn: document.getElementById('toMenuBtn'),
    // tooltip
    leaderboardTooltip: document.getElementById('leaderboardTooltip')
};

let opponentUnsubscribe = null;

// ---------- Показ экранов ----------
export function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[id].classList.remove('hidden');
}

// ---------- Тема ----------
export function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.themeDark ? "dark" : "light");
    els.themeToggle.checked = state.themeDark;
}

export function initThemeToggle() {
    els.themeToggle.addEventListener('change', async () => {
        state.themeDark = els.themeToggle.checked;
        applyTheme();
        const { setTheme } = await import('./storage.js');
        setTheme(state.themeDark);
    });
}

// ---------- Таблица лидеров ----------
export async function renderLeaderboard() {
    const board = await getLeaderboard();
    state.leaderboard = board;
    const tbody = els.leaderboardBody;
    if (!board) {
        tbody.innerHTML = `<tr><td colspan="4" class="leaderboard-error">⚠️ Не удалось загрузить таблицу лидеров.</td></tr>`;
        return;
    }
    if (!board.length) {
        tbody.innerHTML = `<tr><td colspan="4">Пока нет результатов.</td></tr>`;
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    tbody.innerHTML = board.slice(0, 10).map((item, idx) => {
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

    // тултип
    document.querySelectorAll('.leader-row').forEach(row => {
        row.addEventListener('mouseenter', e => {
            const answers = JSON.parse(decodeURIComponent(row.dataset.answers));
            if (!answers.length) return;
            const list = answers.map((a, i) => `${i+1}) ${a.questionText || (a.a + ' × ' + a.b)} = ${a.playerAnswer}`).join('<br>');
            els.leaderboardTooltip.innerHTML = list;
            els.leaderboardTooltip.classList.remove('hidden');
        });
        row.addEventListener('mouseleave', () => els.leaderboardTooltip.classList.add('hidden'));
        row.addEventListener('mousemove', e => {
            els.leaderboardTooltip.style.left = e.pageX + 15 + 'px';
            els.leaderboardTooltip.style.top = e.pageY + 15 + 'px';
        });
    });
}

// ---------- Онлайн пользователи ----------
function timeAgo(ts) {
    if (!ts) return '';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return 'только что';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    return `${Math.floor(minutes / 60)} ч назад`;
}

export function renderOnlineUsers(users) {
    const list = els.onlinePlayersList;
    if (!users.length) {
        list.innerHTML = '<li>Никого нет в сети</li>';
        return;
    }
    list.innerHTML = users.map(u => {
        const statusText = u.status === 'playing' ? '🎮 Играет' :
                           u.status === 'waiting' ? '⏳ Ожидание игры' : '📋 В меню';
        const joined = u.joinedAt ? timeAgo(u.joinedAt) : '';
        return `<li><strong>${escapeHtml(u.name)}</strong> — <em>${statusText}</em> ${joined ? `<small>(${joined})</small>` : ''}</li>`;
    }).join('');
}

// ---------- Таймер ----------
let timerInterval = null;
export function startTimer() {
    stopTimer();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
}
export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}
function updateTimerDisplay() {
    const session = getCurrentSession();
    if (!session || !session.startTime) {
        els.timer.textContent = "Время: 00:00";
        return;
    }
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    els.timer.textContent = `Время: ${m}:${s}`;
}

// ---------- Прогресс-бар игрока ----------
let progressCells = [];
export function initProgressTrack(total) {
    els.progressTrack.innerHTML = "";
    progressCells = [];
    els.progressTrack.style.gridTemplateColumns = `repeat(${total}, 1fr)`;
    for (let i = 0; i < total; i++) {
        const cell = document.createElement("div");
        cell.className = "progress-cell";
        if (i === 0) cell.classList.add("progress-cell--current");
        els.progressTrack.appendChild(cell);
        progressCells.push(cell);
    }
    els.progressTrack.setAttribute("aria-valuemax", total);
    els.progressTrack.setAttribute("aria-valuenow", 0);
}

export function updateProgressCurrentHighlight(round) {
    progressCells.forEach((cell, idx) => {
        cell.classList.remove("progress-cell--current");
        if (idx === round) cell.classList.add("progress-cell--current");
    });
    els.progressTrack?.setAttribute("aria-valuenow", round);
}

export function paintProgressCell(round, isCorrect) {
    const cell = progressCells[round];
    if (!cell) return;
    cell.classList.add(isCorrect ? "progress-cell--ok" : "progress-cell--bad");
    if (!isCorrect) cell.classList.add("shake");
}

// ---------- Прогресс-бар соперника ----------
export function initOpponentProgressBar(name, total) {
    const track = els.opponentProgressTrack;
    track.innerHTML = '';
    track.style.gridTemplateColumns = `repeat(${total}, 1fr)`;
    for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'progress-cell';
        track.appendChild(cell);
    }
    document.querySelector('.opponent-label').textContent = `Соперник (${name}): `;
    els.opponentScore.textContent = `0/${total}`;
}

export function updateOpponentProgressBar(progress, score, answers, total) {
    const cells = els.opponentProgressTrack.querySelectorAll('.progress-cell');
    cells.forEach(c => c.classList.remove('progress-cell--ok', 'progress-cell--bad'));
    if (answers && Array.isArray(answers)) {
        answers.forEach(ans => {
            if (ans.index >= 0 && ans.index < cells.length) {
                cells[ans.index].classList.add(ans.correct ? 'progress-cell--ok' : 'progress-cell--bad');
            }
        });
    } else {
        for (let i = 0; i < progress && i < cells.length; i++) {
            cells[i].classList.add('progress-cell--ok');
        }
    }
    els.opponentScore.textContent = `${score}/${total}`;
}

// ---------- Игровой экран: отображение вопроса/ответа ----------
export function displayQuestion(questionObj) {
    els.questionText.textContent = questionObj.text;
    els.questionText.classList.remove("fade-in");
    void els.questionText.offsetWidth;
    els.questionText.classList.add("fade-in");
}

export function updateAnswerDisplay(currentAnswer) {
    els.answerText.textContent = currentAnswer.length ? currentAnswer : "_";
    if (currentAnswer.length) {
        els.answerText.classList.add("pop");
        setTimeout(() => els.answerText.classList.remove("pop"), 100);
    }
}

export function showFeedback(text, isCorrect) {
    els.feedback.textContent = text;
    els.feedback.className = "feedback";
    els.feedback.classList.add(isCorrect ? "ok" : "bad");
    if (!isCorrect) {
        document.querySelector(".game-area")?.classList.add("shake-area");
        setTimeout(() => document.querySelector(".game-area")?.classList.remove("shake-area"), 400);
    }
}

export function clearFeedback() {
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
}

// ---------- Клавиатура ----------
export function bindKeypad(onKeyPress) {
    els.keypad.addEventListener("click", (e) => {
        const key = e.target?.dataset?.key;
        if (!key) return;
        if (key !== "enter") playClickSound();
        onKeyPress(key);
    });

    document.addEventListener("keydown", (e) => {
        if (screens.game.classList.contains("hidden")) return;
        const key = e.key;
        if (key >= "0" && key <= "9") onKeyPress(key);
        else if (key === "Backspace") { e.preventDefault(); onKeyPress("del"); }
        else if (key === "Delete") { e.preventDefault(); onKeyPress("clear"); }
        else if (key === "Enter") onKeyPress("enter");
        else if (key === "Escape") document.getElementById('backBtn').click();
    });
}

// ---------- Экран результатов ----------
export function showResultScreen(resultObj, personalBest) {
    const streakHtml = resultObj.bestStreak > 0 ? ` 🔥 Серия: ${resultObj.bestStreak}` : '';
    els.resultSummary.innerHTML = `${resultObj.playerName}, результат: ${resultObj.score}/${resultObj.rounds}. ` +
        `Время: ${resultObj.totalTimeSec.toFixed(1)} сек.${streakHtml} Ошибок: ${resultObj.mistakes ? resultObj.mistakes.length : 0}.`;

    if (personalBest && personalBest > 0) {
        els.timeScale.classList.remove("hidden");
        const pct = Math.min(100, (personalBest / resultObj.totalTimeSec) * 100);
        els.timeScale.querySelector(".time-scale-fill").style.width = `${pct}%`;
        els.timeScale.querySelector(".time-scale-text").textContent = `Ваш лучший: ${personalBest.toFixed(1)} сек`;
    } else {
        els.timeScale.classList.add("hidden");
    }

    els.answersList.innerHTML = resultObj.answers.map((item, idx) => {
        const status = item.isCorrect ? "Верно" : "Неверно";
        return `<li class="${item.isCorrect ? 'answer-ok' : 'answer-bad'}">
            ${idx + 1}) ${item.questionText} ${item.playerAnswer} (${status}, правильно: ${item.correctAnswer})
        </li>`;
    }).join('');
}

// ---------- Подписка на прогресс соперника ----------
export function startOpponentProgressListener(sessionId) {
    if (opponentUnsubscribe) opponentUnsubscribe();
    opponentUnsubscribe = subscribeOpponentProgress(sessionId, getPlayerId(), (data) => {
        updateOpponentProgressBar(data.progress, data.score, data.answers, state.gameSession.questions.length);
    });
}

export function stopOpponentProgressListener() {
    if (opponentUnsubscribe) {
        opponentUnsubscribe();
        opponentUnsubscribe = null;
    }
}

// ---------- Fullscreen ----------
export function requestFullscreenIfMobile() {
    if (window.matchMedia("(max-width: 640px)").matches && document.fullscreenEnabled && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
}

export function bindFullscreenButton() {
    els.fullscreenBtn.addEventListener("click", () => {
        if (document.fullscreenEnabled) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }
    });
}