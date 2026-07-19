import {
    useMemo,
    useState,
    type FormEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuBookOpen,
    LuClock3,
    LuMapPin,
    LuPlus,
    LuUserRound,
} from "react-icons/lu";

import type {
    AcademicOfferGroup,
    ImportedAcademicOffer,
    ScheduleClass,
    ScheduleDay,
} from "../types/schedule";

interface AcademicOfferClassFormProps {
    importedOffer:
    ImportedAcademicOffer;

    scheduleClasses:
    ScheduleClass[];

    onAddClasses: (
        scheduleClasses: Array<
            Omit<ScheduleClass, "id">
        >,
    ) => void | Promise<void>;
}

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

const normalizeText = (
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

const timeToMinutes = (
    value: string,
) => {
    const [
        hourText,
        minuteText = "0",
    ] = value.split(":");

    return (
        Number(hourText) * 60 +
        Number(minuteText)
    );
};

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

const classesOverlap = (
    day: ScheduleDay,
    startTime: string,
    endTime: string,
    existingClass: ScheduleClass,
) => {
    if (
        day !==
        existingClass.day
    ) {
        return false;
    }

    return (
        timeToMinutes(startTime) <
        timeToMinutes(
            existingClass.endTime,
        ) &&
        timeToMinutes(endTime) >
        timeToMinutes(
            existingClass.startTime,
        )
    );
};

function AcademicOfferClassForm({
    importedOffer,
    scheduleClasses,
    onAddClasses,
}: AcademicOfferClassFormProps) {
    const [
        subjectQuery,
        setSubjectQuery,
    ] = useState("");

    const [
        selectedSubjectName,
        setSelectedSubjectName,
    ] = useState("");

    const [
        selectedGroupId,
        setSelectedGroupId,
    ] = useState("");

    const [
        showSuggestions,
        setShowSuggestions,
    ] = useState(false);

    const subjectNames =
        useMemo(() => {
            return Array.from(
                new Set(
                    importedOffer.groups.map(
                        (group) =>
                            group.subjectName,
                    ),
                ),
            ).sort(
                (
                    firstSubject,
                    secondSubject,
                ) =>
                    firstSubject.localeCompare(
                        secondSubject,
                        "es",
                    ),
            );
        }, [importedOffer]);

    const filteredSubjects =
        useMemo(() => {
            const normalizedQuery =
                normalizeText(
                    subjectQuery,
                );

            if (
                normalizedQuery === ""
            ) {
                return [];
            }

            return subjectNames
                .filter((subjectName) =>
                    normalizeText(
                        subjectName,
                    ).includes(
                        normalizedQuery,
                    ),
                )
                .slice(0, 10);
        }, [
            subjectNames,
            subjectQuery,
        ]);

    const subjectGroups =
        useMemo(() => {
            if (
                selectedSubjectName ===
                ""
            ) {
                return [];
            }

            return importedOffer.groups
                .filter(
                    (group) =>
                        normalizeText(
                            group.subjectName,
                        ) ===
                        normalizeText(
                            selectedSubjectName,
                        ),
                )
                .sort(
                    (
                        firstGroup,
                        secondGroup,
                    ) =>
                        firstGroup.group
                            .localeCompare(
                                secondGroup.group,
                                "es",
                            ),
                );
        }, [
            importedOffer,
            selectedSubjectName,
        ]);

    const selectedGroup =
        useMemo<
            AcademicOfferGroup | undefined
        >(() => {
            return subjectGroups.find(
                (group) =>
                    group.id ===
                    selectedGroupId,
            );
        }, [
            subjectGroups,
            selectedGroupId,
        ]);

    const handleSelectSubject = (
        subjectName: string,
    ) => {
        setSubjectQuery(
            subjectName,
        );

        setSelectedSubjectName(
            subjectName,
        );

        setSelectedGroupId("");

        setShowSuggestions(
            false,
        );
    };

    const handleSubmit =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ) => {
            event.preventDefault();

            if (
                !selectedGroup
            ) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Selecciona una materia y un grupo",

                    text:
                        "Primero selecciona la materia de las sugerencias y luego el grupo que deseas matricular.",

                    confirmButtonText:
                        "Revisar formulario",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }

            const subjectAlreadyAdded =
                scheduleClasses.some(
                    (scheduleClass) =>
                        normalizeText(
                            scheduleClass.subjectName,
                        ) ===
                        normalizeText(
                            selectedGroup.subjectName,
                        ),
                );

            if (
                subjectAlreadyAdded
            ) {
                await Swal.fire({
                    icon: "info",

                    title:
                        "La materia ya está en tu horario",

                    text:
                        "Usa el botón Editar de la materia guardada para modificar sus horarios.",

                    confirmButtonText:
                        "Entendido",

                    confirmButtonColor:
                        "#4f46e5",
                });

                return;
            }

            for (
                const meeting of
                selectedGroup.meetings
            ) {
                const overlappingClass =
                    scheduleClasses.find(
                        (scheduleClass) =>
                            classesOverlap(
                                meeting.day,
                                meeting.startTime,
                                meeting.endTime,
                                scheduleClass,
                            ),
                    );

                if (
                    overlappingClass
                ) {
                    await Swal.fire({
                        icon: "warning",

                        title:
                            "Cruce de horario",

                        text:
                            `${overlappingClass.subjectName} ya ocupa el ${dayLabels[meeting.day]}, de ${formatScheduleTime(
                                overlappingClass.startTime,
                            )} a ${formatScheduleTime(
                                overlappingClass.endTime,
                            )}.`,

                        confirmButtonText:
                            "Elegir otro grupo",

                        confirmButtonColor:
                            "#f59e0b",
                    });

                    return;
                }
            }

            await onAddClasses(
                selectedGroup.meetings.map(
                    (meeting) => ({
                        subjectName:
                            selectedGroup.subjectName,

                        subjectCode:
                            selectedGroup.subjectCode,

                        group:
                            selectedGroup.group,

                        teacher:
                            selectedGroup.teacher,

                        classroom:
                            meeting.classroom,

                        day:
                            meeting.day,

                        startTime:
                            meeting.startTime,

                        endTime:
                            meeting.endTime,

                        source:
                            "academic-offer",

                        offerGroupId:
                            selectedGroup.id,
                    }),
                ),
            );

            setSubjectQuery("");
            setSelectedSubjectName("");
            setSelectedGroupId("");
            setShowSuggestions(false);

            await Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",

                title:
                    "Grupo agregado al horario",

                text:
                    `${selectedGroup.subjectName}, grupo ${selectedGroup.group}.`,

                showConfirmButton:
                    false,

                timer: 2400,
                timerProgressBar:
                    true,
            });
        };

    return (
        <form
            className="academic-offer-form"
            onSubmit={handleSubmit}
        >
            <div className="academic-offer-form__header">
                <span aria-hidden="true">
                    <LuBookOpen />
                </span>

                <div>
                    <p>
                        Oferta importada · Periodo{" "}
                        {importedOffer.period}
                    </p>

                    <h2>
                        Agregar materia por grupo
                    </h2>

                    <small>
                        El profesor, los salones y las
                        franjas se completarán
                        automáticamente.
                    </small>
                </div>
            </div>

            <div className="academic-offer-form__fields">
                <label className="academic-offer-field">
                    <span>Materia</span>

                    <small>
                        Escribe para buscar dentro de la
                        oferta FIET.
                    </small>

                    <div className="academic-offer-autocomplete">
                        <input
                            type="text"
                            value={subjectQuery}
                            placeholder="Ejemplo: Comunicaciones Digitales"
                            autoComplete="off"
                            onFocus={() =>
                                setShowSuggestions(
                                    true,
                                )
                            }
                            onChange={(event) => {
                                setSubjectQuery(
                                    event.target.value,
                                );

                                setSelectedSubjectName(
                                    "",
                                );

                                setSelectedGroupId(
                                    "",
                                );

                                setShowSuggestions(
                                    true,
                                );
                            }}
                            onBlur={() => {
                                window.setTimeout(
                                    () =>
                                        setShowSuggestions(
                                            false,
                                        ),
                                    120,
                                );
                            }}
                        />

                        {showSuggestions &&
                            filteredSubjects.length >
                            0 && (
                                <div className="academic-offer-autocomplete__menu">
                                    {filteredSubjects.map(
                                        (subjectName) => (
                                            <button
                                                type="button"
                                                key={
                                                    subjectName
                                                }
                                                onMouseDown={(
                                                    event,
                                                ) =>
                                                    event.preventDefault()
                                                }
                                                onClick={() =>
                                                    handleSelectSubject(
                                                        subjectName,
                                                    )
                                                }
                                            >
                                                {subjectName}
                                            </button>
                                        ),
                                    )}
                                </div>
                            )}
                    </div>
                </label>

                <label className="academic-offer-field">
                    <span>Grupo</span>

                    <small>
                        Cada grupo puede tener un docente y
                        un horario diferente.
                    </small>

                    <select
                        value={selectedGroupId}
                        disabled={
                            subjectGroups.length ===
                            0
                        }
                        onChange={(event) =>
                            setSelectedGroupId(
                                event.target.value,
                            )
                        }
                    >
                        <option value="">
                            {subjectGroups.length ===
                                0
                                ? "Primero selecciona una materia"
                                : "Selecciona un grupo"}
                        </option>

                        {subjectGroups.map(
                            (group) => (
                                <option
                                    value={group.id}
                                    key={group.id}
                                >
                                    Grupo {group.group}
                                </option>
                            ),
                        )}
                    </select>
                </label>
            </div>

            {selectedGroup && (
                <section className="academic-offer-preview">
                    <div className="academic-offer-preview__heading">
                        <div>
                            <p>
                                {
                                    selectedGroup
                                        .subjectCode
                                }
                            </p>

                            <h3>
                                {
                                    selectedGroup
                                        .subjectName
                                }
                            </h3>
                        </div>

                        <span>
                            Grupo{" "}
                            {
                                selectedGroup
                                    .group
                            }
                        </span>
                    </div>

                    <div className="academic-offer-preview__teacher">
                        <LuUserRound
                            aria-hidden="true"
                        />

                        <div>
                            <small>
                                Docente
                            </small>

                            <strong>
                                {
                                    selectedGroup
                                        .teacher
                                }
                            </strong>
                        </div>
                    </div>

                    <div className="academic-offer-preview__meetings">
                        {selectedGroup.meetings.map(
                            (
                                meeting,
                                index,
                            ) => (
                                <article
                                    key={`${meeting.day}-${meeting.startTime}-${index}`}
                                >
                                    <span className="academic-offer-preview__day">
                                        {
                                            dayLabels[
                                            meeting.day
                                            ]
                                        }
                                    </span>

                                    <div>
                                        <p>
                                            <LuClock3
                                                aria-hidden="true"
                                            />

                                            {formatScheduleTime(
                                                meeting.startTime,
                                            )}
                                            {" — "}
                                            {formatScheduleTime(
                                                meeting.endTime,
                                            )}
                                        </p>

                                        <p>
                                            <LuMapPin
                                                aria-hidden="true"
                                            />

                                            {
                                                meeting
                                                    .classroom
                                            }
                                        </p>
                                    </div>
                                </article>
                            ),
                        )}
                    </div>

                    <button
                        className="academic-offer-form__submit"
                        type="submit"
                    >
                        <LuPlus aria-hidden="true" />
                        Agregar grupo al horario
                    </button>
                </section>
            )}
        </form>
    );
}

export default AcademicOfferClassForm;