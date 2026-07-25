# REPS · Roadmap

> Filosofía: igual que la pestaña Ruta — por capas. Cada capa entra cuando
> la anterior ya funciona sola. Mejorar 1% cada día, también en el código.

## ✅ Capa 1 — Base (hecha, julio 2026)

- PWA instalable, 100% offline, datos en localStorage, respaldos JSON
- Hoy (hábitos + racha + cierre del día), Mi día (plan semanal + rutina),
  Ruta, Bandeja (captura ≤5s con categorías), Stats (tarjetas +
  calendario + compartir el mes como imagen)
- Temas: 5 predefinidos + personalizado por variables CSS

## Capa 2 — Conocerte y apuntar (sin servidor, gratis, offline)

- **Test de bienvenida amigable**: pocas preguntas, nada invasivo.
  Perfil local en localStorage (`reps-perfil`); después será el contexto
  que la IA use para conocerte.
- **Metas** a corto, mediano y largo plazo, conectadas con la Ruta.

### Otras features de esta capa, con notas técnicas

**Notificaciones (recordatorios de hábitos y del cierre del día)**
- Pedir permiso con `Notification.requestPermission()` solo tras un gesto
  del usuario (nunca al abrir la app).
- Lo honesto técnicamente: sin servidor NO hay push real. Opciones locales:
  1) *Notification Triggers* (programar notificaciones locales) aún no es
  estándar disponible; 2) mostrar aviso al abrir si el día está por
  perderse (barato y útil ya); 3) push de verdad requiere un backend Web
  Push (VAPID) — encaja con el mini-servidor de la Capa 3, no antes.
- Empezar por (2) y escalar a push cuando exista el Worker.

**Gráficas de tendencia en Stats**
- Datos: `reps-dias` (ganados por semana/mes), `reps-cierres` (ánimo a lo
  largo del tiempo — bien/regular/mal como serie).
- Dibujar con **canvas** (ya dominado en "Compartir mi mes") o SVG inline:
  una sparkline de 8–12 semanas cabe en una tarjeta de Stats. Sin librerías.
- Colores siempre desde las variables CSS (`getComputedStyle`), como el
  canvas del mes.

**Widget / pantalla de inicio**
- Verdad técnica: Android no permite widgets reales a una PWA. Lo que SÍ hay:
  - ✅ `shortcuts` en `manifest.json` (hecho, julio 2026): mantener
    presionado el ícono → "Capturar idea", "Cierre del día", "Stats".
  - **Badging API** (`navigator.setAppBadge`): puntito/número en el ícono
    (p. ej. hábitos core pendientes hoy). Soporte parcial en Android; se
    degrada sin romper nada.

## Capa 3 — Primera IA: la Bandeja autónoma (mini-servidor + clave API)

- **Arquitectura**: Cloudflare Worker (capa gratuita) como proxy. La clave
  de la API de IA vive como secreto del Worker — JAMÁS en el JS del sitio
  (GitHub Pages entrega el código a cualquiera). El Worker expone un solo
  endpoint (p. ej. `POST /clasificar`) con CORS restringido al dominio de
  la app y un límite de uso.
- **Integración**: `addIdea(texto, cat)` en js/app.js ya es la única
  puerta de entrada. El flujo nuevo: capturar → guardar local como
  `cat:'pendiente-ia'` → intentar clasificar → actualizar la idea.
- **Modo online-offline (el corazón de la fase 2)**:
  - Sin internet la app funciona igual que hoy (categoría manual u
    opción "que la IA decida luego").
  - Cola de pendientes en localStorage (`reps-cola-ia`); se procesa al
    volver la conexión — detectar con `navigator.onLine` + evento
    `online`, y/o Background Sync del service worker.
  - Toda respuesta de la IA es *sugerencia editable*: un tap corrige la
    categoría; ese feedback se guarda para mejorar los prompts.
- **Planificación con IA / agente**: el mismo Worker puede recibir el
  contexto local (perfil del test, historial de `reps-dias`, cierres,
  plan semanal) y devolver: prioridad de ideas, sugerencia de plan diario
  y horarios ("hazlo mañana después de correr"). El dispositivo manda solo
  lo mínimo necesario y anonimizado; los datos crudos nunca salen enteros.

