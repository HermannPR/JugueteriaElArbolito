"""Pruebas de la lógica del instalador de un clic (sin Windows, sin GUI)."""
import base64
import json
import os
import struct
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import instalador_logic as L  # noqa: E402

ENV = {
    "SystemDrive": "C:",
    "ProgramFiles": r"C:\Program Files",
    "ProgramW6432": r"C:\Program Files",
    "ProgramFiles(x86)": r"C:\Program Files (x86)",
    "ProgramData": r"C:\ProgramData",
    "PUBLIC": r"C:\Users\Public",
    "SystemRoot": r"C:\Windows",
}
TYPICAL = r"C:\Program Files (x86)\AbarrotesPDV\db\PDVDATA.FDB"


def _jwt(payload: dict) -> str:
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")  # noqa: E731
    return f"{enc({'alg': 'HS256'})}.{enc(payload)}.firmafalsa1234567890"


SERVICE_KEY = _jwt({"role": "service_role", "iss": "supabase"})
ANON_KEY = _jwt({"role": "anon", "iss": "supabase"})
GOOD = {"SUPABASE_URL": "https://abc.supabase.co", "SUPABASE_SERVICE_KEY": SERVICE_KEY}


def _pe(machine: int) -> bytes:
    head = bytearray(b"MZ" + b"\0" * 0x3E)
    struct.pack_into("<I", head, 0x3C, 0x80)
    head += b"\0" * (0x80 - len(head))
    head += b"PE\0\0" + struct.pack("<H", machine) + b"\0" * 20
    return bytes(head)


class TestRutas(unittest.TestCase):
    def test_install_dir_programdata(self):
        self.assertEqual(L.install_dir(ENV), r"C:\ProgramData\ArbolitoSync")
        self.assertEqual(L.install_dir({}), r"C:\ProgramData\ArbolitoSync")

    def test_candidatos_empiezan_por_la_ruta_confirmada(self):
        cands = L.fdb_candidates(ENV)
        self.assertEqual(cands[0], TYPICAL)
        self.assertEqual(len(cands), len({c.lower() for c in cands}))  # sin duplicados

    def test_find_fdb_ruta_tipica(self):
        self.assertEqual(L.find_fdb(ENV, exists=lambda p: p == TYPICAL, listdir=lambda d: []), TYPICAL)

    def test_find_fdb_barrido_un_nivel(self):
        target = r"C:\Program Files (x86)\EleventaPV\db\PDVDATA.FDB"
        tree = {r"C:\Program Files (x86)": ["Otra", "EleventaPV"]}

        def listdir(d):
            if d in tree:
                return tree[d]
            raise OSError(d)

        self.assertEqual(L.find_fdb(ENV, exists=lambda p: p == target, listdir=listdir), target)

    def test_find_fdb_nada(self):
        self.assertIsNone(L.find_fdb(ENV, exists=lambda p: False, listdir=lambda d: []))

    def test_dsn(self):
        self.assertEqual(L.dsn_from_path(TYPICAL), "localhost:" + TYPICAL)
        self.assertEqual(L.dsn_from_path('"' + TYPICAL + '"'), "localhost:" + TYPICAL)
        self.assertEqual(L.dsn_from_path("localhost:" + TYPICAL), "localhost:" + TYPICAL)
        self.assertEqual(L.dsn_from_path(""), "")
        self.assertEqual(L.path_from_dsn("localhost:" + TYPICAL), TYPICAL)


class TestFbclient(unittest.TestCase):
    def test_pe_bits(self):
        self.assertEqual(L.pe_bits(_pe(0x14C)), 32)
        self.assertEqual(L.pe_bits(_pe(0x8664)), 64)
        self.assertIsNone(L.pe_bits(b"no es un exe"))
        self.assertIsNone(L.pe_bits(b"MZ" + b"\0" * 100))

    def test_pick_fbclient_por_arquitectura(self):
        files = {"a32.dll": _pe(0x14C), "b64.dll": _pe(0x8664)}
        read = files.get
        self.assertEqual(L.pick_fbclient(["a32.dll", "b64.dll"], 64, read), ("b64.dll", ["a32.dll"]))
        self.assertEqual(L.pick_fbclient(["a32.dll"], 64, read), (None, ["a32.dll"]))
        self.assertEqual(L.pick_fbclient(["x.dll"], 32, read), (None, []))


