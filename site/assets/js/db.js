// Handles data persistence
// Depends on firebase-config.js being loaded first

function saveSessionToCloud(sessionData) {
    if (!window.db) {
        console.error("Firebase DB not initialized. Cannot save to cloud.");
        showToast("Error: Cloud Database not connected (window.db missing). Data only in local buffer.", "error");
        return;
    }

    if (!window.auth?.currentUser) {
        console.error("No auth user. Cannot save.");
        showToast("Error: Not authenticated. Cannot save to cloud.", "error");
        return;
    }

    // Add required fields for security rules
    const dataToSave = {
        ...sessionData,
        userId: window.auth.currentUser.uid,
        timestamp: sessionData.timestamp || firebase.firestore.FieldValue.serverTimestamp()
    };

    // Use 'sessions' collection to match your rules (was 'type_state_sessions')
    window.db.collection("sessions").add(dataToSave)
        .then((docRef) => {
            console.log("Document written with ID: ", docRef.id);
            showToast("Session synced to cloud successfully!", "success");
        })
        .catch((error) => {
            console.error("Error adding document: ", error);
            showToast("Failed to sync to cloud: " + error.message, "error");
        });
}


// Simple Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-lg text-white font-medium text-sm transition-all duration-300 z-50 ${type === 'error' ? 'bg-red-600' : 'bg-green-700'}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
    }, 10);

    // Remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
