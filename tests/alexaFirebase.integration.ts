// Opt-in: real Firebase Auth/Admin and Firestore; Supabase's verified-token
// response is a stub. This does not test native OAuth or an Alexa device.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { applicationDefault, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseServer } from "../server/firebaseServer.js";
import { createAcademicApiClient, isSnapshotConflict } from "../server/academicApiClient.js";
import { encodeFirebaseSnapshot, decodeFirebaseSnapshot } from "../src/utils/firebaseSnapshot.js";
import account from "../api/alexa-account.js";
import progress from "../api/alexa-progress.js";
import schedule from "../api/alexa-schedule.js";
import status from "../api/alexa-academic-status.js";
import grades from "../api/alexa-grades.js";

if (process.env.FIREBASE_LIVE_CHECK !== "mi-pensum-unicauca") throw new Error("Live check disabled.");
process.env.ALEXA_DATA_PROVIDER = "firebase";
process.env.SUPABASE_URL = "https://kdyjjbzahmyhbmuwrwzr.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "synthetic-test-key";
const { db } = getFirebaseServer();
const fixtureApp = initializeApp({ projectId: "mi-pensum-unicauca", credential: applicationDefault() }, "pensum-fixtures");
const auth = getAuth(fixtureApp);
const owner = randomUUID(), other = randomUUID();
const ownerRef = db.doc(`academic_snapshots/${owner}`), otherRef = db.doc(`academic_snapshots/${other}`);
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith(process.env.SUPABASE_URL!) && url.includes("/auth/v1/user")) {
        const token = new Headers(init?.headers).get("authorization");
        return token === "Bearer synthetic-owner" ? Response.json({ id: owner, email: "synthetic@example.com" }) : Response.json({ message: "Invalid JWT", error_code: "bad_jwt" }, { status: 401 });
    }
    return realFetch(input, init);
};
const fixture = { "pensum-subject-statuses": { "MAT102.1": "in-progress" }, "pensum-subject-grade-records": {}, marker: "owner", schedule: { nested: [[1, null], ["José María"]] } };
const request = (path: string, method = "GET", body?: unknown) => new Request(`https://example.com/api/${path}?user_id=${other}`, {
    method, headers: { Authorization: "Bearer synthetic-owner", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
let createdOwner = false, createdOther = false;
try {
    await auth.createUser({ uid: owner, email: `alexa-check-${owner}@example.com`, emailVerified: true }); createdOwner = true;
    await auth.createUser({ uid: other, email: `alexa-check-${other}@example.com` }); createdOther = true;
    console.log("Synthetic accounts created; preparing Firestore fixtures.");
    await ownerRef.create({ academic_data: encodeFirebaseSnapshot(fixture), schema_version: 2, updated_at: FieldValue.serverTimestamp() });
    await otherRef.create({ academic_data: encodeFirebaseSnapshot({ marker: "other" }), schema_version: 2, updated_at: FieldValue.serverTimestamp() });
    console.log("Firestore fixtures created; checking the five API handlers.");
    for (const api of [account, progress, schedule, status, grades]) assert.equal((await api.fetch(request("academic"))).status, 200);
    const info = await (await account.fetch(request("account"))).json() as { account: { id: string }; snapshot: { sections: string[] } };
    assert.equal(info.account.id, owner);assert.ok(info.snapshot.sections.includes("marker"));
    const result = await grades.fetch(request("grades", "POST", { action: "set-grade", subject: "MAT102.1", cut: "first", grade: 4.2, user_id: other }));
    assert.equal(result.status, 200, await result.text());
    const saved = (await ownerRef.get()).data()!;
    const data = decodeFirebaseSnapshot(saved.academic_data, saved.schema_version);
    const records = data["pensum-subject-grade-records"] as Record<string, { cuts: { first: { activities: { grade: number }[] } } }>;
    assert.equal(records["MAT102.1"].cuts.first.activities[0].grade, 4.2);
    assert.deepEqual(data.schedule, fixture.schedule);assert.equal(data.marker, "owner");
    assert.equal(decodeFirebaseSnapshot((await otherRef.get()).get("academic_data"), 2).marker, "other");
    const client = createAcademicApiClient("synthetic-owner")!;await client.auth.getUser("synthetic-owner");
    assert.ok((await client.getSnapshot(other)).error);
    const stale = (await client.getSnapshot(owner)).snapshot!;
    await ownerRef.update({ academic_data: encodeFirebaseSnapshot({ ...data, marker: "newer" }), updated_at: FieldValue.serverTimestamp() });
    const conflict = await client.saveSnapshot(owner, { ...data, marker: "stale" }, stale);
    assert.ok(isSnapshotConflict(conflict.error));
    assert.equal(decodeFirebaseSnapshot((await ownerRef.get()).get("academic_data"), 2).marker, "newer");
    await auth.updateUser(owner, { disabled: true });
    assert.equal((await account.fetch(request("account"))).status, 401);
    await auth.updateUser(owner, { disabled: false });
    const blank = new Request("https://example.com/api/account", { headers: { Authorization: "Bearer invalid" } });
    assert.equal((await account.fetch(blank)).status, 401);
    await auth.deleteUser(owner); createdOwner = false;
    assert.equal((await account.fetch(request("account"))).status, 401);
    console.log("PASS: five Alexa APIs read real Firestore; grades update own account; stale writes, other UID, disabled/deleted accounts and invalid token rejected.");
} finally {
    globalThis.fetch = realFetch;
    const results = await Promise.allSettled([ownerRef.delete(), otherRef.delete(), ...(createdOwner ? [auth.deleteUser(owner)] : []), ...(createdOther ? [auth.deleteUser(other)] : [])]);
    await db.terminate();await deleteApp(fixtureApp);
    assert.ok(results.every(r => r.status === "fulfilled"), "Synthetic fixture cleanup failed.");
    console.log("Synthetic Firebase fixtures removed.");
}
