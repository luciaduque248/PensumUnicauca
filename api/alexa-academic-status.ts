import {
    createClient,
    type SupabaseClient,
} from "@supabase/supabase-js";

import {
    curriculum,
} from "../src/data/curriculum.js";

import type {
    CurriculumSection,
    RepeatLevel,
    Subject,
    SubjectStatus,
} from "../src/types/curriculum.js";

interface AcademicSnapshotRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

interface ParsedSubjectAttempt {
    repeatLevel: RepeatLevel;
    result: "failed" | "approved";
}

interface ParsedSubjectAcademicRecord {
    repeatLevel: RepeatLevel;
    approvedRepeatLevel: RepeatLevel | null;
    failedAttempts: number;
    attempts: ParsedSubjectAttempt[];
}

interface ParsedStudentRegulatoryRecord {
    hasLowPerformanceHistory: boolean;
    hasDisciplinarySanction: boolean;
    conditionalEnrollmentActive: boolean;
    conditionalEnrollmentsUsed: number;
    lostRightToContinue: boolean;
}

interface AuthenticatedContext {
    ok: true;
    supabase: SupabaseClient;
    userId: string;
}

interface AuthenticationErrorContext {
    ok: false;
    errorResponse: Response;
}

type AuthenticationContext =
    | AuthenticatedContext
    | AuthenticationErrorContext;

interface SubjectSummary {
    code: string;
    name: string;
    semester: number | null;
}

const SUBJECT_STATUSES_KEY =
    "pensum-subject-statuses";

const SUBJECT_ACADEMIC_RECORDS_KEY =
    "pensum-subject-academic-records";

const STUDENT_REGULATORY_RECORD_KEY =
    "pensum-student-regulatory-record";

const CONDITIONAL_ENROLLMENTS_MAXIMUM =
    2;

const ALLOWED_ORIGINS =
    new Set<string>([
        "http://localhost:5173",
        "https://pensum-unicauca.vercel.app",
    ]);

const DEFAULT_REGULATORY_RECORD:
    ParsedStudentRegulatoryRecord = {
    hasLowPerformanceHistory:
        false,
    hasDisciplinarySanction:
        false,
    conditionalEnrollmentActive:
        false,
    conditionalEnrollmentsUsed:
        0,
    lostRightToContinue:
        false,
};

const isRecord = (
    value: unknown,
): value is Record<string, unknown> => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
};

const isSubjectStatus = (
    value: unknown,
): value is SubjectStatus => {
    return (
        value === "pending" ||
        value === "in-progress" ||
        value === "approved"
    );
};

const isRepeatLevel = (
    value: unknown,
): value is RepeatLevel => {
    return (
        value === 0 ||
        value === 1 ||
        value === 2 ||
        value === 3
    );
};

const clampInteger = (
    value: unknown,
    minimum: number,
    maximum: number,
): number => {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value)
    ) {
        return minimum;
    }

    return Math.min(
        maximum,
        Math.max(
            minimum,
            Math.trunc(value),
        ),
    );
};

const getSubjectStatuses = (
    academicData:
        Record<string, unknown>,
): Record<string, SubjectStatus> => {
    const storedStatuses =
        academicData[
        SUBJECT_STATUSES_KEY
        ];

    if (!isRecord(storedStatuses)) {
        return {};
    }

    const result:
        Record<string, SubjectStatus> = {};

    for (
        const [
            subjectCode,
            status,
        ] of Object.entries(
            storedStatuses,
        )
    ) {
        if (isSubjectStatus(status)) {
            result[subjectCode] =
                status;
        }
    }

    return result;
};

const parseSubjectAttempt = (
    value: unknown,
): ParsedSubjectAttempt | null => {
    if (!isRecord(value)) {
        return null;
    }

    if (
        !isRepeatLevel(
            value.repeatLevel,
        ) ||
        (
            value.result !==
            "failed" &&
            value.result !==
            "approved"
        )
    ) {
        return null;
    }

    return {
        repeatLevel:
            value.repeatLevel,
        result:
            value.result,
    };
};

