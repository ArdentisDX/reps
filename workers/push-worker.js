// ============================================================
// REPS · Worker de notificaciones push (Capa 3, paso 1)
// ------------------------------------------------------------
// Filosofía: servidor "tonto". NO conoce hábitos, notas ni rachas.
// Solo guarda: la suscripción push del navegador + las horas de aviso.
// A la hora indicada manda un push VACÍO ("tick"); el service worker
// de la app arma el texto de la notificación con los datos LOCALES.
//
// Rutas:
//   POST /subscribe  {subscription, times:["H:MM",...], tz:<offset min>}
//   POST /unsubscribe {endpoint}
//   POST /test       {endpoint}   → push inmediato (para probar)
//   GET  /           → "ok" (salud)
//
// Necesita (Configuración del Worker):
//   KV binding:  REPS_KV
//   Secretos:    VAPID_PUBLIC (base64url raw P-256)
//                VAPID_PRIVATE (JWK privado, JSON)
//                VAPID_SUB (mailto:tu-correo)
//   Cron trigger: */5 * * * *  (cada 5 minutos)
//
// Conexiones del Life OS (v118) — rutas /cx/*, ver la sección
// "Conexiones" al final y workers/CONEXIONES.md (guía paso a paso).
//   Secretos: APP_URL (https://ardentisdx.github.io/reps/)
//             GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Calendar + YouTube)
//             WHOOP_CLIENT_ID,  WHOOP_CLIENT_SECRET
//             TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
//             TIKTOK_VERIFICACION (opcional: archivo de verificación de URL)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*', // GitHub Pages sirve la app; '*' es aceptable porque no hay datos sensibles ni cookies
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const b64uToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
};
const bytesToB64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// JWT ES256 firmado con la llave VAPID: es el "pase" que exige el
// servicio push (Google/Mozilla) para aceptar nuestros envíos.
async function vapidJwt(env, audience) {
  const header = bytesToB64u(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64u(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUB,
  })));
  const key = await crypto.subtle.importKey(
    'jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(header + '.' + claims)
  );
  return header + '.' + claims + '.' + bytesToB64u(sig);
}

// push VACÍO: sin cuerpo no hace falta cifrar el payload (lo más simple
// y lo más privado: el contenido lo pone la app en el dispositivo)
async function sendTick(env, subscription) {
  const aud = new URL(subscription.endpoint).origin;
  const jwt = await vapidJwt(env, aud);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '300',
      Authorization: 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC,
    },
  });
  return res.status; // 201 = aceptado; 404/410 = suscripción muerta
}

