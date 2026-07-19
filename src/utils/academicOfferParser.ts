/* eslint-disable preserve-caught-error */
import * as XLSX from "xlsx";

import type {
    AcademicOfferGroup,
    AcademicOfferMeeting,
    ImportedAcademicOffer,
    ScheduleDay,
} from "../types/schedule";

export const ACADEMIC_OFFER_PROGRAM =
    "Ingeniería Electrónica y Telecomunicaciones";

type RawAcademicOfferRow =
    Record<string, unknown>;

interface DetectedOfferTable {
    sheetName: string;
    rows: RawAcademicOfferRow[];
    headers: Set<string>;
    score: number;
}

interface HeaderCandidate {
    rowIndex: number;
    headerIndexes: Map<string, number>;
    score: number;
}

const DAY_COLUMNS: Array<{
    column: string;
    day: ScheduleDay;
}> = [
        {
            column: "LUNES",
            day: "monday",
        },
        {
            column: "MARTES",
            day: "tuesday",
        },
        {
            column: "MIERCOLES",
            day: "wednesday",
        },
        {
            column: "JUEVES",
            day: "thursday",
        },
        {
            column: "VIERNES",
            day: "friday",
        },
    ];

/*
 * Estos encabezados identifican una tabla de oferta
 * académica y permiten diferenciarla de una cuadrícula
 * visual de salones o de horarios.
 */
const REQUIRED_TABLE_HEADERS = [
    "MATERIA",
    "GRUPO",
    "DOCENTES",
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
];

/*
 * Estos encabezados aumentan la confianza de la
 * detección, pero no todos son obligatorios.
 */
const OPTIONAL_TABLE_HEADERS = [
    "PERIODO",
    "PROGRAMA",
    "SEMESTRE",
    "CODIGO_MATERIA",
    "OIDGRUPO",
];

/*
 * Permite reconocer pequeñas variaciones en los
 * encabezados de diferentes archivos.
 *
 * Antes de consultar este objeto:
 *
 * - Se eliminan las tildes.
 * - Se convierten los textos a mayúsculas.
 * - Los espacios y símbolos se cambian por "_".
 */
const HEADER_ALIASES: Record<
    string,
    string
> = {
    PERIODO_ACADEMICO:
        "PERIODO",

    PROGRAMA_ACADEMICO:
        "PROGRAMA",

    NIVEL:
        "SEMESTRE",

    NIVEL_ACADEMICO:
        "SEMESTRE",

    CODIGO:
        "CODIGO_MATERIA",

    COD_MATERIA:
        "CODIGO_MATERIA",

    CODIGO_DE_MATERIA:
        "CODIGO_MATERIA",

    CODIGO_ASIGNATURA:
        "CODIGO_MATERIA",

    CODIGO_DE_ASIGNATURA:
        "CODIGO_MATERIA",

    ASIGNATURA:
        "MATERIA",

    NOMBRE_MATERIA:
        "MATERIA",

    NOMBRE_DE_MATERIA:
        "MATERIA",

    NOMBRE_ASIGNATURA:
        "MATERIA",

    NOMBRE_DE_ASIGNATURA:
        "MATERIA",

    GRUPO_MATERIA:
        "GRUPO",

    GRUPO_ASIGNATURA:
        "GRUPO",

    DOCENTE:
        "DOCENTES",

    NOMBRE_DOCENTE:
        "DOCENTES",

    NOMBRE_DEL_DOCENTE:
        "DOCENTES",

    PROFESOR:
        "DOCENTES",

    PROFESORES:
        "DOCENTES",

    ID_GRUPO:
        "OIDGRUPO",

    OID_GRUPO:
        "OIDGRUPO",
};

const cleanText = (
    value: unknown,
) => {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
};

const normalizeText = (
    value: unknown,
) => {
    return cleanText(value)
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLowerCase();
};

/*
 * Convierte un encabezado a una forma comparable.
 *
 * Ejemplos:
 *
 * "Código materia" -> "CODIGO_MATERIA"
 * "MIÉRCOLES"      -> "MIERCOLES"
 * "Nombre docente" -> "NOMBRE_DOCENTE"
 */
