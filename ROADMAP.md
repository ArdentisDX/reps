# REPS · Roadmap

> Filosofía: igual que la pestaña Ruta — por capas. Cada capa entra cuando
> la anterior ya funciona sola. Mejorar 1% cada día, también en el código.

## ✅ Capa 1 — Base (hecha, julio 2026)
- PWA instalable, 100% offline, datos en localStorage
- Hoy (hábitos + racha), Mi día, Ruta
- Bandeja: captura ≤5s, categorías, pendiente/hecha, filtros, fechas

## Capa 2 — Conocerte y apuntar (sin servidor, gratis, offline)
- **Test de bienvenida amigable**: pocas preguntas, nada invasivo ni abrumador.
  Construye un perfil local (gustos, horarios, cómo eres). Se guarda en
  localStorage; después será el contexto que la IA use para conocerte.
- **Metas**: corto, mediano y largo plazo, conectadas con la Ruta.
- Preparación: el perfil y las ideas ya guardan los datos que la IA necesitará.

## Capa 3 — Primera IA: la Bandeja autónoma (necesita mini-servidor + clave API)
- Mini-backend (p. ej. Cloudflare Workers, capa gratuita) que guarda la clave
  de la API de IA. La clave JAMÁS va en el JavaScript del sitio (es público).
- Escribes la idea y la IA decide: categoría, importancia, cuándo conviene
  hacerla. Entrada única ya preparada: `addIdea()` en js/app.js.
- Sin internet: todo sigue funcionando manual (offline-first no se negocia).

## Capa 4 — Asistente con contexto
- Recomendaciones según hora y localidad (dónde y cuándo hacer cada cosa).
- Compras: la IA estudia opciones en línea y tiendas físicas cercanas.
- Sugerencias personales: películas, comidas, qué hacer en tu día — usando
  el perfil del test + tu historial de hábitos e ideas.
- El tono: alguien que te escucha y aconseja, que te conoce de pies a cabeza.

## Capa 5 — Cuentas y sincronización
- Inicio de sesión, datos sincronizados entre dispositivos.
- Es la capa más delicada (seguridad y privacidad); va al final a propósito.

## Reglas del proyecto
1. Offline-first siempre: sin internet, la app completa sigue viva.
2. Cada capa se estrena solo cuando la anterior está estable.
3. Al cambiar archivos de la app: subir versión en sw.js (reps-vN).
4. Las ideas nuevas se anotan aquí, no se implementan al vuelo.
