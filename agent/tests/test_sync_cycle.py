"""Pruebas del ciclo sync_once: registro remoto de errores y alertas.

No tocan Firebird ni red: se parchea read_catalog y se usan dobles de prueba
para el cliente Supabase y el notificador.
"""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent  # noqa: E402
from alert_state import AlertEvent, AlertStateMachine  # noqa: E402
from firebird_reader import EleventaProduct, EleventaReadError  # noqa: E402


class _FakeSupa:
    def __init__(self, sync_result=None, sync_exc=None):
        self.sync_result = sync_result or {"received": 3}
        self.sync_exc = sync_exc
        self.errors_logged = []
        self.status_reports = []

    def sync_snapshot(self, rows, version):
        if self.sync_exc:
            raise self.sync_exc
        return self.sync_result

    def log_error(self, message):
        self.errors_logged.append(message)

    def report_status(self, status):
        self.status_reports.append(status)


class _FakeNotifier:
    def __init__(self):
        self.sent = []

    def notify(self, event, detail):
        self.sent.append((event, detail))
        return True


def _producto():
    return EleventaProduct(clave="A1", descripcion="Juguete", precio=10.0,
                           costo=5.0, existencia=4.0, departamento="Peluches")


class TestSyncCycle(unittest.TestCase):
    def test_exito_no_registra_error(self):
        supa = _FakeSupa(sync_result={"received": 1})
        notifier = _FakeNotifier()
        alerts = AlertStateMachine(fail_threshold=2)
        with mock.patch.object(agent, "_read_catalog_with_retry", return_value=[_producto()]):
            ok = agent.sync_once(supa, notifier, alerts)
        self.assertTrue(ok)
        self.assertEqual(supa.errors_logged, [])
        self.assertEqual(notifier.sent, [])

    def test_error_lectura_se_registra_en_remoto(self):
        supa = _FakeSupa()
        notifier = _FakeNotifier()
        alerts = AlertStateMachine(fail_threshold=1)  # cae al primer fallo
        with mock.patch.object(agent, "_read_catalog_with_retry",
                               side_effect=EleventaReadError("archivo bloqueado")):
            ok = agent.sync_once(supa, notifier, alerts)
        self.assertFalse(ok)
        # Se registró en sync_log remoto (antes solo iba al log local).
        self.assertEqual(len(supa.errors_logged), 1)
        self.assertIn("lectura Firebird", supa.errors_logged[0])
        self.assertIn("offline", supa.status_reports)
        # Se notificó "caído".
        self.assertEqual(notifier.sent[0][0], AlertEvent.CAIDO)

    def test_lectura_vacia_es_fallo(self):
        supa = _FakeSupa()
        notifier = _FakeNotifier()
        alerts = AlertStateMachine(fail_threshold=1)
        with mock.patch.object(agent, "_read_catalog_with_retry", return_value=[]):
            ok = agent.sync_once(supa, notifier, alerts)
        self.assertFalse(ok)
        self.assertEqual(len(supa.errors_logged), 1)
        self.assertIn("0 productos", supa.errors_logged[0])

    def test_error_envio_supabase_se_registra_y_alerta(self):
        supa = _FakeSupa(sync_exc=RuntimeError("Supabase respondió 500"))
        notifier = _FakeNotifier()
        alerts = AlertStateMachine(fail_threshold=1)
        with mock.patch.object(agent, "_read_catalog_with_retry", return_value=[_producto()]):
            ok = agent.sync_once(supa, notifier, alerts)
        self.assertFalse(ok)
        self.assertIn("envío a Supabase", supa.errors_logged[0])
        self.assertEqual(notifier.sent[0][0], AlertEvent.CAIDO)

    def test_recuperacion_notifica_una_vez(self):
        notifier = _FakeNotifier()
        alerts = AlertStateMachine(fail_threshold=1)
        # Falla una vez -> caído.
        supa_fail = _FakeSupa(sync_exc=RuntimeError("sin red"))
        with mock.patch.object(agent, "_read_catalog_with_retry", return_value=[_producto()]):
            agent.sync_once(supa_fail, notifier, alerts)
        # Éxito -> recuperado (una sola notificación de recuperación).
        supa_ok = _FakeSupa(sync_result={"received": 2})
        with mock.patch.object(agent, "_read_catalog_with_retry", return_value=[_producto()]):
            agent.sync_once(supa_ok, notifier, alerts)
        eventos = [e for e, _ in notifier.sent]
        self.assertEqual(eventos, [AlertEvent.CAIDO, AlertEvent.RECUPERADO])


if __name__ == "__main__":
    unittest.main()
