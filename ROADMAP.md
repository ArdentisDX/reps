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
2. Gráfica de gastos por categoría (dona/barras).
3. Comparar mes vs mes.
4. Aportar al ahorro cuenta como hábito del día.
5. 🌐🧠 Coach financiero IA (analiza gastos → consejo).

**Hábitos**
6. Hábitos a evitar (contador de días *sin*).
7. Racha por hábito individual.
8. Diario/journal del día (aparte del cierre).
9. Recordatorio por hábito a cierta hora.

**Asistente IA**
10. 🌐🧠 Chat con memoria del hilo (conversación real).
11. 🌐🧠 Reflexión semanal (analiza semana → 1 consejo).
12. 🌐🧠 Idea de la Bandeja → plan con pasos y fechas.

**Motivación**
13. Más medallas/logros (primer mes, 100 días, 1ª meta de ahorro).
14. Retos de 30 días.
15. Frase del día al abrir (local).

**Verte crecer**
16. Pantalla "Resumen" unificada (días + ánimo + dinero + foco).
17. Correlaciones (El Espejo 2.0): despertar temprano ↔ ánimo.
18. Compartir el mes ampliado (hábitos + finanzas en la postal).

**Pulido**
19. Buscador en Bandeja y notas.
20. Íconos de IA con estilo (cambiar 🤖 por ✨ de línea).

### Tanda 2 (ideas 21–70)

**Finanzas avanzada**
21. Suscripciones/gastos fijos con aviso de cobro próximo.
22. Presupuesto por categoría (no solo global).
23. Deudas y préstamos (a quién debo / me deben).
24. Varias carteras/cuentas (efectivo, banco, tarjeta).
25. Gasto de viaje con conversión de divisas.
26. Foto del ticket adjunta al gasto.
27. Proyección de cierre de mes ("a este ritmo cierras en $X").
28. 🏗️ Dividir gastos con amigos (quién debe qué).

**IA avanzada**
29. 🌐🧠 Asistente proactivo (push con el consejo del día).
30. 🌐 Dictar ideas/gastos por voz (speech-to-text).
31. 🌐🧠 La IA arma tu día con horas a partir de tus pendientes.
32. 🌐🧠 "Modo entrevista": la IA te hace preguntas para reflexionar.
33. 🌐🧠 Tu mes narrado por la IA en un párrafo.
34. 🌐🧠 Detecta cuándo vas a fallar y te manda un empujón.

**Hábitos / estructura**
35. Plantillas de rutina (mañana ideal, día de estudio, descanso).
36. Sub-tareas/checklist dentro de un hábito.
37. Hábitos con ventana horaria (gym 6–8pm).
38. Habit stacking ("después de X hago Y").
39. Modo vacaciones/pausa sin romper racha.

**Salud y bienestar**
40. Registro de sueño (horas + calidad) con insights.
41. Ánimo detallado (emociones, no solo 3 caras) + gráfica.
42. Meditación/respiración guiada (pauta visual).
43. Peso/medidas con gráfica.
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
57. Mascota con animaciones (darle vida al compañero).
58. Tienda: gastar "puntos ganados" en temas/cosméticos.
59. Temporadas/eventos con recompensa.
60. Cofres/sorpresas al cumplir hitos.

**Productividad**
61. Pomodoro avanzado (ciclos, descansos, stats de foco).
62. Bloqueo de distracciones durante el foco.
63. Matriz de prioridades (Eisenhower) para la Bandeja.
64. Kanban simple para proyectos.

**Datos / inteligencia**
65. Dashboard de correlaciones (sueño↔ánimo↔productividad).
66. Predicción de racha ("vas camino a tu mejor mes").
67. Informe mensual en PDF bonito.
68. "Tu año en REPS" (wrapped anual estilo Spotify).

**Estética / experiencia**
69. Animaciones y transiciones entre pantallas.
70. Pantalla de inicio configurable (elige tus widgets).

## Reglas del proyecto

1. Offline-first siempre: sin internet, la app completa sigue viva.
2. Cada capa se estrena solo cuando la anterior está estable.
3. Al cambiar archivos de la app: subir versión en sw.js (reps-vN).
4. Las ideas nuevas se anotan aquí, no se implementan al vuelo.
5. Convenciones y formatos de datos: ver `CLAUDE.md`.
6. El catálogo completo de sueños, con prioridades y el plan de las
   próximas 8 semanas: ver `VISION.md`.
