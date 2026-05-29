import { 
  ref, get, child, update, set, serverTimestamp, 
  onValue, off, query, orderByChild, equalTo, limitToFirst 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";
import { getCurrentUser } from "./auth.js";
import { setCurrentRoom } from "./presence.js";
import { showScreen } from "./ui.js";
import { startGame } from "./game.js";

let roomId = null;
let playerListener = null;

export async function findOrCreateRoom() {
  const user = getCurrentUser();
  if (!user) return;
  
  showScreen('lobby-screen');
  document.getElementById('lobby-status').textContent = 'Поиск комнаты...';
  
  // 1. Ищем комнату со статусом 'waiting' и свободным местом
  const roomsRef = ref(db, 'rooms');
  const waitingRoomsQuery = query(ref(db, 'rooms'), orderByChild('meta/status'), equalTo('waiting'), limitToFirst(1));
  
  const snapshot = await get(waitingRoomsQuery);
  let targetRoomId = null;
  
  if (snapshot.exists()) {
    // Берём первую попавшуюся комнату
    targetRoomId = Object.keys(snapshot.val())[0];
  }
  
  if (targetRoomId) {
    // Пытаемся присоединиться через транзакцию
    const roomRef = ref(db, `rooms/${targetRoomId}`);
    roomRef.transaction((room) => {
      if (!room || room.meta.status !== 'waiting') return; // уже занята
      if (room.players && Object.keys(room.players).length >= room.meta.maxPlayers) return;
      
      if (!room.players) room.players = {};
      room.players[user.uid] = {
        name: user.displayName || 'Аноним',
        ready: false,
        score: 0
      };
      
      if (Object.keys(room.players).length === room.meta.maxPlayers) {
        room.meta.status = 'playing';
      }
      
      return room;
    }).then(({ committed, snapshot }) => {
      if (committed) {
        enterRoom(targetRoomId);
      } else {
        // Комната ушла, пробуем создать новую
        createNewRoom();
      }
    }).catch(() => {
      document.getElementById('lobby-status').textContent = 'Ошибка, попробуйте снова';
    });
  } else {
    // Нет подходящих комнат – создаём
    createNewRoom();
  }
}

function createNewRoom() {
  const user = getCurrentUser();
  const newRoomRef = ref(db, 'rooms/' + ref(db, 'rooms').push().key);
  
  set(newRoomRef, {
    meta: {
      createdAt: serverTimestamp(),
      host: user.uid,
      maxPlayers: 2,
      status: 'waiting'
    },
    players: {
      [user.uid]: {
        name: user.displayName || 'Аноним',
        ready: false,
        score: 0
      }
    },
    gameState: {}
  }).then(() => {
    roomId = newRoomRef.key;
    document.getElementById('lobby-status').textContent = 'Ожидание соперника...';
    setCurrentRoom(user.uid, roomId);
    listenRoom();
  });
}

function enterRoom(id) {
  roomId = id;
  setCurrentRoom(getCurrentUser().uid, roomId);
  listenRoom();
}

function listenRoom() {
  const roomRef = ref(db, `rooms/${roomId}`);
  playerListener = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // Комната удалена
      showScreen('menu-screen');
      return;
    }
    
    const players = room.players ? Object.keys(room.players) : [];
    document.getElementById('lobby-status').textContent = 
      `Игроков: ${players.length}/${room.meta.maxPlayers}`;
    
    if (room.meta.status === 'playing' && players.length === room.meta.maxPlayers) {
      // Начинаем игру
      off(playerListener);
      startGame(roomId, room.meta.host);
    }
  });
}

export function leaveLobby() {
  if (playerListener) {
    off(playerListener);
    playerListener = null;
  }
  if (roomId) {
    // Удаляем себя из комнаты
    const user = getCurrentUser();
    update(ref(db, `rooms/${roomId}/players/${user.uid}`), null);
    setCurrentRoom(user.uid, null);
    roomId = null;
  }
}

document.getElementById('cancel-search-btn').addEventListener('click', () => {
  leaveLobby();
  showScreen('menu-screen');
});