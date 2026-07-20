export type AcademicData =
    Record<string, unknown>;

export interface AcademicSnapshot {
    academicData: AcademicData;
    schemaVersion: number;
    updatedAt: string;
}

export interface AcademicStorageChangedDetail {
    userId: string;
    storageKey: string;
}