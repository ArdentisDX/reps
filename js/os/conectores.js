/* ===== REPS OS · Conectores =====
   Las apps externas del Life OS: WHOOP, Google Calendar, YouTube, TikTok
   (por el Worker de Cloudflare) e IA local (Ollama en tu computadora).
   Shopify queda en el catálogo para cuando exista la tienda.

   Cómo funciona (ver también workers/CONEXIONES.md):
   - Cada dispositivo inventa una LLAVE secreta al azar (`reps-cx-llave`).
     Con ella el Worker sabe qué tokens son tuyos; la llave nunca se guarda
     en el servidor (solo su hash) y no va en el respaldo.
   - "Conectar" lleva a la pantalla oficial de permiso del servicio y
     regresa a la app con #cx=ok-<servicio> (o #cx=error-<servicio>-motivo).
   - `sincronizar()` pide a /cx/datos un RESUMEN de cada servicio y lo
     guarda en `reps-cx` = {id:{datos, actualizado, error?}}. Las tarjetas
     leen ese caché: funcionan sin internet con el último dato.
   - IA local: la app llama directo a Ollama (http://localhost:11434) desde
     el navegador de la computadora donde corre. Config en `reps-ia-local`.
   Regla del proyecto: si no hay datos, la tarjeta dice "Conectar" — nunca
   números inventados.
*/
(function(){
  'use strict';
  const CX_KEY = 'reps-cx';
  const LLAVE_KEY = 'reps-cx-llave';
  const IA_KEY = 'reps-ia-local';
  const CADA = 15 * 60000; // sincroniza como mucho cada 15 min (salvo que lo pidas)

  // icono = trazo SVG simple (24×24), sin logos de marca
  const CONECTORES = [
    { id:'whoop', nombre:'WHOOP', area:'Salud', tipo:'nube', color:'#8fe3c0',
      trae:'Recuperación, sueño, esfuerzo y variabilidad cardiaca',
      como:'Inicio de sesión oficial de WHOOP (solo lectura)',
      icono:'<path d="M3 12h4l2-6 4 12 2-6h6"/>' },
    { id:'calendar', nombre:'Google Calendar', area:'Agenda', tipo:'nube', color:'#a9dbf5',
      trae:'Tus eventos de hoy y de la semana, junto a tu rutina',
      como:'Inicio de sesión con Google (solo lectura del calendario)',
      icono:'<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/>' },
    { id:'youtube', nombre:'YouTube', area:'Creador', tipo:'nube', color:'#ffc4c4',
      trae:'Vistas de la semana, suscriptores y minutos vistos',
      como:'Inicio de sesión con Google (solo lectura del canal)',
      icono:'<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z"/>' },
    { id:'tiktok', nombre:'TikTok', area:'Creador', tipo:'nube', color:'#9ff3f0',
      trae:'Seguidores, likes y vistas de tus videos recientes',
      como:'Inicio de sesión oficial de TikTok (solo lectura)',
      icono:'<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.5 2.6 2.2 4 5 4.3"/>' },
    { id:'ia-local', nombre:'IA en tu computadora', area:'IA', tipo:'local', color:'#cfc8ff',
      trae:'Un asistente que lee tus datos sin que salgan de tu casa',
      como:'Ollama corriendo en tu Mac (funciona desde el navegador de esa compu)',
      icono:'<path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/>' },
    { id:'shopify', nombre:'Shopify', area:'Dinero', tipo:'pronto', color:'#ffcfb0',
      trae:'Ventas, pedidos y productos más vendidos',
      como:'Se conecta cuando abras tu tienda en línea',
      icono:'<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' },
  ];
  const NUBE = CONECTORES.filter(c => c.tipo === 'nube').map(c => c.id);

  // ---------- almacenamiento (lecturas defensivas: nada corrupto rompe la app) ----------
  function leerJSON(k, def){
    try{ const v = JSON.parse(localStorage.getItem(k)); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : def; }catch(e){ return def; }
  }
  function guardarJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  const cache = () => leerJSON(CX_KEY, {});
  function llave(){
    let l = null;
    try{ l = localStorage.getItem(LLAVE_KEY); }catch(e){}
    if(!l || !/^[\w-]{24,64}$/.test(l)){
      const b = crypto.getRandomValues(new Uint8Array(24));
      l = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try{ localStorage.setItem(LLAVE_KEY, l); }catch(e){}
    }
    return l;
  }
  const worker = () => (window.REPS && window.REPS.worker) || '';

  // ---------- avisos de cambio (el shell repinta) ----------
  const oyentes = [];
  const avisar = () => oyentes.forEach(f => { try{ f(); }catch(e){} });

  // ---------- conexión en la nube ----------
  async function conectar(id){
    if(!NUBE.includes(id)) return;
    const avisa = (t) => window.REPS && window.REPS.toast(t);
    if(navigator.onLine === false){ avisa('Necesitas internet para conectar ' + nombre(id) + '.'); return; }
    // ¿el Worker ya tiene las conexiones activadas? (si no, no mandamos a una página rota)
    try{
      const r = await fetch(worker() + '/cx/estado', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ llave: llave() }) });
      if(!r.ok){ avisa('Primero hay que activar las conexiones en tu servidor (Worker). Sigue la guía CONEXIONES.'); return; }
    }catch(e){ avisa('No pude hablar con tu servidor. Revisa tu internet.'); return; }
    location.href = worker() + '/cx/auth/' + id + '?llave=' + encodeURIComponent(llave());
  }
  async function desconectar(id){
    const c = cache(); delete c[id]; guardarJSON(CX_KEY, c); avisar();
    try{
      await fetch(worker() + '/cx/desconectar', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ llave: llave(), servicio: id }) });
    }catch(e){ /* sin internet: el Worker lo olvidará cuando se reconecte o expire */ }
  }
  let sincronizando = null;
  let ultimoIntento = 0;
  async function sincronizar(forzar){
    if(sincronizando) return sincronizando;
    if(navigator.onLine === false) return { ok:false, motivo:'sin-internet' };
    if(!forzar && Date.now() - ultimoIntento < CADA) return { ok:true, motivo:'reciente' };
    ultimoIntento = Date.now();
    sincronizando = (async () => {
      try{
        const r = await fetch(worker() + '/cx/datos', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ llave: llave(), servicios: NUBE, tz: new Date().getTimezoneOffset() }) });
        if(!r.ok) return { ok:false, motivo:'servidor-' + r.status };
        const d = await r.json();
        const c = cache();
        Object.keys(d.servicios || {}).forEach(id => {
          const s = d.servicios[id];
          if(!s || s.conectado === false){ delete c[id]; return; }
          if(s.datos && typeof s.datos === 'object') c[id] = { datos: s.datos, actualizado: d.actualizado || new Date().toISOString() };
          else if(s.error){ c[id] = Object.assign({}, c[id] || {}, { error: s.error }); }
        });
        guardarJSON(CX_KEY, c);
        avisar();
        return { ok:true };
      }catch(e){ return { ok:false, motivo:'red' }; }
      finally{ sincronizando = null; }
    })();
    return sincronizando;
  }
  // regreso de la pantalla de permiso: #cx=ok-whoop / #cx=error-youtube-cancelado
  function leerRegreso(){
    const m = /[#&]cx=([\w-]+)/.exec(location.hash || '');
    if(!m) return null;
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
    const p = m[1].split('-');
    return { ok: p[0] === 'ok', servicio: p[1] || '', motivo: p.slice(2).join('-') };
  }

  // ---------- IA local (Ollama) ----------
  function iaConfig(){
    const v = leerJSON(IA_KEY, {});
    return {
      url: typeof v.url === 'string' && /^https?:\/\/[\w.:-]+$/.test(v.url) ? v.url : 'http://localhost:11434',
      modelo: typeof v.modelo === 'string' && v.modelo.trim() ? v.modelo.trim().slice(0, 80) : '',
      activa: v.activa === true,
    };
  }
  function iaGuardar(cfg){ guardarJSON(IA_KEY, { url: cfg.url, modelo: cfg.modelo, activa: !!cfg.activa }); avisar(); }
  // fetch a la compu local: Chrome pide permiso de "red local" la primera vez
  const fetchLocal = (u, op) => fetch(u, Object.assign({ mode:'cors', targetAddressSpace:'loopback' }, op || {}));
  async function iaProbar(url){
    try{
      const r = await fetchLocal((url || iaConfig().url) + '/api/tags');
      if(!r.ok) return { ok:false, motivo:'Ollama respondió ' + r.status };
      const d = await r.json();
      return { ok:true, modelos: (d.models || []).map(m => m.name).filter(Boolean) };
    }catch(e){ return { ok:false, motivo:'No encontré Ollama en ' + (url || iaConfig().url) + '. ¿Está abierto y con permiso para esta página?' }; }
  }
  async function iaPreguntar(pregunta, sistema){
    const cfg = iaConfig();
    if(!cfg.activa || !cfg.modelo) throw new Error('La IA local no está configurada.');
    const r = await fetchLocal(cfg.url + '/api/chat', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model: cfg.modelo, stream:false, messages:[{ role:'system', content: sistema || '' }, { role:'user', content: pregunta }] }) });
    if(!r.ok) throw new Error('Ollama respondió ' + r.status);
    const d = await r.json();
    return (d.message && d.message.content || '').trim();
  }

  // ---------- contexto para la IA (nube o local) ----------
  function contextoExtra(){
    const c = cache(), l = [];
    const w = c.whoop && c.whoop.datos;
    if(w){
      const p = [];
      if(w.recuperacion != null) p.push('recuperación ' + w.recuperacion + '%');
      if(w.vfc != null) p.push('VFC ' + w.vfc + ' ms');
      if(w.fcReposo != null) p.push('FC en reposo ' + w.fcReposo);
      if(w.suenoMin != null) p.push('durmió ' + Math.floor(w.suenoMin/60) + ' h ' + (w.suenoMin % 60) + ' min');
      if(w.suenoRendimiento != null) p.push('rendimiento de sueño ' + w.suenoRendimiento + '%');
      if(w.esfuerzo != null) p.push('esfuerzo de hoy ' + w.esfuerzo);
      if(p.length) l.push('WHOOP (hoy): ' + p.join(', ') + '.');
    }
    const cal = c.calendar && c.calendar.datos;
    if(cal && Array.isArray(cal.eventos) && cal.eventos.length){
      l.push('Google Calendar (próximos): ' + cal.eventos.slice(0, 8).map(e => {
        const f = new Date(e.inicio);
        return (e.todoElDia ? f.toLocaleDateString('es-MX', { weekday:'short', day:'numeric' }) + ' (todo el día)' :
          f.toLocaleDateString('es-MX', { weekday:'short', day:'numeric' }) + ' ' + f.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })) + ' ' + e.titulo;
      }).join(' · ') + '.');
    }
    const yt = c.youtube && c.youtube.datos;
    if(yt) l.push('YouTube' + (yt.canal ? ' (' + yt.canal + ')' : '') + ': ' + (yt.vistas != null ? yt.vistas + ' vistas en 7 días, ' : '') +
      (yt.subs != null ? yt.subs + ' suscriptores' : '') + (yt.subsGanados ? ' (+' + yt.subsGanados + ' esta semana)' : '') + '.');
    const tt = c.tiktok && c.tiktok.datos;
    if(tt) l.push('TikTok: ' + (tt.seguidores != null ? tt.seguidores + ' seguidores, ' : '') + (tt.publicadosSemana || 0) + ' videos esta semana' +
      (tt.vistasSemana ? ' con ' + tt.vistasSemana + ' vistas' : '') + (tt.top ? '; su video más visto reciente: "' + tt.top.titulo + '" (' + tt.top.vistas + ' vistas)' : '') + '.');
    return l.length ? 'Datos de sus apps conectadas:\n' + l.join('\n') : '';
  }

  const nombre = (id) => (CONECTORES.find(c => c.id === id) || {}).nombre || id;
  function datos(id){
    const c = cache()[id];
    return (c && c.datos && typeof c.datos === 'object') ? c : null;
  }

  window.REPS_OS = window.REPS_OS || {};
  window.REPS_OS.conectores = {
    lista: () => CONECTORES.slice(),
    get: (id) => CONECTORES.find(c => c.id === id) || null,
    datos,                                   // {datos, actualizado} o null
    entrada: (id) => cache()[id] || null,    // incluye error si lo hubo
    conectado: (id) => id === 'ia-local' ? iaConfig().activa : !!cache()[id],
    icono: (id, size) => {
      const c = CONECTORES.find(x => x.id === id);
      const s = size || 18;
      return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (c ? c.icono : '') + '</svg>';
    },
    conectar, desconectar, sincronizar, leerRegreso,
    onCambio: (f) => { if(typeof f === 'function') oyentes.push(f); },
    ia: { config: iaConfig, guardar: iaGuardar, probar: iaProbar, preguntar: iaPreguntar },
  };
  window.REPS_OS.contextoExtra = contextoExtra;
})();
