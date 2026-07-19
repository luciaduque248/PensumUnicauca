export type StudentAcademicStatus =
    | "active"
    | "inactive"
    | "suspended"
    | "graduated"
    | "other";

export type StudentAdmissionPeriod =
    | ""
    | "1"
    | "2";

export interface StudentFreeTuitionInformation {
    isBeneficiary: boolean;
    period: string;
    approvedPeriods: number | null;
    fundedPeriods: number | null;
    remainingPeriods: number | null;
}

export interface StudentPersonalInformation {
    identificationType: string;
    identificationNumber: string;
    documentIssueCity: string;
    birthDate: string;
    institutionalUser: string;
}

export interface StudentProfile {
    isConfigured: boolean;

    fullName: string;

    /*
     * Estos dos valores pertenecen al pensum de la
     * aplicación y no pueden ser modificados.
     */
    university: string;
    program: string;

    curriculumId: string;
    studentCode: string;
    currentSemester: number | null;

    admissionYear: number | null;
    admissionPeriod: StudentAdmissionPeriod;

    careerAverage: string;
    previousSemesterAverage: string;
    academicStatus: StudentAcademicStatus;

    freeTuition: StudentFreeTuitionInformation;
    personalInformation: StudentPersonalInformation;
}