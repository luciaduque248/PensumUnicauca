import type {
  GradeCutRecord,
  SubjectGradeRecord,
} from "../types/grades";

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

export const calculateCutGrade = (
  cut: GradeCutRecord,
): number | null => {
  const hasAtLeastOneGrade =
    cut.activities.some(
      (activity) =>
        activity.grade !== null,
    );

  if (!hasAtLeastOneGrade) {
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
    cut.activities.length > 0 &&
    cut.activities.every(
      (activity) =>
        activity.grade !== null,
    )
  );
};

export const hasRegisteredGrades = (
  record: SubjectGradeRecord,
) => {
  return Object.values(
    record.cuts,
  ).some((cut) =>
    cut.activities.some(
      (activity) =>
        activity.grade !== null,
    ),
  );
};

export const roundGradeToTwoDecimals = (
  value: number,
) => {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
};

/*
 * Aproximación institucional a una décima:
 *
 * - Si la centésima es 5 o mayor, sube la décima.
 * - Si es menor que 5, se conserva la décima.
 *
 * Las notas manejadas por la aplicación son positivas,
 * por lo que esta operación implementa el redondeo
 * aritmético hacia arriba en los casos terminados en 5.
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

  const previousNote =
    firstCutGrade !== null &&
      secondCutGrade !== null
      ? firstCutGrade *
      (record.firstCutShare / 100) +
      secondCutGrade *
      (record.secondCutShare / 100)
      : null;

  const previousNoteOfficial =
    previousNote === null
      ? null
      : roundGradeToOfficialTenth(
        previousNote,
      );

  const firstCutContribution =
    firstCutGrade === null
      ? 0
      : firstCutGrade *
      (record.firstCutShare / 100) *
      PREVIOUS_NOTE_WEIGHT;

  const secondCutContribution =
    secondCutGrade === null
      ? 0
      : secondCutGrade *
      (record.secondCutShare / 100) *
      PREVIOUS_NOTE_WEIGHT;

  const previousContributionExactValue =
    firstCutContribution +
    secondCutContribution;

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

  const hasAnyGrade =
    hasPreviousGrade ||
    thirdCutGrade !== null;

  const accumulatedGrade =
    hasAnyGrade
      ? previousContributionExactValue +
      thirdContributionExactValue
      : null;

  const officialCalculationBase =
    previousContributionOfficial !== null ||
      thirdContributionOfficial !== null
      ? (
        previousContributionOfficial ??
        0
      ) +
      (
        thirdContributionOfficial ??
        0
      )
      : null;

  const isComplete =
    isCutComplete(
      record.cuts.first,
    ) &&
    isCutComplete(
      record.cuts.second,
    ) &&
    isCutComplete(
      record.cuts.third,
    ) &&
    Math.abs(
      record.firstCutShare +
      record.secondCutShare -
      100,
    ) < 0.0001;

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

    accumulatedTwoDecimals:
      accumulatedGrade === null
        ? null
        : roundGradeToTwoDecimals(
          accumulatedGrade,
        ),

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
