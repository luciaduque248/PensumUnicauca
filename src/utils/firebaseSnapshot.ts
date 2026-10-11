import type { AcademicData } from "../types/academicSync.js";

export const FIREBASE_SNAPSHOT_VERSION = 2;
// Leave room for the document fields below Firestore's 1 MiB limit.
export const MAX_SNAPSHOT_BYTES = 850_000;

const isRecord = (value: unknown): value is AcademicData =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const encodeFirebaseSnapshot = (data: AcademicData): { payload: string } => {
    if (!isRecord(data)) throw new Error("La información académica no es válida.");
    // Preserve JSON keys and nested arrays without Firestore nesting restrictions.
    const payload = JSON.stringify(data);
    if (new TextEncoder().encode(payload).byteLength > MAX_SNAPSHOT_BYTES) {
        throw new Error("Tus datos superan el tamaño permitido para la sincronización. La copia local se conserva.");
    }
    return { payload };
};

export const decodeFirebaseSnapshot = (data: unknown, version: unknown): AcademicData => {
    if (!isRecord(data)) throw new Error("El respaldo académico no tiene una estructura válida.");
    if (version === 1) return data;
    if (version !== FIREBASE_SNAPSHOT_VERSION || typeof data.payload !== "string") {
        throw new Error("La versión del respaldo académico no es compatible.");
    }
    const decoded: unknown = JSON.parse(data.payload);
    if (!isRecord(decoded)) throw new Error("El respaldo académico no contiene datos válidos.");
    return decoded;
};
