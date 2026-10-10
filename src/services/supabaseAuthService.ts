import type { Session } from "@supabase/supabase-js";

import { getSupabaseClient } from "../lib/supabase";
import type {
    AuthStateChangeListener,
    SignUpResult,
} from "../types/auth";

const normalizeEmail = (
    email: string,
): string => {
    return email.trim().toLowerCase();
};

const getEmailRedirectUrl = (): string => {
    return `${window.location.origin}/`;
};

export const signUpWithEmail = async (
    email: string,
    password: string,
): Promise<SignUpResult> => {
    const normalizedEmail =
        normalizeEmail(email);

    const {
        data,
        error,
    } = await getSupabaseClient().auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            emailRedirectTo:
                getEmailRedirectUrl(),
        },
    });

    if (error) {
        throw error;
    }

    return {
        user: data.user,
        session: data.session,
        requiresEmailConfirmation:
            data.session === null,
    };
};

export const signInWithEmail = async (
    email: string,
    password: string,
): Promise<Session> => {
    const normalizedEmail =
        normalizeEmail(email);

    const {
        data,
        error,
    } =
        await getSupabaseClient().auth
            .signInWithPassword({
                email: normalizedEmail,
                password,
            });

    if (error) {
        throw error;
    }

    return data.session;
};

export const signOut = async (): Promise<void> => {
    const {
        error,
    } = await getSupabaseClient().auth.signOut();

    if (error) {
        throw error;
    }
};

export const getCurrentSession =
    async (): Promise<Session | null> => {
        const {
            data,
            error,
        } =
            await getSupabaseClient().auth.getSession();

        if (error) {
            throw error;
        }

        return data.session;
    };

export const subscribeToAuthChanges = (
    listener: AuthStateChangeListener,
): (() => void) => {
    const {
        data: {
            subscription,
        },
    } =
        getSupabaseClient().auth.onAuthStateChange(
            (_event, session) => {
                listener(session);
            },
        );

    return () => {
        subscription.unsubscribe();
    };
};