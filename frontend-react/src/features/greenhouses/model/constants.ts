import type { DeviceComponentRole, DeviceKind, DeviceKindFilter } from './types';

export const deviceKindLabels: Record<DeviceKind, string> = {
  soil_irrigation: 'Система полива по влажности почвы',
  climate_control: 'Система контроля температуры и форточки',
  other: 'Отдельное устройство',
};

export const componentRoleLabels: Record<
  Exclude<DeviceKind, 'other'>,
  Record<Exclude<DeviceComponentRole, 'standalone'>, string>
> = {
  climate_control: {
    sensor: 'Датчик температуры',
    actuator: 'Привод форточки',
    control: 'Контроллер микроклимата',
  },
  soil_irrigation: {
    sensor: 'Датчик влажности почвы',
    actuator: 'Клапан полива',
    control: 'Контроллер полива',
  },
};

export function getComponentRoleLabel(kind: DeviceKind, role: DeviceComponentRole) {
  if (kind === 'other' || role === 'standalone') return 'Отдельное устройство';
  return componentRoleLabels[kind][role];
}

export function getTelemetryLabelForKind(kind: DeviceKind, key: string) {
  const normalized = key.replace(/[_\-\s]/g, '').toLowerCase();
  if (kind === 'soil_irrigation') {
    if (normalized === 'currentposition') return 'Открытие клапана';
    if (normalized === 'currentstate') return 'Состояние клапана';
  }
  if (kind === 'climate_control') {
    if (normalized === 'currentposition') return 'Положение форточки';
    if (normalized === 'currentstate') return 'Состояние форточки';
  }
  return telemetryLabels[key] || normalizedTelemetryLabels[normalized] || key;
}

export const deviceKindFilterLabels: Record<DeviceKindFilter, string> = {
  all: 'Все',
  ...deviceKindLabels,
};

export const telemetryLabels: Record<string, string> = {
  currentTemp: 'Температура воздуха',
  currentHum: 'Влажность воздуха',
  tempStatus: 'Состояние температуры',
  humStatus: 'Состояние влажности',
  currentSoilMoisture: 'Влажность почвы',
  soilMoistureStatus: 'Состояние влажности почвы',
  currentPosition: 'Положение форточки',
  currentState: 'Состояние форточки',
  action: 'Последняя команда',
  actionAck: 'Результат команды',
  method: 'Метод управления',
  params: 'Параметры управления',
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilHumidity: 'Влажность почвы',
  soilMoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  valveOpen: 'Состояние клапана',
  valveState: 'Состояние клапана',
  position: 'Положение',
  windowPosition: 'Положение форточки',
  actuatorOpen: 'Состояние привода',
  status: 'Состояние',
  speed: 'Скорость',
};

export const normalizedTelemetryLabels: Record<string, string> = {
  currenttemp: 'Температура воздуха',
  currenthum: 'Влажность воздуха',
  tempstatus: 'Состояние температуры',
  humstatus: 'Состояние влажности',
  currentsoilmoisture: 'Влажность почвы',
  soilmoisturestatus: 'Состояние влажности почвы',
  currentposition: 'Положение форточки',
  currentstate: 'Состояние форточки',
  action: 'Последняя команда',
  actionack: 'Результат команды',
  method: 'Метод управления',
  params: 'Параметры управления',
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilhumidity: 'Влажность почвы',
  soilmoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  valveopen: 'Состояние клапана',
  valvestate: 'Состояние клапана',
  position: 'Положение',
  windowposition: 'Положение форточки',
  actuatoropen: 'Состояние привода',
  actuatoropenstate: 'Состояние привода',
  status: 'Состояние',
  state: 'Состояние',
  speed: 'Скорость',
};

export const telemetryDisplayOrder = [
  'currenttemp',
  'currenthum',
  'currentsoilmoisture',
  'soilmoisturestatus',
  'currentstate',
  'currentposition',
  'actionack',
  'action',
  'tempstatus',
  'humstatus',
  'temperature',
  'humidity',
  'soilhumidity',
  'soilmoisture',
  'moisture',
  'valveopen',
  'valvestate',
  'windowposition',
  'position',
  'actuatoropen',
  'actuatoropenstate',
  'status',
  'state',
  'speed',
];
