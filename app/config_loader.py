from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional


LOGGER = logging.getLogger(__name__)
APP_ROOT = Path(__file__).resolve().parent
REPO_ROOT = APP_ROOT.parent


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


def _read_secrets() -> dict[str, str]:
    secret_path = os.environ.get("EFT_SECRET_PATH")
    path = Path(secret_path) if secret_path else REPO_ROOT / "secrets.json"
    if not path.exists():
        LOGGER.warning("secrets.json not found at %s", path)
        return {}
    try:
        data = json.loads(path.read_text())
    except Exception:
        LOGGER.warning("failed to parse secrets file at %s", path)
        return {}
    return {str(k): str(v) for k, v in data.items()}


def get_config_value(key: str) -> Optional[str]:
    if key in os.environ:
        return os.environ.get(key)
    dotenv_values = _read_dotenv()
    if key in dotenv_values:
        return dotenv_values.get(key)
    secrets = _read_secrets()
    if key in secrets:
        return secrets.get(key)
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
