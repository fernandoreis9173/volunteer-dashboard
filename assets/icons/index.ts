// Importação de todos os ícones SVG
import DashboardIcon from './dashboard.svg?react';
import VolunteerIcon from './volunteer.svg?react';
import CorporationIcon from './corporation.svg?react';
import EventIcon from './event.svg?react';
import AdministratorIcon from './administrator.svg?react';
import AddEventIcon from './add-event.svg?react';
import NewEmployeeIcon from './new-employee.svg?react';

// Mapeamento de ícones por nome
export const icons = {
  dashboard: DashboardIcon,
  volunteer: VolunteerIcon,
  volunteers: VolunteerIcon, // Alias para volunteers
  corporation: CorporationIcon,
  departments: CorporationIcon, // Usando corporation para departments
  event: EventIcon,
  events: EventIcon, // Alias para events
  administrator: AdministratorIcon,
  admin: AdministratorIcon, // Alias para admin
  'add-event': AddEventIcon,
  'new-employee': NewEmployeeIcon,
  'new-volunteer': NewEmployeeIcon, // Usando new-employee para new-volunteer
} as const;

// Tipos TypeScript
export type IconName = keyof typeof icons;

// Exportação individual dos ícones
export {
  DashboardIcon,
  VolunteerIcon,
  CorporationIcon,
  EventIcon,
  AdministratorIcon,
  AddEventIcon,
  NewEmployeeIcon,
};

// Função helper para obter ícone por nome
export const getIcon = (name: IconName) => icons[name];