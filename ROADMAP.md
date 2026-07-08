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

## Capa 5 — Cuentas y sincronización

- Inicio de sesión, datos sincronizados entre dispositivos.
- Es la capa más delicada (seguridad y privacidad); va al final a propósito.
- Nota técnica: el formato del respaldo JSON ya es, en la práctica, el
  esquema de sincronización — sincronizar será "subir/bajar respaldos con
  resolución de conflictos por fecha", no un rediseño.

## Reglas del proyecto

1. Offline-first siempre: sin internet, la app completa sigue viva.
2. Cada capa se estrena solo cuando la anterior está estable.
3. Al cambiar archivos de la app: subir versión en sw.js (reps-vN).
4. Las ideas nuevas se anotan aquí, no se implementan al vuelo.
5. Convenciones y formatos de datos: ver `CLAUDE.md`.
6. El catálogo completo de sueños, con prioridades y el plan de las
   próximas 8 semanas: ver `VISION.md`.
