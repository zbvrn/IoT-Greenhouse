export type AppRoute =
  | 'login'
  | 'register'
  | 'greenhouses'
  | 'greenhouse'
  | 'greenhouses-new'
  | 'greenhouse-new'
  | 'greenhouses-render'
  | 'greenhouse-render'
  | 'test'
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
  greenhouse_id?: number | null;
  user_id: number;
};

export type AutomationSetting = {
  id: number;
  greenhouse_id: number;
  auto_mode: boolean;
  target_temperature: number;
  hysteresis: number;
  last_action?: string | null;
  last_action_at?: string | null;
  updated_at: string;
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
