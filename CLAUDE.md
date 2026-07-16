# REPS — guía del proyecto

## Qué es

PWA personal de hábitos de Luis Fernando. 100% offline-first: **no hay
backend, no hay build, no hay dependencias** — HTML/CSS/JS puros servidos
por GitHub Pages. Todos los datos viven en localStorage del dispositivo.

- Producción: https://ardentisdx.github.io/reps/ (repo `ArdentisDX/reps`, rama `main`)
- Instalada como app en el Android del usuario. El sitio se publica solo
  al hacer push (1–2 min).

## Estructura

```
index.html      Toda la estructura: 5 pestañas (Hoy, Mi día, Ruta, Bandeja,
                Stats), hoja de temas, toast. Los paneles son divs .panel
                que se muestran/ocultan con la clase .active.
css/styles.css  Una sola hoja. Variables en :root; secciones marcadas con
                /* ===== Nombre ===== */ en el mismo orden que app.js.
js/app.js       Toda la lógica en un único IIFE, en secciones:
                hábitos/racha → Bandeja → Stats → Compartir mes →
                Plan semanal → Cierre del día → Temas → Respaldo → init.
sw.js           Service worker (cache offline). La constante CACHE lleva
                la versión: reps-vN.
manifest.json   Identidad PWA (standalone, portrait, íconos).
icons/          3 PNG generados: 192, 512 y 512-maskable.
```

## localStorage — todas las claves

Las fechas siempre son cadenas `YYYY-MM-DD` en hora **local** (función
`localISO`; `today()` es la de hoy). Nunca usar `toISOString().slice()`
directo sobre un Date: corre el día en zonas horarias negativas.

