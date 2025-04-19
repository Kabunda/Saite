import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  runTransaction, 
  updateDoc, 
  increment, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Конфигурация Firebase (замените на свою!)
  const firebaseConfig = {
    apiKey: "AIzaSyASzuGAuC5ME8rCV6ZRTDDlIdQYXZSekiw",
    authDomain: "neiborssprint.firebaseapp.com",
    projectId: "neiborssprint",
    storageBucket: "neiborssprint.firebasestorage.app",
    messagingSenderId: "111998329250",
    appId: "1:111998329250:web:5061111f8ada94b14dd2fb",
    measurementId: "G-LJTVTDE1QD"
  };

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Экспорт для использования в других модулях
export { 
  db, 
  doc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  runTransaction, 
  updateDoc, 
  increment, 
  onSnapshot, 
  serverTimestamp 
};