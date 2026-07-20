import {
    createClient,
} from "@supabase/supabase-js";

import type {
    ScheduleClass,
    ScheduleDay,
} from "../src/types/schedule.js";

interface AcademicSnapshotRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

interface ParsedStudentSchedule {
    classes: ScheduleClass[];
    isConfirmed: boolean;
    confirmedAt: string | null;
}

const STUDENT_SCHEDULE_KEY =
    "pensum-student-schedule";

const BOGOTA_TIME_ZONE =
    "America/Bogota";

const ALLOWED_ORIGINS =
    new Set<string>([
        "http://localhost:5173",
        "https://pensum-unicauca.vercel.app",
    ]);

const WEEKDAY_KEYS:
    Record<
        string,
        ScheduleDay
    > = {
    monday:
        "monday",

    tuesday:
        "tuesday",

    wednesday:
        "wednesday",

    thursday:
        "thursday",

    friday:
        "friday",
};

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

const isScheduleDay = (
    value: unknown,
): value is ScheduleDay => {
    return (
        value === "monday" ||
        value === "tuesday" ||
        value === "wednesday" ||
        value === "thursday" ||
        value === "friday"
    );
};

const isScheduleTime = (
    value: unknown,
): value is string => {
    return (
        typeof value ===
        "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
            value,
        )
    );
};

const getOptionalString = (
    value: unknown,
): string | undefined => {
    if (
        typeof value !==
        "string"
    ) {
        return undefined;
    }

    const normalizedValue =
        value.trim();

    return normalizedValue ===
        ""
        ? undefined
        : normalizedValue;
};

const parseScheduleClass = (
    value: unknown,
): ScheduleClass | null => {
    if (
        !isRecord(
            value,
        )
    ) {
        return null;
    }

    if (
        typeof value.id !==
        "string" ||
        value.id.trim() ===
        "" ||
        typeof value.subjectName !==
        "string" ||
        value.subjectName.trim() ===
        "" ||
        !isScheduleDay(
            value.day,
        ) ||
        !isScheduleTime(
            value.startTime,
        ) ||
        !isScheduleTime(
            value.endTime,
        )
    ) {
        return null;
    }

    const scheduleClass:
        ScheduleClass = {
        id:
            value.id.trim(),

        subjectName:
            value.subjectName.trim(),

        day:
            value.day,

        startTime:
            value.startTime,

        endTime:
            value.endTime,
    };

    const subjectCode =
        getOptionalString(
            value.subjectCode,
        );

    const group =
        getOptionalString(
            value.group,
        );

    const teacher =
        getOptionalString(
            value.teacher,
        );

    const classroom =
        getOptionalString(
            value.classroom,
        );

    const source =
        value.source ===
            "manual" ||
            value.source ===
            "academic-offer"
            ? value.source
            : undefined;

    const offerGroupId =
        getOptionalString(
            value.offerGroupId,
        );

    if (subjectCode) {
        scheduleClass.subjectCode =
            subjectCode;
    }

    if (group) {
        scheduleClass.group =
            group;
    }

    if (teacher) {
        scheduleClass.teacher =
            teacher;
    }

    if (classroom) {
        scheduleClass.classroom =
            classroom;
    }

    if (source) {
        scheduleClass.source =
            source;
    }

    if (offerGroupId) {
        scheduleClass.offerGroupId =
            offerGroupId;
    }

    return scheduleClass;
};

const getStudentSchedule = (
    academicData:
        Record<
            string,
            unknown
        >,
): ParsedStudentSchedule => {
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
            isConfirmed: false,
            confirmedAt: null,
        };
    }

    const storedClasses =
        Array.isArray(
            storedSchedule.classes,
        )
            ? storedSchedule.classes
            : [];

    const classes:
        ScheduleClass[] =
        storedClasses
            .map(
                parseScheduleClass,
            )
            .filter(
                (
                    scheduleClass,
                ): scheduleClass is ScheduleClass =>
                    scheduleClass !==
                    null,
            );

    const confirmedAt =
        typeof storedSchedule
            .confirmedAt ===
            "string"
            ? storedSchedule
                .confirmedAt
            : null;

    return {
        classes,

        isConfirmed:
            storedSchedule
                .isConfirmed ===
            true,

        confirmedAt,
    };
};