## Capa 4 — Asistente con contexto

- Recomendaciones según hora y localidad (dónde y cuándo hacer cada cosa);
  geolocalización solo con permiso explícito y procesada vía el Worker.
- Compras: la IA estudia opciones en línea y tiendas físicas cercanas.
- Sugerencias personales: películas, comidas, qué hacer en tu día — usando
  el perfil del test + historial de hábitos e ideas.
- El tono: alguien que te escucha y aconseja, que te conoce de pies a cabeza.

## Capa 5 — Cuentas, login y sincronización

- Inicio de sesión (Gmail/Facebook/Twitter/correo) + datos en la nube,
  sincronizados entre dispositivos.
- Es la capa **más delicada** (seguridad y privacidad); va al final a
  propósito, DESPUÉS del mini-backend de la Capa 3.

### Verdad técnica (por qué es un proyecto propio, no un "solo agregar login")

El "iniciar sesión con Google/Facebook" y guardar cuentas **necesita un
servidor con base de datos**. Una PWA estática de GitHub Pages no puede
hacerlo sola (OAuth necesita un secreto del lado servidor; las cuentas
necesitan dónde vivir). Rompe la promesa de "offline eterno, sin
dependencias" — por eso es una decisión de peso, no un incremento.

**Dos caminos:**

1. **Auth hospedado (recomendado para empezar): Firebase o Supabase.**
   - No hay que levantar un servidor propio: el proveedor es el backend.
   - Firebase Auth da Google/Facebook/Twitter/correo desde el cliente;
     Firestore/Supabase-Postgres guarda los datos con reglas de seguridad.
   - Costos reales: **dependencia nueva + internet obligatorio** (adiós
     pureza offline; habría que degradar con gracia a modo local sin
     conexión), **registrar apps de desarrollador con Google, Facebook Y
     Twitter** por separado (Facebook/Twitter piden revisión y son un
     dolor), y llaves del proyecto en el cliente (las de Firebase son
     públicas por diseño, pero igual hay que configurar dominios y reglas).
   - Encaja natural con el Worker de la Capa 3 (mismo proveedor o vecino).

2. **Backend propio (Worker + D1/KV o similar).** Más control y sin atarse
   a un proveedor, pero hay que construir el OAuth-dance, sesiones y la
   base — mucho más trabajo y superficie de seguridad.

**Diseño de la sincronización (aplica a cualquier camino):**
- El respaldo JSON (`exportBackup`) **ya es el esquema de sync**:
  sincronizar = "subir/bajar ese blob con resolución de conflictos".
- Estrategia simple y robusta: por-clave y por-fecha. Los mapas indexados
  por día (`reps-dias`, `reps-cierres`, `reps-semana`) fusionan bien
  (gana el registro más reciente por fecha). `reps-habitos`/`reps-tema`
  son "último que escribe gana" por dispositivo.
- Regla de oro que NO se negocia: **la app sigue 100% funcional sin
  cuenta y sin internet**. El login es aditivo (respalda/sincroniza), no
  un muro de entrada. El modo actual (local + export/import manual) queda
  como el camino sin-cuenta para siempre.
- Privacidad: el usuario decide. Nada sale del dispositivo hasta que
  inicia sesión a propósito. Ofrecer "exportar y borrar mi cuenta".

**Precondición:** existir primero el Worker de la Capa 3 (para la clave
de la IA); ahí ya habrá backend y conviene resolver auth de una vez.

## 🗂️ Banco de ideas (jul 2026)

> Lista viva de ideas propuestas al usuario para futuras entregas. No
> implementar sin acordarlo. 🌐 = necesita internet/Worker · 🧠 = usa IA ·
> 🏗️ = grande/arquitectónica (rompe o reta el offline-first).

### Tanda 1 (ideas 1–20)

**Finanzas**
1. Gastos fijos recurrentes (renta, suscripciones) que se auto-registran.
2. ✅ (v73) Gráfica de gastos por categoría (barras "En qué se te va").
3. ✅ (v74) Comparar mes vs mes.
4. Aportar al ahorro cuenta como hábito del día.
5. ✅ (v87) Coach financiero IA (analiza gastos → consejo).

