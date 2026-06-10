import type { AppRoute, RouteState } from '../types';

export const navItems: Array<{ label: string; path: string; route: AppRoute }> = [
  { label: 'Теплицы', path: '#/greenhouses', route: 'greenhouses' },
  { label: 'Уведомления', path: '#/notifications', route: 'notifications' },
  { label: 'Профиль', path: '#/profile', route: 'profile' },
];

export const routeTitles: Record<AppRoute, string> = {
  login: 'Вход',
  register: 'Регистрация',
  greenhouses: 'Теплицы',
  greenhouse: 'Теплица',
  notifications: 'Уведомления',
  profile: 'Профиль',
};

export function getRouteStateFromHash(hash: string): RouteState {
  const path = hash.replace(/^#\/?/, '');
  const [section, greenhouseId] = path.split('/');

  if (section === 'register') return { route: 'register', greenhouseId: null };
  if (section === 'notifications') return { route: 'notifications', greenhouseId: null };
  if (section === 'profile') return { route: 'profile', greenhouseId: null };
  if (section === 'greenhouses' && greenhouseId) {
    const parsedId = Number(greenhouseId);
    return {
      route: Number.isFinite(parsedId) ? 'greenhouse' : 'greenhouses',
      greenhouseId: Number.isFinite(parsedId) ? parsedId : null,
    };
  }
  if (section === 'greenhouses') return { route: 'greenhouses', greenhouseId: null };
  return { route: 'login', greenhouseId: null };
}
