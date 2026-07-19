export type ScheduleDay =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday";

export interface ScheduleClass {
    id: string;

    subjectName: string;

    day: ScheduleDay;

    startTime: string;
    endTime: string;
}

export interface StudentSchedule {
    version: 1;
    classes: ScheduleClass[];
}