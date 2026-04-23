/**
 * Конфигурация Firebase Realtime Database
 * Замените значения на реальные из вашего проекта Firebase
 */
export const firebaseConfig = {
    apiKey: "AIzaSyASzuGAuC5ME8rCV6ZRTDDlIdQYXZSekiw",
    authDomain: "neiborssprint.firebaseapp.com",
    projectId: "neiborssprint",
    storageBucket: "neiborssprint.firebasestorage.app",
    messagingSenderId: "111998329250",
    appId: "1:111998329250:web:5061111f8ada94b14dd2fb",
    measurementId: "G-LJTVTDE1QD"
  };
/**
 * Пути в Realtime Database
 */
export const DB_PATHS = {
  RESULTS: 'gameResults',
  LEADERBOARD: 'leaderboard',
  USERS: 'users',
  SESSIONS: 'sessions',
  ACTIVE_SESSIONS: 'activeSessions'
};