import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    type User,
} from "firebase/auth";

import { getFirebaseAuth } from "../lib/firebase.js";

// Firebase login and Firestore synchronization are enabled together in preview.
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const signUpWithFirebaseEmail = async (
    email: string,
    password: string,
): Promise<User> => {
    const result = await createUserWithEmailAndPassword(
        getFirebaseAuth(), normalizeEmail(email), password,
    );
    return result.user;
};

export const signInWithFirebaseEmail = async (
    email: string,
    password: string,
): Promise<User> => {
    const result = await signInWithEmailAndPassword(
        getFirebaseAuth(), normalizeEmail(email), password,
    );
    return result.user;
};

export const signOutFromFirebase = async (): Promise<void> => {
    await signOut(getFirebaseAuth());
};

export const getCurrentFirebaseUser = async (): Promise<User | null> => {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    return auth.currentUser;
};

export const subscribeToFirebaseAuthChanges = (
    listener: (user: User | null) => void,
    onError: (error: Error) => void,
): (() => void) => {
    return onAuthStateChanged(getFirebaseAuth(), listener, onError);
};

export const resetFirebasePassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(getFirebaseAuth(), normalizeEmail(email));
};
