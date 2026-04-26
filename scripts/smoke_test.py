from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
from openpyxl import Workbook


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "app" / "backend"
PYTHON_BIN = REPO_ROOT / ".venv" / "bin" / "python"
BACKEND_URL = "http://127.0.0.1:8000"


def wait_for_ping(base_url: str, timeout_s: float = 20.0) -> None:
    deadline = time.time() + timeout_s
    last_error = None
    while time.time() < deadline:
        try:
            response = httpx.get(f"{base_url}/ping", timeout=2.0)
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") == "ok":
                return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"backend did not start in time: {last_error}")


def parse_sse_text(text: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


def build_workbook(path: Path) -> None:
    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    summary["A1"] = "Metric"
    summary["B1"] = "Value"
    summary["A2"] = "Revenue"
    summary["B2"] = "=Revenue!B5+Revenue!C5"
    summary["A3"] = "Expenses"
    summary["B3"] = "=Revenue!D5"
    summary["A4"] = "Profit"
    summary["B4"] = "=B2-B3"

    revenue = wb.create_sheet("Revenue")
    revenue["A1"] = "Quarter"
    revenue["B1"] = "Q1"
    revenue["C1"] = "Q2"
    revenue["D1"] = "Costs"
    revenue["A2"] = "North"
    revenue["A3"] = "South"
    revenue["A4"] = "West"
    revenue["B2"] = 100
    revenue["B3"] = 150
    revenue["B4"] = 175
    revenue["C2"] = 110
    revenue["C3"] = 160
    revenue["C4"] = 165
    revenue["D2"] = 80
    revenue["D3"] = 90
    revenue["D4"] = 95
    revenue["A5"] = "Totals"
    revenue["B5"] = "=SUM(B2:B4)"
    revenue["C5"] = "=SUM(C2:C4)"
    revenue["D5"] = "=SUM(D2:D4)"

    wb.save(path)


def wait_for_task(base_url: str, task_id: str, timeout_s: float = 30.0) -> str:
    deadline = time.time() + timeout_s
    chunks: list[str] = []
    while time.time() < deadline:
        payload = httpx.get(f"{base_url}/api/task/{task_id}", timeout=5.0).json()
        if payload["full_text"]:
            chunks = [payload["full_text"]]
        if payload["status"] in {"done", "cancelled"}:
            return "".join(chunks)
        if payload["status"] == "error":
            raise RuntimeError(f"task failed: {payload}")
        time.sleep(0.3)
    raise RuntimeError(f"task {task_id} did not finish in time")


def run_smoke(base_url: str, include_llm: bool) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_root = Path(tmpdir)
        workbook_path = tmp_root / "smoke.xlsx"
        build_workbook(workbook_path)
        with workbook_path.open("rb") as fh:
            response = httpx.post(
                f"{base_url}/api/upload",
                files={"file": (workbook_path.name, fh, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                timeout=30.0,
            )
        response.raise_for_status()
        upload_events = parse_sse_text(response.text)
        done_event = next((event for event in upload_events if event.get("done")), None)
        assert done_event, f"upload did not complete: {upload_events}"
        file_id = str(done_event["file_id"])

        files = httpx.get(f"{base_url}/api/files", timeout=10.0).json()
        assert any(entry["file_id"] == file_id for entry in files), files

        file_detail = httpx.get(f"{base_url}/api/files/{file_id}", timeout=10.0).json()
        assert file_detail["filename"] == "smoke.xlsx", file_detail

        status = httpx.get(f"{base_url}/api/status", timeout=10.0).json()
        assert "ready" in status, status

        sheet_events = parse_sse_text(httpx.get(f"{base_url}/api/sheet-stream/{file_id}/Summary", timeout=30.0).text)
        sheet_payload = next((event for event in sheet_events if event.get("done")), None)
        assert sheet_payload and sheet_payload["data"]["headers"][:2] == ["A", "B"], sheet_events

        trace = httpx.post(
            f"{base_url}/api/trace",
            json={"file_id": file_id, "sheet": "Summary", "cell": "B4"},
            timeout=10.0,
        ).json()["trace_tree"]
        assert trace["formula"] == "=B2-B3", trace
        assert len(trace["deps"]) == 2, trace

        trace_up = httpx.post(
            f"{base_url}/api/trace-up",
            json={"file_id": file_id, "sheet": "Revenue", "cell": "B5"},
            timeout=10.0,
        ).json()["trace_tree"]
        assert any(dep["cell"] == "B2" and dep["sheet"] == "Summary" for dep in trace_up["deps"]), trace_up

        tables = httpx.get(f"{base_url}/api/tables/{file_id}/Revenue", timeout=10.0).json()
        assert tables, tables

        table_trace = httpx.post(
            f"{base_url}/api/table-trace",
            json={"file_id": file_id, "sheet": "Revenue", "range": "A1:D5"},
            timeout=10.0,
        ).json()
        assert table_trace["total_formulas"] >= 3, table_trace

        top_metrics = httpx.get(f"{base_url}/api/top-metrics/{file_id}?min_refs=1", timeout=10.0).json()
        assert any(metric["cell"] == "B4" and metric["sheet"] == "Summary" for metric in top_metrics["metrics"]), top_metrics

        top_metric_trace = httpx.post(
            f"{base_url}/api/top-metrics/{file_id}/trace/Summary/B4",
            timeout=10.0,
        ).json()
        assert "trace" in top_metric_trace and "formula_text" in top_metric_trace, top_metric_trace

        if include_llm:
            explain_start = httpx.post(
                f"{base_url}/api/explain",
                json={"trace": trace, "file_id": file_id, "sheet": "Summary", "cell": "B4", "regenerate": True},
                timeout=30.0,
            ).json()
            assert explain_start.get("task_id"), explain_start
            explain_text = wait_for_task(base_url, explain_start["task_id"])
            assert explain_text, explain_text
            cached = httpx.get(f"{base_url}/api/explanations/{file_id}/Summary/B4", timeout=10.0).json()
            assert "analyst" in cached and cached["analyst"], cached
            business_start = httpx.post(
                f"{base_url}/api/business-summary",
                json={"trace": trace, "file_id": file_id, "sheet": "Summary", "cell": "B4", "regenerate": True},
                timeout=30.0,
            ).json()
            assert business_start.get("task_id"), business_start
            business_text = wait_for_task(base_url, business_start["task_id"])
            assert business_text, business_text

        reload_payload = httpx.post(f"{base_url}/api/reload/{file_id}?sheet=Summary", timeout=10.0).json()
        assert reload_payload["ok"] is True, reload_payload

        cleanup = httpx.delete(f"{base_url}/api/files/{file_id}", timeout=10.0).json()
        assert cleanup["ok"] is True, cleanup


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=BACKEND_URL)
    parser.add_argument("--spawn-server", action="store_true")
    parser.add_argument("--include-llm", action="store_true")
    args = parser.parse_args()

    server: subprocess.Popen[str] | None = None
    try:
        if args.spawn_server:
            env = os.environ.copy()
            env.setdefault("PYTHONPATH", str(REPO_ROOT / "app"))
            env.setdefault("EFT_LLM_MODE", "mock")
            server = subprocess.Popen(
                [str(PYTHON_BIN), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
                cwd=BACKEND_DIR,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            wait_for_ping(args.base_url)
            run_smoke(args.base_url, args.include_llm)
            print("smoke test passed")
            return 0
        wait_for_ping(args.base_url)
        run_smoke(args.base_url, args.include_llm)
        print("smoke test passed")
        return 0
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    raise SystemExit(main())
