// Переключение темы
function switchTheme(themeName) {
  const link = document.getElementById('theme-style');
  if (link) {
    link.href = `./css/${themeName}.css`;
  }
  // Сохраняем выбор в localStorage, чтобы при перезагрузке тема сохранялась
  localStorage.setItem('selectedTheme', themeName);
}

// При загрузке – восстановить сохранённую тему
function restoreTheme() {
  const saved = localStorage.getItem('selectedTheme');
  if (saved) {
    switchTheme(saved);
  }
}

// Инициализация кнопок выбора темы
function initThemeSelector() {
  const buttons = document.querySelectorAll('.theme-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      switchTheme(theme);
    });
  });
}

// Вызвать при старте приложения (после загрузки DOM)
document.addEventListener('DOMContentLoaded', () => {
  restoreTheme();
  initThemeSelector();
});