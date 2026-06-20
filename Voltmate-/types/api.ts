// Shared API response types used across multiple pages.
// Import from here rather than using `any` for API-shaped data.

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  duration_seconds: number | null;
  status: string | null;
  network_verified: boolean;
  clock_in_ip: string | null;
  note?: string | null;
  needs_approval?: boolean;
  approved_by?: number | null;
  employee_name?: string | null;
  employee_email?: string | null;
  employee_role?: string | null;
}

export interface Task {
  id: number;
  user_id: number;
  task_date: string;
  description: string;
  status: string;
  note?: string | null;
  approved_by?: number | null;
  approval_status?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  employee_name?: string | null;
  employee_email?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveBalance {
  cl_available: number;
  cl_earned: number;
  cl_used: number;
  cl_pending?: number;
  sl_available: number;
  sl_earned: number;
  sl_used?: number;
  sl_carried_forward?: number;
  fy_label: string;
  can_apply: boolean;
  on_probation: boolean;
  probation_end?: string;
  next_accrual_note?: string;
  min_cl_start?: string;
}

export interface LeaveRequest {
  id: number;
  leave_type: 'CL' | 'SL';
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason?: string | null;
  requires_proof?: boolean;
  proof_path?: string | null;
}

export interface LocationPing {
  id: number;
  user_id: number;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  type: string;
  context?: string | null;
  note?: string | null;
  pinged_at: string;
  attendance_id?: number | null;
  visit_id?: number | null;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  is_verified?: boolean;
  is_approved?: boolean;
  created_at?: string;
}

export interface Lead {
  id: number;
  cust_code: string;
  cust_name: string;
  phone_no: string;
  phone_no_2?: string | null;
  business?: string | null;
  location?: string | null;
  lead_type?: string | null;
  connect_date?: string | null;
  is_hot_lead?: boolean;
  note?: string | null;
  deferral_bucket?: string | null;
  deferral_notes?: string | null;
  follow_up_after_date?: string | null;
  earliest_purchase_intent_date?: string | null;
  contact_disposition?: string | null;
  callback_requested_at?: string | null;
  customer_promised_callback?: boolean;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Visit {
  id: number;
  lead_id?: number | null;
  lead_cust_code?: string | null;
  salesperson_id?: number | null;
  salesperson_name?: string | null;
  vehicle?: string | null;
  status?: string | null;
  visit_date?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  note?: string | null;
  phone_no?: string | null;
  phone_no_2?: string | null;
  lost_not_interested_reason?: string | null;
  lost_reason_notes?: string | null;
  deferral_bucket?: string | null;
  deferral_notes?: string | null;
  follow_up_after_date?: string | null;
  earliest_purchase_intent_date?: string | null;
  contact_disposition?: string | null;
  callback_requested_at?: string | null;
  customer_promised_callback?: boolean;
  is_hot_lead?: boolean;
  lead_type?: string | null;
  connect_date?: string | null;
  cust_name?: string | null;
  lead_location?: string | null;
  lead_phone_no?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  visit_location_captured_at?: string | null;
}

export interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
    channelTitle: string;
    publishedAt: string;
  };
}

export interface YouTubePlaylistResponse {
  items?: YouTubeVideo[];
  nextPageToken?: string;
  pageInfo?: { totalResults: number; resultsPerPage: number };
}
