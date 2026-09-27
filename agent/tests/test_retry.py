"""Pruebas de backoff, reintentos y timeout por hilo."""
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from retry import (  # noqa: E402
    TimeoutExpired,
    backoff_delays,
    call_with_timeout,
    retry_call,
)


class TestBackoff(unittest.TestCase):
    def test_secuencia_exponencial(self):
        self.assertEqual(backoff_delays(4, base_delay=1, factor=2), [1, 2, 4])

    def test_topado_en_max(self):
        self.assertEqual(backoff_delays(5, base_delay=10, factor=10, max_delay=50), [10, 50, 50, 50])

    def test_un_intento_sin_esperas(self):
        self.assertEqual(backoff_delays(1), [])
        self.assertEqual(backoff_delays(0), [])


class TestRetryCall(unittest.TestCase):
    def test_exito_al_primer_intento_no_espera(self):
        dormidas = []
        result = retry_call(lambda: 42, attempts=3, sleep=dormidas.append)
        self.assertEqual(result, 42)
        self.assertEqual(dormidas, [])

    def test_reintenta_y_luego_tiene_exito(self):
        llamadas = {"n": 0}

        def flaky():
            llamadas["n"] += 1
            if llamadas["n"] < 3:
                raise ValueError("transitorio")
            return "ok"

        dormidas = []
        result = retry_call(
            flaky, attempts=3, base_delay=1, factor=2, sleep=dormidas.append
        )
        self.assertEqual(result, "ok")
        self.assertEqual(llamadas["n"], 3)
        self.assertEqual(dormidas, [1, 2])  # dos esperas entre tres intentos

    def test_agota_intentos_y_relanza(self):
        dormidas = []

        def siempre_falla():
            raise RuntimeError("nunca funciona")

        with self.assertRaises(RuntimeError):
            retry_call(siempre_falla, attempts=3, base_delay=1, sleep=dormidas.append)
        self.assertEqual(len(dormidas), 2)

    def test_no_reintenta_excepcion_no_listada(self):
        dormidas = []

        def falla():
            raise KeyError("no transitorio")

        with self.assertRaises(KeyError):
            retry_call(
                falla, attempts=5, retry_on=(ValueError,), sleep=dormidas.append
            )
        self.assertEqual(dormidas, [])  # no reintentó

    def test_callback_on_retry(self):
        eventos = []

        def flaky():
            if len(eventos) < 1:
                raise ValueError("x")
            return "ok"

        retry_call(
            flaky,
            attempts=2,
            base_delay=1,
            sleep=lambda _: None,
            on_retry=lambda intento, exc, espera: eventos.append((intento, espera)),
        )
        self.assertEqual(eventos, [(1, 1)])


class TestCallWithTimeout(unittest.TestCase):
    def test_retorna_valor_rapido(self):
        self.assertEqual(call_with_timeout(lambda: 7, timeout=5), 7)

    def test_propaga_excepcion(self):
        def boom():
            raise ValueError("adentro")

        with self.assertRaises(ValueError):
            call_with_timeout(boom, timeout=5)

    def test_timeout_dispara(self):
        with self.assertRaises(TimeoutExpired):
            call_with_timeout(lambda: time.sleep(2), timeout=0.1)

    def test_timeout_cero_o_negativo_no_limita(self):
        self.assertEqual(call_with_timeout(lambda: 9, timeout=0), 9)


if __name__ == "__main__":
    unittest.main()
