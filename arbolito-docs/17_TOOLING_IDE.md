# 17 — Tooling del IDE: Plugins, Skills, MCP y Comandos

> Plan de herramientas para que Claude Opus 4.8 construya este proyecto de forma eficiente y barata en tokens. Distingue lo **no negociable** de lo **recomendado** y lo **opcional**. Pensado para Claude Code (CLI / desktop / IDE).

> ⚠️ El ecosistema de plugins de Claude Code cambia rápido. Los nombres y comandos de instalación de aquí estaban vigentes a mediados de 2026; verificar con `/plugin` dentro de Claude Code antes de instalar.

---

## A. Concepto rápido (para entender qué es cada cosa)
- **Skill:** instrucciones/best-practices que Claude carga cuando aplican (lo más portátil). Las que ya usamos para docx/pptx/xlsx son skills.
- **Plugin:** un paquete que puede traer skills + comandos + hooks + MCP juntos.
- **MCP server:** da a Claude acceso a herramientas/datos externos en vivo (ej. Supabase, docs actualizadas, navegador).
- **Slash command:** un comando (`/algo`) que dispara un flujo.
- **Hook:** script que se ejecuta automáticamente en ciertos eventos (ej. antes de cada commit).
- **CLAUDE.md:** archivo de memoria que Claude lee al inicio de cada sesión (instrucciones permanentes del proyecto).

---

## B. NO NEGOCIABLES (instalar sí o sí)

### B1. MCP de Supabase ⭐ (crítico)
Ya lo usamos en la planeación. Permite a Claude leer/escribir el esquema, ejecutar SQL y migraciones directo contra la base. **Sin esto, el IDE trabaja a ciegas con la base de datos.**
- Es el mismo conector de Supabase que ya está conectado.

### B2. Context7 (MCP de documentación en vivo) ⭐
Inyecta documentación **actualizada y version-específica** de librerías (Next.js, React, Supabase, Mercado Pago SDK, etc.) directo en la sesión. Evita que Claude alucine APIs viejas o parámetros que ya no existen.
- Instalación típica: `/plugin install context7` (o vía su MCP).
- **Por qué no negociable:** Next.js, Supabase y los SDKs de pago cambian seguido; sin docs frescas, el código sale con APIs obsoletas.

### B3. Frontend Design (plugin oficial) ⭐
El plugin de diseño frontend de Anthropic (el más instalado del marketplace). Da a Claude criterio de diseño, tokens de estilo y buenas prácticas de UI. Alineado con la skill `frontend-design` que ya referenciamos en el doc 16.
- Instalación: `/plugin install frontend-design@claude-plugins-official`

### B4. TypeScript LSP (Language Server) ⭐
Da a Claude "inteligencia de código": navegación de tipos, autocompletado real, detección de errores. Para un proyecto Next.js + TypeScript es casi obligatorio para que no genere código con tipos rotos.
- Instalación: vía plugins oficiales (`typescript-language-server`).

### B5. CLAUDE.md del proyecto ⭐
No es plugin, es un archivo. Crear un `CLAUDE.md` en la raíz con: stack, convenciones, estructura de carpetas, reglas del proyecto (las del doc 09), y un índice de la documentación. Claude lo lee en cada sesión. **Es la base de todo.**

---

## C. RECOMENDADOS (mejoran mucho el flujo)

### C1. Caveman (ahorro de tokens) — con expectativas realistas
El que mencionaste. Hace que Claude hable "como caveman" (sin relleno) para gastar menos tokens de salida.
- Instalación: `claude plugin marketplace add JuliusBrussee/caveman` → `claude plugin install caveman@caveman` → activar con `/caveman`.
- **Realidad (importante):** el ahorro real es ~30-50% en tokens de SALIDA, que son la parte barata. El meme dice 75% pero es exagerado. En una sesión típica, la prosa es solo ~4-6% del total de tokens.
- **Lo que SÍ vale la pena de su ecosistema:**
  - `caveman-compress`: comprime el `CLAUDE.md` y archivos de memoria → ahorra tokens de ENTRADA (esos sí son caros y se pagan en cada sesión). **Esto es lo realmente útil.**
  - `/caveman-stats`: mide cuántos tokens/dinero llevas ahorrado.
- **Recomendación:** usar `caveman-compress` sobre el `CLAUDE.md`, y `/caveman lite` o `/caveman full` durante tareas mecánicas largas (no en debugging donde necesitas leer bien lo que pasa).
- **No usar `/caveman ultra`** cuando necesites entender errores; sacrifica claridad.

### C2. Chrome DevTools / Playwright (MCP) — para QA del frontend
Permite a Claude abrir la web en un navegador, inspeccionar, hacer clics y probar flujos (agregar al carrito, checkout). Muy útil para verificar que la tienda funcione de verdad.
- Para la Fase 1+ cuando ya haya UI que probar.

