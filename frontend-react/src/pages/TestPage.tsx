import type { Device, DeviceTelemetry, Greenhouse } from '../types';
import VisualDeviceCard from './rendered-greenhouses/VisualDeviceCard';

const now = Date.now();

const mockGreenhouse: Greenhouse = {
  id: 900,
  name: 'Тестовая теплица',
  location: 'Демонстрационный участок',
  is_active: true,
  metadata: {},
  created_at: new Date(now - 86400000).toISOString(),
  updated_at: new Date(now).toISOString(),
  user_id: 1,
};

const mockDevices: Device[] = [
  {
    id: 901,
    name: 'Датчик микроклимата у входа',
    serial_number: 'TEST-CLIMATE-001',
    is_active: true,
    metadata: { device_type: 'sensor' },
    greenhouse_id: mockGreenhouse.id,
    user_id: 1,
  },
  {
    id: 902,
    name: 'Датчик влажности почвы',
    serial_number: 'TEST-SOIL-001',
    is_active: true,
    metadata: { device_type: 'soil_sensor', sensor_type: 'soil' },
    greenhouse_id: mockGreenhouse.id,
    user_id: 1,
  },
  {
    id: 903,
    name: 'Привод верхней форточки',
    serial_number: 'TEST-WINDOW-001',
    is_active: true,
    metadata: { device_type: 'actuator', actuator_type: 'linear_actuator' },
    greenhouse_id: mockGreenhouse.id,
    user_id: 1,
  },
  {
    id: 904,
    name: 'Клапан полива грядки',
    serial_number: 'TEST-VALVE-001',
    is_active: true,
    metadata: { device_type: 'valve', actuator_type: 'irrigation_valve' },
    greenhouse_id: mockGreenhouse.id,
    user_id: 1,
  },
  {
    id: 905,
    name: 'Дополнительный прибор',
    serial_number: 'TEST-DEVICE-001',
    is_active: false,
    metadata: { device_type: 'other' },
    greenhouse_id: mockGreenhouse.id,
    user_id: 1,
  },
];

function sample(value: unknown, minutesAgo: number) {
  return [{ ts: now - minutesAgo * 60000, value }];
}

const mockTelemetry: Record<number, DeviceTelemetry> = {
  901: {
    device_id: 901,
    serial_number: 'TEST-CLIMATE-001',
    retrieved_at: new Date(now).toISOString(),
    telemetry: {
      temperature: sample(24.6, 2),
      humidity: sample(61, 2),
      tempStatus: sample('normal', 2),
      humStatus: sample('normal', 2),
    },
  },
  902: {
    device_id: 902,
    serial_number: 'TEST-SOIL-001',
    retrieved_at: new Date(now).toISOString(),
    telemetry: {
      soilMoisture: sample(34, 5),
      soilMoistureStatus: sample('dry', 5),
    },
  },
  903: {
    device_id: 903,
    serial_number: 'TEST-WINDOW-001',
    retrieved_at: new Date(now).toISOString(),
    telemetry: {
      position: sample(72, 1),
      status: sample('opening', 1),
      actionAck: sample('accepted', 1),
    },
  },
  904: {
    device_id: 904,
    serial_number: 'TEST-VALVE-001',
    retrieved_at: new Date(now).toISOString(),
    telemetry: {
      currentPosition: sample(45, 3),
      currentState: sample('open', 3),
      actionAck: sample('completed', 3),
    },
  },
  905: {
    device_id: 905,
    serial_number: 'TEST-DEVICE-001',
    retrieved_at: new Date(now).toISOString(),
    telemetry: {
      status: sample('offline', 18),
    },
  },
};

function TestPage() {
  const sendMockCommand = async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  };

  return (
    <div className="render-page">
      <section className="page-intro page-intro--detail">
        <div>
          <p className="eyebrow">Проверочная теплица</p>
          <h1>{mockGreenhouse.name}</h1>
          <p className="page-intro__text">
            Здесь показаны примеры всех видов приборов с тестовыми показаниями. Эта страница нужна,
            чтобы быстро посмотреть внешний вид интерфейса без подключения реальных устройств.
          </p>
        </div>
        <dl className="summary-strip">
          <div>
            <dt>Приборов</dt>
            <dd>{mockDevices.length}</dd>
          </div>
          <div>
            <dt>Типов</dt>
            <dd>5</dd>
          </div>
          <div>
            <dt>Температура</dt>
            <dd>24.6 °C</dd>
          </div>
          <div>
            <dt>Влажность</dt>
            <dd>61 %</dd>
          </div>
        </dl>
      </section>

      <div className="render-test-greenhouse" aria-hidden="true">
        <div className="render-test-greenhouse__roof" />
        <div className="render-test-greenhouse__body">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="render-test-greenhouse__beds">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="manifest-toolbar">
        <div>
          <strong>Тестовые приборы</strong>
          <span>Можно проверить, как выглядят датчики, привод форточки, клапан полива и обычный прибор</span>
        </div>
      </div>

      <div className="render-device-grid">
        {mockDevices.map((device) => (
          <VisualDeviceCard
            key={device.id}
            device={device}
            telemetry={mockTelemetry[device.id]}
            onCommand={sendMockCommand}
          />
        ))}
      </div>
    </div>
  );
}

export default TestPage;
