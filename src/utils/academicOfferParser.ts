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

type MatrixRow = unknown[];

interface HeaderCandidate {
    rowIndex: number;
    headerIndexes: Map<string, number[]>;
    score: number;
}

interface DetectedOfferTable {
    sheetName: string;
    rows: RawAcademicOfferRow[];
    targetProgramRows: number;
    validScheduleRows: number;
    latestPeriodValue: number;
    score: number;
}

const DAY_COLUMNS: Array<{
    column: string;
    day: ScheduleDay;
}> = [
        { column: "LUNES", day: "monday" },
        { column: "MARTES", day: "tuesday" },
        { column: "MIERCOLES", day: "wednesday" },
        { column: "JUEVES", day: "thursday" },
        { column: "VIERNES", day: "friday" },
    ];

const REQUIRED_HEADERS = [
    "MATERIA",
    "GRUPO",
    "DOCENTES",
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
];

const OPTIONAL_HEADERS = [
    "PERIODO",
    "PROGRAMA",
    "SEMESTRE",
    "OIDMATERIA",
    "CODIGO_MATERIA",
    "OIDGRUPO",
];

const HEADER_ALIASES: Record<string, string> = {
    PERIODO_ACADEMICO: "PERIODO",
    PROGRAMA_ACADEMICO: "PROGRAMA",
    NIVEL: "SEMESTRE",
    NIVEL_ACADEMICO: "SEMESTRE",
    CODIGO: "CODIGO_MATERIA",
    COD_MATERIA: "CODIGO_MATERIA",
    CODIGO_DE_MATERIA: "CODIGO_MATERIA",
    CODIGO_ASIGNATURA: "CODIGO_MATERIA",
    CODIGO_DE_ASIGNATURA: "CODIGO_MATERIA",
    OID_MATERIA: "OIDMATERIA",
    ASIGNATURA: "MATERIA",
    NOMBRE_MATERIA: "MATERIA",
    NOMBRE_DE_MATERIA: "MATERIA",
    NOMBRE_ASIGNATURA: "MATERIA",
    NOMBRE_DE_ASIGNATURA: "MATERIA",
    GRUPO_MATERIA: "GRUPO",
    GRUPO_ASIGNATURA: "GRUPO",
    DOCENTE: "DOCENTES",
    NOMBRE_DOCENTE: "DOCENTES",
    NOMBRE_DEL_DOCENTE: "DOCENTES",
    PROFESOR: "DOCENTES",
    PROFESORES: "DOCENTES",
    ID_GRUPO: "OIDGRUPO",
    OID_GRUPO: "OIDGRUPO",
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
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

const normalizeHeader = (
    value: unknown,
) => {
    return cleanText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
};

const getCanonicalHeader = (
    value: unknown,
) => {
    const normalizedHeader =
        normalizeHeader(value);

    if (normalizedHeader === "") {
        return "";
    }

    if (/^PROGRAMA(_\d+)?$/.test(normalizedHeader)) {
        return "PROGRAMA";
    }

    if (/^SEMESTRE(_\d+)?$/.test(normalizedHeader)) {
        return "SEMESTRE";
    }

    if (/^MATERIA(_\d+)?$/.test(normalizedHeader)) {
        return "MATERIA";
    }

    if (/^DOCENTES?(_\d+)?$/.test(normalizedHeader)) {
        return "DOCENTES";
    }

    if (/^OIDMATERIA(_\d+)?$/.test(normalizedHeader)) {
        return "OIDMATERIA";
    }

    if (/^CODIGO_MATERIA(_\d+)?$/.test(normalizedHeader)) {
        return "CODIGO_MATERIA";
    }

    if (/^OIDGRUPO(_\d+)?$/.test(normalizedHeader)) {
        return "OIDGRUPO";
    }

    return (
        HEADER_ALIASES[normalizedHeader] ??
        normalizedHeader
    );
};

const isTargetProgramValue = (
    value: unknown,
) => {
    const normalizedValue =
        normalizeText(value);

    const acceptedProgramNames =
        new Set([
            "piet",
            "iet",
            "ingenieria electronica y telecomunicaciones",
        ]);

    return acceptedProgramNames.has(
        normalizedValue,
    );
};

const normalizeHour = (
    value: string,
) => {
    const [hourText, minuteText = "00"] =
        value.split(":");

    const hour = Number(hourText);
    const minutes = Number(minuteText);

    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minutes) ||
        hour < 0 ||
        hour > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return "";
    }

    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const parseSemester = (
    value: unknown,
): number | null => {
    const cleanedValue = cleanText(value);

    if (cleanedValue === "") {
        return null;
    }

    const parsedValue = Number(cleanedValue);

    return Number.isFinite(parsedValue)
        ? parsedValue
        : null;
};

