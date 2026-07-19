export type SubjectStatus =
  | 'pending'
  | 'in-progress'
  | 'approved'

export type DegreeRequirementStatus =
  | 'pending'
  | 'completed'

export type RepeatLevel = 0 | 1 | 2 | 3

export type SubjectAttemptResult =
  | 'failed'
  | 'approved'

export type StudentAcademicSituation =
  | 'normal'
  | 'low-performance'
  | 'conditional-enrollment'
  | 'lost-right'

export interface SubjectAttempt {
  id: string
  attemptNumber: number
  repeatLevel: RepeatLevel
  result: SubjectAttemptResult
  recordedAt: string
}

export interface SubjectAcademicRecord {
  repeatLevel: RepeatLevel
  approvedRepeatLevel: RepeatLevel | null
  failedAttempts: number
  attempts: SubjectAttempt[]
}

export interface StudentRegulatoryRecord {
  hasLowPerformanceHistory: boolean
  hasDisciplinarySanction: boolean
  conditionalEnrollmentActive: boolean
  conditionalEnrollmentsUsed: number
  lostRightToContinue: boolean
}

export interface Subject {
  code: string
  name: string
  credits: number
  prerequisites: string[]
}

export interface DegreeRequirement {
  code: string
  name: string
  description: string
}

export interface CurriculumSection {
  id: string
  title: string
  semester?: number
  subjects: Subject[]
}