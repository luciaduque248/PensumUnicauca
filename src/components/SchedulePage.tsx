import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuBookOpen,
    LuCalendarDays,
    LuClock3,
    LuMoon,
    LuPencil,
    LuPlus,
    LuSave,
    LuSun,
    LuTrash2,
    LuX,
    LuBadgeCheck,
} from "react-icons/lu";

import ScheduleGrid from "./ScheduleGrid";
import AcademicOfferClassForm from "./AcademicOfferClassForm";
import AcademicOfferImportCard from "./AcademicOfferImportCard";

import type {
    ImportedAcademicOffer,
    ScheduleClass,
    ScheduleDay,
} from "../types/schedule";

interface SchedulePageProps {
    themeMode: "light" | "dark";

    scheduleClasses: ScheduleClass[];

    availableSubjectNames: string[];

    importedOffer:
    | ImportedAcademicOffer
    | null;

    isScheduleConfirmed: boolean;

    confirmedAt: string | null;

    onImportOffer: (
        importedOffer:
            ImportedAcademicOffer,
    ) => void | Promise<void>;

    onRemoveOffer:
    () => void | Promise<void>;

    onConfirmSchedule:
    () => void | Promise<void>;

    onToggleTheme: () => void;

    onAddClasses: (
        scheduleClasses: Array<
            Omit<ScheduleClass, "id">
        >,
    ) => void | Promise<void>;

    onUpdateSubject: (
        originalSubjectName: string,
        scheduleClasses: Array<
            Omit<ScheduleClass, "id">
        >,
    ) => void | Promise<void>;

    onDeleteSubject: (
        subjectName: string,
    ) => void | Promise<void>;
}

interface ScheduleMeetingDraft {
    day: ScheduleDay | "";
    startTime: string;
    endTime: string;
}

interface ScheduleSubjectGroup {
    subjectName: string;
    classes: ScheduleClass[];
}

type WeeklyMeetingCount =
    | 1
    | 2;

const dayLabels: Record<
    ScheduleDay,
    string
> = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
};

const dayOrder: Record<
    ScheduleDay,
    number
> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
};

const createEmptyMeeting =
    (): ScheduleMeetingDraft => ({
        day: "",
        startTime: "",
        endTime: "",
    });

const startHourOptions =
    Array.from(
        { length: 16 },
        (_, index) => {
            const hour =
                index + 7;

            return `${String(hour).padStart(
                2,
                "0",
            )}:00`;
        },
    );

const endHourOptions =
    Array.from(
        { length: 16 },
        (_, index) => {
            const hour =
                index + 8;

            return `${String(hour).padStart(
                2,
                "0",
            )}:00`;
        },
    );

const formatScheduleTime = (
    value: string,
) => {
    const [
        hourText,
        minuteText = "00",
    ] = value.split(":");

    const hour =
        Number(hourText);

    const period =
        hour < 12
            ? "a. m."
            : "p. m.";

    const displayedHour =
        hour % 12 || 12;

    return `${displayedHour}:${minuteText} ${period}`;
};

/*
 * Las horas se convierten a minutos para evitar
 * comparaciones incorrectas entre textos.
 *
 * Ejemplos:
 * 07:00 -> 420
 * 09:00 -> 540
 * 13:00 -> 780
 */
const timeToMinutes = (
    value: string,
) => {
    const [
        hourText,
        minuteText = "0",
    ] = value.split(":");

    const hour =
        Number(hourText);

    const minutes =
        Number(minuteText);

    return (
        hour * 60 +
        minutes
    );
};

const normalizeSearchText = (
    value: string,
) => {
    return value
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLowerCase()
        .trim();
};

const meetingsOverlap = (
    firstMeeting: ScheduleMeetingDraft,
    secondMeeting: ScheduleMeetingDraft,
) => {
    if (
        firstMeeting.day === "" ||
        secondMeeting.day === "" ||
        firstMeeting.day !==
        secondMeeting.day
    ) {
        return false;
    }

    const firstStart =
        timeToMinutes(
            firstMeeting.startTime,
        );

    const firstEnd =
        timeToMinutes(
            firstMeeting.endTime,
        );

    const secondStart =
        timeToMinutes(
            secondMeeting.startTime,
        );

    const secondEnd =
        timeToMinutes(
            secondMeeting.endTime,
        );

    return (
        firstStart < secondEnd &&
        firstEnd > secondStart
    );
};