**Hábitos**
6. ✅ (v75) Hábitos a evitar ("Días sin…", contador de días limpios).
7. ✅ (v76) Racha por hábito individual (🔥N en la tarjeta).
8. ✅ (v79) Diario/journal del día (Mi día, con historial).
9. Recordatorio por hábito a cierta hora.

**Asistente IA**
10. 🌐🧠 Chat con memoria del hilo (conversación real).
11. 🌐🧠 Reflexión semanal (analiza semana → 1 consejo).
12. ✅ (v87) Idea de la Bandeja → plan con pasos (botón ✨).

**Motivación**
13. ✅ (v76) Más medallas (200 días, racha 60, foco, ahorro, días sin).
14. Retos de 30 días.
15. ✅ (v74) Frase del día al abrir (local).

**Verte crecer**
16. ✅ (v78) Pantalla "Resumen" — "Esta semana" en Stats.
17. ✅ (v84) Correlaciones (El Espejo 2.0): sueño↔ánimo, despertar↔ganar.
18. ✅ Postal del mes ampliada: hábito top del mes + saldo del mes (si hay finanzas). (v108)

**Pulido**
19. ✅ Buscador en Bandeja (filtra ideas al escribir; mensaje claro sin match). (v104)
20. ✅ (v73) Íconos de IA con estilo (chispa SVG en vez de 🤖).

> **Rumbo acordado (jul 2026):** personalización por persona (1) + cuentas/sync (3).
> — (1) HECHA (v70–72): **Biblioteca de actividades** en el editor (v70),
>   **paso de actividades en la bienvenida** (v71: yoga/pilates/correr… →
>   hábitos a la medida) y **plantillas de rutina** (v72, idea #35: Mañana
>   productiva / Día de estudio / trabajo / tranquilo). Cada quien —hermana
>   yoga, tía pilates— arma su REPS desde el minuto uno.
> — (3) NORTE GRANDE, pendiente: cuentas + sync entre dispositivos = **Capa 5**
>   (necesita backend; plan técnico más abajo). Construir (1) dejando el
>   `reps-perfil`/hábitos bien guardados para que (3) sincronice limpio.

### Tanda 2 (ideas 21–70)

**Finanzas avanzada**
21. ✅ (v83) Suscripciones/gastos fijos (se registran solos cada mes).
22. ✅ (v77) Presupuesto por categoría (tope y alerta al pasarse).
23. ✅ (v85) Deudas y préstamos (a quién debo / me deben).
24. ✅ (v91) Carteras (efectivo, banco, tarjeta) con saldo por cartera.
25. Gasto de viaje con conversión de divisas.
26. Foto del ticket adjunta al gasto.
27. ✅ (v83) Proyección de cierre de mes ("a este ritmo cierras en $X").
28. 🏗️ Dividir gastos con amigos (quién debe qué).

**IA avanzada**
29. 🌐🧠 Asistente proactivo (push con el consejo del día).
30. ✅ (v89) Dictar por voz en la Bandeja (speech-to-text).
31. ✅ (v88) "Arma mi día": la IA organiza el día y acomoda si no da tiempo.
32. ✅ (v90) Reflexión guiada: la IA te hace preguntas para pensar.
33. ❌ descartada (a petición del usuario).
34. 🌐🧠 Detecta cuándo vas a fallar y te manda un empujón.

**Hábitos / estructura**
35. Plantillas de rutina (mañana ideal, día de estudio, descanso).
36. ✅ Sub-tareas dentro de un hábito (checklist; al completarlas se marca el hábito). (v106)
37. ✅ Hábitos con ventana horaria (hini/hfin; la tarjeta avisa si se pasó). (v107)
38. Habit stacking ("después de X hago Y").
39. Modo vacaciones/pausa sin romper racha.

**Salud y bienestar**
40. ✅ (v81) Registro de sueño (horas por noche + promedio, pantalla propia).
41. ✅ (v89) Ánimo detallado (emociones opcionales en el cierre).
42. Meditación/respiración guiada (pauta visual).
43. ✅ Peso con gráfica de tendencia (canvas, hub Bienestar; reps-peso). (v105)
44. Recordatorio de agua/medicinas con contador.

