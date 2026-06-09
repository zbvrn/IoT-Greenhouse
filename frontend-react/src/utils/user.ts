import type { User } from '../types';

export function getStoredUser(): User | null {
  const rawUser = localStorage.getItem('user');
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function getDisplayName(user: User | null) {
  if (!user) return 'Пользователь';
  return user.full_name?.trim() || user.email;
}
