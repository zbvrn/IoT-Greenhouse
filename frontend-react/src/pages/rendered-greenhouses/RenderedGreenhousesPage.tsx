import type { Device, DeviceTelemetry, Greenhouse, RouteState } from '../../types';
import {
  formatTelemetryValue,
  getLatestTelemetryValue,
  temperatureStates,
} from '../manifest-greenhouses/manifestModel';
import { useManifestGreenhouses } from '../manifest-greenhouses/useManifestGreenhouses';
import VisualDeviceCard from './VisualDeviceCard';

type Props = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

function LoadingState() {
  return (
    <div className="manifest-loading" role="status" aria-live="polite">
      <span className="manifest-spinner" aria-hidden="true" />
      <div>
        <strong>Загружаем ваши теплицы</strong>
        <p>Получаем список теплиц, подключённые приборы и последние сохранённые показания.</p>
      </div>
    </div>
  );
}

function getGreenhouseDevices(greenhouse: Greenhouse, devices: Device[]) {
  return devices.filter((device) => device.greenhouse_id === greenhouse.id);
}

function getClimatePreview(devices: Device[], telemetry: Record<number, DeviceTelemetry>) {
  const device = devices.find((item) =>
    temperatureStates.some(
      (state) => getLatestTelemetryValue(telemetry[item.id], state.telemetryKeys) !== undefined
    )
  );

  if (!device) return [];

  return temperatureStates.map((state) => ({
    key: state.key,
    label: state.label,
    value: formatTelemetryValue(
      getLatestTelemetryValue(telemetry[device.id], state.telemetryKeys),
      state
    ),
  }));
}

function RenderedGreenhouseCard({
  greenhouse,
  devices,
  telemetry,
}: {
  greenhouse: Greenhouse;
  devices: Device[];
  telemetry: Record<number, DeviceTelemetry>;
}) {
  const greenhouseDevices = getGreenhouseDevices(greenhouse, devices);
  const climatePreview = getClimatePreview(greenhouseDevices, telemetry);

  return (
    <a className="render-greenhouse-card" href={`#/greenhouses-render/${greenhouse.id}`}>
      <div className="render-greenhouse-card__glass" aria-hidden="true">
        <div className="render-greenhouse-illustration">
          <div className="render-greenhouse-roof" />
          <div className="render-greenhouse-body">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="render-greenhouse-beds">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="render-greenhouse-card__content">
        <p className="eyebrow">{greenhouse.location || 'Место не указано'}</p>
        <h2>{greenhouse.name}</h2>
        <div className="render-greenhouse-card__stats">
          {climatePreview.length ? (
            climatePreview.map((metric) => (
              <div key={metric.key}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))
          ) : (
            <div>
              <span>Показания</span>
              <strong>Нет данных</strong>
            </div>
          )}
          <div>
            <span>Устройств</span>
            <strong>{greenhouseDevices.length}</strong>
          </div>
        </div>
        <span className="manifest-card-link">Открыть теплицу →</span>
      </div>
    </a>
  );
}

