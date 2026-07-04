import type { Device } from '../../../types';
import { buildDeviceMetadata, getDeviceKind } from './devices';

function device(metadata: Record<string, unknown>): Device {
  return {
    id: 1,
    name: 'Устройство',
    serial_number: 'device-1',
    is_active: true,
    last_seen: null,
    metadata,
    greenhouse_id: 1,
    user_id: 1,
  };
}

test('recognizes only the three current device purposes', () => {
  expect(getDeviceKind(device({ device_type: 'soil_irrigation' }))).toBe('soil_irrigation');
  expect(getDeviceKind(device({ device_type: 'climate_control' }))).toBe('climate_control');
  expect(getDeviceKind(device({ device_type: 'actuator' }))).toBe('other');
});

test('builds metadata for individual system components', () => {
  expect(buildDeviceMetadata('soil_irrigation')).toEqual({
    device_type: 'soil_irrigation',
    component_role: 'sensor',
    sensor_type: 'soil_moisture',
  });
  expect(buildDeviceMetadata('climate_control', {
    componentRole: 'actuator',
    systemId: 'climate-1',
    systemName: 'Климат у входа',
    strokeLength: 300,
    strokeSpeed: 4,
  })).toEqual({
    device_type: 'climate_control',
    component_role: 'actuator',
    system_id: 'climate-1',
    system_name: 'Климат у входа',
    actuator_type: 'linear_actuator',
    strokeLength: 300,
    strokeSpeed: 4,
  });
});
