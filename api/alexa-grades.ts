import {
    createClient,
} from "@supabase/supabase-js";

import {
    curriculum,
} from "../src/data/curriculum.js";

import {
    normalizeSubjectGradeRecord,
} from "../src/data/defaultGrades.js";

import {
    calculateSubjectGrade,
    hasRegisteredGrades,
    roundGradeToOfficialTenth,
} from "../src/utils/gradeCalculations.js";

import type {
    CurriculumSection,
    Subject,
    SubjectStatus,
} from "../src/types/curriculum.js";

import type {
    StudentGradeRecords,
    SubjectGradeRecord,
} from "../src/types/grades.js";

import type {
    ScheduleClass,
} from "../src/types/schedule.js";

interface AcademicSnapshotRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

interface ParsedSchedule {
    classes: ScheduleClass[];
    isConfirmed: boolean;
}

interface EnrolledSubject {
    code: string;
    name: string;
    credits: number;
    semester: number | null;
    sectionTitle: string;
}

const SUBJECT_STATUSES_KEY =
    "pensum-subject-statuses";

const STUDENT_SCHEDULE_KEY =
    "pensum-student-schedule";

const SUBJECT_GRADE_RECORDS_KEY =
    "pensum-subject-grade-records";

const ALLOWED_ORIGINS =
    new Set<string>([
        "http://localhost:5173",
        "https://pensum-unicauca.vercel.app",
    ]);

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

const normalizeText = (
    value: string,
): string => {
    return value
        .normalize(
            "NFD",
        )
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLowerCase()
        .trim();
};

const normalizeCode = (
    value:
        string | undefined,
): string => {
    return (
        value ??
        ""
    )
        .replace(
            /\s+/g,
            "",
        )
        .toUpperCase()
        .trim();
};

const isSubjectStatus = (
    value: unknown,
): value is SubjectStatus => {
    return (
        value ===
        "pending" ||
        value ===
        "in-progress" ||
        value ===
        "approved"
    );
};

