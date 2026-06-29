import type { DeviceTelemetry, TelemetrySample } from '../../../types';
import { normalizedTelemetryLabels, telemetryDisplayOrder, telemetryLabels } from './constants';

export function formatDateTime(value?: string | number | null) {
  if (!value) return 'нет данных';
  const normalizedValue =
    typeof value === 'string' && value.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? `${value}Z`
      : value;
  const timestamp =
    typeof normalizedValue === 'number' ? normalizedValue : new Date(normalizedValue).getTime();
  if (!Number.isFinite(timestamp)) return 'нет данных';
  return new Date(timestamp).toLocaleString('ru-RU');
}

export function formatTelemetryValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Нет данных';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function getTelemetryLabel(key: string) {
  return telemetryLabels[key] || normalizedTelemetryLabels[normalizeTelemetryKey(key)] || key;
}

export function normalizeTelemetryKey(key: string) {
  return key.replace(/[_\-\s]/g, '').toLowerCase();
}

export function getTelemetryUnit(key: string) {
  const normalizedKey = normalizeTelemetryKey(key);
  if (normalizedKey === 'temperature') return '°C';
  if (/humidity|moisture|position/i.test(normalizedKey)) return '%';
  if (normalizedKey === 'speed') return '%';
  return '';
}

export function formatVisualValue(key: string, value: unknown) {
  const normalizedKey = normalizeTelemetryKey(key);
  if (/status|state|actuatoropen/.test(normalizedKey)) {
    const normalized = String(value).trim().toLowerCase();
    const stateLabels: Record<string, string> = {
      true: 'Открыто',
      false: 'Закрыто',
      open: 'Открыто',
      opened: 'Открыто',
      opening: 'Открывается',
      close: 'Закрыто',
      closed: 'Закрыто',
      closing: 'Закрывается',
      stop: 'Остановлено',
      stopped: 'Остановлено',
    };
    if (stateLabels[normalized]) return stateLabels[normalized];
  }
  const formatted = formatTelemetryValue(value);
  const unit = getTelemetryUnit(key);
  return unit && formatted !== 'Нет данных' ? `${formatted} ${unit}` : formatted;
}

export function hasTelemetryValue(sample: TelemetrySample) {
  return sample.value !== undefined && sample.value !== null && sample.value !== '';
}

export function getLatestSample(samples: TelemetrySample[]) {
  return samples.reduce(
    (latest, sample) => (!latest || sample.ts > latest.ts ? sample : latest),
    undefined as TelemetrySample | undefined
  );
}

export function mergeDeviceTelemetry(
  previous: DeviceTelemetry | undefined,
  incoming: DeviceTelemetry
): DeviceTelemetry {
  if (!previous) return incoming;

  const keys = new Set([
    ...Object.keys(previous.telemetry),
    ...Object.keys(incoming.telemetry),
  ]);
  const telemetry: DeviceTelemetry['telemetry'] = {};

  keys.forEach((key) => {
    const samplesByTimestamp = new Map<number, TelemetrySample>();
    [...(previous.telemetry[key] || []), ...(incoming.telemetry[key] || [])].forEach(
      (sample) => samplesByTimestamp.set(sample.ts, sample)
    );
    telemetry[key] = Array.from(samplesByTimestamp.values()).sort(
      (left, right) => left.ts - right.ts
    );
  });

  return { ...incoming, telemetry };
}

export function getTelemetryRows(telemetry?: DeviceTelemetry) {
  if (!telemetry) return [];

  return Object.entries(telemetry.telemetry)
    .map(([key, samples]) => {
      const latest = getLatestSample(samples || []);
      return latest ? { key, sample: latest } : null;
    })
    .filter((item): item is { key: string; sample: TelemetrySample } => Boolean(item))
    .sort((left, right) => {
      const valuePriority =
        Number(hasTelemetryValue(right.sample)) - Number(hasTelemetryValue(left.sample));
      if (valuePriority) return valuePriority;

      const leftKey = normalizeTelemetryKey(left.key);
      const rightKey = normalizeTelemetryKey(right.key);
      const leftIndex = telemetryDisplayOrder.indexOf(leftKey);
      const rightIndex = telemetryDisplayOrder.indexOf(rightKey);
      const orderPriority =
        (leftIndex === -1 ? telemetryDisplayOrder.length : leftIndex) -
        (rightIndex === -1 ? telemetryDisplayOrder.length : rightIndex);
      if (orderPriority) return orderPriority;

      return getTelemetryLabel(left.key).localeCompare(getTelemetryLabel(right.key), 'ru');
    });
}

export function getNumericTelemetrySummary(samples: TelemetrySample[]) {
  const numericSamples = samples
    .filter(
      (sample) =>
        typeof sample.value === 'number' ||
        (typeof sample.value === 'string' && sample.value.trim() !== '')
    )
    .map((sample) => ({ ...sample, numericValue: Number(sample.value) }))
    .filter((sample) => Number.isFinite(sample.numericValue))
    .sort((left, right) => left.ts - right.ts);

  if (!numericSamples.length) return null;

  const values = numericSamples.map((sample) => sample.numericValue);
  const latest = numericSamples[numericSamples.length - 1];
  const previous = numericSamples[numericSamples.length - 2];
  const trend = previous
    ? latest.numericValue > previous.numericValue
      ? 'up'
      : latest.numericValue < previous.numericValue
        ? 'down'
        : 'steady'
    : 'steady';

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    trend,
    samples: numericSamples,
  };
}
