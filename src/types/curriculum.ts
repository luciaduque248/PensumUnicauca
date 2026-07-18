export type SubjectStatus =
  | 'pending'
  | 'in-progress'
  | 'approved'

export type DegreeRequirementStatus =
  | 'pending'
  | 'completed'

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