| Clave | Forma | Notas |
|---|---|---|
| `reps-dias` | `{fecha: {habitoId: bool}}` | Día "ganado" = todos los hábitos `core` (según la lista actual) en true (`isWon`). Registros vacíos son válidos. Las claves son IDs de `reps-habitos`; por eso los IDs son inmutables (renombrar no rompe el historial). |
| `reps-habitos` | `[{id, name, hint, core, days, planB, emoji, porQue}]` | `porQue` = motivo opcional del hábito (aditivo, como emoji); se muestra en cursiva 💭 en la tarjeta si el hábito no está hecho. El editor permite reordenar arrastrando el asa ⠿ (el orden del array ES el orden visible). Hábitos editables (antes constante en el código). IDs inmutables. `emoji` = ícono opcional del hábito (aditivo, saneado en `sanearEmoji`, sin migración); se muestra antes del nombre en la tarjeta. Editor en Hoy. `days` ∈ `'all'` o array de días de semana (0=dom..6=sáb); lo añadió la migración 5→6. `planB` = versión mínima opcional (aditivo, saneado en `sanearHabitos`, sin migración); se muestra en la tarjeta si el hábito no está hecho. Editor en Hoy. Reglas: máx 8, entre 2 y 4 core. `CORE` se deriva con `rebuildCore()`, pero `isWon(rec, fecha)` usa `coreDelDia(fecha)`: un día sin core programado es **descanso** (neutral: ni ganado ni perdido; `esDescanso`/`esGanado`). |
| `reps-bandeja` | `[{id, text, cat, done, created}]` | Ideas, más nuevas primero. `cat` ∈ ya/social/compras/aprender/algundia. `addIdea(texto, cat)` es la única puerta de entrada (pensada para la IA de fase 2). |
| `reps-cierres` | `{fecha: {animo, notas, plan, guardado, despierta, despiertaCuenta}}` | `animo` ∈ bien/regular/mal o null. El `plan` de la fecha X se muestra como "Plan de hoy" el día X+1. `despierta` = hora "H:MM" en que despertaste ese día; `despiertaCuenta` = override booleano opcional de si ese día cuenta para el puntaje (findes por defecto no cuentan). Ambos aditivos, editables desde la tarjeta Despertar (Hoy) y el detalle de día. Editable retroactivamente (detalle del calendario en Stats es EDITABLE: hábitos, ánimo, notas, despertar). |
| `reps-despertar` | `{meta, rigor, finde}` | Config de "Despertar a tiempo". `meta` = hora "H:MM" objetivo; `rigor` ∈ suave/medio/estricto (margen y castigo por tardanza: grace 120/30/0 min, −3/−5/−8 pts por hora tarde); `finde` = si los fines de semana cuentan por defecto. NO toca isWon/racha: `despertarEval(fecha).modifier` (+6 puntual/antes, − tarde, 0 si no cuenta) solo modifica `puntajeDia`. Ajustes en el sheet de temas. Clave aditiva, sin schema. |
| `reps-semana` | `{fecha: "texto"}` | Plan semanal, plano por día. Vacío = clave borrada. Una "semana" se deriva (lunes = `mondayOf`), no se guarda. El botón "🤖 Diseñar mi semana" (`#semIA`) lee los días escritos de la semana visible + `contextoIA()`, pide a `/ia` un JSON `{dias:[{fecha,tareas,flex}]}` (`sanearSemIA`), muestra vista previa y —tras confirm— **suma las tareas** al texto de cada día y guarda el `flex` en `reps-semana-flex`. |
| `reps-semana-flex` | `{fecha: "texto"}` | Ajuste de flexibilidad por día que propone el diseñador de semana con IA (ej. "día de viaje: hazlo ligero"). Plano por día. Lo muestra el banner "Plan de hoy" de Hoy (`renderPlanHoy`, línea 🤖 en `#planHoyFlex`). Aditiva, va en el respaldo. |
| `reps-plan-semana` | `{lunesKey: {foco, pendientes, eventos, guardado}}` | Plan de la semana (pop dominical): enfoque, pendientes y eventos de la semana que empieza en `lunesKey`. El domingo auto-abre el sheet para la semana ENTRANTE (`planSemTarget`); entre semana el botón de Mi día edita la actual. Tarjeta "Esta semana" en Mi día. Será el contexto del asistente IA (Capa 3.2). Va en el respaldo. `reps-plansem-visto` (fecha) es su marca transitoria de "ya saltó hoy" — NO va en el respaldo. Claves aditivas. |
| `reps-cierre-semana` | `{lunesKey: {animo, mejor, intencion, guardado}}` | Cierre de semana (ritual dominical), indexado por el lunes de la semana. Vive en Mi día bajo el plan; sigue la semana visible (`weekOff`). Clave aditiva. |
| `reps-tema` | `{modo:'preset', id}` o `{modo:'custom', accent, bg}` | Validar con `themeValido()` antes de aplicar. |
| `reps-distribucion` | `"compacto"`, `"minimal"` o ausente (= normal) | Distribución de la interfaz: clases `compact`/`minimal` en `<body>`. Sustituyó a `reps-compacto` en el schema v3 (migración 2→3). |
| `reps-efecto` | `"glass"`, `"clay"`, `"neon"` o ausente (= ninguno) | Efecto visual, INDEPENDIENTE del tema/color. Clases `fx-*` en `<body>`. En v4 se separó del tema "Cristal" (migración 3→4). |
| `reps-racha` | `{congeladores, fabRun, procesadoHasta, congelados:{fecha:true}}` | Protector de racha. `congeladores` 0–2. `procesarRacha()` avanza día por día desde `procesadoHasta` hasta ayer: cada 7 ganados fabrica 1 (máx 2), un día perdido gasta uno y marca `congelados[fecha]`. Nunca procesa "hoy" (en curso). |
| `reps-caidas` | `{fecha: motivoId}` | Ritual de derrota: por qué murió una racha ese día. `motivoId` ∈ desvelo/celular/animo/imprevisto/otro. Clave aditiva (sin cambio de schema); alimenta un insight de El Espejo. |
| `reps-hitos` | `["dias7", "racha14", ...]` | IDs de hitos ya celebrados (para no repetir). `loadHitos()` siembra los ya logrados sin celebrar la primera vez; `checkHitos()` festeja solo los nuevos. Clave aditiva. Los temas se desbloquean por `statsData().total` (sin clave). |
| `reps-perfil` | `{nombre, despertar, construir:[], tiempo, creado}` o `{saltado:true, creado}` | Perfil del cuestionario de bienvenida (onboarding). Su presencia = onboarding completado (no reaparece). En instalación nueva (sin `reps-dias`/`reps-perfil`/`reps-habitos`) el asistente auto-abre; `generarHabitos()` arma la lista. Re-lanzable desde Ajustes. Será el contexto de la IA (fase 2). Clave aditiva. |
| `reps-foco` | `"N"` (minutos, número como string) | Total de minutos enfocados (temporizador de foco). Solo crece; se muestra en Identidad. El temporizador usa reloj real (`endTime`) para sobrevivir al throttle en segundo plano, y Wake Lock para no apagar pantalla. Clave aditiva. |
| `reps-foco-sonido` | `"0"` o ausente (= encendido) | Preferencia GLOBAL de sonido/vibración (nombre heredado del foco). Controla la campanita del temporizador (`sonarFin`), el pop al completar hábito/meta/idea (`sonarCheck`) y el fanfarrón al ganar el día/meta grande (`sonarGanado`). Todos sintetizados con Web Audio (sin archivos). Toggle en Ajustes y en la pantalla de foco (ambos editan la misma variable `focoSonido`). El `AudioContext` se desbloquea en cualquier gesto (los checks ya lo son; el fin del foco se pre-desbloquea en "Empezar"). Clave aditiva. |
| `reps-capas` | `[{titulo, cuando, items:[], cond}]` | "Mi ruta": el plan de largo plazo por capas, editable (antes fijo en el HTML con la historia del autor). La primera es "Activa", el resto "En fila". Editor en Ruta (título, cuándo, items multilínea, condición; agregar/borrar) y botón "🤖 Diseñar con IA" (`/ia` con `contextoIA`, esquema `{capas:[...]}`, `sanearCapas`, confirm antes de aplicar). `CAPAS_DEFAULT` genérico. Aditiva, va en el respaldo. |
| `reps-recordatorios` | `[{id, texto, hora, creado}]` | Recordatorios diarios (medicinas, etc.) con `hora` opcional "H:MM". Viven en la pestaña Ruta. Palomearlos (estado por fecha en `reps-record-hechos` `{fecha:{id:true}}`) da +2 al `puntajeDia` (tope +10, vía `bonoRecordatorios`). Los que tienen hora entran a `espejoParaSW`/`horasAviso` → también se notifican ("💊 texto"). Ambas claves aditivas, van en el respaldo. |
| `reps-nav` | `"arriba"` o ausente (= abajo) | Posición de la barra de navegación. Abajo (clase `body.nav-bottom`, con íconos por pestaña) es el predeterminado; `"arriba"` la fija arriba. Ajuste en el sheet de temas. Aditiva. |
| `reps-fuente` | `"sistema"` o ausente (= serif) | Tipografía. Serif elegante (Georgia en títulos, clase `body.font-serif`) por defecto; `"sistema"` usa la del teléfono. Sin fuentes externas (offline). Aditiva. |
| `reps-metas` | `[{id, texto, plazo, hecha, creada}]` | Metas del usuario; `plazo` ∈ corto/mediano/largo. Viven arriba de la pestaña Ruta, agrupadas por plazo con barra de progreso. Cierran la mitad pendiente de la Capa 2. Clave aditiva. |
| `reps-rutina` | `[{id, hora, nombre, desc, tipo}]` | Bloques del timeline de Mi día (antes HTML fijo). `hora` = `"H:MM"`; `tipo` ∈ core (estructura) / free. Se ordenan por hora con la madrugada (<4 am) al final (`minutosDe`). Editor en Mi día; las alarmas (`botonAlarma`) se integran en `renderRutina()`. Ausente = rutina de fábrica. Clave aditiva. |
| `reps-carta` | `{texto, fecha}` o ausente | Carta a tu yo perdido: se escribe desde Ajustes y SOLO se muestra dentro del modo rescate (2+ días caídos). Guardar vacía = borrar. Clave aditiva. |
| `reps-recompensas` | `[{id, premio, dias, cobrada, creada}]` | Tratos contigo mismo: "a los N días ganados, el premio". Progreso derivado de `statsData().total`; botón Cobrar al alcanzarla. Viven bajo Metas en Ruta. Clave aditiva. (El ruido de foco no guarda clave: decisión por sesión.) |
| `reps-compa` | `{nombre, criatura, emoji}` | Personalización del compañero (antes solo derivado del total). `criatura` ∈ ids de `CRIATURAS` (planta/delfín/jirafa/gato/perro/zorro/búho/dragón/pingüino/tortuga); `emoji` = emoji custom que gana sobre la criatura (saneado con `sanearEmoji`). La etapa (nivel) sigue derivándose del total con `COMPA_ETAPAS` (nombres genéricos: Cría→Legendario); `compaEmojiDe(total)` decide el ícono (custom > etapa de la planta > emoji fijo de la criatura). Editor tocando la tarjeta (`#compaWrap`). Aditiva, va en el respaldo. |
| `reps-stories` | `"YYYY-MM-DD"` (última fecha mostrada) | Estado de UI de las Stories del día (carrusel estilo Instagram): guarda el día en que se auto-abrieron para no repetir hasta el día siguiente. Las tarjetas se derivan del estado (`buildStories()`); el anillo de Hoy (`storyRing`) las relanza. Transitoria: NO va en el respaldo (como `reps-schema`/`reps-pre-migracion`). Clave aditiva, sin schema. |
| `reps-push` | `"1"` o ausente | Notificaciones push activadas en ESTE dispositivo (Capa 3). Transitoria y por-dispositivo: NO va en el respaldo. El Worker `reps-push` (Cloudflare, `workers/push-worker.js`, URL en `PUSH_WORKER`) solo guarda la suscripción + horas de bloques + tz; manda pushes VACÍOS y el texto lo arma el `push` handler de sw.js leyendo el cache `reps-datos` (`rutina-espejo.json`, refrescado en `saveRutina`/init vía `espejoParaSW`). El activate del SW NUNCA debe borrar el cache `reps-datos`. Llave pública VAPID en `PUSH_PUB` (app.js); la privada vive como secreto en Cloudflare. |
| `reps-schema` | `"N"` (número como string) | Versión del FORMATO de los datos. La gestiona `migrate()`; no tocar a mano. |
| `reps-pre-migracion` | `{de, a, fecha, crudo}` | Copia cruda automática previa a la última migración. Solo lectura; no va en el respaldo exportado. |

