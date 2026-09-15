"""Keyless boot tests for the production exe and development nulu carrier.

Each carrier skips independently when absent. The dummy API key only satisfies
adapter loading; initialize and shutdown do not call a model.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nulu_harness import NuluHarness, HarnessClient, HarnessConfig
from nulu_harness.errors import JsonRpcError, TransportClosedError
from nulu_harness_runtime import RUNTIME_MODE_ENV_VAR, resolve_bundled_launch_args

_MODES = ("exe", "node")


def _select_mode(mode: str, monkeypatch: pytest.MonkeyPatch) -> None:
    try:
        resolve_bundled_launch_args(mode)
    except FileNotFoundError as exc:
        pytest.skip(f"bundled {mode}-mode runtime unavailable on this machine: {exc}")
    monkeypatch.setenv(RUNTIME_MODE_ENV_VAR, mode)


def _client(tmp_path: Path, mode: str, monkeypatch: pytest.MonkeyPatch, *patches: Path) -> HarnessClient:
    _select_mode(mode, monkeypatch)
    return HarnessClient(
        HarnessConfig(
            nulu_home=str(tmp_path / "home"),
            patches=tuple(str(patch) for patch in patches),
            cwd=str(tmp_path),
            env={
                # The lazily mounted adapter requires a key even without a model call.
                "WORLD_APP_TECHNOLOGIES_API_KEY": "sk-dummy-for-boot",
                "WORLD_APP_TECHNOLOGIES_BASE_URL": "http://127.0.0.1:9",
                "NULU_PERMISSION_MODE": "danger-full-access",
                "NULU_TELEMETRY_DISABLED": "1",
            },
            request_timeout_seconds=120,
        )
    )


@pytest.mark.parametrize("mode", _MODES)
def test_bundled_runtime_boots_the_sdk_profile(
    tmp_path: Path, mode: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    with _client(tmp_path, mode, monkeypatch) as client:
        init = client.initialize(provider="worldapp-gateway", cwd=str(tmp_path), model="nulu-5-ultra")

    assert init.serverInfo is not None
    assert init.serverInfo.name == "nulu-harness-sdk-runtime"
    profile = json.loads((tmp_path / "home" / "profiles" / "sdk" / "package.json").read_text())
    assert profile["nulu"]["profile"]["bundles"] == [
        "@worldapptechnologies/nulu-base",
        "@worldapptechnologies/nulu-sdk-app",
    ]


@pytest.mark.parametrize("mode", _MODES)
def test_python_sdk_applies_an_ordered_profile_patch(
    tmp_path: Path, mode: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _select_mode(mode, monkeypatch)
    patch = tmp_path / "persona.patch.yml"
    patch.write_text(json.dumps([{
        "id": "system-prompt",
        "config": {"persona": "Python SDK ordered patch marker."},
    }]))
    harness = NuluHarness(
        model="nulu-5-ultra",
        cwd=str(tmp_path),
        nulu_home=str(tmp_path / "home"),
        patches=(str(patch),),
        env={"NULU_PERMISSION_MODE": "danger-full-access"},
        api_key="sk-dummy-for-boot",
        base_url="http://127.0.0.1:9",
        request_timeout_seconds=120,
    )

    with harness:
        pass


@pytest.mark.parametrize("mode", _MODES)
def test_bundled_runtime_surfaces_unbundled_plugin_failure(
    tmp_path: Path, mode: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    patch = tmp_path / "missing.patch.yml"
    patch.write_text(json.dumps([{
        "insert": [{"id": "missing", "name": "@worldapptechnologies/nulu-does-not-exist"}],
    }]))

    client = _client(tmp_path, mode, monkeypatch, patch)
    client.start()
    try:
        with pytest.raises((JsonRpcError, TransportClosedError, TimeoutError)) as excinfo:
            client.initialize(provider="worldapp-gateway", cwd=str(tmp_path), model="nulu-5-ultra")
    finally:
        client.close()

    assert "@worldapptechnologies/nulu-does-not-exist" in str(excinfo.value)
