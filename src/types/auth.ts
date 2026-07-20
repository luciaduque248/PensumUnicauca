import type {
    AuthChangeEvent,
    Session,
    User,
} from "@supabase/supabase-js";

export interface SignUpResult {
    user: User | null;
    session: Session | null;
    requiresEmailConfirmation: boolean;
}

export type AuthStateChangeListener = (
    event: AuthChangeEvent,
    session: Session | null,
) => void;