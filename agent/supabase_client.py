"""Cliente HTTP mínimo para Supabase (REST con la service_role key)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        self._client = httpx.Client(timeout=60.0)

    def sync_snapshot(self, rows: list[dict], agent_version: str) -> dict:
        """Manda la foto completa del catálogo en una sola llamada. Lanza si falla."""
        r = self._client.post(
            f"{self.url}/rest/v1/rpc/sync_eleventa_snapshot",
            json={"p_rows": rows, "p_agent_version": agent_version},
            headers=self.headers,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Supabase respondió {r.status_code}: {r.text[:300]}")
        return r.json()

    def report_status(self, status: str) -> None:
        """Marca el agente como online/offline (p. ej. cuando no puede leer Eleventa)."""
        try:
            self._client.patch(
                f"{self.url}/rest/v1/sync_config",
                params={"id": "eq.1"},
                json={"agent_status": status, "last_heartbeat": datetime.now(timezone.utc).isoformat()},
                headers={**self.headers, "Prefer": "return=minimal"},
                timeout=10.0,
            )
        except httpx.HTTPError as e:
            logger.warning("No se pudo reportar estado '%s': %s", status, e)

    def log_error(self, message: str) -> None:
        try:
            self._client.post(
                f"{self.url}/rest/v1/sync_log",
                json={"products_synced": 0, "errors": 1, "notes": message[:1000]},
                headers={**self.headers, "Prefer": "return=minimal"},
                timeout=10.0,
            )
        except httpx.HTTPError:
            pass

    def close(self) -> None:
        self._client.close()
