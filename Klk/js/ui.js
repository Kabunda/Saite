const screens = ['auth-screen', 'menu-screen', 'lobby-screen', 'game-screen', 'result-screen'];

export function showScreen(screenId) {
  screens.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}