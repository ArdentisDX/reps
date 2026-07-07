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
| `reps-dias` | `{fecha: {habitoId: bool}}` | Día "ganado" = los 3 hábitos `core` en true (`isWon`). Registros vacíos son válidos (significan "abrió la app y no hizo nada"). |
| `reps-bandeja` | `[{id, text, cat, done, created}]` | Ideas, más nuevas primero. `cat` ∈ ya/social/compras/aprender/algundia. `addIdea(texto, cat)` es la única puerta de entrada (pensada para la IA de fase 2). |
| `reps-cierres` | `{fecha: {animo, notas, plan, guardado}}` | `animo` ∈ bien/regular/mal o null. El `plan` de la fecha X se muestra como "Plan de hoy" el día X+1. |
| `reps-semana` | `{fecha: "texto"}` | Plan semanal, plano por día. Vacío = clave borrada. Una "semana" se deriva (lunes = `mondayOf`), no se guarda. |
| `reps-tema` | `{modo:'preset', id}` o `{modo:'custom', accent, bg}` | Validar con `themeValido()` antes de aplicar. |

**Reglas de oro de los datos:**
1. Toda carga valida la *forma* (`esMapa`, `Array.isArray`, `themeValido`)
   — localStorage corrupto nunca debe romper la app; se ignora y se usa
   el valor por defecto.
2. El respaldo (Exportar/Importar en Hoy) incluye **las 5 claves**. Si
   agregas una clave nueva: súmala a `exportBackup`, saneala en
   `importBackup` y documenta aquí su forma.
3. El "bug de la medianoche": la PWA instalada se suspende, no se cierra.
   Nunca capturar `today()` en un closure de evento — leerlo fresco al
   momento del click. Hay un listener de `visibilitychange` que repinta
   todo cuando la app despierta en un día distinto.

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
- Visión de largo plazo y fases futuras: ver `ROADMAP.md`.
