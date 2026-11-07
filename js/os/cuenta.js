/* ===== REPS OS · Cuenta y sincronización =====
   Cuenta con correo y contraseña (Supabase) para que tus datos vivan en la
   nube y se sincronicen entre tu celular y tu computadora.

   Cómo funciona:
   - Supabase guarda UNA fila por clave de datos (las mismas del respaldo:
     reps-dias, reps-habitos, …) en la tabla `reps_datos`, con su texto crudo
     y un hash. Las reglas RLS de la tabla hacen que cada quien SOLO vea sus
     filas: por eso la URL y la llave pública pueden ir aquí, en el sitio.
   - `reps-sync` (por dispositivo) recuerda el hash de cada clave tal como
     quedó en la última sincronización. Al sincronizar, comparando 3 hashes
     (aquí, en la nube y la última vez) se sabe quién cambió:
       · solo cambió la nube  → se baja
       · solo cambió aquí     → se sube
       · cambiaron los dos    → las claves por fecha (días, cierres, diario…)
         se FUSIONAN; las demás: gana este dispositivo (o la nube si es la
         primera vez que este dispositivo entra a la cuenta).
   - Si se bajó algo, la página se recarga para que el motor lo cargue y
     sanee (como al importar un respaldo).
   - Sesión en `reps-cuenta`. Ni `reps-cuenta` ni `reps-sync` van en el
     respaldo: son de este dispositivo.
   - Sin internet todo sigue igual (offline-first); se sincroniza al volver.
*/
(function(){
  'use strict';
  const R = window.REPS;
  if(!R || !R.datos) return;

  // Proyecto Supabase. Valores PÚBLICOS por diseño (la seguridad la dan las
  // reglas RLS de la tabla). NUNCA poner aquí la llave secreta/service_role.
  const SB_URL = '';
  const SB_KEY = '';

  const SES_KEY = 'reps-cuenta';
  const SYNC_KEY = 'reps-sync';
  const AVISO_KEY = 'reps-sync-aviso'; // sessionStorage: toast tras recargar
  const TABLA = 'reps_datos';
  const REGRESO = location.origin + location.pathname; // a dónde vuelven los correos
  // claves "por fecha" que se pueden fusionar sin perder nada
  const MAPAS = new Set(['reps-dias', 'reps-cierres', 'reps-semana', 'reps-semana-flex', 'reps-diario', 'reps-sueno', 'reps-caidas', 'reps-energia', 'reps-gratitud', 'reps-checkin', 'reps-peso', 'reps-sueno-rutina', 'reps-record-hechos', 'reps-habsub', 'reps-plan-semana', 'reps-cierre-semana']);
  const configurada = () => !!(SB_URL && SB_KEY);

  // ---------- almacenamiento local (lecturas defensivas) ----------
  function leerJSON(k, def){
    try{ const v = JSON.parse(localStorage.getItem(k)); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : def; }catch(e){ return def; }
  }
  function guardarJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function sesion(){
    const s = leerJSON(SES_KEY, null);
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && typeof s.user_id === 'string' ? s : null;
  }
  function meta(){
    const m = leerJSON(SYNC_KEY, {});
    return { hashes: (m.hashes && typeof m.hashes === 'object') ? m.hashes : {}, ultimo: typeof m.ultimo === 'string' ? m.ultimo : null, user: m.user || null };
  }

  // ---------- avisos a la interfaz ----------
  const oyentes = [];
  let estado = { sincronizando:false, error:null };
  function avisar(){ oyentes.forEach(fn => { try{ fn(); }catch(e){} }); }

  // ---------- llamadas a Supabase ----------
  const MENSAJES = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Primero confirma tu correo (revisa tu bandeja y spam).',
    user_already_exists: 'Ese correo ya tiene cuenta: mejor entra.',
    email_exists: 'Ese correo ya tiene cuenta: mejor entra.',
    weak_password: 'La contraseña es muy débil: usa al menos 8 caracteres.',
    over_email_send_rate_limit: 'Se mandaron muchos correos. Espera unos minutos.',
    over_request_rate_limit: 'Demasiados intentos. Espera un momento.',
    validation_failed: 'Revisa el correo y la contraseña.',
    same_password: 'Esa ya es tu contraseña actual.',
  };
  async function sb(ruta, op){
    op = op || {};
    const h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if(op.token) h.Authorization = 'Bearer ' + op.token;
    Object.assign(h, op.headers || {});
    let r;
    try{ r = await fetch(SB_URL + ruta, { method: op.method || 'GET', headers: h, body: op.body ? JSON.stringify(op.body) : undefined }); }
    catch(e){ const err = new Error('Sin conexión con tu cuenta. Revisa tu internet.'); err.red = true; throw err; }
    const txt = await r.text();
    let j = null; try{ j = txt ? JSON.parse(txt) : null; }catch(e){}
    if(!r.ok){
      const code = j && (j.error_code || j.code || j.error);
      const err = new Error(MENSAJES[code] || (j && (j.msg || j.message || j.error_description)) || ('Error ' + r.status));
      err.status = r.status; err.code = code; throw err;
    }
    return j;
  }
  function guardarSesion(j, email){
    if(!j || !j.access_token) return null;
    const s = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || (Math.floor(Date.now()/1000) + (j.expires_in || 3600)),
      user_id: (j.user && j.user.id) || '', email: (j.user && j.user.email) || email || '',
    };
    guardarJSON(SES_KEY, s);
    // otra cuenta en este dispositivo: se olvida lo sincronizado antes
    const m = meta(); if(m.user && m.user !== s.user_id) guardarJSON(SYNC_KEY, {});
    return s;
  }
  async function tokenVigente(){
    const s = sesion(); if(!s) return null;
    if(s.expires_at - 60 > Date.now()/1000) return s;
    try{
      const j = await sb('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token: s.refresh_token } });
      return guardarSesion(j, s.email);
    }catch(e){
      if(e.red) throw e;
      // la sesión ya no sirve (cambió la contraseña, se cerró en otro lado…)
      try{ localStorage.removeItem(SES_KEY); }catch(_){}
      estado.error = 'Tu sesión expiró: vuelve a entrar.'; avisar();
      return null;
    }
  }

  // ---------- cuenta ----------
  async function crearCuenta(email, pass){
    const j = await sb('/auth/v1/signup?redirect_to=' + encodeURIComponent(REGRESO), { method:'POST', body:{ email, password: pass } });
    if(j && j.access_token){ guardarSesion(j, email); avisar(); sincronizar(true); return { listo:true }; }
    // Supabase no avisa si el correo ya existía (por privacidad): devuelve
    // un usuario sin identidades. Lo decimos claro.
    const u = (j && j.user) || j;
    if(u && Array.isArray(u.identities) && u.identities.length === 0) throw new Error(MENSAJES.user_already_exists);
    return { confirmar:true };
  }
  async function entrar(email, pass){
    const j = await sb('/auth/v1/token?grant_type=password', { method:'POST', body:{ email, password: pass } });
    guardarSesion(j, email); estado.error = null; avisar();
    await sincronizar(true);
    return { listo:true };
  }
  async function recuperar(email){
    await sb('/auth/v1/recover?redirect_to=' + encodeURIComponent(REGRESO), { method:'POST', body:{ email } });
  }
  async function nuevaPassword(pass){
    const s = await tokenVigente(); if(!s) throw new Error('Abre otra vez el enlace del correo.');
    await sb('/auth/v1/user', { method:'PUT', token: s.access_token, body:{ password: pass } });
  }
  function salir(){
    const s = sesion();
    if(s) sb('/auth/v1/logout', { method:'POST', token: s.access_token }).catch(() => {});
    try{ localStorage.removeItem(SES_KEY); localStorage.removeItem(SYNC_KEY); }catch(e){}
    estado.error = null; avisar();
  }

  // regreso desde el correo (confirmar cuenta / recuperar contraseña):
  // Supabase vuelve con #access_token=…&refresh_token=…&type=signup|recovery
  let regreso = null;
  (function leerRegreso(){
    const h = location.hash || '';
    if(!/access_token=|error_description=/.test(h)) return;
    const p = new URLSearchParams(h.slice(1));
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
    if(p.get('error_description')){ regreso = { ok:false, motivo: p.get('error_description').replace(/\+/g, ' ') }; return; }
    regreso = { ok:true, tipo: p.get('type') || 'signup', token: p.get('access_token'), refresh: p.get('refresh_token'), expira: Number(p.get('expires_at')) || 0 };
  })();
  async function completarRegreso(){
    if(!regreso || !regreso.ok || !configurada()) return regreso;
    try{
      const u = await sb('/auth/v1/user', { token: regreso.token });
      guardarSesion({ access_token: regreso.token, refresh_token: regreso.refresh, expires_at: regreso.expira || undefined, expires_in: 3600, user: u });
    }catch(e){ regreso = { ok:false, motivo: e.message }; }
    avisar();
    return regreso;
  }

  // ---------- sincronización ----------
  async function hashDe(s){
    if(s === null || s === undefined) return '-';
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
    let t = ''; for(let i = 0; i < 16; i++) t += b[i].toString(16).padStart(2, '0');
    return t;
  }
  function esMapaJSON(s){
    try{ const v = JSON.parse(s); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }catch(e){ return null; }
  }
  let corriendo = null, ultimoIntento = 0;
  function sincronizar(forzar){
    if(!configurada() || !sesion()) return Promise.resolve({ ok:false, motivo:'sin-sesion' });
    if(!navigator.onLine) return Promise.resolve({ ok:false, motivo:'sin-internet' });
    if(corriendo) return corriendo;
    if(!forzar && Date.now() - ultimoIntento < 30000) return Promise.resolve({ ok:true, motivo:'reciente' });
    ultimoIntento = Date.now();
    estado.sincronizando = true; avisar();
    corriendo = sincronizarYa().then(r => r, e => ({ ok:false, motivo: e.message })).then(r => {
      corriendo = null; estado.sincronizando = false;
      estado.error = r.ok ? null : (r.motivo === 'sin-sesion' ? estado.error : r.motivo);
      avisar(); return r;
    });
    return corriendo;
  }
  async function sincronizarYa(){
    const s = await tokenVigente(); if(!s) return { ok:false, motivo:'sin-sesion' };
    const m = meta();
    const primeraVez = !m.ultimo || m.user !== s.user_id;
    const base = primeraVez ? {} : m.hashes;
    const SCHEMA = R.datos.schema;

    // 1) qué hay en la nube (solo hashes: es poquito)
    const filas = await sb('/rest/v1/' + TABLA + '?select=clave,hash,schema', { token: s.access_token });
    const nube = {}; (filas || []).forEach(f => { if(f && typeof f.clave === 'string') nube[f.clave] = f; });

    // 2) decidir clave por clave
    const plan = []; // {clave, accion:'bajar'|'subir'|'fusionar'|'nube'|'aqui', local, hl, hr}
    const hashes = {};
    for(const clave of R.datos.claves()){
      const local = R.datos.leer(clave);
      const hl = await hashDe(local);
      const f = nube[clave];
      if(f && Number(f.schema) > SCHEMA){ if(base[clave]) hashes[clave] = base[clave]; continue; } // dato de una app más nueva: no tocar
      const hr = f && Number(f.schema) === SCHEMA ? f.hash : null;
      if(hr === null){ if(local !== null) plan.push({ clave, accion:'subir', local, hl }); else hashes[clave] = hl; continue; }
      if(hl === hr){ hashes[clave] = hl; continue; }
      const cambioAqui = hl !== base[clave], cambioNube = hr !== base[clave];
      if(cambioNube && !cambioAqui) plan.push({ clave, accion:'bajar', local, hl, hr });
      else if(cambioAqui && !cambioNube) plan.push({ clave, accion:'subir', local, hl });
      else plan.push({ clave, accion: MAPAS.has(clave) ? 'fusionar' : (primeraVez ? 'bajar' : 'subir'), local, hl, hr });
    }

    // 3) bajar los valores que hagan falta
    const necesito = plan.filter(p => p.accion === 'bajar' || p.accion === 'fusionar').map(p => p.clave);
    const valores = {};
    if(necesito.length){
      const lista = necesito.map(c => '"' + c + '"').join(',');
      const vs = await sb('/rest/v1/' + TABLA + '?select=clave,valor&clave=in.(' + encodeURIComponent(lista) + ')', { token: s.access_token });
      (vs || []).forEach(v => { valores[v.clave] = v.valor; });
    }

    const escribir = {}, subir = [];
    for(const p of plan){
      if(p.accion === 'subir'){ subir.push({ clave: p.clave, valor: p.local, hash: p.hl }); continue; }
      if(!(p.clave in valores)) continue; // desapareció mientras tanto: siguiente vuelta
      const remoto = valores[p.clave];
      if(p.accion === 'bajar'){ escribir[p.clave] = remoto; hashes[p.clave] = p.hr; continue; }
      // fusionar: unión de fechas (en la misma fecha gana este dispositivo,
      // salvo la primera vez, cuando manda lo que ya estaba en la cuenta)
      const L = esMapaJSON(p.local), N = esMapaJSON(remoto);
      let final;
      if(L && N) final = JSON.stringify(primeraVez ? Object.assign({}, L, N) : Object.assign({}, N, L));
      else final = primeraVez ? remoto : p.local;
      const hf = await hashDe(final);
      if(final !== p.local) escribir[p.clave] = final;
      if(hf !== p.hr) subir.push({ clave: p.clave, valor: final, hash: hf });
      else hashes[p.clave] = hf;
    }

    // 4) subir (un solo upsert)
    if(subir.length){
      const ahora = new Date().toISOString();
      await sb('/rest/v1/' + TABLA + '?on_conflict=user_id,clave', {
        method:'POST', token: s.access_token,
        headers:{ Prefer:'resolution=merge-duplicates,return=minimal' },
        body: subir.map(x => ({ user_id: s.user_id, clave: x.clave, valor: x.valor, hash: x.hash, schema: SCHEMA, actualizado: ahora })),
      });
      subir.forEach(x => { hashes[x.clave] = x.hash; });
    }

    // 5) escribir lo bajado y recargar para que el motor lo cargue
    // si tocaste algo justo mientras sincronizaba, eso no se pisa: se queda
    // para la siguiente vuelta
    const antes = {}; plan.forEach(p => { antes[p.clave] = p.local; });
    Object.keys(escribir).forEach(c => { if(R.datos.leer(c) !== antes[c]){ delete escribir[c]; delete hashes[c]; } });
    const n = Object.keys(escribir).length;
    guardarJSON(SYNC_KEY, { hashes, ultimo: new Date().toISOString(), user: s.user_id });
    if(n){
      R.datos.escribir(escribir);
      try{ sessionStorage.setItem(AVISO_KEY, String(n)); }catch(e){}
      location.reload();
    }
    return { ok:true, bajadas: n, subidas: subir.length };
  }

  // ---------- cuándo sincronizar ----------
  let espera = null;
  function programar(){ // tras cambios: junta varios toques en una subida
    if(!sesion()) return;
    clearTimeout(espera);
    espera = setTimeout(() => sincronizar(true), 6000);
  }
  R.on('render', programar);
  document.addEventListener('visibilitychange', () => {
    if(!sesion()) return;
    if(document.visibilityState === 'hidden'){ clearTimeout(espera); sincronizar(true); } // sube antes de irte
    else sincronizar(false);                                                              // baja al volver
  });
  window.addEventListener('online', () => sincronizar(true));

  function arrancar(){
    try{
      const n = sessionStorage.getItem(AVISO_KEY);
      if(n){ sessionStorage.removeItem(AVISO_KEY); R.toast('☁️ Sincronizado con tu cuenta.'); }
    }catch(e){}
    if(regreso) return; // la interfaz (shell) termina el regreso del correo
    if(sesion()) setTimeout(() => sincronizar(true), 800);
  }

  window.REPS_OS = window.REPS_OS || {};
  window.REPS_OS.cuenta = Object.freeze({
    configurada, crearCuenta, entrar, recuperar, nuevaPassword, salir, sincronizar,
    completarRegreso, regreso: () => regreso,
    sesion: () => { const s = sesion(); return s ? { email: s.email } : null; },
    ultimo: () => meta().ultimo,
    estado: () => Object.assign({}, estado),
    onCambio: (fn) => { if(typeof fn === 'function') oyentes.push(fn); },
  });
  arrancar();
})();
