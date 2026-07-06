#!/usr/bin/env python3
"""Configurable ThingsBoard greenhouse device emulator over HTTP."""

from __future__ import annotations

import json
import os
import pathlib
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

DEFAULT_API_BASE_URL = "http://81.177.135.202:5010/api/v1"
DEFAULT_CONFIG_FILE = pathlib.Path(__file__).resolve().parent / "config.json"
DEFAULT_STATE_FILE = pathlib.Path(__file__).resolve().parent / "runtime-state.json"


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def log(level: str, message: str) -> None:
    print(f"{iso_timestamp()} {level} {message}", flush=True)


class ThingsBoardHttpClient:
    def __init__(self, api_base_url: str, request_timeout: float) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.request_timeout = request_timeout

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.api_base_url}/{path.lstrip('/')}",
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        with urllib.request.urlopen(request, timeout=timeout or self.request_timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
        return json.loads(body) if body.strip() else None

    def send_telemetry(self, token: str, payload: dict[str, Any]) -> None:
        self._request("POST", f"{token}/telemetry", payload)

    def wait_for_rpc(self, token: str, timeout_seconds: int) -> dict[str, Any] | None:
        return self._request(
            "GET",
            f"{token}/rpc?timeout={timeout_seconds * 1000}",
            timeout=timeout_seconds + self.request_timeout,
        )


class RuntimeStateStore:
    def __init__(self, path: pathlib.Path) -> None:
        self.path = path
        self.lock = threading.Lock()
        try:
            self.data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        except (json.JSONDecodeError, OSError):
            self.data = {}

    def get(self, system_name: str) -> dict[str, Any]:
        value = self.data.get(system_name, {})
        return value if isinstance(value, dict) else {}

    def update(self, system_name: str, values: dict[str, Any]) -> None:
        with self.lock:
            current = self.get(system_name)
            self.data[system_name] = {**current, **values}
            temporary = self.path.with_suffix(f"{self.path.suffix}.tmp")
            temporary.write_text(
                json.dumps(self.data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            temporary.replace(self.path)


@dataclass
class SystemConfig:
    name: str
    system_type: str
    sensor_token: str
    control_token: str
    actuator_token: str
    temperature: float = 24.0
    humidity: float = 55.0
    sensor_variation: float = 0.3
    stroke_length: float = 250.0
    stroke_speed: float = 3.0
    initial_position: float = 0.0
    soil_moisture: float = 45.0
    moisture_min: float = 35.0
    moisture_max: float = 65.0
    watering_rate: float = 2.0
    drying_rate: float = 0.5


def command_from_rpc(rpc: dict[str, Any]) -> str | None:
    method = str(rpc.get("method", "")).strip()
    params = rpc.get("params")
    if method == "setActuatorState" and isinstance(params, dict):
        value = params.get("state")
    elif method in {"action", "setAction"}:
        value = params.get("value", params.get("state")) if isinstance(params, dict) else params
    else:
        return None
    command = str(value).strip().lower()
    return command if command in {"open", "close", "stop"} else None


class GreenhouseSystemEmulator:
    def __init__(
        self,
        config: SystemConfig,
        client: ThingsBoardHttpClient,
        telemetry_interval: float,
        movement_interval: float,
        rpc_timeout: int,
        state_store: RuntimeStateStore | None = None,
    ) -> None:
        self.config = config
        self.client = client
        self.telemetry_interval = telemetry_interval
        self.movement_interval = movement_interval
        self.rpc_timeout = rpc_timeout
        self.state_store = state_store
        self.position = max(0.0, min(config.initial_position, config.stroke_length))
        self.target_position = self.position
        self.state = "open" if self.position >= config.stroke_length else "closed"
        self.action = "stop"
        self.action_ack = "completed"
        self.automation_enabled = False
        self.target_temperature = 25.0
        self.hysteresis = 2.0
        self.target_moisture = config.moisture_max
        self.moisture_hysteresis = config.moisture_max - config.moisture_min
        self.soil_moisture = config.soil_moisture
        self.lock = threading.Lock()
        self._restore_state()

    def _restore_state(self) -> None:
        if not self.state_store:
            return
        state = self.state_store.get(self.config.name)
        self.automation_enabled = bool(state.get("automationEnabled", self.automation_enabled))
        self.target_temperature = float(state.get("targetTemperature", self.target_temperature))
        self.hysteresis = float(state.get("temperatureHysteresis", self.hysteresis))
        self.target_moisture = float(state.get("targetMoisture", self.target_moisture))
        self.moisture_hysteresis = float(
            state.get("moistureHysteresis", self.moisture_hysteresis)
        )
        self.config.moisture_max = self.target_moisture
        self.config.moisture_min = self.target_moisture - self.moisture_hysteresis
        if state:
            log(
                "INFO",
                f"{self.config.name}/automation: restored enabled={self.automation_enabled} "
                f"targetTemperature={self.target_temperature} "
                f"targetMoisture={self.target_moisture}",
            )

    def _persist_automation_state(self) -> None:
        if not self.state_store:
            return
        self.state_store.update(
            self.config.name,
            {
                "automationEnabled": self.automation_enabled,
                "targetTemperature": self.target_temperature,
                "temperatureHysteresis": self.hysteresis,
                "targetMoisture": self.target_moisture,
                "moistureHysteresis": self.moisture_hysteresis,
            },
        )

    def _safe_telemetry(self, token: str, payload: dict[str, Any], component: str) -> None:
        try:
            self.client.send_telemetry(token, payload)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            log("ERROR", f"{self.config.name}/{component}: telemetry failed: {exc}")

    def _sensor_loop(self) -> None:
        while True:
            if self.config.system_type == "irrigation":
                with self.lock:
                    valve_ratio = self.position / max(self.config.stroke_length, 1)
                    if valve_ratio > 0:
                        self.soil_moisture = min(
                            100.0,
                            self.soil_moisture + self.config.watering_rate * valve_ratio,
                        )
                    else:
                        self.soil_moisture = max(
                            0.0, self.soil_moisture - self.config.drying_rate
                        )
                    moisture = round(self.soil_moisture, 1)
                status = (
                    "dry"
                    if moisture < self.config.moisture_min
                    else "wet"
                    if moisture >= self.config.moisture_max
                    else "optimal"
                )
                self._safe_telemetry(
                    self.config.sensor_token,
                    {
                        "currentSoilMoisture": moisture,
                        "soilMoistureStatus": status,
                    },
                    "sensor",
                )
                self._evaluate_moisture_automation(moisture)
                time.sleep(self.telemetry_interval)
                continue

            temperature = round(
                self.config.temperature
                + random.uniform(-self.config.sensor_variation, self.config.sensor_variation),
                1,
            )
            humidity = round(
                self.config.humidity
                + random.uniform(-self.config.sensor_variation, self.config.sensor_variation),
                1,
            )
            self._safe_telemetry(
                self.config.sensor_token,
                {
                    "currentTemp": temperature,
                    "currentHum": humidity,
                    "tempStatus": "normal",
                    "humStatus": "normal",
                },
                "sensor",
            )
            self._evaluate_automation(temperature)
            time.sleep(self.telemetry_interval)

    def _publish_actuator(self) -> None:
        with self.lock:
            payload = {
                "action": self.action,
                "actionAck": self.action_ack,
                "currentPosition": round(self.position, 2),
                "currentState": self.state,
            }
        self._safe_telemetry(self.config.actuator_token, payload, "actuator")

    def _actuator_loop(self) -> None:
        last_heartbeat = 0.0
        while True:
            now = time.monotonic()
            changed = False
            with self.lock:
                distance = self.target_position - self.position
                if distance:
                    step = self.config.stroke_speed * self.movement_interval
                    delta = max(-step, min(step, distance))
                    self.position += delta
                    changed = True
                    if abs(self.target_position - self.position) < 1e-9:
                        self.position = self.target_position
                        self.state = "open" if self.position > 0 else "closed"
                        self.action_ack = "completed"
                    else:
                        self.state = "opening" if delta > 0 else "closing"
            if changed or now - last_heartbeat >= self.telemetry_interval:
                self._publish_actuator()
                last_heartbeat = now
            time.sleep(self.movement_interval)

    def _apply_command(self, command: str) -> None:
        with self.lock:
            self.action = command
            self.action_ack = "accepted"
            if command == "open":
                self.target_position = self.config.stroke_length
                self.state = "opening"
            elif command == "close":
                self.target_position = 0.0
                self.state = "closing"
            else:
                self.target_position = self.position
                self.state = "stopped"
                self.action_ack = "completed"
        self._publish_actuator()

    def _apply_config(self, params: Any) -> None:
        if not isinstance(params, dict):
            return
        with self.lock:
            length = params.get("strokeLength", params.get("valveOpenPercent"))
            speed = params.get("strokeSpeed", params.get("valveSpeed"))
            if length is not None and float(length) > 0:
                self.config.stroke_length = float(length)
                self.position = min(self.position, self.config.stroke_length)
                self.target_position = min(self.target_position, self.config.stroke_length)
            if speed is not None and float(speed) > 0:
                self.config.stroke_speed = float(speed)

    def _apply_automation_config(self, params: Any) -> None:
        if not isinstance(params, dict):
            return
        with self.lock:
            self.automation_enabled = bool(params.get("enabled", self.automation_enabled))
            target = params.get("targetTemperature")
            hysteresis = params.get("hysteresis")
            if target is not None:
                self.target_temperature = float(target)
            if hysteresis is not None and float(hysteresis) >= 0:
                self.hysteresis = float(hysteresis)
        self._persist_automation_state()
        log(
            "INFO",
            f"{self.config.name}/automation: enabled={self.automation_enabled} "
            f"target={self.target_temperature} hysteresis={self.hysteresis}",
        )

    def _apply_moisture_automation_config(self, params: Any) -> None:
        if not isinstance(params, dict):
            return
        with self.lock:
            self.automation_enabled = bool(params.get("enabled", self.automation_enabled))
            target = params.get("targetMoisture")
            hysteresis = params.get("hysteresis")
            if target is not None:
                self.target_moisture = float(target)
            if hysteresis is not None and float(hysteresis) >= 0:
                self.moisture_hysteresis = float(hysteresis)
            self.config.moisture_max = self.target_moisture
            self.config.moisture_min = self.target_moisture - self.moisture_hysteresis
        self._persist_automation_state()
        log(
            "INFO",
            f"{self.config.name}/automation: enabled={self.automation_enabled} "
            f"moistureMin={self.config.moisture_min} moistureMax={self.config.moisture_max}",
        )

    def _evaluate_automation(self, temperature: float) -> None:
        command = None
        with self.lock:
            if not self.automation_enabled:
                return
            open_threshold = self.target_temperature + self.hysteresis
            if temperature > open_threshold and self.target_position != self.config.stroke_length:
                command = "open"
            elif temperature <= self.target_temperature and self.target_position != 0:
                command = "close"
        if command:
            log(
                "INFO",
                f"{self.config.name}/automation: temperature={temperature}, command={command}",
            )
            self._apply_command(command)

    def _evaluate_moisture_automation(self, moisture: float) -> None:
        command = None
        with self.lock:
            if not self.automation_enabled:
                return
            if moisture < self.target_moisture - self.moisture_hysteresis and self.target_position == 0:
                command = "open"
            elif moisture >= self.target_moisture and self.target_position != 0:
                command = "close"
        if command:
            log(
                "INFO",
                f"{self.config.name}/automation: soilMoisture={moisture}, command={command}",
            )
            self._apply_command(command)

    def _rpc_loop(self) -> None:
        while True:
            try:
                rpc = self.client.wait_for_rpc(self.config.control_token, self.rpc_timeout)
                if not rpc:
                    continue
                method = str(rpc.get("method", ""))
                params = rpc.get("params")
                log("INFO", f"{self.config.name}/control: received {method} {params}")
                self._safe_telemetry(
                    self.config.control_token,
                    {"method": method, "params": params or {}, "action": command_from_rpc(rpc) or self.action},
                    "control",
                )
                command = command_from_rpc(rpc)
                if command:
                    self._apply_command(command)
                elif method in {"setActuatorConfig", "configureActuator", "setIrrigationConfig"}:
                    self._apply_config(params)
                elif method == "setAutomationConfig":
                    self._apply_automation_config(params)
                elif method == "setMoistureAutomationConfig":
                    self._apply_moisture_automation_config(params)
                else:
                    log("WARNING", f"{self.config.name}/control: unsupported RPC method {method}")
            except urllib.error.HTTPError as exc:
                log("ERROR", f"{self.config.name}/control: RPC HTTP {exc.code} {exc.reason}")
                time.sleep(2)
            except (urllib.error.URLError, TimeoutError) as exc:
                log("WARNING", f"{self.config.name}/control: RPC wait failed: {exc}")
                time.sleep(1)
            except Exception as exc:  # pragma: no cover
                log("ERROR", f"{self.config.name}/control: unexpected RPC error: {exc}")
                time.sleep(2)

    def start(self) -> None:
        log("INFO", f"starting system {self.config.name}")
        for target, suffix in (
            (self._sensor_loop, "sensor"),
            (self._actuator_loop, "actuator"),
            (self._rpc_loop, "control"),
        ):
            threading.Thread(
                target=target,
                name=f"{self.config.name}-{suffix}",
                daemon=True,
            ).start()


def load_config(path: pathlib.Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"config file not found at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def positive(raw: Any, name: str) -> float:
    value = float(raw)
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


def parse_system(raw: dict[str, Any], index: int) -> SystemConfig:
    def token(component: str) -> str:
        value = str(raw.get(component, {}).get("token", "")).strip()
        if not value:
            raise ValueError(f"systems[{index}].{component}.token is required")
        return value

    sensor = raw.get("sensor", {})
    actuator = raw.get("actuator", {})
    system_type = str(raw.get("type", "climate"))
    if system_type not in {"climate", "irrigation"}:
        raise ValueError(f"systems[{index}].type must be climate or irrigation")
    return SystemConfig(
        name=str(raw.get("name") or f"system-{index + 1}"),
        system_type=system_type,
        sensor_token=token("sensor"),
        control_token=token("control"),
        actuator_token=token("actuator"),
        temperature=float(sensor.get("temperature", 24)),
        humidity=float(sensor.get("humidity", 55)),
        sensor_variation=float(sensor.get("variation", 0.3)),
        stroke_length=positive(
            actuator.get("strokeLength", actuator.get("valveOpenPercent", 250 if system_type == "climate" else 100)),
            "strokeLength/valveOpenPercent",
        ),
        stroke_speed=positive(
            actuator.get("strokeSpeed", actuator.get("valveSpeed", 3 if system_type == "climate" else 20)),
            "strokeSpeed/valveSpeed",
        ),
        initial_position=float(actuator.get("initialPosition", 0)),
        soil_moisture=float(sensor.get("soilMoisture", 45)),
        moisture_min=float(sensor.get("moistureMin", 35)),
        moisture_max=float(sensor.get("moistureMax", 65)),
        watering_rate=float(sensor.get("wateringRate", 2)),
        drying_rate=float(sensor.get("dryingRate", 0.5)),
    )


def main() -> int:
    config_path = pathlib.Path(os.environ.get("MOCK_CONFIG_FILE", DEFAULT_CONFIG_FILE))
    try:
        raw = load_config(config_path)
        systems = [parse_system(item, index) for index, item in enumerate(raw.get("systems", []))]
        if not systems:
            raise ValueError("config must contain at least one system")
        client = ThingsBoardHttpClient(
            str(raw.get("api_base_url", DEFAULT_API_BASE_URL)),
            positive(raw.get("request_timeout_seconds", 5), "request_timeout_seconds"),
        )
        telemetry_interval = positive(raw.get("telemetry_interval_seconds", 10), "telemetry_interval_seconds")
        movement_interval = positive(raw.get("movement_interval_seconds", 1), "movement_interval_seconds")
        rpc_timeout = int(positive(raw.get("rpc_timeout_seconds", 30), "rpc_timeout_seconds"))
        state_path = pathlib.Path(os.environ.get("MOCK_STATE_FILE", DEFAULT_STATE_FILE))
        state_store = RuntimeStateStore(state_path)
    except (FileNotFoundError, json.JSONDecodeError, TypeError, ValueError) as exc:
        log("ERROR", str(exc))
        return 1

    for system in systems:
        GreenhouseSystemEmulator(
            system,
            client,
            telemetry_interval,
            movement_interval,
            rpc_timeout,
            state_store,
        ).start()
    while True:
        time.sleep(60)


if __name__ == "__main__":
    sys.exit(main())
