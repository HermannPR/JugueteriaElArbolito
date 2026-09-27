"""Genera guia-instalacion-tia.pdf (letra grande, recuadros simples, sin capturas).

Uso (requiere reportlab, solo para regenerar el PDF; el agente no lo necesita):
    pip install reportlab
    python generar_guia_pdf.py

El contenido es el mismo de guia-instalacion-tia.md; si cambias uno, cambia el otro.
"""
from __future__ import annotations

import os

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "guia-instalacion-tia.pdf")

# Fuente con acentos: DejaVu si existe (Linux), si no Helvetica.
FONT, BOLD = "Helvetica", "Helvetica-Bold"
for regular, bold in (
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
):
    if os.path.isfile(regular) and os.path.isfile(bold):
        pdfmetrics.registerFont(TTFont("Guia", regular))
        pdfmetrics.registerFont(TTFont("Guia-Bold", bold))
        # Para que <b> en los párrafos use la negrita registrada.
        pdfmetrics.registerFontFamily("Guia", normal="Guia", bold="Guia-Bold",
                                      italic="Guia", boldItalic="Guia-Bold")
        FONT, BOLD = "Guia", "Guia-Bold"
        break

GREEN = colors.HexColor("#1b7a2f")
ORANGE = colors.HexColor("#b35c00")
BLUE = colors.HexColor("#1f5fae")
SOFT_YELLOW = colors.HexColor("#fff6d6")
SOFT_GREEN = colors.HexColor("#e6f4ea")
SOFT_BLUE = colors.HexColor("#e7effa")
GREY = colors.HexColor("#444444")

title = ParagraphStyle("t", fontName=BOLD, fontSize=30, leading=36, spaceAfter=8, textColor=GREEN)
step = ParagraphStyle("s", fontName=BOLD, fontSize=28, leading=34, spaceBefore=6, spaceAfter=10,
                      textColor=BLUE)
body = ParagraphStyle("b", fontName=FONT, fontSize=20, leading=28, spaceAfter=10, textColor=colors.black)
big_center = ParagraphStyle("bc", parent=body, alignment=TA_CENTER, fontSize=22, leading=30)
cell = ParagraphStyle("c", fontName=FONT, fontSize=17, leading=22)
cell_b = ParagraphStyle("cb", fontName=BOLD, fontSize=17, leading=22)
small = ParagraphStyle("sm", fontName=FONT, fontSize=11.5, leading=15, spaceAfter=5, textColor=GREY)
small_h = ParagraphStyle("smh", fontName=BOLD, fontSize=14, leading=18, spaceBefore=8, spaceAfter=4)
code = ParagraphStyle("code", fontName="Courier", fontSize=10.5, leading=13, backColor=colors.HexColor("#f2f2f2"),
                      borderPadding=5, spaceBefore=3, spaceAfter=8)

WIDTH = letter[0] - 4 * cm


def box(paragraphs, bg, border):
    t = Table([[paragraphs]], colWidths=[WIDTH])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 2.5, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t


def foto_box():
    return box([Paragraph("Si ves algo raro, <b>mándale foto a Hermann</b>.", big_center),
                Paragraph("No pasa nada malo.", big_center)], SOFT_YELLOW, ORANGE)