const parseSubjectAcademicRecord = (
    value: unknown,
): ParsedSubjectAcademicRecord => {
    if (!isRecord(value)) {
        return {
            repeatLevel: 0,
            approvedRepeatLevel:
                null,
            failedAttempts: 0,
            attempts: [],
        };
    }

    const attempts =
        Array.isArray(
            value.attempts,
        )
            ? value.attempts
                .map(
                    parseSubjectAttempt,
                )
                .filter(
                    (
                        attempt,
                    ): attempt is ParsedSubjectAttempt =>
                        attempt !== null,
                )
            : [];

    return {
        repeatLevel:
            isRepeatLevel(
                value.repeatLevel,
            )
                ? value.repeatLevel
                : 0,
        approvedRepeatLevel:
            isRepeatLevel(
                value.approvedRepeatLevel,
            )
                ? value.approvedRepeatLevel
                : null,
        failedAttempts:
            clampInteger(
                value.failedAttempts,
                0,
                Number.MAX_SAFE_INTEGER,
            ),
        attempts,
    };
};

const getSubjectAcademicRecords = (
    academicData:
        Record<string, unknown>,
): Record<
    string,
    ParsedSubjectAcademicRecord
> => {
    const storedRecords =
        academicData[
        SUBJECT_ACADEMIC_RECORDS_KEY
        ];

    if (!isRecord(storedRecords)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(
            storedRecords,
        ).map(
            ([
                subjectCode,
                value,
            ]) => [
                    subjectCode,
                    parseSubjectAcademicRecord(
                        value,
                    ),
                ],
        ),
    );
};

const getStudentRegulatoryRecord = (
    academicData:
        Record<string, unknown>,
): ParsedStudentRegulatoryRecord => {
    const storedRecord =
        academicData[
        STUDENT_REGULATORY_RECORD_KEY
        ];

    if (!isRecord(storedRecord)) {
        return {
            ...DEFAULT_REGULATORY_RECORD,
        };
    }

    return {
        hasLowPerformanceHistory:
            storedRecord
                .hasLowPerformanceHistory ===
            true,
        hasDisciplinarySanction:
            storedRecord
                .hasDisciplinarySanction ===
            true,
        conditionalEnrollmentActive:
            storedRecord
                .conditionalEnrollmentActive ===
            true,
        conditionalEnrollmentsUsed:
            clampInteger(
                storedRecord
                    .conditionalEnrollmentsUsed,
                0,
                CONDITIONAL_ENROLLMENTS_MAXIMUM,
            ),
        lostRightToContinue:
            storedRecord
                .lostRightToContinue ===
            true,
    };
};

const getApprovedRepeatLevel = (
    record:
        ParsedSubjectAcademicRecord,
): RepeatLevel | null => {
    if (
        record.approvedRepeatLevel !==
        null
    ) {
        return record
            .approvedRepeatLevel;
    }

    for (
        let index =
            record.attempts.length - 1;
        index >= 0;
        index -= 1
    ) {
        const attempt =
            record.attempts[index];

        if (
            attempt.result ===
            "approved"
        ) {
            return attempt
                .repeatLevel;
        }
    }

    return null;
};

const getAllSubjects = (): Array<
    SubjectSummary & {
        subject: Subject;
    }
> => {
    return curriculum.flatMap(
        (
            section:
                CurriculumSection,
        ) =>
            section.subjects.map(
                (
                    subject:
                        Subject,
                ) => ({
                    code:
                        subject.code,
                    name:
                        subject.name,
                    semester:
                        section.semester ??
                        null,
                    subject,
                }),
            ),
    );
};

