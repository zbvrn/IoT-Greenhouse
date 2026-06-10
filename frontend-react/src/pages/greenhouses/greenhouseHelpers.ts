import type { Device, Greenhouse } from '../../types';

export function getGreenhouseDeviceCount(
  greenhouseId: number,
  devices: Device[]
): number {
  return devices.filter((device) => device.greenhouse_id === greenhouseId).length;
}

export function getUnassignedDevices(devices: Device[]) {
  return devices.filter((device) => device.greenhouse_id == null);
}

export function getAssignedDevices(greenhouseId: number, devices: Device[]) {
  return devices.filter((device) => device.greenhouse_id === greenhouseId);
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Нет данных';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getDeviceTypeLabel(device: Device) {
  const metadata = device.metadata || {};
  const rawType =
    metadata.device_type ||
    metadata.type ||
    metadata.kind ||
    metadata.sensor_type ||
    metadata.actuator_type;

  if (typeof rawType === 'string' && rawType.trim()) {
    return rawType;
  }

  return 'Устройство';
}

export function getDeviceCapabilities(device: Device): string[] {
  const metadata = device.metadata || {};
  const capabilities = metadata.capabilities;

  if (Array.isArray(capabilities)) {
    return capabilities.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

export function getGreenhouseNameById(
  greenhouseId: number | null | undefined,
  greenhouses: Greenhouse[]
) {
  if (greenhouseId == null) return 'Не привязано';
  return greenhouses.find((greenhouse) => greenhouse.id === greenhouseId)?.name || 'Не привязано';
}
