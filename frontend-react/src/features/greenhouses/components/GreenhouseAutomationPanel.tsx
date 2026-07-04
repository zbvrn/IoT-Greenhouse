import { useMemo, useState } from 'react';

export type AutomationDraft = {
  enabled: boolean;
  target: number;
  hysteresis: number;
};

type Props = {
  greenhouseId: number;
  hasClimateControl: boolean;
  hasSoilIrrigation: boolean;
  onSaveTemperature?: (draft: AutomationDraft) => Promise<void>;
  onSaveMoisture?: (draft: AutomationDraft) => Promise<void>;
};

function readDraft(key: string, fallback: AutomationDraft) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? ({ ...fallback, ...JSON.parse(stored) } as AutomationDraft) : fallback;
  } catch {
    return fallback;
  }
}

function AutomationSection({
  title,
  description,
  unit,
  targetLabel,
  draft,
  onChange,
  thresholds,
}: {
  title: string;
  description: string;
  unit: string;
  targetLabel: string;
  draft: AutomationDraft;
  onChange: (draft: AutomationDraft) => void;
  thresholds: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="my-automation-section">
      <label className="my-automation-switch">
        <span>
          <strong>{title}</strong>
          <p>{description}</p>
        </span>
        <span className="my-automation-switch__control">
          <input
            aria-label={`Автоматический режим: ${title}`}
            checked={draft.enabled}
            role="switch"
            type="checkbox"
            onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
          />
          <i aria-hidden="true" />
        </span>
      </label>

      <div className="my-automation-fields">
        <label>
          <span>{targetLabel}</span>
          <div>
            <input
              aria-label={targetLabel}
              type="number"
              value={draft.target}
              onChange={(event) => onChange({ ...draft, target: Number(event.target.value) })}
            />
            <span>{unit}</span>
          </div>
        </label>
        <label>
          <span>Гистерезис</span>
          <div>
            <input
              aria-label={`Гистерезис: ${title}`}
              min="0"
              type="number"
              value={draft.hysteresis}
              onChange={(event) =>
                onChange({ ...draft, hysteresis: Math.max(0, Number(event.target.value)) })
              }
            />
            <span>{unit}</span>
          </div>
        </label>
      </div>

      <div className="my-automation-thresholds">
        {thresholds.map((threshold) => (
          <div key={threshold.label}>
            <span>{threshold.label}</span>
            <strong>{threshold.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GreenhouseAutomationPanel({
  greenhouseId,
  hasClimateControl,
  hasSoilIrrigation,
  onSaveTemperature,
  onSaveMoisture,
}: Props) {
  const temperatureKey = `greenhouse-automation-draft:v1:${greenhouseId}:temperature`;
  const moistureKey = `greenhouse-automation-draft:v1:${greenhouseId}:moisture`;
  const [temperature, setTemperature] = useState(() =>
    readDraft(temperatureKey, { enabled: false, target: 25, hysteresis: 2 })
  );
  const [moisture, setMoisture] = useState(() =>
    readDraft(moistureKey, { enabled: false, target: 60, hysteresis: 10 })
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const temperatureThresholds = useMemo(
    () => [
      { label: 'Открытие форточки', value: `выше ${temperature.target + temperature.hysteresis} °C` },
      { label: 'Закрытие форточки', value: `до ${temperature.target} °C` },
    ],
    [temperature]
  );
  const moistureThresholds = useMemo(
    () => [
      { label: 'Открытие клапана', value: `ниже ${moisture.target - moisture.hysteresis} %` },
      { label: 'Закрытие клапана', value: `от ${moisture.target} %` },
    ],
    [moisture]
  );

  const save = async () => {
    setIsSaving(true);
    setError('');
    if (hasClimateControl) localStorage.setItem(temperatureKey, JSON.stringify(temperature));
    if (hasSoilIrrigation) localStorage.setItem(moistureKey, JSON.stringify(moisture));
    try {
      if (hasClimateControl && onSaveTemperature) await onSaveTemperature(temperature);
      if (hasSoilIrrigation && onSaveMoisture) await onSaveMoisture(moisture);
      setSaved(true);
    } catch (saveError) {
      setSaved(false);
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Попробуйте позже: настройки автоматизации не удалось отправить.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="my-automation-panel" aria-labelledby="greenhouse-automation-title">
      <header className="my-automation-panel__header">
        <div>
          <h2 id="greenhouse-automation-title">Автоматизация микроклимата</h2>
          <p>Настройте пороги, по которым система будет управлять оборудованием.</p>
        </div>
      </header>

      <div className="my-automation-panel__content">
        {hasClimateControl && (
          <AutomationSection
            title="Управление температурой"
            description="Форточка открывается, когда температура превышает целевую вместе с гистерезисом."
            unit="°C"
            targetLabel="Целевая температура"
            draft={temperature}
            onChange={(draft) => {
              setTemperature(draft);
              setSaved(false);
            }}
            thresholds={temperatureThresholds}
          />
        )}
        {hasSoilIrrigation && (
          <AutomationSection
            title="Управление влажностью почвы"
            description="Клапан открывается при снижении влажности и закрывается после достижения цели."
            unit="%"
            targetLabel="Целевая влажность"
            draft={moisture}
            onChange={(draft) => {
              setMoisture(draft);
              setSaved(false);
            }}
            thresholds={moistureThresholds}
          />
        )}
      </div>

      <footer>
        {saved && <span className="form-success">Настройки сохранены и отправлены системе.</span>}
        {error && <span className="form-error" role="alert">{error}</span>}
        <button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
      </footer>
    </section>
  );
}
