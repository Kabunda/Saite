import { ref, onValue } from "firebase/database";
import { db } from "./config.js";
import { auth } from "./config.js";

export function showOnlinePlayers() {
  const presenceRef = ref(db, 'userPresence');
  onValue(presenceRef, (snapshot) => {
    const players = snapshot.val();
    const list = document.getElementById('online-list');
    list.innerHTML = '';
    
    for (const uid in players) {
      const p = players[uid];
      if (p.online) {
        const item = document.createElement('div');
        item.textContent = `${uid} — ${p.currentRoom ? 'В игре' : 'В меню'}`;
        list.appendChild(item);
      }
    }
  });
}

const screens = ['auth-screen', 'menu-screen', 'lobby-screen', 'game-screen', 'result-screen'];

export function showScreen(screenId) {
  screens.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}