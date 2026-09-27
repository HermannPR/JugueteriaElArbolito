"""ArbolitoSync.exe — punto de entrada del ejecutable de un clic (Windows).

Modos:
  (sin argumentos)   Primer arranque "a prueba de tía": se copia a
                     %ProgramData%\\ArbolitoSync, detecta Eleventa, revisa
                     config.env, registra la tarea programada, evita la
                     suspensión y dice "Listo, ya está funcionando".
  --configurar       Modo Hermann: formulario para llaves y ruta de Eleventa.
  --estado           Muestra la tarea programada y las últimas líneas del log.
  --desinstalar      Quita la tarea (y opcionalmente la carpeta con la config).
  --agente           Lo que corre la tarea programada: el bucle del agente.
  --once / --dry-run Igual que agent.py (para verificar a mano).

La lógica testeable está en instalador_logic.py; aquí solo GUI y efectos.
"""
from __future__ import annotations

import argparse
import contextlib
import io
import logging
import os
import shutil
import struct
import subprocess
import sys
import threading
import time

import instalador_logic as L

FROZEN = bool(getattr(sys, "frozen", False))
DATA_DIR = L.install_dir(os.environ)
CONFIG_PATH = os.path.join(DATA_DIR, L.CONFIG_NAME)
INSTALLED_EXE = os.path.join(DATA_DIR, L.EXE_NAME)
NO_WINDOW = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW

log = logging.getLogger("arbolito.instalador")

# Colores y letra grande.
GREEN, ORANGE, RED = "#1b7a2f", "#b35c00", "#b00020"
FONT = "Segoe UI"

MESSAGES = {
    L.OUTCOME_OK: ("Listo, ya está funcionando.",
                   "Ya puedes cerrar esta ventana.\nNo tienes que hacer nada más.", GREEN),
    L.OUTCOME_FALTA_CONFIG: ("Falta la configuración.\nAvísale a Hermann.",
                             "No pasa nada malo. Hermann lo arregla.", ORANGE),
    L.OUTCOME_NO_ELEVENTA: ("No encontré Eleventa en esta computadora.\nAvísale a Hermann.",
                            "Mándale foto de esta ventana.", ORANGE),
    L.OUTCOME_CONFIG_INVALIDA: ("La configuración tiene un error.\nAvísale a Hermann.",
                                "Mándale foto de esta ventana.", ORANGE),
    "no_admin": ("Hay que darle permiso.",
                 "Cierra esto, vuelve a dar doble clic\ny cuando pregunte, elige «Sí».", ORANGE),
    "error": ("Algo salió mal.",
              "Tómale foto a esta ventana\ny mándasela a Hermann.", RED),
}


