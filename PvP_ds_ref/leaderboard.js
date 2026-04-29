import { db, useFirebase } from './storage.js';
import { ref, get, query, orderByChild, limitToFirst } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export async function getLeaderboard() {
    if (!useFirebase || !db) return null;
    try {
        const resultsRef = ref(db, 'results');
        const topQuery = query(resultsRef, orderByChild('totalTimeSec'), limitToFirst(10));
        const snapshot = await get(topQuery);

        const leaderboard = [];
        snapshot.forEach(child => {
            const data = child.val();
            leaderboard.push({
                playerName: data.playerName || "Игрок",
                totalTimeSec: data.totalTimeSec || 0,
                score: data.score || 0,
                rounds: data.rounds || 0,
                bestStreak: data.bestStreak || 0,
                finishedAt: data.finishedAt || 0,
                answers: data.answers || []
            });
        });

        const perfect = leaderboard.filter(item => item.score === item.rounds);
        perfect.sort((a, b) => a.totalTimeSec - b.totalTimeSec || a.finishedAt - b.finishedAt);
        return perfect.slice(0, 10);
    } catch (error) {
        if (error.message?.includes('Index not defined')) {
            return getLeaderboardFallback();
        }
        console.error("Ошибка загрузки лидеров:", error);
        return null;
    }
}

async function getLeaderboardFallback() {
    if (!useFirebase || !db) return null;
    try {
        const snapshot = await get(ref(db, 'results'));
        const leaderboard = [];
        snapshot.forEach(child => {
            const data = child.val();
            leaderboard.push({
                playerName: data.playerName || "Игрок",
                totalTimeSec: data.totalTimeSec || 0,
                score: data.score || 0,
                rounds: data.rounds || 0,
                bestStreak: data.bestStreak || 0,
                finishedAt: data.finishedAt || 0,
                answers: data.answers || []
            });
        });
        const perfect = leaderboard.filter(item => item.score === item.rounds);
        perfect.sort((a, b) => a.totalTimeSec - b.totalTimeSec || a.finishedAt - b.finishedAt);
        return perfect.slice(0, 10);
    } catch (e) {
        console.error("Fallback error:", e);
        return null;
    }
}