**Reglas de oro de los datos:**
1. Toda carga valida la *forma* (`esMapa`, `Array.isArray`, `themeValido`)
   — localStorage corrupto nunca debe romper la app; se ignora y se usa
   el valor por defecto.
2. El respaldo (Exportar/Importar en Hoy) incluye **todas las claves de
   datos** (dias, bandeja, cierres, semana, tema, distribucion, efecto,
   racha) y declara su `schema`; al importar se migra si viene de una
   versión vieja. Si agregas una clave nueva: súmala a `DATA_KEYS`, a
   `exportBackup`, saneala en `importBackup` y documenta aquí su forma.
3. El "bug de la medianoche": la PWA instalada se suspende, no se cierra.
   Nunca capturar `today()` en un closure de evento — leerlo fresco al
   momento del click. Hay un listener de `visibilitychange` que repinta
   todo cuando la app despierta en un día distinto.

## Versionado de datos y migraciones

Sección `===== Esquema y migraciones =====` de app.js. Dos versiones
conviven y NO deben confundirse: `reps-vN` en sw.js versiona los
*archivos*; `SCHEMA`/`reps-schema` versiona el *formato de los datos*.

**Convención para cambiar el formato de cualquier clave:**
1. Sube la constante `SCHEMA` en 1.
2. Agrega `MIGRATIONS[N]` (donde N es la versión vieja): una función que
   convierte de N a N+1 trabajando **solo sobre localStorage crudo**
   (leer con try/JSON.parse, escribir con JSON.stringify). Nunca debe
   asumir que las claves existen ni que tienen la forma correcta.
