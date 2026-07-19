import {
  useMemo,
} from "react";

import Swal from "sweetalert2";

import {
  LuCalculator,
  LuCircleAlert,
  LuMoon,
  LuPlus,
  LuSun,
  LuTrash2,
} from "react-icons/lu";

import {
  normalizeSubjectGradeRecord,
} from "../data/defaultGrades";

import {
  calculateSubjectGrade,
  hasRegisteredGrades,
  roundGradeToOfficialTenth,
} from "../utils/gradeCalculations";

import type {
  CurriculumSection,
  SubjectStatus,
} from "../types/curriculum";

import type {
  GradeActivity,
  GradeCutId,
  StudentGradeRecords,
  SubjectGradeRecord,
} from "../types/grades";

import type {
  ScheduleClass,
} from "../types/schedule";

interface GradesPageProps {
  themeMode: "light" | "dark";

  curriculum: CurriculumSection[];

  subjectStatuses: Record<
    string,
    SubjectStatus
  >;

  scheduleClasses: ScheduleClass[];
  isScheduleConfirmed: boolean;

  gradeRecords: StudentGradeRecords;

  onToggleTheme: () => void;

  onSubjectGradeRecordChange: (
    subjectCode: string,
    record: SubjectGradeRecord,
  ) => void;
}

interface EnrolledSubject {
  code: string;
  name: string;
  credits: number;
  semester: number | null;
  sectionTitle: string;
  isInProgress: boolean;
  isInConfirmedSchedule: boolean;
}

interface NewGradeActivityData {
  name: string;
  percentage: number;
}

const CUT_LABELS: Record<
  GradeCutId,
  string
> = {
  first: "Corte 1",
  second: "Corte 2",
  third: "Corte 3",
};

const ACTIVITY_TYPE_OPTIONS = [
  "Quiz",
  "Taller",
  "Trabajo",
  "Laboratorio",
  "Proyecto",
  "Exposición",
  "Parcial adicional",
  "Otro",
] as const;

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