const idDe = (endpoint) => 'sub:' + endpoint.slice(-40).replace(/[^\w-]/g, '');

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    // Conexiones del Life OS (WHOOP, Google Calendar, YouTube, TikTok)
    if (url.pathname.startsWith('/cx/') || /^\/tiktok[\w-]*\.txt$/.test(url.pathname)) {
      try { return await cxRuta(req, env, url); }
      catch (e) { return cxJson({ ok: false, error: 'interno', detalle: String(e && e.message || e).slice(0, 200) }, 500); }
    }

    // /debug — diagnóstico: ¿corre el cron? ¿qué horas/tz hay guardadas?
    if (url.pathname === '/debug' && req.method === 'GET') {
      const lastCron = await env.REPS_KV.get('debug:lastCron');
      const lastSend = await env.REPS_KV.get('debug:lastSend');
      const list = await env.REPS_KV.list({ prefix: 'sub:' });
      const subs = [];
      for (const k of list.keys) {
        const rec = await env.REPS_KV.get(k.name, 'json');
        if (rec) subs.push({ times: rec.times, tz: rec.tz, endpointTail: (rec.sub && rec.sub.endpoint || '').slice(-12) });
      }
      return new Response(JSON.stringify({ lastCron, lastSend, subs, nowUtc: new Date().toISOString() }, null, 2),
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'GET') return new Response('ok', { headers: CORS });

    let body = {};
    try { body = await req.json(); } catch (e) {}

    if (url.pathname === '/subscribe' && req.method === 'POST') {
      const sub = body.subscription;
      if (!sub || !sub.endpoint) return new Response('bad request', { status: 400, headers: CORS });
      const times = Array.isArray(body.times)
        ? body.times.filter(t => typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)).slice(0, 24)
        : [];
      const tz = Number.isFinite(body.tz) ? body.tz : 0; // minutos de desfase respecto a UTC (getTimezoneOffset)
      await env.REPS_KV.put(idDe(sub.endpoint), JSON.stringify({ sub, times, tz }));
      return new Response(JSON.stringify({ ok: true, times: times.length }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/unsubscribe' && req.method === 'POST') {
      if (body.endpoint) await env.REPS_KV.delete(idDe(body.endpoint));
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/test' && req.method === 'POST') {
      if (!body.endpoint) return new Response('bad request', { status: 400, headers: CORS });
      const rec = await env.REPS_KV.get(idDe(body.endpoint), 'json');
      if (!rec) return new Response('not subscribed', { status: 404, headers: CORS });
      const status = await sendTick(env, rec.sub);
      return new Response(JSON.stringify({ ok: true, status }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ===== /ia — el "cerebro de visita" (Capa 3.2) =====
    // La app manda contexto mínimo + pregunta; el Worker consulta a Claude y
    // devuelve el consejo. NO guarda nada: piensa y olvida. La clave de la API
    // vive como secreto ANTHROPIC_KEY, nunca en la app.
    if (url.pathname === '/ia' && req.method === 'POST') {
      const sistema = typeof body.sistema === 'string' ? body.sistema.slice(0, 8000) : '';
      const pregunta = typeof body.pregunta === 'string' ? body.pregunta.trim().slice(0, 4000) : '';
      if (!pregunta) return new Response('bad request', { status: 400, headers: CORS });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 1000,
          system: sistema,
          messages: [{ role: 'user', content: pregunta }],
        }),
      });
      if (!r.ok) return new Response('ia error ' + r.status, { status: 502, headers: CORS });
      const data = await r.json();
      const texto = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return new Response(JSON.stringify({ ok: true, texto }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response('not found', { status: 404, headers: CORS });
  },

  // corre cada 5 min (cron): manda tick a quien tenga una hora de aviso
  // dentro de la ventana [ahora, ahora+5min) EN SU hora local
  async scheduled(event, env, ctx) {
    await env.REPS_KV.put('debug:lastCron', new Date().toISOString()); // latido: prueba que el cron corre
    const list = await env.REPS_KV.list({ prefix: 'sub:' });
    const nowUtc = Date.now();
    for (const k of list.keys) {
      const rec = await env.REPS_KV.get(k.name, 'json');
      if (!rec || !rec.times || !rec.times.length) continue;
      // minutos locales del usuario (tz = getTimezoneOffset: UTC - local)
      const localMin = Math.floor((nowUtc / 60000 - rec.tz) % 1440 + 1440) % 1440;
      const hit = rec.times.some(t => {
        const [h, m] = t.split(':').map(Number);
        const tm = h * 60 + m;
        const diff = (tm - localMin + 1440) % 1440;
        return diff < 5; // cae dentro de esta ventana de 5 min
      });
      if (!hit) continue;
      const status = await sendTick(env, rec.sub);
      await env.REPS_KV.put('debug:lastSend', new Date().toISOString() + ' status=' + status); // último envío del cron
      if (status === 404 || status === 410) await env.REPS_KV.delete(k.name); // suscripción muerta: limpiar
    }
  },
};


// ============================================================
// ===== Conexiones del Life OS (v118) =====
// ------------------------------------------------------------
// Cómo funciona (en cristiano):
//  1. La app de cada dispositivo inventa una "llave" secreta al azar y la
//     guarda en su localStorage. Nadie más la conoce.
//  2. "Conectar" manda al usuario a /cx/auth/<servicio>?llave=…  → el Worker
//     lo redirige a la pantalla oficial de permiso (Google, WHOOP, TikTok).
//  3. El servicio regresa a /cx/callback/<proveedor> con un código; el Worker
//     lo cambia por tokens y los guarda en KV bajo el HASH de la llave (la
//     llave misma nunca se guarda). Luego regresa al usuario a la app.
//  4. La app pide /cx/datos con su llave; el Worker refresca tokens si
//     vencieron, consulta cada servicio y devuelve un RESUMEN pequeño.
//     La app lo guarda (reps-cx) para funcionar sin internet.
// Las llaves secretas de cada servicio viven como secretos del Worker.
// ============================================================

const CX_SERVICIOS = {
  whoop: {
    proveedor: 'whoop',
    auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    token: 'https://api.prod.whoop.com/oauth/oauth2/token',
    scope: 'read:recovery read:sleep read:cycles read:profile offline',
  },
  calendar: {
    proveedor: 'google',
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  },
  youtube: {
    proveedor: 'google',
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
  },
  tiktok: {
    proveedor: 'tiktok',
    auth: 'https://www.tiktok.com/v2/auth/authorize/',
    token: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,user.info.stats,video.list',
  },
};

const cxJson = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
const cxAzar = (n) => bytesToB64u(crypto.getRandomValues(new Uint8Array(n || 24)));
async function cxHash(llave) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('reps-cx:' + llave));
  return bytesToB64u(d).slice(0, 32);
}
const cxLlaveValida = (l) => typeof l === 'string' && /^[\w-]{24,64}$/.test(l);
const cxCredenciales = (env, proveedor) => proveedor === 'google' ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET]
  : proveedor === 'whoop' ? [env.WHOOP_CLIENT_ID, env.WHOOP_CLIENT_SECRET] : [env.TIKTOK_CLIENT_KEY, env.TIKTOK_CLIENT_SECRET];

