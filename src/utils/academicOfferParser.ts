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

const REQUIRED_HEADERS = [
    "PERIODO",
    "PROGRAMA",
    "SEMESTRE",
    "CODIGO_MATERIA",
    "MATERIA",
    "GRUPO",
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
    "DOCENTES",
    "OIDGRUPO",
];

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

const normalizeHeader = (
    value: string,
) => {
    return cleanText(value)
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toUpperCase();
};

const normalizeRow = (
    row: RawAcademicOfferRow,
): RawAcademicOfferRow => {
    return Object.fromEntries(
        Object.entries(row).map(
            ([key, value]) => [
                normalizeHeader(key),
                value,
            ],
        ),
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
    const parsedValue =
        Number(value);

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
    const cellText =
        cleanText(value);

    /*
     * En la oferta FIET el valor 27 representa
     * una celda sin horario.
     */
    if (
        cellText === "" ||
        cellText === "27"
    ) {
        return null;
    }

    const match =
        cellText.match(
            /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(.*)/,
        );

    if (!match) {
        return null;
    }

    const startTime =
        normalizeHour(match[1]);

    const endTime =
        normalizeHour(match[2]);

    if (
        startTime === "" ||
        endTime === ""
    ) {
        return null;
    }

    const classroom =
        cleanText(match[3]);

    return {
        day,
        startTime,
        endTime,

        classroom:
            classroom ||
            "Salón por confirmar",
    };
};

const findOfferRows = (
    workbook: XLSX.WorkBook,
) => {
    for (
        const sheetName of
        workbook.SheetNames
    ) {
        const worksheet =
            workbook.Sheets[sheetName];

        const rawRows =
            XLSX.utils.sheet_to_json<
                RawAcademicOfferRow
            >(worksheet, {
                defval: "",
                raw: false,
            });

        if (rawRows.length === 0) {
            continue;
        }

        const normalizedRows =
            rawRows.map(normalizeRow);

        const headers =
            new Set(
                Object.keys(
                    normalizedRows[0],
                ),
            );

        const hasRequiredHeaders =
            REQUIRED_HEADERS.every(
                (header) =>
                    headers.has(header),
            );

        if (hasRequiredHeaders) {
            return normalizedRows;
        }
    }

    throw new Error(
        "El archivo no contiene la tabla estructurada de la oferta académica FIET. Usa el archivo OfertaFIET en formato XLSX, no el archivo visual HORARIOS FIET2.",
    );
};

const readAcademicOfferWorkbook = (
    fileBuffer: ArrayBuffer,
) => {
    try {
        return XLSX.read(fileBuffer);
    } catch (error) {
        const originalMessage =
            error instanceof Error
                ? error.message
                : "";

        const isProtectedFile =
            /password-protected|password protected|encrypted|password/i.test(
                originalMessage,
            );

        if (isProtectedFile) {
            throw new Error(
                "Este archivo XLS utiliza una protección antigua que el lector web no puede abrir. Usa el archivo OfertaFIET en formato XLSX. También puedes abrir el archivo en Excel o LibreOffice y guardarlo como XLSX sin contraseña, siempre que conserve la tabla de la oferta académica.",
            );
        }

        throw new Error(
            originalMessage
                ? `No fue posible leer el archivo: ${originalMessage}`
                : "No fue posible leer el archivo seleccionado.",
        );
    }
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

        const workbook =
            readAcademicOfferWorkbook(
                fileBuffer,
            );

        const rows =
            findOfferRows(workbook);

        const programRows =
            rows.filter(
                (row) =>
                    normalizeText(
                        row.PROGRAMA,
                    ) ===
                    normalizeText(
                        ACADEMIC_OFFER_PROGRAM,
                    ),
            );

        if (
            programRows.length === 0
        ) {
            throw new Error(
                "El archivo no contiene registros de Ingeniería Electrónica y Telecomunicaciones.",
            );
        }

        const groups =
            programRows
                .map(
                    (
                        row,
                    ): AcademicOfferGroup | null => {
                        const meetings =
                            DAY_COLUMNS
                                .map(
                                    ({
                                        column,
                                        day,
                                    }) =>
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

                        /*
                         * Las materias sin una franja semanal
                         * no se necesitan en la cuadrícula.
                         */
                        if (
                            meetings.length === 0
                        ) {
                            return null;
                        }

                        const period =
                            cleanText(
                                row.PERIODO,
                            );

                        const subjectCode =
                            cleanText(
                                row.CODIGO_MATERIA,
                            );

                        const subjectName =
                            cleanText(
                                row.MATERIA,
                            );

                        const group =
                            cleanText(
                                row.GRUPO,
                            );

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
                        firstGroup.subjectName
                            .localeCompare(
                                secondGroup.subjectName,
                                "es",
                            );

                    if (
                        nameComparison !== 0
                    ) {
                        return nameComparison;
                    }

                    return firstGroup.group
                        .localeCompare(
                            secondGroup.group,
                            "es",
                        );
                },
            );

        if (
            uniqueGroups.length === 0
        ) {
            throw new Error(
                "No se encontraron grupos con horarios de lunes a viernes.",
            );
        }

        const period =
            uniqueGroups[0].period;

        return {
            version: 1,

            fileName,

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