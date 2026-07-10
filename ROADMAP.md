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

## Reglas del proyecto

1. Offline-first siempre: sin internet, la app completa sigue viva.
2. Cada capa se estrena solo cuando la anterior está estable.
3. Al cambiar archivos de la app: subir versión en sw.js (reps-vN).
4. Las ideas nuevas se anotan aquí, no se implementan al vuelo.
5. Convenciones y formatos de datos: ver `CLAUDE.md`.
6. El catálogo completo de sueños, con prioridades y el plan de las
   próximas 8 semanas: ver `VISION.md`.
