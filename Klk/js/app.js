import { initAuthUI, onAuthChange, getCurrentUser } from "./auth.js";
import { showScreen } from "./ui.js";
import { findOrCreateRoom, leaveLobby } from "./lobby.js";

// Инициализация UI авторизации (вешаем кнопки)
initAuthUI();

// Слушаем изменения состояния аутентификации
onAuthChange((user) => {
  if (user) {
    // Пользователь вошёл
    document.getElementById('player-name').textContent = user.displayName;
    showScreen('menu-screen');
    // Привязываем кнопку "Играть"
    document.getElementById('play-btn').addEventListener('click', findOrCreateRoom);
  } else {
    // Вышел – показываем экран логина
    showScreen('auth-screen');
    leaveLobby(); // на всякий случай очистим слушатели
  }
});

// Кнопка "В главное меню" на экране результатов
document.getElementById('to-menu-btn').addEventListener('click', () => {
  leaveLobby();
  showScreen('menu-screen');
});