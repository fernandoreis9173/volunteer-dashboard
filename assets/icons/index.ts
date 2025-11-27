// Importação de todos os ícones SVG
import DashboardIcon from './dashboard.svg';
import VolunteerIcon from './volunteer.svg';
import CorporationIcon from './corporation.svg';
import EventosIcon from './eventos.svg';
import AdministratorIcon from './administrator.svg';
import AdminIcon from './admin.svg';
import AddEventIcon from './add-event.svg';
import NewEmployeeIcon from './new-employee.svg';
import DepartamentsIcon from './departaments.svg';
import FrequenciaIcon from './frequancia.svg';
import CalendarIcon from './calendar.svg';
import NewVolunteersIcon from './newVolunteers.svg';
import AddEventsIcon from './addEvents.svg';
import NotificationIcon from './notification.svg';
import HistoryIcon from './history.svg';
import InstallAppIcon from './installAPP.svg';
import LogoNovaIcon from './logonova.svg';
import ProfileIcon from './profile.svg';
import LogoutIcon from './logout.svg';
import NextEventIcon from './nextEvent.svg';
import LogoMobileIcon from './logomobile.svg';
import CronogramasIcon from './iconcronogramas.svg';
import EditIcon from './editicon.svg';
import RankingIcon from './rankingicon.svg';
import Medalha01Icon from './Medalha01Icon.svg?react';
import Medalha02Icon from './Medalha02Icon.svg?react';
import Medalha03Icon from './Medalha03Icon.svg?react';


// Mapeamento de ícones por nome
export const icons = {
  dashboard: DashboardIcon,
  volunteer: VolunteerIcon,
  volunteers: VolunteerIcon, // Alias para volunteers
  corporation: CorporationIcon,
  departments: DepartamentsIcon, // Usando o ícone correto para departments
  event: EventosIcon,
  events: EventosIcon, // Usando o ícone 'eventos.svg' para ambos
  administrator: AdministratorIcon,
  admin: AdminIcon, // Usando admin.svg para 'admin'
  'add-event': AddEventIcon,
  'new-employee': NewEmployeeIcon,
  'new-volunteer': NewVolunteersIcon, // Usando newVolunteers.svg para o botão "Novo Voluntário"
  'new-volunteers': NewVolunteersIcon,
  frequency: FrequenciaIcon,
  frequencia: FrequenciaIcon, // Alias pt-BR
  calendar: CalendarIcon,
  calendario: CalendarIcon, // Alias pt-BR
  'add-events': AddEventsIcon,
  notification: NotificationIcon,
  notifications: NotificationIcon,
  history: HistoryIcon,
  'install-app': InstallAppIcon,
  installapp: InstallAppIcon,
  logo: LogoNovaIcon,
  logonova: LogoNovaIcon,
  profile: ProfileIcon,
  'my-profile': ProfileIcon,
  perfil: ProfileIcon,
  logout: LogoutIcon,
  signout: LogoutIcon,
  sair: LogoutIcon,
  nextEvent: NextEventIcon,
  'next-event': NextEventIcon,
  logomobile: LogoMobileIcon,
  cronogramas: CronogramasIcon,
  edit: EditIcon,
  ranking: RankingIcon,
  medalha01: Medalha01Icon,
  medalha02: Medalha02Icon,
  medalha03: Medalha03Icon,
} as const;

// Tipos TypeScript
export type IconName = keyof typeof icons;

// Exportação individual dos ícones
export {
  DashboardIcon,
  VolunteerIcon,
  CorporationIcon,
  EventosIcon,
  AdministratorIcon,
  AdminIcon,
  AddEventIcon,
  NewEmployeeIcon,
  DepartamentsIcon,
  FrequenciaIcon,
  CalendarIcon,
  NewVolunteersIcon,
  AddEventsIcon,
  NotificationIcon,
  HistoryIcon,
  InstallAppIcon,
  LogoNovaIcon,
  ProfileIcon,
  LogoutIcon,
  NextEventIcon,
  LogoMobileIcon,
  CronogramasIcon,
  EditIcon,
  RankingIcon,
  Medalha01Icon,
  Medalha02Icon,
  Medalha03Icon,
};
// Função helper para obter ícone por nome
export const getIcon = (name: IconName) => icons[name];