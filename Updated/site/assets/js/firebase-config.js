// Firebase Configuration (Compat Mode)
// This uses the global 'firebase' object loaded from the scripts in collector.html

const firebaseConfig = {
    apiKey: "AIzaSyBo7YtSGpUw8cVpZpeMn-GZYAhdPq7BA0g",
    authDomain: "typestate-3956c.firebaseapp.com",
    projectId: "typestate-3956c",
    storageBucket: "typestate-3956c.firebasestorage.app",
    messagingSenderId: "454836847642",
    appId: "1:454836847642:web:b9ec8f27b203114fa73da3",
    measurementId: "G-Q7BBTYY6GC"
};

// Initialize Firebase
window.db = null;
if (typeof firebase !== 'undefined') {
    // Initialize App
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    // Initialize Firestore
    window.db = firebase.firestore();
    console.log("Firebase initialized successfully (Compat Mode)");
} else {
    console.error("Firebase SDK not loaded. Ensure firestore-compat.js script is in HTML.");
    alert("Error: Firebase SDK missing. Data will not save.");
}
