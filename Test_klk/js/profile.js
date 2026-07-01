import { ref, get, set, update, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";

export function loadProfile(user) {
  const profileRef = ref(db, `userProfiles/${user.uid}`);
  get(profileRef).then(snap => {
    if (!snap.exists()) {
      // Создаём профиль при первом входе
      set(profileRef, {
        displayName: user.displayName || 'Игрок',
        stats: {
          wins: 0,
          losses: 0
        },
        updatedAt: serverTimestamp()
      });
    }
  });
}

export function updateStats(uid, isWin) {
  const updates = {};
  updates[`userProfiles/${uid}/stats/wins`] = increment(isWin ? 1 : 0);
  updates[`userProfiles/${uid}/stats/losses`] = increment(isWin ? 0 : 1);
  updates[`userProfiles/${uid}/updatedAt`] = serverTimestamp();
  update(ref(db), updates);
}