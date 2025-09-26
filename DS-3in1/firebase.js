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
  serverTimestamp,
  doc,
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove,
  deleteDoc
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
      playerName: playerName.trim(),
      score: score,
      time: time,
      difficulty: difficulty,
      timestamp: serverTimestamp()
    });
    console.log("Результат сохранен успешно");
    return true;
  } catch (error) {
    console.error("Ошибка при сохранении результата: ", error);

    // Сохранить в localStorage для последующей синхронизации
    saveResultOffline(playerName, score, time, difficulty);

    return false;
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

// Функции для работы с сессиями
async function createSession(sessionId, playerName, difficulty) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    await setDoc(sessionRef, {
      host: playerName,
      players: [{
        name: playerName,
        progress: 0,
        score: 0,
        answers: []
      }],
      difficulty: difficulty,
      status: "waiting",
      createdAt: serverTimestamp(),
      startTime: null,
      maxPlayers: 4
    });
    return true;
  } catch (error) {
    console.error("Ошибка при создании сессии: ", error);
    return false;
  }
}

async function joinSession(sessionId, playerName) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, {
      players: arrayUnion({
        name: playerName,
        progress: 0,
        score: 0,
        answers: []
      })
    });
    return true;
  } catch (error) {
    console.error("Ошибка при присоединении к сессии: ", error);
    return false;
  }
}

async function getSession(sessionId) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    return sessionSnap.exists() ? sessionSnap.data() : null;
  } catch (error) {
    console.error("Ошибка при получении сессии: ", error);
    return null;
  }
}

function subscribeToSession(sessionId, callback) {
  const sessionRef = doc(db, "sessions", sessionId);
  return onSnapshot(sessionRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}

async function updatePlayerProgress(sessionId, playerName, progress, score, answers) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    const session = await getSession(sessionId);
    
    if (!session) return false;
    
    const updatedPlayers = session.players.map(player => 
      player.name === playerName 
        ? { ...player, progress, score, answers }
        : player
    );
    
    await updateDoc(sessionRef, {
      players: updatedPlayers
    });
    
    return true;
  } catch (error) {
    console.error("Ошибка при обновлении прогресса: ", error);
    return false;
  }
}

async function startSession(sessionId) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, {
      status: "starting",
      startTime: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Ошибка при запуске сессии: ", error);
    return false;
  }
}

async function endSession(sessionId) {
  try {
    const sessionRef = doc(db, "sessions", sessionId);
    await deleteDoc(sessionRef);
    return true;
  } catch (error) {
    console.error("Ошибка при завершении сессии: ", error);
    return false;
  }
}

// Добавить в firebase.js после функций сессии
function saveResultOffline(playerName, score, time, difficulty) {
    try {
        const offlineResults = JSON.parse(localStorage.getItem('offlineResults') || '[]');
        offlineResults.push({
            playerName,
            score,
            time,
            difficulty,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('offlineResults', JSON.stringify(offlineResults));
        console.log("Результат сохранен офлайн");
    } catch (error) {
        console.error("Ошибка офлайн-сохранения:", error);
    }
}


// Экспорт новых функций
export { 
  app,
  db,
  saveGameResult,
  getHighscores,
  createSession,
  joinSession,
  getSession,
  subscribeToSession,
  updatePlayerProgress,
  startSession,
  endSession
};