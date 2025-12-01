
// FIX: Restored Supabase v2 User type import.
import type { User } from '@supabase/supabase-js';

// FIX: Export User type to be available for other modules.
export type { User };

export interface Volunteer {
  name: string;
  email: string;
  initials: string;
  roles: string[];
  avatarColor: string;
}

export interface EventVolunteer {
  volunteer_id: number;
  department_id: number;
  present: boolean | null;
  // FIX: Changed `departments` to `string[]` to match the data from `volunteers` table. Added status.
  volunteers?: { id: number; name: string; email: string; initials: string; departments: string[]; status?: string; avatar_url?: string; };
}

export interface EventDepartment {
  department_id: number;
  departments: { id: number; name: string; leader?: string; };
}

export interface Event {
  id?: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at?: string;
  event_departments: EventDepartment[];
  event_volunteers: EventVolunteer[];
  local?: string;
  location_iframe?: string;
  observations?: string;
  color?: string;
  cronograma_principal_id?: string | null;
  cronograma_kids_id?: string | null;
}

// Added for Dashboard performance and type safety
export interface DashboardEvent {
  id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  local?: string;
  location_iframe?: string;
  observations?: string;
  event_departments: { department_id: number; departments: { id: number; name: string; leader?: string; } | null }[] | null;
  event_volunteers: { department_id: number; volunteer_id: number; present: boolean | null; volunteers: { name: string; initials?: string; avatar_url?: string; } | null }[] | null;
  cronograma_principal_id?: string | null;
  cronograma_kids_id?: string | null;
}

export interface DashboardData {
  stats?: {
    activeVolunteers: Stat;
    departments: Stat;
    schedulesToday: Stat;
    upcomingSchedules?: Stat;
    presencesToday?: Stat;
    annualAttendance?: Stat;
  };
  todaySchedules?: DashboardEvent[];
  upcomingSchedules?: DashboardEvent[];
  chartData?: ChartDataPoint[];
  activeLeaders?: EnrichedUser[];
}

export type Page = 'dashboard' | 'volunteers' | 'departments' | 'events' | 'calendar' | 'my-profile' | 'notifications' | 'frequency' | 'admin' | 'history' | 'timelines' | 'ranking' | 'whatsapp-settings' | 'general-settings';

export type AuthView = 'login' | 'accept-invite' | 'reset-password';

export interface DetailedVolunteer {
  id?: number;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  departments: { id: number; name: string; }[];
  skills: string[];
  availability: string[] | string;
  created_at?: string;
  avatar_url?: string;
}

export interface Department {
  id?: number;
  name: string;
  description: string;
  leaders: { id: string; name: string }[];
  skills_required: string[];
  meeting_days: string[];
  status: 'Ativo' | 'Inativo';
  created_at?: string;
}

export interface Stat {
  value: string;
  change: number;
}

// FIX: Added ChartDataPoint interface for use in Dashboard and TrafficChart components.
export interface ChartDataPoint {
  date: string;
  scheduledVolunteers: number;
  involvedDepartments: number;
  eventNames: string[];
}


// Shared user type for Admin pages and dashboard feeds
// FIX: The `EnrichedUser` interface was not correctly inheriting properties from the base Supabase `User` type.
// This has been resolved by changing the interface to a type alias using an intersection (`&`),
// which is a more robust way to extend complex types and ensures all properties from `User` are included.
export type EnrichedUser = User & {
  app_status?: 'Ativo' | 'Inativo' | 'Pendente';
};

export interface NotificationRecord {
  id: number;
  created_at: string;
  user_id: string;
  message: string;
  type: 'new_schedule' | 'event_update' | 'new_event_for_department' | 'info' | 'new_event_for_leader' | 'invitation_received' | 'shift_swap_request';
  is_read: boolean;
  related_event_id: number | null;
  data?: any;
}

export interface Invitation {
  id: number;
  created_at: string;
  departments: {
    name: string;
  } | null;
  profiles: {
    name: string | null;
  } | null;
}

export interface TimelineItem {
  id?: string;
  modelo_id?: string;
  ordem: number;
  titulo_item: string;
  duracao_minutos: number;
  detalhes: string;
  links?: { id: string; url: string; title: string; }[];
}

export interface TimelineTemplate {
  id?: string;
  nome_modelo: string;
  admin_id?: string;
  cronograma_itens: TimelineItem[];
  created_at?: string;
}
export interface VolunteerSchedule {
  id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  local?: string;
  location_iframe?: string;
  observations?: string;
  department_id: number;
  department_name: string;
  leader_name?: string;
  present: boolean | null;
  cronograma_principal_id?: string | null;
  cronograma_kids_id?: string | null;
}
