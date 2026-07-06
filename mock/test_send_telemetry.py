import unittest
import pathlib
import tempfile

from send_telemetry import (
    GreenhouseSystemEmulator,
    RuntimeStateStore,
    SystemConfig,
    command_from_rpc,
    parse_system,
)


class FakeClient:
    def __init__(self):
        self.telemetry = []

    def send_telemetry(self, token, payload):
        self.telemetry.append((token, payload))


class CommandParsingTests(unittest.TestCase):
    def test_backend_command_format(self):
        self.assertEqual(
            command_from_rpc(
                {"method": "setActuatorState", "params": {"state": "open"}}
            ),
            "open",
        )

    def test_manifest_signal_format(self):
        self.assertEqual(
            command_from_rpc({"method": "action", "params": {"value": "close"}}),
            "close",
        )

    def test_rejects_unknown_command(self):
        self.assertIsNone(
            command_from_rpc({"method": "setActuatorState", "params": {"state": "pause"}})
        )


class ConfigurationTests(unittest.TestCase):
    def test_parses_independent_system(self):
        config = parse_system(
            {
                "name": "test",
                "sensor": {"token": "sensor"},
                "control": {"token": "control"},
                "actuator": {
                    "token": "actuator",
                    "strokeLength": 300,
                    "strokeSpeed": 5,
                },
            },
            0,
        )
        self.assertEqual(config.name, "test")
        self.assertEqual(config.stroke_length, 300)
        self.assertEqual(config.stroke_speed, 5)

    def test_updates_actuator_parameters(self):
        emulator = GreenhouseSystemEmulator(
            SystemConfig("test", "climate", "sensor", "control", "actuator"),
            FakeClient(),
            telemetry_interval=10,
            movement_interval=1,
            rpc_timeout=30,
        )
        emulator._apply_config({"strokeLength": 300, "strokeSpeed": 6})
        self.assertEqual(emulator.config.stroke_length, 300)
        self.assertEqual(emulator.config.stroke_speed, 6)

    def test_automation_opens_above_upper_threshold(self):
        emulator = GreenhouseSystemEmulator(
            SystemConfig("test", "climate", "sensor", "control", "actuator"),
            FakeClient(),
            telemetry_interval=10,
            movement_interval=1,
            rpc_timeout=30,
        )
        emulator._apply_automation_config(
            {"enabled": True, "targetTemperature": 25, "hysteresis": 2}
        )
        emulator._evaluate_automation(27.1)
        self.assertEqual(emulator.action, "open")
        self.assertEqual(emulator.target_position, 250)

    def test_irrigation_automation_opens_below_lower_threshold(self):
        emulator = GreenhouseSystemEmulator(
            SystemConfig(
                "watering", "irrigation", "sensor", "control", "actuator", stroke_length=100
            ),
            FakeClient(),
            telemetry_interval=10,
            movement_interval=1,
            rpc_timeout=30,
        )
        emulator._apply_moisture_automation_config(
            {"enabled": True, "targetMoisture": 65, "hysteresis": 20}
        )
        emulator._evaluate_moisture_automation(44)
        self.assertEqual(emulator.action, "open")
        self.assertEqual(emulator.target_position, 100)

    def test_automation_settings_survive_emulator_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            store = RuntimeStateStore(pathlib.Path(directory) / "runtime-state.json")
            config = SystemConfig(
                "watering", "irrigation", "sensor", "control", "actuator",
                stroke_length=100,
            )
            emulator = GreenhouseSystemEmulator(
                config, FakeClient(), 10, 1, 30, store
            )
            emulator._apply_moisture_automation_config(
                {"enabled": True, "targetMoisture": 50, "hysteresis": 10}
            )

            restarted = GreenhouseSystemEmulator(
                SystemConfig(
                    "watering", "irrigation", "sensor", "control", "actuator",
                    stroke_length=100,
                ),
                FakeClient(), 10, 1, 30,
                RuntimeStateStore(pathlib.Path(directory) / "runtime-state.json"),
            )

            self.assertTrue(restarted.automation_enabled)
            self.assertEqual(restarted.target_moisture, 50)
            self.assertEqual(restarted.moisture_hysteresis, 10)
            restarted._evaluate_moisture_automation(3)
            self.assertEqual(restarted.action, "open")


if __name__ == "__main__":
    unittest.main()