**Social / comunidad**
45. 🏗️ Amigos: compartir racha y animarse.
46. 🏗️ Retos con amigos.
47. 🏗️ Accountability partner (alguien ve tu progreso).
48. 🏗️ Ranking privado del grupo.

**Plataforma (grandes)**
49. 🏗️ Cuentas + sync entre dispositivos (Capa 5).
50. 🏗️ App nativa (TWA/Play Store): ícono dinámico, updates in-app.
51. 🏗️ Widgets reales de pantalla de inicio (racha, próximo bloque).
52. 🏗️ Companion de reloj (Wear OS / Apple Watch).
53. 🌐🏗️ Integrar Google Calendar (eventos → tu día).
54. 🌐🏗️ Integrar Google Fit / Salud (pasos, sueño).
55. Modo familia/pareja: varios perfiles en un dispositivo.

**Gamificación / mundo**
56. Un mundo que crece con tus días (isla/ciudad estilo Habitica).
57. ✅ (v86) Mascota animada (el compañero flota).
58. Tienda: gastar "puntos ganados" en temas/cosméticos.
59. ⏸️ aplazada (recompensas: "aún no").
60. ⏸️ aplazada (recompensas: "aún no").

**Productividad**
61. ✅ (v92) Pomodoro (ciclos de trabajo/descanso automáticos).
62. Bloqueo de distracciones durante el foco.
63. ✅ (v86) Prioridad en la Bandeja (estrella importante, sube al tope).
64. ✅ (v92) Kanban (tablero de proyectos, pantalla propia).

**Datos / inteligencia**
65. Dashboard de correlaciones (sueño↔ánimo↔productividad).
66. ✅ (v84) Predicción de racha (cerca de tu récord).
67. Informe mensual en PDF bonito.
68. ✅ (v82) "Tu año en REPS" (wrapped anual, pantalla propia).

**Estética / experiencia**
69. ✅ (v82) Animaciones y transiciones (fade de pestañas, slide de hojas).
70. Pantalla de inicio configurable (elige tus widgets).

### Tanda 3 (ideas 71–116) — jul 2026

**Hábitos y sistema**
71. ✅ Hábitos "N× por semana" (campo frecSemanal; no core, cuenta aparte). (v94)
72. ✅ Cadena visual del hábito (calendario "no rompas la cadena" por hábito). (v93)
73. ✅ Hábitos ancla + apilados (campo "después de X" en la tarjeta). (v94)
74. ✅ Modo "un solo hábito" (filtro de foco reps-solo + banner). (v94)
75. ✅ Reto personal con fecha límite y barra de avance (reps-retos). (v94)
76. ✅ Micro-hábitos de 2 minutos (categoría en la biblioteca). (v94)
77. ✅ "Semáforo de energía" del día que sugiere cómo encarar lo que falta. (v94)

**Finanzas**
78. ✅ Reporte semanal de gastos (tarjeta "Esta semana" vs la anterior). (v95)
79. ✅ Ahorro sincero: aportar registra un movimiento de ahorro y baja tu saldo real; botón Retirar. (v95)
80. ✅ Sobres/presupuesto por sobres (tope por categoría con "queda $X"). (v95)
81. ✅ Próximos pagos (suscripciones ordenadas por cuándo tocan, avisa a ≤3 días). (v95)
82. ✅ Detectar gastos hormiga (detección LOCAL de compras chicas repetidas, sin IA). (v95)
83. ✅ Días sin gastar en X categoría (racha de días limpios por categoría vigilada). (v95)

**IA / asistente**
84. ✅ Chat con memoria persistente (hilo guardado en reps-ia-chat; recuerda entre sesiones). (v96)
85. ❌ Descartada (era "resumen de tu semana narrado" — mismo espíritu que el mes narrado que ya quitamos).
86. ✅ "Desatóralo": describe un bloqueo y la IA da UN primer paso mínimo. (v96)
87. ✅ Reencuadre de pensamientos (mini-TCC guiada al sentirte mal). (v96)
88. ✅ Aviso de posible caída: detección LOCAL por día de semana + estado de hoy (antes de caer). (v96)
89. ✅ Preguntas de journaling generadas a tu momento (en el Diario, con banco offline). (v96)

