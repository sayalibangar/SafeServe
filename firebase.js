
// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCN7H-KegVitoA-aeuAJbaALkPpZd4ULKg",
    authDomain: "safeserve-a0877.firebaseapp.com",
    projectId: "safeserve-a0877",
    storageBucket: "safeserve-a0877.firebasestorage.app",
    messagingSenderId: "1074744703623",
    appId: "1:1074744703623:web:011d9aecdda7cc1c4b1622"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Export Firebase services
export { app, auth, db };