def two_col(rows):
    data = [[Paragraph("<b>Si dice…</b>", cell_b), Paragraph("<b>Tú haces…</b>", cell_b)]]
    data += [[Paragraph(a, cell), Paragraph(b, cell)] for a, b in rows]
    t = Table(data, colWidths=[WIDTH * 0.48, WIDTH * 0.52])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOFT_BLUE),
        ("GRID", (0, 0), (-1, -1), 1.5, BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


# --- Dibujos simples (no son capturas reales) -------------------------------
def dibujo_archivo():
    d = Drawing(WIDTH, 120)
    x = WIDTH / 2 - 45
    d.add(Polygon([x, 20, x + 90, 20, x + 90, 90, x + 70, 110, x, 110],
                  fillColor=colors.white, strokeColor=BLUE, strokeWidth=3))
    d.add(Line(x + 70, 110, x + 70, 90, strokeColor=BLUE, strokeWidth=2))
    d.add(Line(x + 70, 90, x + 90, 90, strokeColor=BLUE, strokeWidth=2))
    d.add(Rect(x + 20, 45, 50, 35, fillColor=GREEN, strokeColor=None, rx=4, ry=4))
    d.add(String(WIDTH / 2, 3, "ArbolitoSync.exe", fontName=BOLD, fontSize=16, textAnchor="middle"))
    return d


def dibujo_doble_clic():
    d = Drawing(WIDTH, 110)
    cx = WIDTH / 2
    d.add(Rect(cx - 30, 10, 60, 90, rx=28, ry=28, fillColor=colors.white, strokeColor=GREY, strokeWidth=3))
    d.add(Line(cx, 100, cx, 62, strokeColor=GREY, strokeWidth=2))
    d.add(Rect(cx - 28, 62, 28, 36, rx=10, ry=10, fillColor=BLUE, strokeColor=None))
    d.add(String(cx + 45, 75, "clic, clic", fontName=BOLD, fontSize=18, fillColor=BLUE))
    return d


def dibujo_ventana(titulo, texto, color, botones):
    d = Drawing(WIDTH, 150)
    x, w = 40, WIDTH - 80
    d.add(Rect(x, 10, w, 135, fillColor=colors.white, strokeColor=GREY, strokeWidth=2))
    d.add(Rect(x, 120, w, 25, fillColor=colors.HexColor("#dddddd"), strokeColor=GREY, strokeWidth=2))
    d.add(String(x + 10, 128, titulo, fontName=FONT, fontSize=12, fillColor=GREY))
    d.add(String(x + w / 2, 80, texto, fontName=BOLD, fontSize=20, fillColor=color, textAnchor="middle"))
    bx = x + w / 2 - (len(botones) * 110) / 2
    for i, b in enumerate(botones):
        d.add(Rect(bx + i * 110 + 5, 22, 95, 32, rx=5, ry=5, fillColor=colors.HexColor("#f0f0f0"),
                   strokeColor=BLUE if i == 0 else GREY, strokeWidth=3 if i == 0 else 1.5))
        d.add(String(bx + i * 110 + 52, 33, b, fontName=BOLD, fontSize=15, textAnchor="middle"))
    return d


def build():
    doc = SimpleDocTemplate(OUT, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=1.6 * cm, bottomMargin=1.6 * cm,
                            title="Cómo instalar el programa de la tienda", author="Juguetería El Arbolito")
    s = []
    # Página 1: portada corta + pasos 1 y 2
    s += [Paragraph("Cómo instalar el programa de la tienda", title),
          Paragraph("Son <b>5 pasos</b>. Tardas unos 5 minutos.", body),
          foto_box(), Spacer(1, 14)]
    s += [KeepTogether([
        Paragraph("Paso 1. Guarda el archivo", step),
        Paragraph("Hermann te manda un archivo llamado <b>ArbolitoSync.exe</b> por <b>WhatsApp</b>.", body),
        Paragraph("Guárdalo en el <b>Escritorio</b> de la computadora de la tienda.", body),
        dibujo_archivo(),
        Spacer(1, 12),
        Paragraph("Si no sabes cómo guardarlo, llama a Hermann y él te dice.", body),
    ])]
    s.append(PageBreak())
    s += [KeepTogether([
        Paragraph("Paso 2. Ábrelo", step),
        Paragraph("En el Escritorio busca <b>ArbolitoSync</b> y dale <b>doble clic</b>.", body),
        dibujo_doble_clic(),
    ]), Spacer(1, 10)]
    s += [KeepTogether([
        Paragraph("Paso 3. Dale permiso", step),
        Paragraph("Pueden salir <b>una o dos</b> ventanas azules:", body),
        two_col([
            ("«Windows protegió su PC»", "Clic en <b>Más información</b> y luego en <b>Ejecutar de todas formas</b>"),
            ("«¿Quieres permitir que esta aplicación haga cambios?»", "Clic en <b>Sí</b>"),
        ]),
        Spacer(1, 8),
        dibujo_ventana("Control de cuentas de usuario", "¿Permitir cambios?", BLUE, ["Sí", "No"]),
    ])]
    s.append(PageBreak())
    s += [KeepTogether([
        Paragraph("Paso 4. Espera el aviso", step),
        Paragraph("Sale una ventana con letras grandes. Espera un momento.", body),
        dibujo_ventana("El Arbolito", "Listo, ya está funcionando.", GREEN, ["Cerrar"]),
        Spacer(1, 8),
        two_col([
            ("<b>Listo, ya está funcionando.</b>", "Clic en <b>Cerrar</b>. ¡Ya terminaste!"),
            ("<b>Falta la configuración. Avísale a Hermann.</b>",
             "Clic en <b>Cerrar</b> y avísale a Hermann. Él lo arregla."),
            ("Cualquier otra cosa", "Tómale <b>foto</b> a la pantalla y mándasela a Hermann."),
        ]),
    ])]
    s.append(PageBreak())
    s += [KeepTogether([
        Paragraph("Paso 5. Ya no tienes que hacer nada", step),
        box([Paragraph("• El programa <b>arranca solo</b> cada vez que prendes la computadora.", body),
             Paragraph("• Usa Eleventa <b>como siempre</b>.", body),
             Paragraph("• <b>No borres</b> el archivo del Escritorio.", body)], SOFT_GREEN, GREEN),
        Spacer(1, 20),
        foto_box(),
    ])]
    s.append(PageBreak())
    # Página final: Hermann (letra normal)
    s += [Paragraph("Solo para Hermann", ParagraphStyle("h", parent=step, fontSize=20, leading=24)),
          Paragraph("1. Compilar (en tu PC Windows; Python 3.11+ de 32 bits recomendado)", small_h),
          Paragraph("powershell -ExecutionPolicy Bypass -File .\\agent\\build_exe.ps1", code),
          Paragraph("Sale <b>agent\\dist\\ArbolitoSync.exe</b> y su SHA256. Pásalo por WhatsApp o USB. "
                    "Nunca lo subas a GitHub ni a un enlace público. El .exe <b>no</b> lleva llaves.", small),
          Paragraph("2. Configurar (en remoto, en la PC de la tienda, una sola vez)", small_h),
          Paragraph("ArbolitoSync.exe --configurar", code),
          Paragraph("Llenar SUPABASE_URL, SUPABASE_SERVICE_KEY, NTFY_URL, NTFY_TOPIC, NTFY_TOKEN y la ruta de "
                    "PDVDATA.FDB → <b>Guardar e instalar</b>. Se guarda en "
                    "C:\\ProgramData\\ArbolitoSync\\config.env, legible solo por SYSTEM y Administradores "
                    "(icacls por SID). Un campo de llave vacío conserva la guardada.", small),
          Paragraph("3. Verificar que corre", small_h),
          Paragraph("ArbolitoSync.exe --estado", code),
          Paragraph("Tarea <b>ArbolitoSyncAgent</b> en «En ejecución» y últimas líneas de agent.log.", small),
          Paragraph("ArbolitoSync.exe --dry-run", code),
          Paragraph("Cuenta de productos leídos de Eleventa (no manda nada; también queda en dry-run.txt).", small),
          Paragraph("Panel web → <b>Sistema</b>: heartbeat reciente (menos de 15 min). "
                    "Logs: C:\\ProgramData\\ArbolitoSync\\agent.log e instalador.log.", small),
          Paragraph("Desinstalar: ArbolitoSync.exe --desinstalar (quita la tarea y, si confirmas, la carpeta).",
                    small)]

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont(FONT, 10)
        canvas.setFillColor(GREY)
        canvas.drawCentredString(letter[0] / 2, 0.9 * cm,
                                 f"Juguetería El Arbolito · página {doc_.page}")
        canvas.restoreState()

    doc.build(s, onFirstPage=footer, onLaterPages=footer)
    return OUT


if __name__ == "__main__":
    print(build())
