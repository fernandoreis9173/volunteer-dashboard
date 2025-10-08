// types.ts

// SOLUÇÃO FINAL PARA SILENCIAR O LINTER:
// Ignora a regra de que URLs não devem ser usadas em importações (já que o Deno Resolver estava falhando)
// e ignora o warning de que a regra não foi usada se você mudar o código.
// deno-lint-ignore-file ban-unused-ignore no-import-prefix
import { User } from "https://esm.sh/@supabase/supabase-js@2.44.4"; 

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

export type Page = 'dashboard' | 'volunteers' | 'departments' | 'events' | 'admin' | 'my-profile' | 'notifications';

export type AuthView = 'login' | 'accept-invite' | 'reset-password';

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

export interface Stat {
    value: string;
    change: number;
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
    type: 'new_schedule' | 'event_update' | 'new_event_for_department' | 'info' | 'new_event_for_leader';
    is_read: boolean;
    related_event_id: number | null;
}