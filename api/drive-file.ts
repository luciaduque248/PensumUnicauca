interface DriveRequestBody {
    url?: unknown;
}

interface GoogleFileReference {
    fileId: string;
    isSpreadsheet: boolean;
}

const MAX_RESPONSE_SIZE_BYTES =
    4_000_000;

const createJsonResponse = (
    message: string,
    status: number,
    details?: string,
) => {
    return Response.json(
        {
            message,
            details,
        },
        {
            status,
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
};

const extractGoogleFileReference = (
    rawUrl: string,
): GoogleFileReference => {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(
            rawUrl,
        );
    } catch {
        throw new Error(
            "El enlace ingresado no es válido.",
        );
    }

    const hostname =
        parsedUrl.hostname
            .toLowerCase()
            .replace(/^www\./, "");

    const isGoogleDrive =
        hostname ===
        "drive.google.com" ||
        hostname ===
        "docs.google.com";

    if (!isGoogleDrive) {
        throw new Error(
            "Solo se permiten enlaces de Google Drive o Google Sheets.",
        );
    }

    const spreadsheetMatch =
        parsedUrl.pathname.match(
            /\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/,
        );

    if (spreadsheetMatch?.[1]) {
        return {
            fileId:
                spreadsheetMatch[1],

            isSpreadsheet: true,
        };
    }

    const driveFileMatch =
        parsedUrl.pathname.match(
            /\/file\/d\/([a-zA-Z0-9_-]+)/,
        );

    const queryFileId =
        parsedUrl.searchParams.get(
            "id",
        );

    const fileId =
        driveFileMatch?.[1] ??
        queryFileId ??
        "";

    if (
        !/^[a-zA-Z0-9_-]{10,}$/.test(
            fileId,
        )
    ) {
        throw new Error(
            "No fue posible identificar el archivo dentro del enlace.",
        );
    }

    return {
        fileId,
        isSpreadsheet: false,
    };
};

const createDownloadUrls = (
    reference:
        GoogleFileReference,
) => {
    const encodedFileId =
        encodeURIComponent(
            reference.fileId,
        );

    if (
        reference.isSpreadsheet
    ) {
        return [
            /*
             * Exportación principal de una hoja
             * nativa de Google Sheets.
             */
            `https://docs.google.com/spreadsheets/d/${encodedFileId}/export?format=xlsx`,

            /*
             * Alternativa para algunos enlaces
             * compartidos o abiertos en htmlview.
             */
            `https://docs.google.com/spreadsheets/d/${encodedFileId}/export?format=xlsx&gid=0`,
        ];
    }

    return [
        /*
         * Archivo Excel almacenado directamente
         * dentro de Google Drive.
         */
        `https://drive.usercontent.google.com/download?id=${encodedFileId}&export=download&confirm=t`,

        `https://drive.google.com/uc?export=download&id=${encodedFileId}&confirm=t`,
    ];
};

const isHtmlResponse = (
    contentType: string,
    buffer: ArrayBuffer,
) => {
    if (
        contentType.includes(
            "text/html",
        )
    ) {
        return true;
    }

    const initialBytes =
        new Uint8Array(
            buffer.slice(0, 80),
        );

    const initialText =
        new TextDecoder()
            .decode(initialBytes)
            .trimStart()
            .toLowerCase();

    return (
        initialText.startsWith(
            "<!doctype html",
        ) ||
        initialText.startsWith(
            "<html",
        )
    );
};

const getReadableErrorDetails = (
    contentType: string,
    buffer: ArrayBuffer,
) => {
    const isReadableText =
        contentType.includes(
            "text/",
        ) ||
        contentType.includes(
            "application/json",
        );

    if (!isReadableText) {
        return "";
    }

    try {
        return new TextDecoder()
            .decode(
                buffer.slice(
                    0,
                    600,
                ),
            )
            .replace(
                /\s+/g,
                " ",
            )
            .trim();
    } catch {
        return "";
    }
};

/*
 * Vercel reconoce este archivo como:
 *
 * POST /api/drive-file
 */
export async function POST(
    request: Request,
): Promise<Response> {
    let body: DriveRequestBody;

    try {
        body =
            (await request.json()) as
            DriveRequestBody;
    } catch {
        return createJsonResponse(
            "La solicitud no contiene información válida.",
            400,
        );
    }

    const driveUrl =
        typeof body.url ===
            "string"
            ? body.url.trim()
            : "";

    if (driveUrl === "") {
        return createJsonResponse(
            "Debes ingresar el enlace de Google Drive.",
            400,
        );
    }

    let reference:
        GoogleFileReference;

    try {
        reference =
            extractGoogleFileReference(
                driveUrl,
            );
    } catch (error) {
        return createJsonResponse(
            error instanceof Error
                ? error.message
                : "El enlace de Google Drive no es válido.",
            400,
        );
    }

    const downloadUrls =
        createDownloadUrls(
            reference,
        );

    const failedAttempts:
        string[] = [];

    for (
        const downloadUrl of
        downloadUrls
    ) {
        try {
            const driveResponse =
                await fetch(
                    downloadUrl,
                    {
                        method: "GET",
                        redirect: "follow",

                        headers: {
                            Accept:
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/octet-stream",

                            /*
                             * Evita que algunos servicios
                             * respondan como si la solicitud
                             * viniera de un cliente desconocido.
                             */
                            "User-Agent":
                                "Mozilla/5.0 Pensum-Interactivo",
                        },
                    },
                );

            const contentType =
                driveResponse.headers
                    .get("content-type")
                    ?.toLowerCase() ??
                "";

            const fileBuffer =
                await driveResponse
                    .arrayBuffer();

            const responseIsHtml =
                isHtmlResponse(
                    contentType,
                    fileBuffer,
                );

            if (
                driveResponse.ok &&
                !responseIsHtml &&
                fileBuffer.byteLength >
                0
            ) {
                if (
                    fileBuffer.byteLength >
                    MAX_RESPONSE_SIZE_BYTES
                ) {
                    return createJsonResponse(
                        "El archivo convertido supera el tamaño permitido para descargarlo mediante esta función.",
                        413,
                        "Usa el archivo OfertaFIET en formato XLSX o una versión reducida del horario.",
                    );
                }

                return new Response(
                    fileBuffer,
                    {
                        status: 200,

                        headers: {
                            "Content-Type":
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                            "Content-Disposition":
                                'attachment; filename="OfertaFIET-Drive.xlsx"',

                            "X-File-Name":
                                encodeURIComponent(
                                    "OfertaFIET-Drive.xlsx",
                                ),

                            "Cache-Control":
                                "no-store",
                        },
                    },
                );
            }

            const readableDetails =
                getReadableErrorDetails(
                    contentType,
                    fileBuffer,
                );

            failedAttempts.push(
                [
                    `Estado ${driveResponse.status}`,
                    contentType ||
                    "sin tipo de contenido",
                    responseIsHtml
                        ? "Google devolvió una página HTML"
                        : "",
                    readableDetails,
                ]
                    .filter(Boolean)
                    .join(" · "),
            );
        } catch (error) {
            failedAttempts.push(
                error instanceof Error
                    ? error.message
                    : "Fallo de conexión con Google.",
            );
        }
    }

    return createJsonResponse(
        "Google permite visualizar el archivo, pero no permitió descargarlo o exportarlo como XLSX.",
        400,
        [
            "Revisa que el archivo esté compartido como “Cualquier persona con el enlace”.",
            "Activa la opción que permite a los lectores descargar, imprimir y copiar.",
            "También puedes abrirlo en Google Sheets y crear una copia nativa mediante Archivo → Guardar como Hojas de cálculo de Google.",
            failedAttempts.length >
                0
                ? `Detalle técnico: ${failedAttempts.join(
                    " | ",
                )}`
                : "",
        ]
            .filter(Boolean)
            .join(" "),
    );
}