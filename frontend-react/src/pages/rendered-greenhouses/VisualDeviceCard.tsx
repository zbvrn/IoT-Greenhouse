import { useEffect, useMemo, useState } from 'react';
import type { Device, DeviceTelemetry } from '../../types';
import { getRequestErrorMessage } from '../../utils/errors';
import { getStoredParameter, type ManifestParameter } from '../manifest-greenhouses/manifestModel';
import { buildVisualDevice, formatLastDataDate, type VisualMetric } from './visualDeviceModel';

type Props = {
  device: Device;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onCommand: (device: Device, command: 'open' | 'close' | 'stop') => Promise<void>;
  onSaveSettings?: (device: Device, values: Record<string, number>) => Promise<Device | void>;
};

const commandLabels = {
  open: 'Открыть',
  close: 'Закрыть',
  stop: 'Стоп',
};

function getMetricValue(metrics: VisualMetric[], keys: string[], fallback: string) {
  return metrics.find((metric) => keys.includes(metric.key))?.value || fallback;
}

function ClimateSensorGraphic({ metrics }: { metrics: VisualMetric[] }) {
  const temperature = getMetricValue(metrics, ['currentTemp'], '—');
  const humidity = getMetricValue(metrics, ['currentHum'], '—');

  return (
    <div className="render-device-graphic render-device-graphic--sensor" aria-hidden="true">
      <div className="render-sensor-body">
        <div className="render-sensor-screen">
          <span>{temperature}</span>
          <small>Влажность {humidity}</small>
        </div>
        <div className="render-sensor-buttons">
          <span />
          <span />
        </div>
      </div>
      <div className="render-sensor-stem" />
    </div>
  );
}

function SoilSensorGraphic({ metrics }: { metrics: VisualMetric[] }) {
  const moisture = getMetricValue(metrics, ['currentSoilMoisture'], '—');

  return (
    <div className="render-device-graphic render-device-graphic--soil" aria-hidden="true">
      <div className="render-soil-module">
        <div className="render-soil-screen">{moisture}</div>
        <div className="render-soil-leds">
          <span />
          <span />
        </div>
      </div>
      <div className="render-soil-probes">
        <span />
        <span />
      </div>
      <div className="render-soil-ground" />
    </div>
  );
}

function WindowDriveGraphic({ positionPercent }: { positionPercent: number }) {
  return (
    <div className="render-device-graphic render-device-graphic--window" aria-hidden="true">
      <div className="render-window-frame">
        <div
          className="render-window-panel"
          style={{ transform: `translateX(${Math.min(42, positionPercent * 0.42)}px) rotateY(-18deg)` }}
        />
      </div>
      <div className="render-drive-rail">
        <span style={{ width: `${positionPercent}%` }} />
      </div>
    </div>
  );
}

