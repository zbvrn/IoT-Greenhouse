export type AppRoute =
  | 'login'
  | 'register'
  | 'my-greenhouses'
  | 'my-greenhouse'
  | 'notifications'
  | 'profile';

export type RouteState = {
  greenhouseId: number | null;
  route: AppRoute;
};

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

export type Greenhouse = {
  id: number;
  name: string;
  location?: string | null;
  is_active: boolean;
  metadata?: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  user_id: number;
};

export type Device = {
  id: number;
  name: string;
  serial_number: string;
  is_active: boolean;
  last_seen?: string | null;
  metadata?: Record<string, unknown> | null;
  device_metadata?: Record<string, unknown> | null;
  greenhouse_id?: number | null;
  user_id: number;
};

export type TelemetrySample = {
  ts: number;
  value: unknown;
};

export type DeviceTelemetry = {
  device_id: number;
  serial_number: string;
  telemetry: Record<string, TelemetrySample[]>;
  retrieved_at: string;
};
