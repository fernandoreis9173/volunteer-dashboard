export interface Volunteer {
  name: string;
  email: string;
  initials: string;
  roles: string[];
  avatarColor: string;
}

export interface Shift {
  id: number;
  event: string;
  date: string;
  time: string;
  volunteer: string;
  ministry: string;
  created_at: string;
}

export type Page = 'dashboard' | 'volunteers' | 'ministries' | 'schedules';

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