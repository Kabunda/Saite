import { ref, set, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db } from "./config.js";

export function initPresence(user) {
  const presenceRef = ref(db, `userPresence/${user.uid}`);

  const presenceData = {
    online: true,
    lastSeen: serverTimestamp(),
    currentRoom: null,
    displayName: user.displayName || 'Аноним',
    photoURL: user.photoURL || null
  };

  set(presenceRef, presenceData);

  onDisconnect(presenceRef).update({
    online: false,
    lastSeen: serverTimestamp(),
    currentRoom: null
    // имя и аватар оставляем – они не исчезнут при выходе
  });
}

export function setCurrentRoom(uid, roomId) {
  const presenceRef = ref(db, `userPresence/${uid}/currentRoom`);
  set(presenceRef, roomId);
}