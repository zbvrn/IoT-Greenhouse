import DeviceCard from '../../components/greenhouses/DeviceCard';
import GreenhouseCard from '../../components/greenhouses/GreenhouseCard';
import type { Device, Greenhouse } from '../../types';
import { getUnassignedDevices, getGreenhouseDeviceCount } from './greenhouseHelpers';
import { CreateGreenhouseForm, DeviceCreateForm } from './GreenhouseForms';

type GreenhousesListViewProps = {
  greenhouses: Greenhouse[];
  devices: Device[];
  onCreateGreenhouse: (payload: { name: string; location?: string }) => Promise<Greenhouse>;
  onCreateDevice: (payload: {
    name: string;
    serial_number: string;
    greenhouse_id?: number | null;
  }) => Promise<unknown>;
  onAssignDevice: (deviceId: number, greenhouseId: number) => Promise<void>;
};

function GreenhousesListView({
  greenhouses,
  devices,
  onCreateGreenhouse,
  onCreateDevice,
  onAssignDevice,
}: GreenhousesListViewProps) {
  const unassignedDevices = getUnassignedDevices(devices);
  const activeGreenhouses = greenhouses.filter((greenhouse) => greenhouse.is_active).length;

  return (
    <div className="greenhouses-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Умная теплица</p>
          <h1>Теплицы</h1>
          <p className="page-intro__text">
            Настройте каждую теплицу под свой участок: добавьте устройства, распределите их по
            зонам и держите всё управление в одном понятном списке.
          </p>
        </div>

        <dl className="summary-strip">
          <div>
            <dt>Всего теплиц</dt>
            <dd>{greenhouses.length}</dd>
          </div>
          <div>
            <dt>Активных</dt>
            <dd>{activeGreenhouses}</dd>
          </div>
          <div>
            <dt>Устройств</dt>
            <dd>{devices.length}</dd>
          </div>
          <div>
            <dt>Без привязки</dt>
            <dd>{unassignedDevices.length}</dd>
          </div>
        </dl>
      </section>

      <div className="greenhouses-actions">
        <CreateGreenhouseForm onCreate={onCreateGreenhouse} />
        <DeviceCreateForm greenhouses={greenhouses} onCreate={onCreateDevice} />
      </div>

      <div className="greenhouses-content">
        <div className="greenhouses-main">
          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Ваши теплицы</h2>
              <p>Откройте теплицу, чтобы увидеть автоматику, список устройств и действия по управлению.</p>
            </div>

            {greenhouses.length ? (
              <div className="greenhouse-grid">
                {greenhouses.map((greenhouse) => (
                  <GreenhouseCard
                    key={greenhouse.id}
                    greenhouse={greenhouse}
                    deviceCount={getGreenhouseDeviceCount(greenhouse.id, devices)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-block">
                <p>Пока нет ни одной теплицы. Создайте первую, чтобы начать работу.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="greenhouses-side-panel">
          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Нераспределённые устройства</h2>
              <p>
                Если устройство уже появилось в системе после включения, выберите для него теплицу.
              </p>
            </div>

            {unassignedDevices.length ? (
              <div className="device-grid">
                {unassignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    greenhouses={greenhouses}
                    onAssign={onAssignDevice}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-block">
                <p>Сейчас все добавленные устройства уже распределены по теплицам.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default GreenhousesListView;
