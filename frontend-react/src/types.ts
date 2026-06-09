export type AppRoute = 'login' | 'register' | 'greenhouses' | 'notifications' | 'profile';

export type User = {
  id: number;
  email: string;
  full_name?: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};
