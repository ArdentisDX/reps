/* ===== REPS OS · Diseño Bento =====
   Convierte "Hoy" en un tablero de recuadros (bento) y agrega las tarjetas
   del Life OS: puntaje, salud, dinero, contenido, ventas y agenda.

   Cómo encaja con el motor (js/app.js):
   - Lee los datos SOLO por la API window.REPS (view-models). Nunca toca
     localStorage del motor ni sus funciones internas.
   - Se repinta cada vez que el motor repinta: REPS.on('render', ...).
   - Las tarjetas viejas de Hoy NO se mueven ni se reescriben: el acomodo en
     retícula es 100% CSS (css/bento.css). Así ningún id ni listener se rompe.
   - Para abrir hojas existentes "toca" sus botones de siempre (masFin,
     suenoOpen, biAgua…): una sola lógica, sin duplicarla.
   Texto de usuario al DOM siempre con textContent (convención del proyecto).
*/
(function(){
  'use strict';
  const R = window.REPS;
  if(!R) return; // sin motor no hay nada que pintar
  const CX = (window.REPS_OS && window.REPS_OS.conectores) || null;
  const $ = id => document.getElementById(id);

  // ---------- utilidades ----------
  function el(tag, cls, txt){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(txt != null) e.textContent = txt;
    return e;
  }
  const svg = (inner, s) => '<svg width="' + (s||16) + '" height="' + (s||16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  const IC = {
    luna:   '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    gota:   '<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/>',
    dinero: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    cal:    '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/>',
    reloj:  '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    flecha: '<path d="m9 6 6 6-6 6"/>',
    mas:    '<path d="M12 5v14M5 12h14"/>',
    chispa: '<path d="M12 2c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5z" fill="currentColor" stroke="none"/>',
    pin:    '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  };
  const click = id => { const b = $(id); if(b) b.click(); };
  const irA = panel => { const t = document.querySelector('.tab[data-panel="' + panel + '"]'); if(t) t.click(); };
  function fmtHoras(min){
    if(min == null) return '—';
    return Math.floor(min/60) + ':' + String(min % 60).padStart(2, '0');
  }
  function fmtCorto(n){
    if(n == null || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if(a >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
    if(a >= 1e4) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
    return Math.round(n).toLocaleString('es-MX');
  }
  // una tarjeta = botón (todo el recuadro se toca) con etiqueta arriba
  function tile(id, cls, label, icon, onTap){
    const t = el('button', 'bt ' + cls); t.type = 'button'; if(id) t.id = id;
    const l = el('span', 'bt-lbl');
    if(icon){ const i = el('span', 'bt-ic'); i.innerHTML = svg(icon, 14); l.appendChild(i); }
    l.appendChild(document.createTextNode(label));
    t.appendChild(l);
    if(onTap) t.addEventListener('click', onTap);
    return t;
  }

  // ---------- estructura: se crea UNA vez ----------
  const hoy = $('p-hoy');
  if(!hoy) return;
  document.body.classList.add('bento');

  const T = {}; // referencias a las piezas que se repintan

  // Puntaje (el héroe del tablero) — toca para ver Stats
  T.score = tile('btScore', 'bt-hero', 'Puntaje de hoy', null, () => irA('p-stats'));
  T.scoreSpark = el('span', 'bt-spark'); T.scoreSpark.setAttribute('aria-hidden', 'true');
  for(let i = 0; i < 7; i++) T.scoreSpark.appendChild(el('i'));
  T.scoreNum = el('span', 'bt-num bt-xl', '—');
  T.scoreFoot = el('span', 'bt-foot', '');
  T.score.append(T.scoreSpark, T.scoreNum, T.scoreFoot);

  // Salud: sueño + agua (o WHOOP cuando esté conectado)
  T.salud = el('div', 'bt-group'); T.salud.id = 'btSalud';
  T.sueno = tile(null, 'bt-sky bt-mini', 'Sueño', IC.luna, () => click('suenoOpen'));
  T.suenoNum = el('span', 'bt-num bt-m', '—');
  T.sueno.appendChild(T.suenoNum);
  T.agua = tile(null, 'bt-mint bt-mini', 'Agua', IC.gota, () => click('biAgua'));
  T.aguaNum = el('span', 'bt-num bt-m', '0');
  T.agua.appendChild(T.aguaNum);
  T.salud.append(T.sueno, T.agua);

  // Encabezado de sección "Tu mundo"
  function secHead(id, titulo, accion, onTap){
    const h = el('div', 'bt-sec'); if(id) h.id = id;
    h.appendChild(el('h3', null, titulo));
    if(accion){ const a = el('button', 'bt-sec-a', accion); a.type = 'button'; a.addEventListener('click', onTap); h.appendChild(a); }
    return h;
  }
  T.mundoHead = secHead('btMundoHead', 'Tu mundo', 'Conexiones', abrirConexiones);

  // Dinero (datos reales de Finanzas)
  T.dinero = tile('btDinero', 'bt-card bt-s2', 'Dinero · mes', IC.dinero, () => click('masFin'));
  T.dineroNum = el('span', 'bt-num bt-l', '$0');
  T.dineroSub = el('span', 'bt-sub', '');
  T.dinero.append(T.dineroNum, T.dineroSub);

  // Contenido y ventas: un recuadro por conector
  T.mundo = el('div', 'bt-group'); T.mundo.id = 'btMundo';
  T.cx = {};
  [['shopify','bt-peach'], ['youtube','bt-rose'], ['tiktok','bt-ink']].forEach(([id, color]) => {
    const c = CX && CX.get(id);
    const t = tile(null, color + ' bt-s2 bt-cx', c ? c.nombre : id, null, abrirConexiones);
    const lbl = t.querySelector('.bt-lbl');
    if(c){ const i = el('span', 'bt-ic'); i.innerHTML = CX.icono(id, 14); lbl.prepend(i); }
    const num = el('span', 'bt-num bt-l', '—');
    const sub = el('span', 'bt-sub', '');
    t.append(num, sub);
    T.cx[id] = { t, num, sub };
    T.mundo.appendChild(t);
  });

  // Agenda: bloque en curso, lo que sigue, recordatorios y eventos
  T.agenda = el('div', 'bt bt-card bt-agenda'); T.agenda.id = 'btAgenda';
  {
    const hd = el('div', 'bt-ag-head');
    const l = el('span', 'bt-lbl'); const i = el('span', 'bt-ic'); i.innerHTML = svg(IC.cal, 14);
    l.append(i, document.createTextNode('Agenda'));
    const a = el('button', 'bt-sec-a', 'Calendar'); a.type = 'button'; a.addEventListener('click', abrirConexiones);
    hd.append(l, a);
    T.agendaList = el('div', 'bt-ag-list');
    T.agenda.append(hd, T.agendaList);
  }

  // Insertar en Hoy (el orden visual lo decide el CSS con `order`)
  hoy.append(T.score, T.salud, T.mundoHead, T.dinero, T.mundo, T.agenda);

  // Encabezado: saludo con tu nombre
  const h1 = document.querySelector('body > h1');

  // ---------- repintado ----------
  function pintar(){
    const H = R.hoy(), S = R.salud(), D = R.dinero(), A = R.agenda();

    // saludo
    if(h1){
      h1.textContent = '';
      h1.appendChild(document.createTextNode(H.nombre ? 'Hola, ' : 'Hola'));
      if(H.nombre){ h1.appendChild(el('em', null, H.nombre)); }
    }

    // puntaje
    if(H.descanso){
      T.scoreNum.textContent = '·';
      T.scoreFoot.textContent = 'Hoy es descanso';
    } else {
      T.scoreNum.textContent = String(H.puntaje == null ? 0 : H.puntaje);
      // el día va en curso: compararlo contra días completos sería injusto,
      // así que el pie muestra el promedio como referencia, sin juicio
      T.scoreFoot.textContent = H.promedio7 == null
        ? H.core.hechos + ' de ' + H.core.total + ' innegociables'
        : 'Promedio de 7 días: ' + H.promedio7;
    }
    // mini-gráfica de los últimos 7 días (hoy al final, con contorno)
    H.semana.forEach((d, i) => {
      const b = T.scoreSpark.children[i];
      b.style.height = d.puntaje == null ? '10%' : Math.max(8, d.puntaje) + '%';
      b.className = (d.puntaje == null ? 'rest' : '') + (d.hoy ? ' hoy' : '');
    });
    T.score.classList.toggle('ganado', H.ganado);

    // salud
    T.suenoNum.textContent = S.suenoHoy != null ? fmtHoras(S.suenoHoy) : (S.suenoProm != null ? fmtHoras(S.suenoProm) : '—');
    T.sueno.querySelector('.bt-lbl').lastChild.textContent = S.suenoHoy != null ? 'Sueño' : (S.suenoProm != null ? 'Sueño · prom.' : 'Sueño');
    T.aguaNum.textContent = S.agua.hoy + '/' + S.agua.meta;

    // dinero
    T.dineroNum.textContent = D.fmt(D.saldo);
    T.dineroNum.classList.toggle('neg', D.saldo < 0);
    T.dineroSub.textContent = !D.hayDatos ? 'Registra tu primer movimiento' :
      (D.gastoHoy > 0 ? 'disponible · hoy −' + D.fmt(D.gastoHoy).replace('−','') : 'disponible este mes');

    // conectores (solo muestran datos REALES del caché; si no, invitan)
    Object.keys(T.cx).forEach(id => {
      const r = T.cx[id];
      const d = CX && CX.datos(id);
      r.t.classList.toggle('off', !d);
      if(d && d.datos){
        r.num.textContent = id === 'shopify' ? D.fmt(+d.datos.ventas || 0) : fmtCorto(+d.datos.vistas);
        r.sub.textContent = d.datos.resumen ? String(d.datos.resumen) : '';
      } else {
        r.num.textContent = 'Conectar';
        r.sub.textContent = id === 'shopify' ? 'Tus ventas, aquí' : 'Tus vistas, aquí';
      }
    });

    // agenda
    const L = T.agendaList; L.textContent = '';
    const fila = (hora, titulo, detalle, clase) => {
      const f = el('div', 'bt-ag-row' + (clase ? ' ' + clase : ''));
      const h = el('span', 'bt-ag-h', hora);
      const tx = el('span', 'bt-ag-tx');
      tx.appendChild(el('b', null, titulo));
      if(detalle) tx.appendChild(el('i', null, detalle));
      f.append(tx, h);
      L.appendChild(f);
    };
    if(A.bloque){
      fila(A.bloque.horaActual, A.bloque.actual, 'Ahora · faltan ' + (A.bloque.resta >= 60 ? Math.floor(A.bloque.resta/60) + ' h ' + (A.bloque.resta % 60) + ' min' : A.bloque.resta + ' min'), 'now');
      fila(A.bloque.horaSiguiente, A.bloque.siguiente, 'Sigue en tu rutina');
    }
    A.recordatorios.forEach(r => fila(r.hora, r.texto, 'Recordatorio'));
    A.eventos.forEach(e => fila(e.faltan === 0 ? 'Hoy' : e.faltan + ' d', e.nombre, 'Cuenta regresiva'));
    if(!L.childNodes.length){
      const v = el('div', 'bt-ag-empty', 'Arma tu rutina en Mi día y aquí verás qué sigue.');
      L.appendChild(v);
    }
  }

  R.on('render', pintar);

  // ---------- color de los recuadros según el tema ----------
  // El héroe usa lima en los temas Bento y el acento en los demás; el modo
  // claro/oscuro se deduce de la luz del fondo (igual que customVars).
  function luz(hex){
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim()); if(!m) return 0;
    const n = parseInt(m[1], 16);
    return (0.2126*((n>>16)&255) + 0.7152*((n>>8)&255) + 0.0722*(n&255)) / 255;
  }
  function ajustarModo(){
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg');
    document.body.classList.toggle('claro', luz(bg) > 0.55);
    const t = R.tema();
    document.body.classList.toggle('hero-lima', t.modo === 'preset' && /^bento/.test(t.id));
  }
  new MutationObserver(ajustarModo).observe(document.documentElement, { attributes:true, attributeFilter:['style'] });
  ajustarModo();

  // ---------- hoja de Conexiones ----------
  let cxWrap = null;
  function construirConexiones(){
    cxWrap = el('div', 'theme-wrap'); cxWrap.id = 'cxWrap'; cxWrap.hidden = true;
    const sh = el('div', 'theme-sheet');
    const hd = el('div', 't-head');
    hd.appendChild(el('h2', null, 'Conexiones'));
    const x = el('button', null, '✕'); x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', () => { cxWrap.hidden = true; });
    hd.appendChild(x);
    sh.appendChild(hd);
    sh.appendChild(el('div', 't-note', 'Tu REPS junta aquí tus apps. Lo que ya vive en REPS (hábitos, dinero, sueño, agua) funciona hoy y sin internet. Las conexiones de abajo llegan por fases, una por una.'));
    const list = el('div', 'cx-list');
    (CX ? CX.lista() : []).forEach(c => {
      const row = el('div', 'cx-row');
      const ic = el('span', 'cx-ic'); ic.style.background = c.color; ic.innerHTML = CX.icono(c.id, 20);
      const tx = el('span', 'cx-tx');
      tx.appendChild(el('b', null, c.nombre));
      tx.appendChild(el('i', null, c.trae));
      tx.appendChild(el('small', null, c.como));
      const st = el('span', 'cx-st' + (CX.conectado(c.id) ? ' on' : ''), CX.conectado(c.id) ? 'Conectado' : 'Fase ' + c.fase);
      row.append(ic, tx, st);
      list.appendChild(row);
    });
    sh.appendChild(list);
    sh.appendChild(el('div', 't-note', 'Privacidad: las llaves de cada servicio vivirán en tu propio servidor (el Worker de Cloudflare que ya usa REPS), nunca dentro de la app.'));
    cxWrap.appendChild(sh);
    cxWrap.addEventListener('click', e => { if(e.target === cxWrap) cxWrap.hidden = true; });
    document.body.appendChild(cxWrap);
  }
  function abrirConexiones(){
    if(!cxWrap) construirConexiones();
    cxWrap.hidden = false;
  }

  // entrada en Ajustes: sección "Life OS" debajo de Dinero
  (function(){
    const fin = $('masFin'); if(!fin) return;
    const sec = el('div', 'mas-sec', 'Life OS');
    const b = el('button', 'mas-item'); b.id = 'masCx'; b.type = 'button';
    const ic = el('span', 'mas-ic'); ic.innerHTML = svg('<path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8"/>', 22);
    const tx = el('span', 'mas-tx'); tx.append(el('b', null, 'Conexiones'), el('i', null, 'WHOOP, Calendar, YouTube, TikTok, Shopify, IA'));
    const go = el('span', 'mas-go'); go.innerHTML = svg(IC.flecha, 18);
    b.append(ic, tx, go);
    b.addEventListener('click', () => { const w = $('masWrap'); if(w) w.hidden = true; abrirConexiones(); });
    fin.after(sec, b);
  })();

  // primer pintado: el motor ya pintó antes de que este módulo existiera,
  // así que pedimos un repintado (aplica también "Personalizar Hoy")
  R.repintar();
})();
