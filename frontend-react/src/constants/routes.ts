import type { AppRoute } from '../types';

export const navItems: Array<{ label: string; path: string; route: AppRoute }> = [
  { label: 'Теплицы', path: '#/greenhouses', route: 'greenhouses' },
  { label: 'Уведомления', path: '#/notifications', route: 'notifications' },
  { label: 'Профиль', path: '#/profile', route: 'profile' },
];

export const routeTitles: Record<AppRoute, string> = {
  login: 'Вход',
  register: 'Регистрация',
  greenhouses: 'Теплицы',
  notifications: 'Уведомления',
  profile: 'Профиль',
};

export function getRouteFromHash(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, '');

  if (path.startsWith('register')) return 'register';
  if (path.startsWith('notifications')) return 'notifications';
  if (path.startsWith('profile')) return 'profile';
  if (path.startsWith('greenhouses')) return 'greenhouses';
  return 'login';
}
