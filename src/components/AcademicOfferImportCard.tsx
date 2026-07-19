import {
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuCheck,
    LuFileSpreadsheet,
    LuLink,
    LuLoaderCircle,
    LuRefreshCw,
    LuTrash2,
    LuUpload,
} from "react-icons/lu";

import {
    parseAcademicOfferBuffer,
    parseAcademicOfferFile,
} from "../utils/academicOfferParser";

import type {
    AcademicOfferImportResult,
    ImportedAcademicOffer,
} from "../types/schedule";

interface AcademicOfferImportCardProps {
    importedOffer:
    | ImportedAcademicOffer
    | null;

    onImportOffer: (
        offer:
            ImportedAcademicOffer,
    ) =>
        | AcademicOfferImportResult
        | Promise<AcademicOfferImportResult>;

    onRemoveOffer:
    () => void | Promise<void>;
}

type ImportMethod =
    | "device"
    | "drive";

function AcademicOfferImportCard({
    importedOffer,
    onImportOffer,
    onRemoveOffer,
}: AcademicOfferImportCardProps) {
    const fileInputRef =
        useRef<HTMLInputElement>(
            null,
        );

    const [
        importMethod,
        setImportMethod,
    ] = useState<ImportMethod>(
        "device",
    );

    const [
        driveUrl,
        setDriveUrl,
    ] = useState("");

    const [
        isImporting,
        setIsImporting,
    ] = useState(false);

    const subjectCount =
        useMemo(() => {
            if (!importedOffer) {
                return 0;
            }

            return new Set(
                importedOffer.groups.map(
                    (group) =>
                        group.subjectName,
                ),
            ).size;
        }, [importedOffer]);

    const confirmReplacement =
        async () => {
            if (!importedOffer) {
                return true;
            }

            const result =
                await Swal.fire({
                    icon: "question",

                    title:
                        "¿Reemplazar la oferta importada?",

                    text:
                        "El nuevo archivo reemplazará el catálogo de materias y grupos. Las materias que agregaste desde la oferta se actualizarán automáticamente por código y grupo, incluyendo horario, docente y salón. Las materias manuales no cambiarán. Si un grupo ya no aparece en la nueva oferta, se conservará su horario actual y se mostrará una advertencia.",

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Sí, reemplazar",

                    cancelButtonText:
                        "Cancelar",

                    confirmButtonColor:
                        "#4f46e5",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,

                    focusCancel:
                        true,
                });

            return result.isConfirmed;
        };

    const handleRemoveImportedOffer =
        async () => {
            if (
                !importedOffer ||
                isImporting
            ) {
                return;
            }

            const result =
                await Swal.fire({
                    icon: "warning",

                    title:
                        "¿Eliminar la oferta importada?",

                    html: `
                    <div class="swal-confirmation-content">
                        <p>
                            Se eliminará el archivo o enlace
                            utilizado para importar la oferta
                            académica.
                        </p>

                        <p>
                            <strong>
                                También se borrarán todas las
                                materias y franjas registradas
                                actualmente en el horario.
                            </strong>
                        </p>

                        <p>
                            Después tendrás que construir el
                            horario manualmente o realizar una
                            nueva importación.
                        </p>
                    </div>
                `,

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Sí, borrar todo",

                    cancelButtonText:
                        "Conservar horario",

                    confirmButtonColor:
                        "#dc2626",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,

                    focusCancel:
                        true,

                    allowOutsideClick:
                        false,
                });

            if (
                !result.isConfirmed
            ) {
                return;
            }

            await onRemoveOffer();

            /*
             * También se limpia cualquier enlace que
             * permanezca escrito en el formulario.
             */
            setDriveUrl("");

            /*
             * Se limpia la selección interna del input,
             * aunque normalmente ya se reinicia después
             * de cada importación.
             */
            if (
                fileInputRef.current
            ) {
                fileInputRef.current.value =
                    "";
            }

            setImportMethod(
                "device",
            );

            await Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",

                title:
                    "Oferta y horario eliminados",

                text:
                    "Ahora puedes construir el horario manualmente o importar otra oferta.",

                showConfirmButton:
                    false,

                timer: 2600,

                timerProgressBar:
                    true,
            });
        };

    const completeImport =
        async (
            parsedOffer:
                ImportedAcademicOffer,
        ) => {
            const isReplacement =
                importedOffer !== null;

            const importResult =
                await onImportOffer(
                    parsedOffer,
                );

            const importedSubjectCount =
                new Set(
                    parsedOffer.groups.map(
                        (group) =>
                            group.subjectName,
                    ),
                ).size;

            const resultMessages: string[] = [
                `Se encontraron ${importedSubjectCount} materias y ${parsedOffer.groups.length} grupos para el periodo ${parsedOffer.period}.`,
            ];

            if (isReplacement) {
                if (
                    importResult.updatedSubjects >
                    0
                ) {
                    resultMessages.push(
                        `${importResult.updatedSubjects} ${importResult.updatedSubjects ===
                            1
                            ? "materia fue actualizada automáticamente"
                            : "materias fueron actualizadas automáticamente"
                        } con los nuevos horarios, docentes y salones.`,
                    );
                }

                if (
                    importResult.unchangedSubjects >
                    0
                ) {
                    resultMessages.push(
                        `${importResult.unchangedSubjects} ${importResult.unchangedSubjects ===
                            1
                            ? "materia no presentó cambios"
                            : "materias no presentaron cambios"
                        }.`,
                    );
                }

                if (
                    importResult
                        .unmatchedSubjects
                        .length >
                    0
                ) {
                    const visibleSubjects =
                        importResult
                            .unmatchedSubjects
                            .slice(
                                0,
                                5,
                            )
                            .join(", ");

                    const remainingCount =
                        importResult
                            .unmatchedSubjects
                            .length - 5;

                    resultMessages.push(
                        `No se encontró una coincidencia en la nueva oferta para: ${visibleSubjects}${remainingCount > 0
                            ? ` y ${remainingCount} más`
                            : ""
                        }. Sus horarios anteriores se conservaron.`,
                    );
                }

                if (
                    importResult.conflictCount >
                    0
                ) {
                    resultMessages.push(
                        `Después de la actualización se detectaron ${importResult.conflictCount} ${importResult.conflictCount ===
                            1
                            ? "cruce de horario"
                            : "cruces de horario"
                        }. Revisa la distribución semanal antes de confirmar.`,
                    );
                }
            }

            const hasWarnings =
                importResult
                    .unmatchedSubjects
                    .length >
                0 ||
                importResult.conflictCount >
                0;

            await Swal.fire({
                icon:
                    hasWarnings
                        ? "warning"
                        : "success",

                title:
                    hasWarnings
                        ? "Oferta reemplazada con observaciones"
                        : isReplacement
                            ? "Oferta y horario actualizados"
                            : "Oferta académica importada",

                text:
                    resultMessages.join(
                        " ",
                    ),

                confirmButtonText:
                    "Continuar",

                confirmButtonColor:
                    hasWarnings
                        ? "#f59e0b"
                        : "#16a34a",
            });
        };

    const showImportError =
        async (
            error: unknown,
        ) => {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "No fue posible leer el archivo seleccionado.";

            await Swal.fire({
                icon: "error",

                title:
                    "No se pudo importar el archivo",

                text:
                    errorMessage,

                confirmButtonText:
                    "Entendido",

                confirmButtonColor:
                    "#dc2626",
            });
        };

    const handleOpenFileSelector =
        () => {
            fileInputRef.current
                ?.click();
        };

    const handleFileChange =
        async (
            event:
                ChangeEvent<HTMLInputElement>,
        ) => {
            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            const canReplace =
                await confirmReplacement();

            if (!canReplace) {
                event.target.value =
                    "";

                return;
            }

            setIsImporting(true);

            try {
                const parsedOffer =
                    await parseAcademicOfferFile(
                        file,
                    );

                await completeImport(
                    parsedOffer,
                );
            } catch (error) {
                await showImportError(
                    error,
                );
            } finally {
                setIsImporting(false);

                event.target.value =
                    "";
            }
        };

    const handleDriveImport =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ) => {
            event.preventDefault();

            const normalizedDriveUrl =
                driveUrl.trim();

            if (
                normalizedDriveUrl ===
                ""
            ) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Pega el enlace de Drive",

                    text:
                        "Debes ingresar el enlace público del archivo OfertaFIET.",

                    confirmButtonText:
                        "Revisar",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }

            const canReplace =
                await confirmReplacement();

            if (!canReplace) {
                return;
            }

            setIsImporting(true);

            try {
                const response =
                    await fetch(
                        "/api/drive-file",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    url:
                                        normalizedDriveUrl,
                                }),
                        },
                    );

                if (!response.ok) {
                    const responseText =
                        await response.text();

                    let responseMessage =
                        "No fue posible descargar el archivo desde Google Drive.";

                    try {
                        const responseData =
                            JSON.parse(
                                responseText,
                            ) as {
                                message?: string;
                                details?: string;
                            };

                        responseMessage = [
                            responseData.message,
                            responseData.details,
                        ]
                            .filter(Boolean)
                            .join(" ");
                    } catch {
                        if (
                            responseText.trim() !==
                            ""
                        ) {
                            responseMessage =
                                responseText
                                    .replace(
                                        /<[^>]+>/g,
                                        " ",
                                    )
                                    .replace(
                                        /\s+/g,
                                        " ",
                                    )
                                    .trim()
                                    .slice(0, 500);
                        }
                    }

                    throw new Error(
                        responseMessage,
                    );
                }

                const encodedFileName =
                    response.headers.get(
                        "x-file-name",
                    );

                let fileName =
                    "OfertaFIET-Drive.xlsx";

                if (encodedFileName) {
                    try {
                        fileName =
                            decodeURIComponent(
                                encodedFileName,
                            );
                    } catch {
                        fileName =
                            "OfertaFIET-Drive.xlsx";
                    }
                }

                const fileBuffer =
                    await response.arrayBuffer();

                const parsedOffer =
                    await parseAcademicOfferBuffer(
                        fileBuffer,
                        fileName,
                    );

                await completeImport(
                    parsedOffer,
                );

                setDriveUrl("");
            } catch (error) {
                await showImportError(
                    error,
                );
            } finally {
                setIsImporting(false);
            }
        };

    return (
        <section className="academic-offer-import">
            <div className="academic-offer-import__icon">
                {isImporting ? (
                    <LuLoaderCircle
                        className="academic-offer-import__spinner"
                        aria-hidden="true"
                    />
                ) : importedOffer ? (
                    <LuCheck
                        aria-hidden="true"
                    />
                ) : (
                    <LuFileSpreadsheet
                        aria-hidden="true"
                    />
                )}
            </div>

            <div className="academic-offer-import__content">
                <p>
                    Oferta académica FIET
                </p>

                <h2>
                    {importedOffer
                        ? "Oferta importada"
                        : "Importar profesores, salones y grupos"}
                </h2>

                {importedOffer ? (
                    <div className="academic-offer-import__summary">
                        <span>
                            <strong>
                                Archivo:
                            </strong>{" "}
                            {
                                importedOffer.fileName
                            }
                        </span>

                        <span>
                            <strong>
                                Periodo:
                            </strong>{" "}
                            {
                                importedOffer.period
                            }
                        </span>

                        {importedOffer.sourceSheetName && (
                            <span>
                                <strong>
                                    Hoja detectada:
                                </strong>{" "}
                                {
                                    importedOffer.sourceSheetName
                                }
                            </span>
                        )}

                        {importedOffer.workbookSheetCount !== undefined && (
                            <span>
                                <strong>
                                    Hojas revisadas:
                                </strong>{" "}
                                {
                                    importedOffer.workbookSheetCount
                                }
                            </span>
                        )}

                        <span>
                            <strong>
                                Materias:
                            </strong>{" "}
                            {subjectCount}
                        </span>

                        <span>
                            <strong>
                                Grupos:
                            </strong>{" "}
                            {
                                importedOffer
                                    .groups.length
                            }
                        </span>
                    </div>
                ) : (
                    <p className="academic-offer-import__description">
                        Usa el archivo estructurado
                        OfertaFIET en formato XLSX. No
                        selecciones el archivo visual
                        HORARIOS FIET2.
                    </p>
                )}
            </div>

            {importedOffer && (
                <button
                    className="academic-offer-import__delete-button"
                    type="button"
                    disabled={
                        isImporting
                    }
                    onClick={() =>
                        void handleRemoveImportedOffer()
                    }
                    aria-label="Eliminar archivo o enlace importado"
                    title="Eliminar oferta importada y vaciar el horario"
                >
                    <LuTrash2
                        aria-hidden="true"
                    />
                </button>
            )}

            <div className="academic-offer-import__controls">
                <div className="academic-offer-import__methods">
                    <button
                        className={`academic-offer-import__method-button ${importMethod ===
                            "device"
                            ? "academic-offer-import__method-button--active"
                            : ""
                            }`}
                        type="button"
                        aria-pressed={
                            importMethod ===
                            "device"
                        }
                        onClick={() =>
                            setImportMethod(
                                "device",
                            )
                        }
                    >
                        <LuUpload
                            aria-hidden="true"
                        />

                        Desde este dispositivo
                    </button>

                    <button
                        className={`academic-offer-import__method-button ${importMethod ===
                            "drive"
                            ? "academic-offer-import__method-button--active"
                            : ""
                            }`}
                        type="button"
                        aria-pressed={
                            importMethod ===
                            "drive"
                        }
                        onClick={() =>
                            setImportMethod(
                                "drive",
                            )
                        }
                    >
                        <LuLink
                            aria-hidden="true"
                        />

                        Enlace de Google Drive
                    </button>
                </div>

                <div className="academic-offer-import__method-panel">
                    {importMethod ===
                        "device" ? (
                        <>
                            <input
                                ref={
                                    fileInputRef
                                }
                                className="academic-offer-import__input"
                                type="file"
                                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                onChange={
                                    handleFileChange
                                }
                            />

                            <div className="academic-offer-import__device">
                                <div>
                                    <strong>
                                        Seleccionar archivo
                                    </strong>

                                    <span>
                                        La OfertaFIET
                                        solo se permite en formato:
                                        .xlsx.
                                    </span>
                                </div>

                                <button
                                    className="academic-offer-import__button"
                                    type="button"
                                    disabled={
                                        isImporting
                                    }
                                    onClick={
                                        handleOpenFileSelector
                                    }
                                >
                                    {importedOffer ? (
                                        <LuRefreshCw
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <LuUpload
                                            aria-hidden="true"
                                        />
                                    )}

                                    {isImporting
                                        ? "Procesando"
                                        : importedOffer
                                            ? "Reemplazar archivo"
                                            : "Elegir archivo"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <form
                            className="academic-offer-drive-form"
                            onSubmit={
                                handleDriveImport
                            }
                        >
                            <label className="academic-offer-drive-field">
                                <span>
                                    Enlace público de Google
                                    Drive
                                </span>

                                <input
                                    type="url"
                                    value={
                                        driveUrl
                                    }
                                    placeholder="Pega aquí el enlace del archivo OfertaFIET"
                                    autoComplete="off"
                                    onChange={(
                                        event,
                                    ) =>
                                        setDriveUrl(
                                            event.target
                                                .value,
                                        )
                                    }
                                />

                                <small>
                                    El archivo debe estar
                                    compartido como “Cualquier
                                    persona con el enlace” y
                                    debe permitir su descarga.
                                </small>
                            </label>

                            <button
                                className="academic-offer-import__button academic-offer-import__button--drive"
                                type="submit"
                                disabled={
                                    isImporting
                                }
                            >
                                <LuLink
                                    aria-hidden="true"
                                />

                                {isImporting
                                    ? "Descargando"
                                    : importedOffer
                                        ? "Reemplazar desde Drive"
                                        : "Importar desde Drive"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}

export default AcademicOfferImportCard;