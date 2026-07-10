# REPS · Visión

> **La misión**: ayudar a gente que se siente perdida a construirse día a
> día. No castigar, no abrumar: 20% orden, 80% libertad, y un "día ganado"
> alcanzable incluso en días malos. REPS no es una app de productividad —
> es una máquina de evidencia de que estás cambiando.
>
> Esfuerzos: **chico** = 1–3 bloques de construcción · **mediano** = ~1–2
> semanas de bloques · **grande** = un mes o más / requiere backend.

---

## 1 · Modos de interfaz (skins completas)

Hoy los temas cambian *colores*. Un **modo** cambia *qué se muestra y
cómo*: mismo motor de datos, otra piel completa.

**Ojo — dos niveles distintos, no confundir:**
- **Efecto** (ya existe: `reps-efecto`) = *piel* sobre el layout actual:
  cristal (glass) y arcilla (clay) hoy; solo CSS, se combinan con
  cualquier color. Barato. Aquí caben más: *neón*, *papel*, *mate*.
- **Modo** (futuro) = *layout* completo distinto. Requiere el refactor de
  view-models de abajo. Aquí caben Bento y UI Espacial.

| Modo | Idea | Esfuerzo |
|---|---|---|
| **Minimalista** ✅ | Solo core, racha y cierre. Ya existe como Distribución. Un modo real lo llevaría más lejos (tipografía y espaciado propios). | hecho (semilla) |
| **Bento** | Retícula de recuadros tipo "bento box": cada dato (racha, %, ánimo, semana, mejor racha) en su celda de tamaño distinto, todo de un vistazo en una pantalla. Muy visual, muy de moda. | grande |
| **UI Espacial** | Fondo de profundidad (estrellas/nebulosa sutil con el acento), tarjetas que "flotan" con parallax leve al scroll, la racha como un planeta que crece. Combina con el efecto cristal. | grande |
| **Futurista / HUD** | Panel de nave: datos densos, tipografía mono, glow del acento, todo visible a la vez. Para quien ama los números. | mediano-grande |
| **Distópico / brutalist** | Crudo: bordes duros, sin redondeos, tipografía condensada gigante, alto contraste. "GANA EL DÍA O NO." | mediano |
| **Retro / pixel** | Gamificado: fuente pixel, el sello "día ganado" como logro de arcade, la racha como barra de vida. | mediano-grande |

> Bento y UI Espacial son **layouts**, no pieles: reordenan la información,
> no solo la repintan. Por eso esperan al refactor de view-models — meterlos
> como CSS sobre el HTML actual daría un resultado frágil. Se hacen bien, o
> se posponen.

### Diseño técnico (documentado hoy, NO implementado)

La arquitectura para que un modo sea intercambiable como hoy lo es un color:

1. **Separar datos de presentación (ya casi está).** Las funciones puras
   (`statsData`, `isWon`, `streak`, `mondayOf`…) no tocan el DOM: son el
   *motor*. El paso pendiente: extraer de cada `render*()` un
   **view-model** — p. ej. `hoyViewModel()` devuelve `{fecha, racha,
   habitos:[{nombre, hecho, core}], won, pct}` sin crear un solo elemento.
2. **Contrato de vista.** Documentar los "slots" que toda skin debe llenar
   (lista de hábitos, racha, sello, progreso). Cada modo implementa sus
   propios `render*()` consumiendo los mismos view-models.
3. **Un modo = 1 archivo CSS + (opcional) 1 archivo JS de renders.**
   `reps-modo` en localStorage decide cuáles cargar; los archivos de cada
   modo entran a `ASSETS` del service worker para que funcionen offline.
   Los modos que solo cambian forma (brutalist) pueden ser CSS puro sobre
   el HTML actual — como el modo compacto, pero a lo grande.
4. **Regla**: el motor y las claves de localStorage jamás saben qué modo
   está activo. Si un modo necesita un dato nuevo, se agrega al
   view-model, no al render.

Esfuerzo del refactor base (pasos 1–2): **mediano**, sin cambio visible.
Hacerlo antes del primer modo nuevo; el modo minimalista es el piloto.

---

## 2 · Ideas de otras apps, adaptadas a la filosofía REPS

**Duolingo — protectores de racha y celebraciones** · esfuerzo: chico
- ✅ **HECHO (jul 2026)**: cada **7 días ganados seguidos fabricas 1
  congelador** (máx. 2). Un día perdido lo consume solo y la racha vive.
  Lógica en `procesarRacha()` (`reps-racha`); el día salvado se marca 🧊
  en el calendario. Encaja con "un día malo es normal, dos seguidos no".
