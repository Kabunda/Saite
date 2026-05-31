import {
  ref, get, update, set, serverTimestamp,
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
  if (!user) {
    console.warn('[Lobby] findOrCreateRoom: пользователь не авторизован');
    return;
  }

  console.log(`[Lobby] Поиск комнаты для игрока ${user.uid} (${user.displayName})`);
  showScreen('lobby-screen');
  document.getElementById('lobby-status').textContent = 'Поиск комнаты...';

  const roomsRef = ref(db, 'rooms');
  // Получаем все комнаты и фильтруем на клиенте
  const roomsSnapshot = await get(ref(db, 'rooms'));
  let targetRoomId = null;

  if (roomsSnapshot.exists()) {
    const rooms = roomsSnapshot.val();
    // Находим первую комнату со статусом 'waiting'
    const waitingRoomId = Object.keys(rooms).find(id => 
      rooms[id]?.meta?.status === 'waiting'
    );
    if (waitingRoomId) {
      targetRoomId = waitingRoomId;
    }
  }
  console.log('[Lobby] Запрос комнат со статусом waiting...');
  try {
    const snapshot = await get(waitingRoomsQuery);
    console.log('[Lobby] Результат запроса waiting-комнат:', snapshot.val());

    let targetRoomId = null;
    if (snapshot.exists()) {
      const rooms = snapshot.val();
      targetRoomId = Object.keys(rooms)[0];
      console.log(`[Lobby] Найдена комната: ${targetRoomId}`, rooms[targetRoomId]);
    }

    if (targetRoomId) {
      // Пытаемся присоединиться
      console.log(`[Lobby] Попытка присоединиться к комнате ${targetRoomId}...`);
      const roomRef = ref(db, `rooms/${targetRoomId}`);

      roomRef.transaction((room) => {
        console.log('[Lobby] Транзакция: текущее состояние комнаты:', room);
        if (!room) {
          console.log('[Lobby] Комната не существует, отмена транзакции');
          return;
        }
        if (room.meta.status !== 'waiting') {
          console.log(`[Lobby] Статус комнаты изменился: ${room.meta?.status}, отмена`);
          return;
        }
        const players = room.players || {};
        const playerCount = Object.keys(players).length;
        console.log(`[Lobby] Игроков в комнате: ${playerCount}, максимум: ${room.meta.maxPlayers}`);
        if (playerCount >= room.meta.maxPlayers) {
          console.log('[Lobby] Комната заполнена, отмена');
          return;
        }

        // Добавляем игрока
        room.players = room.players || {};
        room.players[user.uid] = {
          name: user.displayName || 'Аноним',
          ready: false,
          score: 0
        };
        console.log(`[Lobby] Добавляем игрока ${user.uid} в комнату`);

        if (Object.keys(room.players).length === room.meta.maxPlayers) {
          room.meta.status = 'playing';
          console.log('[Lobby] Комната заполнена, меняем статус на playing');
        }
        return room;
      }).then(({ committed, snapshot }) => {
        console.log('[Lobby] Транзакция завершена. committed:', committed, 'snapshot:', snapshot.val());
        if (committed) {
          console.log('[Lobby] Успешно вошли в комнату');
          enterRoom(targetRoomId);
        } else {
          console.warn('[Lobby] Не удалось войти (возможно, комната уже занята). Создаём новую.');
          createNewRoom();
        }
      }).catch((error) => {
        console.error('[Lobby] Ошибка транзакции:', error);
        document.getElementById('lobby-status').textContent = 'Ошибка соединения, попробуйте снова';
      });
    } else {
      console.log('[Lobby] Нет доступных waiting-комнат, создаём новую');
      createNewRoom();
    }
  } catch (error) {
    console.error('[Lobby] Ошибка при поиске комнат:', error);
    document.getElementById('lobby-status').textContent = 'Ошибка поиска, повторите позже';
  }
}

function createNewRoom() {
  const user = getCurrentUser();
  const newRoomKey = ref(db, 'rooms').push().key;
  const newRoomRef = ref(db, `rooms/${newRoomKey}`);
  console.log(`[Lobby] Создание новой комнаты с ключом: ${newRoomKey}`);

  const roomData = {
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
  };
  console.log('[Lobby] Данные новой комнаты:', roomData);

  set(newRoomRef, roomData)
    .then(() => {
      console.log('[Lobby] Комната успешно создана в базе');
      roomId = newRoomKey;
      document.getElementById('lobby-status').textContent = 'Ожидание соперника...';
      setCurrentRoom(user.uid, roomId);
      listenRoom();
    })
    .catch((error) => {
      console.error('[Lobby] Ошибка создания комнаты:', error);
      document.getElementById('lobby-status').textContent = 'Не удалось создать комнату';
    });
}

function enterRoom(id) {
  console.log(`[Lobby] Вход в комнату ${id}`);
  roomId = id;
  setCurrentRoom(getCurrentUser().uid, roomId);
  listenRoom();
}

function listenRoom() {
  const roomRef = ref(db, `rooms/${roomId}`);
  console.log(`[Lobby] Подписка на изменения комнаты ${roomId}`);

  playerListener = onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    console.log('[Lobby] Обновление комнаты:', room);

    if (!room) {
      console.warn('[Lobby] Комната удалена, возврат в меню');
      showScreen('menu-screen');
      return;
    }

    const players = room.players ? Object.keys(room.players) : [];
    document.getElementById('lobby-status').textContent =
      `Игроков: ${players.length}/${room.meta.maxPlayers}`;

    if (room.meta.status === 'playing' && players.length === room.meta.maxPlayers) {
      console.log('[Lobby] Начинаем игру!');
      off(playerListener);
      playerListener = null;
      startGame(roomId, room.meta.host);
    }
  });
}

export function leaveLobby() {
  console.log('[Lobby] Выход из лобби');
  if (playerListener) {
    off(playerListener);
    playerListener = null;
  }
  if (roomId) {
    const user = getCurrentUser();
    console.log(`[Lobby] Удаление игрока ${user?.uid} из комнаты ${roomId}`);
    update(ref(db, `rooms/${roomId}/players/${user.uid}`), null)
      .then(() => console.log('[Lobby] Игрок удалён из комнаты'))
      .catch(err => console.error('[Lobby] Ошибка удаления из комнаты:', err));
    setCurrentRoom(user.uid, null);
    roomId = null;
  }
}

// Привязка кнопки отмены
document.getElementById('cancel-search-btn').addEventListener('click', () => {
  console.log('[Lobby] Нажата кнопка "Отмена"');
  leaveLobby();
  showScreen('menu-screen');
});