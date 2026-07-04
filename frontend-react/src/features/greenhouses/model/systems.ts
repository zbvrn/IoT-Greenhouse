import type { Device, DeviceTelemetry } from '../../../types';
import { getComponentRole, getDeviceKind, getSystemId, getSystemName } from './devices';
import { mergeDeviceTelemetry } from './telemetry';
import type { DeviceKind } from './types';

export type GreenhouseDeviceSystem = {
  id: string;
  name: string;
  kind: DeviceKind;
  devices: Device[];
  primary: Device;
  commandTarget?: Device;
  settingsTarget: Device;
};

export function groupDevicesIntoSystems(devices: Device[]): GreenhouseDeviceSystem[] {
  const groups = new Map<string, Device[]>();
  devices.forEach((device) => {
    const id = getSystemId(device);
    groups.set(id, [...(groups.get(id) || []), device]);
  });

  return Array.from(groups, ([id, systemDevices]) => {
    const sensor = systemDevices.find((device) => getComponentRole(device) === 'sensor');
    const actuator = systemDevices.find((device) => getComponentRole(device) === 'actuator');
    const control = systemDevices.find((device) => getComponentRole(device) === 'control');
    const primary = sensor || actuator || control || systemDevices[0];
    return {
      id,
      name: getSystemName(primary),
      kind: getDeviceKind(primary),
      devices: systemDevices,
      primary,
      commandTarget: control || actuator,
      settingsTarget: actuator || primary,
    };
  });
}

export function mergeSystemTelemetry(
  system: GreenhouseDeviceSystem,
  telemetryByDevice: Record<number, DeviceTelemetry>
) {
  const available = system.devices
    .map((device) => telemetryByDevice[device.id])
    .filter((item): item is DeviceTelemetry => Boolean(item));
  if (!available.length) return undefined;
  return available.reduce((merged, item) => mergeDeviceTelemetry(merged, item), {
    ...available[0],
    device_id: system.primary.id,
    serial_number: system.primary.serial_number,
    telemetry: {},
  });
}
