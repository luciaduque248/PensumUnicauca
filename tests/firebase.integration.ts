// Opt-in live check. Uses only synthetic accounts and removes its own data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut as sdkSignOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getDocFromServer, getDocs, getFirestore, serverTimestamp, setDoc, terminate } from "firebase/firestore";
import { getFirebaseApp, getFirebaseAuth } from "../src/lib/firebase.js";
import { getCurrentFirebaseUser, signInWithFirebaseEmail, signOutFromFirebase, signUpWithFirebaseEmail, subscribeToFirebaseAuthChanges } from "../src/services/firebaseAuthService.js";
import { getFirebaseAcademicSnapshot, saveFirebaseAcademicSnapshot } from "../src/services/firebaseAcademicSyncService.js";

if (process.env.FIREBASE_LIVE_CHECK !== "mi-pensum-unicauca") {
    throw new Error("Live check disabled. Set FIREBASE_LIVE_CHECK=mi-pensum-unicauca explicitly.");
}
const app = getFirebaseApp();
assert.equal(app.options.projectId, process.env.FIREBASE_LIVE_CHECK);
const secondApp = initializeApp(app.options, `isolation-${randomUUID()}`);
const db = getFirestore(app);
const otherDb = getFirestore(secondApp);
const otherAuth = getAuth(secondApp);
const password = randomUUID() + "Aa9!";
const email = `pensum-check-${randomUUID()}@example.com`;
let owner: User | undefined;
let other: User | undefined;
let stop = () => {};
let cleanupIncomplete = false;
const denied = (operation: Promise<unknown>) => assert.rejects(operation, { code: "permission-denied" });
const fixture = { "pensum:grades": { grade: 4.2, cuts: [[1, 2], [3, null]] }, schedule: { classroom: "José María", classes: [] } };

try {
    await denied(getDocFromServer(doc(db, "academic_snapshots", "no-public-access")));
    owner = await signUpWithFirebaseEmail(` ${email.toUpperCase()} `, password);
    assert.equal(owner.email, email);
    assert.equal((await getCurrentFirebaseUser())?.uid, owner.uid);
    assert.equal(await getFirebaseAcademicSnapshot(owner.uid), null);
    const revision = await saveFirebaseAcademicSnapshot(owner.uid, fixture);
    assert.ok(Number.isFinite(Date.parse(revision)));
    assert.deepEqual((await getFirebaseAcademicSnapshot(owner.uid))?.academicData, fixture);

    other = (await createUserWithEmailAndPassword(otherAuth, `pensum-check-${randomUUID()}@example.com`, password)).user;
    const target = doc(otherDb, "academic_snapshots", owner.uid);
    await denied(getDocFromServer(target));
    await denied(setDoc(target, { academic_data: {}, schema_version: 2, updated_at: serverTimestamp() }));
    await denied(deleteDoc(target));
    await denied(getDocs(collection(otherDb, "academic_snapshots")));
    await denied(setDoc(doc(otherDb, "academic_snapshots", other.uid), { academic_data: {}, schema_version: 2, updated_at: serverTimestamp(), unexpected: true }));
    await denied(setDoc(doc(db, "academic_snapshots", owner.uid), { academic_data: [], schema_version: 2, updated_at: serverTimestamp() }));
    await assert.rejects(getFirebaseAcademicSnapshot(other.uid));
    assert.deepEqual((await getFirebaseAcademicSnapshot(owner.uid))?.academicData, fixture);

    await signOutFromFirebase();
    assert.equal(await getCurrentFirebaseUser(), null);
    await assert.rejects(getFirebaseAcademicSnapshot(owner.uid));
    await signInWithFirebaseEmail(email, password);
    assert.deepEqual((await getFirebaseAcademicSnapshot(owner.uid))?.academicData, fixture);
    await new Promise<void>((resolve, reject) => {
        stop = subscribeToFirebaseAuthChanges(user => {
            if (user?.uid === owner?.uid) resolve();
        }, reject);
    });
    stop();
    console.log("PASS: live Auth registration/login/logout, server snapshot round trip, and cross-user/public access denied.");
} finally {
    stop();
    const cleanup = await Promise.allSettled([
        (async () => {
            if (!owner) return;
            if (getFirebaseAuth().currentUser?.uid !== owner.uid) await signInWithFirebaseEmail(email, password);
            await deleteDoc(doc(db, "academic_snapshots", owner.uid));
            await deleteUser(getFirebaseAuth().currentUser!);
        })(),
        (async () => { if (other) { await deleteUser(other); await sdkSignOut(otherAuth); } })(),
    ]);
    await Promise.all([terminate(db), terminate(otherDb)]);
    await Promise.all([deleteApp(app), deleteApp(secondApp)]);
    if (cleanup.some(result => result.status === "rejected")) {
        cleanupIncomplete = true;
        console.error("Test cleanup incomplete; inspect synthetic pensum-check-* accounts before retrying.");
    }
    if (!cleanupIncomplete) console.log("Cleanup completed: synthetic accounts and snapshot removed.");
}
if (cleanupIncomplete) throw new Error("Test cleanup incomplete.");
