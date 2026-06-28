import type { Device } from '../../../types';
import type { DeviceKind } from './types';

export function getDeviceKind(device: Device): DeviceKind {
  const metadata = device.metadata || device.device_metadata || {};
  const type = metadata.device_type;
  if (type === 'sensor' || type === 'soil_sensor' || type === 'actuator' || type === 'valve') {
    return type;
  }
  return 'other';
}

export function buildDeviceMetadata(kind: DeviceKind) {
  return {
    device_type: kind,
    ...(kind === 'soil_sensor' ? { sensor_type: 'soil' } : {}),
    ...(kind === 'actuator' ? { actuator_type: 'linear_actuator' } : {}),
    ...(kind === 'valve' ? { actuator_type: 'irrigation_valve' } : {}),
  };
}
