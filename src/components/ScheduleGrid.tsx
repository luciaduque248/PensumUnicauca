import {
    Fragment,
    type CSSProperties,
} from "react";

import type {
    ScheduleClass,
    ScheduleDay,
} from "../types/schedule";

interface ScheduleGridProps {
    scheduleClasses: ScheduleClass[];
}

const scheduleDays: Array<{
    value: ScheduleDay;
    label: string;
}> = [
        {
            value: "monday",
            label: "Lunes",
        },
        {
            value: "tuesday",
            label: "Martes",
        },
        {
            value: "wednesday",
            label: "Miércoles",
        },
        {
            value: "thursday",
            label: "Jueves",
        },
        {
            value: "friday",
            label: "Viernes",
        },
    ];

const scheduleHours = Array.from(
    { length: 17 },
    (_, index) => index + 7,
);

const formatHourLabel = (
    hour: number,
) => {
    const period =
        hour < 12
            ? "a. m."
            : "p. m.";

    const displayedHour =
        hour % 12 || 12;

    return `${displayedHour}:00 ${period}`;
};

const formatScheduleTime = (
    value: string,
) => {
    const [hourText, minuteText] =
        value.split(":");

    const hour = Number(hourText);

    const period =
        hour < 12
            ? "a. m."
            : "p. m.";

    const displayedHour =
        hour % 12 || 12;

    return `${displayedHour}:${minuteText} ${period}`;
};

const getHourFromTime = (
    value: string,
) => {
    return Number(
        value.split(":")[0],
    );
};

const getSubjectToneClass = (
    subjectName: string,
) => {
    let hash = 0;

    for (
        let index = 0;
        index < subjectName.length;
        index += 1
    ) {
        hash =
            subjectName.charCodeAt(index) +
            ((hash << 5) - hash);
    }

    const tone =
        (Math.abs(hash) % 6) + 1;

    return `schedule-class-block--tone-${tone}`;
};

function ScheduleGrid({
    scheduleClasses,
}: ScheduleGridProps) {
    return (
        <section className="schedule-grid-panel">
            <div className="schedule-grid-panel__header">
                <div>
                    <p>
                        Distribución semanal
                    </p>

                    <h2>
                        Horario Ing. Electrónica y Telecomunicaciones
                    </h2>

                    <span>
                        Jornada disponible de lunes a viernes,
                        desde las 7:00 a. m. hasta las
                        11:00 p. m.
                    </span>
                </div>

                <strong>
                    {scheduleClasses.length}{" "}
                    {scheduleClasses.length === 1
                        ? "franja"
                        : "franjas"}
                </strong>
            </div>

            <div className="schedule-week-grid-wrapper">
                <div
                    className="schedule-week-grid"
                    role="grid"
                    aria-label="Horario semanal"
                >
                    <div
                        className="schedule-week-grid__corner"
                        style={{
                            gridColumn: 1,
                            gridRow: 1,
                        }}
                    >
                        Hora
                    </div>

                    {scheduleDays.map(
                        (scheduleDay, dayIndex) => (
                            <div
                                className="schedule-week-grid__day"
                                style={{
                                    gridColumn:
                                        dayIndex + 2,
                                    gridRow: 1,
                                }}
                                role="columnheader"
                                key={scheduleDay.value}
                            >
                                {scheduleDay.label}
                            </div>
                        ),
                    )}

                    {scheduleHours.map(
                        (hour, hourIndex) => (
                            <Fragment key={hour}>
                                <div
                                    className="schedule-week-grid__time"
                                    style={{
                                        gridColumn: 1,
                                        gridRow:
                                            hourIndex + 2,
                                    }}
                                    role="rowheader"
                                >
                                    {formatHourLabel(hour)}
                                </div>

                                {scheduleDays.map(
                                    (
                                        scheduleDay,
                                        dayIndex,
                                    ) => (
                                        <div
                                            className="schedule-week-grid__cell"
                                            style={{
                                                gridColumn:
                                                    dayIndex + 2,
                                                gridRow:
                                                    hourIndex + 2,
                                            }}
                                            role="gridcell"
                                            key={`${scheduleDay.value}-${hour}`}
                                        />
                                    ),
                                )}
                            </Fragment>
                        ),
                    )}

                    {scheduleClasses.map(
                        (scheduleClass) => {
                            const dayIndex =
                                scheduleDays.findIndex(
                                    (scheduleDay) =>
                                        scheduleDay.value ===
                                        scheduleClass.day,
                                );

                            const startHour =
                                getHourFromTime(
                                    scheduleClass.startTime,
                                );

                            const endHour =
                                getHourFromTime(
                                    scheduleClass.endTime,
                                );

                            const rowSpan =
                                endHour - startHour;

                            const isValidBlock =
                                dayIndex >= 0 &&
                                startHour >= 7 &&
                                endHour <= 23 &&
                                rowSpan > 0;

                            if (!isValidBlock) {
                                return null;
                            }

                            const blockStyle: CSSProperties =
                            {
                                gridColumn:
                                    dayIndex + 2,

                                gridRow:
                                    `${startHour - 7 + 2} / span ${rowSpan}`,
                            };

                            return (
                                <article
                                    className={`schedule-class-block ${getSubjectToneClass(
                                        scheduleClass.subjectName,
                                    )}`}
                                    style={blockStyle}
                                    key={scheduleClass.id}
                                    aria-label={`${scheduleClass.subjectName}, ${scheduleDays[
                                            dayIndex
                                        ].label
                                        }, de ${formatScheduleTime(
                                            scheduleClass.startTime,
                                        )} a ${formatScheduleTime(
                                            scheduleClass.endTime,
                                        )}`}
                                >
                                    <strong>
                                        {
                                            scheduleClass.subjectName
                                        }
                                    </strong>

                                    <span>
                                        {formatScheduleTime(
                                            scheduleClass.startTime,
                                        )}
                                        {" — "}
                                        {formatScheduleTime(
                                            scheduleClass.endTime,
                                        )}
                                    </span>
                                </article>
                            );
                        },
                    )}
                </div>
            </div>

            {scheduleClasses.length === 0 && (
                <p className="schedule-grid-panel__empty">
                    La cuadrícula está vacía. Agrega una
                    materia desde el formulario para comenzar.
                </p>
            )}
        </section>
    );
}

export default ScheduleGrid;