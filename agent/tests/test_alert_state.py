"""Pruebas de la máquina de estados de alerta (caído/recuperado)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alert_state import AlertEvent, AlertStateMachine  # noqa: E402


class TestAlertStateMachine(unittest.TestCase):
    def test_no_alerta_antes_del_umbral(self):
        m = AlertStateMachine(fail_threshold=2)
        self.assertEqual(m.record_failure(), AlertEvent.NINGUNO)  # 1er fallo
        self.assertFalse(m.is_down)

    def test_caido_al_alcanzar_umbral(self):
        m = AlertStateMachine(fail_threshold=2)
        m.record_failure()
        self.assertEqual(m.record_failure(), AlertEvent.CAIDO)  # 2do fallo
        self.assertTrue(m.is_down)

    def test_no_re_notifica_caido(self):
        m = AlertStateMachine(fail_threshold=2)
        m.record_failure()
        m.record_failure()  # CAIDO
        # Fallos posteriores no vuelven a notificar (evita spam).
        self.assertEqual(m.record_failure(), AlertEvent.NINGUNO)
        self.assertEqual(m.record_failure(), AlertEvent.NINGUNO)

    def test_recuperado_solo_si_venia_caido(self):
        m = AlertStateMachine(fail_threshold=2)
        m.record_failure()
        m.record_failure()  # CAIDO
        self.assertEqual(m.record_success(), AlertEvent.RECUPERADO)
        self.assertFalse(m.is_down)
        # Ya recuperado: un nuevo éxito no re-notifica.
        self.assertEqual(m.record_success(), AlertEvent.NINGUNO)

    def test_exito_reinicia_el_contador(self):
        m = AlertStateMachine(fail_threshold=2)
        m.record_failure()  # 1
        self.assertEqual(m.record_success(), AlertEvent.NINGUNO)  # reinicia, no venía caído
        # Ahora hacen falta 2 fallos de nuevo para caer.
        self.assertEqual(m.record_failure(), AlertEvent.NINGUNO)
        self.assertEqual(m.record_failure(), AlertEvent.CAIDO)

    def test_umbral_uno_cae_al_primer_fallo(self):
        m = AlertStateMachine(fail_threshold=1)
        self.assertEqual(m.record_failure(), AlertEvent.CAIDO)

    def test_umbral_minimo_uno(self):
        # Un umbral 0 o negativo se normaliza a 1.
        self.assertEqual(AlertStateMachine(fail_threshold=0).fail_threshold, 1)
        self.assertEqual(AlertStateMachine(fail_threshold=-5).fail_threshold, 1)

    def test_ciclo_completo_caido_recuperado(self):
        m = AlertStateMachine(fail_threshold=3)
        eventos = [m.record_failure() for _ in range(3)]
        self.assertEqual(eventos, [AlertEvent.NINGUNO, AlertEvent.NINGUNO, AlertEvent.CAIDO])
        self.assertEqual(m.record_success(), AlertEvent.RECUPERADO)


if __name__ == "__main__":
    unittest.main()
