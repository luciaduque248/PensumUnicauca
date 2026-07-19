import type {
    StudentProfile,
} from "../types/studentProfile";

export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
    isConfigured: false,

    fullName: "",

    university: "Universidad del Cauca",
    program:
        "Ingeniería Electrónica y Telecomunicaciones",

    curriculumId: "",
    studentCode: "",
    currentSemester: null,

    admissionYear: null,
    admissionPeriod: "",

    careerAverage: "",
    previousSemesterAverage: "",
    academicStatus: "active",

    freeTuition: {
        isBeneficiary: false,
        period: "",
        approvedPeriods: null,
        fundedPeriods: null,
        remainingPeriods: null,
    },

    personalInformation: {
        identificationType: "",
        identificationNumber: "",
        documentIssueCity: "",
        birthDate: "",
        institutionalUser: "",
    },
};