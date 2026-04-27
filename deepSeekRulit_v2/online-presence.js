import { db, useFirebase } from './storage.js';
import {
    ref,
    set,
    onValue,
    onDisconnect,
    remove,
    update,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Уникальный идентификатор устройства
export function getPlayerId() {
    let id = localStorage.getItem('mt_player_uid');
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem('mt_player_uid', id);
    }
    return id;
}

const playerId = getPlayerId();
let onlineRef = null;
let onlineUsersRef = null;

if (useFirebase && db) {
    onlineUsersRef = ref(db, 'onlineUsers');
}

export function initPresence(playerName) {
    if (!useFirebase || !db) return;

    if (onlineRef) {
        remove(onlineRef);
    }

    onlineRef = ref(db, `onlineUsers/${playerId}`);
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
    update(onlineRef, {
        status: status,
        lastSeen: serverTimestamp()
    });
}

export function subscribeToOnlineUsers(callback) {
    if (!useFirebase || !db || !onlineUsersRef) {
        callback([]);
        return () => {};
    }

    const unsubscribe = onValue(onlineUsersRef, (snapshot) => {
        const users = [];
        snapshot.forEach(child => {
            const data = child.val();
            users.push({
                id: child.key,
                name: data.name || 'Аноним',
                status: data.status || 'menu',
                joinedAt: data.joinedAt || null,
                lastSeen: data.lastSeen || 0
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