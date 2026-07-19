export type ScheduleDay =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday";

export type ScheduleClassSource =
    | "manual"
    | "academic-offer";

export interface AcademicOfferMeeting {
    day: ScheduleDay;
    startTime: string;
    endTime: string;
    classroom: string;
}

export interface AcademicOfferGroup {
    id: string;

    period: string;
    semester: number | null;

    subjectCode: string;
    subjectName: string;

    group: string;
    teacher: string;

    meetings: AcademicOfferMeeting[];
}

export interface ImportedAcademicOffer {
    version: 1;

    fileName: string;

    /*
     * Nombre de la hoja donde el sistema detectó
     * automáticamente la tabla estructurada.
     *
     * Es opcional para conservar compatibilidad con
     * ofertas que ya estén guardadas en localStorage.
     */
    sourceSheetName?: string;

    importedAt: string;

    period: string;
    program: string;

    groups: AcademicOfferGroup[];
}

export interface ScheduleClass {
    id: string;

    subjectName: string;

    day: ScheduleDay;
    startTime: string;
    endTime: string;

    /*
     * Estos campos son opcionales para conservar
     * compatibilidad con materias creadas antes
     * de implementar la importación del Excel.
     */
    subjectCode?: string;
    group?: string;
    teacher?: string;
    classroom?: string;

    source?: ScheduleClassSource;
    offerGroupId?: string;
}

export interface StudentSchedule {
    version: 2;

    classes: ScheduleClass[];

    importedOffer:
    | ImportedAcademicOffer
    | null;

    isConfirmed: boolean;
    confirmedAt: string | null;
}