# ---------------------------------------------------------------------------
# Utilidades de sistema
# ---------------------------------------------------------------------------
def _quiet_std_streams() -> None:
    """En un .exe sin consola sys.stdout/stderr son None: redirigir a devnull."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def _setup_log() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    handler = logging.FileHandler(os.path.join(DATA_DIR, "instalador.log"), encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)


def _run(argv: list[str], timeout: float = 120) -> subprocess.CompletedProcess:
    shown = argv if argv[0] != "powershell.exe" else argv[:-1] + ["<script>"]
    log.info("Ejecutando: %s", " ".join(shown))
    res = subprocess.run(argv, capture_output=True, text=True, timeout=timeout,
                         creationflags=NO_WINDOW, errors="replace")
    if res.returncode != 0:
        log.warning("Código %s. stdout=%s stderr=%s", res.returncode, res.stdout.strip()[-800:],
                    res.stderr.strip()[-800:])
    return res


def _run_ps(script: str, timeout: float = 120) -> subprocess.CompletedProcess:
    log.info("PowerShell:\n%s", script)
    return _run(L.powershell_argv(script), timeout)


def _is_admin() -> bool:
    if os.name != "nt":
        return True
    try:
        import ctypes

        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:  # noqa: BLE001
        return False


def _read_head(path: str) -> bytes | None:
    try:
        with open(path, "rb") as f:
            return f.read(4096)
    except OSError:
        return None


def _read_config_text() -> str | None:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def write_config(values: dict) -> None:
    """Escribe config.env con permisos restringidos (solo SYSTEM y Administradores).

    Se crea un archivo temporal vacío, se le quitan los permisos heredados con
    icacls, se escribe el contenido y se renombra encima (el renombre conserva
    los permisos del temporal). Así las llaves nunca quedan legibles por Usuarios.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = CONFIG_PATH + ".tmp"
    open(tmp, "w").close()
    if os.name == "nt":
        res = _run(L.restrict_acl_argv(tmp))
        if res.returncode != 0:
            raise RuntimeError("icacls falló al restringir config.env")
    with open(tmp, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(L.render_env(values))
    os.replace(tmp, CONFIG_PATH)
    log.info("config.env guardado (llaves: %s)", ", ".join(sorted(values)))


# ---------------------------------------------------------------------------
# Instalación (primer arranque)
# ---------------------------------------------------------------------------
def _copy_self() -> str:
    """Copia el .exe a %ProgramData%\\ArbolitoSync. Devuelve la ruta a usar en la tarea."""
    if not FROZEN:
        return sys.executable
    here = os.path.normcase(os.path.abspath(sys.executable))
    if here == os.path.normcase(os.path.abspath(INSTALLED_EXE)):
        return INSTALLED_EXE
    # Si ya había una versión corriendo, detenerla para poder reemplazarla.
    _run_ps(L.build_stop_script(), timeout=60)
    last = None
    for _ in range(15):
        try:
            shutil.copy2(sys.executable, INSTALLED_EXE)
            log.info("Copiado %s -> %s", sys.executable, INSTALLED_EXE)
            return INSTALLED_EXE
        except OSError as e:  # el proceso anterior aún no suelta el archivo
            last = e
            time.sleep(1)
    raise RuntimeError(f"No se pudo copiar el programa a {INSTALLED_EXE}: {last}")


def install() -> tuple[str, str]:
    """Hace todo el primer arranque. Devuelve (outcome, detalle)."""
    if not _is_admin():
        return "no_admin", "El programa no tiene permisos de administrador."
    os.makedirs(DATA_DIR, exist_ok=True)
    program = _copy_self()

    bits = struct.calcsize("P") * 8
    outcome, values, changed, detail = L.resolve_config(
        _read_config_text(), os.environ, read_head=_read_head, want_bits=bits)
    log.info("Revisión de config: %s %s", outcome, detail)
    if outcome != L.OUTCOME_OK:
        return outcome, detail
    if changed:
        write_config(values)

    prog, args = L.task_action(FROZEN, program, os.path.abspath(__file__))
    res = _run_ps(L.build_task_script(prog, args, DATA_DIR))
    if res.returncode != 0:
        return "error", "No se pudo registrar la tarea programada: " + (res.stderr or res.stdout).strip()[-300:]

    for argv in L.power_commands():
        try:
            _run(argv, timeout=30)
        except Exception as e:  # noqa: BLE001 — la energía no debe tumbar la instalación
            log.warning("powercfg falló: %s", e)

    if _run(L.query_task_argv(), timeout=30).returncode != 0:
        return "error", "La tarea no aparece registrada."
    log.info("Instalación completa.")
    return L.OUTCOME_OK, detail


# ---------------------------------------------------------------------------
# Ventanas (Tkinter)
# ---------------------------------------------------------------------------
def _big_window(work, title: str = "El Arbolito") -> None:
    """Ventana grande: muestra 'Espera...' mientras `work()` corre en un hilo y
    luego el resultado (outcome, detalle) en letra grande."""
    import tkinter as tk

    root = tk.Tk()
    root.title(title)
    root.geometry("720x440")
    root.configure(bg="white")
    root.attributes("-topmost", True)
    root.after(1500, lambda: root.attributes("-topmost", False))

    main = tk.Label(root, text="Espera un momento...", font=(FONT, 28, "bold"), bg="white",
                    fg="#333", wraplength=660, justify="center")
    main.pack(expand=True, fill="both", padx=20, pady=(30, 5))
    sub = tk.Label(root, text="Estoy preparando todo.", font=(FONT, 18), bg="white", fg="#333",
                   wraplength=660, justify="center")
    sub.pack(pady=5)
    small = tk.Label(root, text="", font=(FONT, 9), bg="white", fg="#777", wraplength=680)
    small.pack(side="bottom", pady=6)
    btn = tk.Button(root, text="Cerrar", font=(FONT, 20, "bold"), command=root.destroy,
                    padx=40, pady=6)

    result: dict = {}

    def worker():
        try:
            result["r"] = work()
        except Exception as e:  # noqa: BLE001
            log.exception("Error en instalación")
            result["r"] = ("error", str(e)[:300])

    def poll():
        if "r" not in result:
            root.after(200, poll)
            return
        outcome, detail = result["r"]
        text, hint, color = MESSAGES.get(outcome, MESSAGES["error"])
        main.config(text=text, fg=color)
        sub.config(text=hint)
        small.config(text=(detail or "") + f"\nRegistro: {os.path.join(DATA_DIR, 'instalador.log')}")
        btn.pack(side="bottom", pady=15)

    threading.Thread(target=worker, daemon=True).start()
    root.after(200, poll)
    root.mainloop()


def _text_window(title: str, text: str) -> None:
    import tkinter as tk

    root = tk.Tk()
    root.title(title)
    root.geometry("900x600")
    box = tk.Text(root, font=("Consolas", 10), wrap="none")
    box.insert("1.0", text)
    box.config(state="disabled")
    box.pack(expand=True, fill="both")
    tk.Button(root, text="Cerrar", command=root.destroy, font=(FONT, 12)).pack(pady=6)
    root.mainloop()


def configure_window() -> int:
    """Formulario de Hermann. Escribe config.env y opcionalmente instala."""
    import tkinter as tk
    from tkinter import filedialog, messagebox

    try:
        existing = L.parse_env(_read_config_text() or "")
    except OSError as e:
        existing = {}
        log.warning("No se pudo leer config.env: %s", e)

    fdb_default = L.path_from_dsn(existing.get("FDB_DSN", "")) or (L.find_fdb(os.environ) or "")
    fields = [
        # (llave, etiqueta, secreto, valor inicial)
        ("SUPABASE_URL", "SUPABASE_URL", False, existing.get("SUPABASE_URL", "")),
        ("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_KEY (vacío = conservar)", True, ""),
        ("NTFY_URL", "NTFY_URL", False, existing.get("NTFY_URL", "https://ntfy.sh")),
        ("NTFY_TOPIC", "NTFY_TOPIC", False, existing.get("NTFY_TOPIC", "")),
        ("NTFY_TOKEN", "NTFY_TOKEN (opcional; vacío = conservar)", True, ""),
        ("FDB_PATH", "Ruta de PDVDATA.FDB", False, fdb_default),
    ]

    root = tk.Tk()
    root.title("ArbolitoSync - configurar (Hermann)")
    root.resizable(False, False)
    frm = tk.Frame(root, padx=14, pady=12)
    frm.pack()
    tk.Label(frm, text=f"Se guarda en {CONFIG_PATH}\n(solo SYSTEM y Administradores pueden leerlo)",
             fg="#555", justify="left").grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 8))
    if existing.get("SUPABASE_SERVICE_KEY"):
        tk.Label(frm, text="Ya hay una SUPABASE_SERVICE_KEY guardada.", fg=GREEN).grid(
            row=1, column=0, columnspan=3, sticky="w")
    entries: dict = {}
    secret_entries = []
    for i, (key, label, secret, value) in enumerate(fields, start=2):
        tk.Label(frm, text=label).grid(row=i, column=0, sticky="w", pady=3)
        e = tk.Entry(frm, width=60, show="•" if secret else "")
        e.insert(0, value)
        e.grid(row=i, column=1, pady=3)
        entries[key] = e
        if secret:
            secret_entries.append(e)
    fdb_row = len(fields) + 1

    def browse():
        p = filedialog.askopenfilename(title="PDVDATA.FDB", filetypes=[("Firebird", "*.fdb *.FDB")])
        if p:
            entries["FDB_PATH"].delete(0, "end")
            entries["FDB_PATH"].insert(0, os.path.normpath(p))

    tk.Button(frm, text="Buscar...", command=browse).grid(row=fdb_row, column=2, padx=4)
    show = tk.BooleanVar(value=False)
    tk.Checkbutton(frm, text="Mostrar llaves", variable=show,
                   command=lambda: [e.config(show="" if show.get() else "•") for e in secret_entries]
                   ).grid(row=fdb_row + 1, column=1, sticky="w")

    state = {"install": False, "saved": False}

    def save(and_install: bool):
        form = {k: entries[k].get() for k in entries if k != "FDB_PATH"}
        fdb_path = entries["FDB_PATH"].get().strip().strip('"')
        form["FDB_DSN"] = L.dsn_from_path(fdb_path)
        values = L.merge_config(existing, form)
        problems = L.validate_config(values)
        if problems:
            messagebox.showerror("Revisa", "\n".join(problems), parent=root)
            return
        if fdb_path and not os.path.isfile(L.path_from_dsn(fdb_path)):
            if not messagebox.askyesno("Ruta", f"No existe:\n{fdb_path}\n\n¿Guardar de todos modos?", parent=root):
                return
        try:
            write_config(values)
        except Exception as e:  # noqa: BLE001
            log.exception("No se pudo guardar config.env")
            messagebox.showerror("Error", f"No se pudo guardar: {e}", parent=root)
            return
        state.update(saved=True, install=and_install)
        if not and_install:
            messagebox.showinfo("Guardado", f"Guardado en {CONFIG_PATH}", parent=root)
        root.destroy()

    btns = tk.Frame(frm)
    btns.grid(row=fdb_row + 2, column=0, columnspan=3, pady=(12, 0))
    tk.Button(btns, text="Guardar", width=16, command=lambda: save(False)).pack(side="left", padx=6)
    tk.Button(btns, text="Guardar e instalar", width=18, command=lambda: save(True)).pack(side="left", padx=6)
    tk.Button(btns, text="Cancelar", width=12, command=root.destroy).pack(side="left", padx=6)
    root.mainloop()

    if state["install"]:
        _big_window(install)
    return 0 if state["saved"] else 1


