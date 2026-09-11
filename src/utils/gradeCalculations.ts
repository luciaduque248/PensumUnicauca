import type {
  GradeCutRecord,
  SubjectGradeRecord,
} from "../types/grades.js";

const PREVIOUS_NOTE_WEIGHT = 0.7;
const FINAL_NOTE_WEIGHT = 0.3;

const getPercentageTotal = (
  cut: GradeCutRecord,
) => {
  return cut.activities.reduce(
    (total, activity) =>
      total + activity.percentage,
    0,
  );
};

const hasAnyGrade = (
  cut: GradeCutRecord,
) => {
  return cut.activities.some(
    (activity) =>
      activity.grade !== null,
  );
};

const hasAllGrades = (
  cut: GradeCutRecord,
) => {
  return (
    cut.activities.length > 0 &&
    cut.activities.every(
      (activity) =>
        activity.grade !== null,
    )
  );
};

/*
 * Devuelve el aporte ponderado de las actividades del bloque.
 *
 * En el esquema SIMCA usado por la materia:
 * - Corte 1 y Corte 2 comparten entre ambos el 100 % del
 *   componente que vale 70 % de la definitiva.
 * - Corte 3 distribuye el 100 % del componente que vale 30 %.
 *
 * Por ejemplo:
 * Corte 1: nota 1.8 con 50 % -> 1.8 * 0.50 = 0.90
 * Corte 2: nota 0.0 con 50 % -> 0.00
 * Componente 70 %: (0.90 + 0.00) * 0.70 = 0.63
 */
export const calculateCutGrade = (
  cut: GradeCutRecord,
): number | null => {
  if (!hasAnyGrade(cut)) {
    return null;
  }

  return cut.activities.reduce(
    (total, activity) => {
      if (activity.grade === null) {
        return total;
      }

      return (
        total +
        activity.grade *
        (activity.percentage / 100)
      );
    },
    0,
  );
};

export const isCutComplete = (
  cut: GradeCutRecord,
) => {
  const percentageTotal =
    getPercentageTotal(cut);

  return (
    Math.abs(
      percentageTotal - 100,
    ) < 0.0001 &&
    hasAllGrades(cut)
  );
};

const isPreviousComponentComplete = (
  record: SubjectGradeRecord,
) => {
  const percentageTotal =
    getPercentageTotal(
      record.cuts.first,
    ) +
    getPercentageTotal(
      record.cuts.second,
    );

  return (
    Math.abs(
      percentageTotal - 100,
    ) < 0.0001 &&
    hasAllGrades(
      record.cuts.first,
    ) &&
    hasAllGrades(
      record.cuts.second,
    )
  );
};

export const hasRegisteredGrades = (
  record: SubjectGradeRecord,
) => {
  return Object.values(
    record.cuts,
  ).some((cut) =>
    hasAnyGrade(cut),
  );
};

export const roundGradeToTwoDecimals = (
  value: number,
) => {
  return Math.floor(
    (value + Number.EPSILON) * 100 +
    0.5,
  ) / 100;
};

/*
 * Aproximación institucional a una décima:
 * - Si la centésima es 5 o mayor, sube la décima.
 * - Si es menor que 5, se conserva la décima.
 */
export const roundGradeToOfficialTenth = (
  value: number,
) => {
  return Math.floor(
    (value + Number.EPSILON) * 10 +
    0.5,
  ) / 10;
};

export interface SubjectGradeCalculation {
  firstCutGrade: number | null;
  secondCutGrade: number | null;

  previousNote: number | null;
  previousNoteTwoDecimals: number | null;
  previousNoteOfficial: number | null;

  previousContributionExact: number | null;
  previousContributionOfficial: number | null;

  thirdCutGrade: number | null;
  thirdCutOfficial: number | null;

  thirdContributionExact: number | null;
  thirdContributionOfficial: number | null;

  accumulatedGrade: number | null;
  accumulatedTwoDecimals: number | null;

  officialCalculationBase: number | null;
  officialOneDecimal: number | null;

  isComplete: boolean;
}

export const calculateSubjectGrade = (
  record: SubjectGradeRecord,
): SubjectGradeCalculation => {
  const firstCutGrade =
    calculateCutGrade(
      record.cuts.first,
    );

  const secondCutGrade =
    calculateCutGrade(
      record.cuts.second,
    );

  const thirdCutGrade =
    calculateCutGrade(
      record.cuts.third,
    );

  const hasPreviousGrade =
    firstCutGrade !== null ||
    secondCutGrade !== null;

  /*
   * firstCutGrade y secondCutGrade ya traen aplicada la
   * ponderación de cada actividad (50 %, 50 %, etc.).
   * Por eso NO se vuelve a multiplicar por firstCutShare /
   * secondCutShare. Hacerlo produciría el error 0.32 observado.
   */
  const previousNote =
    hasPreviousGrade
      ? (
        firstCutGrade ?? 0
      ) +
      (
        secondCutGrade ?? 0
      )
      : null;

  const previousNoteOfficial =
    previousNote === null
      ? null
      : roundGradeToOfficialTenth(
        previousNote,
      );

  const previousContributionExactValue =
    previousNote === null
      ? 0
      : previousNote *
      PREVIOUS_NOTE_WEIGHT;

  const previousContributionOfficial =
    previousNoteOfficial === null
      ? null
      : previousNoteOfficial *
      PREVIOUS_NOTE_WEIGHT;

  const thirdCutOfficial =
    thirdCutGrade === null
      ? null
      : roundGradeToOfficialTenth(
        thirdCutGrade,
      );

  const thirdContributionExactValue =
    thirdCutGrade === null
      ? 0
      : thirdCutGrade *
      FINAL_NOTE_WEIGHT;

  const thirdContributionOfficial =
    thirdCutOfficial === null
      ? null
      : thirdCutOfficial *
      FINAL_NOTE_WEIGHT;

  const hasAnySubjectGrade =
    hasPreviousGrade ||
    thirdCutGrade !== null;

  const accumulatedGrade =
    hasAnySubjectGrade
      ? previousContributionExactValue +
      thirdContributionExactValue
      : null;

  const accumulatedTwoDecimals =
    accumulatedGrade === null
      ? null
      : roundGradeToTwoDecimals(
        accumulatedGrade,
      );

  const officialCalculationBase =
    accumulatedTwoDecimals;

  const isComplete =
    isPreviousComponentComplete(
      record,
    ) &&
    isCutComplete(
      record.cuts.third,
    );

  return {
    firstCutGrade,
    secondCutGrade,

    previousNote,

    previousNoteTwoDecimals:
      previousNote === null
        ? null
        : roundGradeToTwoDecimals(
          previousNote,
        ),

    previousNoteOfficial,

    previousContributionExact:
      hasPreviousGrade
        ? previousContributionExactValue
        : null,

    previousContributionOfficial,

    thirdCutGrade,
    thirdCutOfficial,

    thirdContributionExact:
      thirdCutGrade === null
        ? null
        : thirdContributionExactValue,

    thirdContributionOfficial,

    accumulatedGrade,
    accumulatedTwoDecimals,

    officialCalculationBase,

    officialOneDecimal:
      officialCalculationBase === null
        ? null
        : roundGradeToOfficialTenth(
          officialCalculationBase,
        ),

    isComplete,
  };
};
