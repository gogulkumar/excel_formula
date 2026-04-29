"""CalcSense LLM Client — OpenAI-first LangChain model abstraction."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Generator, Iterable, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from config_loader import get_config_value


Message = dict[str, str]
UsageDict = dict[str, int | str]


class LLMClient:
    """LangChain-based LLM client for CalcSense.

    The active product path is OpenAI-compatible only. Legacy Claude-style
    helper methods remain as compatibility wrappers but resolve through the
    OpenAI client so the rest of the app stays on a single provider path.
    """

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

        # Resolve endpoints and keys
        self.openai_url = self._resolve_endpoint(
            exact_key="EFT_OPENAI_PROXY_URL",
            path_key="EFT_OPENAI_PROXY_PATH",
            default_path="/v1/proxy/azure-openai",
        )
        self.bedrock_url = ""
        self.api_key = self._resolve_api_key()
        self.authorization = self._resolve_authorization()

    def _resolve_api_key(self) -> str:
        return (
            get_config_value("EFT_PROXY_API_KEY")
            or get_config_value("OPENAI_API_KEY")
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

    def _resolve_endpoint(self, exact_key: str, path_key: str, default_path: str) -> str:
        exact = get_config_value(exact_key)
        if exact:
            return exact.rstrip("/")
        direct_openai = get_config_value("OPENAI_BASE_URL") or get_config_value("OPENAI_API_BASE_URL")
        if exact_key == "EFT_OPENAI_PROXY_URL" and direct_openai:
            return direct_openai.rstrip("/")
        host = get_config_value("LLM_PROXY_HOST")
        scheme = get_config_value("LLM_PROXY_SCHEME") or "https"
        path = get_config_value(path_key) or default_path
        if not host:
            return ""
        return f"{scheme}://{host}{path}"

    # ─── Model Factory ───────────────────────────────────────────────────

    def get_openai_model(
        self,
        model: str = "gpt-4.1-2025-04-14",
        temperature: float = 0.0,
        max_tokens: int = 3000,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Return a ChatOpenAI model."""
        from langchain_openai import ChatOpenAI

        kwargs: dict[str, Any] = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "streaming": streaming,
            "request_timeout": self.timeout,
        }

        # Direct OpenAI API key
        openai_key = get_config_value("OPENAI_API_KEY") or ""
        if openai_key:
            kwargs["api_key"] = openai_key
            if self.openai_url and not self.openai_url.startswith("https://api.openai.com"):
                kwargs["base_url"] = self.openai_url
        elif self.openai_url:
            # Proxy-based auth
            kwargs["base_url"] = self.openai_url
            kwargs["api_key"] = "proxy"
            kwargs["default_headers"] = {
                "Authorization": self.authorization,
                "x-client-app": self.app_name,
            }

        return ChatOpenAI(**kwargs)

    def get_anthropic_model(
        self,
        model: str = "gpt-4.1-2025-04-14",
        temperature: float = 0.1,
        max_tokens: int = 3000,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Compatibility wrapper that resolves to the OpenAI model path."""
        return self.get_openai_model(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=streaming,
        )

    # ─── Call / Stream Methods ───────────────────────────────────────────

    @staticmethod
    def _messages_to_langchain(
        messages: Iterable[Message], system_prompt: str = ""
    ) -> list[BaseMessage]:
        lc_messages: list[BaseMessage] = []
        if system_prompt:
            lc_messages.append(SystemMessage(content=system_prompt))
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                lc_messages.append(SystemMessage(content=content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))
            else:
                lc_messages.append(HumanMessage(content=content))
        return lc_messages

    def call_openai(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.0,
        on_delta: Optional[Callable[[str], None]] = None,
    ) -> UsageDict:
        lc_model = self.get_openai_model(model=model, temperature=temperature, max_tokens=max_tokens)
        lc_messages = self._messages_to_langchain(messages, system_prompt)
        result = lc_model.invoke(lc_messages)

        text = result.content if isinstance(result.content, str) else str(result.content)
        if on_delta and text:
            on_delta(text)

        usage = getattr(result, "usage_metadata", None) or {}
        return {
            "response_text": text,
            "input_tokens": getattr(usage, "input_tokens", 0) if usage else 0,
            "output_tokens": getattr(usage, "output_tokens", 0) if usage else 0,
            "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
        }

    def stream_openai(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.0,
        prompt_kind: str = "explain",
    ) -> Generator[str | UsageDict, None, None]:
        lc_model = self.get_openai_model(model=model, temperature=temperature, max_tokens=max_tokens, streaming=True)
        lc_messages = self._messages_to_langchain(messages, system_prompt)

        full_text = ""
        for chunk in lc_model.stream(lc_messages):
            token = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
            if token:
                full_text += token
                yield token

        yield {"response_text": full_text, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    def call_claude(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.1,
    ) -> UsageDict:
        return self.call_openai(
            model=model,
            messages=messages,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    def stream_claude(
        self,
        model: str,
        messages: Iterable[Message],
        system_prompt: str = "",
        max_tokens: int = 3000,
        temperature: float = 0.1,
    ) -> Generator[str | UsageDict, None, None]:
        yield from self.stream_openai(
            model=model,
            messages=messages,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

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
