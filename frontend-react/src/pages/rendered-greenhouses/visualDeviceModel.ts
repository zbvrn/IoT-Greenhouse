import type { Device, DeviceTelemetry } from '../../types';
import {
  formatTelemetryValue,
  getDevicePresentation,
  getHistoricalStates,
  getLatestTelemetryTimestamp,
  getLatestTelemetryValue,
  actuatorParameters,
  soilParameters,
  temperatureStates,
  temperatureParameters,
  valveParameters,
  type ManifestParameter,
  type ManifestState,
} from '../manifest-greenhouses/manifestModel';

export type VisualDeviceKind = 'climate-sensor' | 'soil-sensor' | 'window-drive' | 'water-valve' | 'generic';

export type VisualMetric = {
  key: string;
  label: string;
  value: string;
  hint: string;
  rawValue: unknown;
};

export type VisualDevice = {
  kind: VisualDeviceKind;
  title: string;
  metrics: VisualMetric[];
  lastDataAt?: number;
  positionPercent: number;
  parameters: ManifestParameter[];
  stateLabel: string;
  supportsCommands: boolean;
};

function normalizedDeviceText(device: Device) {
  const metadata = device.metadata || {};
  return [
    device.name,
    device.serial_number,
    metadata.device_type,
    metadata.sensor_type,
    metadata.actuator_type,
    metadata.manifest_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const soilTelemetryKeys = ['soilMoisture', 'soil_moisture', 'currentSoilMoisture'];
const actuatorTelemetryKeys = ['position', 'windowPosition', 'currentPosition', 'actuatorPosition', 'status', 'currentState', 'windowState'];

function hasTelemetryValue(telemetry: DeviceTelemetry | undefined, keys: string[]) {
  return getLatestTelemetryValue(telemetry, keys) !== undefined;
}

function hasAnyTelemetryValue(telemetry: DeviceTelemetry | undefined, stateList: ManifestState[]) {
  return stateList.some((state) => hasTelemetryValue(telemetry, state.telemetryKeys));
}

function getVisualKind(device: Device, telemetry?: DeviceTelemetry): VisualDeviceKind {
  const text = normalizedDeviceText(device);
  if (hasTelemetryValue(telemetry, soilTelemetryKeys)) return 'soil-sensor';
  if (hasAnyTelemetryValue(telemetry, temperatureStates)) return 'climate-sensor';
  if (hasTelemetryValue(telemetry, actuatorTelemetryKeys)) return 'window-drive';

  if (/soil|почв/.test(text)) return 'soil-sensor';
  if (/valve|irrig|полив|клапан/.test(text)) return 'water-valve';
  if (/actuator|window|привод|форточ/.test(text)) return 'window-drive';
  if (/sensor|temperature|humidity|датчик/.test(text)) return 'climate-sensor';
  return 'generic';
}

function getPositionPercent(telemetry: DeviceTelemetry | undefined, states: ManifestState[]) {
  const positionState = states.find((state) => state.key === 'currentPosition');
  const value = positionState
    ? getLatestTelemetryValue(telemetry, positionState.telemetryKeys)
    : undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function getStateLabel(telemetry: DeviceTelemetry | undefined, states: ManifestState[]) {
  const state = states.find((item) => item.key === 'currentState');
  if (!state) return 'Работает';
  return formatTelemetryValue(getLatestTelemetryValue(telemetry, state.telemetryKeys), state);
}

export function buildVisualDevice(device: Device, telemetry?: DeviceTelemetry): VisualDevice {
  const presentation = getDevicePresentation(device);
  const visualKind = getVisualKind(device, telemetry);
  const historicalStates = getHistoricalStates(telemetry, presentation.states);
  const visibleStates = (() => {
    if (visualKind === 'climate-sensor' && hasAnyTelemetryValue(telemetry, temperatureStates)) {
      return temperatureStates;
    }
    if (visualKind === 'soil-sensor' && historicalStates.length) {
      return historicalStates.filter((state) => state.key === 'currentSoilMoisture');
    }
    if (presentation.kind === 'device' && historicalStates.length) {
      return historicalStates;
    }
    return [...presentation.states, ...historicalStates];
  })();
  const title =
    visualKind === 'climate-sensor'
      ? 'Датчик микроклимата'
      : visualKind === 'soil-sensor'
        ? 'Датчик влажности почвы'
        : presentation.title;
  const parameters = (() => {
    if (visualKind === 'climate-sensor') return temperatureParameters;
    if (visualKind === 'soil-sensor') return soilParameters;
    if (visualKind === 'water-valve') return valveParameters;
    if (visualKind === 'window-drive') return actuatorParameters;
    return presentation.parameters;
  })();

  const metrics = visibleStates.map((state) => ({
    key: state.key,
    label: state.label,
    value: formatTelemetryValue(getLatestTelemetryValue(telemetry, state.telemetryKeys), state),
    hint: state.hint,
    rawValue: getLatestTelemetryValue(telemetry, state.telemetryKeys),
  }));

  return {
    kind: visualKind,
    title,
    metrics,
    lastDataAt: getLatestTelemetryTimestamp(telemetry),
    parameters,
    positionPercent: getPositionPercent(telemetry, visibleStates),
    stateLabel: getStateLabel(telemetry, visibleStates),
    supportsCommands:
      presentation.supportsCommands &&
      (visualKind === 'window-drive' || visualKind === 'water-valve'),
  };
}

export function formatLastDataDate(timestamp?: number) {
  if (!timestamp) return 'показаний пока нет';
  return new Date(timestamp).toLocaleString('ru-RU');
}
