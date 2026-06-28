import type { DeviceKind, DeviceKindFilter } from './types';

export const deviceKindLabels: Record<DeviceKind, string> = {
  sensor: 'Датчик температуры и влажности',
  soil_sensor: 'Датчик влажности почвы',
  actuator: 'Привод форточки',
  valve: 'Клапан полива',
  other: 'Другое устройство',
};

export const deviceKindFilterLabels: Record<DeviceKindFilter, string> = {
  all: 'Все',
  ...deviceKindLabels,
};

export const telemetryLabels: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilHumidity: 'Влажность почвы',
  soilMoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  position: 'Положение',
  windowPosition: 'Положение форточки',
  actuatorOpen: 'Состояние привода',
  status: 'Состояние',
  speed: 'Скорость',
};

export const normalizedTelemetryLabels: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilhumidity: 'Влажность почвы',
  soilmoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  position: 'Положение',
  windowposition: 'Положение форточки',
  actuatoropen: 'Состояние привода',
  actuatoropenstate: 'Состояние привода',
  status: 'Состояние',
  state: 'Состояние',
  speed: 'Скорость',
};

export const telemetryDisplayOrder = [
  'temperature',
  'humidity',
  'soilhumidity',
  'soilmoisture',
  'moisture',
  'windowposition',
  'position',
  'actuatoropen',
  'actuatoropenstate',
  'status',
  'state',
  'speed',
];
