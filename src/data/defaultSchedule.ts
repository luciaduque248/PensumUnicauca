import type {
    StudentSchedule,
} from "../types/schedule";

export const STUDENT_SCHEDULE_STORAGE_KEY =
    "pensum-student-schedule";

export const DEFAULT_STUDENT_SCHEDULE: StudentSchedule = {
    version: 1,
    classes: [],
};