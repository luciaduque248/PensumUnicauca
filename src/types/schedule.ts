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
     * Información de la detección automática
     * dentro del libro de Excel.
     */
    sourceSheetName?: string;
    workbookSheetCount?: number;

    importedAt: string;

    period: string;
    program: string;

    groups: AcademicOfferGroup[];
}

export interface AcademicOfferFieldChange {
    /*
     * Campo del horario que fue modificado.
     */
    label:
    | "Horario"
    | "Docente"
    | "Salón";

    /*
     * Información antes y después de reemplazar
     * la oferta académica.
     */
    before: string;
    after: string;
}

export interface AcademicOfferSubjectChange {
    subjectName: string;
    group: string;

    changes:
    AcademicOfferFieldChange[];
}

export interface AcademicOfferImportResult {
    /*
     * Materias seleccionadas por el estudiante que
     * sí cambiaron dentro del nuevo documento.
     */
    updatedSubjects: number;

    /*
     * Materias seleccionadas que continuaron con
     * exactamente la misma información.
     */
    unchangedSubjects: number;

    /*
     * Materias o grupos del horario actual que no
     * aparecieron en la nueva oferta.
     */
    unmatchedSubjects: string[];

    /*
     * Cruces encontrados después de aplicar los
     * cambios automáticos.
     */
    conflictCount: number;

    /*
     * Detalle materia por materia de cada cambio.
     */
    subjectChanges:
    AcademicOfferSubjectChange[];
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