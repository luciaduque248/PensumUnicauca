import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase web configuration identifies the app; it is not an Admin credential.
// Access to academic data must be protected by Authentication and security rules.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDux9sqL7pfzpPu9A_Bq1uzCjdkNgBpsw4",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "mi-pensum-unicauca.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "mi-pensum-unicauca",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "mi-pensum-unicauca.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "896667009719",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:896667009719:web:9fddfa633933972eed4332",
};

const appName = "mi-pensum-firebase";

// Lazy initialization keeps the staged integration out of the existing app flow.
// The named app also avoids duplicate initialization during Vite hot reloads.
export const getFirebaseApp = () => {
    return getApps().some((app) => app.name === appName)
        ? getApp(appName)
        : initializeApp(firebaseConfig, appName);
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());
