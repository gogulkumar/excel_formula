from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


APP_ROOT = Path(__file__).resolve().parent


def _read_dotenv() -> dict[str, str]:
    env_path = APP_ROOT / ".env"
    if not env_path.exists():
        return {}
    values: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def get_config_value(key: str) -> Optional[str]:
    if key in os.environ:
        return os.environ.get(key)
    dotenv_values = _read_dotenv()
    if key in dotenv_values:
        return dotenv_values.get(key)
    return None


def get_config_bool(key: str, default: bool = False) -> bool:
    value = get_config_value(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_config_int(key: str, default: int) -> int:
    value = get_config_value(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default