const cleanTeachers = (
    value: unknown,
) => {
    return cleanText(value)
        .replace(/\s*,\s*/g, ", ");
};

const parseMeetingCell = (
    value: unknown,
    day: ScheduleDay,
): AcademicOfferMeeting | null => {
    const cellText = cleanText(value);

    if (
        cellText === "" ||
        cellText === "27"
    ) {
        return null;
    }

    const match = cellText.match(
        /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(.*)/,
    );

    if (!match) {
        return null;
    }

    const startTime = normalizeHour(match[1]);
    const endTime = normalizeHour(match[2]);

    if (
        startTime === "" ||
        endTime === ""
    ) {
        return null;
    }

    const classroom = cleanText(match[3]);

    return {
        day,
        startTime,
        endTime,
        classroom:
            classroom ||
            "Salón por confirmar",
    };
};

const createHeaderIndexes = (
    row: MatrixRow,
) => {
    const headerIndexes =
        new Map<string, number[]>();

    row.forEach((cellValue, columnIndex) => {
        const canonicalHeader =
            getCanonicalHeader(cellValue);

        if (canonicalHeader === "") {
            return;
        }

        const currentIndexes =
            headerIndexes.get(canonicalHeader) ?? [];

        headerIndexes.set(
            canonicalHeader,
            [
                ...currentIndexes,
                columnIndex,
            ],
        );
    });

    return headerIndexes;
};

