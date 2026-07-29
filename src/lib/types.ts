export interface Caregiver {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
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

export interface FoodPack {
  id: string;
  label: string;
  defrosted_at: string;
  expires_at: string;
  placed_by: string | null;
  replaced_by: string | null;
  replaced_at: string | null;
  status: "defrosting" | "ready" | "expired" | "replaced";
  notes: string | null;
  created_at: string;
  placed_by_caregiver?: Caregiver | null;
}

export interface Instruction {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
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
