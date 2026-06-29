import type { DeviceTelemetry } from '../../../types';
import { mergeDeviceTelemetry } from './telemetry';

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