const findHeaderCandidate = (
    matrix: MatrixRow[],
): HeaderCandidate | null => {
    let bestCandidate: HeaderCandidate | null = null;

    const rowsToInspect = Math.min(
        matrix.length,
        150,
    );

    for (
        let rowIndex = 0;
        rowIndex < rowsToInspect;
        rowIndex += 1
    ) {
        const headerIndexes =
            createHeaderIndexes(
                matrix[rowIndex] ?? [],
            );

        const hasRequiredHeaders =
            REQUIRED_HEADERS.every(
                (header) =>
                    headerIndexes.has(header),
            );

        if (!hasRequiredHeaders) {
            continue;
        }

        const optionalHeadersFound =
            OPTIONAL_HEADERS.filter(
                (header) =>
                    headerIndexes.has(header),
            ).length;

        const score =
            REQUIRED_HEADERS.length * 100 +
            optionalHeadersFound * 20 -
            rowIndex;

        if (
            bestCandidate === null ||
            score > bestCandidate.score
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

const getCellValues = (
    row: MatrixRow,
    headerIndexes: Map<string, number[]>,
    header: string,
) => {
    const indexes =
        headerIndexes.get(header) ?? [];

    return indexes
        .map((index) => cleanText(row[index]))
        .filter((value) => value !== "");
};

const getFirstCellValue = (
    row: MatrixRow,
    headerIndexes: Map<string, number[]>,
    header: string,
) => {
    return (
        getCellValues(
            row,
            headerIndexes,
            header,
        )[0] ?? ""
    );
};

const getProgramCellValue = (
    row: MatrixRow,
    headerIndexes: Map<string, number[]>,
) => {
    const programValues =
        getCellValues(
            row,
            headerIndexes,
            "PROGRAMA",
        );

    return (
        programValues.find(
            isTargetProgramValue,
        ) ??
        programValues[0] ??
        ""
    );
};

const getSubjectNameScore = (
    value: string,
) => {
    if (value === "") {
        return Number.NEGATIVE_INFINITY;
    }

    let score = value.length;

    if (/\s/.test(value)) {
        score += 25;
    }

    if (/[a-záéíóúñ]/i.test(value)) {
        score += 15;
    }

    if (/^\d+(?:\.\d+)?$/.test(value)) {
        score -= 100;
    }

    if (/^[a-z]{0,5}\d[\w.-]*$/i.test(value)) {
        score -= 50;
    }

    return score;
};

const getSubjectNameCellValue = (
    row: MatrixRow,
    headerIndexes: Map<string, number[]>,
) => {
    const subjectValues =
        getCellValues(
            row,
            headerIndexes,
            "MATERIA",
        );

    return [...subjectValues]
        .sort(
            (firstValue, secondValue) =>
                getSubjectNameScore(secondValue) -
                getSubjectNameScore(firstValue),
        )[0] ?? "";
};

const createRowsFromDetectedTable = (
    matrix: MatrixRow[],
    headerCandidate: HeaderCandidate,
) => {
    const rows: RawAcademicOfferRow[] = [];

    let inheritedPeriod = "";
    let inheritedProgram = "";
    let inheritedSemester = "";

    for (
        let rowIndex =
            headerCandidate.rowIndex + 1;
        rowIndex < matrix.length;
        rowIndex += 1
    ) {
        const matrixRow =
            matrix[rowIndex] ?? [];

        const currentPeriod =
            getFirstCellValue(
                matrixRow,
                headerCandidate.headerIndexes,
                "PERIODO",
            );

        const currentProgram =
            getProgramCellValue(
                matrixRow,
                headerCandidate.headerIndexes,
            );

        const currentSemester =
            getFirstCellValue(
                matrixRow,
                headerCandidate.headerIndexes,
                "SEMESTRE",
            );

        if (currentPeriod !== "") {
            inheritedPeriod = currentPeriod;
        }

        if (currentProgram !== "") {
            inheritedProgram = currentProgram;
        }

        if (currentSemester !== "") {
            inheritedSemester = currentSemester;
        }

        const subjectName =
            getSubjectNameCellValue(
                matrixRow,
                headerCandidate.headerIndexes,
            );

        if (subjectName === "") {
            continue;
        }

        const normalizedRow: RawAcademicOfferRow = {
            PERIODO:
                currentPeriod ||
                inheritedPeriod,

            PROGRAMA:
                currentProgram ||
                inheritedProgram,

            SEMESTRE:
                currentSemester ||
                inheritedSemester,

            OIDMATERIA:
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    "OIDMATERIA",
                ),

            CODIGO_MATERIA:
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    "CODIGO_MATERIA",
                ),

            MATERIA:
                subjectName,

            GRUPO:
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    "GRUPO",
                ),

            DOCENTES:
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    "DOCENTES",
                ),

            OIDGRUPO:
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    "OIDGRUPO",
                ),
        };

        DAY_COLUMNS.forEach(({ column }) => {
            normalizedRow[column] =
                getFirstCellValue(
                    matrixRow,
                    headerCandidate.headerIndexes,
                    column,
                );
        });

        rows.push(normalizedRow);
    }

    return rows;
};

const getPeriodSortValue = (
    value: unknown,
) => {
    const periodText = cleanText(value);

    const match = periodText.match(
        /(20\d{2})\D*([12])?/,
    );

    if (!match) {
        return 0;
    }

    const year = Number(match[1]);
    const academicPeriod = Number(match[2] ?? 0);

    return year * 10 + academicPeriod;
};

const countValidScheduleRows = (
    rows: RawAcademicOfferRow[],
) => {
    return rows.filter((row) =>
        DAY_COLUMNS.some(({ column, day }) =>
            parseMeetingCell(
                row[column],
                day,
            ) !== null,
        ),
    ).length;
};

