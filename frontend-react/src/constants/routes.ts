import type { AppRoute, RouteState } from '../types';

export const navItems: Array<{ label: string; path: string; route: AppRoute }> = [
  { label: 'Мои теплицы', path: '#/my-greenhouses', route: 'my-greenhouses' },
  { label: 'Уведомления', path: '#/notifications', route: 'notifications' },
  { label: 'Профиль', path: '#/profile', route: 'profile' },
];

export const routeTitles: Record<AppRoute, string> = {
  login: 'Вход',
  register: 'Регистрация',
  'my-greenhouses': 'Мои теплицы',
  'my-greenhouse': 'Управление теплицей',
  notifications: 'Уведомления',
  profile: 'Профиль',
};

export function getRouteStateFromHash(hash: string): RouteState {
  const path = hash.replace(/^#\/?/, '');
  const [section, greenhouseId] = path.split('/');

  if (section === 'register') return { route: 'register', greenhouseId: null };
  if (section === 'notifications') return { route: 'notifications', greenhouseId: null };
  if (section === 'profile') return { route: 'profile', greenhouseId: null };
  if (section === 'my-greenhouses' && greenhouseId) {
    const parsedId = Number(greenhouseId);
    return {
      route: Number.isFinite(parsedId) ? 'my-greenhouse' : 'my-greenhouses',
      greenhouseId: Number.isFinite(parsedId) ? parsedId : null,
    };
  }
  if (section === 'my-greenhouses') return { route: 'my-greenhouses', greenhouseId: null };
  return { route: 'login', greenhouseId: null };
}