const normalizeHeader = (
    value: unknown,
) => {
    return cleanText(value)
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toUpperCase()
        .replace(
            /[^A-Z0-9]+/g,
            "_",
        )
        .replace(
            /^_+|_+$/g,
            "",
        );
};

const getCanonicalHeader = (
    value: unknown,
) => {
    const normalizedHeader =
        normalizeHeader(value);

    if (
        normalizedHeader ===
        ""
    ) {
        return "";
    }

    return (
        HEADER_ALIASES[
        normalizedHeader
        ] ??
        normalizedHeader
    );
};

const normalizeHour = (
    value: string,
) => {
    const [
        hourText,
        minuteText = "00",
    ] = value.split(":");

    const hour =
        Number(hourText);

    const minutes =
        Number(minuteText);

    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minutes)
    ) {
        return "";
    }

    if (
        hour < 0 ||
        hour > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return "";
    }

    return `${String(hour).padStart(
        2,
        "0",
    )}:${String(minutes).padStart(
        2,
        "0",
    )}`;
};

const parseSemester = (
    value: unknown,
): number | null => {
    const cleanValue =
        cleanText(value);

    if (
        cleanValue ===
        ""
    ) {
        return null;
    }

    const parsedValue =
        Number(cleanValue);

    return Number.isFinite(
        parsedValue,
    )
        ? parsedValue
        : null;
};

const cleanTeachers = (
    value: unknown,
) => {
    return cleanText(value)
        .replace(
            /\s*,\s*/g,
            ", ",
        );
};

const parseMeetingCell = (
    value: unknown,
    day: ScheduleDay,
): AcademicOfferMeeting | null => {
    const cellText =
        cleanText(value);

    /*
     * En algunos archivos de la oferta FIET,
     * el valor 27 representa una celda sin horario.
     */
    if (
        cellText === "" ||
        cellText === "27"
    ) {
        return null;
    }

    /*
     * Formatos aceptados:
     *
     * 07:00-09:00 Salón 221-FIET
     * 07:00 - 09:00 Sala 334
     */
    const match =
        cellText.match(
            /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(.*)/,
        );

    if (!match) {
        return null;
    }

    const startTime =
        normalizeHour(
            match[1],
        );

    const endTime =
        normalizeHour(
            match[2],
        );

    if (
        startTime === "" ||
        endTime === ""
    ) {
        return null;
    }

    const classroom =
        cleanText(
            match[3],
        );

    return {
        day,
        startTime,
        endTime,

        classroom:
            classroom ||
            "Salón por confirmar",
    };
};

/*
 * Construye la relación:
 *
 * encabezado canónico -> posición de la columna.
 */
const createHeaderIndexes = (
    row: unknown[],
) => {
    const headerIndexes =
        new Map<
            string,
            number
        >();

    row.forEach(
        (
            cellValue,
            columnIndex,
        ) => {
            const canonicalHeader =
                getCanonicalHeader(
                    cellValue,
                );

            if (
                canonicalHeader ===
                "" ||
                headerIndexes.has(
                    canonicalHeader,
                )
            ) {
                return;
            }

            headerIndexes.set(
                canonicalHeader,
                columnIndex,
            );
        },
    );

    return headerIndexes;
};

/*
 * Busca la fila que contiene los encabezados reales.
 *
 * No se limita a la primera fila porque algunos libros
 * tienen títulos, logos, filtros o espacios antes de la
 * tabla estructurada.
 */
