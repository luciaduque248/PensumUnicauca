import { usesFirebase } from "../lib/backendProvider";
import { getFirebaseAcademicSnapshot, saveFirebaseAcademicSnapshot } from "./firebaseAcademicSyncService";
import * as legacy from "./supabaseAcademicSyncService";
import type { AcademicData, AcademicSnapshot } from "../types/academicSync";

export const getAcademicSnapshot = (userId: string): Promise<AcademicSnapshot | null> =>
    usesFirebase ? getFirebaseAcademicSnapshot(userId) : legacy.getAcademicSnapshot(userId);

export const saveAcademicSnapshot = (userId: string, data: AcademicData): Promise<string> =>
    usesFirebase ? saveFirebaseAcademicSnapshot(userId, data) : legacy.saveAcademicSnapshot(userId, data);
