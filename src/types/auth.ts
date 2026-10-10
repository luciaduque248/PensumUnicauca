export interface AuthUser {
    id: string;
    email?: string | null;
}

export interface AuthSession {
    user: AuthUser;
}

export interface SignUpResult {
    user: AuthUser | null;
    session: AuthSession | null;
    requiresEmailConfirmation: boolean;
}

export type AuthStateChangeListener = (session: AuthSession | null) => void;

export interface AuthContextValue {
    session: AuthSession | null;
    user: AuthUser | null;
    isAuthLoading: boolean;
    authInitializationError: string | null;
}