const findHeaderCandidate = (
    matrix: unknown[][],
): HeaderCandidate | null => {
    let bestCandidate:
        HeaderCandidate | null =
        null;

    const rowsToInspect =
        Math.min(
            matrix.length,
            100,
        );

    for (
        let rowIndex = 0;
        rowIndex <
        rowsToInspect;
        rowIndex += 1
    ) {
        const headerIndexes =
            createHeaderIndexes(
                matrix[rowIndex] ?? [],
            );

        const hasRequiredHeaders =
            REQUIRED_TABLE_HEADERS.every(
                (requiredHeader) =>
                    headerIndexes.has(
                        requiredHeader,
                    ),
            );

        if (
            !hasRequiredHeaders
        ) {
            continue;
        }

        const optionalHeadersFound =
            OPTIONAL_TABLE_HEADERS.filter(
                (optionalHeader) =>
                    headerIndexes.has(
                        optionalHeader,
                    ),
            ).length;

        /*
         * Los encabezados obligatorios asignan la mayor
         * parte de la puntuación.
         *
         * Los campos opcionales permiten preferir una
         * tabla completa sobre otra tabla parcial.
         *
         * También se prefiere una fila de encabezados
         * cercana al inicio cuando dos opciones empatan.
         */
        const score =
            REQUIRED_TABLE_HEADERS.length *
            100 +
            optionalHeadersFound *
            20 -
            rowIndex;

        if (
            bestCandidate === null ||
            score >
            bestCandidate.score
        ) {
            bestCandidate = {
                rowIndex,
                headerIndexes,
                score,
            };
        }
    }

    return bestCandidate;
};

const createRowsFromDetectedTable = (
    matrix: unknown[][],
    headerCandidate:
        HeaderCandidate,
) => {
    const dataRows =
        matrix.slice(
            headerCandidate.rowIndex +
            1,
        );

    return dataRows
        .map(
            (
                row,
            ): RawAcademicOfferRow => {
                const normalizedRow:
                    RawAcademicOfferRow =
                    {};

                headerCandidate
                    .headerIndexes
                    .forEach(
                        (
                            columnIndex,
                            canonicalHeader,
                        ) => {
                            normalizedRow[
                                canonicalHeader
                            ] =
                                row[
                                columnIndex
                                ] ??
                                "";
                        },
                    );

                return normalizedRow;
            },
        )
        .filter(
            (row) =>
                cleanText(
                    row.MATERIA,
                ) !==
                "",
        );
};

/*
 * Examina todas las hojas del libro y selecciona
 * automáticamente la tabla estructurada más completa.
 */
const findOfferTable = (
    workbook: XLSX.WorkBook,
): DetectedOfferTable => {
    const candidates:
        DetectedOfferTable[] =
        [];

    for (
        const sheetName of
        workbook.SheetNames
    ) {
        const worksheet =
            workbook.Sheets[
            sheetName
            ];

        if (!worksheet) {
            continue;
        }

        const matrix =
            XLSX.utils.sheet_to_json<
                unknown[]
            >(
                worksheet,
                {
                    header: 1,
                    defval: "",
                    raw: false,
                    blankrows: false,
                },
            ) as unknown[][];

        if (
            matrix.length ===
            0
        ) {
            continue;
        }

        const headerCandidate =
            findHeaderCandidate(
                matrix,
            );

        if (
            !headerCandidate
        ) {
            continue;
        }

        const rows =
            createRowsFromDetectedTable(
                matrix,
                headerCandidate,
            );

        if (
            rows.length ===
            0
        ) {
            continue;
        }

        const headers =
            new Set(
                headerCandidate
                    .headerIndexes
                    .keys(),
            );

        /*
         * La cantidad de filas válidas sirve como
         * criterio secundario de selección.
         */
        const score =
            headerCandidate.score +
            Math.min(
                rows.length,
                200,
            );

        candidates.push({
            sheetName,
            rows,
            headers,
            score,
        });
    }

    const bestCandidate =
        candidates.sort(
            (
                firstCandidate,
                secondCandidate,
            ) => {
                if (
                    secondCandidate.score !==
                    firstCandidate.score
                ) {
                    return (
                        secondCandidate.score -
                        firstCandidate.score
                    );
                }

                return (
                    secondCandidate.rows.length -
                    firstCandidate.rows.length
                );
            },
        )[0];

    if (
        !bestCandidate
    ) {
        throw new Error(
            "Se revisaron todas las hojas del archivo, pero no se encontró una tabla estructurada con las columnas Materia, Grupo, Docentes y los horarios de lunes a viernes.",
        );
    }

    return bestCandidate;
};

