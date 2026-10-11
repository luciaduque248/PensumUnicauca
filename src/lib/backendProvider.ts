// A build-time opt-in keeps production on Supabase during the migration.
// Alexa's consent route still authenticates against its existing OAuth server.
export const usesFirebase =
    import.meta.env.VITE_BACKEND_PROVIDER === "firebase" &&
    window.location.pathname !== "/oauth/consent";
