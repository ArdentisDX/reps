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

| Modo | Idea | Esfuerzo |
|---|---|---|
| **Minimalista** | Solo los 3 cores, la racha y nada más. Cero ruido: para días de poca batería mental. El "Modo compacto" de hoy es su semilla. | mediano |
| **Futurista / HUD** | Panel de nave: datos densos, tipografía mono, glow del acento, todo visible a la vez (racha, %, semana, ánimo). Para quien ama los números. | mediano-grande |
| **Distópico / brutalist** | Crudo: bordes duros, sin redondeos, tipografía condensada gigante, alto contraste. "GANA EL DÍA O NO." Motivación de gimnasio. | mediano |
| **Retro / pixel** | Gamificado visual: fuente pixel, el sello "día ganado" como logro de arcade, la racha como barra de vida. | mediano-grande |

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
- Qué hacen bien: la racha duele perderla, así que venden "congeladores".
- Versión REPS (sin dinero, sin culpa): cada **7 días ganados seguidos
  fabricas 1 congelador** (máx. 2 guardados). Un día perdido lo consume
  automáticamente y la racha vive. Encaja perfecto con "un día malo es
  normal, dos seguidos no": el congelador es exactamente ese primer día.
- Celebraciones de hitos: pantalla especial en 7/30/100 reps (canvas ya
  dominado). Requiere: solo `reps-dias` + un contador en localStorage.

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
- Versión REPS: un **"pulso" diario** calculado local: ánimo de los
  últimos 3 cierres + % de la semana + horas del plan. Verde/ámbar/rojo
  con un consejo de tono: "pulso bajo: hoy gana chiquito, solo los 3
  cores". Más las gráficas de tendencia del ROADMAP (canvas). Todo
  offline: es aritmética sobre `reps-cierres` y `reps-dias`.

**Notion — hábitos personalizables** · esfuerzo: mediano-grande ⚠️ fundacional
- Qué hacen bien: la herramienta se adapta a la persona, no al revés.
- Versión REPS: editar/agregar/quitar hábitos y marcar cuáles son core
  (2–4). HABITS pasa de constante a `reps-habitos` en localStorage — es
  **la migración de esquema más seria hasta ahora** (por eso ya existe el
  sistema de migraciones). Regla de diseño: máximo 8 hábitos, para
  proteger el 20/80 de la sobre-ingeniería de rutinas.

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
3. **El Espejo** · mediano — Correlaciones locales simples entre tus
   propios datos: "los días que corres, tu ánimo es 🔥 el 78%", "tus
   rachas mueren en domingo". Sin IA: es contar sobre `reps-dias` +
   `reps-cierres`. Probablemente la feature con mejor razón
   insight/esfuerzo de toda la lista.
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
8. **Contador de identidad** · chico — No "racha" sino acumulado vital:
   "has salido a correr **47 veces**". Las rachas se rompen; los totales
   solo crecen. Es la métrica anti-perfeccionismo: ningún día malo te
   quita lo corrido.

---

## 4 · Priorización

| # | Feature | Impacto | Esfuerzo | Nota |
|---|---|---|---|---|
| 1 | Protector de racha + hitos (Duolingo) | alto | chico | Protege lo que más duele perder |
| 2 | Modo rescate + Ritual de derrota | alto | chico | El corazón anti-castigo de la misión |
| 3 | Contador de identidad + Plan B | alto | chico | Totales que solo crecen |
| 4 | Hábitos personalizables (Notion) | alto | mediano-grande | Fundacional: estrena las migraciones |
| 5 | El Espejo + tendencias (WHOOP) | alto | mediano | Insight local, cero backend |
| 6 | Temporizador de foco (Forest) | medio | mediano | Wake Lock + marca el hábito solo |
| 7 | Test de bienvenida + metas (Capa 2) | medio | mediano | Prepara el contexto para la IA |
| 8 | Refactor view-models + modo minimalista | medio | mediano | Habilita todas las skins |
| 9 | XP y niveles (Habitica) | medio | mediano | Después del retro/pixel gana más |
| 10 | Museo + Carta + Cápsula | medio | chico | Rachas de features chicas, moral alta |
| 11 | IA de la Bandeja (Capa 3, Worker) | alto | grande | El salto a online-offline |
| 12 | Social espejo (Strava, Capa 5) | medio | grande | Al final, con cuentas |

**Las próximas 8 semanas de bloques** (2 hrs/día, un tema por semana):

- **S1** — Protector de racha + celebración de hitos. Arranque con victoria rápida.
- **S2** — Modo rescate + ritual de derrota + contador de identidad.
- **S3–S4** — Hábitos personalizables (con su migración v2→v3). La semana fundacional.
- **S5** — El Espejo + gráfica de tendencia en Stats.
- **S6** — Temporizador de foco en los bloques.
- **S7** — Test de bienvenida + metas (cierra la Capa 2 del ROADMAP).
- **S8** — Refactor view-models + modo minimalista (primera skin real).

La IA (Capa 3) entra en el mes 3, con la app ya personalizable y el
perfil listo: la IA llegará a conocerte, no a adivinarte.

> Regla de siempre: una feature nueva no entra hasta que la anterior
> aguante una semana de uso real. La app crece como su dueño: una rep
> a la vez.
