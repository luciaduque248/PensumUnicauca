import type {
  GradeActivity,
  GradeCutId,
  StudentGradeRecords,
  SubjectGradeRecord,
} from "../types/grades.js";

export const SUBJECT_GRADE_RECORDS_STORAGE_KEY =
  "pensum-subject-grade-records";

export const DEFAULT_STUDENT_GRADE_RECORDS:
  StudentGradeRecords = {};

const roundPercentage = (
  value: number,
) => {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
};

const getPercentageTotal = (
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

const createDefaultActivity = (
  subjectCode: string,
  cutId: GradeCutId,
): GradeActivity => ({
  id: `${subjectCode}-${cutId}-partial`,
  name: "Parcial",
  percentage:
    cutId === "third" ? 100 : 50,
  grade: null,
});

export const createDefaultSubjectGradeRecord = (
  subjectCode: string,
): SubjectGradeRecord => ({
  firstCutShare: 50,
  secondCutShare: 50,
  weightingVersion: 2,

  cuts: {
    first: {
      activities: [
        createDefaultActivity(
          subjectCode,
          "first",
        ),
      ],
    },

    second: {
      activities: [
        createDefaultActivity(
          subjectCode,
          "second",
        ),
      ],
    },

    third: {
      activities: [
        createDefaultActivity(
          subjectCode,
          "third",
        ),
      ],
    },
  },

  updatedAt: null,
});

const scaleActivitiesToComponentShare = (
  activities: GradeActivity[],
  share: number,
) => {
  return activities.map(
    (activity) => ({
      ...activity,
      percentage: roundPercentage(
        activity.percentage *
        (share / 100),
      ),
    }),
  );
};

export const normalizeSubjectGradeRecord = (
  subjectCode: string,
  record: SubjectGradeRecord | undefined,
): SubjectGradeRecord => {
  const defaultRecord =
    createDefaultSubjectGradeRecord(
      subjectCode,
    );

  const firstActivities =
    Array.isArray(
      record?.cuts?.first?.activities,
    ) &&
      record!.cuts.first.activities.length > 0
      ? record!.cuts.first.activities
      : defaultRecord.cuts.first.activities;

  const secondActivities =
    Array.isArray(
      record?.cuts?.second?.activities,
    ) &&
      record!.cuts.second.activities.length > 0
      ? record!.cuts.second.activities
      : defaultRecord.cuts.second.activities;

  const thirdActivities =
    Array.isArray(
      record?.cuts?.third?.activities,
    ) &&
      record!.cuts.third.activities.length > 0
      ? record!.cuts.third.activities
      : defaultRecord.cuts.third.activities;

  const firstCutShare =
    record?.firstCutShare ??
    defaultRecord.firstCutShare;

  const secondCutShare =
    record?.secondCutShare ??
    defaultRecord.secondCutShare;

  const legacyCombinedTotal =
    getPercentageTotal(firstActivities) +
    getPercentageTotal(secondActivities);

  /*
   * Migración de la versión anterior:
   * antes cada corte interno sumaba 100 % y luego se volvía
   * a multiplicar por 50/50. En SIMCA, en cambio, Corte 1 y
   * Corte 2 reparten ENTRE LOS DOS el 100 % del componente 70 %.
   *
   * Un registro antiguo típico tenía 100 % + 100 %. Para no
   * alterar su resultado histórico se escala cada bloque por
   * firstCutShare / secondCutShare. Los registros que ya fueron
   * ajustados manualmente a 50 % + 50 % no se vuelven a escalar.
   */
  const shouldMigrateLegacyWeights =
    record !== undefined &&
    record.weightingVersion !== 2 &&
    legacyCombinedTotal > 100.0001;

  return {
    firstCutShare,
    secondCutShare,
    weightingVersion: 2,

    cuts: {
      first: {
        activities:
          shouldMigrateLegacyWeights
            ? scaleActivitiesToComponentShare(
              firstActivities,
              firstCutShare,
            )
            : firstActivities,
      },

      second: {
        activities:
          shouldMigrateLegacyWeights
            ? scaleActivitiesToComponentShare(
              secondActivities,
              secondCutShare,
            )
            : secondActivities,
      },

      third: {
        activities: thirdActivities,
      },
    },

    updatedAt:
      record?.updatedAt ?? null,
  };
};
