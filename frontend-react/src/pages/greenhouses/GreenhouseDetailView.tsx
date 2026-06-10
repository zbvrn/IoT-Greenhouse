import DeviceCard from '../../components/greenhouses/DeviceCard';
import type { AutomationSetting, Device, Greenhouse } from '../../types';
import { formatDateTime, getAssignedDevices, getUnassignedDevices } from './greenhouseHelpers';
import { DeviceCreateForm, EditAutomationForm, EditGreenhouseForm } from './GreenhouseForms';

type GreenhouseDetailViewProps = {
  greenhouses: Greenhouse[];
  greenhouse: Greenhouse;
  devices: Device[];
  automation: AutomationSetting | null;
  onCreateDevice: (payload: {
    name: string;
    serial_number: string;
    greenhouse_id?: number | null;
  }) => Promise<unknown>;
  onUpdateGreenhouse: (
    greenhouseId: number,
    payload: { name?: string; location?: string; is_active?: boolean }
  ) => Promise<Greenhouse>;
  onDeleteGreenhouse: (greenhouseId: number) => Promise<void>;
  onUpdateAutomation: (
    greenhouseId: number,
    payload: {
      auto_mode?: boolean;
      target_temperature?: number;
      hysteresis?: number;
    }
  ) => Promise<AutomationSetting>;
  onAssignDevice: (deviceId: number, greenhouseId: number) => Promise<void>;
};

function GreenhouseDetailView({
  greenhouses,
  greenhouse,
  devices,
  automation,
  onCreateDevice,
  onUpdateGreenhouse,
  onDeleteGreenhouse,
  onUpdateAutomation,
  onAssignDevice,
}: GreenhouseDetailViewProps) {
  const assignedDevices = getAssignedDevices(greenhouse.id, devices);
  const unassignedDevices = getUnassignedDevices(devices);

  return (
    <div className="greenhouse-detail">
      <section className="page-intro page-intro--detail">
        <div>
          <a className="back-link" href="#/greenhouses">
            ← К теплицам
          </a>
          <p className="eyebrow">Теплица</p>
          <h1>{greenhouse.name}</h1>
          <p className="page-intro__text">
            Здесь видны свойства теплицы, список устройств, нераспределённые модули и настройки
            автоматики, которые работают именно для этой теплицы.
          </p>
        </div>

        <dl className="summary-strip">
          <div>
            <dt>Устройств</dt>
            <dd>{assignedDevices.length}</dd>
          </div>
          <div>
            <dt>Без привязки</dt>
            <dd>{unassignedDevices.length}</dd>
          </div>
          <div>
            <dt>Автоматика</dt>
            <dd>{automation?.auto_mode ? 'Включена' : 'Выключена'}</dd>
          </div>
          <div>
            <dt>Обновлено</dt>
            <dd>{formatDateTime(greenhouse.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <div className="greenhouse-detail__layout">
        <div className="greenhouse-detail__main">
          <EditGreenhouseForm
            greenhouse={greenhouse}
            onSave={onUpdateGreenhouse}
            onDelete={onDeleteGreenhouse}
          />

          {automation && (
            <EditAutomationForm
              greenhouseId={greenhouse.id}
              automation={automation}
              onSave={onUpdateAutomation}
            />
          )}

          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Устройства теплицы</h2>
              <p>Это устройства, уже привязанные к выбранной теплице.</p>
            </div>

            {assignedDevices.length ? (
              <div className="device-grid">
                {assignedDevices.map((device) => (
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
                <p>Пока к этой теплице не привязано ни одного устройства.</p>
              </div>
            )}
          </section>

          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Нераспределённые устройства</h2>
              <p>Если устройство уже зарегистрировалось в системе, его можно быстро привязать сюда.</p>
            </div>

            {unassignedDevices.length ? (
              <div className="device-grid">
                {unassignedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    greenhouses={greenhouses}
                    onAssign={onAssignDevice}
                    fixedGreenhouseId={greenhouse.id}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-block">
                <p>Нераспределённых устройств сейчас нет.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="greenhouse-detail__sidebar">
          <DeviceCreateForm
            greenhouseId={greenhouse.id}
            greenhouses={greenhouses}
            onCreate={onCreateDevice}
          />

          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Как подключить устройство</h2>
            </div>
            <div className="helper-list">
              <p>1. Возьмите номер с корпуса, наклейки, коробки или QR-кода.</p>
              <p>2. Добавьте устройство вручную или дождитесь его автопоявления в списке.</p>
              <p>3. После этого привяжите устройство к этой теплице.</p>
              <p>4. Для датчиков и приводов используйте имя, которое понятно именно вам.</p>
            </div>
          </section>

          <section className="module-panel">
            <div className="section-heading section-heading--tight">
              <h2>Автоматизация</h2>
            </div>
            <div className="helper-list">
              <p>Целевая температура и гистерезис влияют на автоматику проветривания.</p>
              <p>Последняя команда и время её выполнения отображаются в карточке автоматики.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default GreenhouseDetailView;
