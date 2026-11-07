/* ===== REPS OS · Shell del Life OS =====
   La app principal: navegación (menú lateral en PC, píldora flotante en
   celular) y las secciones Inicio, Salud, Dinero, Creador, Agenda y
   Asistente IA. REPS (hábitos) vive como una sección más: "Hábitos", con
   sus 5 pestañas de siempre.

   Reglas (ver CLAUDE.md → REPS OS):
   - Datos SOLO por window.REPS (view-models). Nunca localStorage del motor.
   - Para abrir hojas existentes se "tocan" sus botones de siempre
     (masFin, suenoOpen, iaBtn…): una sola lógica, sin duplicarla.
   - Texto de usuario/datos al DOM con textContent; innerHTML solo para
     íconos SVG fijos de este archivo.
   - Conectores sin datos muestran "Conectar": nunca números inventados.

   Vista PC/celular: `reps-vista` ∈ auto|pc|movil (ausente = auto). Auto
   decide por el ancho de la ventana (≥ 900 px = PC) y se re-evalúa al
   girar o redimensionar. Clases en <body>: os, os-pc | os-movil, os-v-<sección>.
*/
(function(){
  'use strict';
  const R = window.REPS;
  if(!R) return;
  const CX = (window.REPS_OS && window.REPS_OS.conectores) || null;
  const CU = (window.REPS_OS && window.REPS_OS.cuenta) || null;
  const $ = id => document.getElementById(id);
  const body = document.body;

  // ---------- utilidades ----------
  function el(tag, cls, txt){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(txt != null) e.textContent = txt;
    return e;
  }
  function btn(cls, txt, fn){
    const b = el('button', cls, txt); b.type = 'button';
    if(fn) b.addEventListener('click', fn);
    return b;
  }
  const ICON = {
    casa:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>',
    salud:'<path d="M12 20s-7-4.4-9.3-8.8A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 9.3 5.2C19 15.6 12 20 12 20z"/>',
    chispa:'<path d="M12 2.5c.5 4.3 1.7 5.5 6 6-4.3.5-5.5 1.7-6 6-.5-4.3-1.7-5.5-6-6 4.3-.5 5.5-1.7 6-6z" fill="currentColor" stroke="none"/><path d="M18.5 15c.2 1.8.7 2.3 2.5 2.5-1.8.2-2.3.7-2.5 2.5-.2-1.8-.7-2.3-2.5-2.5 1.8-.2 2.3-.7 2.5-2.5z" fill="currentColor" stroke="none"/>',
    dinero:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    play:'<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z"/>',
    cal:'<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/>',
    check:'<path d="M4 7h11M4 12h11M4 17h7"/><path d="m16.5 16.5 2 2 3.5-4"/>',
    reloj:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    compas:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    bandeja:'<path d="M3.5 13.5 6 5.5a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 5.5l2.5 8"/><path d="M3.5 13.5H8l1.5 2.5h5L16 13.5h4.5v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    barras:'<path d="M5 20V11M12 20V4M19 20v-6"/>',
    enlace:'<path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8"/>',
    engrane:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    luna:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    gota:'<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/>',
    rayo:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    flecha:'<path d="m9 6 6 6-6 6"/>',
    mas:'<path d="M12 5v14M5 12h14"/>',
    pantalla:'<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    nube:'<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/>',
    bolsa:'<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  };
  const svg = (k, s) => '<svg width="' + (s||20) + '" height="' + (s||20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || '') + '</svg>';
  function ic(k, s, cls){ const i = el('span', cls || 'o-ic'); i.innerHTML = svg(k, s); return i; }
  const click = id => { const b = $(id); if(b) b.click(); };
  function fmtHoras(min){ return min == null ? '—' : Math.floor(min/60) + ':' + String(min % 60).padStart(2, '0'); }
  function fmtCorto(n){
    if(n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if(a >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
    if(a >= 1e4) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
    return Math.round(n).toLocaleString('es-MX');
  }
  function enMin(min){ return min >= 60 ? Math.floor(min/60) + ' h ' + (min % 60) + ' min' : min + ' min'; }
  // anillo SVG (estilo WHOOP): pct 0..1
  function anillo(pct, color, size){
    const s = size || 84, r = s/2 - 6, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct || 0));
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" aria-hidden="true">' +
      '<circle cx="' + s/2 + '" cy="' + s/2 + '" r="' + r + '" fill="none" stroke="var(--o-track)" stroke-width="8"/>' +
      '<circle cx="' + s/2 + '" cy="' + s/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '" transform="rotate(-90 ' + s/2 + ' ' + s/2 + ')"/></svg>';
  }
  // tarjeta base
  function card(cls, label, iconK){
    const c = el('div', 'o-card ' + (cls || ''));
    if(label){
      const h = el('div', 'o-lbl');
      if(iconK) h.appendChild(ic(iconK, 14, 'o-lbl-ic'));
      h.appendChild(document.createTextNode(label));
      c.appendChild(h);
    }
    return c;
  }
  function cardHead(c, label, iconK, accion, fn){
    const row = el('div', 'o-row');
    const h = el('div', 'o-lbl');
    if(iconK) h.appendChild(ic(iconK, 14, 'o-lbl-ic'));
    h.appendChild(document.createTextNode(label));
    row.appendChild(h);
    if(accion) row.appendChild(btn('o-link', accion + ' →', fn));
    c.appendChild(row);
    return row;
  }

  // ---------- navegación ----------
  const SECCIONES = [
    { id:'inicio',  nombre:'Inicio',       icon:'casa',   titulo:null },
    { id:'salud',   nombre:'Salud',        icon:'salud',  titulo:'Salud',    sub:'Sueño, agua, recuperación y bienestar' },
    { id:'dinero',  nombre:'Dinero',       icon:'dinero', titulo:'Dinero',   sub:'Tus finanzas y tu tienda' },
    { id:'creador', nombre:'Creador',      icon:'play',   titulo:'Creador',  sub:'Tu canal, tus videos y tus ideas' },
    { id:'agenda',  nombre:'Agenda',       icon:'cal',    titulo:'Agenda',   sub:'Tu rutina, tus pendientes y lo que viene' },
    { id:'ia',      nombre:'Asistente IA', icon:'chispa', titulo:'Asistente',sub:'Tu IA conoce tus datos y te ayuda a decidir' },
  ];
  const REPS_TABS = [
    { panel:'p-hoy',     nombre:'Hoy',     icon:'check'   },
    { panel:'p-dia',     nombre:'Mi día',  icon:'reloj'   },
    { panel:'p-ruta',    nombre:'Ruta',    icon:'compas'  },
    { panel:'p-bandeja', nombre:'Bandeja', icon:'bandeja' },
    { panel:'p-stats',   nombre:'Stats',   icon:'barras'  },
  ];
  let vista = 'inicio';
  let repsPanel = 'p-hoy';

  function panelActivo(){ const t = document.querySelector('.tab.active'); return t ? t.dataset.panel : 'p-hoy'; }
  function irA(v, panel){
    if(v === 'reps'){
      repsPanel = panel || panelActivo();
      const t = document.querySelector('.tab[data-panel="' + repsPanel + '"]');
      if(t && !t.classList.contains('active')){ irando = true; t.click(); irando = false; }
    }
    vista = v;
    SECCIONES.concat([{id:'reps'}]).forEach(s => body.classList.toggle('os-v-' + s.id, s.id === v));
    marcarNav();
    pintarCabecera();
    pintarVista();
    cerrarMas();
    window.scrollTo(0, 0);
  }
  let irando = false;
  // tocar una pestaña de REPS (atajos ?tab=, botones internos) lleva a Hábitos
  document.querySelectorAll('.tab[data-panel]').forEach(t => t.addEventListener('click', () => {
    if(irando) return;
    if(vista !== 'reps') irA('reps', t.dataset.panel);
    else { repsPanel = t.dataset.panel; marcarNav(); }
  }));

  // menú lateral (PC) + píldora (celular): un solo <nav> que el CSS acomoda
  const nav = el('nav', 'os-nav'); nav.id = 'osNav'; nav.setAttribute('aria-label', 'Secciones');
  const marca = el('div', 'os-marca'); marca.append(document.createTextNode('REPS'), el('span', null, 'OS'));
  nav.appendChild(marca);
  function navItem(id, nombre, icon, fn, extra){
    const b = btn('os-it' + (extra ? ' ' + extra : ''), null, fn);
    b.dataset.nav = id;
    b.appendChild(ic(icon, 20, 'os-it-ic'));
    b.appendChild(el('span', 'os-it-tx', nombre));
    nav.appendChild(b);
    return b;
  }
  SECCIONES.forEach(s => navItem(s.id, s.nombre, s.icon, () => irA(s.id), s.id === 'ia' ? 'es-ia' : ''));
  nav.appendChild(el('div', 'os-grp', 'REPS · hábitos'));
  REPS_TABS.forEach(t => navItem('reps:' + t.panel, t.nombre, t.icon, () => irA('reps', t.panel), 'es-reps'));
  nav.appendChild(el('div', 'os-sp'));
  navItem('cuenta', 'Tu cuenta', 'nube', () => abrirCuenta(), 'es-pie');
  navItem('cx', 'Conexiones', 'enlace', abrirConexiones, 'es-pie');
  navItem('ajustes', 'Ajustes', 'engrane', () => click('themeBtn'), 'es-pie');
  navItem('mas', 'Más', 'menu', abrirMas, 'es-mas');

  function marcarNav(){
    nav.querySelectorAll('.os-it').forEach(b => {
      const n = b.dataset.nav;
      const on = n === vista || (vista === 'reps' && n === 'reps:' + repsPanel) ||
        (n === 'mas' && ['creador','agenda','reps'].includes(vista));
      b.classList.toggle('on', on);
      if(on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ---------- cabecera ----------
  const main = el('div', 'os-main'); main.id = 'osMain';
  const head = el('header', 'os-head');
  const hTx = el('div', 'os-head-tx');
  const h1 = el('h1', 'os-h1');
  const hSub = el('div', 'os-sub');
  hTx.append(h1, hSub);
  const hAct = el('div', 'os-head-act');
  const bArma = btn('os-cta solo-pc', null, () => click('armaDia'));
  bArma.append(ic('chispa', 18, 'os-cta-ic'), document.createTextNode('Arma mi día'));
  const bGear = btn('os-gear', null, () => click('themeBtn'));
  bGear.setAttribute('aria-label', 'Ajustes'); bGear.innerHTML = svg('engrane', 20);
  hAct.append(bArma, bGear);
  head.append(hTx, hAct);
  main.appendChild(head);

  function saludo(){
    const h = new Date().getHours();
    return h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
  function fechaLarga(){
    const s = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function pintarCabecera(){
    h1.textContent = '';
    if(vista === 'inicio'){
      const n = R.hoy().nombre;
      h1.appendChild(document.createTextNode(saludo() + (n ? ', ' : '')));
      if(n) h1.appendChild(el('em', null, n));
      hSub.textContent = fechaLarga();
    } else if(vista === 'reps'){
      h1.textContent = 'Hábitos';
      hSub.textContent = 'Tu sistema REPS · ' + fechaLarga();
    } else {
      const s = SECCIONES.find(x => x.id === vista);
      h1.textContent = s.titulo; hSub.textContent = s.sub;
    }
  }

  // ---------- secciones ----------
  const VISTAS = {};
  SECCIONES.forEach(s => {
    const sec = el('section', 'os-view'); sec.dataset.view = s.id;
    VISTAS[s.id] = sec; main.appendChild(sec);
  });

  // tarjeta de conector: datos reales del caché, o invitación a conectar
  function cxValor(id, d){
    if(id === 'youtube') return d.vistas != null ? { n: fmtCorto(d.vistas), sub: 'vistas · 7 días' } : { n: fmtCorto(d.vistasTotales), sub: 'vistas totales' };
    if(id === 'tiktok') return d.publicadosSemana ? { n: fmtCorto(d.vistasSemana), sub: 'vistas · videos de la semana' } : { n: fmtCorto(d.vistas), sub: 'vistas · últimos videos' };
    if(id === 'shopify') return { n: R.dinero().fmt(+d.ventas || 0), sub: 'ventas' };
    if(id === 'whoop') return { n: d.recuperacion != null ? d.recuperacion + '%' : '—', sub: 'recuperación' };
    if(id === 'calendar') return { n: String((d.eventos || []).length), sub: 'eventos esta semana' };
    return { n: '—', sub: '' };
  }
  function cxTile(id, cls, opciones){
    const c = CX && CX.get(id);
    const t = el('button', 'o-card o-cx ' + cls); t.type = 'button';
    const lbl = el('div', 'o-lbl');
    if(c){ const i = el('span', 'o-lbl-ic'); i.innerHTML = CX.icono(id, 14); lbl.appendChild(i); }
    lbl.appendChild(document.createTextNode(c ? c.nombre : id));
    t.appendChild(lbl);
    const d = CX && CX.datos(id);
    const ent = CX && CX.entrada(id);
    if(d && d.datos){
      const v = cxValor(id, d.datos);
      t.appendChild(el('div', 'o-num o-num-m', v.n));
      t.appendChild(el('div', 'o-sub', v.sub + (d.datos.resumen ? ' · ' + d.datos.resumen : '')));
      if(opciones && opciones.extra) opciones.extra(t, d.datos);
      t.addEventListener('click', opciones && opciones.ir ? opciones.ir : abrirConexiones);
    } else {
      t.classList.add('off');
      const pronto = c && c.tipo === 'pronto';
      t.appendChild(el('div', 'o-conectar' + (pronto ? ' pronto' : ''), pronto ? 'Próximamente' : (ent && ent.error ? 'Reconectar' : 'Conectar')));
      t.appendChild(el('div', 'o-sub', opciones && opciones.vacio ? opciones.vacio : (c ? c.trae : '')));
      t.addEventListener('click', abrirConexiones);
    }
    return t;
  }
  // eventos de Google Calendar de HOY (los que no han terminado)
  function eventosHoy(){
    const d = CX && CX.datos('calendar');
    if(!d || !Array.isArray(d.datos.eventos)) return [];
    const hoy = R.hoyISO(), ahora = Date.now();
    return d.datos.eventos.filter(e => {
      if(e.todoElDia) return e.inicio === hoy;
      const ini = new Date(e.inicio), fin = new Date(e.fin || e.inicio);
      const k = ini.getFullYear() + '-' + String(ini.getMonth()+1).padStart(2,'0') + '-' + String(ini.getDate()).padStart(2,'0');
      return k === hoy && fin.getTime() > ahora;
    }).map(e => {
      const ini = new Date(e.inicio);
      return { titulo:e.titulo, lugar:e.lugar, todoElDia:e.todoElDia, ahora: !e.todoElDia && ini.getTime() <= ahora,
        hora: e.todoElDia ? 'Hoy' : String(ini.getHours()).padStart(2,'0') + ':' + String(ini.getMinutes()).padStart(2,'0'),
        min: e.todoElDia ? -1 : ini.getHours()*60 + ini.getMinutes() };
    });
  }

  // --- Inicio ---
  function pintarInicio(v){
    const H = R.hoy(), S = R.salud(), D = R.dinero(), A = R.agenda();
    const g = el('div', 'o-grid o-grid-inicio');

    // 1) IA: tu siguiente movimiento
    const ia = card('o-lav o-ia', null);
    cardHead(ia, 'Tu siguiente movimiento', 'chispa');
    // el ícono de la tarjeta ya marca la acción: se quita el emoji inicial del consejo
    const consejo = (H.consejo || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '') || (H.ganado ? 'Día ganado. Lo que queda de hoy es tuyo: descansa sin culpa.' :
      H.descanso ? 'Hoy es descanso. Recarga para mañana.' : 'Marca tu primer innegociable y arranca el día.');
    const nx = el('div', 'o-next');
    nx.append(ic('flecha', 16, 'o-next-ic'), el('p', null, consejo));
    ia.appendChild(nx);
    const br = R.brief();
    if(br){ const p = el('p', 'o-brief solo-pc', br); ia.appendChild(p); }
    ia.appendChild(btn('o-link o-link-ia', 'Arma tu día con IA →', () => click('armaDia')));
    g.appendChild(ia);

    // 2) cómo vienes hoy: 3 anillos
    const rg = card('o-rings', null);
    cardHead(rg, 'Cómo vienes hoy');
    const fila = el('div', 'o-ring-row');
    const whoop = CX && CX.datos('whoop');
    const r1 = whoop && whoop.datos && whoop.datos.recuperacion != null
      ? { pct: whoop.datos.recuperacion/100, val: Math.round(whoop.datos.recuperacion) + '%', lbl:'Recuperación', color: whoop.datos.recuperacion >= 67 ? '#3fbf6f' : whoop.datos.recuperacion >= 34 ? '#f2b33d' : '#ef5b5b', go: () => irA('salud') }
      : { pct: H.descanso ? 0 : (H.puntaje || 0)/100, val: H.descanso ? '·' : String(H.puntaje || 0), lbl:'Puntaje', color:'var(--o-lime-ring)', go: () => irA('reps', 'p-stats') };
    const wS = whoop && whoop.datos && whoop.datos.suenoMin != null ? whoop.datos.suenoMin : null;
    const sMin = S.suenoHoy != null ? S.suenoHoy : (wS != null ? wS : S.suenoProm);
    const r2 = { pct: sMin != null ? sMin/480 : 0, val: fmtHoras(sMin), lbl: S.suenoHoy != null || wS != null ? 'Sueño' : (sMin != null ? 'Sueño · prom.' : 'Registra sueño'), color:'#6fbbe8', go: () => wS != null && S.suenoHoy == null ? irA('salud') : click('suenoOpen') };
    const r3 = { pct: H.core.total ? H.core.hechos/H.core.total : 0, val:'🔥' + H.racha, lbl: H.descanso ? 'Racha · descanso' : 'Racha · ' + H.core.hechos + ' de ' + H.core.total, color:'var(--text)', go: () => irA('reps', 'p-hoy') };
    [r1, r2, r3].forEach(r => {
      const b = btn('o-ring', null, r.go);
      const w = el('span', 'o-ring-w'); w.innerHTML = anillo(r.pct, r.color, 84);
      w.appendChild(el('span', 'o-ring-v', r.val));
      b.append(w, el('span', 'o-ring-l', r.lbl));
      fila.appendChild(b);
    });
    rg.appendChild(fila);
    g.appendChild(rg);

    // 3) PC: agua y dinero junto a los anillos
    const agua = el('button', 'o-card o-mint o-mini solo-pc'); agua.type = 'button';
    agua.append(Object.assign(el('div', 'o-lbl'), {}), el('div', 'o-num o-num-m', S.agua.hoy + '/' + S.agua.meta), el('div', 'o-sub', 'vasos de agua hoy'));
    agua.firstChild.append(ic('gota', 14, 'o-lbl-ic'), document.createTextNode('Agua'));
    agua.addEventListener('click', () => click('biAgua'));
    g.appendChild(agua);
    const din = el('button', 'o-card o-mini solo-pc o-din'); din.type = 'button';
    const dl = el('div', 'o-lbl'); dl.append(ic('dinero', 14, 'o-lbl-ic'), document.createTextNode('Dinero · mes'));
    din.append(dl, el('div', 'o-num o-num-m' + (D.saldo < 0 ? ' neg' : ''), D.fmt(D.saldo)),
      el('div', 'o-sub', D.hayDatos ? (D.gastoHoy > 0 ? 'hoy −' + D.fmt(D.gastoHoy).replace('−','') : 'disponible') : 'Registra tu primer movimiento'));
    din.addEventListener('click', () => irA('dinero'));
    g.appendChild(din);

    // 4) innegociables (lo esencial de REPS)
    const hb = card('o-habs', null);
    cardHead(hb, 'Innegociables', null, 'REPS', () => irA('reps', 'p-hoy'));
    const core = H.habitos.filter(h => h.core);
    if(H.descanso || !core.length){
      hb.appendChild(el('div', 'o-vacio', 'Hoy es descanso: ningún innegociable programado.'));
    } else core.forEach(h => hb.appendChild(filaHabito(h)));
    g.appendChild(hb);

    // 5) racha + semana (PC)
    const rc = card('o-ink o-racha solo-pc', null);
    cardHead(rc, '🔥 Racha REPS');
    const rn = el('div', 'o-racha-n');
    rn.append(el('span', 'o-num o-num-l', H.racha + (H.racha === 1 ? ' día' : ' días')), el('span', 'o-sub', 'récord ' + H.mejor));
    rc.appendChild(rn);
    const sem = el('div', 'o-semana');
    H.semana.forEach(d => sem.appendChild(el('i', d.hoy ? 'hoy' : d.ganado ? 'ok' : d.descanso ? 'rest' : '')));
    rc.appendChild(sem);
    g.appendChild(rc);

    // 6) lo que sigue (celular) / agenda (PC)
    const sig = siguienteCosa(A);
    const ns = card('o-sigue solo-movil', null);
    if(sig){
      const tx = el('div', 'o-sigue-tx');
      tx.append(Object.assign(el('div', 'o-lbl', 'Lo que sigue')), el('div', 'o-sigue-t', sig.titulo), el('div', 'o-sub', sig.detalle));
      ns.append(tx, el('span', 'o-hora' + (sig.ahora ? ' now' : ''), sig.hora));
    } else ns.append(el('div', 'o-lbl', 'Lo que sigue'), el('div', 'o-vacio', 'Nada más por hoy.'));
    ns.addEventListener('click', () => irA('agenda'));
    g.appendChild(ns);
    g.appendChild(agendaCard(A, 'solo-pc o-agenda-ini', 4));

    v.appendChild(g);

    // 7) tu mundo
    const mh = el('div', 'o-sec');
    mh.append(el('h2', null, 'Tu mundo'), btn('o-link', 'Conexiones →', abrirConexiones));
    v.appendChild(mh);
    const mundo = el('div', 'o-mundo');
    mundo.append(
      cxTile('youtube', 'o-rose', { vacio:'Tus vistas, aquí', ir: () => irA('creador') }),
      cxTile('tiktok', 'o-ink', { vacio:'Tus vistas, aquí', ir: () => irA('creador') }),
      cxTile('shopify', 'o-peach', { vacio:'Cuando abras tu tienda' }));
    v.appendChild(mundo);
  }
  function filaHabito(h){
    const b = btn('o-hab' + (h.hecho ? ' done' : ''), null, () => R.marcar(h.id));
    b.setAttribute('aria-pressed', h.hecho ? 'true' : 'false');
    const chk = el('span', 'o-chk'); chk.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
    const tx = el('span', 'o-hab-tx', (h.emoji ? h.emoji + ' ' : '') + h.nombre);
    b.append(chk, tx);
    if(h.meta > 0) b.appendChild(el('span', 'o-hab-n', h.cuenta + '/' + h.meta));
    return b;
  }
  function siguienteCosa(A){
    const ahora = new Date().getHours()*60 + new Date().getMinutes();
    const cands = [];
    if(A.recordatorios[0]){ const r = A.recordatorios[0]; cands.push({ titulo:r.texto, detalle:'Recordatorio · en ' + enMin(r.min - ahora), hora:r.hora, min:r.min }); }
    if(A.bloque){
      const [h, m] = A.bloque.horaSiguiente.split(':').map(Number); let mm = h*60 + m; if(mm < ahora) mm += 1440;
      cands.push({ titulo:A.bloque.siguiente, detalle:'Tu rutina · en ' + enMin(A.bloque.resta), hora:A.bloque.horaSiguiente, min:mm });
    }
    eventosHoy().filter(e => !e.todoElDia && !e.ahora).forEach(e => cands.push({ titulo:e.titulo, detalle:'Calendar · en ' + enMin(e.min - ahora) + (e.lugar ? ' · ' + e.lugar : ''), hora:e.hora, min:e.min }));
    cands.sort((a,b) => a.min - b.min);
    if(cands[0]) return cands[0];
    if(A.eventos[0]){ const e = A.eventos[0]; return { titulo:e.nombre, detalle:'Cuenta regresiva', hora: e.faltan === 0 ? 'Hoy' : e.faltan + ' d' }; }
    return null;
  }
  function agendaCard(A, cls, max){
    const c = card('o-agenda ' + (cls || ''), null);
    cardHead(c, 'Agenda', 'cal', 'Ver', () => irA('agenda'));
    const fila = (titulo, detalle, hora, now) => {
      const f = el('div', 'o-ev');
      const tx = el('div', 'o-ev-tx'); tx.append(el('b', null, titulo), el('i', null, detalle));
      f.append(tx, el('span', 'o-hora' + (now ? ' now' : ''), hora));
      c.appendChild(f);
    };
    let n = 0;
    eventosHoy().forEach(e => { if(n < max){ fila(e.titulo, e.ahora ? 'Ahora · Calendar' : 'Calendar' + (e.lugar ? ' · ' + e.lugar : ''), e.hora, e.ahora); n++; } });
    if(A.bloque && n < max){ fila(A.bloque.actual, 'Ahora · faltan ' + enMin(A.bloque.resta), A.bloque.horaActual, true); n++; }
    A.recordatorios.forEach(r => { if(n < max){ fila(r.texto, 'Recordatorio', r.hora); n++; } });
    if(A.bloque && n < max){ fila(A.bloque.siguiente, 'Sigue en tu rutina', A.bloque.horaSiguiente); n++; }
    A.eventos.forEach(e => { if(n < max){ fila(e.nombre, 'Cuenta regresiva', e.faltan === 0 ? 'Hoy' : e.faltan + ' d'); n++; } });
    if(!n) c.appendChild(el('div', 'o-vacio', 'Arma tu rutina y aquí verás qué sigue.'));
    return c;
  }

  // --- Salud ---
  function pintarSalud(v){
    const S = R.salud(), H = R.hoy();
    const g = el('div', 'o-grid o-grid-salud');
    // WHOOP
    const w = CX && CX.datos('whoop');
    if(w && w.datos){
      const wd = w.datos;
      const c = card('o-lime o-whoop', 'Recuperación · WHOOP', 'rayo');
      const r = el('span', 'o-ring-w o-ring-big'); r.innerHTML = anillo((wd.recuperacion || 0)/100, '#141414', 150);
      r.appendChild(el('span', 'o-ring-v', wd.recuperacion != null ? wd.recuperacion + '%' : '—'));
      c.appendChild(r);
      const met = el('div', 'o-met');
      [['VFC', wd.vfc != null ? wd.vfc + ' ms' : '—'], ['FC reposo', wd.fcReposo != null ? wd.fcReposo : '—'],
       ['Esfuerzo', wd.esfuerzo != null ? wd.esfuerzo : '—'], ['Sueño', wd.suenoRendimiento != null ? wd.suenoRendimiento + '%' : '—']].forEach(([k, val]) => {
        const m = el('div', 'o-met-i'); m.append(el('b', null, String(val)), el('span', null, k)); met.appendChild(m);
      });
      c.appendChild(met);
      c.appendChild(el('div', 'o-sub', 'Actualizado ' + haceCuanto(w.actualizado)));
      g.appendChild(c);
    } else {
      g.appendChild(cxTile('whoop', 'o-lime o-whoop', { vacio:'Recuperación, esfuerzo y variabilidad cardiaca de tu WHOOP.' }));
    }
    // Sueño con gráfica de 7 noches
    const sn = el('button', 'o-card o-sky o-sueno'); sn.type = 'button';
    const sl = el('div', 'o-lbl'); sl.append(ic('luna', 14, 'o-lbl-ic'), document.createTextNode('Sueño'));
    sn.appendChild(sl);
    const wMin = w && w.datos && w.datos.suenoMin != null ? w.datos.suenoMin : null;
    const sMin = S.suenoHoy != null ? S.suenoHoy : wMin;
    sn.appendChild(el('div', 'o-num o-num-l', fmtHoras(sMin)));
    sn.appendChild(el('div', 'o-sub', S.suenoHoy == null && wMin != null ? 'según WHOOP · toca para registrar a mano' :
      sMin != null ? (S.suenoProm != null ? 'promedio ' + fmtHoras(S.suenoProm) : '') : 'Toca para registrar tu noche'));
    const bars = el('div', 'o-bars');
    S.noches.forEach(nn => { const i = el('i', nn.min == null ? 'vacia' : ''); i.style.height = nn.min == null ? '8%' : Math.min(100, Math.max(10, nn.min / 600 * 100)) + '%'; bars.appendChild(i); });
    sn.appendChild(bars);
    sn.addEventListener('click', () => click('suenoOpen'));
    g.appendChild(sn);
    // Agua
    const ag = el('button', 'o-card o-mint o-agua'); ag.type = 'button';
    const al = el('div', 'o-lbl'); al.append(ic('gota', 14, 'o-lbl-ic'), document.createTextNode('Agua'));
    ag.append(al, el('div', 'o-num o-num-l', S.agua.hoy + '/' + S.agua.meta));
    const vasos = el('div', 'o-vasos');
    for(let i = 0; i < Math.min(12, S.agua.meta); i++) vasos.appendChild(el('i', i < S.agua.hoy ? 'on' : ''));
    ag.appendChild(vasos);
    ag.addEventListener('click', () => click('biAgua'));
    g.appendChild(ag);
    // Energía y peso
    const en = card('o-mini o-energia', 'Energía de hoy', 'rayo');
    const ener = { verde:'🟢 Con todo', ambar:'🟡 Normal', rojo:'🔴 Bajo' }[S.energia] || 'Sin marcar';
    en.appendChild(el('div', 'o-num o-num-s', ener));
    en.appendChild(btn('o-link', 'Marcar en REPS →', () => irA('reps', 'p-hoy')));
    g.appendChild(en);
    const pe = el('button', 'o-card o-mini o-peso'); pe.type = 'button';
    pe.append(el('div', 'o-lbl', 'Peso'), el('div', 'o-num o-num-m', S.peso ? S.peso.kg + ' kg' : '—'), el('div', 'o-sub', S.peso ? 'último registro' : 'Toca para registrar'));
    pe.addEventListener('click', () => click('biPeso'));
    g.appendChild(pe);
    v.appendChild(g);
    // herramientas de bienestar
    v.appendChild(Object.assign(el('div', 'o-sec'), {})).appendChild(el('h2', null, 'Bienestar'));
    const tools = el('div', 'o-tools');
    [['biRespira','🌬️','Respiración','Calma en 1 minuto'],['biGratitud','🙏','Gratitud','3 cosas buenas'],
     ['biPausas','🤸','Pausas activas','Estírate sentado'],['biSueno','🌙','Bajada nocturna','Antes de dormir']].forEach(([id, e, t, d]) => {
      const b = btn('o-tool', null, () => click(id));
      b.append(el('span', 'o-tool-e', e), el('b', null, t), el('i', null, d));
      tools.appendChild(b);
    });
    v.appendChild(tools);
    if(H.racha >= 0) {} // (reservado: cruces salud ↔ hábitos en Fase 3)
  }

  // --- Dinero ---
  function pintarDinero(v){
    const D = R.dinero();
    const g = el('div', 'o-grid o-grid-dinero');
    const hero = card('o-ink o-saldo', 'Disponible · ' + new Date(D.mes + '-15T12:00:00').toLocaleDateString('es-MX', { month:'long' }), 'dinero');
    hero.appendChild(el('div', 'o-num o-num-xl' + (D.saldo < 0 ? ' neg' : ''), D.fmt(D.saldo)));
    const io = el('div', 'o-io');
    io.append(el('span', 'o-in', '+ ' + D.fmt(D.ingresos) + ' ingresos'), el('span', 'o-out', '− ' + D.fmt(D.gastos).replace('−','') + ' gastos'));
    hero.appendChild(io);
    if(D.presupuesto > 0){
      const pct = Math.min(100, Math.round(D.gastos / D.presupuesto * 100));
      const pb = el('div', 'o-pbar'); const i = el('i'); i.style.width = pct + '%'; pb.appendChild(i);
      hero.append(pb, el('div', 'o-sub', pct + '% de tu presupuesto de ' + D.fmt(D.presupuesto)));
    }
    hero.appendChild(btn('o-cta-in', '+ Registrar movimiento', () => click('masFin')));
    g.appendChild(hero);
    // en qué se va
    const cat = card('o-cats', 'En qué se te va este mes');
    if(D.categorias.length){
      const top = D.categorias[0].monto || 1;
      D.categorias.forEach(c => {
        const f = el('div', 'o-cat');
        const t = el('div', 'o-cat-t'); t.append(el('span', null, (c.emoji ? c.emoji + ' ' : '') + c.nombre), el('b', null, D.fmt(c.monto)));
        const b = el('div', 'o-cat-b'); const i = el('i'); i.style.width = Math.max(4, c.monto / top * 100) + '%'; b.appendChild(i);
        f.append(t, b); cat.appendChild(f);
      });
    } else cat.appendChild(el('div', 'o-vacio', 'Cuando registres gastos verás aquí en qué se te va el dinero.'));
    g.appendChild(cat);
    g.appendChild(cxTile('shopify', 'o-peach o-shop', { periodo:'semana', dinero:true, vacio:'Ventas, pedidos y productos más vendidos de tu tienda.' }));
    const hoy = card('o-mini', 'Gastado hoy');
    hoy.appendChild(el('div', 'o-num o-num-m', D.fmt(D.gastoHoy)));
    hoy.appendChild(btn('o-link', 'Finanzas completas →', () => click('masFin')));
    g.appendChild(hoy);
    v.appendChild(g);
  }

  // --- Creador ---
  function pintarCreador(v){
    const B = R.bandeja();
    const g = el('div', 'o-grid o-grid-creador');
    g.appendChild(cxTile('youtube', 'o-rose o-big', { vacio:'Vistas, suscriptores y minutos vistos de tu canal.', ir: abrirConexiones, extra: (t, d) => {
      if(Array.isArray(d.serie) && d.serie.length){
        const top = Math.max(1, ...d.serie); const b = el('div', 'o-bars');
        d.serie.forEach(x => { const i = el('i'); i.style.height = Math.max(6, x / top * 100) + '%'; b.appendChild(i); });
        t.appendChild(b);
      }
      const met = el('div', 'o-met');
      [['Suscriptores', d.subs != null ? fmtCorto(d.subs) : 'oculto'], ['Nuevos · 7d', d.subsGanados != null ? '+' + d.subsGanados : '—'],
       ['Minutos vistos', d.minutos != null ? fmtCorto(d.minutos) : '—'], ['Videos', d.videos != null ? d.videos : '—']].forEach(([k, val]) => {
        const m = el('div', 'o-met-i'); m.append(el('b', null, String(val)), el('span', null, k)); met.appendChild(m); });
      t.appendChild(met);
      t.appendChild(el('div', 'o-sub o-nota-dato', 'YouTube consolida las vistas con ~2 días de retraso.'));
    } }));
    g.appendChild(cxTile('tiktok', 'o-ink o-big', { vacio:'Seguidores, likes y vistas de tus videos.', ir: abrirConexiones, extra: (t, d) => {
      const met = el('div', 'o-met');
      [['Seguidores', d.seguidores != null ? fmtCorto(d.seguidores) : '—'], ['Likes', d.likes != null ? fmtCorto(d.likes) : '—'],
       ['Videos · 7d', d.publicadosSemana != null ? d.publicadosSemana : '—'], ['Videos', d.videos != null ? d.videos : '—']].forEach(([k, val]) => {
        const m = el('div', 'o-met-i'); m.append(el('b', null, String(val)), el('span', null, k)); met.appendChild(m); });
      t.appendChild(met);
      if(d.top && d.top.titulo) t.appendChild(el('div', 'o-sub', '🔥 Más visto: ' + d.top.titulo + ' · ' + fmtCorto(d.top.vistas)));
    } }));
    const id = card('o-ideas', null);
    cardHead(id, 'Ideas pendientes · ' + B.pendientes, 'bandeja', 'Bandeja', () => irA('reps', 'p-bandeja'));
    if(B.top.length) B.top.forEach(t => id.appendChild(el('div', 'o-idea', t)));
    else id.appendChild(el('div', 'o-vacio', 'Captura ideas de videos en tu Bandeja y aparecen aquí.'));
    g.appendChild(id);
    const nota = card('o-lav o-nota', 'Pregúntale a tu IA', 'chispa');
    nota.appendChild(el('p', null, 'Tu IA ya ve tus vistas, tu sueño, tus hábitos y tu agenda. Pregúntale cuándo grabar, qué publicar o cómo te fue esta semana.'));
    nota.appendChild(btn('o-cta-in', 'Preguntar', () => click('iaBtn')));
    g.appendChild(nota);
    v.appendChild(g);
  }

  // --- Agenda ---
  function pintarAgenda(v){
    const A = R.agenda();
    const g = el('div', 'o-grid o-grid-agenda');
    const cal = CX && CX.datos('calendar');
    if(!cal) g.appendChild(cxTile('calendar', 'o-sky o-calcx', { vacio:'Tus eventos de Google Calendar junto a tu rutina.' }));
    else {
      const cc = card('o-calcx o-semana-cal', null);
      cardHead(cc, 'Google Calendar · esta semana', 'cal', 'Abrir', () => window.open('https://calendar.google.com/', '_blank', 'noopener'));
      const evs = Array.isArray(cal.datos.eventos) ? cal.datos.eventos : [];
      let ultimoDia = '';
      evs.slice(0, 14).forEach(e => {
        const f = new Date(e.todoElDia ? e.inicio + 'T12:00:00' : e.inicio);
        const dia = f.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'short' });
        if(dia !== ultimoDia){ cc.appendChild(el('div', 'o-dia', dia.charAt(0).toUpperCase() + dia.slice(1))); ultimoDia = dia; }
        const fl = el('div', 'o-ev');
        const tx = el('div', 'o-ev-tx'); tx.append(el('b', null, e.titulo), el('i', null, e.lugar || (e.todoElDia ? 'Todo el día' : '')));
        fl.append(tx, el('span', 'o-hora', e.todoElDia ? 'Día' : String(f.getHours()).padStart(2,'0') + ':' + String(f.getMinutes()).padStart(2,'0')));
        cc.appendChild(fl);
      });
      if(!evs.length) cc.appendChild(el('div', 'o-vacio', 'Sin eventos en los próximos 7 días.'));
      cc.appendChild(el('div', 'o-sub', 'Actualizado ' + haceCuanto(cal.actualizado)));
      g.appendChild(cc);
    }
    if(A.bloque){
      const ah = card('o-ahora', 'Ahora', 'reloj');
      ah.appendChild(el('div', 'o-ahora-t', A.bloque.horaActual + ' · ' + A.bloque.actual));
      const pb = el('div', 'o-pbar'); const i = el('i'); i.style.width = A.bloque.pct + '%'; pb.appendChild(i);
      ah.append(pb, el('div', 'o-sub', 'Luego · ' + A.bloque.siguiente + ' ' + A.bloque.horaSiguiente + ' · faltan ' + enMin(A.bloque.resta)));
      g.appendChild(ah);
    }
    const rt = card('o-rutina', null);
    cardHead(rt, 'Tu rutina de hoy', 'reloj', 'Editar', () => click('masRutina'));
    if(A.rutina.length) A.rutina.forEach(r => {
      const f = el('div', 'o-ev' + (r.actual ? ' actual' : ''));
      const tx = el('div', 'o-ev-tx'); tx.append(el('b', null, r.nombre), el('i', null, r.desc || (r.tipo === 'core' ? 'Estructura' : 'Libre')));
      f.append(el('span', 'o-hora' + (r.actual ? ' now' : ''), r.hora), tx);
      rt.appendChild(f);
    });
    else rt.appendChild(el('div', 'o-vacio', 'Aún no tienes rutina.'));
    g.appendChild(rt);
    const pend = card('o-pend', null);
    cardHead(pend, 'Pendientes y fechas', 'cal', 'Cuenta regresiva', () => click('masEventos'));
    A.recordatorios.forEach(r => { const f = el('div', 'o-ev'); const tx = el('div', 'o-ev-tx'); tx.append(el('b', null, r.texto), el('i', null, 'Recordatorio')); f.append(tx, el('span', 'o-hora', r.hora)); pend.appendChild(f); });
    A.eventos.forEach(e => { const f = el('div', 'o-ev'); const tx = el('div', 'o-ev-tx'); tx.append(el('b', null, e.nombre), el('i', null, e.fecha)); f.append(tx, el('span', 'o-hora', e.faltan === 0 ? 'Hoy' : e.faltan + ' d')); pend.appendChild(f); });
    if(!A.recordatorios.length && !A.eventos.length) pend.appendChild(el('div', 'o-vacio', 'Sin pendientes con hora ni fechas próximas.'));
    pend.appendChild(btn('o-link', 'Planear la semana →', () => click('planSemBtn')));
    g.appendChild(pend);
    v.appendChild(g);
  }

  // --- Asistente IA ---
  function pintarIA(v){
    const H = R.hoy();
    const g = el('div', 'o-grid o-grid-ia');
    const hero = card('o-lav o-ia-hero', 'Tu asistente', 'chispa');
    hero.appendChild(el('p', 'o-ia-p', R.brief() || H.consejo || 'Pregúntale lo que quieras sobre tu día, tu semana o tus metas. Ya conoce tus hábitos, tu rutina y tus metas.'));
    hero.appendChild(btn('o-cta-in', 'Hablar con tu IA', () => click('iaBtn')));
    g.appendChild(hero);
    const tools = el('div', 'o-tools o-tools-ia');
    [['armaDia','🗓️','Arma mi día','Ordena tu día y lo acomoda si no da tiempo'],
     ['semIA','📆','Diseñar mi semana','Reparte tus pendientes en la semana'],
     ['iaDesatora','🧩','Desatóralo','Un primer paso cuando estás bloqueado'],
     ['iaReencuadre','🌥️','Reencuadre','Cuando un pensamiento pesa'],
     ['iaReflex','🪞','Reflexión','Preguntas para pensar tu día']].forEach(([id, e, t, d]) => {
      const b = btn('o-tool', null, () => click(id));
      b.append(el('span', 'o-tool-e', e), el('b', null, t), el('i', null, d));
      tools.appendChild(b);
    });
    g.appendChild(tools);
    g.appendChild(tarjetaIALocal());
    v.appendChild(g);
  }

  // IA local (Ollama): pregunta directo a tu computadora, con el contexto de REPS
  function tarjetaIALocal(){
    const IA = CX && CX.ia;
    const cfg = IA ? IA.config() : { activa:false };
    const lc = card('o-ink o-local', 'IA en tu computadora', 'pantalla');
    if(!cfg.activa){
      lc.appendChild(el('p', null, 'Corre un modelo de IA en tu Mac con Ollama: lee tus datos sin que salgan de tu casa y funciona sin internet. Se configura desde el navegador de esa computadora.'));
      lc.appendChild(btn('o-cta-in', 'Configurar', abrirConexiones));
      return lc;
    }
    lc.appendChild(el('div', 'o-sub', 'Modelo: ' + cfg.modelo + ' · ' + cfg.url));
    const ta = el('textarea', 'o-ia-in'); ta.rows = 2; ta.placeholder = 'Pregúntale algo a tu IA local…';
    const out = el('div', 'o-ia-out'); out.hidden = true;
    const go = btn('o-cta-in', 'Preguntar', async () => {
      const q = ta.value.trim(); if(!q) return;
      go.disabled = true; out.hidden = false; out.textContent = 'Pensando en tu computadora…';
      try{ out.textContent = await IA.preguntar(q, R.contexto()); }
      catch(e){ out.textContent = 'No pude hablar con Ollama: ' + (e.message || e) + ' Revisa que esté abierto.'; }
      finally{ go.disabled = false; }
    });
    lc.append(ta, go, out);
    return lc;
  }
  function haceCuanto(iso){
    const t = Date.parse(iso); if(!t) return '';
    const m = Math.round((Date.now() - t) / 60000);
    if(m < 1) return 'justo ahora';
    if(m < 60) return 'hace ' + m + ' min';
    const h = Math.round(m / 60);
    if(h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.round(h / 24) + ' d';
  }

  const PINTORES = { inicio:pintarInicio, salud:pintarSalud, dinero:pintarDinero, creador:pintarCreador, agenda:pintarAgenda, ia:pintarIA };
  function pintarVista(){
    const f = PINTORES[vista]; if(!f) return;
    const v = VISTAS[vista];
    v.textContent = '';
    try{ f(v); }catch(e){ console.warn('[REPS OS]', vista, e); v.appendChild(el('div', 'o-vacio', 'No se pudo mostrar esta sección.')); }
  }

  // ---------- hoja "Más" (celular) ----------
  const masW = el('div', 'theme-wrap os-mas'); masW.id = 'osMas'; masW.hidden = true;
  const masS = el('div', 'theme-sheet');
  const masH = el('div', 't-head'); masH.appendChild(el('h2', null, 'Más'));
  const masX = btn(null, '✕', cerrarMas); masX.setAttribute('aria-label', 'Cerrar'); masH.appendChild(masX);
  masS.appendChild(masH);
  function masItem(icon, t, d, fn){
    const b = btn('mas-item', null, fn);
    const i = el('span', 'mas-ic'); i.innerHTML = svg(icon, 21);
    const tx = el('span', 'mas-tx'); tx.append(el('b', null, t), el('i', null, d));
    const go = el('span', 'mas-go'); go.innerHTML = svg('flecha', 18);
    b.append(i, tx, go);
    masS.appendChild(b);
    return b;
  }
  masS.appendChild(el('div', 'mas-sec', 'Life OS'));
  masItem('play', 'Creador', 'YouTube, TikTok y tus ideas', () => irA('creador'));
  masItem('cal', 'Agenda', 'Rutina, pendientes y fechas', () => irA('agenda'));
  masS.appendChild(el('div', 'mas-sec', 'REPS · hábitos'));
  REPS_TABS.forEach(t => masItem(t.icon, t.nombre, { 'p-hoy':'Tus hábitos de hoy', 'p-dia':'Plan semanal y rutina', 'p-ruta':'Metas, recompensas y recordatorios', 'p-bandeja':'Captura de ideas', 'p-stats':'Tu progreso' }[t.panel], () => irA('reps', t.panel)));
  masS.appendChild(el('div', 'mas-sec', 'Sistema'));
  const cuentaItem = masItem('nube', 'Tu cuenta', 'Guarda y sincroniza tu progreso', () => { cerrarMas(); abrirCuenta(); });
  masItem('enlace', 'Conexiones', 'WHOOP, Calendar, YouTube, TikTok, Shopify', () => { cerrarMas(); abrirConexiones(); });
  const vistaItem = masItem('pantalla', 'Vista', '', ciclarVista);
  masItem('engrane', 'Ajustes', 'Tema, avisos, datos y más', () => { cerrarMas(); click('themeBtn'); });
  masW.appendChild(masS);
  masW.addEventListener('click', e => { if(e.target === masW) cerrarMas(); });
  function abrirMas(){ masW.hidden = false; }
  function cerrarMas(){ masW.hidden = true; }

  // ---------- vista PC / celular ----------
  const VISTA_KEY = 'reps-vista';
  const NOMBRE_VISTA = { auto:'Automática (detecta PC o celular)', pc:'Siempre PC', movil:'Siempre celular' };
  function prefVista(){ try{ const v = localStorage.getItem(VISTA_KEY); return v === 'pc' || v === 'movil' ? v : 'auto'; }catch(e){ return 'auto'; } }
  const mq = window.matchMedia('(min-width: 900px)');
  function aplicarVista(){
    const p = prefVista();
    const pc = p === 'pc' || (p === 'auto' && mq.matches);
    body.classList.toggle('os-pc', pc);
    body.classList.toggle('os-movil', !pc);
    vistaItem.querySelector('.mas-tx i').textContent = NOMBRE_VISTA[p];
    const ai = $('masVistaSub'); if(ai) ai.textContent = NOMBRE_VISTA[p];
  }
  function ciclarVista(){
    const orden = ['auto', 'pc', 'movil'];
    const sig = orden[(orden.indexOf(prefVista()) + 1) % 3];
    try{ if(sig === 'auto') localStorage.removeItem(VISTA_KEY); else localStorage.setItem(VISTA_KEY, sig); }catch(e){}
    aplicarVista();
    R.toast('Vista: ' + NOMBRE_VISTA[sig]);
  }
  if(mq.addEventListener) mq.addEventListener('change', aplicarVista); else mq.addListener(aplicarVista);

  // ---------- hoja de Conexiones ----------
  let cxWrap = null, cxList = null, cxAct = null;
  function construirConexiones(){
    cxWrap = el('div', 'theme-wrap'); cxWrap.id = 'cxWrap'; cxWrap.hidden = true;
    const sh = el('div', 'theme-sheet');
    const hd = el('div', 't-head');
    hd.appendChild(el('h2', null, 'Conexiones'));
    const x = btn(null, '✕', () => { cxWrap.hidden = true; }); x.setAttribute('aria-label', 'Cerrar');
    hd.appendChild(x);
    sh.appendChild(hd);
    sh.appendChild(el('div', 't-note', 'Conecta tus apps una sola vez. REPS solo LEE tus datos (nunca publica ni cambia nada) y guarda un resumen en este dispositivo para que funcione sin internet.'));
    cxList = el('div', 'cx-list');
    sh.appendChild(cxList);
    cxAct = btn('o-cta-in cx-sync', 'Actualizar ahora', async () => {
      cxAct.disabled = true; cxAct.textContent = 'Actualizando…';
      const r = await CX.sincronizar(true);
      cxAct.disabled = false; cxAct.textContent = 'Actualizar ahora';
      R.toast(r.ok ? 'Listo: datos al día.' : r.motivo === 'sin-internet' ? 'Sin internet: muestro tus últimos datos.' : 'No pude actualizar ahora. Intenta en un rato.');
    });
    sh.appendChild(cxAct);
    sh.appendChild(el('div', 't-note', 'Privacidad: las llaves de cada servicio viven en tu propio servidor (el Worker de Cloudflare de REPS), nunca dentro de la app. Puedes desconectar cuando quieras.'));
    cxWrap.appendChild(sh);
    cxWrap.addEventListener('click', e => { if(e.target === cxWrap) cxWrap.hidden = true; });
    document.body.appendChild(cxWrap);
  }
  function pintarConexiones(){
    if(!cxList) return;
    cxList.textContent = '';
    CX.lista().forEach(c => {
      const row = el('div', 'cx-row');
      const i = el('span', 'cx-ic'); i.style.background = c.color; i.innerHTML = CX.icono(c.id, 20);
      const tx = el('span', 'cx-tx');
      tx.append(el('b', null, c.nombre), el('i', null, c.trae));
      const on = CX.conectado(c.id);
      const ent = CX.entrada(c.id);
      const acc = el('span', 'cx-acc');
      if(c.tipo === 'nube'){
        tx.appendChild(el('small', null, on ? (ent && ent.error ? '⚠ ' + ent.error : 'Conectado · ' + haceCuanto(ent && ent.actualizado)) : c.como));
        if(on){ acc.appendChild(btn('cx-b off', 'Desconectar', () => { if(confirm('¿Desconectar ' + c.nombre + '? Se borra su resumen de este dispositivo.')){ CX.desconectar(c.id); } })); }
        else acc.appendChild(btn('cx-b', 'Conectar', () => CX.conectar(c.id)));
      } else if(c.tipo === 'local'){
        const cfg = CX.ia.config();
        tx.appendChild(el('small', null, cfg.activa ? 'Activa · ' + cfg.modelo : c.como));
        acc.appendChild(btn('cx-b' + (cfg.activa ? ' off' : ''), cfg.activa ? 'Ajustar' : 'Configurar', () => configIALocal(row)));
      } else {
        tx.appendChild(el('small', null, c.como));
        acc.appendChild(el('span', 'cx-st', 'Con la tienda'));
      }
      row.append(i, tx, acc);
      cxList.appendChild(row);
    });
  }
  // configuración de la IA local, dentro de su fila
  function configIALocal(row){
    if(row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('cx-ia')){ row.nextSibling.remove(); return; }
    const cfg = CX.ia.config();
    const box = el('div', 'cx-ia');
    box.appendChild(el('div', 't-note', 'En tu Mac: instala Ollama, descarga un modelo (por ejemplo «ollama pull llama3.2») y permite esta página (ver la guía). Esto solo funciona en el navegador de esa computadora.'));
    const url = el('input'); url.type = 'url'; url.value = cfg.url; url.placeholder = 'http://localhost:11434';
    const sel = el('select'); const opt = el('option', null, cfg.modelo || 'Primero prueba la conexión'); opt.value = cfg.modelo; sel.appendChild(opt);
    const msg = el('div', 't-note');
    const probar = btn('cx-b', 'Probar conexión', async () => {
      msg.textContent = 'Buscando Ollama…';
      const r = await CX.ia.probar(url.value.trim());
      if(!r.ok){ msg.textContent = r.motivo; return; }
      sel.textContent = '';
      if(!r.modelos.length){ msg.textContent = 'Ollama responde, pero no tiene modelos. Descarga uno: ollama pull llama3.2'; return; }
      r.modelos.forEach(m => { const o = el('option', null, m); o.value = m; if(m === cfg.modelo) o.selected = true; sel.appendChild(o); });
      msg.textContent = '✓ Conectado. Elige el modelo y guarda.';
    });
    const guardar = btn('cx-b', 'Guardar', () => {
      if(!sel.value){ msg.textContent = 'Primero prueba la conexión y elige un modelo.'; return; }
      CX.ia.guardar({ url: url.value.trim() || 'http://localhost:11434', modelo: sel.value, activa: true });
      R.toast('IA local lista: ' + sel.value);
    });
    const apagar = btn('cx-b off', 'Apagar', () => { CX.ia.guardar({ url: url.value.trim(), modelo: sel.value, activa: false }); });
    const fila = el('div', 'cx-ia-acc'); fila.append(probar, guardar, apagar);
    box.append(url, sel, fila, msg);
    row.after(box);
  }
  function abrirConexiones(){ cerrarMas(); if(!cxWrap) construirConexiones(); pintarConexiones(); cxWrap.hidden = false; }
  window.REPS_OS.abrirConexiones = abrirConexiones;


  // ---------- hoja de Tu cuenta (correo + contraseña, sincroniza) ----------
  let cuWrap = null, cuBody = null, cuModo = 'entrar';
  function construirCuenta(){
    cuWrap = el('div', 'theme-wrap'); cuWrap.id = 'cuentaWrap'; cuWrap.hidden = true;
    const sh = el('div', 'theme-sheet');
    const hd = el('div', 't-head');
    hd.appendChild(el('h2', null, 'Tu cuenta'));
    const x = btn(null, '✕', () => { cuWrap.hidden = true; }); x.setAttribute('aria-label', 'Cerrar');
    hd.appendChild(x);
    cuBody = el('div', 'cu-body');
    sh.append(hd, cuBody);
    cuWrap.appendChild(sh);
    cuWrap.addEventListener('click', e => { if(e.target === cuWrap) cuWrap.hidden = true; });
    document.body.appendChild(cuWrap);
  }
  function campo(tipo, ph, auto){
    const i = el('input'); i.type = tipo; i.placeholder = ph; i.autocomplete = auto;
    if(tipo === 'email'){ i.autocapitalize = 'off'; i.spellcheck = false; i.inputMode = 'email'; }
    return i;
  }
  function pintarCuenta(){
    if(!cuBody) return;
    cuBody.textContent = '';
    if(!CU || !CU.configurada()){
      cuBody.appendChild(el('div', 't-note', 'Las cuentas todavía no están activadas en esta versión de REPS. Mientras, tus datos siguen guardados en este dispositivo (y puedes usar Exportar respaldo).'));
      return;
    }
    const msg = el('div', 't-note cu-msg');
    const ses = CU.sesion();
    const st = CU.estado();
    if(cuModo === 'nueva' && ses){
      cuBody.appendChild(el('div', 't-note', 'Escribe tu contraseña nueva.'));
      const p1 = campo('password', 'Contraseña nueva (mín. 8)', 'new-password');
      const go = btn('o-cta-in cu-go', 'Guardar contraseña', async () => {
        if(p1.value.length < 8){ msg.textContent = 'Usa al menos 8 caracteres.'; return; }
        go.disabled = true; msg.textContent = 'Guardando…';
        try{ await CU.nuevaPassword(p1.value); cuModo = 'entrar'; R.toast('✓ Contraseña cambiada.'); pintarCuenta(); }
        catch(e){ msg.textContent = e.message; go.disabled = false; }
      });
      cuBody.append(p1, go, msg);
      return;
    }
    if(ses){
      const box = el('div', 'cu-ses');
      const ico = el('span', 'cu-av'); ico.innerHTML = svg('nube', 22);
      const tx = el('span', 'cu-tx');
      tx.append(el('b', null, ses.email), el('i', null,
        st.sincronizando ? 'Sincronizando…' :
        st.error ? '⚠ ' + st.error :
        CU.ultimo() ? 'Sincronizado · ' + haceCuanto(CU.ultimo()) : 'Aún sin sincronizar'));
      box.append(ico, tx);
      cuBody.appendChild(box);
      cuBody.appendChild(el('div', 't-note', 'Tus hábitos, días, rutina, metas, finanzas, diario y ajustes se guardan en tu cuenta y llegan solos a tus otros dispositivos al abrir la app. Las conexiones (WHOOP, Google, TikTok, IA local) se conectan en cada dispositivo.'));
      const fila = el('div', 'cx-ia-acc');
      const ya = btn('cx-b', 'Sincronizar ahora', async () => {
        ya.disabled = true;
        const r = await CU.sincronizar(true);
        ya.disabled = false;
        R.toast(r.ok ? '☁️ Todo al día.' : r.motivo === 'sin-internet' ? 'Sin internet: se sincroniza al volver.' : 'No se pudo sincronizar: ' + r.motivo);
      });
      const out = btn('cx-b off', 'Cerrar sesión', () => {
        if(!confirm('¿Cerrar sesión en este dispositivo? Tus datos se quedan aquí y en tu cuenta; solo deja de sincronizar.')) return;
        CU.salir(); R.toast('Sesión cerrada.');
      });
      const cambiar = btn('cx-b off', 'Cambiar contraseña', () => { cuModo = 'nueva'; pintarCuenta(); });
      fila.append(ya, cambiar, out);
      cuBody.appendChild(fila);
      return;
    }
    // sin sesión: entrar / crear cuenta / recuperar
    const tabs = el('div', 'cu-tabs');
    [['entrar', 'Entrar'], ['crear', 'Crear cuenta']].forEach(([id, t]) => {
      const b = btn('cu-tab' + (cuModo === id ? ' on' : ''), t, () => { cuModo = id; pintarCuenta(); });
      tabs.appendChild(b);
    });
    if(cuModo !== 'recuperar') cuBody.appendChild(tabs);
    cuBody.appendChild(el('div', 't-note',
      cuModo === 'crear' ? 'Crea tu cuenta para que tu progreso viva en la nube: si cambias de celular o abres REPS en tu compu, todo te sigue. Lo que ya tienes en este dispositivo se sube a tu cuenta.' :
      cuModo === 'recuperar' ? 'Te mandamos un correo con un enlace para poner una contraseña nueva.' :
      'Entra para sincronizar este dispositivo con tu cuenta.'));
    if(st.error) msg.textContent = '⚠ ' + st.error;
    const em = campo('email', 'Tu correo', 'email');
    const pw = campo('password', cuModo === 'crear' ? 'Contraseña (mín. 8)' : 'Contraseña', cuModo === 'crear' ? 'new-password' : 'current-password');
    const form = el('form', 'cu-form');
    form.appendChild(em);
    if(cuModo !== 'recuperar') form.appendChild(pw);
    const go = btn('o-cta-in cu-go', cuModo === 'crear' ? 'Crear cuenta' : cuModo === 'recuperar' ? 'Mandar correo' : 'Entrar');
    go.type = 'submit';
    form.appendChild(go);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const correo = em.value.trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ msg.textContent = 'Escribe un correo válido.'; return; }
      if(cuModo !== 'recuperar' && pw.value.length < (cuModo === 'crear' ? 8 : 1)){ msg.textContent = cuModo === 'crear' ? 'La contraseña debe tener al menos 8 caracteres.' : 'Escribe tu contraseña.'; return; }
      go.disabled = true; msg.textContent = cuModo === 'crear' ? 'Creando tu cuenta…' : cuModo === 'recuperar' ? 'Mandando…' : 'Entrando…';
      try{
        if(cuModo === 'crear'){
          const r = await CU.crearCuenta(correo, pw.value);
          if(r.confirmar){ cuModo = 'entrar'; pintarCuenta(); cuBody.querySelector('.cu-msg').textContent = '📬 Te mandé un correo a ' + correo + '. Toca el enlace para confirmar tu cuenta (revisa spam).'; return; }
          R.toast('✓ Cuenta creada. Tus datos ya están en la nube.');
        } else if(cuModo === 'recuperar'){
          await CU.recuperar(correo);
          cuModo = 'entrar'; pintarCuenta(); cuBody.querySelector('.cu-msg').textContent = '📬 Si ese correo tiene cuenta, te llegó un enlace para cambiar la contraseña.'; return;
        } else {
          await CU.entrar(correo, pw.value);
          R.toast('✓ Sesión iniciada.');
        }
        pintarCuenta();
      }catch(err){ msg.textContent = err.message; go.disabled = false; }
    });
    cuBody.append(form, msg);
    if(cuModo === 'entrar') cuBody.appendChild(btn('o-link cu-olvide', 'Olvidé mi contraseña', () => { cuModo = 'recuperar'; pintarCuenta(); }));
    if(cuModo === 'recuperar') cuBody.appendChild(btn('o-link cu-olvide', '← Volver', () => { cuModo = 'entrar'; pintarCuenta(); }));
  }
  function abrirCuenta(modo){
    cerrarMas(); if(!cuWrap) construirCuenta();
    if(modo) cuModo = modo;
    else if(cuModo === 'nueva' && !(CU && CU.sesion())) cuModo = 'entrar';
    pintarCuenta(); cuWrap.hidden = false;
  }
  window.REPS_OS.abrirCuenta = abrirCuenta;
  function pintarCuentaItem(){
    const s = CU && CU.configurada() && CU.sesion();
    const t = s ? s.email : 'Guarda y sincroniza tu progreso';
    cuentaItem.querySelector('.mas-tx i').textContent = t;
    const a = $('masCuenta'); if(a) a.querySelector('.mas-tx i').textContent = t;
  }

  // Ajustes (hoja de siempre): sección "Life OS" con Cuenta, Conexiones y Vista
  (function(){
    const fin = $('masFin'); if(!fin) return;
    const sec = el('div', 'mas-sec', 'Life OS');
    const mk = (id, icon, t, d, fn) => {
      const b = btn('mas-item', null, fn); b.id = id;
      const i = el('span', 'mas-ic'); i.innerHTML = svg(icon, 21);
      const tx = el('span', 'mas-tx'); const sub = el('i', null, d); if(id === 'masVista') sub.id = 'masVistaSub';
      tx.append(el('b', null, t), sub);
      const go = el('span', 'mas-go'); go.innerHTML = svg('flecha', 18);
      b.append(i, tx, go); return b;
    };
    const cu = mk('masCuenta', 'nube', 'Tu cuenta', 'Guarda y sincroniza tu progreso', () => { const w = $('masWrap'); if(w) w.hidden = true; abrirCuenta(); });
    const cx = mk('masCx', 'enlace', 'Conexiones', 'WHOOP, Calendar, YouTube, TikTok, Shopify, IA', () => { const w = $('masWrap'); if(w) w.hidden = true; abrirConexiones(); });
    const vi = mk('masVista', 'pantalla', 'Vista', '', ciclarVista);
    fin.after(sec, cu, cx, vi);
  })();

  // ---------- montaje ----------
  body.classList.add('os');
  body.insertBefore(main, body.firstChild);
  body.insertBefore(nav, body.firstChild);
  body.appendChild(masW);
  aplicarVista();

  R.on('render', () => { pintarCabecera(); pintarVista(); });
  // las conexiones cambian (sincronizó, conectaste, desconectaste): repintar
  if(CX){
    CX.onCambio(() => { pintarCabecera(); pintarVista(); if(cxWrap && !cxWrap.hidden) pintarConexiones(); });
    // regreso de la pantalla de permiso del servicio
    const reg = CX.leerRegreso();
    if(reg){
      const nom = (CX.get(reg.servicio) || {}).nombre || 'el servicio';
      const MOTIVOS = { cancelado:'cancelaste el permiso', token:'el servicio no entregó el acceso', 'sin-configurar':'falta configurar sus llaves en el Worker (ver la guía)', expirado:'tardó demasiado; intenta de nuevo', peticion:'la petición no era válida' };
      if(reg.ok){ R.toast('✓ ' + nom + ' conectado.'); CX.sincronizar(true); }
      else R.toast('No se conectó ' + nom + ': ' + (MOTIVOS[reg.motivo] || 'error') + '.');
      setTimeout(abrirConexiones, 400);
    } else CX.sincronizar(false);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') CX.sincronizar(false); });
    window.addEventListener('online', () => CX.sincronizar(true));
  }
  // cuenta: repintar su hoja; regreso desde el correo (confirmar / recuperar)
  if(CU){
    CU.onCambio(() => { pintarCuentaItem(); if(cuWrap && !cuWrap.hidden) pintarCuenta(); });
    pintarCuentaItem();
    const rg = CU.regreso();
    if(rg){
      CU.completarRegreso().then(r => {
        if(!r || !r.ok){ R.toast('El enlace del correo no funcionó: ' + ((r && r.motivo) || 'pide otro.')); abrirCuenta('entrar'); return; }
        if(r.tipo === 'recovery'){ abrirCuenta('nueva'); return; }
        R.toast('✓ Correo confirmado. Ya tienes cuenta.');
        abrirCuenta();
        CU.sincronizar(true);
      });
    }
  }
  // la hora avanza: "lo que sigue" y el saludo se refrescan cada minuto
  setInterval(() => { if(document.visibilityState === 'visible' && vista !== 'reps'){ pintarCabecera(); pintarVista(); } }, 60000);

  // arranque: un atajo del ícono (?tab=...) abre Hábitos; si no, Inicio
  const atajo = new URLSearchParams(location.search).get('tab');
  if(atajo) irA('reps', panelActivo()); else irA('inicio');
  R.repintar();
})();
