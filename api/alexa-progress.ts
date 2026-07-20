import {
    createClient,
} from "@supabase/supabase-js";

import {
    curriculum,
} from "../src/data/curriculum.js";

import type {
    CurriculumSection,
    Subject,
    SubjectStatus,
} from "../src/types/curriculum.js";

interface AcademicSnapshotRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

const SUBJECT_STATUSES_KEY =
    "pensum-subject-statuses";

const ALLOWED_ORIGINS =
    new Set<string>([
        "http://localhost:5173",
        "https://pensum-unicauca.vercel.app",
    ]);

const allSubjects: Subject[] =
    curriculum.flatMap(
        (
            section:
                CurriculumSection,
        ): Subject[] =>
            section.subjects,
    );

const totalSubjects: number =
    allSubjects.length;

const totalCredits: number =
    allSubjects.reduce(
        (
            accumulatedCredits:
                number,
            subject:
                Subject,
        ): number =>
            accumulatedCredits +
            subject.credits,
        0,
    );

const isRecord = (
    value: unknown,
): value is Record<
    string,
    unknown
> => {
    return (
        typeof value ===
        "object" &&
        value !== null &&
        !Array.isArray(
            value,
        )
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

const getSubjectStatuses = (
    academicData: Record<
        string,
        unknown
    >,
): Record<
    string,
    SubjectStatus
> => {
    const storedStatuses =
        academicData[
        SUBJECT_STATUSES_KEY
        ];

    if (
        !isRecord(
            storedStatuses,
        )
    ) {
        return {};
    }

    const subjectStatuses:
        Record<
            string,
            SubjectStatus
        > = {};

    for (
        const [
            subjectCode,
            storedStatus,
        ]
        of Object.entries(
            storedStatuses,
        )
    ) {
        if (
            isSubjectStatus(
                storedStatus,
            )
        ) {
            subjectStatuses[
                subjectCode
            ] =
                storedStatus;
        }
    }

    return subjectStatuses;
};

const getBearerToken = (
    request: Request,
): string | null => {
    const authorizationHeader =
        request.headers.get(
            "authorization",
        );

    if (
        !authorizationHeader
    ) {
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
        ALLOWED_ORIGINS.has(
            origin,
        )
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
        getCorsHeaders(
            request,
        );

    headers.set(
        "Content-Type",
        "application/json; charset=utf-8",
    );

    return new Response(
        JSON.stringify(
            body,
        ),
        {
            status,
            headers,
        },
    );
};

const handleGetRequest =
    async (
        request: Request,
    ): Promise<Response> => {
        const supabaseUrl =
            process.env
                .SUPABASE_URL;

        const supabasePublishableKey =
            process.env
                .SUPABASE_PUBLISHABLE_KEY;

        if (
            !supabaseUrl ||
            !supabasePublishableKey
        ) {
            console.error(
                "[Alexa progress API] Faltan las variables SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.",
            );

            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "El servicio no está configurado correctamente.",
                },
                500,
            );
        }

        const accessToken =
            getBearerToken(
                request,
            );

        if (!accessToken) {
            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "Se requiere autenticación.",
                },
                401,
            );
        }

        const supabase =
            createClient(
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
            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "La sesión no es válida o ha vencido.",
                },
                401,
            );
        }

        const {
            data: snapshotData,
            error: snapshotError,
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
                    userData.user.id,
                )
                .maybeSingle<
                    AcademicSnapshotRow
                >();

        if (snapshotError) {
            console.error(
                "[Alexa progress API] No fue posible consultar academic_snapshots.",
                snapshotError,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "No fue posible consultar la información académica.",
                },
                500,
            );
        }

        if (!snapshotData) {
            return createJsonResponse(
                request,
                {
                    ok: true,

                    snapshotExists:
                        false,

                    progress: {
                        approvedSubjects:
                            0,

                        inProgressSubjects:
                            0,

                        pendingSubjects:
                            totalSubjects,

                        totalSubjects,

                        approvedCredits:
                            0,

                        remainingCredits:
                            totalCredits,

                        totalCredits,

                        percentage:
                            0,
                    },
                },
                200,
            );
        }

        if (
            !isRecord(
                snapshotData
                    .academic_data,
            )
        ) {
            console.error(
                "[Alexa progress API] academic_data no contiene un objeto válido.",
            );

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

        const subjectStatuses =
            getSubjectStatuses(
                snapshotData
                    .academic_data,
            );

        const approvedSubjects:
            Subject[] =
            allSubjects.filter(
                (
                    subject:
                        Subject,
                ): boolean =>
                    subjectStatuses[
                    subject.code
                    ] ===
                    "approved",
            );

        const inProgressSubjects:
            Subject[] =
            allSubjects.filter(
                (
                    subject:
                        Subject,
                ): boolean =>
                    subjectStatuses[
                    subject.code
                    ] ===
                    "in-progress",
            );

        const pendingSubjects:
            Subject[] =
            allSubjects.filter(
                (
                    subject:
                        Subject,
                ): boolean => {
                    const status:
                        SubjectStatus =
                        subjectStatuses[
                        subject.code
                        ] ??
                        "pending";

                    return (
                        status ===
                        "pending"
                    );
                },
            );

        const approvedCredits:
            number =
            approvedSubjects.reduce(
                (
                    accumulatedCredits:
                        number,
                    subject:
                        Subject,
                ): number =>
                    accumulatedCredits +
                    subject.credits,
                0,
            );

        const remainingCredits =
            Math.max(
                totalCredits -
                approvedCredits,
                0,
            );

        const percentage =
            totalCredits === 0
                ? 0
                : Math.round(
                    (
                        approvedCredits /
                        totalCredits
                    ) *
                    100,
                );

        return createJsonResponse(
            request,
            {
                ok: true,

                snapshotExists:
                    true,

                snapshot: {
                    schemaVersion:
                        snapshotData
                            .schema_version,

                    updatedAt:
                        snapshotData
                            .updated_at,
                },

                progress: {
                    approvedSubjects:
                        approvedSubjects.length,

                    inProgressSubjects:
                        inProgressSubjects.length,

                    inProgressSubjectDetails:
                        inProgressSubjects.map(
                            (
                                subject:
                                    Subject,
                            ) => ({
                                code:
                                    subject.code,

                                name:
                                    subject.name,

                                credits:
                                    subject.credits,
                            }),
                        ),

                    pendingSubjects:
                        pendingSubjects.length,

                    totalSubjects,

                    approvedCredits,

                    remainingCredits,

                    totalCredits,

                    percentage,
                },
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
            request.method !==
            "GET"
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "Método no permitido.",
                },
                405,
            );
        }

        return handleGetRequest(
            request,
        );
    },
};