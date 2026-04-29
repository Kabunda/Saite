import { db, useFirebase } from './storage.js';
import { ref, set, onValue, onDisconnect, remove, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export function getPlayerId() {
    let id = localStorage.getItem('mt_player_uid');
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem('mt_player_uid', id);
    }
    return id;
}

let onlineRef = null;

export function initPresence(playerName) {
    if (!useFirebase || !db) return;
    if (onlineRef) remove(onlineRef);
    const pid = getPlayerId();
    onlineRef = ref(db, `onlineUsers/${pid}`);
    const userData = {
        name: playerName || 'Игрок',
        status: 'menu',
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    };
    set(onlineRef, userData);
    onDisconnect(onlineRef).remove();
}

export function updatePresenceStatus(status) {
    if (!onlineRef) return;
    update(onlineRef, { status, lastSeen: serverTimestamp() });
}

export function subscribeToOnlineUsers(callback) {
    if (!useFirebase || !db) {
        callback([]);
        return () => {};
    }
    const onlineUsersRef = ref(db, 'onlineUsers');
    const unsubscribe = onValue(onlineUsersRef, (snapshot) => {
        const users = [];
        snapshot.forEach(child => {
            const data = child.val();
            users.push({
                id: child.key,
                name: data.name || 'Аноним',
                status: data.status || 'menu',
                joinedAt: data.joinedAt,
                lastSeen: data.lastSeen
            });
        });
        callback(users);
    });
    return unsubscribe;
}

export function removePresence() {
    if (onlineRef) {
        remove(onlineRef);
        onlineRef = null;
    }
}