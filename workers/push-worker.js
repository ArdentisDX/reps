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
