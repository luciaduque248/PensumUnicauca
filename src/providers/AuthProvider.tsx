import {
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import type {
    Session,
} from "@supabase/supabase-js";

import {
    getCurrentSession,
    subscribeToAuthChanges,
} from "../services/authService";

import {
    AuthContext,
} from "../context/AuthContext";

import type {
    AuthContextValue,
} from "../types/auth";

interface AuthProviderProps {
    children: ReactNode;
}

const getErrorMessage = (
    error: unknown,
): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return "No fue posible comprobar la sesión del usuario.";
};

export const AuthProvider = ({
    children,
}: AuthProviderProps) => {
    const [
        session,
        setSession,
    ] = useState<Session | null>(null);

    const [
        isAuthLoading,
        setIsAuthLoading,
    ] = useState(true);

    const [
        authInitializationError,
        setAuthInitializationError,
    ] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let authEventReceived = false;

        const unsubscribe =
            subscribeToAuthChanges(
                (_event, nextSession) => {
                    authEventReceived = true;

                    if (!isActive) {
                        return;
                    }

                    setSession(nextSession);

                    setAuthInitializationError(
                        null,
                    );

                    setIsAuthLoading(false);
                },
            );

        const loadCurrentSession =
            async (): Promise<void> => {
                try {
                    const currentSession =
                        await getCurrentSession();

                    if (
                        !isActive ||
                        authEventReceived
                    ) {
                        return;
                    }

                    setSession(currentSession);
                } catch (error) {
                    if (
                        !isActive ||
                        authEventReceived
                    ) {
                        return;
                    }

                    setAuthInitializationError(
                        getErrorMessage(error),
                    );
                } finally {
                    if (
                        isActive &&
                        !authEventReceived
                    ) {
                        setIsAuthLoading(false);
                    }
                }
            };

        void loadCurrentSession();

        return () => {
            isActive = false;
            unsubscribe();
        };
    }, []);

    const contextValue =
        useMemo<AuthContextValue>(
            () => ({
                session,
                user:
                    session?.user ??
                    null,
                isAuthLoading,
                authInitializationError,
            }),
            [
                session,
                isAuthLoading,
                authInitializationError,
            ],
        );

    return (
        <AuthContext.Provider
            value={contextValue}
        >
            {children}
        </AuthContext.Provider>
    );
};