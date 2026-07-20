import { useEffect, useState, } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import "sweetalert2/dist/sweetalert2.min.css";

import "./styles/base.css";
import "./styles/navigation.css";
import "./styles/home.css";
import "./styles/academic-life.css";
import "./styles/student-record.css";
import "./styles/schedule.css";
import "./styles/grades.css";
import "./styles/sweetalert.css";
import "./styles/regulatory.css";

import {
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuRotateCcw,
  LuSearch,
  LuX,
  LuMoon,
  LuSun,
  LuGraduationCap,
} from "react-icons/lu";

import AcademicStatistics from "./components/AcademicStatistics";
import AppNavigation, { type AppView, } from "./components/AppNavigation";
import DegreeRequirementsCard from "./components/DegreeRequirementsCard";
import GradesPage from "./components/GradesPage";
import HomePage from "./components/HomePage";
import RegulatoryAlerts from "./components/RegulatoryAlerts";
import SchedulePage from "./components/SchedulePage";
import SemesterCard from "./components/SemesterCard";
import StudentAcademicRecordPage from "./components/StudentAcademicRecordPage";

import { curriculum } from "./data/curriculum";
import { degreeRequirements } from "./data/degreeRequirements";
import { externalPrerequisiteNames } from "./data/prerequisites";
import { DEFAULT_STUDENT_PROFILE } from "./data/defaultStudentProfile";

import { DEFAULT_STUDENT_SCHEDULE, STUDENT_SCHEDULE_STORAGE_KEY, } from "./data/defaultSchedule";
import {
  DEFAULT_STUDENT_GRADE_RECORDS,
  SUBJECT_GRADE_RECORDS_STORAGE_KEY,
} from "./data/defaultGrades";

import { useLocalStorage } from "./hooks/useLocalStorage";

import {
  hasRegisteredGrades,
} from "./utils/gradeCalculations";

import type {
  CurriculumSection,
  DegreeRequirement,
  DegreeRequirementStatus,
  RepeatLevel,
  StudentAcademicSituation,
  StudentRegulatoryRecord,
  Subject,
  SubjectAcademicRecord,
  SubjectAttempt,
  SubjectStatus,
} from "./types/curriculum";
import type { StudentProfile } from "./types/studentProfile";

import type {
  StudentGradeRecords,
  SubjectGradeRecord,
} from "./types/grades";

import type {
  AcademicOfferGroup,
  AcademicOfferImportResult,
  AcademicOfferSubjectChange,
  ImportedAcademicOffer,
  ScheduleClass,
  ScheduleDay,
  StudentSchedule,
} from "./types/schedule";

type SubjectFilter = | "all" | "pending" | "in-progress" | "approved" | "blocked";
type ThemeMode = "light" | "dark";

const SEMESTERS_PER_PAGE = 2;

const DEFAULT_STUDENT_REGULATORY_RECORD: StudentRegulatoryRecord = {
  hasLowPerformanceHistory: false,
  hasDisciplinarySanction: false,
  conditionalEnrollmentActive: false,
  conditionalEnrollmentsUsed: 0,
  lostRightToContinue: false,
};

