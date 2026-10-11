import { timingSafeEqual } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { getFirebaseServer } from "../server/firebaseServer.js";

// Temporary, expiring preview-only probe. Fixed synthetic fixture, no student reads.
export default { async fetch(request: Request): Promise<Response> {
    const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    const expected = process.env.FIREBASE_PREVIEW_CHECK_SECRET ?? "";
    const actual = new URL(request.url).searchParams.get("key") ?? "";
    const uid = process.env.FIREBASE_PREVIEW_CHECK_UID ?? "";
    const expires = Number(process.env.FIREBASE_PREVIEW_CHECK_EXPIRES ?? 0);
    if (request.method !== "GET" || process.env.VERCEL_ENV !== "preview" || !/^wif-check-[a-f0-9-]{36}$/.test(uid) || Date.now() > expires || expected.length < 40 || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return json({ ok: false }, 404);
    let stage = "credentials";
    let created = false;
    const { auth, db } = getFirebaseServer();
    const ref = db.collection("academic_snapshots").doc(uid);
    try {
        stage = "auth-read";
        const user = await auth.getUser(uid);
        if (user.uid !== uid || user.disabled) throw new Error("Fixture mismatch");
        stage = "firestore-create";
        await ref.create({ schema_version: 2, academic_data: { payload: JSON.stringify({ previewProbe: true }) }, updated_at: FieldValue.serverTimestamp() });
        created = true;
        stage = "firestore-read";
        const before = await ref.get();
        if (before.data()?.schema_version !== 2) throw new Error("Fixture mismatch");
        stage = "firestore-update";
        await ref.update({ academic_data: { payload: JSON.stringify({ previewProbe: "updated" }) }, updated_at: FieldValue.serverTimestamp() }, { lastUpdateTime: before.updateTime! });
        const after = await ref.get();
        if (JSON.parse(after.data()?.academic_data.payload).previewProbe !== "updated") throw new Error("Fixture mismatch");
        stage = "firestore-delete";
        await ref.delete();
        created = false;
        return json({ ok: true, authRead: true, firestoreCreateReadUpdateDelete: true, preview: true }, 200);
    } catch (error) {
        return json({ ok: false, stage, code: (error as { code?: unknown }).code ?? "failed" }, 500);
    } finally {
        if (created) await ref.delete().catch(() => {});
    }
}};
