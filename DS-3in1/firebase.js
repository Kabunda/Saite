import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// Конфигурация Firebase
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

// Функция для сохранения результата игры
async function saveGameResult(playerName, score, time, difficulty) {
  try {
    await addDoc(collection(db, "gameResults"), {
      playerName: playerName,
      score: score,
      time: time,
      difficulty: difficulty,
      timestamp: serverTimestamp()
    });
    console.log("Результат сохранен успешно");
  } catch (error) {
    console.error("Ошибка при сохранении результата: ", error);
  }
}

// Функция для получения рекордов по сложности
async function getHighscores(difficulty, limitCount = 5) {
  try {
    const q = query(
      collection(db, "gameResults"),
      where("difficulty", "==", difficulty),
      orderBy("score", "desc"),
      orderBy("time", "asc"),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Преобразуем Firestore timestamp в обычную дату, если нужно
      const timestamp = data.timestamp ? data.timestamp.toDate().getTime() : Date.now();
      results.push({ 
        id: doc.id, 
        name: data.playerName, 
        score: data.score, 
        time: data.time,
        timestamp: timestamp
      });
    });
    return results;
  } catch (error) {
    console.error("Ошибка при загрузке рекордов: ", error);
    return [];
  }
}

// Экспорт для использования в других модулях
export { 
  app,
  db,
  saveGameResult,
  getHighscores
};