### C3. GitHub (MCP/plugin)
Para que Claude maneje issues, PRs y commits directamente. Útil si versionas el proyecto en GitHub (recomendado).

### C4. Vercel (MCP/plugin)
Da contexto de despliegue: logs, builds, variables de entorno. Útil en la Fase 6 (lanzamiento).

### C5. Comandos oficiales útiles (vienen con Claude Code)
- `/code-review` — revisa el código generado (gratis, oficial).
- `/simplify` — simplifica código sobre-complicado.
- `/debug` — flujo de depuración estructurado.

---

## D. OPCIONALES (según necesidad)

### D1. Firecrawl (MCP de web scraping) — para el sistema de imágenes
Para la Fase 3 (imágenes): además de Google Custom Search, Firecrawl puede buscar/extraer imágenes de productos de sitios de proveedores de forma robusta.
- Solo si la búsqueda automática de imágenes necesita más potencia.

### D2. Codebase Memory MCP (CBM) — para proyectos grandes
Convierte el código en un grafo de conocimiento; Claude consulta el grafo en vez de leer archivos completos (ahorra MUCHOS tokens de entrada). Útil cuando el proyecto ya esté grande (varias decenas de archivos).
- Más relevante en fases avanzadas, no al inicio.

### D3. /batch — paralelizar trabajo
Descompone una tarea grande en 5-30 unidades independientes y las ejecuta en paralelo en git worktrees. Útil si en algún punto hay mucho trabajo repetitivo (ej. generar muchos componentes similares).

---

## E. Stack Recomendado por Fase

| Fase | Tooling clave |
|------|---------------|
| 0 — Datos | MCP Supabase, CLAUDE.md |
| 1 — Tienda pública | Frontend Design, TypeScript LSP, Context7, Caveman-compress |
| 2 — Admin | + Chrome DevTools/Playwright para QA |
| 3 — Imágenes | + Firecrawl (opcional) |
| 4 — Pagos | Context7 (docs de Mercado Pago SDK al día) |
| 5 — Agente sync | Context7 (docs de firebird-driver) |
| 6 — Lanzamiento | Vercel, GitHub, /code-review |

---

## F. Comandos de Setup Inicial (para el IDE)

```bash
# Dentro de Claude Code:

# 1. Plugins oficiales no negociables
/plugin install frontend-design@claude-plugins-official
/plugin install typescript-language-server@claude-plugins-official

# 2. Context7 (docs en vivo)
/plugin install context7

# 3. Caveman (ahorro de tokens) — opcional pero recomendado
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
# Comprimir el CLAUDE.md (lo más útil):
/caveman-compress CLAUDE.md

# 4. MCP Supabase — ya conectado en la cuenta; verificar acceso al
#    project_id nigxlspxlurdxvwnlffu

# 5. Verificar todo
/plugin
```

> Verificar nombres exactos con `/plugin` dentro de Claude Code, ya que el marketplace se actualiza.

---

## G. Qué poner en el CLAUDE.md (plantilla)

```markdown
# Juguetería El Arbolito — Proyecto

## Stack
Next.js 14 (App Router) + TypeScript + Tailwind + Supabase + Vercel.
Pagos: Mercado Pago. Facturación: manual en tienda (no en la web). Agente: Python.

## Reglas (ver docs/09_DECISIONES_CONFIRMADAS.md — fuente de verdad)
- 8 categorías existentes NO se tocan (tienen fotos).
- Productos entran is_approved=false; admin aprueba antes de publicar.
- Agotados (stock=0) se ocultan del catálogo.
- NO meses sin intereses (la tienda no absorbe esa comisión).
- NO devoluciones.
- Stock real = Eleventa; el agente solo LEE el .FDB (nunca escribe con Eleventa abierto).
- Buffer de seguridad para no sobrevender.

## Estructura
/web (Next.js)  /agent (Python)  /supabase  /docs

## Documentación
Leer /docs/00_README_PRINCIPAL.md como índice. 09 manda sobre todo.

## Estilo
Código limpio y tipado. Variables de color para la paleta (azul/blanco tentativo).
Comentarios en español. Mensajes de usuario en español (México).
```

---

## H. Resumen ejecutivo
- **Instala sí o sí:** MCP Supabase, Context7, Frontend Design, TypeScript LSP, y crea el CLAUDE.md.
- **Para ahorrar tokens de verdad:** usa `caveman-compress` sobre el CLAUDE.md (entrada) más que el modo de salida; considera Codebase Memory MCP cuando el proyecto crezca.
- **Para QA real:** Chrome DevTools/Playwright en Fase 2+.
- **No te obsesiones con Caveman runtime:** ahorra poco (output barato). El ahorro grande está en comprimir entrada (CLAUDE.md, contexto) y en no leer archivos completos innecesariamente.