class TestConfig(unittest.TestCase):
    def test_roundtrip_con_rutas_y_comillas(self):
        values = dict(GOOD, FDB_DSN="localhost:" + TYPICAL, NTFY_TOPIC="it's", OTRA="x # y",
                      FB_CLIENT_LIBRARY=r"C:\Windows\bin\fbclient.dll")
        text = L.render_env(values)
        self.assertIn("no compartir", text)
        self.assertEqual(L.parse_env(text), values)

    def test_render_omite_vacios_y_ordena(self):
        text = L.render_env({"ZZZ": "1", "NTFY_TOKEN": "", "SUPABASE_URL": "https://a.supabase.co"})
        keys = [ln.split("=")[0] for ln in text.splitlines() if ln and not ln.startswith("#")]
        self.assertEqual(keys, ["SUPABASE_URL", "ZZZ"])

    def test_valida_ok(self):
        self.assertEqual(L.validate_config(GOOD), [])
        self.assertEqual(L.validate_config(dict(GOOD, SUPABASE_SERVICE_KEY="sb_secret_" + "a" * 30)), [])

    def test_valida_faltantes(self):
        probs = L.validate_config({})
        self.assertTrue(any("SUPABASE_URL" in p for p in probs))
        self.assertTrue(any("SUPABASE_SERVICE_KEY" in p for p in probs))

    def test_valida_llave_publica_o_anon(self):
        self.assertTrue(L.validate_config(dict(GOOD, SUPABASE_SERVICE_KEY="sb_publishable_" + "a" * 30)))
        self.assertTrue(any("anon" in p for p in L.validate_config(dict(GOOD, SUPABASE_SERVICE_KEY=ANON_KEY))))

    def test_valida_url_y_ntfy(self):
        self.assertTrue(L.validate_config(dict(GOOD, SUPABASE_URL="http://abc.supabase.co")))
        self.assertTrue(L.validate_config(dict(GOOD, SUPABASE_URL="https://<project-ref>.supabase.co")))
        self.assertTrue(L.validate_config(dict(GOOD, NTFY_TOPIC="t")))  # sin NTFY_URL
        self.assertTrue(L.validate_config(dict(GOOD, NTFY_URL="https://ntfy.sh", NTFY_TOPIC="<tu-topic-secreto>")))
        self.assertEqual(L.validate_config(dict(GOOD, NTFY_URL="https://ntfy.sh", NTFY_TOPIC="t")), [])
        self.assertTrue(L.validate_config(dict(GOOD, FDB_DSN="localhost:C:\\algo.txt")))
        self.assertTrue(L.validate_config(dict(GOOD, NTFY_TOKEN="a\nb")))

    def test_merge_no_borra_secretos_con_campo_vacio(self):
        merged = L.merge_config(dict(GOOD, NTFY_TOKEN="tok", LOG_LEVEL="DEBUG"),
                                {"SUPABASE_SERVICE_KEY": "", "NTFY_TOKEN": " ", "NTFY_TOPIC": "nuevo"})
        self.assertEqual(merged["SUPABASE_SERVICE_KEY"], SERVICE_KEY)
        self.assertEqual(merged["NTFY_TOKEN"], "tok")
        self.assertEqual(merged["NTFY_TOPIC"], "nuevo")
        self.assertEqual(merged["LOG_LEVEL"], "DEBUG")


class TestResolveConfig(unittest.TestCase):
    def _resolve(self, text, existing=(), heads=None, bits=64):
        existing = set(existing)
        heads = heads or {}
        return L.resolve_config(text, ENV, exists=lambda p: p in existing, listdir=lambda d: [],
                                read_head=heads.get, want_bits=bits)

    def test_sin_config(self):
        self.assertEqual(self._resolve(None)[0], L.OUTCOME_FALTA_CONFIG)

    def test_config_sin_llaves(self):
        outcome, _, _, detail = self._resolve("NTFY_TOPIC=x\n")
        self.assertEqual(outcome, L.OUTCOME_FALTA_CONFIG)
        self.assertIn("SUPABASE_URL", detail)

    def test_detecta_fdb_y_marca_cambio(self):
        outcome, values, changed, _ = self._resolve(L.render_env(GOOD), existing=[TYPICAL])
        self.assertEqual(outcome, L.OUTCOME_OK)
        self.assertTrue(changed)
        self.assertEqual(values["FDB_DSN"], "localhost:" + TYPICAL)

    def test_respeta_fdb_de_hermann_si_existe(self):
        custom = r"D:\Datos\PDVDATA.FDB"
        outcome, values, changed, _ = self._resolve(
            L.render_env(dict(GOOD, FDB_DSN="localhost:" + custom)), existing=[custom, TYPICAL])
        self.assertEqual(outcome, L.OUTCOME_OK)
        self.assertFalse(changed)
        self.assertEqual(values["FDB_DSN"], "localhost:" + custom)

    def test_sin_eleventa(self):
        self.assertEqual(self._resolve(L.render_env(GOOD))[0], L.OUTCOME_NO_ELEVENTA)

    def test_config_invalida(self):
        bad = dict(GOOD, SUPABASE_SERVICE_KEY=ANON_KEY)
        self.assertEqual(self._resolve(L.render_env(bad), existing=[TYPICAL])[0], L.OUTCOME_CONFIG_INVALIDA)

    def test_fbclient_compatible_se_guarda(self):
        dll = r"C:\Program Files (x86)\AbarrotesPDV\fbclient.dll"
        outcome, values, _, _ = self._resolve(L.render_env(GOOD), existing=[TYPICAL],
                                              heads={dll: _pe(0x14C)}, bits=32)
        self.assertEqual(outcome, L.OUTCOME_OK)
        self.assertEqual(values["FB_CLIENT_LIBRARY"], dll)

    def test_fbclient_de_otra_arquitectura_avisa(self):
        dll = r"C:\Program Files (x86)\AbarrotesPDV\fbclient.dll"
        outcome, values, _, detail = self._resolve(L.render_env(GOOD), existing=[TYPICAL],
                                                   heads={dll: _pe(0x14C)}, bits=64)
        self.assertEqual(outcome, L.OUTCOME_OK)
        self.assertNotIn("FB_CLIENT_LIBRARY", values)
        self.assertIn("64 bits", detail)


