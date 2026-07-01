import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ================== НАСТРОЙКА FIREBASE ==================
const firebaseConfig = {
    apiKey: "AIzaSyDQ1Wzpw-cDOG8okWEbDez2AMLNTzk89q8",
    authDomain: "testds-b169f.firebaseapp.com",
    databaseURL: "https://testds-b169f-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "testds-b169f",
    storageBucket: "testds-b169f.firebasestorage.app",
    messagingSenderId: "726631928847",
    appId: "1:726631928847:web:d4e5eb7af866398796ff7a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);