const readAcademicOfferWorkbook = (
    fileBuffer: ArrayBuffer,
    extension:
        | "xls"
        | "xlsx",
): XLSX.WorkBook => {
    /*
     * Primer intento:
     * lectura normal del archivo.
     */
    const readAttempts: Array<
        () => XLSX.WorkBook
    > = [
            () =>
                XLSX.read(
                    fileBuffer,
                    {
                        type: "array",
                    },
                ),
        ];

    /*
     * Algunos archivos XLS antiguos marcados
     * como solo lectura usan internamente esta
     * contraseña estándar.
     */
    if (
        extension ===
        "xls"
    ) {
        readAttempts.push(
            () =>
                XLSX.read(
                    fileBuffer,
                    {
                        type: "array",

                        password:
                            "VelvetSweatshop",
                    },
                ),
        );
    }

    let lastError:
        unknown;

    for (
        const readAttempt of
        readAttempts
    ) {
        try {
            return readAttempt();
        } catch (error) {
            lastError =
                error;
        }
    }

    const originalMessage =
        lastError instanceof Error
            ? lastError.message
            : "";

    const isProtectedFile =
        /password-protected|password protected|encrypted|password|encryption/i.test(
            originalMessage,
        );

    if (
        isProtectedFile
    ) {
        throw new Error(
            "El archivo XLS está protegido con un método que el lector web no puede descifrar. Para importarlo, ábrelo en Google Sheets, Excel o LibreOffice y guárdalo como XLSX sin contraseña. También puedes compartir la versión de Google Sheets mediante un enlace público.",
        );
    }

    throw new Error(
        originalMessage
            ? `No fue posible leer el archivo: ${originalMessage}`
            : "No fue posible leer el archivo seleccionado.",
    );
};

const convertLegacyWorkbookToXlsx = (
    workbook: XLSX.WorkBook,
): XLSX.WorkBook => {
    /*
     * El libro XLS ya fue leído correctamente.
     * Se genera una versión XLSX en memoria.
     */
    const convertedBuffer =
        XLSX.write(
            workbook,
            {
                type: "array",
                bookType: "xlsx",
                compression: true,
            },
        );

    return XLSX.read(
        convertedBuffer,
        {
            type: "array",
        },
    );
};

const createFallbackSubjectCode = (
    subjectName: string,
    rowIndex: number,
) => {
    const normalizedName =
        normalizeHeader(
            subjectName,
        )
            .replace(
                /_/g,
                "-",
            )
            .slice(
                0,
                45,
            );

    return (
        normalizedName ||
        `SIN-CODIGO-${rowIndex + 1}`
    );
};

