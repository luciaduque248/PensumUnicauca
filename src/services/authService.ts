import type { User } from "firebase/auth";
import { usesFirebase } from "../lib/backendProvider";
import * as legacy from "./supabaseAuthService";
import {
    getCurrentFirebaseUser, signInWithFirebaseEmail, signOutFromFirebase,
    signUpWithFirebaseEmail, subscribeToFirebaseAuthChanges,
} from "./firebaseAuthService";
import type { AuthSession, AuthStateChangeListener, SignUpResult } from "../types/auth";

const toSession = (user: User | null): AuthSession | null =>
    user ? { user: { id: user.uid, email: user.email } } : null;

export const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
    if (!usesFirebase) return legacy.signUpWithEmail(email, password);
    const session = toSession(await signUpWithFirebaseEmail(email, password));
    return { user: session?.user ?? null, session, requiresEmailConfirmation: false };
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthSession> => {
    if (!usesFirebase) return legacy.signInWithEmail(email, password);
    const user = await signInWithFirebaseEmail(email, password);
    return { user: { id: user.uid, email: user.email } };
};

export const signOut = async (): Promise<void> => {
    if (usesFirebase) await signOutFromFirebase();
    else await legacy.signOut();
};

export const getCurrentSession = async (): Promise<AuthSession | null> =>
    usesFirebase ? toSession(await getCurrentFirebaseUser()) : legacy.getCurrentSession();

export const subscribeToAuthChanges = (
    listener: AuthStateChangeListener,
    onError: (error: Error) => void,
): (() => void) => {
    try {
        return usesFirebase
            ? subscribeToFirebaseAuthChanges(user => listener(toSession(user)), onError)
            : legacy.subscribeToAuthChanges(listener);
    } catch (error) {
        queueMicrotask(() => onError(error instanceof Error ? error : new Error(String(error))));
        return () => {};
    }
};
