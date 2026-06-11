import { initAuthUI, onAuthChange, getCurrentUser } from "./auth.js";
import { showScreen } from "./ui.js";
import { findOrCreateRoom, leaveLobby } from "./lobby.js";
import { startOnlinePlayersList, stopOnlinePlayersList } from "./onlinePlayers.js";

initAuthUI();

// Глобальные обработчики (не зависят от авторизации)
document.getElementById('cancel-search-btn').addEventListener('click', () => {
  leaveLobby();
  showScreen('menu-screen');
});
document.getElementById('to-menu-btn').addEventListener('click', () => {
  leaveLobby();
  showScreen('menu-screen');
});

onAuthChange((user) => {
  if (user) {
    document.getElementById('player-name').textContent = user.displayName || 'Игрок';
    const avatarImg = document.getElementById('player-avatar');
    if (user.photoURL) {
      avatarImg.src = user.photoURL;
      avatarImg.style.display = 'block';
    } else {
      avatarImg.style.display = 'none';
    }
    showScreen('menu-screen');
    document.getElementById('play-btn').onclick = findOrCreateRoom;
    startOnlinePlayersList('online-players-list');
  } else {
    showScreen('auth-screen');
    leaveLobby();
    stopOnlinePlayersList();
  }
});