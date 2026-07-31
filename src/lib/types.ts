export interface Caregiver {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
  phone_number: string | null;
}

export interface Task {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  caregiver_id: string;
  completed_at: string;
  notes: string | null;
  caregiver?: Caregiver;
}

export interface Instruction {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_path: string | null;
  task_id: string | null;
  transcript: string | null;
  steps: string[] | null;
  sort_order: number;
  created_at: string;
}

export interface Visit {
  id: string;
  caregiver_id: string;
  checked_in_at: string;
  notes: string | null;
  caregiver?: Caregiver;
}

export interface ScheduledVisit {
  id: string;
  caregiver_id: string;
  scheduled_date: string;
  created_at: string;
  caregiver?: Caregiver;
}
