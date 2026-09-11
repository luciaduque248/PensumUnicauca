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

  /*
   * v2: los porcentajes de Corte 1 y Corte 2 se interpretan
   * conjuntamente dentro del componente del 70 %, como en SIMCA.
   * Se conserva opcional para migrar registros antiguos.
   */
  weightingVersion?: 2;

  cuts: Record<
    GradeCutId,
    GradeCutRecord
  >;

  updatedAt: string | null;
}

export type StudentGradeRecords =
  Record<string, SubjectGradeRecord>;
