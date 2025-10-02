export interface Volunteer {
  name: string;
  email: string;
  initials: string;
  roles: string[];
  avatarColor: string;
}

export interface EventVolunteer {
  event_id: number;
  volunteer_id: number;
  department_id: number;
  volunteers?: { id: number; name: string; email: string; initials: string; };
  departments?: { id: number; name: string; };
}

export interface EventDepartment {
  event_id: number;
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
  observations?: string;
}

export type Page = 'dashboard' | 'volunteers' | 'departments' | 'schedules' | 'admin';

export type AuthView = 'login' | 'accept-invite';

export interface DetailedVolunteer {
    id?: number;
    name: string;
    email: string;
    phone: string;
    initials: string;
    status: 'Ativo' | 'Inativo';
    ministries: string[];
    skills: string[];
    availability: string[];
    created_at?: string;
}

export interface Department {
  id?: number;
  name: string;
  description: string;
  leader: string;
  leader_contact?: string;
  skills_required: string[];
  meeting_days: string[];
  status: 'Ativo' | 'Inativo';
  created_at?: string;
}