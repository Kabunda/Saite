import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { auth } from "./config.js";
import { showScreen } from "./ui.js";
import { initPresence } from "./presence.js";
import { loadProfile } from "./profile.js";

let currentUser = null;

const googleProvider = new GoogleAuthProvider();

// Привязка кнопок и инициализация обработчиков
export function initAuthUI() {
  document.getElementById('google-login-btn')
    .addEventListener('click', signInWithGoogle);

  document.getElementById('email-login-btn')
    .addEventListener('click', signInWithEmail);

  document.getElementById('email-register-btn')
    .addEventListener('click', registerWithEmail);

  document.getElementById('logout-btn')
    .addEventListener('click', logout);
}

// --- Google ---
async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged обработает вход
  } catch (error) {
    document.getElementById('auth-error').textContent =
      `Ошибка Google: ${error.message}`;
  }
}

// --- Email/Password ---
async function signInWithEmail() {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  const errorDiv = document.getElementById('email-auth-error');
  errorDiv.textContent = '';

  if (!email || !password) {
    errorDiv.textContent = 'Заполните email и пароль';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    errorDiv.textContent = `Ошибка входа: ${error.message}`;
  }
}

async function registerWithEmail() {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  const errorDiv = document.getElementById('email-auth-error');
  errorDiv.textContent = '';

  if (!email || !password) {
    errorDiv.textContent = 'Заполните email и пароль';
    return;
  }
  if (password.length < 6) {
    errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Опционально: установить displayName из email
    await updateProfile(result.user, {
      displayName: email.split('@')[0]
    });
    // Принудительно обновим currentUser (хотя onAuthStateChanged тоже сработает)
    currentUser = auth.currentUser;
  } catch (error) {
    errorDiv.textContent = `Ошибка регистрации: ${error.message}`;
  }
}

// --- Общие ---
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Ошибка выхода:', error);
  }
}

export function getCurrentUser() {
  return currentUser;
}

// Подписка на изменение состояния аутентификации
export function onAuthChange(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
    if (user) {
      // Инициализируем online-статус и профиль
      initPresence(user);
      loadProfile(user);
    }
  });
}