3. Las migraciones publicadas **jamás se editan ni se borran**: un
   dispositivo que hibernó tres versiones las recorre en cadena.
4. Actualiza la tabla de claves de este archivo y sube también la
   versión del cache (el JS cambió).

**Garantías que da `migrate()`** (corre antes que cualquier carga, y
también tras importar un respaldo, usando su campo `schema`):
- Sin marca + con datos = v1 (era pre-versionado). Sin marca + sin datos
  = instalación nueva (nace en la versión actual, sin migrar).
- Antes de migrar guarda las cadenas crudas en `reps-pre-migracion`; si
  una migración lanza error, restaura todo tal cual y deja la versión
  vieja — pérdida cero.
- `reps-schema` mayor que `SCHEMA` (datos de una app más nueva): no se
  toca nada.

## Service worker y versionado

`sw.js` precacha el app shell (`ASSETS`) bajo el nombre `reps-vN` y sirve
**cache-first**: primero la copia local, red solo si falta, y solo guarda
respuestas `res.ok` del propio origen. `activate` borra versiones viejas.

**Ritual obligatorio**: cualquier cambio a HTML/CSS/JS/íconos requiere
subir `CACHE` a `reps-vN+1` — es la señal de actualización para los
dispositivos. La actualización llega en la *segunda* apertura de la app
(primera: descarga en segundo plano; segunda: estrena). Cambios solo de
documentación (`.md`) no necesitan subir versión.

