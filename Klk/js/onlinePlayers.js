import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";

let playersListener = null;

export function startOnlinePlayersList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Остановить предыдущий слушатель, если был
  if (playersListener) {
    playersListener();
    playersListener = null;
  }

  const presenceRef = ref(db, 'userPresence');
  playersListener = onValue(presenceRef, (snapshot) => {
    const players = snapshot.val();
    container.innerHTML = '';

    if (!players) {
      container.innerHTML = '<p>Нет игроков онлайн</p>';
      return;
    }

    // Сортируем: сначала онлайн, потом по алфавиту
    const onlinePlayers = Object.entries(players)
      .filter(([_, data]) => data.online)
      .sort(([, a], [, b]) => (a.displayName || '').localeCompare(b.displayName || ''));

    if (onlinePlayers.length === 0) {
      container.innerHTML = '<p>Нет игроков онлайн</p>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'player-list';

    onlinePlayers.forEach(([uid, data]) => {
      const li = document.createElement('li');
      li.className = 'player-item';

      // Аватар
      const avatar = document.createElement('img');
      avatar.src = data.photoURL || 'https://via.placeholder.com/32';
      avatar.alt = 'Аватар';
      avatar.className = 'player-avatar';

      // Имя
      const name = document.createElement('span');
      name.textContent = data.displayName || 'Игрок';
      name.className = 'player-name';

      // Статус (в игре / свободен)
      const status = document.createElement('span');
      status.className = 'player-status';
      status.textContent = data.currentRoom ? '🟡 В игре' : '🟢 Свободен';

      li.appendChild(avatar);
      li.appendChild(name);
      li.appendChild(status);
      list.appendChild(li);
    });

    container.appendChild(list);
  });
}

export function stopOnlinePlayersList() {
  if (playersListener) {
    playersListener();
    playersListener = null;
  }
}