- ✅ **HECHO**: la insignia del ícono (Badging API) muestra los core
  pendientes de hoy — el "widget que te incita a entrar" en su versión PWA.
- Pendiente: celebraciones de hitos (pantalla especial en 7/30/100 reps
  con canvas). Requiere solo `reps-dias` + un contador.

**Habitica — gamificación RPG** · esfuerzo: mediano
- Qué hacen bien: progresar da XP; tu constancia "sube de nivel".
- Versión REPS: XP por rep (core=3, extra=1, cierre=1), niveles con
  nombres del mundo REPS ("Novato del 8:30" → "Arquitecto de días").
  **Sin castigo**: aquí no se pierde XP jamás — el nivel solo sube, como
  la evidencia. Requiere: contador local + tarjeta en Stats. Combina con
  el modo retro/pixel.

**Forest — sesiones de foco** · esfuerzo: mediano
- Qué hacen bien: el temporizador vuelve tangible la sesión de trabajo.
- Versión REPS: botón "iniciar bloque" en los hábitos de bloque:
  temporizador de 25/60 min en pantalla (`setInterval` + Wake Lock API
  para que no se apague). Al completarlo, marca el hábito solo. Los
  minutos enfocados se acumulan como métrica en Stats. Sin árboles que
  mueren: si abandonas, simplemente no cuenta — no castigar.

**WHOOP — tendencias y "recovery"** · esfuerzo: mediano
- Qué hacen bien: te dicen cómo estás HOY con base en tus datos.
- ✅ **Parcial (jul 2026)**: "El Espejo" en Stats ya da insights locales
  (`espejoInsights()`): qué rep sube tu ánimo, tu mejor/peor día de la
  semana, en qué día mueren tus rachas. Pura aritmética sobre `reps-dias`
  + `reps-cierres`, sin IA.
- Pendiente: el **"pulso" diario** (semáforo verde/ámbar/rojo con consejo)
  y las gráficas de tendencia (canvas). Misma fuente de datos.

**Notion — hábitos personalizables** ✅ **HECHO (jul 2026)**
- La herramienta se adapta a la persona, no al revés.
- Editor en Hoy: agregar/renombrar/borrar hábitos y marcar cuáles son core.
  `HABITS` pasó de constante a `reps-habitos`; IDs inmutables (renombrar
  no toca el historial); migración v4→v5 siembra la lista de fábrica.
  Límites: máx 8 hábitos, entre 2 y 4 core (protege el 20/80).
- Nota de diseño: "día ganado" se juzga contra los core actuales; los
  hábitos nuevos nacen como extra y al cambiar core se avisa. (Alternativa
  futura si hace falta: snapshot de core por día.)

**Strava — logros compartidos y retos** · esfuerzo: grande (Capa 5)
- Qué hacen bien: la constancia se vuelve social sin ser competencia pura.
- Versión REPS: fase 1 ya existe (imagen del mes). Fase 2: "reto espejo"
  con un amigo — ambos ven solo el % semanal del otro, nunca el detalle
  (privacidad primero). Requiere cuentas y backend: va al final, con la
  Capa 5. El social de REPS compara *tu semana contra tu semana pasada*,
  no contra extraños.

---

## 3 · Features originales REPS

1. **Modo rescate** · chico — Tras 2 días perdidos (el patrón viejo
   tocando la puerta), la app lo detecta y ofrece: "hoy gana chiquito:
   SOLO despertar y correr". Un día-rescate ganado no rompe estadísticas
   (se marca distinto) pero reconstruye el momentum. Anti-espiral.
2. **Ritual de derrota** · chico — Cuando una racha muere, en vez de un
   cero silencioso: flujo de 30 segundos — "¿qué la mató?" (un tap:
   desvelo/celular/ánimo/imprevisto) + "¿qué cambio chico harías?". La
   derrota se convierte en dato para El Espejo, no en vergüenza.
3. **El Espejo** ✅ **HECHO (jul 2026)** — Correlaciones locales entre tus
   datos: qué rep sube tu ánimo, tu mejor/peor día, en qué día mueren tus
   rachas. `espejoInsights()` en Stats, sin IA. Pendiente: más insights a
   medida que crecen los datos.
4. **Museo de reps** · chico-mediano — Línea de tiempo generada
   automáticamente con tus hitos reales: primera racha de 7, el mes que
   pasaste del 20% al 60%, la idea de la Bandeja que sí hiciste. Para el
   día que digas "no he logrado nada": evidencia, no ánimo vacío.
