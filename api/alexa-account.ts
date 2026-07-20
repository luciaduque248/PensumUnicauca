import {
    createClient,
} from "@supabase/supabase-js";

interface AcademicSnapshotRow {
    academic_data: unknown;
    schema_version: number;
    updated_at: string;
}

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
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
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
                "[Alexa account API] Faltan las variables SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.",
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

        const user =
            userData.user;

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
                    user.id,
                )
                .maybeSingle<
                    AcademicSnapshotRow
                >();

        if (snapshotError) {
            console.error(
                "[Alexa account API] No fue posible consultar academic_snapshots.",
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

                    authenticated:
                        true,

                    account: {
                        id:
                            user.id,
                    },

                    snapshot: {
                        exists:
                            false,

                        sectionCount:
                            0,

                        sections:
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
            console.error(
                "[Alexa account API] academic_data no contiene un objeto válido.",
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

        const sections =
            Object.keys(
                snapshotData
                    .academic_data,
            ).sort();

        return createJsonResponse(
            request,
            {
                ok: true,

                authenticated:
                    true,

                account: {
                    id:
                        user.id,
                },

                snapshot: {
                    exists:
                        true,

                    schemaVersion:
                        snapshotData
                            .schema_version,

                    updatedAt:
                        snapshotData
                            .updated_at,

                    sectionCount:
                        sections.length,

                    sections,
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