**Al probar en local**: el SW del navegador de prueba sirve la app vieja
del cache. Antes de verificar cambios: desregistrar SW + borrar caches +
recargar (o el cambio parecerá "no funcionar").

## Sistema de temas

Un tema = un juego de valores para las mismas variables CSS de `:root`
(`--bg --card --card-2 --line --text --muted --amber --on-accent --teal`).
`applyVars()` las escribe con `setProperty` en `document.documentElement`
y actualiza el `<meta theme-color>`. Nada más.

- `--amber` es **el color de acento** (nombre heredado); `--on-accent` es
  el texto legible sobre él.
- Los tonos translúcidos derivan del acento vía `color-mix()` en el CSS —
  **nunca** escribir rgba con el color quemado en duro.
- Modo custom: `customVars(accent, bg)` deriva la paleta completa;
  `isLight()` (luminancia percibida) decide el contraste del texto.
- El canvas de "Compartir mi mes" lee las variables vigentes con
  `getComputedStyle` — cualquier feature visual nueva debe hacer lo mismo.

**Efectos (independientes del color)**: `reps-efecto` aplica `fx-glass`
(cristal: fondo con gradientes radiales del acento + `backdrop-filter`) o
`fx-clay` (arcilla: sombras neumórficas) como clase en `<body>`. Se
combinan con CUALQUIER tema o color custom — por eso viven separados del
tema. Un efecto nuevo = una clase `fx-*` en CSS + su id en el array `FXS`.

## Convenciones

- Idioma de la interfaz, comentarios y commits: **español**.
- Sin frameworks ni build: si una feature "necesita" una librería,
  replantearla. Sin dependencias es la garantía del offline eterno.
- Texto de usuario al DOM siempre con `textContent`, nunca `innerHTML`.
- Feedback de acciones con `toast()`. Confirmaciones destructivas con
  `confirm()`.
- Cada sección nueva de JS/CSS lleva su banner `===== Nombre =====` y
  respeta el orden de secciones existente.
- El usuario está aprendiendo a programar: explicar los cambios paso a
  paso y esperar su confirmación en flujos multi-paso.
- Al terminar una feature: verificar en navegador, subir versión de
  cache, commit (mensaje en español, cuerpo breve) y push.
- Visión de largo plazo: `ROADMAP.md` (fases y notas técnicas) y
  `VISION.md` (sueños priorizados, modos de interfaz, plan de 8 semanas).
