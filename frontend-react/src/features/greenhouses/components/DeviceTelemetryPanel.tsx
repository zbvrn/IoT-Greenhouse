import { useEffect, useMemo, useState } from 'react';
import Dropdown from '../../../components/ui/Dropdown';
import type { Device, DeviceTelemetry, Greenhouse, TelemetrySample } from '../../../types';
import { deviceKindLabels } from '../model/constants';
import { getDeviceKind } from '../model/devices';
import { getFriendlyError } from '../model/errors';
import {
  formatDateTime,
  formatVisualValue,
  getNumericTelemetrySummary,
  getTelemetryLabel,
  getTelemetryRows,
  getTelemetryUnit,
  hasTelemetryValue,
} from '../model/telemetry';
import type { DeviceCommand, DeviceKind, DeviceUpdatePayload } from '../model/types';
import { DeleteDeviceConfirm, DeviceSettingsForm } from './DeviceForms';
import Modal from './Modal';

function formatNumericValue(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function TelemetryHistory({ telemetry }: { telemetry: DeviceTelemetry }) {
  const keys = useMemo(
    () => Object.keys(telemetry.telemetry).filter((key) => telemetry.telemetry[key]?.length),
    [telemetry]
  );
  const [selectedKey, setSelectedKey] = useState(keys[0] || '');

  useEffect(() => {
    if (!keys.includes(selectedKey)) setSelectedKey(keys[0] || '');
  }, [keys, selectedKey]);

  if (!keys.length) {
    return <p className="my-inline-warning">История показаний пока отсутствует.</p>;
  }

  const samples = [...(telemetry.telemetry[selectedKey] || [])].sort(
    (left, right) => left.ts - right.ts
  );
  const hasValues = samples.some(hasTelemetryValue);
  const summary = getNumericTelemetrySummary(samples);
  const unit = getTelemetryUnit(selectedKey);
  const chartWidth = 720;
  const chartHeight = 210;
  const chartPadding = 22;
  const numericValues = summary?.samples || [];
  const valueRange = summary ? summary.max - summary.min || 1 : 1;
  const points = numericValues
    .map((sample, index) => {
      const x =
        numericValues.length === 1
          ? chartWidth / 2
          : chartPadding +
            (index / (numericValues.length - 1)) * (chartWidth - chartPadding * 2);
      const y =
        chartHeight -
        chartPadding -
        ((sample.numericValue - (summary?.min || 0)) / valueRange) *
          (chartHeight - chartPadding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="my-history">
      <div className="my-history__toolbar">
        <div className="my-form__field">
          <span>Показатель</span>
          <Dropdown
            value={selectedKey}
            onChange={setSelectedKey}
            placeholder="Выберите показатель"
            inlineMenu
            options={keys.map((key) => ({ value: key, label: getTelemetryLabel(key) }))}
          />
        </div>
        <span>Доступно значений: {samples.length}</span>
      </div>

      {summary ? (
        <>
          <div className="my-history__summary">
            <div><span>Минимум</span><strong>{formatNumericValue(summary.min)} {unit}</strong></div>
            <div><span>Максимум</span><strong>{formatNumericValue(summary.max)} {unit}</strong></div>
            <div>
              <span>Изменение</span>
              <strong>
                {summary.trend === 'up' ? 'Растет ↑' : summary.trend === 'down' ? 'Снижается ↓' : 'Без изменений'}
              </strong>
            </div>
          </div>
          <div className="my-history__chart" aria-label={`График: ${getTelemetryLabel(selectedKey)}`}>
            <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <title>История показателя «{getTelemetryLabel(selectedKey)}»</title>
              <line x1={chartPadding} y1={chartPadding} x2={chartPadding} y2={chartHeight - chartPadding} />
              <line x1={chartPadding} y1={chartHeight - chartPadding} x2={chartWidth - chartPadding} y2={chartHeight - chartPadding} />
              <polyline points={points} />
            </svg>
          </div>
        </>
      ) : hasValues ? (
        <p className="my-inline-warning">Для текстовых значений доступна таблица без графика.</p>
      ) : (
        <p className="my-inline-warning">Для этого показателя пока нет полученных значений.</p>
      )}

      {hasValues && (
        <div className="my-history__table-wrap">
          <table className="my-history__table">
            <thead><tr><th>Дата и время</th><th>Значение</th></tr></thead>
            <tbody>
              {[...samples].reverse().filter(hasTelemetryValue).map((sample, index) => (
                <tr key={`${sample.ts}-${index}`}>
                  <td>{formatDateTime(sample.ts)}</td>
                  <td>{formatVisualValue(selectedKey, sample.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type TelemetryRow = {
  key: string;
  sample: TelemetrySample;
};

function DeviceScreen({ rows, compact = false }: { rows: TelemetryRow[]; compact?: boolean }) {
  const visibleRows = [...rows].sort(
    (left, right) => Number(hasTelemetryValue(right.sample)) - Number(hasTelemetryValue(left.sample))
  );
  return (
    <div className={`my-device-render__screen${compact ? ' is-compact' : ''}${visibleRows.length > 4 ? ' is-dense' : ''}`}>
      <div className="my-device-render__screen-header">
        <span>LIVE</span>
        <i aria-hidden="true" />
      </div>
      {visibleRows.length ? (
        visibleRows.map(({ key, sample }) => (
          <div className="my-device-render__screen-row" key={key}>
            <span>{getTelemetryLabel(key)}</span>
            <strong>{formatVisualValue(key, sample.value)}</strong>
          </div>
        ))
      ) : (
        <div className="my-device-render__screen-empty">НЕТ ДАННЫХ</div>
      )}
    </div>
  );
}

function DeviceControls({
  pendingCommand,
  onCommand,
}: {
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  return (
    <div className="my-device-render__controls" aria-label="Управление устройством">
      <button
        aria-label="Открыть"
        disabled={Boolean(pendingCommand)}
        title="Открыть"
        type="button"
        onClick={() => onCommand('open')}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        aria-label="Стоп"
        disabled={Boolean(pendingCommand)}
        title="Стоп"
        type="button"
        onClick={() => onCommand('stop')}
      >
        <span aria-hidden="true">■</span>
      </button>
      <button
        aria-label="Закрыть"
        disabled={Boolean(pendingCommand)}
        title="Закрыть"
        type="button"
        onClick={() => onCommand('close')}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </div>
  );
}

function DeviceIllustration({
  kind,
  rows,
  pendingCommand,
  onCommand,
}: {
  kind: DeviceKind;
  rows: TelemetryRow[];
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  const canControl = kind === 'actuator' || kind === 'valve';
  return (
    <div className={`my-device-render my-device-render--other${canControl ? ' has-controls' : ''}`}>
      <div className="my-device-render__antenna" />
      <div className="my-device-render__rugged-case">
        <div className="my-device-render__identity">
          <span className="my-device-render__model">Умная теплица</span>
          <span className="my-device-render__type">{deviceKindLabels[kind]}</span>
        </div>
        <DeviceScreen rows={rows} />
        {canControl && <DeviceControls pendingCommand={pendingCommand} onCommand={onCommand} />}
        <div className="my-device-render__connectors"><i /><i /><i /></div>
      </div>
    </div>
  );
}

function DeviceVisual({
  device,
  kind,
  rows,
  telemetry,
  pendingCommand,
  feedback,
  error,
  onCommand,
  onDismissError,
}: {
  device: Device;
  kind: DeviceKind;
  rows: TelemetryRow[];
  telemetry?: DeviceTelemetry;
  pendingCommand: string;
  feedback: string;
  error: string;
  onCommand: (command: DeviceCommand) => void;
  onDismissError: () => void;
}) {
  return (
    <div className="my-device-visual-modal">
      <div className="my-device-visual-stage">
        <DeviceIllustration
          kind={kind}
          rows={rows}
          pendingCommand={pendingCommand}
          onCommand={onCommand}
        />
      </div>
      <div className="my-device-visual-details">
        <div>
          <span>{deviceKindLabels[kind]}</span>
          <h3>{device.name}</h3>
          <p>Номер устройства: {device.serial_number}</p>
          <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'Данные ещё не получены'}</time>
        </div>
        {rows.length ? (
          <dl>
            {rows.map(({ key, sample }) => (
              <div key={key}>
                <dt>{getTelemetryLabel(key)}</dt>
                <dd>{formatVisualValue(key, sample.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="my-inline-warning">Показаний для визуального представления пока нет.</p>
        )}
      </div>
      {feedback && <p className="form-success my-device-visual-feedback">{feedback}</p>}
      {error && (
        <div className="my-device-visual-toast" role="alert">
          <span>{error}</span>
          <button aria-label="Закрыть сообщение" title="Закрыть" type="button" onClick={onDismissError}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function DeviceTelemetryPanel({
  device,
  telemetry,
  telemetryError,
  onCommand,
  greenhouses,
  onUpdate,
  onDelete,
}: {
  device: Device;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onCommand: (device: Device, command: DeviceCommand) => Promise<void>;
  greenhouses: Greenhouse[];
  onUpdate: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onDelete: (device: Device) => Promise<void>;
}) {
  const rows = getTelemetryRows(telemetry);
  const kind = getDeviceKind(device);
  const canControl = kind === 'actuator' || kind === 'valve';
  const [pendingCommand, setPendingCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isVisualOpen, setIsVisualOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleCommand = async (command: DeviceCommand) => {
    setPendingCommand(command);
    setFeedback('');
    setError('');
    try {
      await onCommand(device, command);
      setFeedback('Команда отправлена устройству.');
    } catch (commandError) {
      setError(getFriendlyError(commandError, 'Попробуйте позже: команду не удалось отправить.'));
    } finally {
      setPendingCommand('');
    }
  };

  return (
    <article className="my-device-card">
      <header>
        <div>
          <span>{deviceKindLabels[kind]}</span>
          <h3>{device.name}</h3>
          <p>{device.serial_number}</p>
        </div>
        <div className="my-device-card__header-actions">
          <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'нет данных'}</time>
          <div>
            <button className="secondary-action" type="button" onClick={() => setIsVisualOpen(true)}>
              Визуальное представление
            </button>
            <button className="secondary-action" type="button" disabled={!telemetry || !rows.length} onClick={() => setIsHistoryOpen(true)}>
              История показаний
            </button>
            <button className="secondary-action" type="button" onClick={() => setIsSettingsOpen(true)}>
              Настроить
            </button>
          </div>
        </div>
      </header>

      {telemetryError ? (
        <p className="my-inline-warning">{telemetryError}</p>
      ) : rows.length ? (
        <dl className="my-telemetry-grid">
          {rows.map(({ key, sample }) => (
            <div key={key}>
              <dt>{getTelemetryLabel(key)}</dt>
              <dd>{formatVisualValue(key, sample.value)}</dd>
              {(() => {
                const summary = getNumericTelemetrySummary(telemetry?.telemetry[key] || []);
                if (!summary) return null;
                const unit = getTelemetryUnit(key);
                return (
                  <span className="my-telemetry-grid__summary">
                    {summary.trend === 'up' ? 'Растет ↑' : summary.trend === 'down' ? 'Снижается ↓' : 'Без изменений'}
                    {' · '}{formatNumericValue(summary.min)}–{formatNumericValue(summary.max)} {unit}
                  </span>
                );
              })()}
              <small>{formatDateTime(sample.ts)}</small>
            </div>
          ))}
        </dl>
      ) : (
        <p className="my-inline-warning">Показаний пока нет. Попробуйте обновить данные позже.</p>
      )}

      {canControl && (
        <div className="my-command-row">
          <button
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('open')}
          >
            {pendingCommand === 'open' ? 'Отправляем...' : 'Открыть'}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('close')}
          >
            {pendingCommand === 'close' ? 'Отправляем...' : 'Закрыть'}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('stop')}
          >
            {pendingCommand === 'stop' ? 'Отправляем...' : 'Стоп'}
          </button>
        </div>
      )}
      {feedback && !isVisualOpen && <p className="form-success">{feedback}</p>}
      {error && !isVisualOpen && <p className="form-error">{error}</p>}
      {isVisualOpen && (
        <Modal title="Визуальное представление" size="wide" onClose={() => setIsVisualOpen(false)}>
          <DeviceVisual
            device={device}
            kind={kind}
            rows={rows}
            telemetry={telemetry}
            pendingCommand={pendingCommand}
            feedback={feedback}
            error={error}
            onCommand={handleCommand}
            onDismissError={() => setError('')}
          />
        </Modal>
      )}
      {isHistoryOpen && telemetry && (
        <Modal title={`История: ${device.name}`} size="wide" onClose={() => setIsHistoryOpen(false)}>
          <TelemetryHistory telemetry={telemetry} />
        </Modal>
      )}
      {isSettingsOpen && (
        <Modal title="Настроить устройство" size="wide" onClose={() => setIsSettingsOpen(false)}>
          <DeviceSettingsForm
            device={device}
            greenhouses={greenhouses}
            onSave={async (currentDevice, payload) => {
              await onUpdate(currentDevice, payload);
              setIsSettingsOpen(false);
            }}
            onRequestDelete={() => setIsDeleteConfirmOpen(true)}
          />
        </Modal>
      )}
      {isDeleteConfirmOpen && (
        <Modal title="Удалить устройство" size="compact" onClose={() => setIsDeleteConfirmOpen(false)}>
          <DeleteDeviceConfirm
            device={device}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={async () => {
              await onDelete(device);
              setIsDeleteConfirmOpen(false);
              setIsSettingsOpen(false);
            }}
          />
        </Modal>
      )}
    </article>
  );
}