function ValveGraphic({ positionPercent }: { positionPercent: number }) {
  return (
    <div className="render-device-graphic render-device-graphic--valve" aria-hidden="true">
      <div className="render-pipe" />
      <div className="render-valve-wheel" style={{ transform: `rotate(${positionPercent * 2.7}deg)` }}>
        <span />
      </div>
      <div className="render-water-drops">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function GenericDeviceGraphic() {
  return (
    <div className="render-device-graphic render-device-graphic--generic" aria-hidden="true">
      <div className="render-generic-box">
        <span />
      </div>
    </div>
  );
}

function DeviceGraphic({
  kind,
  metrics,
  positionPercent,
}: {
  kind: string;
  metrics: VisualMetric[];
  positionPercent: number;
}) {
  if (kind === 'soil-sensor') return <SoilSensorGraphic metrics={metrics} />;
  if (kind === 'window-drive') return <WindowDriveGraphic positionPercent={positionPercent} />;
  if (kind === 'water-valve') return <ValveGraphic positionPercent={positionPercent} />;
  if (kind === 'climate-sensor') return <ClimateSensorGraphic metrics={metrics} />;
  return <GenericDeviceGraphic />;
}

function DeviceSettings({
  device,
  parameters,
  onSaveSettings,
}: {
  device: Device;
  parameters: ManifestParameter[];
  onSaveSettings?: Props['onSaveSettings'];
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        parameters.map((parameter) => [parameter.key, getStoredParameter(device, parameter)])
      ),
    [device, parameters]
  );
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setValues(initialValues), [initialValues]);

  if (!parameters.length) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSaveSettings) {
      setFeedback('Настройки сохранены для просмотра на тестовой странице.');
      return;
    }

    setIsSaving(true);
    setFeedback('');
    setError('');
    try {
      await onSaveSettings(device, values);
      setFeedback('Настройки прибора сохранены.');
    } catch (saveError) {
      setError(getRequestErrorMessage(saveError, 'Не удалось сохранить настройки прибора.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="render-settings-panel" onSubmit={handleSubmit}>
      <div>
        <strong>Настройки прибора</strong>
        <span>Задайте удобные значения для работы в теплице</span>
      </div>
      <div className="render-settings-grid">
        {parameters.map((parameter) => (
          <label key={parameter.key}>
            <span>{parameter.label}</span>
            <span className="manifest-input-wrap">
              <input
                type="number"
                min={parameter.min}
                max={parameter.max}
                step="any"
                value={values[parameter.key] ?? parameter.defaultValue}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [parameter.key]: Number(event.target.value),
                  }))
                }
              />
              <span>{parameter.unit}</span>
            </span>
            <small>{parameter.hint}</small>
          </label>
        ))}
      </div>
      <button type="submit" disabled={isSaving}>
        {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
      </button>
      {feedback && <p className="form-success">{feedback}</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function VisualDeviceCard({ device, telemetry, telemetryError, onCommand, onSaveSettings }: Props) {
  const visualDevice = buildVisualDevice(device, telemetry);
  const [pendingCommand, setPendingCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    setPendingCommand(command);
    setFeedback('');
    setError('');
    try {
      await onCommand(device, command);
      setFeedback(`Команда «${commandLabels[command]}» отправлена устройству.`);
    } catch (commandError) {
      setError(getRequestErrorMessage(commandError, 'Не удалось отправить команду.'));
    } finally {
      setPendingCommand('');
    }
  };

  return (
    <article className={`render-device-card render-device-card--${visualDevice.kind}`}>
      <header className="render-device-card__header">
        <div>
          <p className="eyebrow">{visualDevice.title}</p>
          <h3>{device.name}</h3>
          <p>ID {device.serial_number}</p>
        </div>
        <span className={device.is_active ? 'status-pill' : 'status-pill status-pill--muted'}>
          {device.is_active ? 'Активно' : 'Отключено'}
        </span>
      </header>

      <div className="render-device-card__body">
        <DeviceGraphic
          kind={visualDevice.kind}
          metrics={visualDevice.metrics}
          positionPercent={visualDevice.positionPercent}
        />

        <div className="render-device-screen">
          <div>
            <span>Состояние</span>
            <strong>{visualDevice.stateLabel}</strong>
          </div>
          <div>
            <span>Последние данные</span>
            <strong>{formatLastDataDate(visualDevice.lastDataAt)}</strong>
          </div>
        </div>
      </div>

      <div className="render-metric-grid">
        {visualDevice.metrics.map((metric) => (
          <div className="render-metric" key={metric.key}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </div>
        ))}
      </div>

      {telemetryError && (
        <p className="manifest-inline-warning">
          Сейчас не получилось получить свежие показания, поэтому могут показываться последние сохранённые данные.
        </p>
      )}

      {visualDevice.supportsCommands && (
        <div className="render-command-panel">
          <span>Ручное управление</span>
          <div>
            {(['open', 'close', 'stop'] as const).map((command) => (
              <button
                className={command === 'stop' ? 'manifest-stop-button' : command === 'close' ? 'secondary-action' : ''}
                disabled={Boolean(pendingCommand) || !device.is_active}
                key={command}
                type="button"
                onClick={() => handleCommand(command)}
              >
                {pendingCommand === command ? 'Отправляем...' : commandLabels[command]}
              </button>
            ))}
          </div>
          {feedback && <p className="form-success">{feedback}</p>}
          {error && <p className="form-error">{error}</p>}
        </div>
      )}

      <DeviceSettings
        device={device}
        parameters={visualDevice.parameters}
        onSaveSettings={onSaveSettings}
      />
    </article>
  );
}

export default VisualDeviceCard;