const capitalizeFirstLetter = (
    value: string,
): string => {
    if (
        value.length ===
        0
    ) {
        return value;
    }

    return (
        value.charAt(
            0,
        ).toUpperCase() +
        value.slice(
            1,
        )
    );
};

const getCurrentDay = (
    currentDate: Date,
): ScheduleDay | null => {
    const weekday =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    BOGOTA_TIME_ZONE,

                weekday:
                    "long",
            },
        )
            .format(
                currentDate,
            )
            .toLowerCase();

    return (
        WEEKDAY_KEYS[
        weekday
        ] ??
        null
    );
};

const getCurrentDayLabel = (
    currentDate: Date,
): string => {
    const dayLabel =
        new Intl.DateTimeFormat(
            "es-CO",
            {
                timeZone:
                    BOGOTA_TIME_ZONE,

                weekday:
                    "long",
            },
        ).format(
            currentDate,
        );

    return capitalizeFirstLetter(
        dayLabel,
    );
};

const getCurrentDateLabel = (
    currentDate: Date,
): string => {
    const dateLabel =
        new Intl.DateTimeFormat(
            "es-CO",
            {
                timeZone:
                    BOGOTA_TIME_ZONE,

                weekday:
                    "long",

                day:
                    "numeric",

                month:
                    "long",
            },
        ).format(
            currentDate,
        );

    return capitalizeFirstLetter(
        dateLabel,
    );
};

const getCurrentTime = (
    currentDate: Date,
): string => {
    const formattedParts =
        new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone:
                    BOGOTA_TIME_ZONE,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23",
            },
        ).formatToParts(
            currentDate,
        );

    const hour =
        formattedParts.find(
            (part) =>
                part.type ===
                "hour",
        )?.value ??
        "00";

    const minute =
        formattedParts.find(
            (part) =>
                part.type ===
                "minute",
        )?.value ??
        "00";

    return `${hour}:${minute}`;
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
                "[Alexa schedule API] Faltan las variables SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.",
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
                "[Alexa schedule API] No fue posible consultar academic_snapshots.",
                snapshotError,
            );

            return createJsonResponse(
                request,
                {
                    ok: false,

                    error:
                        "No fue posible consultar el horario académico.",
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

                    scheduleExists:
                        false,
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

        const studentSchedule =
            getStudentSchedule(
                snapshotData
                    .academic_data,
            );

        const currentDate =
            new Date();

        const currentDay =
            getCurrentDay(
                currentDate,
            );

        const todayClasses =
            currentDay ===
                null
                ? []
                : studentSchedule
                    .classes
                    .filter(
                        (
                            scheduleClass:
                                ScheduleClass,
                        ): boolean =>
                            scheduleClass
                                .day ===
                            currentDay,
                    )
                    .sort(
                        (
                            firstClass:
                                ScheduleClass,
                            secondClass:
                                ScheduleClass,
                        ): number =>
                            firstClass
                                .startTime
                                .localeCompare(
                                    secondClass
                                        .startTime,
                                ),
                    );

        return createJsonResponse(
            request,
            {
                ok: true,

                snapshotExists:
                    true,

                scheduleExists:
                    studentSchedule
                        .classes
                        .length >
                    0,

                snapshot: {
                    schemaVersion:
                        snapshotData
                            .schema_version,

                    updatedAt:
                        snapshotData
                            .updated_at,
                },

                schedule: {
                    isConfirmed:
                        studentSchedule
                            .isConfirmed,

                    confirmedAt:
                        studentSchedule
                            .confirmedAt,

                    totalMeetings:
                        studentSchedule
                            .classes
                            .length,

                    today: {
                        day:
                            currentDay,

                        dayLabel:
                            getCurrentDayLabel(
                                currentDate,
                            ),

                        dateLabel:
                            getCurrentDateLabel(
                                currentDate,
                            ),

                        currentTime:
                            getCurrentTime(
                                currentDate,
                            ),

                        classes:
                            todayClasses,
                    },
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