const findOfferTable = (
    workbook: XLSX.WorkBook,
): DetectedOfferTable => {
    const candidates: DetectedOfferTable[] = [];

    for (const sheetName of workbook.SheetNames) {
        const worksheet =
            workbook.Sheets[sheetName];

        if (!worksheet) {
            continue;
        }

        const matrix =
            XLSX.utils.sheet_to_json<MatrixRow>(
                worksheet,
                {
                    header: 1,
                    defval: "",
                    raw: false,
                    blankrows: false,
                },
            );

        if (matrix.length === 0) {
            continue;
        }

        const headerCandidate =
            findHeaderCandidate(matrix);

        if (!headerCandidate) {
            continue;
        }

        const rows =
            createRowsFromDetectedTable(
                matrix,
                headerCandidate,
            );

        if (rows.length === 0) {
            continue;
        }

        const targetProgramRows =
            rows.filter((row) =>
                isTargetProgramValue(
                    row.PROGRAMA,
                ),
            ).length;

        const validScheduleRows =
            countValidScheduleRows(rows);

        const latestPeriodValue =
            rows.reduce(
                (latestValue, row) =>
                    Math.max(
                        latestValue,
                        getPeriodSortValue(
                            row.PERIODO,
                        ),
                    ),
                0,
            );

        candidates.push({
            sheetName,
            rows,
            targetProgramRows,
            validScheduleRows,
            latestPeriodValue,
            score:
                headerCandidate.score +
                validScheduleRows,
        });
    }

    const candidatesWithTargetProgram =
        candidates.filter(
            (candidate) =>
                candidate.targetProgramRows > 0,
        );

    const candidatePool =
        candidatesWithTargetProgram.length > 0
            ? candidatesWithTargetProgram
            : candidates;

    const bestCandidate =
        [...candidatePool]
            .sort((firstCandidate, secondCandidate) => {
                if (
                    secondCandidate.latestPeriodValue !==
                    firstCandidate.latestPeriodValue
                ) {
                    return (
                        secondCandidate.latestPeriodValue -
                        firstCandidate.latestPeriodValue
                    );
                }

                if (
                    secondCandidate.targetProgramRows !==
                    firstCandidate.targetProgramRows
                ) {
                    return (
                        secondCandidate.targetProgramRows -
                        firstCandidate.targetProgramRows
                    );
                }

                if (
                    secondCandidate.validScheduleRows !==
                    firstCandidate.validScheduleRows
                ) {
                    return (
                        secondCandidate.validScheduleRows -
                        firstCandidate.validScheduleRows
                    );
                }

                return (
                    secondCandidate.score -
                    firstCandidate.score
                );
            })[0];

    if (!bestCandidate) {
        throw new Error(
            `Se revisaron ${workbook.SheetNames.length} hojas (${workbook.SheetNames.join(", ")}), pero no se encontró una tabla con los encabezados Materia, Grupo, Docentes, Lunes, Martes, Miércoles, Jueves y Viernes.`,
        );
    }

    return bestCandidate;
};

