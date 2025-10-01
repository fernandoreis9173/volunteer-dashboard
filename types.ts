export interface Volunteer {
  name: string;
  email: string;
  initials: string;
  roles: string[];
  avatarColor: string;
}

export interface ScheduleVolunteer {
  schedule_id: number;
  volunteer_id: number;
  volunteers?: { id: number; name: string; email: string; initials: string; };
}


export interface Schedule {
  id?: number;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  ministry_id: number;
  status: string;
  created_at?: string;
  schedule_volunteers: ScheduleVolunteer[];
  ministries?: { name: string; };
  local?: string;
  observations?: string;
}

export type Page = 'dashboard' | 'volunteers' | 'ministries' | 'schedules' | 'admin';

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

// FIX: Added the 'Leader' interface, which was missing and causing import errors in multiple components.
// The structure is based on the usage in Leader-related components and is similar to DetailedVolunteer.
export interface Leader {
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

export interface Ministry {
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