const buildAcademicStatus = (
    academicData:
        Record<string, unknown>,
) => {
    const allSubjects =
        getAllSubjects();

    const subjectStatuses =
        getSubjectStatuses(
            academicData,
        );

    const subjectAcademicRecords =
        getSubjectAcademicRecords(
            academicData,
        );

    const regulatoryRecord =
        getStudentRegulatoryRecord(
            academicData,
        );

    const activeRepeatSubjects:
        Array<
            SubjectSummary & {
                repeatLevel:
                Exclude<
                    RepeatLevel,
                    0
                >;
                status:
                SubjectStatus;
            }
        > = [];

    const activeRepeatCounts = {
        r1: 0,
        r2: 0,
        r3: 0,
    };

    const historicalRepeatCounts = {
        r1: 0,
        r2: 0,
        r3: 0,
    };

    let hasRepeatHistory =
        false;

    for (
        const subjectDetail
        of allSubjects
    ) {
        const status =
            subjectStatuses[
            subjectDetail.code
            ] ??
            "pending";

        const record =
            subjectAcademicRecords[
            subjectDetail.code
            ] ??
            parseSubjectAcademicRecord(
                null,
            );

        const approvedRepeatLevel =
            getApprovedRepeatLevel(
                record,
            );

        if (
            record.repeatLevel > 0 ||
            record.failedAttempts > 0 ||
            (
                approvedRepeatLevel ??
                0
            ) > 0
        ) {
            hasRepeatHistory =
                true;
        }

        if (
            status !== "approved" &&
            record.repeatLevel > 0
        ) {
            const repeatLevel =
                record.repeatLevel as
                Exclude<
                    RepeatLevel,
                    0
                >;

            activeRepeatSubjects.push({
                code:
                    subjectDetail.code,
                name:
                    subjectDetail.name,
                semester:
                    subjectDetail.semester,
                repeatLevel,
                status,
            });

            if (repeatLevel === 1) {
                activeRepeatCounts.r1 +=
                    1;
            } else if (
                repeatLevel === 2
            ) {
                activeRepeatCounts.r2 +=
                    1;
            } else {
                activeRepeatCounts.r3 +=
                    1;
            }
        }

        const historicalLevel =
            status === "approved"
                ? approvedRepeatLevel ??
                record.repeatLevel
                : record.repeatLevel;

        if (historicalLevel === 1) {
            historicalRepeatCounts.r1 +=
                1;
        } else if (
            historicalLevel === 2
        ) {
            historicalRepeatCounts.r2 +=
                1;
        } else if (
            historicalLevel === 3
        ) {
            historicalRepeatCounts.r3 +=
                1;
        }
    }

    const completedSemesters =
        curriculum.filter(
            (
                section:
                    CurriculumSection,
            ) => {
                if (
                    section.semester ===
                    undefined ||
                    section.subjects.length ===
                    0
                ) {
                    return false;
                }

                return section.subjects.every(
                    (
                        subject:
                            Subject,
                    ) =>
                        subjectStatuses[
                        subject.code
                        ] ===
                        "approved",
                );
            },
        ).length;

    const situation =
        regulatoryRecord
            .lostRightToContinue
            ? "lost-right"
            : regulatoryRecord
                .conditionalEnrollmentActive
                ? "conditional-enrollment"
                : regulatoryRecord
                    .hasLowPerformanceHistory
                    ? "low-performance"
                    : "normal";

    const hasRegulatoryHistory =
        hasRepeatHistory ||
        regulatoryRecord
            .hasLowPerformanceHistory ||
        regulatoryRecord
            .hasDisciplinarySanction ||
        regulatoryRecord
            .conditionalEnrollmentsUsed > 0 ||
        regulatoryRecord
            .lostRightToContinue;

    const situationLabel =
        situation === "lost-right"
            ? "Pérdida del derecho a continuar"
            : situation ===
                "conditional-enrollment"
                ? "Matrícula condicional activa"
                : situation ===
                    "low-performance"
                    ? "Bajo rendimiento académico"
                    : hasRegulatoryHistory
                        ? "Situación académica normal con historial"
                        : "Situación académica normal";

    const activeRestrictions:
        string[] = [];

    if (
        regulatoryRecord
            .lostRightToContinue
    ) {
        activeRestrictions.push(
            "No se deben registrar nuevos avances académicos hasta verificar la situación con la Universidad.",
        );
    } else if (
        regulatoryRecord
            .conditionalEnrollmentActive
    ) {
        activeRestrictions.push(
            "Durante la matrícula condicional solo se pueden cursar materias que deban repetirse.",
        );
    }

    if (
        activeRepeatCounts.r3 > 0
    ) {
        activeRestrictions.push(
            `Hay ${activeRepeatCounts.r3} ${activeRepeatCounts.r3 === 1
                ? "materia activa"
                : "materias activas"
            } en R3.`,
        );
    }

    if (
        regulatoryRecord
            .hasDisciplinarySanction
    ) {
        activeRestrictions.push(
            "Hay una sanción disciplinaria registrada que afecta la evaluación de una eventual pérdida en R2.",
        );
    }

    const historicalNotes:
        string[] = [];

    if (
        regulatoryRecord
            .hasLowPerformanceHistory
    ) {
        historicalNotes.push(
            "Existe antecedente de bajo rendimiento académico.",
        );
    }

    if (
        regulatoryRecord
            .conditionalEnrollmentsUsed > 0
    ) {
        historicalNotes.push(
            `Se han utilizado ${regulatoryRecord.conditionalEnrollmentsUsed} de ${CONDITIONAL_ENROLLMENTS_MAXIMUM} matrículas condicionales.`,
        );
    }

    if (hasRepeatHistory) {
        historicalNotes.push(
            "Existe historial de materias repetidas.",
        );
    }

    const shouldShowRegulatoryTracking =
        completedSemesters > 0 ||
        hasRepeatHistory ||
        regulatoryRecord
            .hasLowPerformanceHistory ||
        regulatoryRecord
            .hasDisciplinarySanction ||
        regulatoryRecord
            .conditionalEnrollmentActive ||
        regulatoryRecord
            .conditionalEnrollmentsUsed > 0 ||
        regulatoryRecord
            .lostRightToContinue;

    return {
        situation,
        situationLabel,
        hasRegulatoryHistory,
        shouldShowRegulatoryTracking,
        completedSemesters,
        lowPerformance: {
            registered:
                regulatoryRecord
                    .hasLowPerformanceHistory,
        },
        conditionalEnrollment: {
            active:
                regulatoryRecord
                    .conditionalEnrollmentActive,
            used:
                regulatoryRecord
                    .conditionalEnrollmentsUsed,
            maximum:
                CONDITIONAL_ENROLLMENTS_MAXIMUM,
            remaining:
                Math.max(
                    CONDITIONAL_ENROLLMENTS_MAXIMUM -
                    regulatoryRecord
                        .conditionalEnrollmentsUsed,
                    0,
                ),
        },
        disciplinarySanction: {
            registered:
                regulatoryRecord
                    .hasDisciplinarySanction,
        },
        continuation: {
            rightToContinue:
                !regulatoryRecord
                    .lostRightToContinue,
            lostRightToContinue:
                regulatoryRecord
                    .lostRightToContinue,
        },
        repeats: {
            activeCounts:
                activeRepeatCounts,
            historicalCounts:
                historicalRepeatCounts,
            activeSubjects:
                activeRepeatSubjects,
        },
        activeRestrictions,
        historicalNotes,
    };
};

