"""Pruebas del armado de mensajes y del envío ntfy (con cliente falso)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alert_state import AlertEvent  # noqa: E402
from notifier import Notifier, build_message  # noqa: E402


class _FakeResponse:
    def __init__(self, status_code=200, text="ok"):
        self.status_code = status_code
        self.text = text


class _FakeClient:
    def __init__(self, status_code=200, raise_exc=None):
        self.status_code = status_code
        self.raise_exc = raise_exc
        self.calls = []

    def post(self, url, content=None, headers=None, timeout=None):
        self.calls.append({"url": url, "content": content, "headers": headers})
        if self.raise_exc:
            raise self.raise_exc
        return _FakeResponse(self.status_code)


class TestBuildMessage(unittest.TestCase):
    def test_mensaje_caido(self):
        msg = build_message(AlertEvent.CAIDO, "lectura Firebird: timeout")
        self.assertEqual(msg, "[sync-arbolito -> hermann] bloqueo: lectura Firebird: timeout")

    def test_mensaje_recuperado(self):
        msg = build_message(AlertEvent.RECUPERADO, "10 productos sincronizados")
        self.assertEqual(msg, "[sync-arbolito -> hermann] recuperado: 10 productos sincronizados")

    def test_detalle_vacio(self):
        self.assertIn("sin detalle", build_message(AlertEvent.CAIDO, ""))


class TestNotifier(unittest.TestCase):
    def test_deshabilitado_sin_config(self):
        n = Notifier(ntfy_url="", ntfy_topic="", client=_FakeClient())
        self.assertFalse(n.enabled)
        # No lanza y devuelve False.
        self.assertFalse(n.notify(AlertEvent.CAIDO, "detalle"))

    def test_evento_ninguno_no_envia(self):
        fake = _FakeClient()
        n = Notifier(ntfy_url="https://ntfy.sh", ntfy_topic="t", client=fake)
        self.assertFalse(n.notify(AlertEvent.NINGUNO, "x"))
        self.assertEqual(fake.calls, [])

    def test_envia_caido_con_prioridad_y_endpoint(self):
        fake = _FakeClient()
        n = Notifier(ntfy_url="https://ntfy.sh/", ntfy_topic="sync-arbolito", client=fake)
        self.assertTrue(n.notify(AlertEvent.CAIDO, "bloqueo x"))
        self.assertEqual(len(fake.calls), 1)
        call = fake.calls[0]
        self.assertEqual(call["url"], "https://ntfy.sh/sync-arbolito")
        self.assertEqual(call["headers"]["Priority"], "urgent")
        self.assertEqual(call["content"], b"[sync-arbolito -> hermann] bloqueo: bloqueo x")

    def test_incluye_bearer_si_hay_token(self):
        fake = _FakeClient()
        n = Notifier(ntfy_url="https://ntfy.sh", ntfy_topic="t", ntfy_token="secreto", client=fake)
        n.notify(AlertEvent.RECUPERADO, "ok")
        self.assertEqual(fake.calls[0]["headers"]["Authorization"], "Bearer secreto")

    def test_error_http_no_lanza(self):
        fake = _FakeClient(raise_exc=RuntimeError("sin red"))
        n = Notifier(ntfy_url="https://ntfy.sh", ntfy_topic="t", client=fake)
        self.assertFalse(n.notify(AlertEvent.CAIDO, "x"))

    def test_status_no_2xx_devuelve_false(self):
        fake = _FakeClient(status_code=500)
        n = Notifier(ntfy_url="https://ntfy.sh", ntfy_topic="t", client=fake)
        self.assertFalse(n.notify(AlertEvent.CAIDO, "x"))


if __name__ == "__main__":
    unittest.main()
