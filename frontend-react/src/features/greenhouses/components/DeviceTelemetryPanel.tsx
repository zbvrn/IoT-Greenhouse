import { useEffect, useMemo, useState } from 'react';
import Dropdown from '../../../components/ui/Dropdown';
import type { Device, DeviceTelemetry, Greenhouse, TelemetrySample } from '../../../types';
import {
  deviceKindLabels,
  getComponentRoleLabel,
  getTelemetryLabelForKind,
} from '../model/constants';
import { getComponentRole, getDeviceKind } from '../model/devices';
import { getFriendlyError } from '../model/errors';
import {
  formatDateTime,
  filterTelemetryForSystem,
  formatVisualValue,
  getNumericTelemetrySummary,
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

function ExpandableTelemetryValue({ telemetryKey, value, kind }: { telemetryKey: string; value: unknown; kind: DeviceKind }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = formatVisualValue(telemetryKey, value, kind);
  const canExpand = formatted.length > 24;
  return (
    <span className={`my-telemetry-value${expanded ? ' is-expanded' : ''}`}>
      <span>{formatted}</span>
      {canExpand && (
        <button
          aria-label={expanded ? 'Свернуть значение' : 'Показать значение полностью'}
          title={expanded ? 'Свернуть' : 'Показать полностью'}
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Свернуть' : '…'}
        </button>
      )}
    </span>
  );
}

function TelemetryHistory({ telemetry, kind }: { telemetry: DeviceTelemetry; kind: DeviceKind }) {
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
  const unit = getTelemetryUnit(selectedKey, kind);
  const chartWidth = 720;
  const chartHeight = 270;
  const chartLeft = 68;
  const chartRight = 24;
  const chartTop = 20;
  const chartBottom = 54;
  const plotWidth = chartWidth - chartLeft - chartRight;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const numericValues = summary?.samples || [];
  const timeMin = numericValues[0]?.ts || 0;
  const timeMax = numericValues[numericValues.length - 1]?.ts || timeMin;
  const timeRange = timeMax - timeMin;
  const rawValueRange = summary ? summary.max - summary.min : 0;
  const valuePadding = summary
    ? rawValueRange > 0
      ? rawValueRange * 0.12
      : Math.max(Math.abs(summary.max) * 0.05, 1)
    : 1;
  const valueMin = (summary?.min || 0) - valuePadding;
  const valueMax = (summary?.max || 0) + valuePadding;
  const valueRange = valueMax - valueMin || 1;
  const getX = (timestamp: number) =>
    timeRange > 0
      ? chartLeft + ((timestamp - timeMin) / timeRange) * plotWidth
      : chartLeft + plotWidth / 2;
  const getY = (value: number) =>
    chartTop + ((valueMax - value) / valueRange) * plotHeight;
  const chartPoints = numericValues.map((sample) => ({
    ...sample,
    x: getX(sample.ts),
    y: getY(sample.numericValue),
  }));
  const points = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ');
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      value: valueMax - ratio * valueRange,
      y: chartTop + ratio * plotHeight,
    };
  });
  const xTickCount = Math.min(numericValues.length, 5);
  const xTickIndexes = Array.from(
    new Set(
      Array.from({ length: xTickCount }, (_, index) =>
        Math.round((index / Math.max(xTickCount - 1, 1)) * (numericValues.length - 1))
      )
    )
  );
  const showDateOnAxis = timeRange >= 24 * 60 * 60 * 1000;
  const formatAxisTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString('ru-RU', {
      ...(showDateOnAxis ? { day: '2-digit', month: '2-digit' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

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
            options={keys.map((key) => ({ value: key, label: getTelemetryLabelForKind(kind, key) }))}
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
          <div className="my-history__chart" aria-label={`График: ${getTelemetryLabelForKind(kind, selectedKey)}`}>
            <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <title>История показателя «{getTelemetryLabelForKind(kind, selectedKey)}»</title>
              {yTicks.map((tick) => (
                <g key={tick.y}>
                  <line
                    className="my-history__grid-line"
                    x1={chartLeft}
                    x2={chartWidth - chartRight}
                    y1={tick.y}
                    y2={tick.y}
                  />
                  <text className="my-history__axis-tick" textAnchor="end" x={chartLeft - 10} y={tick.y + 4}>
                    {formatNumericValue(tick.value)}
                  </text>
                </g>
              ))}
              {xTickIndexes.map((index) => {
                const sample = numericValues[index];
                const x = getX(sample.ts);
                return (
                  <g key={`${sample.ts}-${index}`}>
                    <line
                      className="my-history__grid-line"
                      x1={x}
                      x2={x}
                      y1={chartTop}
                      y2={chartTop + plotHeight}
                    />
                    <text className="my-history__axis-tick" textAnchor="middle" x={x} y={chartTop + plotHeight + 22}>
                      {formatAxisTime(sample.ts)}
                    </text>
                  </g>
                );
              })}
              <line className="my-history__axis-line" x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartTop + plotHeight} />
              <line className="my-history__axis-line" x1={chartLeft} y1={chartTop + plotHeight} x2={chartWidth - chartRight} y2={chartTop + plotHeight} />
              <text
                className="my-history__axis-title"
                textAnchor="middle"
                transform={`rotate(-90 16 ${chartTop + plotHeight / 2})`}
                x={16}
                y={chartTop + plotHeight / 2}
              >
                {getTelemetryLabelForKind(kind, selectedKey)}{unit ? `, ${unit}` : ''}
              </text>
              <text className="my-history__axis-title" textAnchor="middle" x={chartLeft + plotWidth / 2} y={chartHeight - 7}>
                Время
              </text>
              {chartPoints.length > 1 && <polyline points={points} />}
              {chartPoints.map((point) => (
                <circle className="my-history__point" cx={point.x} cy={point.y} key={`${point.ts}-${point.numericValue}`} r="4">
                  <title>{formatDateTime(point.ts)}: {formatNumericValue(point.numericValue)} {unit}</title>
                </circle>
              ))}
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
                  <td>{formatVisualValue(selectedKey, sample.value, kind)}</td>
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

function DeviceScreen({ rows, kind, compact = false }: { rows: TelemetryRow[]; kind: DeviceKind; compact?: boolean }) {
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
            <span>{getTelemetryLabelForKind(kind, key)}</span>
            <strong>{formatVisualValue(key, sample.value, kind)}</strong>
          </div>
        ))
      ) : (
        <div className="my-device-render__screen-empty">НЕТ ДАННЫХ</div>
      )}
    </div>
  );
}

