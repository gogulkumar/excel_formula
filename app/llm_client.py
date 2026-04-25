from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Generator, Iterable, Optional

import httpx

from config_loader import get_config_bool, get_config_value


Message = dict[str, str]
UsageDict = dict[str, int | str]


class LLMClient:
    def __init__(
        self,
        api_env: str = "test",
        timeout: float = 24000.0,
        certificate_path: Optional[str] = None,
        app_name: str = "excel-formula-tracer",
        aws_region: str = "us-east-1",
    ) -> None:
        self.api_env = api_env
        self.timeout = timeout
        self.app_name = app_name
        self.aws_region = aws_region
        self.runtime = (get_config_value("EFT_RUNTIME") or "local").lower()
        self.model_mode = (get_config_value("EFT_LLM_MODE") or "").strip().lower()
        self.api_key = self._resolve_api_key()
        self.authorization = self._resolve_authorization()
        self.verify = self._resolve_verify(certificate_path)
        self.openai_url = self._resolve_endpoint(
            exact_key="EFT_OPENAI_PROXY_URL",
            path_key="EFT_OPENAI_PROXY_PATH",
            default_path="/v1/proxy/azure-openai",
        )
        self.bedrock_url = self._resolve_endpoint(
            exact_key="EFT_BEDROCK_PROXY_URL",
            path_key="EFT_BEDROCK_PROXY_PATH",
            default_path="/v1/proxy/bedrock",
        )

    @property
    def is_mock_mode(self) -> bool:
        if self.model_mode == "mock":
            return True
        return not bool(self.authorization and self.openai_url)

    def _resolve_api_key(self) -> str:
        return (
            get_config_value("EFT_PROXY_API_KEY")
            or get_config_value(f"{self.api_env}_apikey")
            or ""
        )

    def _resolve_authorization(self) -> str:
        token = get_config_value("EFT_PROXY_AUTH_TOKEN")
        if token:
            return token
        if self.api_key:
            return f"Basic {self.api_key}"
        return ""

    def _resolve_verify(self, certificate_path: Optional[str]) -> str | bool:
        path = certificate_path or get_config_value("EFT_SSL_CERT")
        if path:
            candidate = Path(path)
            if candidate.exists():
                return str(candidate)
        default_cert = Path(__file__).resolve().parent / "certificates" / "proxy-certificate.crt"
        if default_cert.exists() and default_cert.read_text().strip():
            return str(default_cert)
        return not get_config_bool("EFT_SKIP_SSL_VERIFY", False)

    def _resolve_endpoint(self, exact_key: str, path_key: str, default_path: str) -> str:
        exact = get_config_value(exact_key)
        if exact:
            return exact.rstrip("/")
        host = get_config_value("LLM_PROXY_HOST")
        scheme = get_config_value("LLM_PROXY_SCHEME") or "https"
        path = get_config_value(path_key) or default_path
        if not host:
            return ""
        return f"{scheme}://{host}{path}"

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "x-client-app": self.app_name,
        }
        if self.authorization:
            headers["Authorization"] = self.authorization
        return headers

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=self.timeout, verify=self.verify)

    def _extract_text_from_payload(self, payload: dict) -> str:
        if isinstance(payload.get("response_text"), str):
            return payload["response_text"]
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            choice = choices[0]
            message = choice.get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                texts = [item.get("text", "") for item in content if isinstance(item, dict)]
                return "".join(texts)
            delta = choice.get("delta", {})
            if isinstance(delta.get("content"), str):
                return delta["content"]
        output = payload.get("output")
        if isinstance(output, list):
            parts: list[str] = []
            for item in output:
                if not isinstance(item, dict):
                    continue
                content = item.get("content")
                if isinstance(content, list):
                    for sub in content:
                        if isinstance(sub, dict) and isinstance(sub.get("text"), str):
                            parts.append(sub["text"])
            return "".join(parts)
        content = payload.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(item.get("text", "") for item in content if isinstance(item, dict))
        return ""

    def _extract_usage(self, payload: dict) -> UsageDict:
        usage = payload.get("usage", {}) if isinstance(payload.get("usage"), dict) else {}
        input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or payload.get("input_tokens") or 0
        output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or payload.get("output_tokens") or 0
        total_tokens = usage.get("total_tokens") or payload.get("total_tokens") or (input_tokens + output_tokens)
        return {
            "response_text": self._extract_text_from_payload(payload),
            "input_tokens": int(input_tokens),
            "output_tokens": int(output_tokens),
            "total_tokens": int(total_tokens),
        }

    def _post_json(self, url: str, payload: dict) -> dict:
        with self._client() as client:
            response = client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            return response.json()

    def _iter_stream_events(self, response: httpx.Response) -> Generator[dict | str, None, None]:
        for line in response.iter_lines():
            if not line:
                continue
            text = line.decode() if isinstance(line, bytes) else line
            if text.startswith("data: "):
                text = text[6:].strip()
                if text == "[DONE]":
                    continue
                try:
                    yield json.loads(text)
                except json.JSONDecodeError:
                    yield text
                continue
            try:
                yield json.loads(text)
            except json.JSONDecodeError:
                yield text

    def _stream_json(
        self,
        url: str,
        payload: dict,
        on_delta: Optional[Callable[[str], None]] = None,
    ) -> Generator[str | UsageDict, None, None]:
        with self._client() as client:
            with client.stream("POST", url, headers=self._headers(), json=payload) as response:
                response.raise_for_status()
                output_parts: list[str] = []
                usage: UsageDict = {
                    "response_text": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                }
                for event in self._iter_stream_events(response):
                    if isinstance(event, str):
                        if event:
                            output_parts.append(event)
                            if on_delta:
                                on_delta(event)
                            yield event
                        continue
                    chunk = self._extract_text_from_payload(event)
                    if chunk:
                        output_parts.append(chunk)
                        if on_delta:
                            on_delta(chunk)
                        yield chunk
                    if isinstance(event.get("usage"), dict) or "input_tokens" in event or "output_tokens" in event:
                        usage = self._extract_usage(event)
                final_text = "".join(output_parts)
                usage["response_text"] = final_text
                yield usage

    def _mock_completion(self, prompt_kind: str, messages: Iterable[Message]) -> str:
        latest = next((msg["content"] for msg in reversed(list(messages)) if msg.get("role") == "user"), "")
        if prompt_kind == "business":
            return (
                "## What is this metric?\n\n"
                "This is a locally generated placeholder summary because the LLM proxy is not configured yet.\n\n"
                "## How is it calculated?\n\n"
                "The metric rolls up workbook dependencies and describes them at a business level once the real proxy is available.\n\n"
                "## Base inputs\n\n"
                "- **Workbook inputs** — raw values sourced from the uploaded spreadsheet.\n"
            )
        if prompt_kind == "optimize":
            return (
                "I am running in local mock mode, so this optimization verdict is a placeholder.\n\n"
                "```json\n"
                '{"verdict":"keep","reason":"LLM proxy is not configured yet, so no optimization analysis was performed."}\n'
                "```"
            )
        return (
            "This is a locally generated placeholder explanation because the LLM proxy is not configured.\n\n"
            "---FORMULA---\n\n"
            f"[Uploaded Metric] = [Awaiting real proxy]\n\nSource excerpt length: {len(latest)}"
        )

    def call_openai(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.0,
        on_delta: Optional[Callable[[str], None]] = None,
    ) -> UsageDict:
        messages_list = list(messages)
        if self.is_mock_mode:
            text = self._mock_completion("explain", messages_list)
            if on_delta:
                on_delta(text)
            return {
                "response_text": text,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }
        payload = {
            "model": model,
            "messages": ([{"role": "system", "content": system_prompt}] if system_prompt else []) + messages_list,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        data = self._post_json(self.openai_url, payload)
        result = self._extract_usage(data)
        if on_delta and result["response_text"]:
            on_delta(str(result["response_text"]))
        return result

    def stream_openai(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.0,
        prompt_kind: str = "explain",
    ) -> Generator[str | UsageDict, None, None]:
        messages_list = list(messages)
        if self.is_mock_mode:
            text = self._mock_completion(prompt_kind, messages_list)
            yield text
            yield {
                "response_text": text,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }
            return
        payload = {
            "model": model,
            "stream": True,
            "messages": ([{"role": "system", "content": system_prompt}] if system_prompt else []) + messages_list,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        yield from self._stream_json(self.openai_url, payload)

    def call_claude(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.1,
    ) -> UsageDict:
        messages_list = list(messages)
        if self.is_mock_mode or not self.bedrock_url:
            return {
                "response_text": self._mock_completion("business", messages_list),
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }
        payload = {
            "model": model,
            "messages": messages_list,
            "system": system_prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        data = self._post_json(self.bedrock_url, payload)
        return self._extract_usage(data)

    def stream_claude(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.1,
    ) -> Generator[str | UsageDict, None, None]:
        messages_list = list(messages)
        if self.is_mock_mode or not self.bedrock_url:
            text = self._mock_completion("business", messages_list)
            yield text
            yield {
                "response_text": text,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }
            return
        payload = {
            "model": model,
            "stream": True,
            "messages": messages_list,
            "system": system_prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        yield from self._stream_json(self.bedrock_url, payload)

    def transcribe_audio(
        self,
        file_bytes: bytes,
        filename: str,
        language: str | None = None,
        initial_prompt: str | None = None,
    ) -> str:
        supported = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}
        suffix = Path(filename).suffix.lower()
        if suffix not in supported:
            raise ValueError(f"Unsupported audio format: {suffix or filename}")
        if not file_bytes:
            return ""
        return ""
