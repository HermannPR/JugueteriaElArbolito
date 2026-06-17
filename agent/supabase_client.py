"""Cliente HTTP para Supabase (REST API con service_role key)."""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        self._client = httpx.Client(timeout=15.0)

    def is_online(self) -> bool:
        try:
            r = self._client.get(f"{self.url}/rest/v1/", headers=self.headers, timeout=5.0)
            return r.status_code < 500
        except Exception:
            return False

    def upsert_eleventa_catalog(self, rows: list[dict]) -> bool:
        """Upsert en eleventa_catalog por 'clave'."""
        if not rows:
            return True
        try:
            r = self._client.post(
                f"{self.url}/rest/v1/eleventa_catalog",
                json=rows,
                headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            if r.status_code in (200, 201, 204):
                return True
            logger.error("upsert_eleventa_catalog error %d: %s", r.status_code, r.text[:200])
            return False
        except Exception as e:
            logger.error("upsert_eleventa_catalog excepción: %s", e)
            return False

    def update_product_stock(self, eleventa_sku: str, stock: int) -> bool:
        """Actualiza stock en products donde eleventa_sku coincide y price_overridden=false."""
        try:
            r = self._client.patch(
                f"{self.url}/rest/v1/products",
                json={"stock": stock, "updated_at": _now()},
                headers={**self.headers, "Prefer": "return=minimal"},
                params={"eleventa_sku": f"eq.{eleventa_sku}", "is_active": "eq.true"},
            )
            return r.status_code in (200, 204)
        except Exception as e:
            logger.error("update_product_stock excepción para %s: %s", eleventa_sku, e)
            return False

    def update_product_price(self, eleventa_sku: str, price: float) -> bool:
        """Actualiza precio solo si price_overridden=false."""
        try:
            r = self._client.patch(
                f"{self.url}/rest/v1/products",
                json={"price": price, "updated_at": _now()},
                headers={**self.headers, "Prefer": "return=minimal"},
                params={
                    "eleventa_sku": f"eq.{eleventa_sku}",
                    "price_overridden": "eq.false",
                    "is_active": "eq.true",
                },
            )
            return r.status_code in (200, 204)
        except Exception as e:
            logger.error("update_product_price excepción para %s: %s", eleventa_sku, e)
            return False

    def update_heartbeat(self, pending_count: int, last_sync_products: int) -> bool:
        try:
            r = self._client.patch(
                f"{self.url}/rest/v1/sync_config",
                json={
                    "last_heartbeat": _now(),
                    "agent_status": "online",
                    "pending_queue_count": pending_count,
                    "last_sync_products": last_sync_products,
                },
                headers={**self.headers, "Prefer": "return=minimal"},
                params={"id": "eq.1"},
            )
            return r.status_code in (200, 204)
        except Exception as e:
            logger.warning("heartbeat excepción: %s", e)
            return False

    def mark_agent_offline(self):
        try:
            self._client.patch(
                f"{self.url}/rest/v1/sync_config",
                json={"agent_status": "offline", "last_heartbeat": _now()},
                headers={**self.headers, "Prefer": "return=minimal"},
                params={"id": "eq.1"},
            )
        except Exception:
            pass

    def get_sync_config(self) -> dict[str, Any]:
        try:
            r = self._client.get(
                f"{self.url}/rest/v1/sync_config",
                headers={**self.headers, "Prefer": "return=representation"},
                params={"id": "eq.1", "limit": "1"},
            )
            data = r.json()
            return data[0] if data else {}
        except Exception:
            return {}

    def insert_sync_log(self, products_synced: int, errors: int, duration_s: float, notes: str = ""):
        try:
            self._client.post(
                f"{self.url}/rest/v1/sync_log",
                json={
                    "products_synced": products_synced,
                    "errors": errors,
                    "duration_seconds": round(duration_s, 2),
                    "notes": notes,
                    "synced_at": _now(),
                },
                headers=self.headers,
            )
        except Exception:
            pass

    def close(self):
        self._client.close()


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
