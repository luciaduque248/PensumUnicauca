import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSubjectGrade,
  roundGradeToOfficialTenth,
  roundGradeToTwoDecimals,
} from "../src/utils/gradeCalculations.js";

import type {
  GradeActivity,
  SubjectGradeRecord,
} from "../src/types/grades.js";

const activity = (
  id: string,
  percentage: number,
  grade: number | null,
): GradeActivity => ({
  id,
  name: id,
  percentage,
  grade,
});

const record = (
  first: GradeActivity[],
  second: GradeActivity[],
  third: GradeActivity[],
): SubjectGradeRecord => ({
  firstCutShare: 50,
  secondCutShare: 50,
  weightingVersion: 2,
  cuts: {
    first: { activities: first },
    second: { activities: second },
    third: { activities: third },
  },
  updatedAt: null,
});

const roundRequiredContribution = (
  value: number | null,
): number => {
  if (value === null) {
    throw new Error("Se esperaba una contribución calculada.");
  }

  return roundGradeToTwoDecimals(value);
};

test("reproduce el cálculo de SIMCA del caso 1.8, 0 y 0", () => {
  const result = calculateSubjectGrade(
    record(
      [activity("Parcial 1", 50, 1.8)],
      [activity("Parcial 2", 50, 0)],
      [activity("Parcial 3", 100, 0)],
    ),
  );

  assert.equal(result.firstCutGrade, 0.9);
  assert.equal(result.secondCutGrade, 0);
  assert.equal(result.previousNote, 0.9);
  assert.equal(roundRequiredContribution(result.previousContributionExact), 0.63);
  assert.equal(result.accumulatedTwoDecimals, 0.63);
  assert.equal(result.officialOneDecimal, 0.6);
  assert.equal(result.isComplete, true);
});

test("no aplica dos veces el 50 por ciento de los dos primeros cortes", () => {
  const result = calculateSubjectGrade(
    record(
      [activity("Corte 1", 50, 4)],
      [activity("Corte 2", 50, 3)],
      [activity("Corte 3", 100, 5)],
    ),
  );

  assert.equal(result.previousNote, 3.5);
  assert.equal(roundRequiredContribution(result.previousContributionExact), 2.45);
  assert.equal(roundRequiredContribution(result.thirdContributionExact), 1.5);
  assert.equal(result.accumulatedTwoDecimals, 3.95);
  assert.equal(result.officialOneDecimal, 4);
});

test("permite repartir el componente del 70 por ciento entre varias actividades", () => {
  const result = calculateSubjectGrade(
    record(
      [
        activity("Parcial", 30, 4),
        activity("Quiz", 20, 5),
      ],
      [activity("Segundo parcial", 50, 3)],
      [activity("Final", 100, 4)],
    ),
  );

  assert.equal(result.firstCutGrade, 2.2);
  assert.equal(result.secondCutGrade, 1.5);
  assert.equal(result.previousNote, 3.7);
  assert.equal(roundRequiredContribution(result.previousContributionExact), 2.59);
  assert.equal(roundRequiredContribution(result.thirdContributionExact), 1.2);
  assert.equal(result.accumulatedTwoDecimals, 3.79);
  assert.equal(result.officialOneDecimal, 3.8);
  assert.equal(result.isComplete, true);
});

test("marca como incompleto un componente cuyos porcentajes no suman 100", () => {
  const result = calculateSubjectGrade(
    record(
      [activity("Parcial 1", 40, 4)],
      [activity("Parcial 2", 40, 4)],
      [activity("Parcial 3", 100, 4)],
    ),
  );

  assert.equal(result.isComplete, false);
  assert.equal(result.accumulatedTwoDecimals, 3.44);
});

test("mantiene la regla institucional de redondeo a una décima", () => {
  assert.equal(roundGradeToOfficialTenth(2.94), 2.9);
  assert.equal(roundGradeToOfficialTenth(2.95), 3);
  assert.equal(roundGradeToOfficialTenth(3.04), 3);
  assert.equal(roundGradeToOfficialTenth(3.05), 3.1);
});

test("redondea el acumulado a dos decimales antes de mostrarlo", () => {
  assert.equal(roundGradeToTwoDecimals(0.625), 0.63);
  assert.equal(roundGradeToTwoDecimals(3.944), 3.94);
  assert.equal(roundGradeToTwoDecimals(3.945), 3.95);
});
