import type { Device, DeviceTelemetry } from '../../../types';
import {
  filterTelemetryForSystem,
  getTelemetryRows,
  mergeDeviceTelemetry,
} from './telemetry';

function telemetry(samples: DeviceTelemetry['telemetry']): DeviceTelemetry {
  return {
    device_id: 1,
    serial_number: 'device-1',
    telemetry: samples,
    retrieved_at: '2026-06-29T10:00:00Z',
  };
}

test('preserves previous telemetry samples when a refresh returns only the latest value', () => {
  const previous = telemetry({ temperature: [{ ts: 1000, value: '25' }] });
  const incoming = telemetry({ temperature: [{ ts: 2000, value: '28' }] });

  expect(mergeDeviceTelemetry(previous, incoming).telemetry.temperature).toEqual([
    { ts: 1000, value: '25' },
    { ts: 2000, value: '28' },
  ]);
});

test('replaces duplicate timestamps and keeps different telemetry keys', () => {
  const previous = telemetry({
    temperature: [{ ts: 1000, value: '25' }],
    humidity: [{ ts: 1000, value: '60' }],
  });
  const incoming = telemetry({ temperature: [{ ts: 1000, value: '26' }] });

  const merged = mergeDeviceTelemetry(previous, incoming);
  expect(merged.telemetry.temperature).toEqual([{ ts: 1000, value: '26' }]);
  expect(merged.telemetry.humidity).toEqual([{ ts: 1000, value: '60' }]);
});

test('shows the latest available value when a newer sample is empty', () => {
  const rows = getTelemetryRows(
    telemetry({
      currentTemp: [
        { ts: 1000, value: '22.1' },
        { ts: 2000, value: null },
      ],
    })
  );

  expect(rows[0].sample).toEqual({ ts: 1000, value: '22.1' });
});

function device(metadata: Record<string, unknown>): Device {
  return {
    id: 1,
    name: 'test device',
    serial_number: 'device-1',
    is_active: true,
    user_id: 1,
    metadata,
  };
}

test('shows only soil sensor metrics when the system has only a soil sensor', () => {
  const result = filterTelemetryForSystem(
    telemetry({
      currentSoilMoisture: [{ ts: 1000, value: 48 }],
      soilMoistureStatus: [{ ts: 1000, value: 'normal' }],
      currentTemp: [{ ts: 1000, value: 22 }],
      currentPosition: [{ ts: 1000, value: 0 }],
    }),
    'soil_irrigation',
    [device({ device_type: 'soil_irrigation', component_role: 'sensor' })]
  );

  expect(Object.keys(result?.telemetry || {})).toEqual([
    'currentSoilMoisture',
    'soilMoistureStatus',
  ]);
});

test('keeps arbitrary non-empty metrics for another device', () => {
  const result = filterTelemetryForSystem(
    telemetry({
      pressure: [{ ts: 1000, value: 740 }],
      unused: [{ ts: 1000, value: null }],
    }),
    'other',
    [device({ device_type: 'other', component_role: 'standalone' })]
  );

  expect(Object.keys(result?.telemetry || {})).toEqual(['pressure']);
});
