import {
  ref,
  get,
  set,
  remove,
  serverTimestamp,
  onValue,
  push,
  update,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { db } from "./config.js";
import { getCurrentUser } from "./auth.js";
import { setCurrentRoom } from "./presence.js";
import { showScreen } from "./ui.js";
import { startGame } from "./game.js";
import { buildUniqueQuestionList } from "./generator.js";

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

  try {
    console.log('[Lobby] Загрузка всех комнат...');
    const allRoomsSnapshot = await get(ref(db, 'rooms'));
    const allRooms = allRoomsSnapshot.val() || {};
    console.log('[Lobby] Все комнаты в базе:', allRooms);

    let targetRoomId = null;
    for (const [id, room] of Object.entries(allRooms)) {
      // Игнорируем комнаты без игроков (пустые)
      if (room?.meta?.status === 'waiting' &&
          room.players && Object.keys(room.players).length > 0) {
        targetRoomId = id;
        break;
      }
    }

    if (targetRoomId) {
      console.log(`[Lobby] Найдена waiting-комната: ${targetRoomId}`);
      const joined = await tryJoinRoom(targetRoomId, user);
      if (joined) {
        console.log('[Lobby] Присоединение выполнено');
        enterRoom(targetRoomId);
      } else {
        console.warn('[Lobby] Не удалось присоединиться (комната занята/изменилась), создаём новую');
        createNewRoom();
      }
    } else {
      console.log('[Lobby] Нет waiting-комнат, создаём новую');
      createNewRoom();
    }
  } catch (error) {
    console.error('[Lobby] Ошибка при поиске комнат:', error);
    document.getElementById('lobby-status').textContent = 'Ошибка поиска, повторите позже';
  }
}

async function tryJoinRoom(roomId, user) {
  const roomRef = ref(db, `rooms/${roomId}`);

  const snapshot = await get(roomRef);
  const room = snapshot.val();
  if (!room || room.meta.status !== 'waiting') {
    console.warn('[Lobby] Комната недоступна для входа');
    return false;
  }

  const currentPlayers = room.players || {};
  const playerCount = Object.keys(currentPlayers).length;
  if (playerCount >= room.meta.maxPlayers) {
    console.warn('[Lobby] Комната заполнена');
    return false;
  }

  const newPlayers = {
    ...currentPlayers,
    [user.uid]: {
      name: user.displayName || 'Аноним',
      ready: false,
      score: 0
    }
  };
  const newStatus = Object.keys(newPlayers).length === room.meta.maxPlayers ? 'playing' : 'waiting';

  const updates = {
    players: newPlayers,
    'meta/status': newStatus
  };

  console.log('[Lobby] Пытаемся обновить комнату:', updates);
  try {
    await update(roomRef, updates);
    console.log('[Lobby] Обновление успешно');
    return true;
  } catch (e) {
    console.error('[Lobby] Ошибка обновления:', e);
    return false;
  }
}

function createNewRoom() {
  const user = getCurrentUser();
  const roomsRef = ref(db, 'rooms');
  const newRoomRef = push(roomsRef);
  const newRoomKey = newRoomRef.key;

  console.log(`[Lobby] Создание новой комнаты с ключом: ${newRoomKey}`);

  const questions = buildUniqueQuestionList(20); // 20 уникальных вопросов
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
    gameState: {},
    questions: questions,   // <-- сохраняем вопросы в комнате
    playerAnswers: {}   // <-- будет заполняться динамически
  };
  console.log('[Lobby] Данные новой комнаты:', roomData);

  set(newRoomRef, roomData)
    .then(() => {
      console.log('[Lobby] Комната успешно создана в базе');
      roomId = newRoomKey;
      document.getElementById('lobby-status').textContent = 'Ожидание соперника...';
      setCurrentRoom(user.uid, roomId);
      // Автоудаление игрока при разрыве соединения
      const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
      onDisconnect(playerRef).remove();
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
  const user = getCurrentUser();
  setCurrentRoom(user.uid, roomId);
  // Автоудаление при разрыве соединения
  const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
  onDisconnect(playerRef).remove();
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
      if (playerListener) {
        playerListener();
        playerListener = null;
      }
      startGame(roomId, room.meta.host);
    }
  });
}

export function leaveLobby() {
  console.log('[Lobby] Выход из лобби');
  if (playerListener) {
    playerListener();
    playerListener = null;
  }
  if (roomId) {
    const user = getCurrentUser();
    if (user) {
      const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
      const roomRef = ref(db, `rooms/${roomId}`);

      // Отменяем запланированное удаление при дисконнекте
      onDisconnect(playerRef).cancel()
        .then(() => {
          console.log('[Lobby] Отменён onDisconnect для игрока');
          return remove(playerRef);
        })
        .then(() => {
          console.log('[Lobby] Игрок удалён из комнаты');
          return get(roomRef);
        })
        .then((snapshot) => {
          const room = snapshot.val();
          if (!room || !room.players || Object.keys(room.players).length === 0) {
            console.log('[Lobby] Комната опустела, удаляем');
            return remove(roomRef);
          }
        })
        .catch(err => console.error('[Lobby] Ошибка при очистке:', err));

      setCurrentRoom(user.uid, null);
    }
    roomId = null;
  }
}