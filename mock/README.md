# ThingsBoard greenhouse emulator

The emulator keeps configured devices active, publishes sensor and actuator
telemetry, waits for RPC commands on each controller, and simulates actuator
movement using `strokeLength` and `strokeSpeed`.

Both manifest-based system types are supported:

- `type: "climate"` publishes temperature and humidity and controls a window actuator;
- `type: "irrigation"` publishes soil moisture and controls an irrigation valve.

## Run

From this directory:

```powershell
docker compose up -d
docker compose logs -f greenhouse-emulator
```

Or run directly with Python 3.12+:

```powershell
python send_telemetry.py
```

Do not run a Postman long-poll request at the same time: it can consume the RPC
before the emulator receives it.

## Add another system

Copy `config-sample.json` to the ignored `config.json`, then append another
object to `systems`. Each system requires three ThingsBoard access tokens:

- `sensor.token` publishes `currentTemp`, `currentHum`, `tempStatus`, and `humStatus`;
- `control.token` receives RPC commands;
- `actuator.token` publishes `action`, `actionAck`, `currentPosition`, and `currentState`.

Supported command payloads:

```json
{"method":"setActuatorState","params":{"state":"open"}}
```

```json
{"method":"action","params":{"value":"close"}}
```

Commands are `open`, `close`, and `stop`. The optional methods
`setActuatorConfig` and `configureActuator` accept `strokeLength` and
`strokeSpeed`. `setAutomationConfig` accepts `enabled`, `targetTemperature`,
and `hysteresis`. The React application sends both configuration methods.

For irrigation, `setIrrigationConfig` accepts `valveOpenPercent`, and
`setMoistureAutomationConfig` accepts `enabled`, `targetMoisture`, and
`hysteresis`. The valve opens below `targetMoisture - hysteresis` and closes
when `targetMoisture` is reached.
