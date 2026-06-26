import type { Device, DeviceTelemetry } from '../../types';

export type ManifestState = {
  key: string;
  label: string;
  hint: string;
  type: 'number' | 'enum';
  unit?: string;
  telemetryKeys: string[];
};

export type ManifestParameter = {
  key: string;
  label: string;
  hint: string;
  defaultValue: number;
  min?: number;
  max?: number;
  unit: string;
};

export type DevicePresentation = {
  kind: 'sensor' | 'actuator' | 'device';
  title: string;
  states: ManifestState[];
  parameters: ManifestParameter[];
  supportsCommands: boolean;
};

export const temperatureStates: ManifestState[] = [
  {
    key: 'currentTemp',
    label: 'Температура',
    hint: 'Последнее измеренное значение температуры',
    type: 'number',
    unit: '°C',
    telemetryKeys: ['temperature', 'currentTemp', 'temp'],
  },
  {
    key: 'currentHum',
    label: 'Влажность воздуха',
    hint: 'Последнее измеренное значение влажности воздуха',
    type: 'number',
    unit: '%',
    telemetryKeys: ['humidity', 'currentHum', 'hum'],
  },
];

const soilStates: ManifestState[] = [
  {
    key: 'currentSoilMoisture',
    label: 'Влажность почвы',
    hint: 'Последнее измеренное значение влажности почвы',
    type: 'number',
    unit: '%',
    telemetryKeys: ['soilMoisture', 'soil_moisture', 'currentSoilMoisture'],
  },
];

const actuatorStates: ManifestState[] = [
  {
    key: 'currentPosition',
    label: 'Положение',
    hint: 'Фактическое положение исполнительного механизма',
    type: 'number',
    unit: '%',
    telemetryKeys: ['position', 'windowPosition', 'currentPosition', 'actuatorPosition'],
  },
  {
    key: 'currentState',
    label: 'Состояние',
    hint: 'Текущее состояние исполнительного механизма',
    type: 'enum',
    telemetryKeys: ['status', 'currentState', 'actuatorOpen', 'windowState'],
  },
  {
    key: 'actionAck',
    label: 'Подтверждение команды',
    hint: 'Результат обработки последней команды',
    type: 'enum',
    telemetryKeys: ['actionAck', 'ack'],
  },
];

export const temperatureParameters: ManifestParameter[] = [
  { key: 'tempMin', label: 'Мин. температура', hint: 'Нижняя граница комфортной температуры', defaultValue: 16, unit: '°C' },
  { key: 'tempMax', label: 'Макс. температура', hint: 'Верхняя граница комфортной температуры', defaultValue: 30, unit: '°C' },
  { key: 'humMin', label: 'Мин. влажность', hint: 'Нижняя граница влажности воздуха', defaultValue: 40, min: 0, max: 100, unit: '%' },
  { key: 'humMax', label: 'Макс. влажность', hint: 'Верхняя граница влажности воздуха', defaultValue: 75, min: 0, max: 100, unit: '%' },
];

export const soilParameters: ManifestParameter[] = [
  { key: 'moistureMin', label: 'Мин. влажность почвы', hint: 'Ниже этого значения требуется полив', defaultValue: 35, min: 0, max: 100, unit: '%' },
  { key: 'moistureMax', label: 'Макс. влажность почвы', hint: 'При достижении значения полив останавливается', defaultValue: 65, min: 0, max: 100, unit: '%' },
];

export const actuatorParameters: ManifestParameter[] = [
  { key: 'strokeLength', label: 'Ход привода', hint: 'Целевое положение при полном открытии', defaultValue: 250, min: 0, unit: 'мм' },
  { key: 'strokeSpeed', label: 'Скорость привода', hint: 'Скорость открытия и закрытия', defaultValue: 3, min: 0, unit: 'мм/с' },
];

export const valveParameters: ManifestParameter[] = [
  { key: 'valveOpenPercent', label: 'Лимит открытия клапана', hint: 'Максимальный процент открытия при поливе', defaultValue: 100, min: 0, max: 100, unit: '%' },
];