const scheduleClassesOverlap = (
    meeting: ScheduleMeetingDraft,
    scheduleClass: ScheduleClass,
) => {
    if (
        meeting.day === "" ||
        meeting.day !==
        scheduleClass.day
    ) {
        return false;
    }

    const meetingStart =
        timeToMinutes(
            meeting.startTime,
        );

    const meetingEnd =
        timeToMinutes(
            meeting.endTime,
        );

    const existingStart =
        timeToMinutes(
            scheduleClass.startTime,
        );

    const existingEnd =
        timeToMinutes(
            scheduleClass.endTime,
        );

    /*
     * Se considera cruce solamente cuando las franjas
     * ocupan realmente parte del mismo intervalo.
     *
     * 07:00 a 09:00 y 09:00 a 11:00:
     * no se cruzan.
     *
     * 07:00 a 09:00 y 08:00 a 10:00:
     * sí se cruzan.
     */
    return (
        meetingStart < existingEnd &&
        meetingEnd > existingStart
    );
};

function SchedulePage({
    themeMode,
    scheduleClasses,
    availableSubjectNames,

    importedOffer,
    isScheduleConfirmed,
    confirmedAt,

    onToggleTheme,
    onImportOffer,
    onRemoveOffer,
    onConfirmSchedule,
    onAddClasses,
    onUpdateSubject,
    onDeleteSubject,
}: SchedulePageProps) {
    const [
        subjectName,
        setSubjectName,
    ] = useState("");

    const [
        editingSubjectName,
        setEditingSubjectName,
    ] = useState<
        string | null
    >(null);

    const [
        showSubjectSuggestions,
        setShowSubjectSuggestions,
    ] = useState(false);

    const [
        weeklyMeetingCount,
        setWeeklyMeetingCount,
    ] = useState<WeeklyMeetingCount>(
        2,
    );

    const [
        meetings,
        setMeetings,
    ] = useState<
        ScheduleMeetingDraft[]
    >([
        createEmptyMeeting(),
        createEmptyMeeting(),
    ]);

    const filteredSubjectNames =
        useMemo(() => {
            const normalizedSubjectName =
                normalizeSearchText(
                    subjectName,
                );

            if (
                normalizedSubjectName ===
                ""
            ) {
                return [];
            }

            return availableSubjectNames
                .filter(
                    (availableName) =>
                        normalizeSearchText(
                            availableName,
                        ).includes(
                            normalizedSubjectName,
                        ),
                )
                .slice(0, 8);
        }, [
            subjectName,
            availableSubjectNames,
        ]);

    const sortedScheduleClasses =
        useMemo(() => {
            return [
                ...scheduleClasses,
            ].sort(
                (
                    firstClass,
                    secondClass,
                ) => {
                    const dayDifference =
                        dayOrder[
                        firstClass.day
                        ] -
                        dayOrder[
                        secondClass.day
                        ];

                    if (
                        dayDifference !==
                        0
                    ) {
                        return dayDifference;
                    }

                    return timeToMinutes(
                        firstClass.startTime,
                    ) -
                        timeToMinutes(
                            secondClass.startTime,
                        );
                },
            );
        }, [scheduleClasses]);

    /*
     * Agrupa todas las franjas que tengan el mismo
     * nombre de materia.
     */
    const groupedScheduleSubjects =
        useMemo(() => {
            const groups =
                new Map<
                    string,
                    ScheduleSubjectGroup
                >();

            sortedScheduleClasses.forEach(
                (scheduleClass) => {
                    const normalizedName =
                        normalizeSearchText(
                            scheduleClass.subjectName,
                        );

                    const existingGroup =
                        groups.get(
                            normalizedName,
                        );

                    if (existingGroup) {
                        existingGroup.classes.push(
                            scheduleClass,
                        );

                        return;
                    }

                    groups.set(
                        normalizedName,
                        {
                            subjectName:
                                scheduleClass.subjectName,

                            classes: [
                                scheduleClass,
                            ],
                        },
                    );
                },
            );

            return Array.from(
                groups.values(),
            );
        }, [
            sortedScheduleClasses,
        ]);

    const resetForm = () => {
        setSubjectName("");

        setEditingSubjectName(
            null,
        );

        setWeeklyMeetingCount(
            2,
        );

        setMeetings([
            createEmptyMeeting(),
            createEmptyMeeting(),
        ]);

        setShowSubjectSuggestions(
            false,
        );
    };

    const updateMeeting = (
        meetingIndex: number,
        field:
            | "day"
            | "startTime"
            | "endTime",
        value: string,
    ) => {
        setMeetings(
            (currentMeetings) =>
                currentMeetings.map(
                    (
                        currentMeeting,
                        currentIndex,
                    ) => {
                        if (
                            currentIndex !==
                            meetingIndex
                        ) {
                            return currentMeeting;
                        }

                        const updatedMeeting = {
                            ...currentMeeting,
                            [field]: value,
                        } as ScheduleMeetingDraft;

                        if (
                            field === "startTime" &&
                            updatedMeeting.endTime !==
                            "" &&
                            timeToMinutes(
                                updatedMeeting.endTime,
                            ) <=
                            timeToMinutes(
                                value,
                            )
                        ) {
                            updatedMeeting.endTime =
                                "";
                        }

                        return updatedMeeting;
                    },
                ),
        );
    };

    const handleMeetingCountChange = (
        count: WeeklyMeetingCount,
    ) => {
        setWeeklyMeetingCount(
            count,
        );

        if (count === 1) {
            setMeetings(
                (currentMeetings) => [
                    currentMeetings[0],
                    createEmptyMeeting(),
                ],
            );
        }
    };

    const handleSelectSubject = (
        selectedSubjectName: string,
    ) => {
        setSubjectName(
            selectedSubjectName,
        );

        setShowSubjectSuggestions(
            false,
        );
    };

    const handleEditSubject = (
        scheduleSubject:
            ScheduleSubjectGroup,
    ) => {
        const subjectClasses = [
            ...scheduleSubject.classes,
        ].sort(
            (
                firstClass,
                secondClass,
            ) => {
                const dayDifference =
                    dayOrder[
                    firstClass.day
                    ] -
                    dayOrder[
                    secondClass.day
                    ];

                if (
                    dayDifference !== 0
                ) {
                    return dayDifference;
                }

                return timeToMinutes(
                    firstClass.startTime,
                ) -
                    timeToMinutes(
                        secondClass.startTime,
                    );
            },
        );

        const meetingCount:
            WeeklyMeetingCount =
            subjectClasses.length >= 2
                ? 2
                : 1;

        setEditingSubjectName(
            scheduleSubject.subjectName,
        );

        setSubjectName(
            scheduleSubject.subjectName,
        );

        setWeeklyMeetingCount(
            meetingCount,
        );

        setMeetings([
            subjectClasses[0]
                ? {
                    day:
                        subjectClasses[0].day,

                    startTime:
                        subjectClasses[0]
                            .startTime,

                    endTime:
                        subjectClasses[0]
                            .endTime,
                }
                : createEmptyMeeting(),

            subjectClasses[1]
                ? {
                    day:
                        subjectClasses[1].day,

                    startTime:
                        subjectClasses[1]
                            .startTime,

                    endTime:
                        subjectClasses[1]
                            .endTime,
                }
                : createEmptyMeeting(),
        ]);

        setShowSubjectSuggestions(
            false,
        );

        window.setTimeout(
            () => {
                document
                    .querySelector(
                        ".schedule-form",
                    )
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
            },
            0,
        );
    };

    const handleDeleteSubject =
        async (
            scheduleSubject:
                ScheduleSubjectGroup,
        ) => {
            const result =
                await Swal.fire({
                    icon: "warning",

                    title:
                        "¿Eliminar esta materia?",

                    text:
                        `Se eliminarán todos los horarios registrados para ${scheduleSubject.subjectName}.`,

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Sí, eliminar",

                    cancelButtonText:
                        "Cancelar",

                    confirmButtonColor:
                        "#dc2626",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,

                    focusCancel:
                        true,
                });

            if (
                !result.isConfirmed
            ) {
                return;
            }

            await onDeleteSubject(
                scheduleSubject.subjectName,
            );

            if (
                editingSubjectName !==
                null &&
                normalizeSearchText(
                    editingSubjectName,
                ) ===
                normalizeSearchText(
                    scheduleSubject.subjectName,
                )
            ) {
                resetForm();
            }

            await Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",

                title:
                    "Materia eliminada",

                text:
                    "Sus franjas fueron retiradas del horario.",

                showConfirmButton:
                    false,

                timer: 2200,
                timerProgressBar:
                    true,
            });
        };

    const handleConfirmCurrentSchedule =
        async () => {
            if (
                scheduleClasses.length === 0
            ) {
                await Swal.fire({
                    icon: "info",

                    title:
                        "El horario está vacío",

                    text:
                        "Agrega al menos una materia antes de confirmar el horario.",

                    confirmButtonText:
                        "Entendido",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }

            const result =
                await Swal.fire({
                    icon: "question",

                    title:
                        "¿Confirmar este horario?",

                    text:
                        "Después de confirmarlo podrás seguir agregando, editando o eliminando materias por adiciones y cancelaciones. Sin embargo, ya no podrás subir ni reemplazar el archivo Excel de la oferta académica.",

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Sí, confirmar horario",

                    cancelButtonText:
                        "Seguir revisando",

                    confirmButtonColor:
                        "#16a34a",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,

                    focusCancel:
                        true,

                    allowOutsideClick:
                        false,
                });

            if (!result.isConfirmed) {
                return;
            }

            await onConfirmSchedule();

            await Swal.fire({
                icon: "success",

                title:
                    "Horario confirmado",

                text:
                    "El horario quedó confirmado. Todavía podrás agregar, editar o eliminar materias, pero la importación del Excel quedó cerrada.",

                confirmButtonText:
                    "Continuar",

                confirmButtonColor:
                    "#16a34a",
            });
        };

    const formattedConfirmationDate =
        confirmedAt
            ? new Intl.DateTimeFormat(
                "es-CO",
                {
                    dateStyle: "medium",
                    timeStyle: "short",
                },
            ).format(
                new Date(confirmedAt),
            )
            : "";

    const handleSubmit = async (
        event:
            FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const normalizedSubjectName =
            subjectName.trim();

        if (
            normalizedSubjectName ===
            ""
        ) {
            await Swal.fire({
                icon: "warning",

                title:
                    "Escribe el nombre de la materia",

                text:
                    "Selecciona una materia de las sugerencias o escribe su nombre completo.",

                confirmButtonText:
                    "Revisar formulario",

                confirmButtonColor:
                    "#4f46e5",
            });

            return;
        }

        /*
         * Cuando se está creando una materia nueva,
         * no se permite duplicar otra tarjeta con
         * el mismo nombre.
         */
        if (
            editingSubjectName ===
            null &&
            scheduleClasses.some(
                (scheduleClass) =>
                    normalizeSearchText(
                        scheduleClass.subjectName,
                    ) ===
                    normalizeSearchText(
                        normalizedSubjectName,
                    ),
            )
        ) {
            await Swal.fire({
                icon: "info",

                title:
                    "La materia ya está registrada",

                text:
                    "Usa el botón Editar de la materia para modificar o completar sus horarios.",

                confirmButtonText:
                    "Entendido",

                confirmButtonColor:
                    "#4f46e5",
            });

            return;
        }

        const activeMeetings =
            meetings.slice(
                0,
                weeklyMeetingCount,
            );

        for (
            let meetingIndex = 0;
            meetingIndex <
            activeMeetings.length;
            meetingIndex += 1
        ) {
            const meeting =
                activeMeetings[
                meetingIndex
                ];

            if (
                meeting.day === "" ||
                meeting.startTime === "" ||
                meeting.endTime === ""
            ) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Completa todos los horarios",

                    text:
                        `Falta información en el horario ${meetingIndex + 1
                        }. Debes seleccionar día, hora inicial y hora final.`,

                    confirmButtonText:
                        "Revisar formulario",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }

            if (
                timeToMinutes(
                    meeting.startTime,
                ) >=
                timeToMinutes(
                    meeting.endTime,
                )
            ) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Horario no válido",

                    text:
                        `En el horario ${meetingIndex + 1
                        }, la hora final debe ser posterior a la hora inicial.`,

                    confirmButtonText:
                        "Corregir",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }
        }

        if (
            weeklyMeetingCount ===
            2 &&
            meetingsOverlap(
                activeMeetings[0],
                activeMeetings[1],
            )
        ) {
            await Swal.fire({
                icon: "warning",

                title:
                    "Los dos horarios se cruzan",

                text:
                    "Los dos encuentros de la materia no pueden ocupar la misma hora del mismo día.",

                confirmButtonText:
                    "Corregir horarios",

                confirmButtonColor:
                    "#f59e0b",
            });

            return;
        }

        /*
         * Al editar se excluyen del análisis las
         * franjas originales de la materia editada.
         */
        const classesForOverlapCheck =
            editingSubjectName ===
                null
                ? scheduleClasses
                : scheduleClasses.filter(
                    (scheduleClass) =>
                        normalizeSearchText(
                            scheduleClass.subjectName,
                        ) !==
                        normalizeSearchText(
                            editingSubjectName,
                        ),
                );

        for (
            let meetingIndex = 0;
            meetingIndex <
            activeMeetings.length;
            meetingIndex += 1
        ) {
            const meeting =
                activeMeetings[
                meetingIndex
                ];

            const meetingDay =
                meeting.day as ScheduleDay;

            const overlappingClass =
                classesForOverlapCheck.find(
                    (scheduleClass) =>
                        scheduleClassesOverlap(
                            meeting,
                            scheduleClass,
                        ),
                );

            if (overlappingClass) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Cruce de horario",

                    text:
                        `${overlappingClass.subjectName} ya ocupa el ${dayLabels[meetingDay]}, de ${formatScheduleTime(
                            overlappingClass.startTime,
                        )} a ${formatScheduleTime(
                            overlappingClass.endTime,
                        )}.`,

                    confirmButtonText:
                        "Cambiar horario",

                    confirmButtonColor:
                        "#f59e0b",
                });

                return;
            }
        }

        const updatedClasses =
            activeMeetings.map(
                (meeting) => ({
                    subjectName:
                        normalizedSubjectName,

                    day:
                        meeting.day as ScheduleDay,

                    startTime:
                        meeting.startTime,

                    endTime:
                        meeting.endTime,
                }),
            );

        const wasEditing =
            editingSubjectName !==
            null;

        if (
            editingSubjectName !==
            null
        ) {
            await onUpdateSubject(
                editingSubjectName,
                updatedClasses,
            );
        } else {
            await onAddClasses(
                updatedClasses,
            );
        }

        resetForm();

        await Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",

            title:
                wasEditing
                    ? "Materia actualizada"
                    : "Materia agregada",

            text:
                wasEditing
                    ? "Los horarios fueron modificados."
                    : weeklyMeetingCount ===
                        1
                        ? "Se guardó una franja en el horario."
                        : "Se guardaron las dos franjas en el horario.",

            showConfirmButton:
                false,

            timer: 2200,
            timerProgressBar:
                true,
        });
    };

    return (
        <div className="schedule-page">
            <header className="schedule-header">
                <div className="schedule-header__content">
                    <div className="schedule-header__intro">
                        <p className="schedule-header__eyebrow">
                            Organización del semestre
                        </p>

                        <div className="schedule-header__title">
                            <LuCalendarDays
                                aria-hidden="true"
                            />

                            <h1>
                                Horario académico
                            </h1>
                        </div>

                        <p className="schedule-header__description">
                            Registra tus materias y organiza su distribución semanal de lunes a viernes.
                        </p>
                    </div>

                    <button
                        className="schedule-header__theme-button"
                        type="button"
                        onClick={
                            onToggleTheme
                        }
                        aria-label={
                            themeMode === "dark"
                                ? "Activar modo claro"
                                : "Activar modo oscuro"
                        }
                    >
                        {themeMode ===
                            "dark" ? (
                            <LuSun
                                aria-hidden="true"
                            />
                        ) : (
                            <LuMoon
                                aria-hidden="true"
                            />
                        )}

                        {themeMode ===
                            "dark"
                            ? "Modo claro"
                            : "Modo oscuro"}
                    </button>
                </div>
            </header>

            <main className="schedule-main">
                <section
                    className={`schedule-confirmation ${isScheduleConfirmed
                        ? "schedule-confirmation--confirmed"
                        : ""
                        }`}
                >
                    <div>
                        <p>
                            Estado del horario
                        </p>

                        <h2>
                            {isScheduleConfirmed
                                ? "Horario confirmado"
                                : "Horario en construcción"}
                        </h2>

                        <span>
                            {isScheduleConfirmed
                                ? `Confirmado ${formattedConfirmationDate}. Puedes seguir realizando adiciones, cancelaciones o ajustes manuales.`
                                : "Revisa las materias y confirma cuando hayas terminado de construir tu horario."}
                        </span>
                    </div>

                    {isScheduleConfirmed ? (
                        <span className="schedule-confirmation__badge">
                            <LuBadgeCheck
                                aria-hidden="true"
                            />

                            Confirmado
                        </span>
                    ) : (
                        <button
                            className="schedule-confirmation__button"
                            type="button"
                            onClick={
                                handleConfirmCurrentSchedule
                            }
                        >
                            <LuBadgeCheck
                                aria-hidden="true"
                            />

                            Confirmar horario
                        </button>
                    )}
                </section>

                {/*
   * El importador desaparece completamente
   * después de confirmar el horario.
   */}
                {!isScheduleConfirmed && (
                    <AcademicOfferImportCard
                        importedOffer={
                            importedOffer
                        }

                        onImportOffer={
                            onImportOffer
                        }

                        onRemoveOffer={
                            onRemoveOffer
                        }
                    />
                )}

                {/*
   * La oferta importada se conserva después de
   * confirmar, para permitir futuras adiciones.
   */}
                {importedOffer && (
                    <AcademicOfferClassForm
                        importedOffer={
                            importedOffer
                        }
                        scheduleClasses={
                            scheduleClasses
                        }
                        onAddClasses={
                            onAddClasses
                        }
                    />
                )}

                <div className="schedule-builder">
                    <form
                        className="schedule-form"
                        onSubmit={
                            handleSubmit
                        }
                    >
                        <div className="schedule-form__heading">
                            <span
                                className="schedule-form__heading-icon"
                                aria-hidden="true"
                            >
                                <LuBookOpen />
                            </span>

                            <div>
                                <p>
                                    {editingSubjectName
                                        ? "Editando materia"
                                        : importedOffer
                                            ? "Registro manual"
                                            : "Nueva materia"}
                                </p>

                                <h2>
                                    {editingSubjectName
                                        ? "Modificar materia"
                                        : importedOffer
                                            ? "Agregar o ajustar manualmente"
                                            : "Agregar al horario"}
                                </h2>

                                <span>
                                    Puedes registrar uno o dos encuentros semanales.
                                </span>
                            </div>
                        </div>

                        {editingSubjectName && (
                            <div className="schedule-form__editing-note">
                                <LuPencil
                                    aria-hidden="true"
                                />

                                <div>
                                    <strong>
                                        Estás editando:
                                    </strong>

                                    <span>
                                        {
                                            editingSubjectName
                                        }
                                    </span>
                                </div>
                            </div>
                        )}

                        <section className="schedule-form-question">
                            <span className="schedule-form-question__number">
                                1
                            </span>

                            <div className="schedule-form-question__content">
                                <strong>
                                    Nombre de la materia
                                </strong>

                                <small>
                                    Escribe para buscar una materia del pensum.
                                </small>

                                <div className="schedule-subject-autocomplete">
                                    <input
                                        type="text"
                                        value={
                                            subjectName
                                        }
                                        placeholder="Ejemplo: Comunicaciones Digitales"
                                        autoComplete="off"
                                        onFocus={() =>
                                            setShowSubjectSuggestions(
                                                true,
                                            )
                                        }
                                        onChange={(
                                            event,
                                        ) => {
                                            setSubjectName(
                                                event.target
                                                    .value,
                                            );

                                            setShowSubjectSuggestions(
                                                true,
                                            );
                                        }}
                                        onBlur={() => {
                                            window.setTimeout(
                                                () =>
                                                    setShowSubjectSuggestions(
                                                        false,
                                                    ),
                                                120,
                                            );
                                        }}
                                    />

                                    {showSubjectSuggestions &&
                                        filteredSubjectNames.length >
                                        0 && (
                                            <div className="schedule-subject-autocomplete__menu">
                                                {filteredSubjectNames.map(
                                                    (
                                                        availableName,
                                                    ) => (
                                                        <button
                                                            type="button"
                                                            key={
                                                                availableName
                                                            }
                                                            onMouseDown={(
                                                                event,
                                                            ) =>
                                                                event.preventDefault()
                                                            }
                                                            onClick={() =>
                                                                handleSelectSubject(
                                                                    availableName,
                                                                )
                                                            }
                                                        >
                                                            {
                                                                availableName
                                                            }
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                </div>
                            </div>
                        </section>

                        <section className="schedule-form-question">
                            <span className="schedule-form-question__number">
                                2
                            </span>

                            <div className="schedule-form-question__content">
                                <strong>
                                    ¿Cuántas veces ves esta materia por semana?
                                </strong>

                                <small>
                                    Selecciona una o dos franjas.
                                </small>

                                <div className="schedule-frequency-options">
                                    <label>
                                        <input
                                            type="radio"
                                            name="weeklyMeetingCount"
                                            checked={
                                                weeklyMeetingCount ===
                                                1
                                            }
                                            onChange={() =>
                                                handleMeetingCountChange(
                                                    1,
                                                )
                                            }
                                        />

                                        <span>
                                            <strong>
                                                Una vez
                                            </strong>

                                            <small>
                                                Se mostrará un horario.
                                            </small>
                                        </span>
                                    </label>

                                    <label>
                                        <input
                                            type="radio"
                                            name="weeklyMeetingCount"
                                            checked={
                                                weeklyMeetingCount ===
                                                2
                                            }
                                            onChange={() =>
                                                handleMeetingCountChange(
                                                    2,
                                                )
                                            }
                                        />

                                        <span>
                                            <strong>
                                                Dos veces
                                            </strong>

                                            <small>
                                                Se mostrarán dos horarios.
                                            </small>
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </section>

                        {meetings
                            .slice(
                                0,
                                weeklyMeetingCount,
                            )
                            .map(
                                (
                                    meeting,
                                    meetingIndex,
                                ) => (
                                    <section
                                        className="schedule-form-question schedule-form-question--meeting"
                                        key={
                                            meetingIndex
                                        }
                                    >
                                        <span className="schedule-form-question__number">
                                            {meetingIndex +
                                                3}
                                        </span>

                                        <div className="schedule-form-question__content">
                                            <strong>
                                                {meetingIndex ===
                                                    0
                                                    ? "Primer horario"
                                                    : "Segundo horario"}
                                            </strong>

                                            <small>
                                                Selecciona el día y la franja en que se dicta la clase.
                                            </small>

                                            <div className="schedule-meeting-fields">
                                                <label>
                                                    <span>
                                                        Día
                                                    </span>

                                                    <select
                                                        value={
                                                            meeting.day
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            updateMeeting(
                                                                meetingIndex,
                                                                "day",
                                                                event
                                                                    .target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Selecciona
                                                        </option>
                                                        <option value="monday">
                                                            Lunes
                                                        </option>
                                                        <option value="tuesday">
                                                            Martes
                                                        </option>
                                                        <option value="wednesday">
                                                            Miércoles
                                                        </option>
                                                        <option value="thursday">
                                                            Jueves
                                                        </option>
                                                        <option value="friday">
                                                            Viernes
                                                        </option>
                                                    </select>
                                                </label>

                                                <label>
                                                    <span>
                                                        Desde
                                                    </span>

                                                    <select
                                                        value={
                                                            meeting.startTime
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            updateMeeting(
                                                                meetingIndex,
                                                                "startTime",
                                                                event
                                                                    .target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Hora inicial
                                                        </option>

                                                        {startHourOptions.map(
                                                            (hour) => (
                                                                <option
                                                                    value={
                                                                        hour
                                                                    }
                                                                    key={
                                                                        hour
                                                                    }
                                                                >
                                                                    {formatScheduleTime(
                                                                        hour,
                                                                    )}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </label>

                                                <label>
                                                    <span>
                                                        Hasta
                                                    </span>

                                                    <select
                                                        value={
                                                            meeting.endTime
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            updateMeeting(
                                                                meetingIndex,
                                                                "endTime",
                                                                event
                                                                    .target
                                                                    .value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Hora final
                                                        </option>

                                                        {endHourOptions
                                                            .filter(
                                                                (
                                                                    hour,
                                                                ) =>
                                                                    meeting.startTime ===
                                                                    "" ||
                                                                    timeToMinutes(
                                                                        hour,
                                                                    ) >
                                                                    timeToMinutes(
                                                                        meeting.startTime,
                                                                    ),
                                                            )
                                                            .map(
                                                                (hour) => (
                                                                    <option
                                                                        value={
                                                                            hour
                                                                        }
                                                                        key={
                                                                            hour
                                                                        }
                                                                    >
                                                                        {formatScheduleTime(
                                                                            hour,
                                                                        )}
                                                                    </option>
                                                                ),
                                                            )}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>
                                    </section>
                                ),
                            )}

                        <div className="schedule-form__actions">
                            {editingSubjectName && (
                                <button
                                    className="schedule-form__cancel-edit"
                                    type="button"
                                    onClick={
                                        resetForm
                                    }
                                >
                                    <LuX
                                        aria-hidden="true"
                                    />

                                    Cancelar edición
                                </button>
                            )}

                            <button
                                className="schedule-form__submit"
                                type="submit"
                            >
                                {editingSubjectName ? (
                                    <LuSave
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <LuPlus
                                        aria-hidden="true"
                                    />
                                )}

                                {editingSubjectName
                                    ? "Guardar cambios"
                                    : "Agregar al horario"}
                            </button>
                        </div>
                    </form>

                    <aside className="schedule-saved">
                        <div className="schedule-saved__header">
                            <div>
                                <p>Resumen</p>

                                <h2>
                                    Materias guardadas
                                </h2>
                            </div>

                            <span className="schedule-saved__count">
                                {
                                    groupedScheduleSubjects.length
                                }
                            </span>
                        </div>

                        {groupedScheduleSubjects.length ===
                            0 ? (
                            <div className="schedule-saved__empty">
                                <span
                                    aria-hidden="true"
                                >
                                    <LuClock3 />
                                </span>

                                <strong>
                                    No hay materias registradas
                                </strong>

                                <p>
                                    Las materias aparecerán aquí y en la cuadrícula semanal.
                                </p>
                            </div>
                        ) : (
                            <div className="schedule-saved__list">
                                {groupedScheduleSubjects.map(
                                    (scheduleSubject) => {
                                        const referenceClass =
                                            scheduleSubject.classes[0];

                                        return (
                                            <article
                                                className="schedule-saved__item schedule-saved__item--grouped"
                                                key={
                                                    normalizeSearchText(
                                                        scheduleSubject.subjectName,
                                                    )
                                                }
                                            >
                                                <div className="schedule-saved__item-header">
                                                    <div className="schedule-saved__item-title">
                                                        <h3>
                                                            {
                                                                scheduleSubject
                                                                    .subjectName
                                                            }
                                                        </h3>

                                                        {referenceClass
                                                            ?.group && (
                                                                <span>
                                                                    Grupo{" "}
                                                                    {
                                                                        referenceClass
                                                                            .group
                                                                    }
                                                                </span>
                                                            )}
                                                    </div>

                                                    <div className="schedule-saved__item-actions">
                                                        <button
                                                            className="schedule-saved__edit-button"
                                                            type="button"
                                                            onClick={() =>
                                                                handleEditSubject(
                                                                    scheduleSubject,
                                                                )
                                                            }
                                                        >
                                                            <LuPencil
                                                                aria-hidden="true"
                                                            />

                                                            Editar
                                                        </button>

                                                        <button
                                                            className="schedule-saved__delete-button"
                                                            type="button"
                                                            onClick={() =>
                                                                handleDeleteSubject(
                                                                    scheduleSubject,
                                                                )
                                                            }
                                                        >
                                                            <LuTrash2
                                                                aria-hidden="true"
                                                            />

                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>

                                                {referenceClass
                                                    ?.teacher && (
                                                        <p className="schedule-saved__teacher">
                                                            <strong>
                                                                Docente:
                                                            </strong>{" "}
                                                            {
                                                                referenceClass
                                                                    .teacher
                                                            }
                                                        </p>
                                                    )}

                                                <div className="schedule-saved__meeting-list">
                                                    {scheduleSubject.classes.map(
                                                        (scheduleClass) => (
                                                            <div
                                                                className="schedule-saved__meeting"
                                                                key={
                                                                    scheduleClass.id
                                                                }
                                                            >
                                                                <span className="schedule-saved__item-day">
                                                                    {
                                                                        dayLabels[
                                                                        scheduleClass.day
                                                                        ]
                                                                    }
                                                                </span>

                                                                <div className="schedule-saved__meeting-information">
                                                                    <p>
                                                                        {formatScheduleTime(
                                                                            scheduleClass.startTime,
                                                                        )}
                                                                        {" — "}
                                                                        {formatScheduleTime(
                                                                            scheduleClass.endTime,
                                                                        )}
                                                                    </p>

                                                                    {scheduleClass
                                                                        .classroom && (
                                                                            <small>
                                                                                {
                                                                                    scheduleClass
                                                                                        .classroom
                                                                                }
                                                                            </small>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    },
                                )}
                            </div>
                        )}
                    </aside>
                </div>

                <ScheduleGrid
                    scheduleClasses={
                        sortedScheduleClasses
                    }
                />
            </main>
        </div>
    );
}

export default SchedulePage;