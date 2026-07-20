/* eslint-disable no-useless-assignment */
import {
    createClient,
    type SupabaseClient,
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
    GradeActivity,
    GradeCutId,
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

interface GradeUpdateRequestBody {
    action?: unknown;
    subject?: unknown;
    cut?: unknown;
    grade?: unknown;
    activity?: unknown;
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

const CUT_LABELS: Record<
    GradeCutId,
    string
> = {
    first: "Corte 1",
    second: "Corte 2",
    third: "Corte 3",
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

const normalizeText = (
    value: string,
): string => {
    return value
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            " ",
        )
        .replace(
            /\s+/g,
            " ",
        )
        .trim();
};

const normalizeCode = (
    value: string | undefined,
): string => {
    return (value ?? "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .trim();
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
    academicData: Record<string, unknown>,
): Record<string, SubjectStatus> => {
    const storedStatuses =
        academicData[
        SUBJECT_STATUSES_KEY
        ];

    if (!isRecord(storedStatuses)) {
        return {};
    }

    const subjectStatuses:
        Record<string, SubjectStatus> = {};

    for (
        const [
            subjectCode,
            storedStatus,
        ] of Object.entries(
            storedStatuses,
        )
    ) {
        if (isSubjectStatus(storedStatus)) {
            subjectStatuses[subjectCode] =
                storedStatus;
        }
    }

    return subjectStatuses;
};

const getStudentSchedule = (
    academicData: Record<string, unknown>,
): ParsedSchedule => {
    const storedSchedule =
        academicData[
        STUDENT_SCHEDULE_KEY
        ];

    if (!isRecord(storedSchedule)) {
        return {
            classes: [],
            isConfirmed: false,
        };
    }

    const storedClasses =
        Array.isArray(
            storedSchedule.classes,
        )
            ? storedSchedule.classes
            : [];

    const classes: ScheduleClass[] =
        storedClasses
            .filter(
                (
                    value,
                ): value is Record<
                    string,
                    unknown
                > => isRecord(value),
            )
            .filter(
                (value): boolean =>
                    typeof value.subjectName ===
                    "string" &&
                    value.subjectName.trim() !==
                    "",
            )
            .map(
                (
                    value,
                    index,
                ): ScheduleClass => ({
                    id:
                        typeof value.id ===
                            "string"
                            ? value.id
                            : `alexa-grade-class-${index}`,

                    subjectName:
                        String(
                            value.subjectName,
                        ).trim(),

                    subjectCode:
                        typeof value.subjectCode ===
                            "string"
                            ? value.subjectCode.trim()
                            : undefined,

                    day:
                        value.day === "monday" ||
                            value.day === "tuesday" ||
                            value.day === "wednesday" ||
                            value.day === "thursday" ||
                            value.day === "friday"
                            ? value.day
                            : "monday",

                    startTime:
                        typeof value.startTime ===
                            "string"
                            ? value.startTime
                            : "00:00",

                    endTime:
                        typeof value.endTime ===
                            "string"
                            ? value.endTime
                            : "00:00",
                }),
            );

    return {
        classes,
        isConfirmed:
            storedSchedule.isConfirmed ===
            true,
    };
};

const getGradeRecords = (
    academicData: Record<string, unknown>,
): StudentGradeRecords => {
    const storedGradeRecords =
        academicData[
        SUBJECT_GRADE_RECORDS_KEY
        ];

    if (!isRecord(storedGradeRecords)) {
        return {};
    }

    const gradeRecords:
        StudentGradeRecords = {};

    for (
        const [
            subjectCode,
            storedRecord,
        ] of Object.entries(
            storedGradeRecords,
        )
    ) {
        if (isRecord(storedRecord)) {
            gradeRecords[subjectCode] =
                storedRecord as unknown as
                SubjectGradeRecord;
        }
    }

    return gradeRecords;
};

const getEnrolledSubjects = (
    subjectStatuses:
        Record<string, SubjectStatus>,
    schedule: ParsedSchedule,
): EnrolledSubject[] => {
    const confirmedScheduleCodes =
        new Set<string>();

    const confirmedScheduleNames =
        new Set<string>();

    if (schedule.isConfirmed) {
        for (
            const scheduleClass
            of schedule.classes
        ) {
            const normalizedCode =
                normalizeCode(
                    scheduleClass.subjectCode,
                );

            if (normalizedCode !== "") {
                confirmedScheduleCodes.add(
                    normalizedCode,
                );
            }

            const normalizedName =
                normalizeText(
                    scheduleClass.subjectName,
                );

            if (normalizedName !== "") {
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
                        subject: Subject,
                    ): EnrolledSubject => ({
                        code: subject.code,
                        name: subject.name,
                        credits:
                            subject.credits,
                        semester:
                            section.semester ??
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
                    ] === "in-progress";

                const isInConfirmedSchedule =
                    schedule.isConfirmed &&
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
                firstSubject,
                secondSubject,
            ): number => {
                const firstSemester =
                    firstSubject.semester ??
                    99;

                const secondSemester =
                    secondSubject.semester ??
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

                return firstSubject.name
                    .localeCompare(
                        secondSubject.name,
                        "es",
                    );
            },
        );
};

const cloneSubjectGradeRecord = (
    record: SubjectGradeRecord,
): SubjectGradeRecord => {
    const cloneActivities = (
        activities: GradeActivity[],
    ): GradeActivity[] => {
        return activities.map(
            (activity) => ({
                ...activity,
            }),
        );
    };

    return {
        ...record,
        cuts: {
            first: {
                activities:
                    cloneActivities(
                        record.cuts.first
                            .activities,
                    ),
            },
            second: {
                activities:
                    cloneActivities(
                        record.cuts.second
                            .activities,
                    ),
            },
            third: {
                activities:
                    cloneActivities(
                        record.cuts.third
                            .activities,
                    ),
            },
        },
    };
};

const getCutGrade = (
    calculation:
        ReturnType<
            typeof calculateSubjectGrade
        >,
    cutId: GradeCutId,
): number | null => {
    if (cutId === "first") {
        return calculation.firstCutGrade;
    }

    if (cutId === "second") {
        return calculation.secondCutGrade;
    }

    return calculation.thirdCutGrade;
};

const getCutFinalShare = (
    record: SubjectGradeRecord,
    cutId: GradeCutId,
): number => {
    if (cutId === "first") {
        return (
            record.firstCutShare *
            0.7
        );
    }

    if (cutId === "second") {
        return (
            record.secondCutShare *
            0.7
        );
    }

    return 30;
};

const createSubjectDetail = (
    subject: EnrolledSubject,
    record: SubjectGradeRecord,
) => {
    const calculation =
        calculateSubjectGrade(
            record,
        );

    const hasGrades =
        hasRegisteredGrades(
            record,
        );

    const createCutDetail = (
        cutId: GradeCutId,
    ) => ({
        id: cutId,
        label: CUT_LABELS[cutId],
        finalShare:
            getCutFinalShare(
                record,
                cutId,
            ),
        grade:
            getCutGrade(
                calculation,
                cutId,
            ),
        activities:
            record.cuts[
                cutId
            ].activities.map(
                (activity) => ({
                    id: activity.id,
                    name: activity.name,
                    percentage:
                        activity.percentage,
                    grade: activity.grade,
                }),
            ),
    });

    const officialGrade =
        calculation.isComplete
            ? calculation.officialOneDecimal
            : null;

    return {
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
        semester: subject.semester,
        sectionTitle:
            subject.sectionTitle,
        hasGrades,
        isComplete:
            calculation.isComplete,
        status:
            !hasGrades
                ? "without-grades"
                : calculation.isComplete
                    ? "complete"
                    : "partial",
        cuts: {
            first:
                createCutDetail(
                    "first",
                ),
            second:
                createCutDetail(
                    "second",
                ),
            third:
                createCutDetail(
                    "third",
                ),
        },
        accumulatedGrade:
            calculation.accumulatedTwoDecimals,
        approximatedGrade:
            calculation.officialOneDecimal,
        officialGrade,
        approved:
            officialGrade !== null
                ? officialGrade >= 3
                : null,
    };
};

const findSubjectMatches = (
    requestedSubject: string,
    subjects: EnrolledSubject[],
): EnrolledSubject[] => {
    const normalizedRequestedText =
        normalizeText(
            requestedSubject,
        );

    const normalizedRequestedCode =
        normalizeCode(
            requestedSubject,
        );

    const exactMatches =
        subjects.filter(
            (subject) =>
                normalizeCode(
                    subject.code,
                ) ===
                normalizedRequestedCode ||
                normalizeText(
                    subject.name,
                ) ===
                normalizedRequestedText,
        );

    if (exactMatches.length > 0) {
        return exactMatches;
    }

    return subjects.filter(
        (subject) => {
            const normalizedName =
                normalizeText(
                    subject.name,
                );

            const normalizedCode =
                normalizeCode(
                    subject.code,
                );

            return (
                normalizedName.includes(
                    normalizedRequestedText,
                ) ||
                normalizedRequestedText.includes(
                    normalizedName,
                ) ||
                normalizedCode.includes(
                    normalizedRequestedCode,
                )
            );
        },
    );
};

const parseCutId = (
    value: unknown,
): GradeCutId | null => {
    if (typeof value !== "string") {
        return null;
    }

    const normalized =
        normalizeText(value);

    if (
        normalized === "first" ||
        normalized === "1" ||
        normalized === "uno" ||
        normalized === "primer" ||
        normalized === "primero" ||
        normalized === "primer corte" ||
        normalized === "corte uno" ||
        normalized === "corte 1"
    ) {
        return "first";
    }

    if (
        normalized === "second" ||
        normalized === "2" ||
        normalized === "dos" ||
        normalized === "segundo" ||
        normalized === "segundo corte" ||
        normalized === "corte dos" ||
        normalized === "corte 2"
    ) {
        return "second";
    }

    if (
        normalized === "third" ||
        normalized === "3" ||
        normalized === "tres" ||
        normalized === "tercer" ||
        normalized === "tercero" ||
        normalized === "tercer corte" ||
        normalized === "corte tres" ||
        normalized === "corte 3" ||
        normalized === "final"
    ) {
        return "third";
    }

    return null;
};

const parseGrade = (
    value: unknown,
): number | null => {
    const parsedValue =
        typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(
                    value.replace(
                        ",",
                        ".",
                    ),
                )
                : Number.NaN;

    if (
        !Number.isFinite(
            parsedValue,
        ) ||
        parsedValue < 0 ||
        parsedValue > 5
    ) {
        return null;
    }

    return Math.round(
        (
            parsedValue +
            Number.EPSILON
        ) * 10,
    ) / 10;
};

const findActivity = (
    requestedActivity: string,
    activities: GradeActivity[],
): GradeActivity[] => {
    const normalizedRequested =
        normalizeText(
            requestedActivity,
        );

    const exactMatches =
        activities.filter(
            (activity) =>
                normalizeText(
                    activity.name,
                ) ===
                normalizedRequested,
        );

    if (exactMatches.length > 0) {
        return exactMatches;
    }

    return activities.filter(
        (activity) => {
            const normalizedName =
                normalizeText(
                    activity.name,
                );

            return (
                normalizedName.includes(
                    normalizedRequested,
                ) ||
                normalizedRequested.includes(
                    normalizedName,
                )
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
                "GET, POST, OPTIONS",
            "Cache-Control":
                "no-store",
            Vary: "Origin",
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
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
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
    ): Promise<AuthenticationContext> => {
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
                "[Alexa grades API] Faltan las variables de Supabase.",
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
        snapshot: AcademicSnapshotRow | null;
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
            snapshot: data,
            error,
        };
    };

const buildGradesResponse = (
    academicData:
        Record<string, unknown>,
    requestedSubject:
        string | null,
) => {
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

    const subjectDetails =
        enrolledSubjects.map(
            (subject) => {
                const record =
                    normalizeSubjectGradeRecord(
                        subject.code,
                        gradeRecords[
                        subject.code
                        ],
                    );

                return createSubjectDetail(
                    subject,
                    record,
                );
            },
        );

    const completedSubjectDetails =
        subjectDetails.filter(
            (subject) =>
                subject.isComplete &&
                typeof subject
                    .officialGrade ===
                "number",
        );

    const completedCredits =
        completedSubjectDetails.reduce(
            (total, subject) =>
                total +
                subject.credits,
            0,
        );

    const semesterAverage =
        completedCredits === 0
            ? null
            : roundGradeToOfficialTenth(
                completedSubjectDetails.reduce(
                    (
                        total,
                        subject,
                    ) =>
                        total +
                        (
                            subject.officialGrade ??
                            0
                        ) *
                        subject.credits,
                    0,
                ) /
                completedCredits,
            );

    const requestedMatches =
        requestedSubject
            ? findSubjectMatches(
                requestedSubject,
                enrolledSubjects,
            )
            : [];

    return {
        grades: {
            enrolledSubjects:
                enrolledSubjects.length,
            subjectsWithGrades:
                subjectDetails.filter(
                    (subject) =>
                        subject.hasGrades,
                ).length,
            completedSubjects:
                completedSubjectDetails.length,
            partialSubjects:
                subjectDetails.filter(
                    (subject) =>
                        subject.status ===
                        "partial",
                ).length,
            completedCredits,
            subjectsAtOrAboveThree:
                completedSubjectDetails.filter(
                    (subject) =>
                        (
                            subject.officialGrade ??
                            0
                        ) >= 3,
                ).length,
            semesterAverage,
            completedSubjectDetails,
            subjectDetails,
        },
        requestedSubject:
            requestedSubject
                ? {
                    query:
                        requestedSubject,
                    matches:
                        requestedMatches.map(
                            (subject) =>
                                subjectDetails.find(
                                    (detail) =>
                                        detail.code ===
                                        subject.code,
                                ),
                        ).filter(
                            Boolean,
                        ),
                }
                : null,
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

        if (!authContext.ok) {
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
                "[Alexa grades API] Error consultando academic_snapshots.",
                error,
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

        const url =
            new URL(request.url);

        const requestedSubject =
            url.searchParams
                .get("subject")
                ?.trim() ||
            null;

        if (!snapshot) {
            return createJsonResponse(
                request,
                {
                    ok: true,
                    snapshotExists:
                        false,
                    grades: {
                        enrolledSubjects: 0,
                        subjectsWithGrades: 0,
                        completedSubjects: 0,
                        partialSubjects: 0,
                        completedCredits: 0,
                        subjectsAtOrAboveThree: 0,
                        semesterAverage: null,
                        completedSubjectDetails: [],
                        subjectDetails: [],
                    },
                    requestedSubject:
                        requestedSubject
                            ? {
                                query:
                                    requestedSubject,
                                matches: [],
                            }
                            : null,
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

        const responseData =
            buildGradesResponse(
                snapshot.academic_data,
                requestedSubject,
            );

        return createJsonResponse(
            request,
            {
                ok: true,
                snapshotExists: true,
                snapshot: {
                    schemaVersion:
                        snapshot.schema_version,
                    updatedAt:
                        snapshot.updated_at,
                },
                ...responseData,
            },
            200,
        );
    };

const handlePostRequest =
    async (
        request: Request,
    ): Promise<Response> => {
        const authContext =
            await getAuthenticatedContext(
                request,
            );

        if (!authContext.ok) {
            return authContext
                .errorResponse;
        }

        let body:
            GradeUpdateRequestBody;

        try {
            body =
                await request.json() as
                GradeUpdateRequestBody;
        } catch {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "El cuerpo de la solicitud no contiene un JSON válido.",
                },
                400,
            );
        }

        if (
            body.action !==
            "set-grade"
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "La acción solicitada no es válida.",
                },
                400,
            );
        }

        const requestedSubject =
            typeof body.subject ===
                "string"
                ? body.subject.trim()
                : "";

        const cutId =
            parseCutId(body.cut);

        const grade =
            parseGrade(body.grade);

        const requestedActivity =
            typeof body.activity ===
                "string"
                ? body.activity.trim()
                : "";

        if (requestedSubject === "") {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "subject_required",
                    error:
                        "Debes indicar la materia.",
                },
                400,
            );
        }

        if (!cutId) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "cut_required",
                    error:
                        "Debes indicar el corte uno, dos o tres.",
                },
                400,
            );
        }

        if (grade === null) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "invalid_grade",
                    error:
                        "La nota debe estar entre cero punto cero y cinco punto cero.",
                },
                400,
            );
        }

        const {
            snapshot,
            error: snapshotError,
        } =
            await getSnapshot(
                authContext.supabase,
                authContext.userId,
            );

        if (snapshotError) {
            console.error(
                "[Alexa grades API] Error consultando el snapshot antes de guardar.",
                snapshotError,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "No fue posible consultar la información académica antes de guardar la nota.",
                },
                500,
            );
        }

        if (
            !snapshot ||
            !isRecord(
                snapshot.academic_data,
            )
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "snapshot_not_found",
                    error:
                        "Todavía no existe información académica sincronizada para esta cuenta.",
                },
                404,
            );
        }

        const academicData =
            snapshot.academic_data;

        const subjectStatuses =
            getSubjectStatuses(
                academicData,
            );

        const schedule =
            getStudentSchedule(
                academicData,
            );

        const enrolledSubjects =
            getEnrolledSubjects(
                subjectStatuses,
                schedule,
            );

        const subjectMatches =
            findSubjectMatches(
                requestedSubject,
                enrolledSubjects,
            );

        if (
            subjectMatches.length ===
            0
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "subject_not_found",
                    error:
                        "No encontré esa materia entre las materias matriculadas.",
                    enrolledSubjects:
                        enrolledSubjects.map(
                            (subject) => ({
                                code:
                                    subject.code,
                                name:
                                    subject.name,
                            }),
                        ),
                },
                404,
            );
        }

        if (
            subjectMatches.length >
            1
        ) {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "ambiguous_subject",
                    error:
                        "Encontré más de una materia que coincide con la consulta.",
                    matches:
                        subjectMatches.map(
                            (subject) => ({
                                code:
                                    subject.code,
                                name:
                                    subject.name,
                            }),
                        ),
                },
                409,
            );
        }

        const subject =
            subjectMatches[0];

        const gradeRecords =
            getGradeRecords(
                academicData,
            );

        const currentRecord =
            normalizeSubjectGradeRecord(
                subject.code,
                gradeRecords[
                subject.code
                ],
            );

        const nextRecord =
            cloneSubjectGradeRecord(
                currentRecord,
            );

        const cutActivities =
            nextRecord.cuts[
                cutId
            ].activities;

        let selectedActivity:
            GradeActivity | null =
            null;

        if (
            requestedActivity !==
            ""
        ) {
            const activityMatches =
                findActivity(
                    requestedActivity,
                    cutActivities,
                );

            if (
                activityMatches.length ===
                0
            ) {
                return createJsonResponse(
                    request,
                    {
                        ok: false,
                        code:
                            "activity_not_found",
                        error:
                            "No encontré esa actividad en el corte indicado.",
                        subject: {
                            code:
                                subject.code,
                            name:
                                subject.name,
                        },
                        cut: {
                            id: cutId,
                            label:
                                CUT_LABELS[
                                cutId
                                ],
                            activities:
                                cutActivities.map(
                                    (activity) => ({
                                        id:
                                            activity.id,
                                        name:
                                            activity.name,
                                        percentage:
                                            activity.percentage,
                                        grade:
                                            activity.grade,
                                    }),
                                ),
                        },
                    },
                    404,
                );
            }

            if (
                activityMatches.length >
                1
            ) {
                return createJsonResponse(
                    request,
                    {
                        ok: false,
                        code:
                            "ambiguous_activity",
                        error:
                            "Encontré más de una actividad que coincide con la consulta.",
                        activities:
                            activityMatches.map(
                                (activity) => ({
                                    id:
                                        activity.id,
                                    name:
                                        activity.name,
                                }),
                            ),
                    },
                    409,
                );
            }

            selectedActivity =
                activityMatches[0];
        } else if (
            cutActivities.length ===
            1
        ) {
            selectedActivity =
                cutActivities[0];
        } else {
            return createJsonResponse(
                request,
                {
                    ok: false,
                    code:
                        "activity_required",
                    error:
                        "Ese corte tiene varias actividades. Debes indicar en cuál deseas registrar la nota.",
                    subject: {
                        code:
                            subject.code,
                        name:
                            subject.name,
                    },
                    cut: {
                        id: cutId,
                        label:
                            CUT_LABELS[
                            cutId
                            ],
                        activities:
                            cutActivities.map(
                                (activity) => ({
                                    id:
                                        activity.id,
                                    name:
                                        activity.name,
                                    percentage:
                                        activity.percentage,
                                    grade:
                                        activity.grade,
                                }),
                            ),
                    },
                },
                409,
            );
        }

        selectedActivity.grade =
            grade;

        nextRecord.updatedAt =
            new Date().toISOString();

        const nextGradeRecords:
            StudentGradeRecords = {
            ...gradeRecords,
            [subject.code]:
                nextRecord,
        };

        const nextAcademicData:
            Record<string, unknown> = {
            ...academicData,
            [SUBJECT_GRADE_RECORDS_KEY]:
                nextGradeRecords,
        };

        const updatedAt =
            new Date().toISOString();

        const {
            error: saveError,
        } =
            await authContext.supabase
                .from(
                    "academic_snapshots",
                )
                .upsert(
                    {
                        user_id:
                            authContext.userId,
                        academic_data:
                            nextAcademicData,
                        schema_version:
                            snapshot.schema_version ??
                            1,
                        updated_at:
                            updatedAt,
                    },
                    {
                        onConflict:
                            "user_id",
                    },
                );

        if (saveError) {
            console.error(
                "[Alexa grades API] No fue posible guardar la nota.",
                saveError,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,
                    error:
                        "No fue posible guardar la nota.",
                },
                500,
            );
        }

        const updatedSubjectDetail =
            createSubjectDetail(
                subject,
                nextRecord,
            );

        return createJsonResponse(
            request,
            {
                ok: true,
                message:
                    "La nota fue registrada correctamente.",
                updatedAt,
                update: {
                    subject: {
                        code:
                            subject.code,
                        name:
                            subject.name,
                    },
                    cut: {
                        id: cutId,
                        label:
                            CUT_LABELS[
                            cutId
                            ],
                    },
                    activity: {
                        id:
                            selectedActivity.id,
                        name:
                            selectedActivity.name,
                        percentage:
                            selectedActivity.percentage,
                        grade:
                            selectedActivity.grade,
                    },
                    subjectDetail:
                        updatedSubjectDetail,
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
            request.method ===
            "GET"
        ) {
            return handleGetRequest(
                request,
            );
        }

        if (
            request.method ===
            "POST"
        ) {
            return handlePostRequest(
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
