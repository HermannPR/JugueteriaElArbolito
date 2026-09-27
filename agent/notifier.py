"""Notificaciones de estado del agente vía ntfy (canal de Hivemind).

Prioridad: ntfy (POST a NTFY_URL/NTFY_TOPIC, con Authorization Bearer si hay
token). El armado del mensaje es lógica pura y testeable; el envío HTTP se aísla
y NUNCA lanza hacia el ciclo (una alerta que falla no debe tumbar el agente).

Configuración por .env (sin secretos en el repo):
  NTFY_URL     p. ej. https://ntfy.sh  (o el server propio de Hivemind)
  NTFY_TOPIC   p. ej. sync-arbolito
  NTFY_TOKEN   opcional; si existe se manda como 'Authorization: Bearer <token>'
"""
from __future__ import annotations

import logging

import httpx

from alert_state import AlertEvent

logger = logging.getLogger(__name__)

# Prefijo del canal: '[sync-arbolito -> hermann] ...'
MSG_PREFIX = "[sync-arbolito -> hermann]"


def build_message(event: AlertEvent, detail: str) -> str:
    """Arma el texto de la alerta. Testeable sin red."""
    detail = (detail or "").strip() or "sin detalle"
    if event == AlertEvent.CAIDO:
        return f"{MSG_PREFIX} bloqueo: {detail}"
    if event == AlertEvent.RECUPERADO:
        return f"{MSG_PREFIX} recuperado: {detail}"
    return f"{MSG_PREFIX} {detail}"


def build_title(event: AlertEvent) -> str:
    if event == AlertEvent.CAIDO:
        return "El Arbolito: sync CAÍDO"
    if event == AlertEvent.RECUPERADO:
        return "El Arbolito: sync recuperado"
    return "El Arbolito: sync"


class Notifier:
    """Envía alertas a ntfy. Si no está configurado, queda deshabilitado."""

    def __init__(
        self,
        ntfy_url: str = "",
        ntfy_topic: str = "",
        ntfy_token: str = "",
        timeout: float = 10.0,
        client: httpx.Client | None = None,
    ):
        self.ntfy_url = (ntfy_url or "").rstrip("/")
        self.ntfy_topic = (ntfy_topic or "").strip().strip("/")
        self.ntfy_token = (ntfy_token or "").strip()
        self.timeout = timeout
        self._client = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None
        if not self.enabled:
            logger.warning(
                "Notificaciones ntfy deshabilitadas: falta NTFY_URL o NTFY_TOPIC en .env."
            )

    @property
    def enabled(self) -> bool:
        return bool(self.ntfy_url and self.ntfy_topic)

    def _endpoint(self) -> str:
        return f"{self.ntfy_url}/{self.ntfy_topic}"

    def notify(self, event: AlertEvent, detail: str) -> bool:
        """Publica la alerta. Devuelve True si se envió; NUNCA lanza."""
        if event == AlertEvent.NINGUNO:
            return False
        message = build_message(event, detail)
        if not self.enabled:
            logger.warning("Alerta no enviada (ntfy sin configurar): %s", message)
            return False
        priority = "urgent" if event == AlertEvent.CAIDO else "default"
        tags = "rotating_light" if event == AlertEvent.CAIDO else "white_check_mark"
        headers = {
            "Title": build_title(event),
            "Priority": priority,
            "Tags": tags,
        }
        if self.ntfy_token:
            headers["Authorization"] = f"Bearer {self.ntfy_token}"
        try:
            r = self._client.post(
                self._endpoint(),
                content=message.encode("utf-8"),
                headers=headers,
                timeout=self.timeout,
            )
            if r.status_code >= 300:
                logger.warning("ntfy respondió %s: %s", r.status_code, r.text[:200])
                return False
            logger.info("Alerta ntfy enviada: %s", message)
            return True
        except Exception as e:  # noqa: BLE001 — una alerta caída no debe tumbar el agente
            logger.warning("No se pudo enviar alerta ntfy: %s", e)
            return False

    def close(self) -> None:
        if self._owns_client:
            try:
                self._client.close()
            except Exception:  # noqa: BLE001
                pass