**Bienestar y salud**
90. ✅ Respiración guiada con animación (4-7-8, caja, calma). (v97)
91. ✅ Chequeo de ánimo a media jornada, 1 tap (tarjeta en Hoy 11–17h). (v97)
92. ✅ Registro de agua con vasos y aviso según la hora. (v97)
93. ✅ Gratitud diaria (3 cosas) con historial y "hace un año". (v97)
94. ✅ Pausas activas cada X min (mientras la app está abierta). (v97)
95. ✅ Higiene del sueño: checklist de bajada nocturna por noche. (v97)

(Todo agrupado en el hub «Bienestar» del menú Más; el chequeo #91 vive en Hoy.)

**Motivación / identidad**
96. ✅ Carta a tu futuro yo (se sella y se abre en 1 año; reps-carta-futuro). (v98)
97. ✅ Frase/mantra fijado arriba de Hoy (tap para editar; reps-mantra). (v98)
98. ✅ Muro de victorias (momentos de orgullo; reps-victorias). (v98)
99. ✅ Frases de identidad ("X ya es parte de quién eres" al cruzar 10×). (v98)
100. ✅ Modo espejo brutal: números duros sin adornos (toggle en El Espejo). (v98)

**Datos / visualización**
101. ✅ Mapa de calor por hábito (selector en «Tu año»; hecho/no tocaba/fallado). (v99)
102. ✅ Línea de tiempo mes a mes desde que empezaste (pantalla propia). (v99)
103. ✅ Comparador "tú vs tú" (este trimestre vs el anterior). (v99)
104. ✅ Compartir progreso: imagen (canvas, estilo del mes/año) con tus números. (v99) — nota: imagen curada por canvas, no screenshot genérico (sin librerías = offline eterno).
105. ✅ Insight proactivo al abrir Stats (dato sorprendente, estable por día). (v99)

**Experiencia / personalización**
106. ✅ Personalizar Hoy: enciende/apaga tarjetas (reps-hoy-cfg). (v100)
107. ✅ «Solo esenciales» = la misma config de #106 (elige qué ver). (v100)
108. ✅ Editor de degradado de fondo (reps-degradado: base + 2º color). (v100)
109. ✅ Sonidos/hápticos por acción (reps-sonidos: check/ganado/fin/vibración). (v100)
110. ➖ Cubierto por lo que ya existe: modo un solo hábito (#74) + temporizador de foco (#20) + Personalizar Hoy (#106). No se duplicó para no inflar la app.
111. ✅ Atajo del ícono a «Arma mi día» (manifest ?tab=armadia). (v100)

**Estructura / tiempo**
112. ✅ Agenda visual: la rutina marca el bloque «en curso» + El Ahora (HUD con progreso en vivo, ya existía). (v101)
113. ✅ Bloques arrastrables: asa ⠿ en cada bloque; arrastra vertical para mover su hora. (v101)
114. ✅ Plantillas de día propias: guarda tu rutina (ej. «Entre semana», «Finde») y aplícala. Sumado a las 4 base que ya había. (v101)
115. ✅ Cuenta regresiva a un evento (reps-eventos; el más cercano en Hoy). (v101)
116. ✅ Modo viaje/vacaciones: los días marcados son neutrales (descanso), la racha se sostiene (hook en coreDelDia). (v101)

**Bug corregido en v101:** el timeline #102 (v99) compartía `id="tlList"` con la rutina de Mi día; renombrado a `tlMeses`.

## Reglas del proyecto

1. Offline-first siempre: sin internet, la app completa sigue viva.
2. Cada capa se estrena solo cuando la anterior está estable.
3. Al cambiar archivos de la app: subir versión en sw.js (reps-vN).
4. Las ideas nuevas se anotan aquí, no se implementan al vuelo.
5. Convenciones y formatos de datos: ver `CLAUDE.md`.
6. El catálogo completo de sueños, con prioridades y el plan de las
   próximas 8 semanas: ver `VISION.md`.