// a dónde regresa al usuario: SOLO a la app (nunca a otro sitio)
function cxVolver(env, estado) {
  const base = env.APP_URL || 'https://ardentisdx.github.io/reps/';
  return Response.redirect(base + '#cx=' + estado, 302);
}

async function cxRuta(req, env, url) {
  // archivo de verificación de TikTok (si TikTok pide verificar la URL)
  if (/^\/tiktok[\w-]*\.txt$/.test(url.pathname)) {
    return new Response(env.TIKTOK_VERIFICACION || 'not found', { status: env.TIKTOK_VERIFICACION ? 200 : 404, headers: { 'Content-Type': 'text/plain' } });
  }
  const partes = url.pathname.split('/').filter(Boolean); // ['cx', accion, servicio?]
  const accion = partes[1], cual = partes[2];

  // 1) inicio: /cx/auth/<servicio>?llave=...
  if (accion === 'auth' && req.method === 'GET') {
    const s = CX_SERVICIOS[cual]; const llave = url.searchParams.get('llave');
    if (!s || !cxLlaveValida(llave)) return cxVolver(env, 'error-' + (cual || 'x') + '-peticion');
    const [id] = cxCredenciales(env, s.proveedor);
    if (!id) return cxVolver(env, 'error-' + cual + '-sin-configurar');
    const state = cxAzar(18);
    await env.REPS_KV.put('cxstate:' + state, JSON.stringify({ servicio: cual, hash: await cxHash(llave) }), { expirationTtl: 600 });
    const redirect = url.origin + '/cx/callback/' + s.proveedor;
    const q = new URLSearchParams({ response_type: 'code', redirect_uri: redirect, scope: s.scope, state });
    if (s.proveedor === 'tiktok') q.set('client_key', id); else q.set('client_id', id);
    if (s.proveedor === 'google') { q.set('access_type', 'offline'); q.set('prompt', 'consent'); q.set('include_granted_scopes', 'false'); }
    return Response.redirect(s.auth + '?' + q.toString(), 302);
  }

  // 2) regreso del proveedor: /cx/callback/<proveedor>?code&state
  if (accion === 'callback' && req.method === 'GET') {
    const state = url.searchParams.get('state') || '';
    const reg = state ? await env.REPS_KV.get('cxstate:' + state, 'json') : null;
    if (!reg) return cxVolver(env, 'error-x-expirado');
    await env.REPS_KV.delete('cxstate:' + state);
    const s = CX_SERVICIOS[reg.servicio];
    if (url.searchParams.get('error') || !url.searchParams.get('code')) return cxVolver(env, 'error-' + reg.servicio + '-cancelado');
    const tok = await cxPedirToken(env, s, { grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: url.origin + '/cx/callback/' + s.proveedor });
    if (!tok.ok) return cxVolver(env, 'error-' + reg.servicio + '-token');
    await env.REPS_KV.put('cxtok:' + reg.servicio + ':' + reg.hash, JSON.stringify(tok.datos));
    return cxVolver(env, 'ok-' + reg.servicio);
  }

  // de aquí en adelante: peticiones de la app con su llave (POST JSON)
  let body = {};
  try { body = await req.json(); } catch (e) {}
  if (!cxLlaveValida(body.llave)) return cxJson({ ok: false, error: 'llave' }, 401);
  const hash = await cxHash(body.llave);

  // 3) ¿qué hay conectado en este dispositivo?
  if (accion === 'estado' && req.method === 'POST') {
    const est = {};
    for (const k of Object.keys(CX_SERVICIOS)) est[k] = !!(await env.REPS_KV.get('cxtok:' + k + ':' + hash));
    return cxJson({ ok: true, conectados: est });
  }

  // 4) desconectar: borra los tokens de ese servicio
  if (accion === 'desconectar' && req.method === 'POST') {
    if (!CX_SERVICIOS[body.servicio]) return cxJson({ ok: false, error: 'servicio' }, 400);
    await env.REPS_KV.delete('cxtok:' + body.servicio + ':' + hash);
    return cxJson({ ok: true });
  }

  // 5) datos: resumen de cada servicio conectado
  if (accion === 'datos' && req.method === 'POST') {
    const pedidos = Array.isArray(body.servicios) ? body.servicios.filter(k => CX_SERVICIOS[k]) : Object.keys(CX_SERVICIOS);
    const tz = Number.isFinite(body.tz) ? body.tz : 360; // getTimezoneOffset del dispositivo (CDMX = 360)
    const salida = {};
    await Promise.all(pedidos.map(async (k) => {
      try {
        const token = await cxTokenVigente(env, k, hash);
        if (!token) { salida[k] = { conectado: false }; return; }
        salida[k] = { conectado: true, datos: await CX_LECTORES[k](token, tz) };
      } catch (e) {
        salida[k] = { conectado: true, error: String(e && e.message || e).slice(0, 160) };
      }
    }));
    return cxJson({ ok: true, servicios: salida, actualizado: new Date().toISOString() });
  }

  return cxJson({ ok: false, error: 'ruta' }, 404);
}

