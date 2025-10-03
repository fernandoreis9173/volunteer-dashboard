

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
  volunteers?: { id: number; name: string; email: string; initials: string; departments: string[]; };
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
  observations?: string;
}

// Added for Dashboard performance and type safety
export interface DashboardEvent {
  id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  event_departments: { departments: { name: string } }[] | null; // Can be null from DB join
  event_volunteers: { volunteers: { name: string } }[] | null; // Can be null from DB join
}

export type Page = 'dashboard' | 'volunteers' | 'departments' | 'events' | 'admin';

export type AuthView = 'login' | 'accept-invite';

export interface DetailedVolunteer {
    id?: number;
    user_id?: string;
    name: string;
    email: string;
    phone: string;
    initials: string;
    status: 'Ativo' | 'Inativo' | 'Pendente';
    departments: string[];
    skills: string[];
    availability: string[] | string;
    created_at?: string;
}

// Added for Dashboard performance and type safety
export interface DashboardVolunteer {
    id: number;
    name: string;
    email: string;
    initials: string;
    departments: string[];
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