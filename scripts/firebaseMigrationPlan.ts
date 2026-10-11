import { encodeFirebaseSnapshot, FIREBASE_SNAPSHOT_VERSION } from "../src/utils/firebaseSnapshot.js";

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const rows = (value: unknown): Row[] => {
    if (!Array.isArray(value) || !value.every(record)) throw new Error("Invalid migration rows.");
    return value;
};
const date = (value: unknown): number => {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        throw new Error("Invalid migration date.");
    }
    return Date.parse(value);
};

// Offline only: no credentials, network requests or database writes.
// targetExport must come from a fresh, authenticated Firebase auth:export.
export const prepareFirebaseMigration = (source: unknown, targetExport: unknown) => {
    if (!record(source) || source.source_project !== "kdyjjbzahmyhbmuwrwzr" ||
        source.target_project !== "mi-pensum-unicauca" ||
        source.other_provider_identities !== 0 || source.mfa_factors !== 0 ||
        !record(targetExport)) {
        throw new Error("Migration source or authentication features require review.");
    }
    date(source.exported_at);
    const users = rows(source.users);
    const snapshots = rows(source.snapshots);
    const targets = rows(targetExport.users);
    const targetUids = new Set(targets.map(user => user.localId));
    const targetEmails = new Set(targets.map(user => typeof user.email === "string" ? user.email.trim().toLowerCase() : ""));
    const uids = new Set<string>();
    const emails = new Set<string>();

    const importedUsers = users.map(user => {
        if (typeof user.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ||
            typeof user.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
            typeof user.encrypted_password !== "string" || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.encrypted_password) ||
            user.deleted_at != null || user.is_anonymous === true) {
            throw new Error("An account cannot be migrated without review.");
        }
        const email = user.email.trim().toLowerCase();
        if (uids.has(user.id) || emails.has(email) || targetUids.has(user.id) || targetEmails.has(email)) {
            throw new Error("Duplicate account or existing Firebase identity; refusing to overwrite.");
        }
        uids.add(user.id);
        emails.add(email);
        const emailVerified = user.email_confirmed_at != null;
        if (emailVerified) date(user.email_confirmed_at);
        return {
            localId: user.id,
            email,
            emailVerified,
            passwordHash: Buffer.from(user.encrypted_password, "utf8").toString("base64"),
            disabled: user.banned_until != null && date(user.banned_until) > Date.now(),
            createdAt: String(date(user.created_at)),
            ...(user.last_sign_in_at != null ? { lastSignedInAt: String(date(user.last_sign_in_at)) } : {}),
        };
    });

    const snapshotUids = new Set<string>();
    const documents = snapshots.map(snapshot => {
        if (typeof snapshot.user_id !== "string" || !uids.has(snapshot.user_id) ||
            snapshotUids.has(snapshot.user_id) || snapshot.schema_version !== 1 || !record(snapshot.academic_data)) {
            throw new Error("Orphan, duplicate or unsupported academic snapshot.");
        }
        snapshotUids.add(snapshot.user_id);
        return {
            path: `academic_snapshots/${snapshot.user_id}`,
            data: {
                academic_data: encodeFirebaseSnapshot(snapshot.academic_data),
                schema_version: FIREBASE_SNAPSHOT_VERSION,
                // The writer must convert this ISO date to a Firestore Timestamp.
                updated_at: new Date(date(snapshot.updated_at)).toISOString(),
            },
        };
    });
    return {
        projectId: "mi-pensum-unicauca",
        authImport: { users: importedUsers },
        firestoreDocuments: documents,
        summary: { accounts: importedUsers.length, snapshots: documents.length, algorithm: "BCRYPT" },
    };
};