// pide tokens al proveedor (código nuevo o refresco)
async function cxPedirToken(env, s, campos) {
  const [id, secreto] = cxCredenciales(env, s.proveedor);
  const form = new URLSearchParams(campos);
  if (s.proveedor === 'tiktok') { form.set('client_key', id); form.set('client_secret', secreto); }
  else { form.set('client_id', id); form.set('client_secret', secreto); }
  if (s.proveedor === 'whoop' && campos.grant_type === 'refresh_token') form.set('scope', 'offline');
  const r = await fetch(s.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) return { ok: false, status: r.status, d };
  return { ok: true, datos: {
    access: d.access_token,
    refresh: d.refresh_token || campos.refresh_token || null, // Google no siempre repite el refresh
    expira: Date.now() + ((+d.expires_in || 3600) - 120) * 1000,
  } };
}

// token listo para usar: si venció, lo refresca y lo vuelve a guardar
async function cxTokenVigente(env, servicio, hash) {
  const clave = 'cxtok:' + servicio + ':' + hash;
  const t = await env.REPS_KV.get(clave, 'json');
  if (!t) return null;
  if (Date.now() < t.expira) return t.access;
  if (!t.refresh) return null;
  const nuevo = await cxPedirToken(env, CX_SERVICIOS[servicio], { grant_type: 'refresh_token', refresh_token: t.refresh });
  if (!nuevo.ok) { if (nuevo.status === 400 || nuevo.status === 401) await env.REPS_KV.delete(clave); return null; }
  await env.REPS_KV.put(clave, JSON.stringify(nuevo.datos));
  return nuevo.datos.access;
}

