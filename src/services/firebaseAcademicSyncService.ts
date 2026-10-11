import { doc, getDocFromServer, getFirestore, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getFirebaseApp, getFirebaseAuth } from "../lib/firebase.js";
import type { AcademicData, AcademicSnapshot } from "../types/academicSync.js";
import { decodeFirebaseSnapshot, encodeFirebaseSnapshot, FIREBASE_SNAPSHOT_VERSION } from "../utils/firebaseSnapshot.js";

const getAccountDocument = async (userId: string) => {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    if (!userId || auth.currentUser?.uid !== userId) {
        throw new Error("Inicia sesión con la cuenta a la que pertenecen los datos.");
    }
    return doc(getFirestore(getFirebaseApp()), "academic_snapshots", userId);
};

export const getFirebaseAcademicSnapshot = async (userId: string): Promise<AcademicSnapshot | null> => {
    // An unavailable server must throw, never look like an empty account from cache.
    const snapshot = await getDocFromServer(await getAccountDocument(userId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (!(data.updated_at instanceof Timestamp)) {
        throw new Error("El respaldo académico no tiene una fecha válida.");
    }
    return {
        academicData: decodeFirebaseSnapshot(data.academic_data, data.schema_version),
        schemaVersion: data.schema_version,
        updatedAt: data.updated_at.toDate().toISOString(),
    };
};

export const saveFirebaseAcademicSnapshot = async (userId: string, academicData: AcademicData): Promise<string> => {
    const academicDataPayload = encodeFirebaseSnapshot(academicData);
    const account = await getAccountDocument(userId);
    await setDoc(account, {
        academic_data: academicDataPayload,
        schema_version: FIREBASE_SNAPSHOT_VERSION,
        updated_at: serverTimestamp(),
    });
    // Only acknowledge the local dirty marker after the server accepts the write.
    const saved = await getDocFromServer(account);
    const timestamp: unknown = saved.data()?.updated_at;
    if (!(timestamp instanceof Timestamp)) throw new Error("No se pudo confirmar el guardado en la nube.");
    return timestamp.toDate().toISOString();
};
