import {
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuCheck,
    LuFileSpreadsheet,
    LuLoaderCircle,
    LuRefreshCw,
    LuUpload,
} from "react-icons/lu";

import {
    parseAcademicOfferFile,
} from "../utils/academicOfferParser";

import type {
    ImportedAcademicOffer,
} from "../types/schedule";

interface AcademicOfferImportCardProps {
    importedOffer:
    | ImportedAcademicOffer
    | null;

    onImportOffer: (
        offer: ImportedAcademicOffer,
    ) => void | Promise<void>;
}

function AcademicOfferImportCard({
    importedOffer,
    onImportOffer,
}: AcademicOfferImportCardProps) {
    const fileInputRef =
        useRef<HTMLInputElement>(
            null,
        );

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

            if (importedOffer) {
                const replaceResult =
                    await Swal.fire({
                        icon: "question",

                        title:
                            "¿Reemplazar la oferta importada?",

                        text:
                            "El nuevo archivo reemplazará el catálogo de materias y grupos. Las materias que ya agregaste al horario permanecerán.",

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

                if (
                    !replaceResult.isConfirmed
                ) {
                    event.target.value =
                        "";

                    return;
                }
            }

            setIsImporting(true);

            try {
                const parsedOffer =
                    await parseAcademicOfferFile(
                        file,
                    );

                await onImportOffer(
                    parsedOffer,
                );

                const parsedSubjectCount =
                    new Set(
                        parsedOffer.groups.map(
                            (group) =>
                                group.subjectName,
                        ),
                    ).size;

                await Swal.fire({
                    icon: "success",

                    title:
                        "Oferta académica importada",

                    text:
                        `Se encontraron ${parsedSubjectCount} materias y ${parsedOffer.groups.length} grupos para el periodo ${parsedOffer.period}.`,

                    confirmButtonText:
                        "Continuar",

                    confirmButtonColor:
                        "#16a34a",
                });
            } catch (error) {
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
            } finally {
                setIsImporting(false);

                event.target.value =
                    "";
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
                        ? "Archivo importado"
                        : "Importar profesores, salones y grupos"}
                </h2>

                {importedOffer ? (
                    <div className="academic-offer-import__summary">
                        <span>
                            <strong>Archivo:</strong>{" "}
                            {importedOffer.fileName}
                        </span>

                        <span>
                            <strong>Periodo:</strong>{" "}
                            {importedOffer.period}
                        </span>

                        <span>
                            <strong>Materias:</strong>{" "}
                            {subjectCount}
                        </span>

                        <span>
                            <strong>Grupos:</strong>{" "}
                            {
                                importedOffer
                                    .groups.length
                            }
                        </span>
                    </div>
                ) : (
                    <p className="academic-offer-import__description">
                        Sube la oferta enviada por la
                        Universidad del Cauca. La aplicación
                        identificará únicamente los grupos de
                        Ingeniería Electrónica y
                        Telecomunicaciones.
                    </p>
                )}
            </div>

            <input
                ref={fileInputRef}
                className="academic-offer-import__input"
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={
                    handleFileChange
                }
            />

            <button
                className="academic-offer-import__button"
                type="button"
                disabled={isImporting}
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
                    ? "Procesando archivo"
                    : importedOffer
                        ? "Reemplazar Excel"
                        : "Subir archivo Excel"}
            </button>
        </section>
    );
}

export default AcademicOfferImportCard;