export const parseAcademicOfferBuffer =
    async (
        fileBuffer:
            ArrayBuffer,
        fileName:
            string,
    ): Promise<ImportedAcademicOffer> => {
        const extension =
            fileName
                .split(".")
                .at(-1)
                ?.toLowerCase();

        if (
            extension !== "xls" &&
            extension !== "xlsx"
        ) {
            throw new Error(
                "Debes seleccionar un archivo .xls o .xlsx.",
            );
        }

        const supportedExtension =
            extension as
            | "xls"
            | "xlsx";

        const sourceWorkbook =
            readAcademicOfferWorkbook(
                fileBuffer,
                supportedExtension,
            );

        /*
         * Cuando el archivo original es XLS y se pudo
         * abrir, se convierte automáticamente a XLSX
         * antes de procesar las hojas.
         */
        const workbook =
            supportedExtension ===
                "xls"
                ? convertLegacyWorkbookToXlsx(
                    sourceWorkbook,
                )
                : sourceWorkbook;

        const normalizedFileName =
            supportedExtension ===
                "xls"
                ? fileName.replace(
                    /\.xls$/i,
                    ".xlsx",
                )
                : fileName;

        const detectedTable =
            findOfferTable(
                workbook,
            );

        const rows =
            detectedTable.rows;

        /*
         * Si la tabla contiene la columna PROGRAMA y
         * tiene valores, se filtra únicamente el programa
         * de esta aplicación.
         *
         * Si la columna no existe o está completamente
         * vacía, se permite continuar con las filas
         * detectadas.
         */
        const rowsWithProgramValue =
            rows.filter(
                (row) =>
                    cleanText(
                        row.PROGRAMA,
                    ) !==
                    "",
            );

        const programRows =
            detectedTable.headers.has(
                "PROGRAMA",
            ) &&
                rowsWithProgramValue.length >
                0
                ? rows.filter(
                    (row) =>
                        normalizeText(
                            row.PROGRAMA,
                        ) ===
                        normalizeText(
                            ACADEMIC_OFFER_PROGRAM,
                        ),
                )
                : rows;

        if (
            programRows.length ===
            0
        ) {
            throw new Error(
                "La tabla fue detectada, pero no contiene registros de Ingeniería Electrónica y Telecomunicaciones.",
            );
        }

        const groups =
            programRows
                .map(
                    (
                        row,
                        rowIndex,
                    ):
                        | AcademicOfferGroup
                        | null => {
                        const subjectName =
                            cleanText(
                                row.MATERIA,
                            );

                        if (
                            subjectName ===
                            ""
                        ) {
                            return null;
                        }

                        const meetings =
                            DAY_COLUMNS
                                .map(
                                    ({
                                        column,
                                        day,
                                    }) =>
                                        parseMeetingCell(
                                            row[
                                            column
                                            ],
                                            day,
                                        ),
                                )
                                .filter(
                                    (
                                        meeting,
                                    ): meeting is AcademicOfferMeeting =>
                                        meeting !==
                                        null,
                                );

                        /*
                         * Las materias sin una franja semanal
                         * no se necesitan en la cuadrícula.
                         */
                        if (
                            meetings.length ===
                            0
                        ) {
                            return null;
                        }

                        const period =
                            cleanText(
                                row.PERIODO,
                            ) ||
                            "Periodo no indicado";

                        const subjectCode =
                            cleanText(
                                row.CODIGO_MATERIA,
                            ) ||
                            createFallbackSubjectCode(
                                subjectName,
                                rowIndex,
                            );

                        const group =
                            cleanText(
                                row.GRUPO,
                            ) ||
                            "Sin grupo";

                        const rowGroupId =
                            cleanText(
                                row.OIDGRUPO,
                            );

                        const id =
                            rowGroupId ||
                            [
                                period,
                                subjectCode,
                                group,
                                rowIndex +
                                1,
                            ].join("-");

                        return {
                            id,

                            period,

                            semester:
                                parseSemester(
                                    row.SEMESTRE,
                                ),

                            subjectCode,
                            subjectName,
                            group,

                            teacher:
                                cleanTeachers(
                                    row.DOCENTES,
                                ) ||
                                "Docente por confirmar",

                            meetings,
                        };
                    },
                )
                .filter(
                    (
                        group,
                    ): group is AcademicOfferGroup =>
                        group !==
                        null,
                );

        const uniqueGroups =
            Array.from(
                new Map(
                    groups.map(
                        (group) => [
                            group.id,
                            group,
                        ],
                    ),
                ).values(),
            ).sort(
                (
                    firstGroup,
                    secondGroup,
                ) => {
                    const nameComparison =
                        firstGroup
                            .subjectName
                            .localeCompare(
                                secondGroup
                                    .subjectName,
                                "es",
                            );

                    if (
                        nameComparison !==
                        0
                    ) {
                        return nameComparison;
                    }

                    return firstGroup
                        .group
                        .localeCompare(
                            secondGroup
                                .group,
                            "es",
                        );
                },
            );

        if (
            uniqueGroups.length ===
            0
        ) {
            throw new Error(
                `La hoja "${detectedTable.sheetName}" fue detectada como tabla de oferta académica, pero no contiene grupos con horarios válidos de lunes a viernes.`,
            );
        }

        const groupWithPeriod =
            uniqueGroups.find(
                (group) =>
                    group.period !==
                    "Periodo no indicado",
            );

        const period =
            groupWithPeriod
                ?.period ??
            uniqueGroups[0]
                .period;

        return {
            version: 1,

            fileName:
                normalizedFileName,

            sourceSheetName:
                detectedTable
                    .sheetName,

            importedAt:
                new Date()
                    .toISOString(),

            period,

            program:
                ACADEMIC_OFFER_PROGRAM,

            groups:
                uniqueGroups,
        };
    };

export const parseAcademicOfferFile =
    async (
        file: File,
    ): Promise<ImportedAcademicOffer> => {
        const fileBuffer =
            await file.arrayBuffer();

        return parseAcademicOfferBuffer(
            fileBuffer,
            file.name,
        );
    };