export type SubjectStatus =
  | 'pending'
  | 'in-progress'
  | 'approved'

export interface Subject {
  code: string
  name: string
  credits: number
  prerequisites: string[]
}

export interface CurriculumSection {
  id: string
  title: string
  semester?: number
  subjects: Subject[]
}