class TestComandos(unittest.TestCase):
    def test_script_de_tarea(self):
        exe = r"C:\ProgramData\ArbolitoSync\ArbolitoSync.exe"
        script = L.build_task_script(exe, "--agente", r"C:\ProgramData\ArbolitoSync")
        self.assertIn(f"-Execute '{exe}'", script)
        self.assertIn("-Argument '--agente'", script)
        self.assertIn("-AtStartup", script)
        self.assertIn("-UserId 'SYSTEM'", script)
        self.assertIn("-RestartCount 999", script)
        self.assertIn("-MultipleInstances IgnoreNew", script)
        self.assertIn("New-TimeSpan -Minutes 10", script)
        self.assertNotIn("MaxValue", script)
        self.assertIn("$TaskName = 'ArbolitoSyncAgent'", script)
        self.assertIn("Start-ScheduledTask", script)

    def test_ps_quote_escapa_comilla(self):
        self.assertEqual(L.ps_quote("C:\\O'Brien\\a.exe"), "'C:\\O''Brien\\a.exe'")
        script = L.build_task_script("C:\\O'Brien\\a.exe", "", "C:\\x")
        self.assertIn("'C:\\O''Brien\\a.exe'", script)

    def test_powershell_argv_roundtrip(self):
        script = L.build_task_script("C:\\a.exe", "--agente", "C:\\")
        argv = L.powershell_argv(script)
        self.assertEqual(argv[0], "powershell.exe")
        self.assertIn("-EncodedCommand", argv)
        self.assertIn("Bypass", argv)
        self.assertEqual(L.decode_powershell_argv(argv), script)

    def test_task_action(self):
        self.assertEqual(L.task_action(True, r"C:\x\ArbolitoSync.exe", "ignorado"),
                         (r"C:\x\ArbolitoSync.exe", "--agente"))
        prog, args = L.task_action(False, r"C:\Python311\python.exe", r"C:\src\arbolito_sync.py")
        self.assertEqual(prog, r"C:\Python311\python.exe")
        self.assertEqual(args, '"C:\\src\\arbolito_sync.py" --agente')

    def test_desinstalar_y_detener(self):
        self.assertIn("Unregister-ScheduledTask", L.build_uninstall_script())
        self.assertIn("Stop-ScheduledTask", L.build_stop_script())
        self.assertNotIn("Unregister", L.build_stop_script())

    def test_energia(self):
        cmds = L.power_commands()
        self.assertIn(["powercfg", "/change", "standby-timeout-ac", "0"], cmds)
        self.assertIn(["powercfg", "/change", "hibernate-timeout-ac", "0"], cmds)

    def test_icacls_usa_sids(self):
        argv = L.restrict_acl_argv(r"C:\ProgramData\ArbolitoSync\config.env")
        self.assertEqual(argv[:3], ["icacls", r"C:\ProgramData\ArbolitoSync\config.env", "/inheritance:r"])
        self.assertIn("*S-1-5-18:(F)", argv)
        self.assertIn("*S-1-5-32-544:(F)", argv)
        self.assertFalse(any("Users" in a or "Usuarios" in a for a in argv))


class TestEntrada(unittest.TestCase):
    """El punto de entrada se importa sin Tk (solo argparse)."""

    def test_parse_args(self):
        import arbolito_sync

        self.assertTrue(arbolito_sync.parse_args(["--configurar"]).configurar)
        self.assertTrue(arbolito_sync.parse_args(["--agente"]).agente)
        a = arbolito_sync.parse_args([])
        self.assertFalse(any([a.configurar, a.agente, a.once, a.dry_run, a.estado, a.desinstalar]))
        with self.assertRaises(SystemExit):
            arbolito_sync.parse_args(["--agente", "--configurar"])

    def test_mensajes_para_cada_resultado(self):
        import arbolito_sync

        for outcome in (L.OUTCOME_OK, L.OUTCOME_FALTA_CONFIG, L.OUTCOME_NO_ELEVENTA,
                        L.OUTCOME_CONFIG_INVALIDA, "no_admin", "error"):
            self.assertIn(outcome, arbolito_sync.MESSAGES)
        self.assertIn("Avísale a Hermann", arbolito_sync.MESSAGES[L.OUTCOME_FALTA_CONFIG][0])
        self.assertIn("Listo, ya está funcionando", arbolito_sync.MESSAGES[L.OUTCOME_OK][0])


if __name__ == "__main__":
    unittest.main()