def status_text() -> str:
    parts = ["== Tarea programada ==\n"]
    try:
        res = _run(L.query_task_argv(), timeout=30)
        parts.append((res.stdout or res.stderr or "").strip() or "(sin salida)")
    except Exception as e:  # noqa: BLE001
        parts.append(f"No se pudo consultar: {e}")
    parts.append(f"\n\n== {CONFIG_PATH} ==\n")
    parts.append("existe" if os.path.isfile(CONFIG_PATH) else "NO existe")
    for name in ("agent.log", "instalador.log"):
        path = os.path.join(DATA_DIR, name)
        parts.append(f"\n\n== últimas líneas de {path} ==\n")
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                parts.append("".join(f.readlines()[-40:]))
        except OSError:
            parts.append("(no existe todavía)")
    return "".join(parts)


def uninstall() -> int:
    from tkinter import Tk, messagebox

    root = Tk()
    root.withdraw()
    if not messagebox.askyesno("Desinstalar", "¿Quitar la tarea programada de ArbolitoSync?"):
        return 1
    res = _run_ps(L.build_uninstall_script())
    msg = "Tarea quitada." if res.returncode == 0 else "No se pudo quitar la tarea (ver instalador.log)."
    if messagebox.askyesno("Desinstalar", msg + f"\n\n¿Borrar también {DATA_DIR}\n(config.env con llaves y logs)?"):
        for h in list(log.handlers):  # soltar instalador.log
            h.close()
            log.removeHandler(h)
        running_inside = os.path.normcase(os.path.abspath(sys.executable)).startswith(
            os.path.normcase(os.path.abspath(DATA_DIR)))
        if running_inside:
            # No se puede borrar el .exe que está corriendo: borrar al salir.
            subprocess.Popen(["cmd", "/c", f'ping 127.0.0.1 -n 4 >nul & rmdir /s /q "{DATA_DIR}"'],
                             creationflags=NO_WINDOW)
        else:
            shutil.rmtree(DATA_DIR, ignore_errors=True)
        messagebox.showinfo("Desinstalar", "Listo. Se borró la carpeta.")
    else:
        messagebox.showinfo("Desinstalar", msg)
    return 0


