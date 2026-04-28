from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional


APP_ROOT = Path(__file__).resolve().parent
REPO_ROOT = APP_ROOT.parent
_env_cache: dict[str, str] | None = None


def _strip_wrapping_quotes(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
        return cleaned[1:-1]
    return cleaned


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
        values[key.strip()] = _strip_wrapping_quotes(value)
    return values


def _read_json_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text())
    except Exception:
        return {}
    if not isinstance(payload, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in payload.items():
        if isinstance(key, str) and value is not None:
            out[key] = str(value)
    return out


def _load_merged_config() -> dict[str, str]:
    merged: dict[str, str] = {}

    # Lowest priority: local secrets file at repo root.
    merged.update(_read_json_file(REPO_ROOT / "secrets.json"))

    # Optional vault/secrets path from env.
    secret_path = os.environ.get("EFT_SECRET_PATH")
    if secret_path:
        merged.update(_read_json_file(Path(secret_path).expanduser()))

    # Project .env overrides secrets sources.
    merged.update(_read_dotenv())
    return merged


def _get_cache() -> dict[str, str]:
    global _env_cache
    if _env_cache is None:
        _env_cache = _load_merged_config()
    return _env_cache


def get_config_value(key: str) -> Optional[str]:
    if key in os.environ:
        return os.environ.get(key)
    return _get_cache().get(key)


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
