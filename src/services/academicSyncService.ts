import {
    supabase,
} from "../lib/supabase";

import type {
    AcademicData,
    AcademicSnapshot,
} from "../types/academicSync";

interface AcademicSnapshotDatabaseRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

interface AcademicSnapshotUpdatedRow {
    updated_at: string;
}

const isAcademicData = (
    value: unknown,
): value is AcademicData => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
};

export const getAcademicSnapshot =
    async (
        userId: string,
    ): Promise<AcademicSnapshot | null> => {
        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "academic_snapshots",
                )
                .select(
                    [
                        "academic_data",
                        "schema_version",
                        "updated_at",
                    ].join(","),
                )
                .eq(
                    "user_id",
                    userId,
                )
                .maybeSingle<
                    AcademicSnapshotDatabaseRow
                >();

        if (error) {
            throw error;
        }

        if (!data) {
            return null;
        }

        if (
            !isAcademicData(
                data.academic_data,
            )
        ) {
            throw new Error(
                "La información académica almacenada en la nube no tiene una estructura válida.",
            );
        }

        return {
            academicData:
                data.academic_data,
            schemaVersion:
                data.schema_version,
            updatedAt:
                data.updated_at,
        };
    };

export const saveAcademicSnapshot =
    async (
        userId: string,
        academicData: AcademicData,
    ): Promise<string> => {
        const requestedUpdatedAt =
            new Date().toISOString();

        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "academic_snapshots",
                )
                .upsert(
                    {
                        user_id:
                            userId,
                        academic_data:
                            academicData,
                        schema_version:
                            1,
                        updated_at:
                            requestedUpdatedAt,
                    },
                    {
                        onConflict:
                            "user_id",
                    },
                )
                .select(
                    "updated_at",
                )
                .single<
                    AcademicSnapshotUpdatedRow
                >();

        if (error) {
            throw error;
        }

        return (
            data?.updated_at ??
            requestedUpdatedAt
        );
    };