# ---------------------------------------------------------------------------
# Modos del agente (los corre la tarea programada)
# ---------------------------------------------------------------------------
def _import_agent():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.environ["ARBOLITO_DATA_DIR"] = DATA_DIR
    import agent  # noqa: PLC0415 — se importa después de fijar ARBOLITO_DATA_DIR

    return agent


def dry_run_window() -> int:
    agent = _import_agent()
    from firebird_reader import EleventaReadError

    buf = io.StringIO()
    code = 1
    with contextlib.redirect_stdout(buf):
        try:
            code = agent.dry_run()
        except EleventaReadError as e:
            print(f"ERROR: {e}")
        except Exception as e:  # noqa: BLE001
            print(f"ERROR inesperado: {e}")
    out = buf.getvalue()
    with open(os.path.join(DATA_DIR, "dry-run.txt"), "w", encoding="utf-8") as f:
        f.write(out)
    try:
        _text_window("ArbolitoSync --dry-run", out)
    except Exception:  # noqa: BLE001 — sin Tk: al menos queda dry-run.txt
        pass
    return code


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog=L.EXE_NAME, description="Sincronización El Arbolito")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--configurar", action="store_true", help="Formulario de llaves (Hermann)")
    g.add_argument("--estado", action="store_true", help="Ver tarea y logs")
    g.add_argument("--desinstalar", action="store_true", help="Quitar la tarea")
    g.add_argument("--agente", action="store_true", help="Bucle del agente (lo usa la tarea)")
    g.add_argument("--once", action="store_true", help="Un ciclo real y salir")
    g.add_argument("--dry-run", action="store_true", help="Solo leer Eleventa y mostrar resumen")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    _quiet_std_streams()
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.agente or args.once:
        return _import_agent().run(once=args.once)
    if args.dry_run:
        return dry_run_window()

    _setup_log()
    log.info("ArbolitoSync iniciado (%s) desde %s", " ".join(sys.argv[1:]) or "primer arranque", sys.executable)
    if args.configurar:
        return configure_window()
    if args.estado:
        _text_window("ArbolitoSync - estado", status_text())
        return 0
    if args.desinstalar:
        return uninstall()
    _big_window(install)
    return 0


if __name__ == "__main__":
    sys.exit(main())