function RenderedGreenhouseDetail({
  greenhouse,
  devices,
  telemetry,
  telemetryErrors,
  isRefreshing,
  onRefresh,
  onCommand,
  onSaveSettings,
}: {
  greenhouse: Greenhouse;
  devices: Device[];
  telemetry: Record<number, DeviceTelemetry>;
  telemetryErrors: Record<number, string>;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCommand: (device: Device, command: 'open' | 'close' | 'stop') => Promise<void>;
  onSaveSettings: (device: Device, values: Record<string, number>) => Promise<Device>;
}) {
  const greenhouseDevices = getGreenhouseDevices(greenhouse, devices);

  return (
    <div className="render-page">
      <section className="page-intro page-intro--detail">
        <div>
          <a className="back-link" href="#/greenhouses-render">
            ← К списку теплиц
          </a>
          <p className="eyebrow">Оборудование теплицы</p>
          <h1>{greenhouse.name}</h1>
          <p className="page-intro__text">
            Здесь видно, какие приборы подключены к теплице: датчики, привод форточки и клапан полива.
            На каждом приборе показаны последние полученные значения.
          </p>
        </div>
        <dl className="summary-strip">
          <div>
            <dt>Устройств</dt>
            <dd>{greenhouseDevices.length}</dd>
          </div>
          <div>
            <dt>Показания</dt>
            <dd>30 сек.</dd>
          </div>
          <div>
            <dt>Раздел</dt>
            <dd>Приборы</dd>
          </div>
        </dl>
      </section>

      <div className="manifest-toolbar">
        <div>
          <strong>Приборы в теплице</strong>
          <span>Следите за показаниями и управляйте оборудованием в одном месте</span>
        </div>
        <button type="button" disabled={isRefreshing} onClick={onRefresh}>
          {isRefreshing ? 'Обновляем...' : 'Обновить показания'}
        </button>
      </div>

      {greenhouseDevices.length ? (
        <div className="render-device-grid">
          {greenhouseDevices.map((device) => (
            <VisualDeviceCard
              key={device.id}
              device={device}
              telemetry={telemetry[device.id]}
              telemetryError={telemetryErrors[device.id]}
              onCommand={onCommand}
              onSaveSettings={onSaveSettings}
            />
          ))}
        </div>
      ) : (
        <section className="empty-block">
          <p>В этой теплице пока нет подключённых приборов.</p>
        </section>
      )}
    </div>
  );
}

function RenderedGreenhousesPage({ token, routeState, onAuthExpired }: Props) {
  const {
    devices,
    greenhouses,
    isLoading,
    isRefreshing,
    loadError,
    refreshTelemetry,
    saveDeviceParameters,
    sendCommand,
    telemetry,
    telemetryErrors,
  } = useManifestGreenhouses({ token, onAuthExpired });

  if (isLoading) return <LoadingState />;
  if (loadError) return <p className="form-error">{loadError}</p>;

  if (routeState.route === 'greenhouse-render') {
    const greenhouse = greenhouses.find((item) => item.id === routeState.greenhouseId);
    if (!greenhouse) {
      return (
        <section className="empty-block">
          <p>Теплица не найдена.</p>
          <a href="#/greenhouses-render">Вернуться к списку теплиц</a>
        </section>
      );
    }

    return (
      <RenderedGreenhouseDetail
        greenhouse={greenhouse}
        devices={devices}
        telemetry={telemetry}
        telemetryErrors={telemetryErrors}
        isRefreshing={isRefreshing}
        onRefresh={refreshTelemetry}
        onCommand={sendCommand}
        onSaveSettings={saveDeviceParameters}
      />
    );
  }

  return (
    <div className="render-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Приборы и показания</p>
          <h1>Теплицы и приборы</h1>
          <p className="page-intro__text">
            Здесь собраны ваши теплицы с подключёнными приборами. Откройте нужную теплицу,
            чтобы посмотреть температуру, влажность и состояние оборудования.
          </p>
        </div>
        <dl className="summary-strip">
          <div>
            <dt>Теплиц</dt>
            <dd>{greenhouses.length}</dd>
          </div>
          <div>
            <dt>Устройств</dt>
            <dd>{devices.length}</dd>
          </div>
          <div>
            <dt>Данные</dt>
            <dd>Онлайн</dd>
          </div>
        </dl>
      </section>

      <div className="manifest-toolbar">
        <div>
          <strong>Ваши теплицы</strong>
          <span>Откройте теплицу, чтобы посмотреть приборы и последние показания</span>
        </div>
        <button type="button" disabled={isRefreshing} onClick={refreshTelemetry}>
          {isRefreshing ? 'Обновляем...' : 'Обновить показания'}
        </button>
      </div>

      {greenhouses.length ? (
        <div className="render-greenhouse-grid">
          {greenhouses.map((greenhouse) => (
            <RenderedGreenhouseCard
              key={greenhouse.id}
              greenhouse={greenhouse}
              devices={devices}
              telemetry={telemetry}
            />
          ))}
        </div>
      ) : (
        <section className="empty-block">
          <p>Теплиц пока нет. Когда вы добавите теплицу, здесь появится её карточка.</p>
        </section>
      )}
    </div>
  );
}

export default RenderedGreenhousesPage;
