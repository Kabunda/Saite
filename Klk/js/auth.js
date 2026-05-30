import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./config.js";
import { showScreen } from "./ui.js";
import { initPresence } from "./presence.js";
import { loadProfile } from "./profile.js";

let currentUser = null;

// Провайдеры
const googleProvider = new GoogleAuthProvider();
const yandexProvider = new OAuthProvider('oidc.yandex');  // Provider ID из консоли Firebase

// Настройка дополнительных scope для Яндекса (они же права приложения)
yandexProvider.addScope('login:email');
yandexProvider.addScope('login:info');
yandexProvider.addScope('login:avatar');

// Принудительный выбор аккаунта при каждом входе
yandexProvider.setCustomParameters({
  prompt: 'select_account'
});

export function initAuthUI() {
  document.getElementById('google-login-btn').addEventListener('click', () => signIn(googleProvider, 'Google'));
  document.getElementById('yandex-login-btn').addEventListener('click', () => signIn(yandexProvider, 'Yandex'));
  document.getElementById('logout-btn').addEventListener('click', logout);
}

async function signIn(provider, name) {
  try {
    const result = await signInWithPopup(auth, provider);
    
    // Для Яндекса: дополнительно получаем полный профиль через API
    if (name === 'Yandex') {
      await enrichYandexProfile(result);
    }
    // Успешный вход обработает onAuthStateChanged
  } catch (error) {
    document.getElementById('auth-error').textContent = `Ошибка входа (${name}): ${error.message}`;
  }
}

async function enrichYandexProfile(result) {
  // Получаем access token Яндекса из credential
  const credential = OAuthProvider.credentialFromResult(result);
  const accessToken = credential.accessToken;

  if (!accessToken) return;

  try {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` }
    });
    const data = await response.json();
    
    // Обновляем профиль Firebase
    if (data.display_name || data.real_name || data.default_avatar_id) {
      const displayName = data.display_name || data.real_name || result.user.displayName;
      const photoURL = data.default_avatar_id 
        ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
        : null;
      const email = data.default_email || result.user.email;
      
      // Обновляем профиль пользователя Firebase (отображаемое имя и аватар)
      await updateProfile(result.user, {
        displayName: displayName,
        photoURL: photoURL
      });
      
      // Принудительно обновляем текущего пользователя
      currentUser = auth.currentUser; 
    }
  } catch (e) {
    console.warn('Не удалось получить профиль Яндекса, используется базовая информация', e);
  }
}

async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return currentUser;
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
    if (user) {
      initPresence(user);
      loadProfile(user);
    }
  });
}