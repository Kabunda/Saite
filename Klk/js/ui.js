import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";
import { auth } from "./config.js";

const screens = ['auth-screen', 'menu-screen', 'lobby-screen', 'game-screen', 'result-screen'];

export function showScreen(screenId) {
  screens.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}