const getBearerToken = (
    request: Request,
): string | null => {
    const authorizationHeader =
        request.headers.get(
            "authorization",
        );

    if (!authorizationHeader) {
        return null;
    }

    const match =
        authorizationHeader.match(
            /^Bearer\s+(.+)$/i,
        );

    const token =
        match?.[1]?.trim();

    return token || null;
};

const getCorsHeaders = (
    request: Request,
): Headers => {
    const headers =
        new Headers({
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type",
            "Access-Control-Allow-Methods":
                "GET, OPTIONS",
            "Cache-Control":
                "no-store",
            Vary:
                "Origin",
        });

    const origin =
        request.headers.get(
            "origin",
        );

    if (
        origin &&
        ALLOWED_ORIGINS.has(origin)
    ) {
        headers.set(
            "Access-Control-Allow-Origin",
            origin,
        );
    }

    return headers;
};

const createJsonResponse = (
    request: Request,
    body: unknown,
    status: number,
): Response => {
    const headers =
        getCorsHeaders(request);

    headers.set(
        "Content-Type",
        "application/json; charset=utf-8",
    );

    return new Response(
        JSON.stringify(body),
        {
            status,
            headers,
        },
    );
};

const createSupabaseClient = (
    accessToken: string,
): SupabaseClient | null => {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const supabasePublishableKey =
        process.env
            .SUPABASE_PUBLISHABLE_KEY;

    if (
        !supabaseUrl ||
        !supabasePublishableKey
    ) {
        return null;
    }

    return createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            auth: {
                persistSession:
                    false,
                autoRefreshToken:
                    false,
                detectSessionInUrl:
                    false,
            },
            global: {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                },
            },
        },
    );
};