const getSubjectStatuses = (
    academicData:
        Record<
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
        ] of Object.entries(
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

const getStudentSchedule = (
    academicData:
        Record<
            string,
            unknown
        >,
): ParsedSchedule => {
    const storedSchedule =
        academicData[
        STUDENT_SCHEDULE_KEY
        ];

    if (
        !isRecord(
            storedSchedule,
        )
    ) {
        return {
            classes: [],
            isConfirmed:
                false,
        };
    }

    const storedClasses =
        Array.isArray(
            storedSchedule
                .classes,
        )
            ? storedSchedule
                .classes
            : [];

    const classes:
        ScheduleClass[] =
        storedClasses
            .filter(
                (
                    value,
                ): value is Record<
                    string,
                    unknown
                > =>
                    isRecord(
                        value,
                    ),
            )
            .filter(
                (
                    value,
                ): boolean =>
                    typeof value
                        .subjectName ===
                    "string" &&
                    value
                        .subjectName
                        .trim() !==
                    "",
            )
            .map(
                (
                    value,
                    index,
                ): ScheduleClass => ({
                    id:
                        typeof value
                            .id ===
                            "string"
                            ? value.id
                            : `alexa-grade-class-${index}`,

                    subjectName:
                        String(
                            value
                                .subjectName,
                        ).trim(),

                    subjectCode:
                        typeof value
                            .subjectCode ===
                            "string"
                            ? value
                                .subjectCode
                                .trim()
                            : undefined,

                    day:
                        value.day ===
                            "monday" ||
                            value.day ===
                            "tuesday" ||
                            value.day ===
                            "wednesday" ||
                            value.day ===
                            "thursday" ||
                            value.day ===
                            "friday"
                            ? value.day
                            : "monday",

                    startTime:
                        typeof value
                            .startTime ===
                            "string"
                            ? value
                                .startTime
                            : "00:00",

                    endTime:
                        typeof value
                            .endTime ===
                            "string"
                            ? value
                                .endTime
                            : "00:00",
                }),
            );

    return {
        classes,

        isConfirmed:
            storedSchedule
                .isConfirmed ===
            true,
    };
};

const getGradeRecords = (
    academicData:
        Record<
            string,
            unknown
        >,
): StudentGradeRecords => {
    const storedGradeRecords =
        academicData[
        SUBJECT_GRADE_RECORDS_KEY
        ];

    if (
        !isRecord(
            storedGradeRecords,
        )
    ) {
        return {};
    }

    const gradeRecords:
        StudentGradeRecords =
        {};

    for (
        const [
            subjectCode,
            storedRecord,
        ] of Object.entries(
            storedGradeRecords,
        )
    ) {
        if (
            isRecord(
                storedRecord,
            )
        ) {
            gradeRecords[
                subjectCode
            ] =
                storedRecord as unknown as
                SubjectGradeRecord;
        }
    }

    return gradeRecords;
};

const getEnrolledSubjects = (
    subjectStatuses:
        Record<
            string,
            SubjectStatus
        >,
    schedule:
        ParsedSchedule,
): EnrolledSubject[] => {
    const confirmedScheduleCodes =
        new Set<string>();

    const confirmedScheduleNames =
        new Set<string>();

    if (
        schedule.isConfirmed
    ) {
        for (
            const scheduleClass
            of schedule.classes
        ) {
            const normalizedCode =
                normalizeCode(
                    scheduleClass
                        .subjectCode,
                );

            if (
                normalizedCode !==
                ""
            ) {
                confirmedScheduleCodes.add(
                    normalizedCode,
                );
            }

            const normalizedName =
                normalizeText(
                    scheduleClass
                        .subjectName,
                );

            if (
                normalizedName !==
                ""
            ) {
                confirmedScheduleNames.add(
                    normalizedName,
                );
            }
        }
    }

    return curriculum
        .flatMap(
            (
                section:
                    CurriculumSection,
            ): EnrolledSubject[] =>
                section.subjects.map(
                    (
                        subject:
                            Subject,
                    ): EnrolledSubject => ({
                        code:
                            subject.code,

                        name:
                            subject.name,

                        credits:
                            subject.credits,

                        semester:
                            section
                                .semester ??
                            null,

                        sectionTitle:
                            section.title,
                    }),
                ),
        )
        .filter(
            (
                subject:
                    EnrolledSubject,
            ): boolean => {
                const isInProgress =
                    subjectStatuses[
                    subject.code
                    ] ===
                    "in-progress";

                const isInConfirmedSchedule =
                    schedule
                        .isConfirmed &&
                    (
                        confirmedScheduleCodes.has(
                            normalizeCode(
                                subject.code,
                            ),
                        ) ||
                        confirmedScheduleNames.has(
                            normalizeText(
                                subject.name,
                            ),
                        )
                    );

                return (
                    isInProgress ||
                    isInConfirmedSchedule
                );
            },
        )
        .sort(
            (
                firstSubject:
                    EnrolledSubject,
                secondSubject:
                    EnrolledSubject,
            ): number => {
                const firstSemester =
                    firstSubject
                        .semester ??
                    99;

                const secondSemester =
                    secondSubject
                        .semester ??
                    99;

                if (
                    firstSemester !==
                    secondSemester
                ) {
                    return (
                        firstSemester -
                        secondSemester
                    );
                }

                return firstSubject
                    .name
                    .localeCompare(
                        secondSubject
                            .name,
                        "es",
                    );
            },
        );
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
                "[Alexa grades API] Faltan las variables de Supabase.",
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
                "[Alexa grades API] Error consultando academic_snapshots.",
                snapshotError,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "No fue posible consultar las notas académicas.",
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

                    grades: {
                        enrolledSubjects:
                            0,

                        subjectsWithGrades:
                            0,

                        completedSubjects:
                            0,

                        partialSubjects:
                            0,

                        completedCredits:
                            0,

                        subjectsAtOrAboveThree:
                            0,

                        semesterAverage:
                            null,

                        completedSubjectDetails:
                            [],
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

        const academicData =
            snapshotData
                .academic_data;

        const subjectStatuses =
            getSubjectStatuses(
                academicData,
            );

        const schedule =
            getStudentSchedule(
                academicData,
            );

        const gradeRecords =
            getGradeRecords(
                academicData,
            );

        const enrolledSubjects =
            getEnrolledSubjects(
                subjectStatuses,
                schedule,
            );

        const subjectRows =
            enrolledSubjects.map(
                (
                    subject:
                        EnrolledSubject,
                ) => {
                    const record =
                        normalizeSubjectGradeRecord(
                            subject.code,
                            gradeRecords[
                            subject.code
                            ],
                        );

                    return {
                        subject,
                        record,

                        calculation:
                            calculateSubjectGrade(
                                record,
                            ),
                    };
                },
            );

        const subjectsWithGrades =
            subjectRows.filter(
                ({
                    record,
                }): boolean =>
                    hasRegisteredGrades(
                        record,
                    ),
            ).length;

        const completedSubjectRows =
            subjectRows.filter(
                ({
                    calculation,
                }): boolean =>
                    calculation
                        .isComplete &&
                    typeof calculation
                        .officialOneDecimal ===
                    "number" &&
                    Number.isFinite(
                        calculation
                            .officialOneDecimal,
                    ),
            );

        const completedCredits =
            completedSubjectRows.reduce(
                (
                    total:
                        number,
                    {
                        subject,
                    },
                ): number =>
                    total +
                    subject.credits,
                0,
            );

        const semesterAverage =
            completedCredits ===
                0
                ? null
                : roundGradeToOfficialTenth(
                    completedSubjectRows.reduce(
                        (
                            total:
                                number,
                            {
                                subject,
                                calculation,
                            },
                        ): number =>
                            total +
                            (
                                calculation
                                    .officialOneDecimal ??
                                0
                            ) *
                            subject
                                .credits,
                        0,
                    ) /
                    completedCredits,
                );

        const subjectsAtOrAboveThree =
            completedSubjectRows.filter(
                ({
                    calculation,
                }): boolean =>
                    (
                        calculation
                            .officialOneDecimal ??
                        0
                    ) >=
                    3,
            ).length;

        const completedSubjectDetails =
            completedSubjectRows.map(
                ({
                    subject,
                    calculation,
                }) => ({
                    code:
                        subject.code,

                    name:
                        subject.name,

                    credits:
                        subject.credits,

                    officialGrade:
                        calculation
                            .officialOneDecimal,

                    approved:
                        (
                            calculation
                                .officialOneDecimal ??
                            0
                        ) >=
                        3,
                }),
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

                grades: {
                    enrolledSubjects:
                        enrolledSubjects
                            .length,

                    subjectsWithGrades,

                    completedSubjects:
                        completedSubjectRows
                            .length,

                    partialSubjects:
                        Math.max(
                            subjectsWithGrades -
                            completedSubjectRows
                                .length,
                            0,
                        ),

                    completedCredits,

                    subjectsAtOrAboveThree,

                    semesterAverage,

                    completedSubjectDetails,
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