function DeviceControls({
  kind,
  pendingCommand,
  onCommand,
}: {
  kind: DeviceKind;
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  const middleCommand: DeviceCommand = 'stop';
  const middleLabel = kind === 'soil_irrigation' ? 'Остановить клапан' : 'Остановить';
  return (
    <div className="my-device-render__controls" aria-label="Управление устройством">
      <button
        aria-label={kind === 'soil_irrigation' ? 'Открыть клапан' : 'Открыть форточку'}
        disabled={Boolean(pendingCommand)}
        title={kind === 'soil_irrigation' ? 'Открыть клапан' : 'Открыть форточку'}
        type="button"
        onClick={() => onCommand('open')}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        aria-label={middleLabel}
        disabled={Boolean(pendingCommand)}
        title={middleLabel}
        type="button"
        onClick={() => onCommand(middleCommand)}
      >
        <span aria-hidden="true">■</span>
      </button>
      <button
        aria-label={kind === 'soil_irrigation' ? 'Закрыть клапан' : 'Закрыть форточку'}
        disabled={Boolean(pendingCommand)}
        title={kind === 'soil_irrigation' ? 'Закрыть клапан' : 'Закрыть форточку'}
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
  canControl,
  pendingCommand,
  onCommand,
}: {
  kind: DeviceKind;
  rows: TelemetryRow[];
  canControl: boolean;
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  return (
    <div className={`my-device-render my-device-render--other${canControl ? ' has-controls' : ''}`}>
      <div className="my-device-render__antenna" />
      <div className="my-device-render__rugged-case">
        <div className="my-device-render__identity">
          <span className="my-device-render__model">Умная теплица</span>
          <span className="my-device-render__type">{deviceKindLabels[kind]}</span>
        </div>
        <DeviceScreen rows={rows} kind={kind} />
        {canControl && (
          <DeviceControls kind={kind} pendingCommand={pendingCommand} onCommand={onCommand} />
        )}
        <div className="my-device-render__connectors"><i /><i /><i /></div>
      </div>
    </div>
  );
}

export function DeviceTelemetryPanel({
  device,
  displayName,
  componentCount = 1,
  commandDevice,
  systemDevices,
  onRenameSystem,
  onConfigureActuator,
  telemetry,
  telemetryError,
  onCommand,
  greenhouses,
  onUpdate,
  onDelete,
}: {
  device: Device;
  displayName?: string;
  componentCount?: number;
  commandDevice?: Device;
  systemDevices?: Device[];
  onRenameSystem?: (name: string) => Promise<void>;
  onConfigureActuator?: (settings: {
    strokeLength?: number;
    strokeSpeed?: number;
    valveOpenPercent?: number;
  }) => Promise<void>;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onCommand: (device: Device, command: DeviceCommand) => Promise<void>;
  greenhouses: Greenhouse[];
  onUpdate: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onDelete: (device: Device) => Promise<void>;
}) {
  const kind = getDeviceKind(device);
  const visibleTelemetry = filterTelemetryForSystem(
    telemetry,
    kind,
    systemDevices || [device]
  );
  const rows = getTelemetryRows(visibleTelemetry);
  const canControl =
    kind !== 'other' &&
    (systemDevices ? Boolean(commandDevice) : Boolean(commandDevice || device));
  const finalCommand: DeviceCommand = 'stop';
  const openLabel = kind === 'soil_irrigation' ? 'Открыть клапан' : 'Открыть форточку';
  const closeLabel = kind === 'soil_irrigation' ? 'Закрыть клапан' : 'Закрыть форточку';
  const finalLabel = kind === 'soil_irrigation' ? 'Остановить клапан' : 'Остановить привод';
  const [pendingCommand, setPendingCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [systemName, setSystemName] = useState(displayName || device.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleCommand = async (command: DeviceCommand) => {
    setPendingCommand(command);
    setFeedback('');
    setError('');
    try {
      await onCommand(commandDevice || device, command);
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
          <h3>{displayName || device.name}</h3>
          <p>{componentCount > 1 ? `Компонентов в системе: ${componentCount}` : device.serial_number}</p>
        </div>
        <div className="my-device-card__header-actions">
          <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'нет данных'}</time>
          <div>
            <button className="secondary-action" type="button" disabled={!telemetry || !rows.length} onClick={() => setIsHistoryOpen(true)}>
              История показаний
            </button>
            <button className="secondary-action" type="button" onClick={() => setIsSettingsOpen(true)}>
              Настроить
            </button>
          </div>
        </div>
      </header>

      <div className="my-device-card__visual">
        <DeviceIllustration
          kind={kind}
          rows={rows}
          canControl={canControl}
          pendingCommand={pendingCommand}
          onCommand={handleCommand}
        />
      </div>

      {telemetryError ? (
        <p className="my-inline-warning">{telemetryError}</p>
      ) : rows.length ? (
        <dl className="my-telemetry-grid">
          {rows.map(({ key, sample }) => (
            <div key={key}>
              <dt>{getTelemetryLabelForKind(kind, key)}</dt>
              <dd><ExpandableTelemetryValue telemetryKey={key} value={sample.value} kind={kind} /></dd>
              {(() => {
                const summary = getNumericTelemetrySummary(visibleTelemetry?.telemetry[key] || []);
                if (!summary) return null;
                const unit = getTelemetryUnit(key, kind);
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
            {pendingCommand === 'open' ? 'Отправляем...' : openLabel}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('close')}
          >
            {pendingCommand === 'close' ? 'Отправляем...' : closeLabel}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand(finalCommand)}
          >
            {pendingCommand === finalCommand ? 'Отправляем...' : finalLabel}
          </button>
        </div>
      )}
      {feedback && <p className="form-success">{feedback}</p>}
      {error && (
        <div className="my-device-visual-toast" role="alert">
          <span>{error}</span>
          <button
            aria-label="Закрыть сообщение"
            title="Закрыть"
            type="button"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}
      {isHistoryOpen && visibleTelemetry && (
        <Modal title={`История: ${displayName || device.name}`} size="history" onClose={() => setIsHistoryOpen(false)}>
          <TelemetryHistory telemetry={visibleTelemetry} kind={kind} />
        </Modal>
      )}
      {isSettingsOpen && (
        <Modal title="Настройки системы" size="wide" onClose={() => setIsSettingsOpen(false)}>
          <div className="my-system-settings">
            {onRenameSystem && (
              <form
                className="my-system-settings__name"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!systemName.trim()) return;
                  setIsRenaming(true);
                  try {
                    await onRenameSystem(systemName.trim());
                  } finally {
                    setIsRenaming(false);
                  }
                }}
              >
                <label>
                  <span>Название системы *</span>
                  <input value={systemName} onChange={(event) => setSystemName(event.target.value)} />
                </label>
                <button type="submit" disabled={isRenaming || !systemName.trim()}>
                  {isRenaming ? 'Сохраняем...' : 'Переименовать'}
                </button>
              </form>
            )}
            <section className="my-system-components" aria-label="Устройства системы">
              <h3>Устройства системы</h3>
              <ul>
                {(systemDevices || [device]).map((component) => (
                  <li
                    key={component.id}
                    className={selectedDevice?.id === component.id ? 'is-selected' : ''}
                  >
                    <div>
                      <span>{component.name}</span>
                      <small>
                        {getComponentRoleLabel(kind, getComponentRole(component))} · {component.serial_number}
                      </small>
                    </div>
                    <button className="secondary-action" type="button" onClick={() => setSelectedDevice(component)}>
                      Настроить
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            {selectedDevice && (
              <section className="my-system-settings__device">
                <h3>Настройка: {selectedDevice.name}</h3>
                <DeviceSettingsForm
                  device={selectedDevice}
                  greenhouses={greenhouses}
                  lockAssignment
                  onSave={async (currentDevice, payload) => {
                    await onUpdate(currentDevice, payload);
                    if (
                      getComponentRole(currentDevice) === 'actuator' &&
                      onConfigureActuator &&
                      payload.strokeLength !== undefined &&
                      payload.strokeSpeed !== undefined
                    ) {
                      await onConfigureActuator({
                        strokeLength: payload.strokeLength,
                        strokeSpeed: payload.strokeSpeed,
                      });
                    }
                    if (
                      getComponentRole(currentDevice) === 'actuator' &&
                      onConfigureActuator &&
                      payload.valveOpenPercent !== undefined
                    ) {
                      await onConfigureActuator({ valveOpenPercent: payload.valveOpenPercent });
                    }
                    setSelectedDevice(null);
                  }}
                  onRequestDelete={() => setIsDeleteConfirmOpen(true)}
                />
              </section>
            )}
          </div>
        </Modal>
      )}
      {isDeleteConfirmOpen && (
        <Modal title="Удалить устройство" size="compact" onClose={() => setIsDeleteConfirmOpen(false)}>
          <DeleteDeviceConfirm
            device={selectedDevice || device}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={async () => {
              await onDelete(selectedDevice || device);
              setIsDeleteConfirmOpen(false);
              setSelectedDevice(null);
            }}
          />
        </Modal>
      )}
    </article>
  );
}
