import { createClient } from "@supabase/supabase-js";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { getFirebaseServer } from "./firebaseServer.js";
import { decodeFirebaseSnapshot, encodeFirebaseSnapshot, FIREBASE_SNAPSHOT_VERSION } from "../src/utils/firebaseSnapshot.js";

export interface AcademicSnapshotRow {
    academic_data: Record<string, unknown>;
    schema_version: number;
    updated_at: string;
}

export interface AcademicApiClient {
    auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
    getSnapshot(userId: string): Promise<{ snapshot: AcademicSnapshotRow | null; error: unknown }>;
    saveSnapshot(userId: string, data: Record<string, unknown>, previous: AcademicSnapshotRow): Promise<{ updatedAt?: string; error: unknown }>;
}

export const isSnapshotConflict = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error &&
    [9, "9", "failed-precondition"].includes(error.code as number | string);

// The UID always comes from a verified token. Never infer ownership from email.
export function createAcademicApiClient(accessToken: string): AcademicApiClient | null {
    const provider = process.env.ALEXA_DATA_PROVIDER ?? "supabase";
    if (!["supabase", "firebase"].includes(provider)) throw new Error("Invalid academic data provider.");
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    let verifiedUid: string | undefined;
    const revisions = new WeakMap<AcademicSnapshotRow, Timestamp>();
    const owns = (uid: string) => {
        if (!verifiedUid || uid !== verifiedUid || !uid || uid.includes("/")) throw new Error("Academic account ownership mismatch.");
    };
    return {
        auth: { async getUser(token) {
            verifiedUid = undefined;
            if (token !== accessToken) return { data: { user: null }, error: new Error("Invalid token.") };
            const result = await supabase.auth.getUser(token);
            if (result.error || !result.data.user) return { data: { user: null }, error: result.error };
            const uid = result.data.user.id;
            if (provider === "firebase") {
                // Existing Supabase OAuth accounts must also be migrated, active Firebase accounts.
                try {
                    const user = await getFirebaseServer().auth.getUser(uid);
                    if (user.disabled) return { data: { user: null }, error: new Error("Disabled account.") };
                } catch (error) {
                    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") {
                        return { data: { user: null }, error };
                    }
                    throw error;
                }
            }
            verifiedUid = uid;
            return { data: { user: { id: uid } }, error: null };
        }},
        async getSnapshot(uid) {
            try {
                owns(uid);
                if (provider === "supabase") {
                    const result = await supabase.from("academic_snapshots").select("academic_data,schema_version,updated_at").eq("user_id", uid).maybeSingle<AcademicSnapshotRow>();
                    return { snapshot: result.data, error: result.error };
                }
                const doc = await getFirebaseServer().db.doc(`academic_snapshots/${uid}`).get();
                if (!doc.exists) return { snapshot: null, error: null };
                const data = doc.data()!;
                if (!(data.updated_at instanceof Timestamp) || !doc.updateTime) throw new Error("Invalid academic revision.");
                const snapshot = { academic_data: decodeFirebaseSnapshot(data.academic_data, data.schema_version), schema_version: data.schema_version as number, updated_at: data.updated_at.toDate().toISOString() };
                revisions.set(snapshot, doc.updateTime);
                return { snapshot, error: null };
            } catch (error) { return { snapshot: null, error }; }
        },
        async saveSnapshot(uid, data, previous) {
            try {
                owns(uid);
                if (provider === "supabase") {
                    const updatedAt = new Date().toISOString();
                    const result = await supabase.from("academic_snapshots").upsert({ user_id: uid, academic_data: data, schema_version: previous.schema_version ?? 1, updated_at: updatedAt }, { onConflict: "user_id" });
                    return { updatedAt, error: result.error };
                }
                const revision = revisions.get(previous);
                if (!revision) throw new Error("Missing academic revision.");
                const ref = getFirebaseServer().db.doc(`academic_snapshots/${uid}`);
                const saved = await ref.update({ academic_data: encodeFirebaseSnapshot(data), schema_version: FIREBASE_SNAPSHOT_VERSION, updated_at: FieldValue.serverTimestamp() }, { lastUpdateTime: revision });
                return { updatedAt: saved.writeTime.toDate().toISOString(), error: null };
            } catch (error) { return { error }; }
        },
    };
}