function normalizedDeviceText(device: Device) {
  const metadata = device.metadata || {};
  return [
    device.name,
    metadata.device_type,
    metadata.sensor_type,
    metadata.actuator_type,
    metadata.manifest_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getDevicePresentation(device: Device): DevicePresentation {
  const text = normalizedDeviceText(device);
  const isSoil = /soil|почв/.test(text);
  const isValve = /valve|irrig|полив|клапан/.test(text);
  const isActuator = isValve || /actuator|window|привод|форточ/.test(text);
  const isSensor = isSoil || /sensor|telemetry|датчик|temperature|humidity/.test(text);

  if (isActuator) {
    return {
      kind: 'actuator',
      title: isValve ? 'Клапан полива' : 'Исполнительный механизм',
      states: actuatorStates,
      parameters: isValve ? valveParameters : actuatorParameters,
      supportsCommands: true,
    };
  }

  if (isSensor) {
    return {
      kind: 'sensor',
      title: isSoil ? 'Датчик влажности почвы' : 'Датчик микроклимата',
      states: isSoil ? soilStates : temperatureStates,
      parameters: isSoil ? soilParameters : temperatureParameters,
      supportsCommands: false,
    };
  }

  return {
    kind: 'device',
    title: 'Устройство',
    states: [
      {
        key: 'status',
        label: 'Состояние',
        hint: 'Последнее состояние, полученное от устройства',
        type: 'enum',
        telemetryKeys: ['status'],
      },
    ],
    parameters: [],
    supportsCommands: false,
  };
}

export function getLatestTelemetryValue(
  telemetry: DeviceTelemetry | undefined,
  keys: string[]
) {
  if (!telemetry) return undefined;

  for (const key of keys) {
    const samples = telemetry.telemetry[key];
    if (samples?.length) {
      const latestWithValue = samples
        .filter((sample) => sample.value !== undefined && sample.value !== null && sample.value !== '')
        .reduce(
          (latest, sample) => (!latest || sample.ts > latest.ts ? sample : latest),
          undefined as (typeof samples)[number] | undefined
        );
      if (latestWithValue) return latestWithValue.value;
    }
  }
  return undefined;
}

export function getLatestTelemetryTimestamp(
  telemetry: DeviceTelemetry | undefined,
  onlyWithValue = true
) {
  if (!telemetry) return undefined;

  let latestTimestamp: number | undefined;
  Object.values(telemetry.telemetry).forEach((samples) => {
    samples.forEach((sample) => {
      if (
        onlyWithValue &&
        (sample.value === undefined || sample.value === null || sample.value === '')
      ) {
        return;
      }
      if (latestTimestamp === undefined || sample.ts > latestTimestamp) {
        latestTimestamp = sample.ts;
      }
    });
  });
  return latestTimestamp;
}

export function getHistoricalStates(
  telemetry: DeviceTelemetry | undefined,
  currentStates: ManifestState[]
) {
  const knownStates = [
    ...temperatureStates,
    ...soilStates,
    ...actuatorStates,
  ];
  const currentKeys = new Set(currentStates.map((state) => state.key));

  return knownStates.filter(
    (state) =>
      !currentKeys.has(state.key) &&
      getLatestTelemetryValue(telemetry, state.telemetryKeys) !== undefined
  );
}

export function getStoredParameter(device: Device, parameter: ManifestParameter) {
  const metadata = device.metadata || {};
  const stored = metadata.manifest_params;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const value = (stored as Record<string, unknown>)[parameter.key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return parameter.defaultValue;
}

export function formatTelemetryValue(value: unknown, state: ManifestState) {
  if (value === undefined || value === null || value === '') return 'Нет данных';
  if (state.type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return `${Math.round(numeric * 10) / 10}${state.unit ? ` ${state.unit}` : ''}`;
  }
  if (typeof value === 'boolean') return value ? 'Открыто' : 'Закрыто';

  const normalized = String(value).toLowerCase();
  const labels: Record<string, string> = {
    true: 'Открыто',
    false: 'Закрыто',
    open: 'Открыто',
    opened: 'Открыто',
    closed: 'Закрыто',
    opening: 'Открывается',
    closing: 'Закрывается',
    stopped: 'Остановлено',
    accepted: 'Принято',
    completed: 'Выполнено',
    failed: 'Ошибка',
    timeout: 'Тайм-аут',
    high: 'Высоко',
    low: 'Низко',
    normal: 'Норма',
    dry: 'Сухо',
    optimal: 'Оптимально',
    wet: 'Влажно',
  };
  return labels[normalized] || String(value);
}