async function cxGet(u, token, opciones) {
  const r = await fetch(u, { ...(opciones || {}), headers: { Authorization: 'Bearer ' + token, ...((opciones && opciones.headers) || {}) } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + new URL(u).pathname);
  return r.json();
}
// fecha local "YYYY-MM-DD" del usuario a partir de su desfase (tz en minutos, como getTimezoneOffset)
const cxFechaLocal = (ms, tz) => new Date(ms - tz * 60000).toISOString().slice(0, 10);

// ---- lectores: cada uno devuelve un resumen pequeño y estable ----
const CX_LECTORES = {
  // WHOOP v2: recuperación, sueño y esfuerzo más recientes
  async whoop(token) {
    const base = 'https://api.prod.whoop.com/developer/v2';
    const [rec, sue, cic] = await Promise.all([
      cxGet(base + '/recovery?limit=7', token),
      cxGet(base + '/activity/sleep?limit=7', token),
      cxGet(base + '/cycle?limit=1', token),
    ]);
    const r0 = (rec.records || []).find(x => x.score_state === 'SCORED' && x.score) || null;
    const s0 = (sue.records || []).find(x => !x.nap && x.score_state === 'SCORED' && x.score) || null;
    const c0 = (cic.records || [])[0];
    let minSueno = null;
    if (s0 && s0.score.stage_summary) {
      const st = s0.score.stage_summary;
      minSueno = Math.round(((st.total_in_bed_time_milli || 0) - (st.total_awake_time_milli || 0)) / 60000);
    }
    return {
      recuperacion: r0 ? Math.round(r0.score.recovery_score) : null,
      vfc: r0 ? Math.round(r0.score.hrv_rmssd_milli) : null,
      fcReposo: r0 ? Math.round(r0.score.resting_heart_rate) : null,
      suenoMin: minSueno,
      suenoRendimiento: s0 ? Math.round(s0.score.sleep_performance_percentage) : null,
      esfuerzo: c0 && c0.score ? Math.round(c0.score.strain * 10) / 10 : null,
      serieRecuperacion: (rec.records || []).filter(x => x.score).map(x => Math.round(x.score.recovery_score)).reverse(),
      resumen: r0 ? 'VFC ' + Math.round(r0.score.hrv_rmssd_milli) + ' ms · FC reposo ' + Math.round(r0.score.resting_heart_rate) : '',
    };
  },

  // Google Calendar: eventos de hoy y de los próximos 7 días
  async calendar(token, tz) {
    const ahora = Date.now();
    const inicioHoy = new Date(cxFechaLocal(ahora, tz) + 'T00:00:00Z').getTime() + tz * 60000;
    const q = new URLSearchParams({ timeMin: new Date(inicioHoy).toISOString(), timeMax: new Date(ahora + 7 * 86400000).toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '25' });
    const d = await cxGet('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + q.toString(), token);
    const eventos = (d.items || []).filter(e => e.status !== 'cancelled').map(e => ({
      titulo: (e.summary || 'Sin título').slice(0, 80),
      inicio: e.start && (e.start.dateTime || e.start.date) || '',
      fin: e.end && (e.end.dateTime || e.end.date) || '',
      todoElDia: !!(e.start && e.start.date && !e.start.dateTime),
      lugar: (e.location || '').slice(0, 60),
    }));
    return { eventos, resumen: eventos.length + ' eventos esta semana' };
  },

  // YouTube: canal + vistas de los últimos 7 días (Analytics tarda ~2 días en consolidar)
  async youtube(token, tz) {
    const canal = await cxGet('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', token);
    const ch = (canal.items || [])[0];
    if (!ch) return { vistas: null, resumen: 'Esta cuenta no tiene canal' };
    const hoy = Date.now();
    const fin = cxFechaLocal(hoy - 86400000, tz), ini = cxFechaLocal(hoy - 7 * 86400000, tz);
    let serie = [], vistas = null, subsGanados = null, minutos = null;
    try {
      const q = new URLSearchParams({ ids: 'channel==MINE', startDate: ini, endDate: fin,
        metrics: 'views,estimatedMinutesWatched,subscribersGained', dimensions: 'day', sort: 'day' });
      const a = await cxGet('https://youtubeanalytics.googleapis.com/v2/reports?' + q.toString(), token);
      const filas = a.rows || [];
      serie = filas.map(f => f[1]);
      vistas = serie.reduce((x, y) => x + y, 0);
      minutos = filas.reduce((x, f) => x + f[2], 0);
      subsGanados = filas.reduce((x, f) => x + f[3], 0);
    } catch (e) { /* Analytics puede no estar listo: queda el total del canal */ }
    const st = ch.statistics || {};
    const subs = st.hiddenSubscriberCount ? null : +st.subscriberCount;
    return {
      canal: ch.snippet && ch.snippet.title || '',
      vistas, serie, subs, subsGanados, minutos,
      vistasTotales: +st.viewCount || 0, videos: +st.videoCount || 0,
      resumen: (subs != null ? subs.toLocaleString('es-MX') + ' suscriptores' : '') + (subsGanados ? ' · +' + subsGanados + ' esta semana' : ''),
    };
  },

  // TikTok: perfil + vistas de tus videos recientes (TikTok no da vistas por día)
  async tiktok(token) {
    const u = await cxGet('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count', token);
    const user = (u.data && u.data.user) || {};
    const v = await cxGet('https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,create_time', token,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20 }) });
    const videos = (v.data && v.data.videos) || [];
    const hace7 = Date.now() / 1000 - 7 * 86400;
    const recientes = videos.filter(x => x.create_time >= hace7);
    const top = videos.slice().sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
    return {
      cuenta: user.display_name || '',
      seguidores: user.follower_count ?? null,
      likes: user.likes_count ?? null,
      videos: user.video_count ?? null,
      vistas: videos.reduce((x, y) => x + (y.view_count || 0), 0), // vistas de tus últimos 20 videos
      vistasSemana: recientes.reduce((x, y) => x + (y.view_count || 0), 0),
      publicadosSemana: recientes.length,
      top: top ? { titulo: (top.title || '').slice(0, 80), vistas: top.view_count || 0 } : null,
      resumen: (user.follower_count != null ? user.follower_count.toLocaleString('es-MX') + ' seguidores' : '') + (recientes.length ? ' · ' + recientes.length + (recientes.length === 1 ? ' video' : ' videos') + ' esta semana' : ''),
    };
  },
};
