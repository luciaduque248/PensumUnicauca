export type GradeCutId =
  | "first"
  | "second"
  | "third";

export interface GradeActivity {
  id: string;
  name: string;
  percentage: number;
  grade: number | null;
}

export interface GradeCutRecord {
  activities: GradeActivity[];
}

export interface SubjectGradeRecord {
  firstCutShare: number;
  secondCutShare: number;

  cuts: Record<
    GradeCutId,
    GradeCutRecord
  >;

  updatedAt: string | null;
}

export type StudentGradeRecords =
  Record<string, SubjectGradeRecord>;
