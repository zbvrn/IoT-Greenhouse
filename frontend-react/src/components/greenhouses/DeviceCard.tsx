import { useMemo, useState } from 'react';
import type { Device, Greenhouse } from '../../types';
import {
  formatDateTime,
  getDeviceCapabilities,
  getDeviceTypeLabel,
  getGreenhouseNameById,
} from '../../pages/greenhouses/greenhouseHelpers';
import { getRequestErrorMessage } from '../../utils/errors';

type DeviceCardProps = {
  device: Device;
  greenhouses: Greenhouse[];
  onAssign: (deviceId: number, greenhouseId: number) => Promise<void> | void;
  fixedGreenhouseId?: number;
};

function DeviceCard({ device, greenhouses, onAssign, fixedGreenhouseId }: DeviceCardProps) {
  const [targetId, setTargetId] = useState<string>('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const capabilities = useMemo(() => getDeviceCapabilities(device), [device]);
  const greenhouseLabel = getGreenhouseNameById(device.greenhouse_id, greenhouses);
  const resolvedTargetId = fixedGreenhouseId ?? (targetId ? Number(targetId) : null);

  const handleAssign = async () => {
    if (resolvedTargetId == null) return;
    setError('');
    setIsSaving(true);

    try {
      await onAssign(device.id, resolvedTargetId);
    } catch (assignError) {
      setError(getRequestErrorMessage(assignError, 'Не удалось привязать устройство.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="device-card">
      <div className="device-card__topline">
        <div>
          <h4>{device.name}</h4>
          <p>{getDeviceTypeLabel(device)}</p>
        </div>
        <span className={device.is_active ? 'status-pill' : 'status-pill status-pill--muted'}>
          {device.is_active ? 'Активно' : 'Отключено'}
        </span>
      </div>

      <dl className="device-card__meta">
        <div>
          <dt>Серийный номер</dt>
          <dd>{device.serial_number}</dd>
        </div>
        <div>
          <dt>Теплица</dt>
          <dd>{greenhouseLabel}</dd>
        </div>
        <div>
          <dt>Последний сеанс</dt>
          <dd>{formatDateTime(device.last_seen)}</dd>
        </div>
      </dl>

      {capabilities.length > 0 && (
        <div className="chips">
          {capabilities.slice(0, 4).map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
      )}

      {device.greenhouse_id == null && (
        <div className="device-card__assign">
          {fixedGreenhouseId ? (
            <button type="button" onClick={handleAssign} disabled={isSaving}>
              {isSaving ? 'Привязываем...' : 'Привязать к этой теплице'}
            </button>
          ) : (
            <>
              <label>
                Назначить на теплицу
                <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                  <option value="">Выберите теплицу</option>
                  {greenhouses.map((greenhouse) => (
                    <option key={greenhouse.id} value={greenhouse.id}>
                      {greenhouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleAssign} disabled={!targetId || isSaving}>
                {isSaving ? 'Привязываем...' : 'Привязать'}
              </button>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </article>
  );
}

export default DeviceCard;
