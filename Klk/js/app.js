import { initAuthUI, onAuthChange, getCurrentUser } from "./auth.js";
import { showScreen, showOnlinePlayers } from "./ui.js";
import { findOrCreateRoom, leaveLobby } from "./lobby.js";
import { startOnlinePlayersList, stopOnlinePlayersList } from "./onlinePlayers.js";

// Инициализация UI авторизации (вешаем кнопки)
initAuthUI();

// Слушаем изменения состояния аутентификации
onAuthChange((user) => {
  if (user) {
    // Имя
    document.getElementById('player-name').textContent = user.displayName || 'Игрок';
    
    // Аватар
    const avatarImg = document.getElementById('player-avatar');
    if (user.photoURL) {
      avatarImg.src = user.photoURL;
      avatarImg.style.display = 'block';
    } else {
      avatarImg.style.display = 'none';
    }
    
    showScreen('menu-screen');
    document.getElementById('play-btn').onclick = findOrCreateRoom;

    // Запускаем отображение онлайн-игроков
    startOnlinePlayersList('online-players-list');
  } else {
    showScreen('auth-screen');
    leaveLobby();
    stopOnlinePlayersList();
  }
});

// Кнопка "В главное меню" на экране результатов
document.getElementById('to-menu-btn').addEventListener('click', () => {
  leaveLobby();
  showScreen('menu-screen');
});