5. **Plan B por hábito** · chico — Cada hábito con su versión mínima
   ("correr 20 min" → "caminar 5 con la perrita"). En días de pulso bajo,
   el Plan B cuenta como parcial visible. La versión mínima de un hábito
   es lo que lo mantiene vivo — mejor 5 min que 0.
6. **Carta al yo perdido** · chico — Un día bueno, escribes por qué
   empezaste. La app la guarda y solo la muestra cuando llevas 2 días
   perdidos: tu propia voz, no frases de calendario motivacional.
7. **Cápsula del tiempo** · chico — Mensaje a ti mismo sellado 30 días.
   Al abrirse, se muestra junto al calendario de ese mes: lo que creías
   vs. lo que hiciste. Combina con el cierre mensual.
8. **Contador de identidad** ✅ **HECHO (jul 2026)** — En Stats, cada rep
   con su total de todos los tiempos ("Despertar 8:30 · 47×"). Las rachas
   se rompen; los totales solo crecen. La métrica anti-perfeccionismo:
   ningún día malo te quita lo corrido.

---

## 4 · Priorización

| # | Feature | Impacto | Esfuerzo | Nota |
|---|---|---|---|---|
| ✅ | Protector de racha (congeladores) | alto | chico | HECHO jul 2026 |
| ✅ | Contador de identidad | alto | chico | HECHO jul 2026 |
| ✅ | El Espejo (insights locales) | alto | mediano | HECHO jul 2026 (parcial) |
| ✅ | Insignia del ícono (Badging API) | medio | chico | HECHO jul 2026 |
| ✅ | Hábitos personalizables (Notion) | alto | mediano-grande | HECHO jul 2026 (migración v4→v5) |
| ✅ | Modo rescate + Ritual de derrota + regresos | alto | chico | HECHO jul 2026 (reps-caidas) |
| ✅ | Celebración de hitos | alto | chico | HECHO jul 2026 (reps-hitos) |
| ✅ | "Pulso" diario + tendencia de ánimo | medio | mediano | HECHO jul 2026 |
| ✅ | Mapa de calor del año | medio | mediano | HECHO jul 2026 |
| ✅ | Desbloqueables (temas por hitos) | medio | chico | HECHO jul 2026 |
| ✅ | Cierre de semana | medio | chico | HECHO jul 2026 (reps-cierre-semana) |
| 1 | **Hábitos por día de la semana** | alto | grande ⚠️ | **Siguiente sesión propia** (ver nota abajo) |
| 2 | Plan B por hábito (versión mínima) | alto | chico | Cierra el anti-castigo de hábitos |
| 3 | Temporizador de foco (Forest) | medio | mediano | Wake Lock + marca el hábito solo |
| 4 | Test de bienvenida + metas (Capa 2) | medio | mediano | Prepara el contexto para la IA |
| 5 | Gráficas de tendencia extra en Stats | medio | chico | Amplía el Pulso |
| 6 | Refactor view-models (habilita modos) | medio | mediano | Puerta a Bento / UI Espacial / HUD |
| 7 | XP y niveles (Habitica) | medio | mediano | Después del retro/pixel gana más |
| 8 | Museo + Carta al yo perdido + Cápsula | medio | chico | Rachas de features chicas, moral alta |
| 9 | IA de la Bandeja (Capa 3, Worker) | alto | grande | El salto a online-offline |
| 10 | Social espejo (Strava, Capa 5) | medio | grande | Al final, con cuentas |

> **Hábitos por día de la semana — por qué es sesión propia:** cambia
> `isWon`, la función más central de la app (la usan racha, congeladores,
> total, mapa de calor, El Espejo). Cada hábito llevaría un campo `days`
> (['1','3','5'] o 'all') y migración v5→v6. El punto fino a diseñar bien:
> ¿un día sin ningún core programado (un descanso planeado) cuenta como
> ganado, como neutral que la racha salta, o no cuenta? Esa decisión
> ramifica por ~20 llamadas a `isWon`. Se hace bien, aislada y muy
> verificada — no al vuelo al final de una sesión grande.

**Las próximas semanas de bloques:**

- **S1–S2** — Hábitos por día de la semana (con su migración v5→v6). La sesión delicada.
- **S3** — Plan B por hábito + temporizador de foco.
- **S4** — Test de bienvenida + metas (cierra la Capa 2 del ROADMAP).
- **S5** — Refactor view-models (primer modo-layout real: Bento o UI Espacial).

La IA (Capa 3) entra en el mes 3, con la app ya personalizable y el
perfil listo: la IA llegará a conocerte, no a adivinarte.

> Regla de siempre: una feature nueva no entra hasta que la anterior
> aguante una semana de uso real. La app crece como su dueño: una rep
> a la vez.