const getAuthenticatedContext =
    async (
        request: Request,
    ): Promise<
        AuthenticationContext
    > => {
        const accessToken =
            getBearerToken(request);

        if (!accessToken) {
            return {
                ok: false,
                errorResponse:
                    createJsonResponse(
                        request,
                        {
                            ok: false,
                            error:
                                "Se requiere autenticación.",
                        },
                        401,
                    ),
            };
        }

        const supabase =
            createSupabaseClient(
                accessToken,
            );

        if (!supabase) {
            console.error(
                "[Alexa academic status API] Faltan las variables de Supabase.",
            );

            return {
                ok: false,
                errorResponse:
                    createJsonResponse(
                        request,
                        {
                            ok: false,
                            error:
                                "El servicio no está configurado correctamente.",
                        },
                        500,
                    ),
            };
        }

        const {
            data: userData,
            error: userError,
        } =
            await supabase.auth
                .getUser(
                    accessToken,
                );

        if (
            userError ||
            !userData.user
        ) {
            return {
                ok: false,
                errorResponse:
                    createJsonResponse(
                        request,
                        {
                            ok: false,
                            error:
                                "La sesión no es válida o ha vencido.",
                        },
                        401,
                    ),
            };
        }

        return {
            ok: true,
            supabase,
            userId:
                userData.user.id,
        };
    };

const getSnapshot =
    async (
        supabase: SupabaseClient,
        userId: string,
    ): Promise<{
        snapshot:
        AcademicSnapshotRow | null;
        error: unknown;
    }> => {
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
                    AcademicSnapshotRow
                >();

        return {
            snapshot:
                data,
            error,
        };
    };

const handleGetRequest =
    async (
        request: Request,
    ): Promise<Response> => {
        const authContext =
            await getAuthenticatedContext(
                request,
            );

        if (authContext.ok === false) {
            return authContext
                .errorResponse;
        }

        const {
            snapshot,
            error,
        } =
            await getSnapshot(
                authContext.supabase,
                authContext.userId,
            );

        if (error) {
            console.error(
                "[Alexa academic status API] Error consultando academic_snapshots.",
                error,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "No fue posible consultar la situación académica.",
                },
                500,
            );
        }

        if (!snapshot) {
            return createJsonResponse(
                request,
                {
                    ok: true,
                    snapshotExists:
                        false,
                    academicStatus:
                        buildAcademicStatus(
                            {},
                        ),
                },
                200,
            );
        }

        if (
            !isRecord(
                snapshot.academic_data,
            )
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "La información académica almacenada no tiene una estructura válida.",
                },
                500,
            );
        }

        return createJsonResponse(
            request,
            {
                ok: true,
                snapshotExists:
                    true,
                snapshot: {
                    schemaVersion:
                        snapshot.schema_version,
                    updatedAt:
                        snapshot.updated_at,
                },
                academicStatus:
                    buildAcademicStatus(
                        snapshot
                            .academic_data,
                    ),
            },
            200,
        );
    };

export default {
    async fetch(
        request: Request,
    ): Promise<Response> {
        if (
            request.method ===
            "OPTIONS"
        ) {
            return new Response(
                null,
                {
                    status: 204,
                    headers:
                        getCorsHeaders(
                            request,
                        ),
                },
            );
        }

        if (
            request.method ===
            "GET"
        ) {
            return handleGetRequest(
                request,
            );
        }

        return createJsonResponse(
            request,
            {
                ok: false,
                error:
                    "Método no permitido.",
            },
            405,
        );
    },
};
