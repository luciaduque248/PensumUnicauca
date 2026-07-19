import type {
  GradeActivity,
  GradeCutId,
  StudentGradeRecords,
  SubjectGradeRecord,
} from "../types/grades";

export const SUBJECT_GRADE_RECORDS_STORAGE_KEY =
  "pensum-subject-grade-records";

export const DEFAULT_STUDENT_GRADE_RECORDS:
  StudentGradeRecords = {};

const createDefaultActivity = (
  subjectCode: string,
  cutId: GradeCutId,
): GradeActivity => ({
  id: `${subjectCode}-${cutId}-partial`,
  name: "Parcial",
  percentage: 100,
  grade: null,
});

export const createDefaultSubjectGradeRecord = (
  subjectCode: string,
): SubjectGradeRecord => ({
  firstCutShare: 50,
  secondCutShare: 50,

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

export const normalizeSubjectGradeRecord = (
  subjectCode: string,
  record: SubjectGradeRecord | undefined,
): SubjectGradeRecord => {
  const defaultRecord =
    createDefaultSubjectGradeRecord(
      subjectCode,
    );

  return {
    firstCutShare:
      record?.firstCutShare ??
      defaultRecord.firstCutShare,

    secondCutShare:
      record?.secondCutShare ??
      defaultRecord.secondCutShare,

    cuts: {
      first: {
        activities:
          Array.isArray(
            record?.cuts?.first
              ?.activities,
          ) &&
          record.cuts.first
            .activities.length > 0
            ? record.cuts.first
              .activities
            : defaultRecord.cuts
              .first.activities,
      },

      second: {
        activities:
          Array.isArray(
            record?.cuts?.second
              ?.activities,
          ) &&
          record.cuts.second
            .activities.length > 0
            ? record.cuts.second
              .activities
            : defaultRecord.cuts
              .second.activities,
      },

      third: {
        activities:
          Array.isArray(
            record?.cuts?.third
              ?.activities,
          ) &&
          record.cuts.third
            .activities.length > 0
            ? record.cuts.third
              .activities
            : defaultRecord.cuts
              .third.activities,
      },
    },

    updatedAt:
      record?.updatedAt ?? null,
  };
};
