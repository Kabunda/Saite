import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./config.js";
import { showScreen } from "./ui.js";
import { initPresence } from "./presence.js";
import { loadProfile } from "./profile.js";

let currentUser = null;

// Настройка провайдеров (Яндекс оставлен как OIDC, если настроен)
const googleProvider = new GoogleAuthProvider();
// Для Яндекса (если настроен OIDC в Firebase)
// import { OAuthProvider } from "...";
// const yandexProvider = new OAuthProvider('oidc.yandex');

// Привязка кнопок
export function initAuthUI() {
  document.getElementById('google-login-btn').addEventListener('click', () => signIn(googleProvider));
  // document.getElementById('yandex-login-btn').addEventListener('click', () => signIn(yandexProvider));
  document.getElementById('logout-btn').addEventListener('click', logout);
}

async function signIn(provider) {
  try {
    const result = await signInWithPopup(auth, provider);
    // Успешный вход обработает onAuthStateChanged
  } catch (error) {
    document.getElementById('auth-error').textContent = `Ошибка входа: ${error.message}`;
  }
}

async function logout() {
  await signOut(auth);
}

// Экспорт текущего пользователя (реактивно обновляется в app.js)
export function getCurrentUser() {
  return currentUser;
}

// Подписка на изменение состояния
export function onAuthChange(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
    if (user) {
      // Инициализируем присутствие и загружаем профиль
      initPresence(user);
      loadProfile(user);
    }
  });
}