import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
    if (client) return client;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
        throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.");
    }
    client = createClient(url, key);
    return client;
};
