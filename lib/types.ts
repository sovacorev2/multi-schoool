export interface Class {
  id: string
  name: string
  code: string | null
  // Optional - most client-side reads now come from the classes_public view,
  // which excludes this column entirely (see lib/supabase migration notes).
  // Only present when explicitly fetched through a gated server action
  // (getClassPasswordsForSchool) for the one legitimate admin display of it.
  password?: string | null
  display_order: number
  teacher_name: string | null
  school_id: string
  created_at: string
}

export interface Learner {
  id: string
  class_id: string
  name: string
  admission_number: string | null
  gender: string | null
  parent_phone: string | null
  stream_id: string | null
  created_at: string
}

export interface Subject {
  id: string
  class_id: string
  name: string
  is_custom: boolean
  created_at: string
}

export interface Mark {
  id: string
  session_id: string | null
  learner_id: string
  subject_id: string
  year: number
  term: string
  score: number | null
  exam_type_id: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  class_id: string
  exam_type_id: string | null
  term: string
  year: number
  is_active: boolean
  is_locked: boolean
  deadline_datetime: string | null
  locked_at: string | null
  locked_by: string | null
  created_at: string
  exam_types?: ExamType
}

export interface AuditLog {
  id: string
  class_id: string | null
  session_id: string | null
  action: string
  details: Record<string, unknown> | null
  performed_by: string | null
  teacher_pin: string | null
  created_at: string
  class?: Class
  session?: Session
}

export interface ExamType {
  id: string
  name: string
  description: string | null
  display_order: number
  created_at: string
  year?: number | null
  term?: string | null
  school_id?: string
}

export interface Stream {
  id: string
  class_id: string
  name: string
  created_at: string
}

export interface ClassSession {
  classId: string
  className: string
}

export interface LearnerWithMarks extends Learner {
  marks: Mark[]
  total: number
  average: number
  position: number
}

export interface AdminSettings {
  id: string
  key: string
  value: string | null
  created_at: string
  updated_at: string
}
