const MAX_FILE_SIZE_BYTES =
    4_000_000;

interface DriveRequestBody {
    url?: unknown;
}

interface DriveReference {
    fileId: string;
    isGoogleSpreadsheet: boolean;
}

const getDriveReference = (
    rawUrl: string,
): DriveReference => {
    let parsedUrl: URL;

    try {
        parsedUrl =
            new URL(rawUrl);
    } catch {
        throw new Error(
            "El enlace de Google Drive no es válido.",
        );
    }

    const allowedHosts = [
        "drive.google.com",
        "docs.google.com",
    ];

    if (
        !allowedHosts.includes(
            parsedUrl.hostname,
        )
    ) {
        throw new Error(
            "Solo se permiten enlaces de Google Drive o Google Sheets.",
        );
    }

    const isGoogleSpreadsheet =
        parsedUrl.hostname ===
        "docs.google.com" &&
        parsedUrl.pathname.includes(
            "/spreadsheets/",
        );

    const filePathMatch =
        parsedUrl.pathname.match(
            /\/(?:file\/d|spreadsheets\/d)\/([a-zA-Z0-9_-]+)/,
        );

    const queryFileId =
        parsedUrl.searchParams.get(
            "id",
        );

    const fileId =
        filePathMatch?.[1] ??
        queryFileId ??
        "";

    if (
        !/^[a-zA-Z0-9_-]{10,}$/.test(
            fileId,
        )
    ) {
        throw new Error(
            "No fue posible identificar el archivo dentro del enlace de Google Drive.",
        );
    }

    return {
        fileId,
        isGoogleSpreadsheet,
    };
};

const getDownloadUrl = ({
    fileId,
    isGoogleSpreadsheet,
}: DriveReference) => {
    if (isGoogleSpreadsheet) {
        return (
            "https://docs.google.com/spreadsheets/d/" +
            encodeURIComponent(fileId) +
            "/export?format=xlsx"
        );
    }

    return (
        "https://drive.google.com/uc" +
        "?export=download" +
        "&confirm=t" +
        `&id=${encodeURIComponent(
            fileId,
        )}`
    );
};

const getFileNameFromDisposition = (
    contentDisposition: string | null,
    fallbackFileName: string,
) => {
    if (!contentDisposition) {
        return fallbackFileName;
    }

    const encodedMatch =
        contentDisposition.match(
            /filename\*=UTF-8''([^;]+)/i,
        );

    if (encodedMatch?.[1]) {
        try {
            return decodeURIComponent(
                encodedMatch[1],
            );
        } catch {
            return fallbackFileName;
        }
    }

    const simpleMatch =
        contentDisposition.match(
            /filename="?([^";]+)"?/i,
        );

    return (
        simpleMatch?.[1]?.trim() ||
        fallbackFileName
    );
};

export default {
    async fetch(
        request: Request,
    ): Promise<Response> {
        if (
            request.method !== "POST"
        ) {
            return Response.json(
                {
                    message:
                        "Método no permitido.",
                },
                {
                    status: 405,
                    headers: {
                        Allow: "POST",
                    },
                },
            );
        }

        let body: DriveRequestBody;

        try {
            body =
                (await request.json()) as
                DriveRequestBody;
        } catch {
            return Response.json(
                {
                    message:
                        "La solicitud no contiene datos válidos.",
                },
                {
                    status: 400,
                },
            );
        }

        const driveUrl =
            typeof body.url === "string"
                ? body.url.trim()
                : "";

        if (driveUrl === "") {
            return Response.json(
                {
                    message:
                        "Debes ingresar el enlace de Google Drive.",
                },
                {
                    status: 400,
                },
            );
        }

        let driveReference:
            DriveReference;

        try {
            driveReference =
                getDriveReference(
                    driveUrl,
                );
        } catch (error) {
            return Response.json(
                {
                    message:
                        error instanceof Error
                            ? error.message
                            : "El enlace de Drive no es válido.",
                },
                {
                    status: 400,
                },
            );
        }

        const downloadUrl =
            getDownloadUrl(
                driveReference,
            );

        let driveResponse:
            Response;

        try {
            driveResponse =
                await fetch(
                    downloadUrl,
                    {
                        method: "GET",
                        redirect: "follow",
                        headers: {
                            Accept:
                                "application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream",
                        },
                    },
                );
        } catch {
            return Response.json(
                {
                    message:
                        "No fue posible conectarse con Google Drive.",
                },
                {
                    status: 502,
                },
            );
        }

        if (!driveResponse.ok) {
            return Response.json(
                {
                    message:
                        "Google Drive no permitió descargar el archivo. Revisa que esté compartido como Cualquier persona con el enlace.",
                },
                {
                    status: 400,
                },
            );
        }

        const contentType =
            driveResponse.headers
                .get("content-type")
                ?.toLowerCase() ??
            "";

        /*
         * Cuando Drive devuelve una página HTML,
         * normalmente significa que el archivo requiere
         * iniciar sesión, solicitar acceso o confirmar
         * una descarga no disponible públicamente.
         */
        if (
            contentType.includes(
                "text/html",
            )
        ) {
            return Response.json(
                {
                    message:
                        "Google Drive devolvió una página de acceso en lugar del archivo. Cambia el permiso a Cualquier persona con el enlace y asegúrate de enlazar directamente el archivo.",
                },
                {
                    status: 400,
                },
            );
        }

        const declaredFileSize =
            Number(
                driveResponse.headers.get(
                    "content-length",
                ),
            );

        if (
            Number.isFinite(
                declaredFileSize,
            ) &&
            declaredFileSize >
            MAX_FILE_SIZE_BYTES
        ) {
            return Response.json(
                {
                    message:
                        "El archivo supera el tamaño permitido para importarlo mediante el enlace. Usa el archivo OfertaFIET XLSX o súbelo directamente desde el dispositivo.",
                },
                {
                    status: 413,
                },
            );
        }

        const fileBuffer =
            await driveResponse.arrayBuffer();

        if (
            fileBuffer.byteLength >
            MAX_FILE_SIZE_BYTES
        ) {
            return Response.json(
                {
                    message:
                        "El archivo supera el tamaño permitido para importarlo mediante el enlace. Usa el archivo OfertaFIET XLSX o súbelo directamente desde el dispositivo.",
                },
                {
                    status: 413,
                },
            );
        }

        if (
            fileBuffer.byteLength === 0
        ) {
            return Response.json(
                {
                    message:
                        "El archivo descargado desde Drive está vacío.",
                },
                {
                    status: 400,
                },
            );
        }

        const fallbackFileName =
            driveReference
                .isGoogleSpreadsheet
                ? "OfertaFIET-Google-Sheets.xlsx"
                : "OfertaFIET-Drive.xlsx";

        const fileName =
            getFileNameFromDisposition(
                driveResponse.headers.get(
                    "content-disposition",
                ),
                fallbackFileName,
            );

        return new Response(
            fileBuffer,
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/octet-stream",

                    "Content-Disposition":
                        `attachment; filename="${fallbackFileName}"`,

                    /*
                     * Se codifica porque los encabezados HTTP
                     * no admiten todos los caracteres Unicode.
                     */
                    "X-File-Name":
                        encodeURIComponent(
                            fileName,
                        ),

                    "Cache-Control":
                        "no-store",
                },
            },
        );
    },
};