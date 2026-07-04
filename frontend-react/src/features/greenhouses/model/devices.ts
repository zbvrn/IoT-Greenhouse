import type { Device } from '../../../types';
import type { DeviceComponentRole, DeviceKind } from './types';

export function getDeviceKind(device: Device): DeviceKind {
  const metadata = device.metadata || device.device_metadata || {};
  const type = metadata.device_type;
  if (type === 'soil_irrigation' || type === 'climate_control') {
    return type;
  }
  return 'other';
}

export function getActuatorSettings(device: Device) {
  const metadata = device.metadata || device.device_metadata || {};
  const strokeLength = Number(metadata.strokeLength);
  const strokeSpeed = Number(metadata.strokeSpeed);
  return {
    strokeLength: Number.isFinite(strokeLength) ? strokeLength : 250,
    strokeSpeed: Number.isFinite(strokeSpeed) ? strokeSpeed : 3,
  };
}

export function getIrrigationSettings(device: Device) {
  const metadata = device.metadata || device.device_metadata || {};
  const valveOpenPercent = Number(metadata.valveOpenPercent);
  return {
    valveOpenPercent: Number.isFinite(valveOpenPercent) ? valveOpenPercent : 100,
  };
}

export function getComponentRole(device: Device): DeviceComponentRole {
  const metadata = device.metadata || device.device_metadata || {};
  const role = metadata.component_role;
  if (role === 'sensor' || role === 'actuator' || role === 'control') return role;
  if (metadata.actuator_type) return 'actuator';
  if (metadata.sensor_type) return 'sensor';
  return 'standalone';
}

export function getSystemId(device: Device) {
  const metadata = device.metadata || device.device_metadata || {};
  return typeof metadata.system_id === 'string' && metadata.system_id.trim()
    ? metadata.system_id
    : `device-${device.id}`;
}

export function getSystemName(device: Device) {
  const metadata = device.metadata || device.device_metadata || {};
  return typeof metadata.system_name === 'string' && metadata.system_name.trim()
    ? metadata.system_name
    : device.name;
}

export function buildDeviceMetadata(
  kind: DeviceKind,
  settings?: {
    strokeLength?: number;
    strokeSpeed?: number;
    valveOpenPercent?: number;
    componentRole?: DeviceComponentRole;
    systemId?: string;
    systemName?: string;
  }
) {
  const role = kind === 'other' ? 'standalone' : settings?.componentRole || 'sensor';
  return {
    device_type: kind,
    component_role: role,
    ...(settings?.systemId ? { system_id: settings.systemId } : {}),
    ...(settings?.systemName ? { system_name: settings.systemName } : {}),
    ...(role === 'sensor' && kind === 'soil_irrigation' ? { sensor_type: 'soil_moisture' } : {}),
    ...(role === 'sensor' && kind === 'climate_control' ? { sensor_type: 'temperature' } : {}),
    ...(role === 'actuator' && kind === 'soil_irrigation'
      ? {
          actuator_type: 'irrigation_valve',
          valveOpenPercent: settings?.valveOpenPercent ?? 100,
        }
      : {}),
    ...(role === 'actuator' && kind === 'climate_control'
      ? {
          actuator_type: 'linear_actuator',
          strokeLength: settings?.strokeLength ?? 250,
          strokeSpeed: settings?.strokeSpeed ?? 3,
        }
      : {}),
  };
}
