"""Utilidades de robustez: backoff exponencial, reintentos y timeout por hilo.

Todo aquí es lógica pura y testeable sin red ni Firebird: el `sleep` y el reloj
se inyectan para poder probar el backoff y los reintentos de forma determinista.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Iterable, Sequence, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


def backoff_delays(
    attempts: int,
    base_delay: float = 1.0,
    factor: float = 2.0,
    max_delay: float = 300.0,
) -> list[float]:
    """Genera la secuencia de esperas ENTRE intentos.

    Para `attempts` intentos hay como máximo `attempts - 1` esperas (después del
    último intento ya no se espera). Ej.: base=1, factor=2 -> [1, 2, 4, 8, ...]
    topado en `max_delay`.
    """
    delays: list[float] = []
    delay = float(base_delay)
    for _ in range(max(0, attempts - 1)):
        delays.append(min(delay, max_delay))
        delay *= factor
    return delays


def retry_call(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    base_delay: float = 1.0,
    factor: float = 2.0,
    max_delay: float = 300.0,
    retry_on: tuple[type[BaseException], ...] = (Exception,),
    sleep: Callable[[float], None] = time.sleep,
    on_retry: Callable[[int, BaseException, float], None] | None = None,
) -> T:
    """Llama a `fn` reintentando ante errores transitorios con backoff.

    Reintenta solo excepciones incluidas en `retry_on`. Si se agotan los
    intentos, relanza la última excepción. Como el envío a Supabase y la lectura
    del snapshot son idempotentes, reintentar es seguro (no duplica).
    """
    attempts = max(1, attempts)
    delays = backoff_delays(attempts, base_delay, factor, max_delay)
    last_exc: BaseException | None = None
    for i in range(attempts):
        try:
            return fn()
        except retry_on as exc:  # noqa: PERF203
            last_exc = exc
            if i >= attempts - 1:
                break
            wait = delays[i]
            if on_retry is not None:
                on_retry(i + 1, exc, wait)
            else:
                logger.warning(
                    "Intento %d/%d falló (%s); reintento en %.1fs.",
                    i + 1, attempts, exc, wait,
                )
            sleep(wait)
    assert last_exc is not None
    raise last_exc


class TimeoutExpired(Exception):
    """Una operación no terminó dentro del tiempo límite."""


def call_with_timeout(fn: Callable[[], T], timeout: float, what: str = "operación") -> T:
    """Ejecuta `fn` en un hilo daemon y aborta si tarda más de `timeout` seg.

    Firebird 2.5 (el de Eleventa) no soporta timeout de sentencia nativo, así que
    envolvemos la conexión y la consulta en un hilo con join acotado. Si Eleventa
    dejó el archivo bloqueado y la llamada se cuelga, no colgamos el ciclo: el
    hilo queda como daemon (no bloquea la salida del proceso) y seguimos.
    """
    if timeout is None or timeout <= 0:
        return fn()

    result: list[T] = []
    error: list[BaseException] = []

    def _runner() -> None:
        try:
            result.append(fn())
        except BaseException as exc:  # noqa: BLE001 — se propaga al hilo principal
            error.append(exc)

    th = threading.Thread(target=_runner, name="arbolito-timeout", daemon=True)
    th.start()
    th.join(timeout)
    if th.is_alive():
        raise TimeoutExpired(f"{what} superó el límite de {timeout:.0f}s")
    if error:
        raise error[0]
    return result[0]
