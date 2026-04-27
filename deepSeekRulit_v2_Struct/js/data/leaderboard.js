// Логика таблицы лидеров
import { escapeHtml } from '../utils/dom.js';
import { MAX_LEADERBOARD_ENTRIES, PENALTY_PER_MISTAKE } from '../utils/constants.js';

/**
 * Формирует HTML для таблицы лидеров
 * @param {Array} leaderboardData - данные таблицы лидеров
 * @param {boolean} showOfflineWarning - показывать предупреждение об офлайн-режиме
 * @returns {string} HTML
 */
export function renderLeaderboard(leaderboardData, showOfflineWarning = false) {
    if (!leaderboardData) {
        return `
            <tr>
                <td colspan="5" class="leaderboard-error">
                    ⚠️ ${escapeHtml(showOfflineWarning 
                        ? "Не удалось загрузить таблицу лидеров. Проверьте подключение к интернету." 
                        : "Таблица лидеров временно недоступна.")}
                </td>
            </tr>
        `;
    }

    if (leaderboardData.length === 0) {
        return `
            <tr>
                <td colspan="5">Пока нет результатов. Будьте первым!</td>
            </tr>
        `;
    }

    const medals = ['🥇', '🥈', '🥉'];
    
    return leaderboardData.map((item, idx) => {
        const penalty = item.rounds - item.score;
        const penaltyText = penalty > 0 ? ` (+${penalty * PENALTY_PER_MISTAKE})` : '';
        const displayName = escapeHtml(item.playerName);
        const shortName = displayName.length > 12 
            ? displayName.substring(0, 12) + '…' 
            : displayName;
        
        return `
            <tr>
                <td>${idx < 3 ? medals[idx] : idx + 1}</td>
                <td title="${displayName}">${shortName}</td>
                <td>${item.totalTimeSec.toFixed(1)} сек${penaltyText}</td>
                <td>${item.score}/${item.rounds}</td>
                <td>${item.bestStreak || '—'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Сортирует результаты с учетом штрафного времени
 * @param {Array} results - массив результатов
 * @param {number} limit - максимальное количество записей
 * @returns {Array} отсортированный массив
 */
export function sortLeaderboard(results, limit = MAX_LEADERBOARD_ENTRIES) {
    if (!results || !Array.isArray(results)) {
        return [];
    }

    // Создаем копию для сортировки
    const sorted = [...results];

    // Сортировка по штрафному времени, затем по количеству очков
    sorted.sort((a, b) => {
        const penaltyA = calculatePenaltyTime(a);
        const penaltyB = calculatePenaltyTime(b);
        
        // Сначала по штрафному времени (меньше лучше)
        if (penaltyA !== penaltyB) {
            return penaltyA - penaltyB;
        }
        
        // Затем по количеству очков (больше лучше)
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        
        // Затем по лучшей серии
        return (b.bestStreak || 0) - (a.bestStreak || 0);
    });

    return sorted.slice(0, limit);
}

/**
 * Рассчитывает штрафное время для результата
 * @param {Object} result - результат игры
 * @returns {number} штрафное время
 */
export function calculatePenaltyTime(result) {
    const baseTime = result.totalTimeSec || 0;
    const mistakes = (result.rounds || 0) - (result.score || 0);
    return baseTime + (mistakes * PENALTY_PER_MISTAKE);
}

/**
 * Форматирует время для отображения
 * @param {number} seconds - время в секундах
 * @returns {string} отформатированное время
 */
export function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds.toFixed(1)} сек`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
}

/**
 * Обновляет DOM-элемент таблицы лидеров
 * @param {HTMLElement} tableBody - элемент tbody
 * @param {Array} leaderboardData - данные таблицы лидеров
 * @param {boolean} showOfflineWarning - показывать предупреждение об офлайн-режиме
 */
export function updateLeaderboardDOM(tableBody, leaderboardData, showOfflineWarning = false) {
    if (!tableBody) {
        console.error('Leaderboard: tableBody element not found');
        return;
    }

    tableBody.innerHTML = renderLeaderboard(leaderboardData, showOfflineWarning);
}

/**
 * Создает объект результата для сохранения
 * @param {Object} gameStats - статистика игры из GameLogic
 * @param {string} playerName - имя игрока
 * @returns {Object} результат для сохранения
 */
export function createResultObject(gameStats, playerName) {
    return {
        playerName,
        score: gameStats.score,
        rounds: gameStats.totalRounds,
        totalTimeSec: gameStats.totalTime,
        totalTimeWithPenalty: gameStats.totalTimeWithPenalty,
        bestStreak: gameStats.bestStreak,
        accuracy: gameStats.accuracy,
        mistakes: gameStats.mistakesCount,
        timestamp: Date.now(),
        finishedAt: Date.now()
    };
}

/**
 * Фильтрует результаты по игроку
 * @param {Array} results - массив результатов
 * @param {string} playerName - имя игрока
 * @param {number} limit - максимальное количество записей
 * @returns {Array} результаты игрока
 */
export function getPlayerResults(results, playerName, limit = 5) {
    if (!results || !playerName) {
        return [];
    }

    const playerResults = results.filter(result => 
        result.playerName && result.playerName.toLowerCase() === playerName.toLowerCase()
    );

    return sortLeaderboard(playerResults, limit);
}

/**
 * Получает лучший результат игрока
 * @param {Array} results - массив результатов
 * @param {string} playerName - имя игрока
 * @returns {Object|null} лучший результат
 */
export function getPlayerBestResult(results, playerName) {
    const playerResults = getPlayerResults(results, playerName, 1);
    return playerResults.length > 0 ? playerResults[0] : null;
}

/**
 * Проверяет, является ли результат новым рекордом для игрока
 * @param {Object} newResult - новый результат
 * @param {Object} bestResult - текущий лучший результат игрока
 * @returns {boolean}
 */
export function isNewRecord(newResult, bestResult) {
    if (!bestResult) {
        return true;
    }

    const newPenalty = calculatePenaltyTime(newResult);
    const bestPenalty = calculatePenaltyTime(bestResult);

    return newPenalty < bestPenalty;
}

/**
 * Создает HTML для отображения личного рекорда
 * @param {Object} bestResult - лучший результат игрока
 * @returns {string} HTML
 */
export function renderPersonalBest(bestResult) {
    if (!bestResult) {
        return '<div class="personal-best empty">У вас пока нет сохранённых результатов</div>';
    }

    const penalty = calculatePenaltyTime(bestResult);
    const baseTime = bestResult.totalTimeSec || 0;
    const mistakes = (bestResult.rounds || 0) - (bestResult.score || 0);
    
    return `
        <div class="personal-best">
            <h4>Ваш лучший результат</h4>
            <div class="personal-best-stats">
                <div class="stat">
                    <span class="label">Время:</span>
                    <span class="value">${formatTime(baseTime)}</span>
                </div>
                <div class="stat">
                    <span class="label">Ошибки:</span>
                    <span class="value">${mistakes}</span>
                </div>
                <div class="stat">
                    <span class="label">Штраф:</span>
                    <span class="value">+${(mistakes * PENALTY_PER_MISTAKE).toFixed(1)} сек</span>
                </div>
                <div class="stat">
                    <span class="label">Итог:</span>
                    <span class="value highlight">${formatTime(penalty)}</span>
                </div>
            </div>
        </div>
    `;
}