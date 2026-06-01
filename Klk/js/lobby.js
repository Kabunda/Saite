import {
  ref,
  get,
  set,
  update,
  serverTimestamp,
  onValue,
  push,
  runTransaction
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

  try {
    console.log('[Lobby] Загрузка всех комнат...');
    const allRoomsSnapshot = await get(ref(db, 'rooms'));
    const allRooms = allRoomsSnapshot.val() || {};
    console.log('[Lobby] Все комнаты в базе:', allRooms);

    let targetRoomId = null;
    for (const [id, room] of Object.entries(allRooms)) {
      if (room?.meta?.status === 'waiting') {
        targetRoomId = id;
        break;
      }
    }

    if (targetRoomId) {
      console.log(`[Lobby] Найдена waiting-комната: ${targetRoomId}`);
      const roomRef = ref(db, `rooms/${targetRoomId}`);

      // ✅ ВРЕМЕННАЯ ПОДПИСКА, чтобы кэш Firebase наполнился актуальными данными
      const unsubscribe = onValue(roomRef, async (snapshot) => {
        unsubscribe(); // сразу отписываемся, больше не нужна

        const room = snapshot.val();
        console.log('[Lobby] Данные комнаты через onValue:', room);

        if (!room) {
          console.warn('[Lobby] Комната исчезла, создаём новую');
          createNewRoom();
          return;
        }

        if (room.meta.status !== 'waiting') {
          console.warn(`[Lobby] Статус изменился на ${room.meta.status}, создаём новую`);
          createNewRoom();
          return;
        }

        const playerCount = Object.keys(room.players || {}).length;
        if (playerCount >= room.meta.maxPlayers) {
          console.warn('[Lobby] Комната заполнена, создаём новую');
          createNewRoom();
          return;
        }

        // Теперь кэш заполнен, транзакция получит реальные данные
        try {
          const result = await runTransaction(roomRef, (currentRoom) => {
            console.log('[Lobby] Транзакция: текущее состояние комнаты:', currentRoom);
            if (!currentRoom) return; // если вдруг null — прерываем

            if (currentRoom.meta.status !== 'waiting') return;
            const players = currentRoom.players || {};
            if (Object.keys(players).length >= currentRoom.meta.maxPlayers) return;

            const updatedPlayers = {
              ...players,
              [user.uid]: {
                name: user.displayName || 'Аноним',
                ready: false,
                score: 0
              }
            };

            const newStatus = Object.keys(updatedPlayers).length === currentRoom.meta.maxPlayers
              ? 'playing'
              : 'waiting';

            return {
              ...currentRoom,
              players: updatedPlayers,
              meta: {
                ...currentRoom.meta,
                status: newStatus
              }
            };
          });

          console.log('[Lobby] Транзакция завершена. committed:', result.committed,
                      'snapshot:', result.snapshot.val());

          if (result.committed) {
            console.log('[Lobby] Успешно вошли в комнату');
            enterRoom(targetRoomId);
          } else {
            console.warn('[Lobby] Транзакция не применена, создаём новую комнату');
            createNewRoom();
          }
        } catch (transError) {
          console.error('[Lobby] Ошибка транзакции:', transError);
          document.getElementById('lobby-status').textContent = 'Ошибка присоединения, попробуйте снова';
        }
      });

      // Если в течение короткого времени не получили данные — считаем ошибкой
      setTimeout(() => {
        unsubscribe?.(); // на всякий случай отписка
        console.warn('[Lobby] Таймаут ожидания данных комнаты, создаём новую');
        createNewRoom();
      }, 5000);

    } else {
      console.log('[Lobby] Нет waiting-комнат, создаём новую');
      createNewRoom();
    }
  } catch (error) {
    console.error('[Lobby] Ошибка при поиске комнат:', error);
    document.getElementById('lobby-status').textContent = 'Ошибка поиска, повторите позже';
  }
}

function createNewRoom() {
  const user = getCurrentUser();
  const roomsRef = ref(db, 'rooms');
  const newRoomRef = push(roomsRef);
  const newRoomKey = newRoomRef.key;

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
      console.log(`[Lobby] Удаление игрока ${user.uid} из комнаты ${roomId}`);
      update(ref(db, `rooms/${roomId}/players/${user.uid}`), null)
        .then(() => console.log('[Lobby] Игрок удалён из комнаты'))
        .catch(err => console.error('[Lobby] Ошибка удаления из комнаты:', err));
      setCurrentRoom(user.uid, null);
    }
    roomId = null;
  }
}