const readAcademicOfferWorkbook = (
    fileBuffer: ArrayBuffer,
    extension: "xls" | "xlsx",
): XLSX.WorkBook => {
    const readAttempts: Array<
        () => XLSX.WorkBook
    > = [
            () =>
                XLSX.read(fileBuffer, {
                    type: "array",
                }),
        ];

    if (extension === "xls") {
        readAttempts.push(
            () =>
                XLSX.read(fileBuffer, {
                    type: "array",
                    password:
                        "VelvetSweatshop",
                }),
        );
    }

    let lastError: unknown;

    for (const readAttempt of readAttempts) {
        try {
            return readAttempt();
        } catch (error) {
            lastError = error;
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

    if (isProtectedFile) {
        throw new Error(
            [
                "Formato requerido: .xlsx",
                "Formato subido: .xls",
                "",
                "El archivo XLS está protegido con un método que el lector web no puede descifrar. Para importarlo, ábrelo en Google Sheets, Excel o LibreOffice y guárdalo como XLSX sin contraseña.",
            ].join("\n"),
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
    const convertedBuffer =
        XLSX.write(workbook, {
            type: "array",
            bookType: "xlsx",
            compression: true,
        });

    return XLSX.read(convertedBuffer, {
        type: "array",
    });
};

const createFallbackSubjectCode = (
    subjectName: string,
    rowIndex: number,
) => {
    const normalizedName =
        normalizeHeader(subjectName)
            .replace(/_/g, "-")
            .slice(0, 45);

    return (
        normalizedName ||
        `SIN-CODIGO-${rowIndex + 1}`
    );
};

const getMostFrequentPeriod = (
    groups: AcademicOfferGroup[],
) => {
    const periodCounts =
        new Map<string, number>();

    groups.forEach((group) => {
        const period = cleanText(group.period);

        if (period === "") {
            return;
        }

        periodCounts.set(
            period,
            (periodCounts.get(period) ?? 0) + 1,
        );
    });

    const periods =
        Array.from(periodCounts.entries());

    if (periods.length === 0) {
        return "Periodo no indicado";
    }

    periods.sort((firstPeriod, secondPeriod) => {
        if (secondPeriod[1] !== firstPeriod[1]) {
            return secondPeriod[1] - firstPeriod[1];
        }

        return (
            getPeriodSortValue(secondPeriod[0]) -
            getPeriodSortValue(firstPeriod[0])
        );
    });

    return periods[0][0];
};

export const parseAcademicOfferBuffer =
    async (
        fileBuffer: ArrayBuffer,
        fileName: string,
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

        const supportedExtension = extension as
            | "xls"
            | "xlsx";

        const sourceWorkbook =
            readAcademicOfferWorkbook(
                fileBuffer,
                supportedExtension,
            );

        const workbook =
            supportedExtension === "xls"
                ? convertLegacyWorkbookToXlsx(
                    sourceWorkbook,
                )
                : sourceWorkbook;

        const normalizedFileName =
            supportedExtension === "xls"
                ? fileName.replace(
                    /\.xls$/i,
                    ".xlsx",
                )
                : fileName;

        const detectedTable =
            findOfferTable(workbook);

        const nonEmptyPrograms =
            Array.from(
                new Set(
                    detectedTable.rows
                        .map((row) =>
                            cleanText(
                                row.PROGRAMA,
                            ),
                        )
                        .filter(
                            (program) =>
                                program !== "",
                        ),
                ),
            );

        const targetProgramRows =
            detectedTable.rows.filter((row) =>
                isTargetProgramValue(
                    row.PROGRAMA,
                ),
            );

        const programRows =
            targetProgramRows.length > 0
                ? targetProgramRows
                : nonEmptyPrograms.length === 0
                    ? detectedTable.rows
                    : [];

        if (programRows.length === 0) {
            throw new Error(
                `La hoja "${detectedTable.sheetName}" fue detectada, pero los valores encontrados en Programa fueron: ${nonEmptyPrograms.join(", ")}. Se esperaba PIET, IET o Ingeniería Electrónica y Telecomunicaciones.`,
            );
        }

        const groups =
            programRows
                .map(
                    (
                        row,
                        rowIndex,
                    ): AcademicOfferGroup | null => {
                        const subjectName =
                            cleanText(
                                row.MATERIA,
                            );

                        if (subjectName === "") {
                            return null;
                        }

                        const meetings =
                            DAY_COLUMNS
                                .map(({ column, day }) =>
                                    parseMeetingCell(
                                        row[column],
                                        day,
                                    ),
                                )
                                .filter(
                                    (
                                        meeting,
                                    ): meeting is AcademicOfferMeeting =>
                                        meeting !== null,
                                );

                        if (meetings.length === 0) {
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
                            cleanText(
                                row.OIDMATERIA,
                            ) ||
                            createFallbackSubjectCode(
                                subjectName,
                                rowIndex,
                            );

                        const group =
                            cleanText(row.GRUPO) ||
                            "Sin grupo";

                        const rowGroupId =
                            cleanText(row.OIDGRUPO);

                        const id =
                            rowGroupId ||
                            [
                                period,
                                subjectCode,
                                group,
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
                        group !== null,
                );

        const uniqueGroups =
            Array.from(
                new Map(
                    groups.map((group) => [
                        group.id,
                        group,
                    ]),
                ).values(),
            ).sort((firstGroup, secondGroup) => {
                const nameComparison =
                    firstGroup.subjectName.localeCompare(
                        secondGroup.subjectName,
                        "es",
                    );

                if (nameComparison !== 0) {
                    return nameComparison;
                }

                return firstGroup.group.localeCompare(
                    secondGroup.group,
                    "es",
                );
            });

        if (uniqueGroups.length === 0) {
            throw new Error(
                `La hoja "${detectedTable.sheetName}" fue detectada, pero no contiene grupos con horarios válidos de lunes a viernes.`,
            );
        }

        return {
            version: 1,
            fileName:
                normalizedFileName,
            sourceSheetName:
                detectedTable.sheetName,
            workbookSheetCount:
                workbook.SheetNames.length,
            importedAt:
                new Date().toISOString(),
            period:
                getMostFrequentPeriod(
                    uniqueGroups,
                ),
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
