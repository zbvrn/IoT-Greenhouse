import type { AppRoute, RouteState } from '../types';

export const navItems: Array<{ label: string; path: string; route: AppRoute }> = [
  { label: 'Теплицы', path: '#/greenhouses', route: 'greenhouses' },
  { label: 'Теплицы новое', path: '#/greenhouses-new', route: 'greenhouses-new' },
  { label: 'Теплицы отрисовка', path: '#/greenhouses-render', route: 'greenhouses-render' },
  { label: 'Тест', path: '#/test', route: 'test' },
  { label: 'Уведомления', path: '#/notifications', route: 'notifications' },
  { label: 'Профиль', path: '#/profile', route: 'profile' },
];

export const routeTitles: Record<AppRoute, string> = {
  login: 'Вход',
  register: 'Регистрация',
  greenhouses: 'Теплицы',
  greenhouse: 'Теплица',
  'greenhouses-new': 'Теплицы новое',
  'greenhouse-new': 'Управление теплицей',
  'greenhouses-render': 'Теплицы отрисовка',
  'greenhouse-render': 'Теплица с приборами',
  test: 'Тест',
  notifications: 'Уведомления',
  profile: 'Профиль',
};

export function getRouteStateFromHash(hash: string): RouteState {
  const path = hash.replace(/^#\/?/, '');
  const [section, greenhouseId] = path.split('/');

  if (section === 'register') return { route: 'register', greenhouseId: null };
  if (section === 'notifications') return { route: 'notifications', greenhouseId: null };
  if (section === 'profile') return { route: 'profile', greenhouseId: null };
  if (section === 'test') return { route: 'test', greenhouseId: null };
  if (section === 'greenhouses-new' && greenhouseId) {
    const parsedId = Number(greenhouseId);
    return {
      route: Number.isFinite(parsedId) ? 'greenhouse-new' : 'greenhouses-new',
      greenhouseId: Number.isFinite(parsedId) ? parsedId : null,
    };
  }
  if (section === 'greenhouses-new') return { route: 'greenhouses-new', greenhouseId: null };
  if (section === 'greenhouses-render' && greenhouseId) {
    const parsedId = Number(greenhouseId);
    return {
      route: Number.isFinite(parsedId) ? 'greenhouse-render' : 'greenhouses-render',
      greenhouseId: Number.isFinite(parsedId) ? parsedId : null,
    };
  }
  if (section === 'greenhouses-render') return { route: 'greenhouses-render', greenhouseId: null };
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