const normalizeCode = (
  value: string | undefined,
) => {
  return (value ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();
};

const escapeHtml = (
  value: string,
) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatGrade = (
  value: number | null,
  decimals: 1 | 2,
) => {
  if (value === null) {
    return "—";
  }

  return value.toFixed(decimals);
};

const formatPercentage = (
  value: number,
) => {
  return Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(2);
};

const roundPercentage = (
  value: number,
) => {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
};

const getCutPercentageTotal = (
  activities: GradeActivity[],
) => {
  return roundPercentage(
    activities.reduce(
      (total, activity) =>
        total + activity.percentage,
      0,
    ),
  );
};

const getCutCalculatedGrade = (
  calculation: ReturnType<
    typeof calculateSubjectGrade
  >,
  cutId: GradeCutId,
) => {
  if (cutId === "first") {
    return calculation.firstCutGrade;
  }

  if (cutId === "second") {
    return calculation.secondCutGrade;
  }

  return calculation.thirdCutGrade;
};

const createActivityId = (
  subjectCode: string,
  cutId: GradeCutId,
) => {
  return `${subjectCode}-${cutId}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

const getUniqueActivityName = (
  requestedName: string,
  currentActivities: GradeActivity[],
) => {
  const cleanName =
    requestedName.trim();

  const existingNames =
    new Set(
      currentActivities.map(
        (activity) =>
          normalizeText(
            activity.name,
          ),
      ),
    );

  if (
    !existingNames.has(
      normalizeText(cleanName),
    )
  ) {
    return cleanName;
  }

  let suffix = 2;

  while (
    existingNames.has(
      normalizeText(
        `${cleanName} ${suffix}`,
      ),
    )
  ) {
    suffix += 1;
  }

  return `${cleanName} ${suffix}`;
};

function GradesPage({
  themeMode,
  curriculum,
  subjectStatuses,
  scheduleClasses,
  isScheduleConfirmed,
  gradeRecords,
  onToggleTheme,
  onSubjectGradeRecordChange,
}: GradesPageProps) {
  const enrolledSubjects =
    useMemo<EnrolledSubject[]>(
      () => {
        const confirmedScheduleCodes =
          new Set<string>();

        const confirmedScheduleNames =
          new Set<string>();

        if (isScheduleConfirmed) {
          scheduleClasses.forEach(
            (scheduleClass) => {
              const normalizedCode =
                normalizeCode(
                  scheduleClass.subjectCode,
                );

              if (normalizedCode !== "") {
                confirmedScheduleCodes.add(
                  normalizedCode,
                );
              }

              const normalizedName =
                normalizeText(
                  scheduleClass.subjectName,
                );

              if (normalizedName !== "") {
                confirmedScheduleNames.add(
                  normalizedName,
                );
              }
            },
          );
        }

        return curriculum
          .flatMap((section) =>
            section.subjects.map(
              (subject) => {
                const isInProgress =
                  subjectStatuses[
                  subject.code
                  ] === "in-progress";

                const isInConfirmedSchedule =
                  isScheduleConfirmed &&
                  (
                    confirmedScheduleCodes.has(
                      normalizeCode(
                        subject.code,
                      ),
                    ) ||
                    confirmedScheduleNames.has(
                      normalizeText(
                        subject.name,
                      ),
                    )
                  );

                return {
                  code: subject.code,
                  name: subject.name,
                  credits: subject.credits,
                  semester:
                    section.semester ?? null,
                  sectionTitle:
                    section.title,
                  isInProgress,
                  isInConfirmedSchedule,
                };
              },
            ),
          )
          .filter(
            (subject) =>
              subject.isInProgress ||
              subject.isInConfirmedSchedule,
          )
          .sort(
            (
              firstSubject,
              secondSubject,
            ) => {
              const firstSemester =
                firstSubject.semester ?? 99;

              const secondSemester =
                secondSubject.semester ?? 99;

              if (
                firstSemester !==
                secondSemester
              ) {
                return (
                  firstSemester -
                  secondSemester
                );
              }

              return firstSubject.name
                .localeCompare(
                  secondSubject.name,
                  "es",
                );
            },
          );
      },
      [
        curriculum,
        isScheduleConfirmed,
        scheduleClasses,
        subjectStatuses,
      ],
    );

  const subjectRows =
    enrolledSubjects.map(
      (subject) => {
        const record =
          normalizeSubjectGradeRecord(
            subject.code,
            gradeRecords[
            subject.code
            ],
          );

        return {
          subject,
          record,
          calculation:
            calculateSubjectGrade(
              record,
            ),
        };
      },
    );

  const subjectsWithGrades =
    subjectRows.filter(
      ({ record }) =>
        hasRegisteredGrades(record),
    ).length;

  const completedSubjectRows =
    subjectRows.filter(
      ({ calculation }) =>
        calculation.isComplete &&
        calculation.officialOneDecimal !== null,
    );

  const completedSubjects =
    completedSubjectRows.length;

  const subjectsAtOrAboveThree =
    completedSubjectRows.filter(
      ({ calculation }) =>
        (
          calculation.officialOneDecimal ??
          0
        ) >= 3,
    ).length;

  const completedCredits =
    completedSubjectRows.reduce(
      (total, { subject }) =>
        total + subject.credits,
      0,
    );

  const semesterAverage =
    completedCredits === 0
      ? null
      : roundGradeToOfficialTenth(
        completedSubjectRows.reduce(
          (
            total,
            {
              subject,
              calculation,
            },
          ) =>
            total +
            (
              calculation.officialOneDecimal ??
              0
            ) *
            subject.credits,
          0,
        ) / completedCredits,
      );

  const saveRecord = (
    subjectCode: string,
    record: SubjectGradeRecord,
  ) => {
    onSubjectGradeRecordChange(
      subjectCode,
      {
        ...record,
        updatedAt:
          new Date().toISOString(),
      },
    );
  };

  const handleActivityGradeChange = (
    subjectCode: string,
    cutId: GradeCutId,
    activityId: string,
    rawValue: string,
  ) => {
    const currentRecord =
      normalizeSubjectGradeRecord(
        subjectCode,
        gradeRecords[subjectCode],
      );

    const parsedGrade =
      rawValue === ""
        ? null
        : Number(rawValue);

    if (
      parsedGrade !== null &&
      (
        !Number.isFinite(
          parsedGrade,
        ) ||
        parsedGrade < 0 ||
        parsedGrade > 5
      )
    ) {
      return;
    }

    const updatedActivities =
      currentRecord.cuts[
        cutId
      ].activities.map(
        (activity) =>
          activity.id === activityId
            ? {
              ...activity,
              grade: parsedGrade,
            }
            : activity,
      );

    saveRecord(
      subjectCode,
      {
        ...currentRecord,
        cuts: {
          ...currentRecord.cuts,
          [cutId]: {
            activities:
              updatedActivities,
          },
        },
      },
    );
  };

  const handleActivityPercentageChange = (
    subjectCode: string,
    cutId: GradeCutId,
    activityId: string,
    rawValue: string,
  ) => {
    if (rawValue === "") {
      return;
    }

    const parsedPercentage =
      Number(rawValue);

    if (
      !Number.isFinite(
        parsedPercentage,
      ) ||
      parsedPercentage <= 0 ||
      parsedPercentage > 100
    ) {
      return;
    }

    const currentRecord =
      normalizeSubjectGradeRecord(
        subjectCode,
        gradeRecords[subjectCode],
      );

    const currentActivities = [
      ...currentRecord.cuts[
        cutId
      ].activities,
    ];

    const primaryActivity =
      currentActivities[0];

    const targetIndex =
      currentActivities.findIndex(
        (activity) =>
          activity.id === activityId,
      );

    if (
      !primaryActivity ||
      targetIndex <= 0
    ) {
      return;
    }

    const targetActivity =
      currentActivities[targetIndex];

    const maximumAllowed =
      targetActivity.percentage +
      primaryActivity.percentage;

    if (
      parsedPercentage >
      maximumAllowed
    ) {
      return;
    }

    const difference =
      parsedPercentage -
      targetActivity.percentage;

    const updatedPrimaryPercentage =
      roundPercentage(
        primaryActivity.percentage -
        difference,
      );

    if (
      updatedPrimaryPercentage < 0
    ) {
      return;
    }

    currentActivities[0] = {
      ...primaryActivity,
      percentage:
        updatedPrimaryPercentage,
    };

    currentActivities[targetIndex] = {
      ...targetActivity,
      percentage:
        roundPercentage(
          parsedPercentage,
        ),
    };

    saveRecord(
      subjectCode,
      {
        ...currentRecord,
        cuts: {
          ...currentRecord.cuts,
          [cutId]: {
            activities:
              currentActivities,
          },
        },
      },
    );
  };

  const handleAddActivity = async (
    subjectCode: string,
    subjectName: string,
    cutId: GradeCutId,
  ) => {
    const currentRecord =
      normalizeSubjectGradeRecord(
        subjectCode,
        gradeRecords[subjectCode],
      );

    const currentActivities =
      currentRecord.cuts[
        cutId
      ].activities;

    const primaryActivity =
      currentActivities[0];

    const availablePercentage =
      primaryActivity?.percentage ?? 0;

    if (
      availablePercentage <= 0
    ) {
      await Swal.fire({
        icon: "info",
        title:
          "El corte ya distribuyó el 100 %",
        text:
          "Reduce el porcentaje de uno de los ítems agregados o elimina uno antes de añadir otra actividad.",
        confirmButtonText:
          "Entendido",
        confirmButtonColor:
          "#4f46e5",
      });

      return;
    }

    const activityTypeOptions =
      ACTIVITY_TYPE_OPTIONS.map(
        (activityType) =>
          `<option value="${escapeHtml(activityType)}">${escapeHtml(activityType)}</option>`,
      ).join("");

    const result =
      await Swal.fire<NewGradeActivityData>({
        title:
          `Agregar ítem al ${CUT_LABELS[cutId]}`,
        html: `
          <div class="grades-activity-modal">
            <p class="grades-activity-modal__subject">
              ${escapeHtml(subjectName)}
            </p>

            <label class="grades-activity-modal__field" for="grades-activity-type">
              <span>Tipo de actividad</span>
              <select id="grades-activity-type">
                ${activityTypeOptions}
              </select>
            </label>

            <label class="grades-activity-modal__field" for="grades-activity-name">
              <span>Nombre personalizado <small>(opcional)</small></span>
              <input
                id="grades-activity-name"
                type="text"
                maxlength="45"
                placeholder="Ejemplo: Quiz de Fourier"
              />
            </label>

            <label class="grades-activity-modal__field" for="grades-activity-percentage">
              <span>Porcentaje dentro del corte</span>
              <div class="grades-activity-modal__percentage-row">
                <input
                  id="grades-activity-percentage"
                  type="number"
                  min="0.1"
                  max="${availablePercentage}"
                  step="0.1"
                  inputmode="decimal"
                  placeholder="10"
                />
                <strong>%</strong>
              </div>
            </label>

            <p class="grades-activity-modal__help">
              Disponible para asignar: <strong>${formatPercentage(availablePercentage)} %</strong>.
              Este porcentaje se descontará automáticamente del Parcial.
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText:
          "Agregar ítem",
        cancelButtonText:
          "Cancelar",
        confirmButtonColor:
          "#4f46e5",
        cancelButtonColor:
          "#64748b",
        focusConfirm: false,
        preConfirm: () => {
          const typeElement =
            document.getElementById(
              "grades-activity-type",
            ) as HTMLSelectElement | null;

          const nameElement =
            document.getElementById(
              "grades-activity-name",
            ) as HTMLInputElement | null;

          const percentageElement =
            document.getElementById(
              "grades-activity-percentage",
            ) as HTMLInputElement | null;

          const selectedType =
            typeElement?.value.trim() ?? "";

          const customName =
            nameElement?.value.trim() ?? "";

          const percentage =
            Number(
              percentageElement?.value ??
              "",
            );

          if (
            selectedType === ""
          ) {
            Swal.showValidationMessage(
              "Selecciona el tipo de actividad.",
            );

            return false;
          }

          if (
            selectedType === "Otro" &&
            customName === ""
          ) {
            Swal.showValidationMessage(
              "Escribe el nombre de la actividad.",
            );

            return false;
          }

          if (
            !Number.isFinite(
              percentage,
            ) ||
            percentage <= 0 ||
            percentage > availablePercentage
          ) {
            Swal.showValidationMessage(
              `Escribe un porcentaje mayor que 0 y máximo de ${formatPercentage(availablePercentage)} %.`,
            );

            return false;
          }

          return {
            name:
              customName || selectedType,
            percentage:
              roundPercentage(
                percentage,
              ),
          };
        },
      });

    if (
      !result.isConfirmed ||
      !result.value
    ) {
      return;
    }

    const updatedActivities =
      currentActivities.map(
        (activity, index) =>
          index === 0
            ? {
              ...activity,
              percentage:
                roundPercentage(
                  activity.percentage -
                  result.value!.percentage,
                ),
            }
            : activity,
      );

    updatedActivities.push({
      id: createActivityId(
        subjectCode,
        cutId,
      ),
      name: getUniqueActivityName(
        result.value.name,
        currentActivities,
      ),
      percentage:
        result.value.percentage,
      grade: null,
    });

    saveRecord(
      subjectCode,
      {
        ...currentRecord,
        cuts: {
          ...currentRecord.cuts,
          [cutId]: {
            activities:
              updatedActivities,
          },
        },
      },
    );
  };

  const handleDeleteActivity = async (
    subjectCode: string,
    subjectName: string,
    cutId: GradeCutId,
    activityId: string,
  ) => {
    const currentRecord =
      normalizeSubjectGradeRecord(
        subjectCode,
        gradeRecords[subjectCode],
      );

    const currentActivities =
      currentRecord.cuts[
        cutId
      ].activities;

    const activityIndex =
      currentActivities.findIndex(
        (activity) =>
          activity.id === activityId,
      );

    if (activityIndex <= 0) {
      return;
    }

    const activityToDelete =
      currentActivities[activityIndex];

    const confirmation =
      await Swal.fire({
        icon: "warning",
        title:
          "¿Eliminar este ítem?",
        html: `
          <p>
            Se eliminará <strong>${escapeHtml(activityToDelete.name)}</strong>
            del ${escapeHtml(CUT_LABELS[cutId])} de
            <strong>${escapeHtml(subjectName)}</strong>.
          </p>
          <p>
            Su ${formatPercentage(activityToDelete.percentage)} % volverá automáticamente al Parcial.
          </p>
        `,
        showCancelButton: true,
        confirmButtonText:
          "Sí, eliminar",
        cancelButtonText:
          "Cancelar",
        confirmButtonColor:
          "#dc2626",
        cancelButtonColor:
          "#64748b",
      });

    if (!confirmation.isConfirmed) {
      return;
    }

    const primaryActivity =
      currentActivities[0];

    const updatedActivities =
      currentActivities
        .filter(
          (activity) =>
            activity.id !== activityId,
        )
        .map(
          (activity, index) =>
            index === 0
              ? {
                ...activity,
                percentage:
                  roundPercentage(
                    primaryActivity.percentage +
                    activityToDelete.percentage,
                  ),
              }
              : activity,
        );

    saveRecord(
      subjectCode,
      {
        ...currentRecord,
        cuts: {
          ...currentRecord.cuts,
          [cutId]: {
            activities:
              updatedActivities,
          },
        },
      },
    );
  };

  return (
    <div className="grades-page">
      <header className="grades-header">
        <div className="grades-header__content">
          <div className="grades-header__intro">
            <p className="grades-header__eyebrow">
              Seguimiento de calificaciones
            </p>

            <div className="grades-header__title">
              <LuCalculator
                aria-hidden="true"
              />

              <h1>
                Notas del semestre
              </h1>
            </div>

            <p className="grades-header__description">
              Registra parciales, quices, talleres, trabajos y otras actividades dentro del corte correspondiente. Cada actividad se muestra debajo de la anterior para mantener la tabla organizada verticalmente.
            </p>
          </div>

          <button
            className="grades-header__theme-button"
            type="button"
            onClick={onToggleTheme}
            aria-label={
              themeMode === "dark"
                ? "Activar modo claro"
                : "Activar modo oscuro"
            }
          >
            {themeMode === "dark" ? (
              <LuSun
                aria-hidden="true"
              />
            ) : (
              <LuMoon
                aria-hidden="true"
              />
            )}

            {themeMode === "dark"
              ? "Modo claro"
              : "Modo oscuro"}
          </button>
        </div>
      </header>

      <main className="grades-main">
        <section className="grades-information">
          <span
            className="grades-information__icon"
            aria-hidden="true"
          >
            <LuCircleAlert />
          </span>

          <div>
            <p>
              Distribución por corte
            </p>

            <h2>
              Actividades configurables
            </h2>

            <span>
              Cada corte comienza con un Parcial del 100 %. Al agregar un quiz, taller, trabajo u otro ítem, su porcentaje se descuenta automáticamente del Parcial para conservar el total del corte en 100 %.
            </span>
          </div>
        </section>

        <section
          className="grades-summary"
          aria-label="Resumen de notas"
        >
          <article className="grades-summary-card">
            <span>
              Materias matriculadas
            </span>

            <strong>
              {enrolledSubjects.length}
            </strong>
          </article>

          <article className="grades-summary-card">
            <span>
              Con notas registradas
            </span>

            <strong>
              {subjectsWithGrades}
            </strong>
          </article>

          <article className="grades-summary-card">
            <span>
              Cálculo completo
            </span>

            <strong>
              {completedSubjects}
            </strong>
          </article>

          <article className="grades-summary-card">
            <span>
              Resultado de 3.0 o más
            </span>

            <strong>
              {subjectsAtOrAboveThree}
            </strong>
          </article>

          <article className="grades-summary-card">
            <span>
              Promedio del semestre
            </span>

            <strong>
              {formatGrade(
                semesterAverage,
                1,
              )}
            </strong>
          </article>
        </section>

        {subjectRows.length === 0 ? (
          <section className="grades-empty">
            <LuCalculator
              aria-hidden="true"
            />

            <h2>
              No hay materias matriculadas para mostrar
            </h2>

            <p>
              Marca una materia como En curso en Vida académica o confirma un horario que contenga materias del pensum.
            </p>
          </section>
        ) : (
          <section className="grades-sheet-section">
            <div className="grades-sheet-heading">
              <div>
                <p>
                  Planilla general
                </p>

                <h2>
                  Registro y acumulado por materia
                </h2>
              </div>

              <span>
                Las notas y porcentajes de los ítems agregados son editables.
              </span>
            </div>

            <div className="grades-sheet-wrapper">
              <table className="grades-table">
                <thead>
                  <tr>
                    <th className="grades-table__semester-column">
                      Sem.
                    </th>

                    <th className="grades-table__code-column">
                      Código
                    </th>

                    <th className="grades-table__subject-column">
                      Materia
                    </th>

                    <th className="grades-table__cut-column">
                      Corte 1
                      <small>
                        35 % final
                      </small>
                    </th>

                    <th className="grades-table__cut-column">
                      Corte 2
                      <small>
                        35 % final
                      </small>
                    </th>

                    <th className="grades-table__cut-column">
                      Corte 3
                      <small>
                        30 % final
                      </small>
                    </th>

                    <th className="grades-table__result-column">
                      Acumulado
                      <small>
                        2 decimales
                      </small>
                    </th>

                    <th className="grades-table__result-column">
                      Aproximado
                      <small>
                        1 decimal
                      </small>
                    </th>

                    <th className="grades-table__status-column">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {subjectRows.map(
                    ({
                      subject,
                      record,
                      calculation,
                    }) => {
                      const hasGrades =
                        hasRegisteredGrades(
                          record,
                        );

                      const resultStatus =
                        !hasGrades
                          ? "Sin notas"
                          : !calculation.isComplete
                            ? "En seguimiento"
                            : (
                              calculation.officialOneDecimal ??
                              0
                            ) >= 3
                              ? "Resultado ≥ 3.0"
                              : "Resultado < 3.0";

                      return (
                        <tr key={subject.code}>
                          <td className="grades-table__semester-cell">
                            {subject.semester ?? "Comp."}
                          </td>

                          <td className="grades-table__code-cell">
                            {subject.code}
                          </td>

                          <td className="grades-table__subject-cell">
                            <strong>
                              {subject.name}
                            </strong>

                            <small>
                              {subject.sectionTitle}
                            </small>
                          </td>

                          {(
                            [
                              "first",
                              "second",
                              "third",
                            ] as GradeCutId[]
                          ).map((cutId) => {
                            const activities =
                              record.cuts[
                                cutId
                              ].activities;

                            const percentageTotal =
                              getCutPercentageTotal(
                                activities,
                              );

                            const cutGrade =
                              getCutCalculatedGrade(
                                calculation,
                                cutId,
                              );

                            const primaryPercentage =
                              activities[0]
                                ?.percentage ?? 0;

                            return (
                              <td
                                className="grades-table__cut-cell"
                                key={cutId}
                              >
                                <div className="grades-cut-editor">
                                  <div className="grades-cut-editor__activities">
                                    {activities.map(
                                      (
                                        activity,
                                        activityIndex,
                                      ) => (
                                        <div
                                          className="grades-activity-row"
                                          key={activity.id}
                                        >
                                          <div className="grades-activity-row__heading">
                                            <span title={activity.name}>
                                              {activity.name}
                                            </span>

                                            {activityIndex === 0 ? (
                                              <strong>
                                                {formatPercentage(
                                                  activity.percentage,
                                                )}
                                                %
                                              </strong>
                                            ) : (
                                              <div className="grades-activity-row__percentage">
                                                <input
                                                  type="number"
                                                  min="0.1"
                                                  max={
                                                    activity.percentage +
                                                    primaryPercentage
                                                  }
                                                  step="0.1"
                                                  inputMode="decimal"
                                                  aria-label={`Porcentaje de ${activity.name} en ${CUT_LABELS[cutId]} de ${subject.name}`}
                                                  value={
                                                    activity.percentage
                                                  }
                                                  onChange={(event) =>
                                                    handleActivityPercentageChange(
                                                      subject.code,
                                                      cutId,
                                                      activity.id,
                                                      event.target.value,
                                                    )
                                                  }
                                                />

                                                <span>
                                                  %
                                                </span>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    void handleDeleteActivity(
                                                      subject.code,
                                                      subject.name,
                                                      cutId,
                                                      activity.id,
                                                    )
                                                  }
                                                  aria-label={`Eliminar ${activity.name} de ${CUT_LABELS[cutId]} de ${subject.name}`}
                                                  title="Eliminar ítem"
                                                >
                                                  <LuTrash2
                                                    aria-hidden="true"
                                                  />
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          <label className="grades-activity-row__grade">
                                            <span>
                                              Nota
                                            </span>

                                            <input
                                              type="number"
                                              min="0"
                                              max="5"
                                              step="0.1"
                                              inputMode="decimal"
                                              aria-label={`Nota de ${activity.name} en ${CUT_LABELS[cutId]} de ${subject.name}`}
                                              value={
                                                activity.grade ??
                                                ""
                                              }
                                              placeholder="0.0"
                                              onChange={(event) =>
                                                handleActivityGradeChange(
                                                  subject.code,
                                                  cutId,
                                                  activity.id,
                                                  event.target.value,
                                                )
                                              }
                                            />
                                          </label>
                                        </div>
                                      ),
                                    )}
                                  </div>

                                  <div className="grades-cut-editor__summary">
                                    <span
                                      className={
                                        Math.abs(
                                          percentageTotal -
                                          100,
                                        ) < 0.0001
                                          ? ""
                                          : "grades-cut-editor__percentage-warning"
                                      }
                                    >
                                      Total: {formatPercentage(
                                        percentageTotal,
                                      )} %
                                    </span>

                                    <strong>
                                      Corte: {formatGrade(
                                        cutGrade,
                                        2,
                                      )}
                                    </strong>
                                  </div>

                                  <button
                                    className="grades-cut-editor__add-button"
                                    type="button"
                                    disabled={
                                      primaryPercentage <= 0
                                    }
                                    onClick={() =>
                                      void handleAddActivity(
                                        subject.code,
                                        subject.name,
                                        cutId,
                                      )
                                    }
                                    title={
                                      primaryPercentage <= 0
                                        ? "El 100 % del corte ya está distribuido"
                                        : `Agregar actividad al ${CUT_LABELS[cutId]}`
                                    }
                                  >
                                    <LuPlus
                                      aria-hidden="true"
                                    />

                                    Agregar ítem
                                  </button>
                                </div>
                              </td>
                            );
                          })}

                          <td className="grades-table__calculated-cell">
                            {formatGrade(
                              calculation.accumulatedTwoDecimals,
                              2,
                            )}
                          </td>

                          <td className="grades-table__official-cell">
                            {formatGrade(
                              calculation.officialOneDecimal,
                              1,
                            )}
                          </td>

                          <td className="grades-table__status-cell">
                            <span
                              className={`grades-table__status ${calculation.isComplete
                                ? (
                                  calculation.officialOneDecimal ??
                                  0
                                ) >= 3
                                  ? "grades-table__status--positive"
                                  : "grades-table__status--negative"
                                : hasGrades
                                  ? "grades-table__status--tracking"
                                  : ""
                                }`}
                            >
                              {resultStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <p className="grades-sheet-note">
              Los ítems de cada corte se organizan verticalmente. El porcentaje agregado se descuenta del Parcial y, al eliminar un ítem, vuelve al Parcial. El acumulado conserva dos decimales y la nota aproximada aplica la regla institucional a una décima.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default GradesPage;