const createAttemptId = () => {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createScheduleClassId = () => {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `schedule-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
};

const normalizeStudentSchedule = (
  schedule:
    | Partial<StudentSchedule>
    | undefined,
): StudentSchedule => {
  return {
    version: 2,

    classes:
      Array.isArray(
        schedule?.classes,
      )
        ? schedule.classes
        : [],

    importedOffer:
      schedule?.importedOffer ??
      null,

    isConfirmed:
      schedule?.isConfirmed ??
      false,

    confirmedAt:
      schedule?.confirmedAt ??
      null,
  };
};

const createSubjectAttempt = (
  repeatLevel: RepeatLevel,
  result: SubjectAttempt["result"],
): SubjectAttempt => ({
  id: createAttemptId(),
  attemptNumber: repeatLevel + 1,
  repeatLevel,
  result,
  recordedAt: new Date().toISOString(),
});

const getApprovedRepeatLevelFromRecord = (
  record: SubjectAcademicRecord | undefined,
): RepeatLevel | null => {
  if (!record) {
    return null;
  }

  if (record.approvedRepeatLevel !== null &&
    record.approvedRepeatLevel !== undefined) {
    return record.approvedRepeatLevel;
  }

  for (let index = record.attempts.length - 1; index >= 0; index -= 1) {
    const attempt = record.attempts[index];

    if (attempt.result === "approved") {
      return attempt.repeatLevel;
    }
  }

  return null;
};

const escapeHtml = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const normalizeScheduleSubjectName = (
  value: string,
) => {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
};

interface ScheduleSynchronizationResult
  extends AcademicOfferImportResult {
  classes: ScheduleClass[];
}

/*
 * Normaliza códigos, grupos, nombres y otros
 * valores utilizados para comparar la oferta.
 */
const normalizeScheduleComparisonValue = (
  value: string | undefined,
) => {
  return normalizeScheduleSubjectName(
    value ?? "",
  );
};

/*
 * Identifica una franja que fue creada a partir
 * de una oferta académica importada.
 *
 * Se revisan source y offerGroupId para conservar
 * compatibilidad con datos guardados previamente.
 */
const isImportedScheduleClass = (
  scheduleClass: ScheduleClass,
) => {
  return (
    scheduleClass.source ===
    "academic-offer" ||
    Boolean(
      scheduleClass.offerGroupId,
    )
  );
};

/*
 * Agrupa todas las franjas que pertenecen a la
 * misma materia y al mismo grupo.
 */
const getImportedScheduleGroupKey = (
  scheduleClass: ScheduleClass,
) => {
  const offerGroupId =
    scheduleClass.offerGroupId
      ?.trim();

  if (offerGroupId) {
    return `offer:${offerGroupId}`;
  }

  const subjectIdentity =
    normalizeScheduleComparisonValue(
      scheduleClass.subjectCode,
    ) ||
    normalizeScheduleComparisonValue(
      scheduleClass.subjectName,
    );

  const group =
    normalizeScheduleComparisonValue(
      scheduleClass.group,
    );

  return [
    "subject",
    subjectIdentity,
    "group",
    group,
  ].join(":");
};

/*
 * Busca en la nueva oferta el grupo equivalente
 * a la materia que ya estaba en el horario.
 *
 * Orden de prioridad:
 *
 * 1. Identificador exacto del grupo.
 * 2. Código de materia y grupo.
 * 3. Nombre de materia y grupo.
 */
const findEquivalentOfferGroup = (
  representativeClass:
    ScheduleClass,
  importedOffer:
    ImportedAcademicOffer,
): AcademicOfferGroup | undefined => {
  const currentOfferGroupId =
    representativeClass
      .offerGroupId
      ?.trim();

  if (currentOfferGroupId) {
    const exactGroup =
      importedOffer.groups.find(
        (offerGroup) =>
          offerGroup.id ===
          currentOfferGroupId,
      );

    if (exactGroup) {
      return exactGroup;
    }
  }

  const currentSubjectCode =
    normalizeScheduleComparisonValue(
      representativeClass
        .subjectCode,
    );

  const currentSubjectName =
    normalizeScheduleComparisonValue(
      representativeClass
        .subjectName,
    );

  const currentGroup =
    normalizeScheduleComparisonValue(
      representativeClass.group,
    );

  if (currentSubjectCode !== "") {
    const groupByCode =
      importedOffer.groups.find(
        (offerGroup) =>
          normalizeScheduleComparisonValue(
            offerGroup.subjectCode,
          ) ===
          currentSubjectCode &&
          normalizeScheduleComparisonValue(
            offerGroup.group,
          ) ===
          currentGroup,
      );

    if (groupByCode) {
      return groupByCode;
    }
  }

  return importedOffer.groups.find(
    (offerGroup) =>
      normalizeScheduleComparisonValue(
        offerGroup.subjectName,
      ) ===
      currentSubjectName &&
      normalizeScheduleComparisonValue(
        offerGroup.group,
      ) ===
      currentGroup,
  );
};

/*
 * Crea una firma comparable para saber si la
 * información oficial realmente cambió.
 */
const SCHEDULE_DAY_LABELS:
  Record<
    ScheduleDay,
    string
  > = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
};

const SCHEDULE_DAY_ORDER:
  Record<
    ScheduleDay,
    number
  > = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
};

const formatScheduleClock = (
  value: string,
) => {
  const [
    hourText,
    minuteText = "00",
  ] = value.split(":");

  const hour =
    Number(hourText);

  const period =
    hour < 12
      ? "a. m."
      : "p. m.";

  const displayedHour =
    hour % 12 || 12;

  return `${displayedHour}:${minuteText} ${period}`;
};

const sortScheduleClasses = (
  scheduleClasses:
    ScheduleClass[],
) => {
  return [
    ...scheduleClasses,
  ].sort(
    (
      firstClass,
      secondClass,
    ) => {
      const dayDifference =
        SCHEDULE_DAY_ORDER[
        firstClass.day
        ] -
        SCHEDULE_DAY_ORDER[
        secondClass.day
        ];

      if (
        dayDifference !==
        0
      ) {
        return dayDifference;
      }

      return (
        scheduleTimeToMinutes(
          firstClass.startTime,
        ) -
        scheduleTimeToMinutes(
          secondClass.startTime,
        )
      );
    },
  );
};

const sortOfferMeetings = (
  offerGroup:
    AcademicOfferGroup,
) => {
  return [
    ...offerGroup.meetings,
  ].sort(
    (
      firstMeeting,
      secondMeeting,
    ) => {
      const dayDifference =
        SCHEDULE_DAY_ORDER[
        firstMeeting.day
        ] -
        SCHEDULE_DAY_ORDER[
        secondMeeting.day
        ];

      if (
        dayDifference !==
        0
      ) {
        return dayDifference;
      }

      return (
        scheduleTimeToMinutes(
          firstMeeting.startTime,
        ) -
        scheduleTimeToMinutes(
          secondMeeting.startTime,
        )
      );
    },
  );
};

const getCurrentScheduleDescription = (
  scheduleClasses:
    ScheduleClass[],
) => {
  return sortScheduleClasses(
    scheduleClasses,
  )
    .map(
      (scheduleClass) =>
        `${SCHEDULE_DAY_LABELS[
        scheduleClass.day
        ]} ${formatScheduleClock(
          scheduleClass.startTime,
        )}–${formatScheduleClock(
          scheduleClass.endTime,
        )}`,
    )
    .join(" · ");
};

const getOfferScheduleDescription = (
  offerGroup:
    AcademicOfferGroup,
) => {
  return sortOfferMeetings(
    offerGroup,
  )
    .map(
      (meeting) =>
        `${SCHEDULE_DAY_LABELS[
        meeting.day
        ]} ${formatScheduleClock(
          meeting.startTime,
        )}–${formatScheduleClock(
          meeting.endTime,
        )}`,
    )
    .join(" · ");
};

/*
 * Evita repetir un mismo docente cuando una materia
 * tiene dos franjas semanales.
 */
const getUniqueDisplayValues = (
  values:
    Array<
      string | undefined
    >,
  fallback: string,
) => {
  const uniqueValues =
    new Map<
      string,
      string
    >();

  values.forEach(
    (value) => {
      const cleanValue =
        value?.trim() ?? "";

      if (
        cleanValue ===
        ""
      ) {
        return;
      }

      const normalizedValue =
        normalizeScheduleComparisonValue(
          cleanValue,
        );

      if (
        !uniqueValues.has(
          normalizedValue,
        )
      ) {
        uniqueValues.set(
          normalizedValue,
          cleanValue,
        );
      }
    },
  );

  const result =
    Array.from(
      uniqueValues.values(),
    );

  return result.length >
    0
    ? result.join(" · ")
    : fallback;
};

const getCurrentTeacherDescription = (
  scheduleClasses:
    ScheduleClass[],
) => {
  return getUniqueDisplayValues(
    scheduleClasses.map(
      (scheduleClass) =>
        scheduleClass.teacher,
    ),
    "Docente por confirmar",
  );
};

const getCurrentClassroomDescription = (
  scheduleClasses:
    ScheduleClass[],
) => {
  return sortScheduleClasses(
    scheduleClasses,
  )
    .map(
      (scheduleClass) =>
        `${SCHEDULE_DAY_LABELS[
        scheduleClass.day
        ]}: ${scheduleClass.classroom
          ?.trim() ||
        "Salón por confirmar"
        }`,
    )
    .join(" · ");
};

const getOfferClassroomDescription = (
  offerGroup:
    AcademicOfferGroup,
) => {
  return sortOfferMeetings(
    offerGroup,
  )
    .map(
      (meeting) =>
        `${SCHEDULE_DAY_LABELS[
        meeting.day
        ]}: ${meeting.classroom
          .trim() ||
        "Salón por confirmar"
        }`,
    )
    .join(" · ");
};

/*
 * Compara una materia del horario actual con su
 * grupo equivalente dentro de la nueva oferta.
 */
const buildAcademicOfferSubjectChange = (
  currentGroupClasses:
    ScheduleClass[],
  newOfferGroup:
    AcademicOfferGroup,
):
  | AcademicOfferSubjectChange
  | null => {
  const changes:
    AcademicOfferSubjectChange["changes"] =
    [];

  const currentSchedule =
    getCurrentScheduleDescription(
      currentGroupClasses,
    );

  const newSchedule =
    getOfferScheduleDescription(
      newOfferGroup,
    );

  if (
    normalizeScheduleComparisonValue(
      currentSchedule,
    ) !==
    normalizeScheduleComparisonValue(
      newSchedule,
    )
  ) {
    changes.push({
      label:
        "Horario",

      before:
        currentSchedule ||
        "Sin horario",

      after:
        newSchedule ||
        "Sin horario",
    });
  }

  const currentTeacher =
    getCurrentTeacherDescription(
      currentGroupClasses,
    );

  const newTeacher =
    newOfferGroup.teacher
      .trim() ||
    "Docente por confirmar";

  if (
    normalizeScheduleComparisonValue(
      currentTeacher,
    ) !==
    normalizeScheduleComparisonValue(
      newTeacher,
    )
  ) {
    changes.push({
      label:
        "Docente",

      before:
        currentTeacher,

      after:
        newTeacher,
    });
  }

  const currentClassrooms =
    getCurrentClassroomDescription(
      currentGroupClasses,
    );

  const newClassrooms =
    getOfferClassroomDescription(
      newOfferGroup,
    );

  if (
    normalizeScheduleComparisonValue(
      currentClassrooms,
    ) !==
    normalizeScheduleComparisonValue(
      newClassrooms,
    )
  ) {
    changes.push({
      label:
        "Salón",

      before:
        currentClassrooms ||
        "Salón por confirmar",

      after:
        newClassrooms ||
        "Salón por confirmar",
    });
  }

  if (
    changes.length ===
    0
  ) {
    return null;
  }

  return {
    subjectName:
      newOfferGroup.subjectName,

    group:
      newOfferGroup.group,

    changes,
  };
};

const scheduleTimeToMinutes = (
  value: string,
) => {
  const [
    hourText,
    minuteText = "0",
  ] = value.split(":");

  return (
    Number(hourText) * 60 +
    Number(minuteText)
  );
};

/*
 * Cuenta cruces entre materias diferentes
 * después de aplicar la nueva oferta.
 */
const countScheduleConflicts = (
  scheduleClasses:
    ScheduleClass[],
) => {
  let conflictCount = 0;

  for (
    let firstIndex = 0;
    firstIndex <
    scheduleClasses.length;
    firstIndex += 1
  ) {
    const firstClass =
      scheduleClasses[
      firstIndex
      ];

    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
      scheduleClasses.length;
      secondIndex += 1
    ) {
      const secondClass =
        scheduleClasses[
        secondIndex
        ];

      if (
        firstClass.day !==
        secondClass.day
      ) {
        continue;
      }

      /*
       * No se contabilizan como cruce dos
       * franjas de la misma materia.
       */
      if (
        normalizeScheduleSubjectName(
          firstClass.subjectName,
        ) ===
        normalizeScheduleSubjectName(
          secondClass.subjectName,
        )
      ) {
        continue;
      }

      const overlaps =
        scheduleTimeToMinutes(
          firstClass.startTime,
        ) <
        scheduleTimeToMinutes(
          secondClass.endTime,
        ) &&
        scheduleTimeToMinutes(
          firstClass.endTime,
        ) >
        scheduleTimeToMinutes(
          secondClass.startTime,
        );

      if (overlaps) {
        conflictCount += 1;
      }
    }
  }

  return conflictCount;
};

/*
 * Sincroniza las materias que fueron agregadas
 * desde la oferta académica.
 *
 * Las materias manuales permanecen intactas.
 */
const synchronizeScheduleWithOffer = (
  currentClasses:
    ScheduleClass[],
  importedOffer:
    ImportedAcademicOffer,
): ScheduleSynchronizationResult => {
  const importedClassGroups =
    new Map<
      string,
      ScheduleClass[]
    >();

  currentClasses.forEach(
    (scheduleClass) => {
      if (
        !isImportedScheduleClass(
          scheduleClass,
        )
      ) {
        return;
      }

      const groupKey =
        getImportedScheduleGroupKey(
          scheduleClass,
        );

      const currentGroup =
        importedClassGroups.get(
          groupKey,
        ) ?? [];

      currentGroup.push(
        scheduleClass,
      );

      importedClassGroups.set(
        groupKey,
        currentGroup,
      );
    },
  );

  const processedGroups =
    new Set<string>();

  const synchronizedClasses:
    ScheduleClass[] = [];

  const unmatchedSubjects =
    new Set<string>();

  const subjectChanges:
    AcademicOfferSubjectChange[] =
    [];

  let updatedSubjects = 0;
  let unchangedSubjects = 0;

  currentClasses.forEach(
    (scheduleClass) => {
      /*
       * Las materias manuales no dependen
       * del archivo importado.
       */
      if (
        !isImportedScheduleClass(
          scheduleClass,
        )
      ) {
        synchronizedClasses.push(
          scheduleClass,
        );

        return;
      }

      const groupKey =
        getImportedScheduleGroupKey(
          scheduleClass,
        );

      /*
       * Cada grupo se procesa una sola vez,
       * aunque tenga dos o más franjas.
       */
      if (
        processedGroups.has(
          groupKey,
        )
      ) {
        return;
      }

      processedGroups.add(
        groupKey,
      );

      const currentGroupClasses =
        importedClassGroups.get(
          groupKey,
        ) ?? [
          scheduleClass,
        ];

      const representativeClass =
        currentGroupClasses[0];

      const equivalentOfferGroup =
        findEquivalentOfferGroup(
          representativeClass,
          importedOffer,
        );

      /*
       * No se borra ni se cambia de grupo
       * automáticamente cuando no hay coincidencia.
       */
      if (!equivalentOfferGroup) {
        synchronizedClasses.push(
          ...currentGroupClasses,
        );

        unmatchedSubjects.add(
          `${representativeClass.subjectName} · grupo ${representativeClass.group ||
          "sin grupo"
          }`,
        );

        return;
      }

      const subjectChange =
        buildAcademicOfferSubjectChange(
          currentGroupClasses,
          equivalentOfferGroup,
        );

      if (
        subjectChange
      ) {
        updatedSubjects += 1;

        subjectChanges.push(
          subjectChange,
        );
      } else {
        unchangedSubjects += 1;
      }

      const replacementClasses:
        ScheduleClass[] =
        equivalentOfferGroup
          .meetings
          .map(
            (
              meeting,
              meetingIndex,
            ) => ({
              id:
                currentGroupClasses[
                  meetingIndex
                ]?.id ??
                createScheduleClassId(),

              subjectName:
                equivalentOfferGroup
                  .subjectName,

              subjectCode:
                equivalentOfferGroup
                  .subjectCode,

              group:
                equivalentOfferGroup
                  .group,

              teacher:
                equivalentOfferGroup
                  .teacher,

              classroom:
                meeting.classroom,

              day:
                meeting.day,

              startTime:
                meeting.startTime,

              endTime:
                meeting.endTime,

              source:
                "academic-offer",

              offerGroupId:
                equivalentOfferGroup
                  .id,
            }),
          );

      synchronizedClasses.push(
        ...replacementClasses,
      );
    },
  );

  return {
    classes:
      synchronizedClasses,

    updatedSubjects,

    unchangedSubjects,

    unmatchedSubjects:
      Array.from(
        unmatchedSubjects,
      ),

    conflictCount:
      countScheduleConflicts(
        synchronizedClasses,
      ),

    subjectChanges,
  };
};

function App() {
  const requestedView =
    new URLSearchParams(
      window.location.search,
    ).get("view");

  const currentView: AppView =
    requestedView === "academic-life" ||
      requestedView === "student-record" ||
      requestedView === "schedule" ||
      requestedView === "grades"
      ? requestedView
      : "home";

  const isStudentRecordView =
    currentView === "student-record";

  const isAcademicLifeView =
    currentView === "academic-life";

  const isScheduleView =
    currentView === "schedule";

  const isGradesView =
    currentView === "grades";

  /*
   * =====================================================
   * INFORMACIÓN GENERAL DEL PENSUM
   * =====================================================
   */

  const allSubjects = curriculum.flatMap((section) => section.subjects);

  /*
   * Los semestres académicos se muestran en la cuadrícula
   * principal. El componente complementario se presenta
   * aparte, junto con los requisitos de grado.
   */
  const semesterSections = curriculum.filter(
    (section) => section.semester !== undefined,
  );

  /*
 * Materias disponibles para el autocompletado
 * del formulario del horario.
 */
  const availableScheduleSubjectNames =
    Array.from(
      new Set(
        semesterSections.flatMap(
          (section) =>
            section.subjects.map(
              (subject) =>
                subject.name,
            ),
        ),
      ),
    ).sort((firstName, secondName) =>
      firstName.localeCompare(
        secondName,
        "es",
      ),
    );

  const additionalRequirementsSection = curriculum.find(
    (section) => section.semester === undefined,
  );

  const totalSubjects = allSubjects.length;

  const totalCredits = allSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  );

  /*
   * =====================================================
   * ESTADOS DE LAS MATERIAS
   * =====================================================
   */

  const initialStatuses: Record<string, SubjectStatus> = Object.fromEntries(
    allSubjects.map((subject) => [subject.code, "pending" as SubjectStatus]),
  );

  const [savedSubjectStatuses, setSavedSubjectStatuses] = useLocalStorage<
    Record<string, SubjectStatus>
  >("pensum-subject-statuses", initialStatuses);

  /*
   * Se combinan los estados iniciales con los guardados.
   *
   * Así, si se agrega una materia nueva al pensum,
   * comenzará automáticamente como pendiente.
   */
  const subjectStatuses: Record<string, SubjectStatus> = {
    ...initialStatuses,
    ...savedSubjectStatuses,
  };

  /*
   * =====================================================
   * HISTORIAL ACADÉMICO Y REPITENCIAS
   * =====================================================
   */

  const initialSubjectAcademicRecords: Record<
    string,
    SubjectAcademicRecord
  > = Object.fromEntries(
    allSubjects.map((subject) => [
      subject.code,
      {
        repeatLevel: 0 as RepeatLevel,
        approvedRepeatLevel: null,
        failedAttempts: 0,
        attempts: [],
      },
    ]),
  );

  const [
    savedSubjectAcademicRecords,
    setSavedSubjectAcademicRecords,
  ] = useLocalStorage<Record<string, SubjectAcademicRecord>>(
    "pensum-subject-academic-records",
    initialSubjectAcademicRecords,
  );

  const subjectAcademicRecords: Record<
    string,
    SubjectAcademicRecord
  > = Object.fromEntries(
    allSubjects.map((subject) => {
      const savedRecord =
        savedSubjectAcademicRecords[subject.code];

      return [
        subject.code,
        {
          repeatLevel: savedRecord?.repeatLevel ?? 0,
          approvedRepeatLevel:
            getApprovedRepeatLevelFromRecord(savedRecord),
          failedAttempts: savedRecord?.failedAttempts ?? 0,
          attempts: Array.isArray(savedRecord?.attempts)
            ? savedRecord.attempts
            : [],
        },
      ];
    }),
  );

  const [
    savedStudentRegulatoryRecord,
    setSavedStudentRegulatoryRecord,
  ] = useLocalStorage<StudentRegulatoryRecord>(
    "pensum-student-regulatory-record",
    DEFAULT_STUDENT_REGULATORY_RECORD,
  );

  const studentRegulatoryRecord: StudentRegulatoryRecord = {
    ...DEFAULT_STUDENT_REGULATORY_RECORD,
    ...savedStudentRegulatoryRecord,
    conditionalEnrollmentsUsed: Math.min(
      2,
      Math.max(
        0,
        savedStudentRegulatoryRecord
          .conditionalEnrollmentsUsed ?? 0,
      ),
    ),
  };

  /*
 * =====================================================
 * PERFIL DEL ESTUDIANTE
 * =====================================================
 */

  const [
    savedStudentProfile,
    setSavedStudentProfile,
  ] = useLocalStorage<StudentProfile>(
    "pensum-student-profile",
    DEFAULT_STUDENT_PROFILE,
  );
  /*
   * Se combinan los valores predeterminados con los
   * almacenados en el navegador.
   *
   * Esto evita errores si en futuras versiones se agregan
   * campos nuevos al perfil.
   */
  const studentProfile: StudentProfile = {
    ...DEFAULT_STUDENT_PROFILE,
    ...savedStudentProfile,

    /*
     * La universidad y el programa pertenecen
     * exclusivamente al pensum de esta aplicación.
     */
    university:
      DEFAULT_STUDENT_PROFILE.university,

    program:
      DEFAULT_STUDENT_PROFILE.program,

    freeTuition: {
      ...DEFAULT_STUDENT_PROFILE.freeTuition,
      ...savedStudentProfile.freeTuition,
    },

    personalInformation: {
      ...DEFAULT_STUDENT_PROFILE.personalInformation,
      ...savedStudentProfile.personalInformation,
    },
  };

  /*
 * =====================================================
 * HORARIO ACADÉMICO
 * =====================================================
 */

  const [
    savedStudentSchedule,
    setSavedStudentSchedule,
  ] = useLocalStorage<StudentSchedule>(
    STUDENT_SCHEDULE_STORAGE_KEY,
    DEFAULT_STUDENT_SCHEDULE,
  );

  const studentSchedule =
    normalizeStudentSchedule(
      savedStudentSchedule,
    );

  /*
   * =====================================================
   * NOTAS DEL SEMESTRE
   * =====================================================
   */

  const [
    savedSubjectGradeRecords,
    setSavedSubjectGradeRecords,
  ] = useLocalStorage<StudentGradeRecords>(
    SUBJECT_GRADE_RECORDS_STORAGE_KEY,
    DEFAULT_STUDENT_GRADE_RECORDS,
  );

  const handleSubjectGradeRecordChange = (
    subjectCode: string,
    record: SubjectGradeRecord,
  ) => {
    setSavedSubjectGradeRecords(
      (currentRecords) => ({
        ...currentRecords,
        [subjectCode]: record,
      }),
    );
  };

  /*
   * =====================================================
   * ESTADOS DE LOS REQUISITOS DE GRADO
   * =====================================================
   */

  const initialDegreeRequirementStatuses: Record<
    string,
    DegreeRequirementStatus
  > = Object.fromEntries(
    degreeRequirements.map((requirement) => [
      requirement.code,
      "pending" as DegreeRequirementStatus,
    ]),
  );

  const [savedDegreeRequirementStatuses, setSavedDegreeRequirementStatuses] =
    useLocalStorage<Record<string, DegreeRequirementStatus>>(
      "pensum-degree-requirements",
      initialDegreeRequirementStatuses,
    );

  const degreeRequirementStatuses: Record<string, DegreeRequirementStatus> = {
    ...initialDegreeRequirementStatuses,
    ...savedDegreeRequirementStatuses,
  };

  /*
   * =====================================================
   * FILTRO POR SEMESTRE
   * =====================================================
   */

  const [selectedSectionId, setSelectedSectionId] = useLocalStorage<string>(
    "pensum-selected-section",
    "all",
  );

  const [selectedStatusFilter, setSelectedStatusFilter] =
    useLocalStorage<SubjectFilter>("pensum-status-filter", "all");

  const [searchTerm, setSearchTerm] = useLocalStorage<string>(
    "pensum-search-term",
    "",
  );

  const [themeMode, setThemeMode] =
    useLocalStorage<ThemeMode>(
      "pensum-theme",
      "light",
    );

  useEffect(() => {
    document.documentElement.dataset.theme =
      themeMode;

    document.documentElement.style.colorScheme =
      themeMode;
  }, [themeMode]);

  useEffect(() => {
    const studentName =
      studentProfile.fullName.trim();

    document.title =
      studentProfile.isConfigured &&
        studentName !== ""
        ? `${studentName} · Mi pensum interactivo`
        : "Mi pensum interactivo";
  }, [
    studentProfile.fullName,
    studentProfile.isConfigured,
  ]);

  const [showCompletedSemesters, setShowCompletedSemesters,] = useLocalStorage<boolean>(
    "pensum-show-completed-semesters",
    false,
  );

  const [currentCurriculumPage, setCurrentCurriculumPage,] = useState(1);

  /*
   * =====================================================
   * NOMBRES DE MATERIAS POR CÓDIGO
   * =====================================================
   */

  const subjectNamesByCode: Record<string, string> = Object.fromEntries(
    allSubjects.map((subject) => [subject.code, subject.name]),
  );

  /*
   * También se agregan los requisitos externos que no
   * pertenecen directamente a las 58 materias del pensum.
   */
  const prerequisiteNamesByCode: Record<string, string> = {
    ...subjectNamesByCode,
    ...externalPrerequisiteNames,
  };

  /*
   * Conjunto de códigos que pertenecen al pensum.
   *
   * Esto permite ignorar requisitos externos como
   * ENFA1CX al construir las relaciones inversas.
   */
  const internalSubjectCodes = new Set(
    allSubjects.map((subject) => subject.code),
  );

  /*
   * Relación inversa de prerrequisitos.
   *
   * Ejemplo:
   *
   * MAT101.1: [
   *   Cálculo Integral,
   * ]
   *
   * Significa que Cálculo Diferencial desbloquea
   * Cálculo Integral.
   */
  const unlockedSubjectsByCode = allSubjects.reduce<Record<string, Subject[]>>(
    (result, subject) => {
      subject.prerequisites.forEach((prerequisiteCode) => {
        if (!internalSubjectCodes.has(prerequisiteCode)) {
          return;
        }

        if (!result[prerequisiteCode]) {
          result[prerequisiteCode] = [];
        }

        result[prerequisiteCode].push(subject);
      });

      return result;
    },
    {},
  );

  const normalizeSearchText = (value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  const getMissingPrerequisites = (subject: Subject) => {
    return subject.prerequisites.filter((prerequisiteCode) => {
      const prerequisiteStatus = subjectStatuses[prerequisiteCode];

      /*
       * Los requisitos externos no existen dentro
       * de subjectStatuses y no bloquean la materia.
       */
      return (
        prerequisiteStatus !== undefined && prerequisiteStatus !== "approved"
      );
    });
  };

  const isSubjectLocked = (subject: Subject) => {
    const currentStatus = subjectStatuses[subject.code] ?? "pending";

    /*
     * Una materia ya aprobada no vuelve a mostrarse
     * como bloqueada.
     */
    if (currentStatus === "approved") {
      return false;
    }

    return getMissingPrerequisites(subject).length > 0;
  };

  /*
   * =====================================================
   * CÁLCULOS DEL PROGRESO ACADÉMICO
   * =====================================================
   */

  const approvedSubjects = allSubjects.filter(
    (subject) => subjectStatuses[subject.code] === "approved",
  );

  const approvedCredits = approvedSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  );

  const pendingSubjects = allSubjects.filter(
    (subject) => subjectStatuses[subject.code] === "pending",
  ).length;

  const inProgressSubjects = allSubjects.filter(
    (subject) => subjectStatuses[subject.code] === "in-progress",
  ).length;

  const blockedSubjectsCount = allSubjects.filter(
    (subject) => isSubjectLocked(subject),
  ).length;

  const activeRepeatCounts = allSubjects.reduce(
    (counts, subject) => {
      const status =
        subjectStatuses[subject.code] ?? "pending";
      const repeatLevel =
        subjectAcademicRecords[subject.code]
          ?.repeatLevel ?? 0;

      if (status === "approved") {
        return counts;
      }

      if (repeatLevel === 1) {
        counts.r1 += 1;
      } else if (repeatLevel === 2) {
        counts.r2 += 1;
      } else if (repeatLevel === 3) {
        counts.r3 += 1;
      }

      return counts;
    },
    { r1: 0, r2: 0, r3: 0 },
  );

  const historicalRepeatCounts = allSubjects.reduce(
    (counts, subject) => {
      const record = subjectAcademicRecords[subject.code];
      const approvedRepeatLevel =
        getApprovedRepeatLevelFromRecord(record);
      const historicalLevel =
        subjectStatuses[subject.code] === "approved"
          ? approvedRepeatLevel ?? record?.repeatLevel ?? 0
          : record?.repeatLevel ?? approvedRepeatLevel ?? 0;

      if (historicalLevel === 1) {
        counts.r1 += 1;
      } else if (historicalLevel === 2) {
        counts.r2 += 1;
      } else if (historicalLevel === 3) {
        counts.r3 += 1;
      }

      return counts;
    },
    { r1: 0, r2: 0, r3: 0 },
  );

  const hasRepeatHistory = allSubjects.some((subject) => {
    const record = subjectAcademicRecords[subject.code];

    return (
      record.repeatLevel > 0 ||
      record.failedAttempts > 0 ||
      (record.approvedRepeatLevel ?? 0) > 0
    );
  });

  const studentAcademicSituation: StudentAcademicSituation =
    studentRegulatoryRecord.lostRightToContinue
      ? "lost-right"
      : studentRegulatoryRecord
        .conditionalEnrollmentActive
        ? "conditional-enrollment"
        : studentRegulatoryRecord
          .hasLowPerformanceHistory
          ? "low-performance"
          : "normal";

  const completedDegreeRequirements = degreeRequirements.filter(
    (requirement) =>
      degreeRequirementStatuses[requirement.code] === "completed",
  ).length;

  const progressPercentage =
    totalCredits === 0 ? 0 : Math.round((approvedCredits / totalCredits) * 100);

  const remainingCredits = Math.max(
    totalCredits - approvedCredits,
    0,
  );

  const semesterStatistics = semesterSections.map(
    (section) => {
      const semesterCredits = section.subjects.reduce(
        (total, subject) => total + subject.credits,
        0,
      );

      const approvedSemesterSubjects =
        section.subjects.filter(
          (subject) =>
            subjectStatuses[subject.code] ===
            "approved",
        ).length;

      const approvedSemesterCredits =
        section.subjects.reduce(
          (total, subject) => {
            const isApproved =
              subjectStatuses[subject.code] ===
              "approved";

            return isApproved
              ? total + subject.credits
              : total;
          },
          0,
        );

      const percentage =
        semesterCredits === 0
          ? 0
          : Math.round(
            (approvedSemesterCredits /
              semesterCredits) *
            100,
          );

      const isCompleted =
        section.subjects.length > 0 &&
        approvedSemesterSubjects ===
        section.subjects.length;

      return {
        id: section.id,
        title: section.title,
        approvedSubjects: approvedSemesterSubjects,
        totalSubjects: section.subjects.length,
        approvedCredits: approvedSemesterCredits,
        totalCredits: semesterCredits,
        percentage,
        isCompleted,
      };
    },
  );

  const completedSemesters = semesterStatistics.filter(
    (semester) => semester.isCompleted,
  ).length;

  const shouldShowRegulatoryTracking =
    completedSemesters > 0 ||
    hasRepeatHistory ||
    studentRegulatoryRecord.hasLowPerformanceHistory ||
    studentRegulatoryRecord.hasDisciplinarySanction ||
    studentRegulatoryRecord.conditionalEnrollmentActive ||
    studentRegulatoryRecord.conditionalEnrollmentsUsed > 0 ||
    studentRegulatoryRecord.lostRightToContinue;

  const completedSemesterIds = new Set(
    semesterStatistics
      .filter((semester) => semester.isCompleted)
      .map((semester) => semester.id),
  );

  const semesterSectionsForDisplay =
    showCompletedSemesters
      ? semesterSections
      : semesterSections.filter(
        (section) =>
          !completedSemesterIds.has(section.id),
      );

  const selectedSectionExists =
    selectedSectionId === "all" ||
    semesterSectionsForDisplay.some(
      (section) =>
        section.id === selectedSectionId,
    );

  const activeSectionId = selectedSectionExists
    ? selectedSectionId
    : "all";

  const strongestSemesterCandidate =
    semesterStatistics.reduce<
      (typeof semesterStatistics)[number] | null
    >((strongestSemester, currentSemester) => {
      if (strongestSemester === null) {
        return currentSemester;
      }

      if (
        currentSemester.percentage >
        strongestSemester.percentage
      ) {
        return currentSemester;
      }

      if (
        currentSemester.percentage ===
        strongestSemester.percentage &&
        currentSemester.approvedCredits >
        strongestSemester.approvedCredits
      ) {
        return currentSemester;
      }

      return strongestSemester;
    }, null);

  const strongestSemester =
    strongestSemesterCandidate !== null &&
      strongestSemesterCandidate.approvedCredits > 0
      ? strongestSemesterCandidate
      : null;

  /*
   * =====================================================
   * PENSUM FILTRADO
   * =====================================================
   */

  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  const sectionsSelectedBySemester =
    activeSectionId === "all"
      ? semesterSectionsForDisplay
      : semesterSectionsForDisplay.filter(
        (section) =>
          section.id === activeSectionId,
      );

  const matchesStatusFilter = (subject: Subject) => {
    const currentStatus = subjectStatuses[subject.code] ?? "pending";

    const subjectIsLocked = isSubjectLocked(subject);

    if (selectedStatusFilter === "all") {
      return true;
    }

    if (selectedStatusFilter === "blocked") {
      return subjectIsLocked;
    }

    /*
     * Una materia bloqueada se muestra únicamente
     * dentro del filtro "Bloqueadas".
     */
    if (subjectIsLocked) {
      return false;
    }

    return currentStatus === selectedStatusFilter;
  };

  const matchesSearchFilter = (subject: Subject) => {
    const normalizedName = normalizeSearchText(subject.name);

    const normalizedCode = normalizeSearchText(subject.code);

    return (
      normalizedSearchTerm === "" ||
      normalizedName.includes(normalizedSearchTerm) ||
      normalizedCode.includes(normalizedSearchTerm)
    );
  };

  const matchesCurrentFilters = (subject: Subject) => {
    return matchesSearchFilter(subject) && matchesStatusFilter(subject);
  };

  /*
   * La cuadrícula principal contiene únicamente
   * los semestres numerados.
   */
  const filteredSections = sectionsSelectedBySemester
    .map((section) => {
      const visibleSubjects = section.subjects.filter(matchesCurrentFilters);

      return {
        section,
        visibleSubjects,
      };
    })
    .filter(({ visibleSubjects }) => visibleSubjects.length > 0);

  /*
* =====================================================
* PAGINACIÓN DE SEMESTRES
* =====================================================
*
* La paginación se calcula después de:
*
* 1. Ocultar o mostrar semestres completados.
* 2. Aplicar el filtro por semestre.
* 3. Aplicar el filtro por estado.
* 4. Aplicar la búsqueda.
*
* Por esta razón, los semestres ocultos no generan
* páginas vacías.
*/

  const totalCurriculumPages = Math.max(
    1,
    Math.ceil(
      filteredSections.length /
      SEMESTERS_PER_PAGE,
    ),
  );

  /*
   * Si un semestre se completa y desaparece de la vista,
   * puede disminuir el total de páginas.
   *
   * Esta variable evita que se intente mostrar una página
   * que ya no existe.
   */
  const activeCurriculumPage = Math.min(
    currentCurriculumPage,
    totalCurriculumPages,
  );

  const firstCurriculumSectionIndex =
    (
      activeCurriculumPage -
      1
    ) *
    SEMESTERS_PER_PAGE;

  const paginatedSections =
    filteredSections.slice(
      firstCurriculumSectionIndex,
      firstCurriculumSectionIndex +
      SEMESTERS_PER_PAGE,
    );

  const curriculumPageNumbers =
    Array.from(
      {
        length:
          totalCurriculumPages,
      },
      (_, index) =>
        index + 1,
    );

  const currentPageSectionLabel =
    paginatedSections
      .map(
        ({ section }) =>
          section.title,
      )
      .join(" y ");

  const handleCurriculumPageChange = (
    pageNumber: number,
  ) => {
    const nextPage = Math.min(
      Math.max(
        pageNumber,
        1,
      ),
      totalCurriculumPages,
    );

    setCurrentCurriculumPage(
      nextPage,
    );

    /*
     * Cuando el usuario cambia de página desde el control
     * inferior, regresamos suavemente al inicio de las
     * tarjetas.
     */
    window.requestAnimationFrame(
      () => {
        document
          .getElementById(
            "curriculum-semester-pages",
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      },
    );
  };

  const renderCurriculumPagination = (
    placement:
      | "top"
      | "bottom",
  ) => {
    return (
      <nav
        className={`curriculum-pagination curriculum-pagination--${placement}`}
        aria-label={
          placement === "top"
            ? "Paginación superior de semestres"
            : "Paginación inferior de semestres"
        }
      >
        {placement === "top" && (
          <div className="curriculum-pagination__information">
            <span className="curriculum-pagination__eyebrow">
              Vista por páginas
            </span>

            <strong aria-live="polite">
              Página{" "}
              {activeCurriculumPage}{" "}
              de{" "}
              {totalCurriculumPages}
            </strong>

            <small>
              {currentPageSectionLabel}
            </small>
          </div>
        )}

        <div className="curriculum-pagination__controls">
          <button
            className="curriculum-pagination__direction"
            type="button"
            disabled={
              activeCurriculumPage ===
              1
            }
            onClick={() =>
              handleCurriculumPageChange(
                activeCurriculumPage -
                1,
              )
            }
            aria-label="Ir a la página anterior"
          >
            <LuChevronLeft aria-hidden="true" />

            <span>Anterior</span>
          </button>

          <div
            className="curriculum-pagination__pages"
            role="group"
            aria-label="Páginas disponibles"
          >
            {curriculumPageNumbers.map(
              (pageNumber) => {
                const isCurrentPage =
                  pageNumber ===
                  activeCurriculumPage;

                return (
                  <button
                    className={`curriculum-pagination__page ${isCurrentPage
                      ? "curriculum-pagination__page--active"
                      : ""
                      }`}
                    type="button"
                    key={pageNumber}
                    onClick={() =>
                      handleCurriculumPageChange(
                        pageNumber,
                      )
                    }
                    aria-label={`Ir a la página ${pageNumber}`}
                    aria-current={
                      isCurrentPage
                        ? "page"
                        : undefined
                    }
                  >
                    {pageNumber}
                  </button>
                );
              },
            )}
          </div>

          <button
            className="curriculum-pagination__direction"
            type="button"
            disabled={
              activeCurriculumPage ===
              totalCurriculumPages
            }
            onClick={() =>
              handleCurriculumPageChange(
                activeCurriculumPage +
                1,
              )
            }
            aria-label="Ir a la página siguiente"
          >
            <span>Siguiente</span>

            <LuChevronRight aria-hidden="true" />
          </button>
        </div>
      </nav>
    );
  };

  /*
   * Los requisitos adicionales se filtran con los mismos
   * controles, pero se renderizan en el bloque de requisitos.
   */
  const filteredAdditionalSubjects =
    activeSectionId === "all" && additionalRequirementsSection
      ? additionalRequirementsSection.subjects.filter(matchesCurrentFilters)
      : [];

  const semesterVisibleSubjectsCount = filteredSections.reduce(
    (total, { visibleSubjects }) => total + visibleSubjects.length,
    0,
  );

  const visibleSubjectsCount =
    semesterVisibleSubjectsCount + filteredAdditionalSubjects.length;

  const hasActiveFilters =
    activeSectionId !== "all" ||
    selectedStatusFilter !== "all" ||
    normalizedSearchTerm !== "";

  const shouldShowDegreeRequirements =
    activeSectionId === "all" &&
    selectedStatusFilter === "all" &&
    normalizedSearchTerm === "";

  const shouldShowAdditionalRequirements =
    activeSectionId === "all" &&
    additionalRequirementsSection !== undefined &&
    filteredAdditionalSubjects.length > 0;

  const shouldShowRequirementsArea =
    shouldShowDegreeRequirements || shouldShowAdditionalRequirements;

  const handleToggleTheme = () => {
    setThemeMode((currentTheme) =>
      currentTheme === "dark"
        ? "light"
        : "dark",
    );
  };

  /*
 * =====================================================
 * GUARDAR PERFIL DEL ESTUDIANTE
 * =====================================================
 */

  const handleSaveStudentProfile = (
    updatedProfile: StudentProfile,
  ) => {
    setSavedStudentProfile({
      ...DEFAULT_STUDENT_PROFILE,
      ...updatedProfile,

      university:
        DEFAULT_STUDENT_PROFILE.university,

      program:
        DEFAULT_STUDENT_PROFILE.program,

      freeTuition: {
        ...DEFAULT_STUDENT_PROFILE.freeTuition,
        ...updatedProfile.freeTuition,
      },

      personalInformation: {
        ...DEFAULT_STUDENT_PROFILE.personalInformation,
        ...updatedProfile.personalInformation,
      },
    });
  };

  /*
 * =====================================================
 * AGREGAR BLOQUE AL HORARIO
 * =====================================================
 */

  /*
 * =====================================================
 * AGREGAR UNA O DOS FRANJAS AL HORARIO
 * =====================================================
 */

  const handleAddScheduleClasses = (
    newScheduleClasses: Array<
      Omit<ScheduleClass, "id">
    >,
  ) => {
    const scheduleClassesWithId:
      ScheduleClass[] =
      newScheduleClasses.map(
        (newScheduleClass) => ({
          id:
            createScheduleClassId(),

          ...newScheduleClass,
        }),
      );

    setSavedStudentSchedule(
      (currentSchedule) => {
        const normalizedSchedule =
          normalizeStudentSchedule(
            currentSchedule,
          );

        return {
          ...normalizedSchedule,

          classes: [
            ...normalizedSchedule.classes,
            ...scheduleClassesWithId,
          ],
        };
      },
    );
  };

  /*
 * =====================================================
 * ACTUALIZAR UNA MATERIA DEL HORARIO
 * =====================================================
 */

  const handleUpdateScheduleSubject = (
    originalSubjectName: string,
    updatedScheduleClasses: Array<
      Omit<ScheduleClass, "id">
    >,
  ) => {
    setSavedStudentSchedule(
      (currentSchedule) => {
        const normalizedSchedule =
          normalizeStudentSchedule(
            currentSchedule,
          );

        const normalizedOriginalName =
          normalizeScheduleSubjectName(
            originalSubjectName,
          );

        /*
         * Franjas que pertenecen actualmente a la
         * materia que se está editando.
         */
        const originalClasses =
          normalizedSchedule.classes.filter(
            (scheduleClass) =>
              normalizeScheduleSubjectName(
                scheduleClass.subjectName,
              ) ===
              normalizedOriginalName,
          );

        /*
         * Las demás materias se conservan sin cambios.
         */
        const remainingClasses =
          normalizedSchedule.classes.filter(
            (scheduleClass) =>
              normalizeScheduleSubjectName(
                scheduleClass.subjectName,
              ) !==
              normalizedOriginalName,
          );

        const updatedClassesWithId:
          ScheduleClass[] =
          updatedScheduleClasses.map(
            (
              updatedScheduleClass,
              index,
            ) => ({
              /*
               * Conserva grupo, docente, salón,
               * procedencia y código cuando existían.
               */
              ...originalClasses[index],

              /*
               * Aplica los cambios realizados desde
               * el formulario.
               */
              ...updatedScheduleClass,

              /*
               * Conserva el identificador de la franja.
               * Si se agregó una franja nueva, crea uno.
               */
              id:
                originalClasses[index]
                  ?.id ??
                createScheduleClassId(),
            }),
          );

        return {
          ...normalizedSchedule,

          classes: [
            ...remainingClasses,
            ...updatedClassesWithId,
          ],
        };
      },
    );
  };

  /*
 * =====================================================
 * ELIMINAR UNA MATERIA DEL HORARIO
 * =====================================================
 */

  const handleDeleteScheduleSubject = (
    subjectName: string,
  ) => {
    const normalizedSubjectName =
      normalizeScheduleSubjectName(
        subjectName,
      );

    setSavedStudentSchedule(
      (currentSchedule) => {
        const normalizedSchedule =
          normalizeStudentSchedule(
            currentSchedule,
          );

        return {
          ...normalizedSchedule,

          classes:
            normalizedSchedule.classes.filter(
              (scheduleClass) =>
                normalizeScheduleSubjectName(
                  scheduleClass.subjectName,
                ) !==
                normalizedSubjectName,
            ),
        };
      },
    );
  };

  /*
   * =====================================================
   * CAMBIAR ESTADO DE UNA MATERIA
   * =====================================================
   */

  const handleClearFilters = () => {
    setCurrentCurriculumPage(1);
    setSelectedSectionId("all");
    setSelectedStatusFilter("all");
    setSearchTerm("");
  };

  const showNextPendingSemesters = () => {
    setCurrentCurriculumPage(1);
    setShowCompletedSemesters(false);
    setSelectedSectionId("all");
    setSelectedStatusFilter("all");
    setSearchTerm("");
  };

  const handleCompletedSemestersVisibility = (
    shouldShow: boolean,
  ) => {
    setCurrentCurriculumPage(1);

    setShowCompletedSemesters(
      shouldShow,
    );

    const selectedCompletedSemester =
      selectedSectionId !== "all" &&
      completedSemesterIds.has(
        selectedSectionId,
      );

    if (
      !shouldShow &&
      selectedCompletedSemester
    ) {
      setSelectedSectionId(
        "all",
      );
    }
  };

  const getSubjectAcademicRecord = (
    subjectCode: string,
  ): SubjectAcademicRecord => {
    return (
      subjectAcademicRecords[subjectCode] ?? {
        repeatLevel: 0,
        approvedRepeatLevel: null,
        failedAttempts: 0,
        attempts: [],
      }
    );
  };

  const handleDisciplinarySanctionChange = async (
    hasSanction: boolean,
  ) => {
    const result = await Swal.fire({
      icon: hasSanction ? "warning" : "question",
      title: hasSanction
        ? "¿Registrar sanción disciplinaria?"
        : "¿Retirar la sanción registrada?",
      html: `
        <div class="swal-confirmation-content">
          <p>
            ${hasSanction
          ? "Este dato se tendrá en cuenta al evaluar futuras pérdidas de materias cursadas en R2."
          : "Las futuras evaluaciones reglamentarias se realizarán sin una sanción disciplinaria registrada."
        }
          </p>

          <p>
            Esta modificación no cambia retroactivamente las
            pérdidas que ya fueron registradas.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: hasSanction
        ? "Sí, registrar"
        : "Sí, retirar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: hasSanction
        ? "#dc2626"
        : "#4f46e5",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSavedStudentRegulatoryRecord(
      (currentRecord) => ({
        ...DEFAULT_STUDENT_REGULATORY_RECORD,
        ...currentRecord,
        hasDisciplinarySanction: hasSanction,
      }),
    );
  };

  const handleStatusChange = async (
    subjectCode: string,
    newStatus: SubjectStatus,
  ) => {
    const currentStatus =
      subjectStatuses[subjectCode] ?? "pending";

    if (currentStatus === newStatus) {
      return;
    }

    if (
      studentRegulatoryRecord.lostRightToContinue &&
      newStatus !== "pending"
    ) {
      await Swal.fire({
        icon: "error",
        title: "Cambio bloqueado",
        text: "El historial registra pérdida del derecho a continuar. Verifica la situación con la Universidad antes de registrar nuevos avances.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#dc2626",
      });

      return;
    }

    const academicRecord =
      getSubjectAcademicRecord(subjectCode);

    const restrictedByConditionalEnrollment =
      studentRegulatoryRecord
        .conditionalEnrollmentActive &&
      academicRecord.repeatLevel === 0 &&
      (newStatus === "in-progress" ||
        newStatus === "approved");

    if (restrictedByConditionalEnrollment) {
      await Swal.fire({
        icon: "warning",
        title: "Restricción de matrícula condicional",
        html: `
          <div class="swal-confirmation-content">
            <p>
              Durante la matrícula condicional solo se pueden
              registrar materias que deban repetirse.
            </p>

            <p>
              Esta materia todavía se encuentra en intento
              regular.
            </p>
          </div>
        `,
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b",
      });

      return;
    }

    const subjectSemester = semesterSections.find(
      (section) =>
        section.subjects.some(
          (subject) =>
            subject.code === subjectCode,
        ),
    );

    const completesSemester =
      newStatus === "approved" &&
      subjectSemester !== undefined &&
      subjectSemester.subjects.every(
        (subject) =>
          subject.code === subjectCode ||
          subjectStatuses[subject.code] ===
          "approved",
      );

    setSavedSubjectStatuses((currentStatuses) => ({
      ...initialStatuses,
      ...currentStatuses,
      [subjectCode]: newStatus,
    }));

    if (newStatus === "approved") {
      setSavedSubjectAcademicRecords(
        (currentRecords) => {
          const mergedRecords = {
            ...initialSubjectAcademicRecords,
            ...currentRecords,
          };

          const currentRecord =
            mergedRecords[subjectCode];
          const lastAttempt =
            currentRecord.attempts.at(-1);

          const approvalAlreadyRegistered =
            lastAttempt?.result === "approved" &&
            lastAttempt.repeatLevel ===
            currentRecord.repeatLevel;

          if (approvalAlreadyRegistered) {
            return mergedRecords;
          }

          return {
            ...mergedRecords,
            [subjectCode]: {
              ...currentRecord,
              approvedRepeatLevel:
                currentRecord.repeatLevel,
              attempts: [
                ...currentRecord.attempts,
                createSubjectAttempt(
                  currentRecord.repeatLevel,
                  "approved",
                ),
              ],
            },
          };
        },
      );

      if (
        academicRecord.repeatLevel > 0 &&
        studentRegulatoryRecord
          .conditionalEnrollmentActive
      ) {
        const hasAnotherUnresolvedRepeat =
          allSubjects.some((subject) => {
            if (subject.code === subjectCode) {
              return false;
            }

            return (
              getSubjectAcademicRecord(
                subject.code,
              ).repeatLevel > 0 &&
              subjectStatuses[subject.code] !==
              "approved"
            );
          });

        if (!hasAnotherUnresolvedRepeat) {
          setSavedStudentRegulatoryRecord(
            (currentRecord) => ({
              ...DEFAULT_STUDENT_REGULATORY_RECORD,
              ...currentRecord,
              conditionalEnrollmentActive: false,
            }),
          );
        }
      }
    }

    if (!completesSemester || !subjectSemester) {
      return;
    }

    await Swal.fire({
      icon: "success",
      title: `¡${subjectSemester.title} completado!`,
      html: `
      <div class="swal-confirmation-content">
        <p>
          Has aprobado todas las materias de
          <strong>
            ${escapeHtml(subjectSemester.title)}
          </strong>.
        </p>

        <p>
          Este semestre se ocultará para optimizar
          el espacio y se mostrarán los semestres
          que todavía tienes pendientes.
        </p>

        <p>
          Puedes volver a verlo activando
          <strong>
            “Mostrar semestres completados”
          </strong>.
        </p>
      </div>
    `,
      confirmButtonText: "Ver siguientes semestres",
      confirmButtonColor: "#16a34a",
      allowOutsideClick: false,
    });

    showNextPendingSemesters();
  };

  const handleRegisterFailure = async (
    subject: Subject,
  ) => {
    const currentStatus =
      subjectStatuses[subject.code] ?? "pending";

    if (
      studentRegulatoryRecord.lostRightToContinue
    ) {
      await Swal.fire({
        icon: "error",
        title: "Registro bloqueado",
        text: "El historial ya registra pérdida del derecho a continuar estudios.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#dc2626",
      });

      return;
    }

    if (currentStatus !== "in-progress") {
      await Swal.fire({
        icon: "info",
        title: "La materia no está en curso",
        text: "Para registrar una pérdida, primero debes marcar la materia como En curso.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#4f46e5",
      });

      return;
    }

    const academicRecord =
      getSubjectAcademicRecord(subject.code);
    const repeatLevel = academicRecord.repeatLevel;

    const repeatDescription =
      repeatLevel === 0
        ? "intento regular"
        : `R${repeatLevel}`;

    const reachesConditionalEnrollment =
      repeatLevel === 2 &&
      !studentRegulatoryRecord
        .hasDisciplinarySanction &&
      (studentRegulatoryRecord
        .conditionalEnrollmentActive ||
        studentRegulatoryRecord
          .conditionalEnrollmentsUsed < 2);

    const losesRightInR2 =
      repeatLevel === 2 &&
      (studentRegulatoryRecord
        .hasDisciplinarySanction ||
        studentRegulatoryRecord
          .conditionalEnrollmentsUsed >= 2);

    let confirmationResult;

    if (repeatLevel === 3) {
      confirmationResult = await Swal.fire({
        icon: "error",
        title: "Advertencia académica crítica",
        html: `
          <div class="swal-confirmation-content">
            <p>
              <strong>${escapeHtml(subject.name)}</strong>
              está siendo cursada como repitente por
              tercera vez, R3.
            </p>

            <p>
              Registrar su pérdida implica la pérdida
              del derecho a continuar estudios en el
              programa.
            </p>

            <p>
              Escribe <strong>CONFIRMAR</strong> para
              continuar.
            </p>
          </div>
        `,
        input: "text",
        inputPlaceholder: "CONFIRMAR",
        showCancelButton: true,
        confirmButtonText: "Registrar pérdida",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
        focusCancel: true,
        allowOutsideClick: false,
        preConfirm: (value: string) => {
          if (value !== "CONFIRMAR") {
            Swal.showValidationMessage(
              "Debes escribir CONFIRMAR exactamente.",
            );
          }

          return value;
        },
      });
    } else {
      const consequenceHtml =
        repeatLevel === 0
          ? `La próxima vez deberá cursarse como <strong>R1</strong>.`
          : repeatLevel === 1
            ? `Se registrará un antecedente de <strong>bajo rendimiento</strong> y la próxima vez deberá cursarse como <strong>R2</strong>.`
            : reachesConditionalEnrollment
              ? `Se activará la <strong>matrícula condicional</strong> y la materia deberá cursarse como <strong>R3</strong>.`
              : `Esta pérdida produce una consecuencia académica definitiva y se registrará la <strong>pérdida del derecho a continuar</strong>.`;

      confirmationResult = await Swal.fire({
        icon: losesRightInR2
          ? "error"
          : repeatLevel >= 1
            ? "warning"
            : "question",
        title: "¿Registrar pérdida de la materia?",
        html: `
          <div class="swal-confirmation-content">
            <p>
              Se registrará la pérdida de
              <strong>${escapeHtml(subject.name)}</strong>
              durante ${repeatDescription}.
            </p>

            <p>${consequenceHtml}</p>

            <p>
              La materia volverá al estado
              <strong>Pendiente</strong>.
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Sí, registrar pérdida",
        cancelButtonText: "Cancelar",
        confirmButtonColor: losesRightInR2
          ? "#dc2626"
          : "#f59e0b",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
        focusCancel: true,
      });
    }

    if (!confirmationResult.isConfirmed) {
      return;
    }

    const nextRepeatLevel: RepeatLevel =
      repeatLevel < 3
        ? ((repeatLevel + 1) as RepeatLevel)
        : 3;

    const canEnterConditionalEnrollment =
      repeatLevel === 2 &&
      !studentRegulatoryRecord
        .hasDisciplinarySanction &&
      (studentRegulatoryRecord
        .conditionalEnrollmentActive ||
        studentRegulatoryRecord
          .conditionalEnrollmentsUsed < 2);

    const losesRightToContinue =
      repeatLevel === 3 ||
      (repeatLevel === 2 &&
        !canEnterConditionalEnrollment);

    const storedRepeatLevel: RepeatLevel =
      losesRightToContinue && repeatLevel === 2
        ? 2
        : nextRepeatLevel;

    setSavedSubjectStatuses((currentStatuses) => ({
      ...initialStatuses,
      ...currentStatuses,
      [subject.code]: "pending",
    }));

    setSavedSubjectAcademicRecords(
      (currentRecords) => {
        const mergedRecords = {
          ...initialSubjectAcademicRecords,
          ...currentRecords,
        };
        const currentRecord =
          mergedRecords[subject.code];

        return {
          ...mergedRecords,
          [subject.code]: {
            repeatLevel: storedRepeatLevel,
            approvedRepeatLevel:
              currentRecord.approvedRepeatLevel,
            failedAttempts:
              currentRecord.failedAttempts + 1,
            attempts: [
              ...currentRecord.attempts,
              createSubjectAttempt(
                repeatLevel,
                "failed",
              ),
            ],
          },
        };
      },
    );

    setSavedStudentRegulatoryRecord(
      (currentRecord) => {
        const mergedRecord = {
          ...DEFAULT_STUDENT_REGULATORY_RECORD,
          ...currentRecord,
        };

        if (repeatLevel === 1) {
          return {
            ...mergedRecord,
            hasLowPerformanceHistory: true,
          };
        }

        if (repeatLevel === 2) {
          if (!canEnterConditionalEnrollment) {
            return {
              ...mergedRecord,
              hasLowPerformanceHistory: true,
              conditionalEnrollmentActive: false,
              lostRightToContinue: true,
            };
          }

          return {
            ...mergedRecord,
            hasLowPerformanceHistory: true,
            conditionalEnrollmentActive: true,
            conditionalEnrollmentsUsed:
              mergedRecord
                .conditionalEnrollmentActive
                ? mergedRecord
                  .conditionalEnrollmentsUsed
                : Math.min(
                  2,
                  mergedRecord
                    .conditionalEnrollmentsUsed + 1,
                ),
          };
        }

        if (repeatLevel === 3) {
          return {
            ...mergedRecord,
            conditionalEnrollmentActive: false,
            lostRightToContinue: true,
          };
        }

        return mergedRecord;
      },
    );

    const resultTitle =
      repeatLevel === 0
        ? "Materia registrada en R1"
        : repeatLevel === 1
          ? "Bajo rendimiento registrado"
          : canEnterConditionalEnrollment
            ? "Matrícula condicional activada"
            : "Pérdida del derecho registrada";

    const resultText =
      repeatLevel === 0
        ? "La próxima vez la materia se cursará como repitente por primera vez."
        : repeatLevel === 1
          ? "La próxima vez la materia se cursará como repitente por segunda vez, R2."
          : canEnterConditionalEnrollment
            ? "La materia deberá cursarse en R3 y se aplicarán las restricciones de matrícula condicional."
            : "Verifica esta situación directamente con la Universidad del Cauca.";

    await Swal.fire({
      icon: losesRightToContinue
        ? "error"
        : repeatLevel >= 1
          ? "warning"
          : "success",
      title: resultTitle,
      text: resultText,
      confirmButtonText: "Entendido",
      confirmButtonColor: losesRightToContinue
        ? "#dc2626"
        : "#4f46e5",
    });
  };

  /*
 * =====================================================
 * IMPORTAR OFERTA ACADÉMICA
 * =====================================================
 */

  const handleImportAcademicOffer = (
    importedOffer:
      ImportedAcademicOffer,
  ): AcademicOfferImportResult => {
    /*
     * El reemplazo continúa bloqueado después
     * de confirmar el horario.
     */
    if (
      studentSchedule.isConfirmed
    ) {
      return {
        updatedSubjects: 0,
        unchangedSubjects: 0,
        unmatchedSubjects: [],
        conflictCount: 0,
        subjectChanges: [],
      };
    }

    const synchronizationResult =
      synchronizeScheduleWithOffer(
        studentSchedule.classes,
        importedOffer,
      );

    setSavedStudentSchedule({
      ...studentSchedule,

      importedOffer,

      /*
       * Las materias importadas se reemplazan
       * por la información equivalente del
       * nuevo archivo.
       */
      classes:
        synchronizationResult
          .classes,
    });

    return {
      updatedSubjects:
        synchronizationResult
          .updatedSubjects,

      unchangedSubjects:
        synchronizationResult
          .unchangedSubjects,

      unmatchedSubjects:
        synchronizationResult
          .unmatchedSubjects,

      conflictCount:
        synchronizationResult
          .conflictCount,

      subjectChanges:
        synchronizationResult
          .subjectChanges,
    };
  };

  /*
 * =====================================================
 * ELIMINAR OFERTA ACADÉMICA IMPORTADA
 * =====================================================
 */

  const handleRemoveAcademicOffer = () => {
    /*
     * El importador se encuentra oculto después de
     * confirmar el horario. Esta validación adicional
     * evita eliminar la oferta mediante una llamada
     * accidental cuando el horario ya está confirmado.
     */
    if (
      studentSchedule.isConfirmed
    ) {
      return;
    }

    setSavedStudentSchedule(
      (currentSchedule) => {
        const normalizedSchedule =
          normalizeStudentSchedule(
            currentSchedule,
          );

        return {
          ...normalizedSchedule,

          /*
           * Se elimina el catálogo importado,
           * independientemente de si provino de
           * un archivo local o de Google Drive.
           */
          importedOffer: null,

          /*
           * La usuaria solicitó que esta acción
           * borre completamente el horario.
           */
          classes: [],

          isConfirmed: false,
          confirmedAt: null,
        };
      },
    );
  };

  /*
   * =====================================================
   * CONFIRMAR HORARIO
   * =====================================================
   */

  const handleConfirmSchedule = () => {
    setSavedStudentSchedule(
      (currentSchedule) => {
        const normalizedSchedule =
          normalizeStudentSchedule(
            currentSchedule,
          );

        return {
          ...normalizedSchedule,

          isConfirmed: true,

          confirmedAt:
            new Date()
              .toISOString(),
        };
      },
    );
  };

  /*
   * =====================================================
   * CAMBIAR ESTADO DE UN REQUISITO DE GRADO
   * =====================================================
   */

  const handleDegreeRequirementStatusChange = async (
    requirement: DegreeRequirement,
    newStatus: DegreeRequirementStatus,
  ) => {
    const currentStatus =
      degreeRequirementStatuses[requirement.code] ?? "pending";

    if (currentStatus === newStatus) {
      return;
    }

    const isCompleting = newStatus === "completed";

    const result = await Swal.fire({
      icon: isCompleting ? "question" : "warning",

      title: isCompleting
        ? "¿Marcar requisito como completado?"
        : "¿Volver este requisito a pendiente?",

      text: isCompleting
        ? `Se marcará "${requirement.name}" como completado.`
        : `Se quitará el estado completado de "${requirement.name}".`,

      showCancelButton: true,

      confirmButtonText: isCompleting
        ? "Sí, completar"
        : "Sí, volver a pendiente",

      cancelButtonText: "Cancelar",

      confirmButtonColor: isCompleting ? "#16a34a" : "#f59e0b",

      cancelButtonColor: "#64748b",

      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSavedDegreeRequirementStatuses((currentStatuses) => ({
      ...initialDegreeRequirementStatuses,
      ...currentStatuses,
      [requirement.code]: newStatus,
    }));

    await Swal.fire({
      toast: true,
      position: "top-end",
      icon: isCompleting ? "success" : "info",

      title: isCompleting ? "Requisito completado" : "Requisito actualizado",

      text: requirement.name,

      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
    });
  };

  /*
   * =====================================================
   * APROBAR TODAS LAS MATERIAS DE UN SEMESTRE
   * =====================================================
   */

  const handleApproveSection = async (section: CurriculumSection) => {
    if (studentRegulatoryRecord.lostRightToContinue) {
      await Swal.fire({
        icon: "error",
        title: "Acción bloqueada",
        text: "El historial registra pérdida del derecho a continuar estudios.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#dc2626",
      });

      return;
    }

    const restrictedRegularSubjects =
      studentRegulatoryRecord
        .conditionalEnrollmentActive
        ? section.subjects.filter((subject) => {
          const status =
            subjectStatuses[subject.code] ??
            "pending";

          return (
            status !== "approved" &&
            getSubjectAcademicRecord(
              subject.code,
            ).repeatLevel === 0
          );
        })
        : [];

    if (restrictedRegularSubjects.length > 0) {
      await Swal.fire({
        icon: "warning",
        title: "Restricción de matrícula condicional",
        html: `
          <div class="swal-confirmation-content">
            <p>
              No se puede usar “Aprobar todo” porque el
              semestre contiene materias regulares que no
              están autorizadas durante la matrícula
              condicional.
            </p>

            <p>
              Modifica individualmente únicamente las
              materias que debas repetir.
            </p>
          </div>
        `,
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b",
      });

      return;
    }

    const blockedSubjects: Array<{
      subject: (typeof section.subjects)[number];
      missingPrerequisites: string[];
    }> = [];

    /*
     * Se buscan las materias bloqueadas y los requisitos
     * que todavía no están aprobados.
     */
    section.subjects.forEach((subject) => {
      const currentStatus = subjectStatuses[subject.code] ?? "pending";

      /*
       * Una materia ya aprobada no necesita revisarse.
       */
      if (currentStatus === "approved") {
        return;
      }

      const missingPrerequisites = subject.prerequisites.filter(
        (prerequisiteCode) => {
          const prerequisiteStatus = subjectStatuses[prerequisiteCode];

          /*
           * Los requisitos externos no aparecen dentro
           * de subjectStatuses.
           *
           * Por eso se muestran, pero no bloquean
           * permanentemente la materia.
           */
          return (
            prerequisiteStatus !== undefined &&
            prerequisiteStatus !== "approved"
          );
        },
      );

      if (missingPrerequisites.length > 0) {
        blockedSubjects.push({
          subject,
          missingPrerequisites,
        });
      }
    });

    /*
     * Si existen materias bloqueadas, SweetAlert muestra
     * cuáles son y qué prerrequisitos faltan.
     */
    if (blockedSubjects.length > 0) {
      const blockedSubjectsHtml = blockedSubjects
        .map(({ subject, missingPrerequisites }) => {
          const prerequisitesHtml = missingPrerequisites
            .map((prerequisiteCode) => {
              const prerequisiteName =
                prerequisiteNamesByCode[prerequisiteCode] ??
                "Materia no registrada";

              const prerequisiteStatus =
                subjectStatuses[prerequisiteCode] ?? "pending";

              const statusLabel =
                prerequisiteStatus === "in-progress" ? "En curso" : "Pendiente";

              return `
                  <li class="swal-requirement">
                    <span class="swal-requirement__code">
                      ${escapeHtml(prerequisiteCode)}
                    </span>

                    <span class="swal-requirement__information">
                      <strong>
                        ${escapeHtml(prerequisiteName)}
                      </strong>

                      <small>
                        Estado actual: ${statusLabel}
                      </small>
                    </span>
                  </li>
                `;
            })
            .join("");

          return `
            <section class="swal-blocked-subject">
              <div class="swal-blocked-subject__heading">
                <span class="swal-blocked-subject__code">
                  ${escapeHtml(subject.code)}
                </span>

                <strong>
                  ${escapeHtml(subject.name)}
                </strong>
              </div>

              <p>Necesita que apruebes:</p>

              <ul class="swal-requirements-list">
                ${prerequisitesHtml}
              </ul>
            </section>
          `;
        })
        .join("");

      await Swal.fire({
        icon: "warning",
        title: "No se puede aprobar todo todavía",

        html: `
          <div class="swal-blocked-content">
            <p class="swal-blocked-content__intro">
              En
              <strong>
                ${escapeHtml(section.title)}
              </strong>
              hay
              <strong>
                ${blockedSubjects.length}
                ${blockedSubjects.length === 1
            ? "materia bloqueada"
            : "materias bloqueadas"
          }
              </strong>.
            </p>

            <div class="swal-blocked-list">
              ${blockedSubjectsHtml}
            </div>

            <p class="swal-blocked-content__footer">
              Ningún estado fue modificado.
            </p>
          </div>
        `,

        confirmButtonText: "Entendido",
        confirmButtonColor: "#4f46e5",
        width: 680,

        customClass: {
          popup: "swal-pensum-popup",
          htmlContainer: "swal-pensum-container",
        },
      });

      return;
    }

    /*
     * Solo se cuentan las materias que todavía no están
     * aprobadas.
     */
    const subjectsNotApproved = section.subjects.filter(
      (subject) => subjectStatuses[subject.code] !== "approved",
    );

    const creditsToApprove = subjectsNotApproved.reduce(
      (total, subject) => total + subject.credits,
      0,
    );

    const result = await Swal.fire({
      icon: "question",
      title: `¿Aprobar todo ${section.title}?`,

      html: `
        <div class="swal-confirmation-content">
          <p>
            Se marcarán como aprobadas
            <strong>
              ${subjectsNotApproved.length}
              ${subjectsNotApproved.length === 1 ? "materia" : "materias"}
            </strong>.
          </p>

          <p>
            Esto agregará
            <strong>
              ${creditsToApprove}
              ${creditsToApprove === 1 ? "crédito" : "créditos"}
            </strong>
            a tu progreso.
          </p>

          <p>
            Después podrás modificar cada materia
            individualmente.
          </p>
        </div>
      `,

      showCancelButton: true,
      confirmButtonText: "Sí, aprobar todo",
      cancelButtonText: "Cancelar",

      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b",

      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSavedSubjectStatuses((currentStatuses) => {
      const updatedStatuses = {
        ...initialStatuses,
        ...currentStatuses,
      };

      section.subjects.forEach((subject) => {
        updatedStatuses[subject.code] = "approved";
      });

      return updatedStatuses;
    });

    setSavedSubjectAcademicRecords(
      (currentRecords) => {
        const updatedRecords = {
          ...initialSubjectAcademicRecords,
          ...currentRecords,
        };

        section.subjects.forEach((subject) => {
          const academicRecord =
            updatedRecords[subject.code];
          const lastAttempt =
            academicRecord.attempts.at(-1);

          if (
            lastAttempt?.result === "approved" &&
            lastAttempt.repeatLevel ===
            academicRecord.repeatLevel
          ) {
            return;
          }

          updatedRecords[subject.code] = {
            ...academicRecord,
            approvedRepeatLevel:
              academicRecord.repeatLevel,
            attempts: [
              ...academicRecord.attempts,
              createSubjectAttempt(
                academicRecord.repeatLevel,
                "approved",
              ),
            ],
          };
        });

        return updatedRecords;
      },
    );

    if (
      studentRegulatoryRecord
        .conditionalEnrollmentActive
    ) {
      const approvedCodes = new Set(
        section.subjects.map(
          (subject) => subject.code,
        ),
      );

      const hasUnresolvedRepeat = allSubjects.some(
        (subject) => {
          const willBeApproved =
            approvedCodes.has(subject.code);

          return (
            getSubjectAcademicRecord(
              subject.code,
            ).repeatLevel > 0 &&
            !willBeApproved &&
            subjectStatuses[subject.code] !==
            "approved"
          );
        },
      );

      if (!hasUnresolvedRepeat) {
        setSavedStudentRegulatoryRecord(
          (currentRecord) => ({
            ...DEFAULT_STUDENT_REGULATORY_RECORD,
            ...currentRecord,
            conditionalEnrollmentActive: false,
          }),
        );
      }
    }

    const isAcademicSemester =
      section.semester !== undefined;

    if (isAcademicSemester) {
      await Swal.fire({
        icon: "success",
        title: `¡${section.title} completado!`,
        html: `
      <div class="swal-confirmation-content">
        <p>
          Todas las materias de
          <strong>
            ${escapeHtml(section.title)}
          </strong>
          fueron aprobadas.
        </p>

        <p>
          Este semestre se ocultará y la vista
          mostrará los siguientes semestres
          pendientes.
        </p>

        <p>
          Para consultarlo nuevamente, activa
          <strong>
            “Mostrar semestres completados”
          </strong>.
        </p>
      </div>
    `,
        confirmButtonText: "Continuar",
        confirmButtonColor: "#16a34a",
        allowOutsideClick: false,
      });

      showNextPendingSemesters();

      return;
    }

    await Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `${section.title} aprobado`,
      text: `${subjectsNotApproved.length} ${subjectsNotApproved.length === 1
        ? "materia fue actualizada"
        : "materias fueron actualizadas"
        }.`,
      showConfirmButton: false,
      timer: 2400,
      timerProgressBar: true,
    });
  };

  const handleOpenStudentRecord = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "student-record");
    window.location.href = url.toString();
  };

  const handleReturnToDashboard = () => {
    const url = new URL(window.location.href);

    url.searchParams.set(
      "view",
      "academic-life",
    );

    window.location.href = url.toString();
  };

  /*
   * =====================================================
   * REINICIAR TODO EL PROGRESO
   * =====================================================
   */

  const handleResetProgress = async () => {
    const changedSubjects = allSubjects.filter(
      (subject) => subjectStatuses[subject.code] !== "pending",
    ).length;

    const changedDegreeRequirements = degreeRequirements.filter(
      (requirement) =>
        degreeRequirementStatuses[requirement.code] !== "pending",
    ).length;

    const changedAcademicRecords = allSubjects.filter(
      (subject) => {
        const record =
          getSubjectAcademicRecord(subject.code);

        return (
          record.repeatLevel > 0 ||
          (record.approvedRepeatLevel ?? 0) > 0 ||
          record.failedAttempts > 0 ||
          record.attempts.length > 0
        );
      },
    ).length;

    const changedGradeRecords =
      Object.values(
        savedSubjectGradeRecords,
      ).filter(
        hasRegisteredGrades,
      ).length;

    const hasRegulatoryChanges =
      studentRegulatoryRecord
        .hasLowPerformanceHistory ||
      studentRegulatoryRecord
        .hasDisciplinarySanction ||
      studentRegulatoryRecord
        .conditionalEnrollmentActive ||
      studentRegulatoryRecord
        .conditionalEnrollmentsUsed > 0 ||
      studentRegulatoryRecord
        .lostRightToContinue;

    if (
      changedSubjects === 0 &&
      changedDegreeRequirements === 0 &&
      changedAcademicRecords === 0 &&
      changedGradeRecords === 0 &&
      !hasRegulatoryChanges
    ) {
      await Swal.fire({
        icon: "info",
        title: "No hay progreso para reiniciar",
        text: "Todas las materias y requisitos de grado se encuentran pendientes.",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#4f46e5",
      });

      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "¿Reiniciar todo el progreso?",

      html: `
        <div class="swal-confirmation-content">
          <p>
            Se reiniciarán
            <strong>
              ${changedSubjects}
              ${changedSubjects === 1 ? "materia" : "materias"}
            </strong>.
          </p>

          <p>
            También se reiniciarán
            <strong>
              ${changedDegreeRequirements}
              ${changedDegreeRequirements === 1
          ? "requisito de grado"
          : "requisitos de grado"
        }
            </strong>.
          </p>

          <p>
            También se eliminarán los registros de
            repitencia, intentos, situación
            reglamentaria y notas del semestre.
          </p>

          <p>
            Todos volverán al estado pendiente.
          </p>

          <p>
            <strong>
              Esta acción no se puede deshacer.
            </strong>
          </p>
        </div>
      `,

      showCancelButton: true,

      confirmButtonText: "Sí, reiniciar",
      cancelButtonText: "Conservar progreso",

      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",

      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setSavedSubjectStatuses(initialStatuses);

    setSavedDegreeRequirementStatuses(initialDegreeRequirementStatuses);

    setSavedSubjectAcademicRecords(
      initialSubjectAcademicRecords,
    );

    setSavedStudentRegulatoryRecord(
      DEFAULT_STUDENT_REGULATORY_RECORD,
    );

    setSavedSubjectGradeRecords(
      DEFAULT_STUDENT_GRADE_RECORDS,
    );

    setSelectedSectionId("all");
    setSelectedStatusFilter("all");
    setSearchTerm("");
    setShowCompletedSemesters(false);

    await Swal.fire({
      icon: "success",
      title: "Progreso reiniciado",
      text: "Las materias, requisitos, repitencias, notas y alertas reglamentarias fueron reiniciados.",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#4f46e5",
    });
  };

  /*
   * =====================================================
   * INTERFAZ
   * =====================================================
   */

  if (isStudentRecordView) {
    return (
      <div className="app">
        <AppNavigation currentView={currentView} />

        <StudentAcademicRecordPage
          curriculum={curriculum}
          subjectStatuses={subjectStatuses}
          subjectAcademicRecords={subjectAcademicRecords}
          regulatoryRecord={studentRegulatoryRecord}
          situation={studentAcademicSituation}
          historicalRepeatCounts={historicalRepeatCounts}
          activeRepeatCounts={activeRepeatCounts}
          completedSemesters={completedSemesters}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
          onBack={handleReturnToDashboard}
        />
      </div>
    );
  }

  if (isScheduleView) {
    return (
      <div className="app">
        <AppNavigation
          currentView={currentView}
        />

        <SchedulePage
          themeMode={themeMode}

          scheduleClasses={
            studentSchedule.classes
          }

          availableSubjectNames={
            availableScheduleSubjectNames
          }

          importedOffer={
            studentSchedule.importedOffer
          }

          isScheduleConfirmed={
            studentSchedule.isConfirmed
          }

          confirmedAt={
            studentSchedule.confirmedAt
          }

          onToggleTheme={
            handleToggleTheme
          }

          onImportOffer={
            handleImportAcademicOffer
          }

          onRemoveOffer={
            handleRemoveAcademicOffer
          }

          onConfirmSchedule={
            handleConfirmSchedule
          }

          onAddClasses={
            handleAddScheduleClasses
          }

          onUpdateSubject={
            handleUpdateScheduleSubject
          }

          onDeleteSubject={
            handleDeleteScheduleSubject
          }
        />
      </div>
    );
  }

  if (isGradesView) {
    return (
      <div className="app">
        <AppNavigation
          currentView={currentView}
        />

        <GradesPage
          themeMode={themeMode}
          curriculum={curriculum}
          subjectStatuses={subjectStatuses}
          scheduleClasses={
            studentSchedule.classes
          }
          isScheduleConfirmed={
            studentSchedule.isConfirmed
          }
          gradeRecords={
            savedSubjectGradeRecords
          }
          onToggleTheme={
            handleToggleTheme
          }
          onSubjectGradeRecordChange={
            handleSubjectGradeRecordChange
          }
        />
      </div>
    );
  }

  /*
 * La página Inicio se muestra cuando no se ha
 * seleccionado explícitamente Vida académica.
 *
 * La hoja de vida se evalúa antes de este bloque.
 */
  if (!isAcademicLifeView) {
    return (
      <div className="app home-shell">
        <AppNavigation
          currentView={currentView}
        />

        <header className="home-header">
          <div className="home-header__content">
            <div className="home-header__brand">
              <p className="home-header__university">
                Universidad del Cauca
              </p>

              <h1>Mi pensum interactivo</h1>

              <p className="home-header__description">
                Consulta tu información personal y accede al
                seguimiento de tu proceso académico.
              </p>
            </div>

            <div className="home-header__actions">
              <button
                className="home-header__theme-button"
                type="button"
                onClick={handleToggleTheme}
                aria-label={
                  themeMode === "dark"
                    ? "Activar modo claro"
                    : "Activar modo oscuro"
                }
                title={
                  themeMode === "dark"
                    ? "Activar modo claro"
                    : "Activar modo oscuro"
                }
              >
                {themeMode === "dark" ? (
                  <LuSun aria-hidden="true" />
                ) : (
                  <LuMoon aria-hidden="true" />
                )}

                <span>
                  {themeMode === "dark"
                    ? "Modo claro"
                    : "Modo oscuro"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <HomePage
          studentProfile={studentProfile}
          onSaveProfile={
            handleSaveStudentProfile
          }
        />
      </div>
    );
  }

  return (
    <div className="app">
      <AppNavigation
        currentView={currentView}
      />

      <header className="header">
        <div className="header__content">
          <div className="header__intro">
            <p className="header__career">
              Ingeniería Electrónica y Telecomunicaciones
            </p>

            <h1>Mi pensum interactivo</h1>

            <p className="header__description">
              Organiza tus materias, consulta los prerrequisitos y lleva el
              control de tu avance académico.
            </p>
          </div>

          <div className="header__actions">
            <button
              className="header__theme-button"
              type="button"
              onClick={handleToggleTheme}
              aria-label={
                themeMode === "dark"
                  ? "Activar modo claro"
                  : "Activar modo oscuro"
              }
              title={
                themeMode === "dark"
                  ? "Activar modo claro"
                  : "Activar modo oscuro"
              }
            >
              {themeMode === "dark" ? (
                <LuSun
                  className="button-icon"
                  aria-hidden="true"
                />
              ) : (
                <LuMoon
                  className="button-icon"
                  aria-hidden="true"
                />
              )}

              <span>
                {themeMode === "dark"
                  ? "Modo claro"
                  : "Modo oscuro"}
              </span>
            </button>

            <button
              className="header__reset-button"
              type="button"
              onClick={handleResetProgress}
            >
              <LuRotateCcw
                className="button-icon"
                aria-hidden="true"
              />

              Reiniciar progreso
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/*
         * =================================================
         * RESUMEN ACADÉMICO
         * =================================================
         */}

        <section className="summary summary--five" aria-label="Resumen académico">
          <article className="summary-card">
            <span className="summary-card__label">Progreso</span>

            <strong className="summary-card__value">
              {progressPercentage} %
            </strong>

            <div
              className="progress-bar"
              aria-label={`Progreso académico: ${progressPercentage} por ciento`}
            >
              <div
                className="progress-bar__value"
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>

            <span className="summary-card__detail">
              Del programa completado
            </span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">Créditos aprobados</span>

            <strong className="summary-card__value">
              {approvedCredits} / {totalCredits}
            </strong>

            <span className="summary-card__detail">Créditos acumulados</span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">Materias pendientes</span>

            <strong className="summary-card__value">{pendingSubjects}</strong>

            <span className="summary-card__detail">
              {inProgressSubjects}{" "}
              {inProgressSubjects === 1
                ? "materia en curso"
                : "materias en curso"}
              {" · "}
              {totalSubjects} materias en total
            </span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">Requisitos de grado</span>

            <strong className="summary-card__value">
              {completedDegreeRequirements} / {degreeRequirements.length}
            </strong>

            <span className="summary-card__detail">No suman créditos</span>
          </article>

          <button
            className="summary-card summary-card--student-record"
            type="button"
            onClick={handleOpenStudentRecord}
          >
            <span className="summary-card__label">
              Hoja de vida académica
            </span>

            <span
              className="summary-card__record-icon"
              aria-hidden="true"
            >
              <LuGraduationCap />
            </span>

            <strong className="summary-card__record-action">
              Ver historial
            </strong>

            <span className="summary-card__detail">
              Repitencias, situación y restricciones
            </span>
          </button>
        </section>

        {shouldShowRegulatoryTracking && (
          <RegulatoryAlerts
            situation={studentAcademicSituation}
            regulatoryRecord={studentRegulatoryRecord}
            historicalRepeatCounts={historicalRepeatCounts}
            activeRepeatCounts={activeRepeatCounts}
            onDisciplinarySanctionChange={
              handleDisciplinarySanctionChange
            }
          />
        )}

        <details className="academic-statistics-panel">
          <summary className="academic-statistics-panel__summary">
            <div className="academic-statistics-panel__copy">
              <p className="section-heading__eyebrow">
                Análisis del progreso
              </p>

              <h2>Estadísticas académicas</h2>

              <p>
                Consulta materias aprobadas, bloqueadas,
                créditos restantes y avance por semestre.
              </p>
            </div>

            <div
              className="academic-statistics-panel__action"
              aria-hidden="true"
            >
              <span className="academic-statistics-panel__state academic-statistics-panel__state--closed">
                Mostrar
              </span>

              <span className="academic-statistics-panel__state academic-statistics-panel__state--open">
                Ocultar
              </span>

              <LuChevronDown
                className="academic-statistics-panel__chevron"
                aria-hidden="true"
              />
            </div>
          </summary>

          <div className="academic-statistics-panel__content">
            <AcademicStatistics
              approvedSubjects={approvedSubjects.length}
              totalSubjects={totalSubjects}
              inProgressSubjects={inProgressSubjects}
              blockedSubjects={blockedSubjectsCount}
              remainingCredits={remainingCredits}
              totalCredits={totalCredits}
              completedSemesters={completedSemesters}
              totalSemesters={semesterSections.length}
              strongestSemester={strongestSemester}
            />
          </div>
        </details>

        {/*
         * =================================================
         * REQUISITOS DEL PROGRAMA
         * =================================================
         */}

        {shouldShowRequirementsArea && (
          <details
            className="program-requirements"
            aria-labelledby="program-requirements-title"
          >
            <summary className="program-requirements__summary">
              <div className="program-requirements__summary-copy">
                <p className="section-heading__eyebrow">
                  Requisitos del programa
                </p>

                <h2 id="program-requirements-title">
                  Cierre académico y componente complementario
                </h2>

                <p>
                  Consulta los requisitos de grado y las materias adicionales
                  del plan de estudios.
                </p>
              </div>

              <div
                className="program-requirements__summary-action"
                aria-hidden="true"
              >
                <span className="program-requirements__state program-requirements__state--closed">
                  Mostrar
                </span>

                <span className="program-requirements__state program-requirements__state--open">
                  Ocultar
                </span>

                <LuChevronDown
                  className="program-requirements__chevron"
                  aria-hidden="true"
                />
              </div>
            </summary>

            <div className="program-requirements__content">
              <div className="program-requirements__column">
                {shouldShowDegreeRequirements && (
                  <DegreeRequirementsCard
                    requirements={degreeRequirements}
                    requirementStatuses={degreeRequirementStatuses}
                    onStatusChange={handleDegreeRequirementStatusChange}
                  />
                )}

                {shouldShowAdditionalRequirements &&
                  additionalRequirementsSection && (
                    <SemesterCard
                      key={additionalRequirementsSection.id}
                      section={additionalRequirementsSection}
                      visibleSubjects={filteredAdditionalSubjects}
                      prerequisiteNamesByCode={prerequisiteNamesByCode}
                      unlockedSubjectsByCode={unlockedSubjectsByCode}
                      subjectStatuses={subjectStatuses}
                      subjectAcademicRecords={subjectAcademicRecords}
                      conditionalEnrollmentActive={
                        studentRegulatoryRecord
                          .conditionalEnrollmentActive
                      }
                      lostRightToContinue={
                        studentRegulatoryRecord
                          .lostRightToContinue
                      }
                      onStatusChange={handleStatusChange}
                      onRegisterFailure={handleRegisterFailure}
                      onApproveAll={() =>
                        handleApproveSection(additionalRequirementsSection)
                      }
                    />
                  )}
              </div>
            </div>
          </details>
        )}

        {/*
         * =================================================
         * PLAN DE ESTUDIOS
         * =================================================
         */}

        <section className="curriculum">
          <div className="section-heading section-heading--filters">
            <div className="section-heading__information">
              <p className="section-heading__eyebrow">Plan de estudios</p>

              <h2>Materias por semestre</h2>

              <p className="section-heading__description">
                Busca una materia o combina los filtros para revisar tu
                progreso.
              </p>
            </div>

            <div className="curriculum-filters" aria-label="Filtros del pensum">
              <div className="curriculum-filter curriculum-filter--search">
                <label
                  className="curriculum-filter__label"
                  htmlFor="subject-search"
                >
                  Buscar materia
                </label>

                <div className="curriculum-filter__control">
                  <LuSearch
                    className="curriculum-filter__control-icon"
                    aria-hidden="true"
                  />

                  <input
                    id="subject-search"
                    className="curriculum-filter__input"
                    type="search"
                    value={searchTerm}
                    placeholder="Nombre o código"
                    autoComplete="off"
                    onChange={(event) => {
                      setCurrentCurriculumPage(1);

                      setSearchTerm(
                        event.target.value,
                      );
                    }}
                  />
                </div>
              </div>

              <div className="curriculum-filter">
                <label
                  className="curriculum-filter__label"
                  htmlFor="semester-filter"
                >
                  Semestre
                </label>

                <select
                  id="semester-filter"
                  className="curriculum-filter__select"
                  value={activeSectionId}
                  onChange={(event) => {
                    setCurrentCurriculumPage(1);

                    setSelectedSectionId(
                      event.target.value,
                    );
                  }}
                >
                  <option value="all">Todos los semestres</option>

                  {semesterSectionsForDisplay.map(
                    (section) => (
                      <option
                        value={section.id}
                        key={section.id}
                      >
                        {section.title}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="curriculum-filter">
                <label
                  className="curriculum-filter__label"
                  htmlFor="status-filter"
                >
                  Estado
                </label>

                <select
                  id="status-filter"
                  className="curriculum-filter__select"
                  value={selectedStatusFilter}
                  onChange={(event) => {
                    setCurrentCurriculumPage(1);

                    setSelectedStatusFilter(
                      event.target
                        .value as SubjectFilter,
                    );
                  }}
                >
                  <option value="all">Todas las materias</option>

                  <option value="pending">Pendientes</option>

                  <option value="in-progress">En curso</option>

                  <option value="approved">Aprobadas</option>

                  <option value="blocked">Bloqueadas</option>
                </select>
              </div>

              <label className="completed-semesters-toggle">
                <input
                  className="completed-semesters-toggle__input"
                  type="checkbox"
                  checked={showCompletedSemesters}
                  onChange={(event) =>
                    handleCompletedSemestersVisibility(
                      event.target.checked,
                    )
                  }
                />

                <span
                  className="completed-semesters-toggle__box"
                  aria-hidden="true"
                >
                  <LuCheck />
                </span>

                <span className="completed-semesters-toggle__copy">
                  <strong>
                    Mostrar semestres completados
                  </strong>

                  <small>
                    Incluye en la cuadrícula los semestres
                    que ya tienen el 100 % aprobado.
                  </small>
                </span>
              </label>
            </div>
          </div>

          <div className="status-legend" aria-label="Estados de las materias">
            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--pending" />
              Pendiente
            </div>

            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--progress" />
              En curso
            </div>

            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--approved" />
              Aprobada
            </div>
          </div>

          <div className="filter-results">
            <p className="filter-results__text">
              Mostrando <strong>{visibleSubjectsCount}</strong>{" "}
              {visibleSubjectsCount === 1 ? "materia" : "materias"} de{" "}
              <strong>{totalSubjects}</strong>
            </p>

            {hasActiveFilters && (
              <button
                className="filter-results__clear"
                type="button"
                onClick={handleClearFilters}
              >
                <LuX aria-hidden="true" />
                Limpiar filtros
              </button>
            )}
          </div>

          {filteredSections.length > 0 && (
            <div
              id="curriculum-semester-pages"
              className="curriculum-pages"
            >
              {renderCurriculumPagination(
                "top",
              )}

              <div
                className="curriculum-grid curriculum-grid--paginated"
                key={`curriculum-page-${activeCurriculumPage}-${paginatedSections
                  .map(
                    ({ section }) =>
                      section.id,
                  )
                  .join("-")}`}
              >
                {paginatedSections.map(
                  ({
                    section,
                    visibleSubjects,
                  }) => (
                    <SemesterCard
                      key={section.id}
                      section={section}
                      visibleSubjects={
                        visibleSubjects
                      }
                      prerequisiteNamesByCode={
                        prerequisiteNamesByCode
                      }
                      unlockedSubjectsByCode={
                        unlockedSubjectsByCode
                      }
                      subjectStatuses={
                        subjectStatuses
                      }
                      subjectAcademicRecords={
                        subjectAcademicRecords
                      }
                      conditionalEnrollmentActive={
                        studentRegulatoryRecord
                          .conditionalEnrollmentActive
                      }
                      lostRightToContinue={
                        studentRegulatoryRecord
                          .lostRightToContinue
                      }
                      onStatusChange={
                        handleStatusChange
                      }
                      onRegisterFailure={
                        handleRegisterFailure
                      }
                      onApproveAll={() =>
                        handleApproveSection(
                          section,
                        )
                      }
                    />
                  ),
                )}
              </div>

              {totalCurriculumPages >
                1 &&
                renderCurriculumPagination(
                  "bottom",
                )}
            </div>
          )}

          {visibleSubjectsCount === 0 && (
            <div className="curriculum-empty">
              <div
                className="curriculum-empty__icon"
                aria-hidden="true"
              >
                <LuSearch />
              </div>

              <h3>No encontramos materias</h3>

              <p>
                No hay materias que coincidan con la búsqueda y los filtros
                seleccionados.
              </p>

              <button
                type="button"
                onClick={handleClearFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;
