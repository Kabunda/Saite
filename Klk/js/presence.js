import { ref, set, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";

export function initPresence(user) {
  const presenceRef = ref(db, `userPresence/${user.uid}`);
  
  const presenceData = {
    online: true,
    lastSeen: serverTimestamp(),
    currentRoom: null
  };
  
  set(presenceRef, presenceData);
  
  // При отключении: онлайн=false, комната сбрасывается
  onDisconnect(presenceRef).update({
    online: false,
    lastSeen: serverTimestamp(),
    currentRoom: null
  });
}

// Обновление текущей комнаты
export function setCurrentRoom(uid, roomId) {
  const ref = ref(db, `userPresence/${uid}/currentRoom`);
  set(ref, roomId);
}