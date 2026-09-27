"""Máquina de estados de alerta: 'caído' / 'recuperado'.

Objetivo: notificar UNA sola vez al entrar en estado caído (tras N fallos
seguidos) y UNA sola vez al recuperarse. Nunca en cada ciclo (evitar spam).

Lógica pura, sin red ni Firebird: totalmente testeable.
"""
from __future__ import annotations

from enum import Enum


class AlertEvent(str, Enum):
    NINGUNO = "ninguno"      # no hay transición: no notificar
    CAIDO = "caido"          # acaba de entrar en estado caído: notificar bloqueo
    RECUPERADO = "recuperado"  # acaba de volver a la normalidad: notificar recuperación


class AlertStateMachine:
    """Cuenta fallos consecutivos y decide cuándo notificar.

    - `record_failure()` devuelve CAIDO solo en la transición ok -> caído, que
      ocurre al alcanzar `fail_threshold` fallos consecutivos. Fallos posteriores
      devuelven NINGUNO (ya está caído, no se re-notifica).
    - `record_success()` devuelve RECUPERADO solo si venía de estado caído; si no,
      NINGUNO. Cualquier éxito reinicia el contador de fallos.
    """

    def __init__(self, fail_threshold: int = 2):
        self.fail_threshold = max(1, int(fail_threshold))
        self.consecutive_failures = 0
        self.down = False

    def record_failure(self) -> AlertEvent:
        self.consecutive_failures += 1
        if not self.down and self.consecutive_failures >= self.fail_threshold:
            self.down = True
            return AlertEvent.CAIDO
        return AlertEvent.NINGUNO

    def record_success(self) -> AlertEvent:
        self.consecutive_failures = 0
        if self.down:
            self.down = False
            return AlertEvent.RECUPERADO
        return AlertEvent.NINGUNO

    @property
    def is_down(self) -> bool:
        return self.down
