import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase web configuration identifies the app; it is not an Admin credential.
// Access to academic data must be protected by Authentication and security rules.
const env = import.meta.env ?? {};

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? "AIzaSyDux9sqL7pfzpPu9A_Bq1uzCjdkNgBpsw4",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "mi-pensum-unicauca.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "mi-pensum-unicauca",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "mi-pensum-unicauca.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "896667009719",
    appId: env.VITE_FIREBASE_APP_ID ?? "1:896667009719:web:9fddfa633933972eed4332",
};

const appName = "mi-pensum-firebase";

// Initialize only when the selected provider needs Firebase.
// The named app also avoids duplicate initialization during Vite hot reloads.
export const getFirebaseApp = () => {
    return getApps().some((app) => app.name === appName)
        ? getApp(appName)
        : initializeApp(firebaseConfig, appName);
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());
