(function(){
  const HABITS = [
    {id:'despertar', name:'Despertar 8:30', hint:'Pies al piso, sin snooze', core:true},
    {id:'correr',    name:'Correr / perrita + 10 min calistenia', hint:'20–30 min, antes de la PC', core:true},
    {id:'bloque1',   name:'Bloque de construcción', hint:'Mínimo 1 hr, celular en otro cuarto', core:true},
    {id:'cama',      name:'Cama tendida', hint:'Ya lo tienes automático', core:false},
    {id:'bloque2',   name:'Bloque corto (1 hr)', hint:'App, leer, practicar', core:false},
    {id:'dormir',    name:'Leer 20 min + dormir 1:00 am', hint:'Celular a cargar lejos de la cama', core:false},
  ];
  const CORE = HABITS.filter(h=>h.core).map(h=>h.id);
  const KEY = 'reps-dias';
  let dias = {};

  const $ = id => document.getElementById(id);

  function localISO(d){
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
  }
  const today = () => localISO(new Date());
  function isWon(rec){ return !!rec && CORE.every(id=>rec[id]); }

  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      $(t.dataset.panel).classList.add('active');
    });
  });

  function load(){
    try{
      const v = localStorage.getItem(KEY);
      if(v) dias = JSON.parse(v);
    }catch(e){ dias = {}; }
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(dias)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  function streak(){
    let n = 0;
    const d = new Date();
    if(!isWon(dias[localISO(d)])) d.setDate(d.getDate()-1);
    while(isWon(dias[localISO(d)])){ n++; d.setDate(d.getDate()-1); }
    return n;
  }
  function lostYesterday(){
    const y = new Date(); y.setDate(y.getDate()-1);
    const key = localISO(y);
    return (key in dias) && !isWon(dias[key]);
  }

  function habitBtn(h, rec){
    const done = !!rec[h.id];
    const b = document.createElement('button');
    b.className = 'habit' + (done?' done':'');
    b.setAttribute('aria-pressed', done);
    b.innerHTML =
      '<span class="check" aria-hidden="true">✓</span>' +
      '<span class="h-body"><span class="h-name">'+h.name+'</span>' +
      '<div class="h-hint">'+h.hint+'</div></span>' +
      (h.core ? '<span class="core-mark">CORE</span>' : '');
    b.addEventListener('click', ()=>{
      const wasWon = isWon(dias[today()]);
      rec[h.id] = !rec[h.id];
      dias[today()] = rec;
      save();
      render();
      if(!wasWon && isWon(rec)) toast('Día ganado. Una rep más. 🔥');
    });
    return b;
  }

  function render(){
    $('fecha').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long', day:'numeric', month:'long'});
    const rec = dias[today()] || {};
    dias[today()] = rec;

    const coreL = $('coreList'), extraL = $('extraList');
    coreL.innerHTML=''; extraL.innerHTML='';
    HABITS.forEach(h=> (h.core?coreL:extraL).appendChild(habitBtn(h,rec)) );

    const won = isWon(rec);
    $('stamp').classList.toggle('show', won);

    const done = HABITS.filter(h=>rec[h.id]).length;
    const pct = Math.round(done/HABITS.length*100);
    $('progPct').textContent = pct+'%';
    $('progBar').style.width = pct+'%';

    const s = streak();
    $('streakNum').textContent = s;
    $('streakSub').textContent =
      won ? 'Hoy ya cayó. Bien.' :
      s>0 ? 'La racha vive. Cierra hoy los 3 core.' :
      'Gana hoy para encenderla.';
    $('streakWarn').hidden = !(lostYesterday() && !won);

    const wk = $('week'); wk.innerHTML='';
    const names = ['dom','lun','mar','mié','jue','vie','sáb'];
    for(let i=6;i>=0;i--){
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = localISO(d), r = dias[key];
      const w = isWon(r);
      const partial = !w && r && HABITS.some(h=>r[h.id]);
      const el = document.createElement('div');
      el.className='day';
      el.innerHTML =
        '<div class="d-lbl">'+names[d.getDay()]+'</div>' +
        '<div class="dot'+(w?' won':'')+(partial?' partial':'')+(i===0?' today':'')+'">' +
        (w?'✓':(partial?'·':'')) + '</div>';
      wk.appendChild(el);
    }

    renderStats(); // mantiene la pestaña Stats al día con cada cambio
  }

  let toastT;
  function toast(msg){
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(()=>t.classList.remove('show'), 2600);
  }

  $('resetBtn').addEventListener('click', ()=>{
    if(!confirm('¿Borrar TODO el historial? No hay vuelta atrás.')) return;
    dias = {};
    try{ localStorage.removeItem(KEY); }catch(e){}
    render();
    toast('Historial borrado. Día 0. A construir.');
  });

  // ===== Bandeja: captura rápida de ideas =====
  const CATS = [
    {id:'ya',       emoji:'🔥', name:'Hacer ya'},
    {id:'social',   emoji:'🎉', name:'Social'},
    {id:'compras',  emoji:'🛒', name:'Compras'},
    {id:'aprender', emoji:'📚', name:'Aprender'},
    {id:'algundia', emoji:'💡', name:'Algún día'},
  ];
  const TRAY_KEY = 'reps-bandeja';
  let ideas = [];
  let trayFilter = 'todas';
  let pendingText = null; // idea escrita que espera categoría

  function loadTray(){
    try{
      const v = localStorage.getItem(TRAY_KEY);
      if(v) ideas = JSON.parse(v);
    }catch(e){ ideas = []; }
  }
  function saveTray(){
    try{ localStorage.setItem(TRAY_KEY, JSON.stringify(ideas)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  const catOf = id => CATS.find(c => c.id === id);

  // Única puerta de entrada de ideas nuevas.
  // Fase 2 (futuro): cuando haya internet, una IA podrá sugerir "cat"
  // automáticamente; bastará llamar addIdea(texto, catSugerida) desde ahí.
  function addIdea(text, catId){
    ideas.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      text: text,
      cat: catId,
      done: false,
      created: new Date().toISOString(),
    });
    saveTray();
    renderTray();
  }

  // "hoy", "ayer", "hace N días" o la fecha, según qué tan vieja sea la idea
  function timeAgo(iso){
    if(!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if(days <= 0) return 'hoy';
    if(days === 1) return 'ayer';
    if(days < 7) return 'hace ' + days + ' días';
    return new Date(iso).toLocaleDateString('es-MX', {day:'numeric', month:'short'});
  }

  function renderTray(){
    // chips de filtro, cada uno con su número de ideas pendientes
    const pendientes = id => ideas.filter(i => !i.done && (id === 'todas' || i.cat === id)).length;
    const wrap = $('trayFilters'); wrap.innerHTML = '';
    const mkChip = (id, label) => {
      const n = pendientes(id);
      const b = document.createElement('button');
      b.className = 'chip' + (trayFilter === id ? ' active' : '');
      b.textContent = label + (n > 0 ? ' · ' + n : '');
      b.addEventListener('click', ()=>{ trayFilter = id; renderTray(); });
      wrap.appendChild(b);
    };
    mkChip('todas', 'Todas');
    CATS.forEach(c => mkChip(c.id, c.emoji + ' ' + c.name));

    // lista de ideas (las más nuevas arriba)
    const list = $('trayList'); list.innerHTML = '';
    const shown = ideas.filter(i => trayFilter === 'todas' || i.cat === trayFilter);
    $('trayEmpty').hidden = shown.length > 0;

    shown.forEach(i => {
      const c = catOf(i.cat);
      const card = document.createElement('div');
      card.className = 'idea' + (i.done ? ' done' : '');

      const main = document.createElement('button');
      main.className = 'i-main';
      main.setAttribute('aria-pressed', i.done);
      const emoji = document.createElement('span');
      emoji.className = 'i-emoji'; emoji.textContent = c ? c.emoji : '❔';
      const body = document.createElement('span');
      body.className = 'i-body';
      const txt = document.createElement('span');
      txt.className = 'i-text'; txt.textContent = i.text; // textContent: el texto se muestra tal cual, sin interpretarse como HTML
      const meta = document.createElement('span');
      meta.className = 'i-cat';
      meta.textContent = (c ? c.name : '') + ' · ' + timeAgo(i.created) + (i.done ? ' · hecha ✓' : '');
      body.append(txt, meta);
      main.append(emoji, body);
      main.addEventListener('click', ()=>{ i.done = !i.done; saveTray(); renderTray(); });

      const del = document.createElement('button');
      del.className = 'i-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar idea');
      del.addEventListener('click', ()=>{
        ideas = ideas.filter(x => x.id !== i.id);
        saveTray(); renderTray();
        toast('Idea borrada.');
      });

      card.append(main, del);
      list.appendChild(card);
    });
  }

  // capturar: Enter o botón ＋ → muestra el selector de categoría
  $('trayForm').addEventListener('submit', (e)=>{
    e.preventDefault(); // que el formulario no recargue la página
    const t = $('trayInput').value.trim();
    if(!t) return;
    pendingText = t;
    $('trayInput').value = '';
    $('trayInput').style.height = 'auto'; // vuelve a una línea tras capturar
    $('cpText').textContent = '«' + t + '»';
    $('catPick').classList.add('show');
  });

  // el textarea crece con el contenido (hasta el tope del CSS)
  $('trayInput').addEventListener('input', ()=>{
    const t = $('trayInput');
    t.style.height = 'auto';            // primero se encoge a lo mínimo...
    t.style.height = t.scrollHeight + 'px'; // ...y luego crece a lo que mida su contenido
  });

  // Enter captura (como antes); Shift+Enter hace salto de línea
  $('trayInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      $('trayForm').requestSubmit();
    }
  });

  // botones de categoría (se crean una sola vez)
  CATS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-opt';
    b.textContent = c.emoji + ' ' + c.name;
    b.addEventListener('click', ()=>{
      if(pendingText == null) return;
      addIdea(pendingText, c.id);
      pendingText = null;
      $('catPick').classList.remove('show');
      toast('Guardada en ' + c.name + '.');
    });
    $('cpOpts').appendChild(b);
  });

  // cancelar: devuelve el texto al input para no perder lo escrito
  $('cpCancel').addEventListener('click', ()=>{
    $('trayInput').value = pendingText || '';
    pendingText = null;
    $('catPick').classList.remove('show');
    $('trayInput').focus();
  });

  // ===== Stats =====
  let calY = null, calM = null; // año y mes que muestra el calendario

  function statsData(){
    // conjunto de fechas ganadas: buscar en un Set es instantáneo
    const wonSet = new Set(Object.keys(dias).filter(k => isWon(dias[k])));

    // mejor racha: desde cada día que INICIA una racha (su víspera no está
    // ganada), avanza día a día contando hasta que se rompa
    let best = 0;
    wonSet.forEach(k => {
      const d = new Date(k + 'T12:00:00'); // mediodía local: evita líos de zona horaria
      d.setDate(d.getDate() - 1);
      if(wonSet.has(localISO(d))) return;  // no es inicio de racha
      let len = 0;
      d.setDate(d.getDate() + 1);
      while(wonSet.has(localISO(d))){ len++; d.setDate(d.getDate() + 1); }
      if(len > best) best = len;
    });

    // % de días ganados en los últimos 30 días
    let won30 = 0;
    for(let i = 0; i < 30; i++){
      const d = new Date(); d.setDate(d.getDate() - i);
      if(wonSet.has(localISO(d))) won30++;
    }

    return { total: wonSet.size, best, now: streak(), pct30: Math.round(won30/30*100) };
  }

  function renderStats(){
    const s = statsData();
    $('stTotal').textContent = s.total;
    $('stBest').textContent = s.best;
    $('stNow').textContent = s.now;
    $('stMonth').textContent = s.pct30 + '%';
    renderCal();
  }

  function renderCal(){
    const now = new Date();
    if(calY === null){ calY = now.getFullYear(); calM = now.getMonth(); }
    $('calTitle').textContent =
      new Date(calY, calM, 1).toLocaleDateString('es-MX', {month:'long', year:'numeric'});
    // la flecha ▶ se apaga en el mes actual: el futuro no existe todavía
    $('calNext').disabled = (calY === now.getFullYear() && calM === now.getMonth());

    const grid = $('calGrid'); grid.innerHTML = '';
    ['D','L','M','M','J','V','S'].forEach(n => {
      const el = document.createElement('div');
      el.className = 'cal-dow'; el.textContent = n;
      grid.appendChild(el);
    });

    const firstDow = new Date(calY, calM, 1).getDay();      // día de semana del 1°
    const daysInMonth = new Date(calY, calM + 1, 0).getDate(); // "día 0" del mes siguiente = último de este
    for(let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('div')); // celdas vacías de alineación

    const todayKey = today();
    for(let day = 1; day <= daysInMonth; day++){
      const key = localISO(new Date(calY, calM, day));
      const r = dias[key];
      const w = isWon(r);
      const partial = !w && r && HABITS.some(h => r[h.id]);
      const el = document.createElement('div');
      el.className = 'cal-day'
        + (w ? ' won' : '') + (partial ? ' partial' : '')
        + (key === todayKey ? ' today' : '') + (key > todayKey ? ' future' : '');
      el.textContent = day;
      if(cierres[key] && key <= todayKey){
        el.classList.add('has-note', 'clickable');
        el.addEventListener('click', ()=> showDayDetail(key));
      }
      grid.appendChild(el);
    }
  }

  // al cambiar de mes se cierra el detalle: pertenece al mes que se veía
  $('calPrev').addEventListener('click', ()=>{ calM--; if(calM < 0){ calM = 11; calY--; } $('calDetail').hidden = true; detailKey = null; renderCal(); });
  $('calNext').addEventListener('click', ()=>{ calM++; if(calM > 11){ calM = 0; calY++; } $('calDetail').hidden = true; detailKey = null; renderCal(); });

  // ===== Compartir mes (imagen con canvas) =====
  // Dibuja el mes visible del calendario en un canvas de 1080x1350 px
  // (formato vertical, listo para redes) usando los colores del tema ACTIVO.
  function drawMonthImage(){
    const W = 1080, H = 1350, PAD = 80;
    // lee las variables CSS vigentes: el tema que sea que esté puesto
    const css = getComputedStyle(document.documentElement);
    const C = n => css.getPropertyValue(n).trim();
    const bg = C('--bg'), card = C('--card-2'), text = C('--text'),
          muted = C('--muted'), accent = C('--amber'), onAccent = C('--on-accent');

    const canvas = document.createElement('canvas'); // vive solo en memoria
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); // el "pincel" 2D
    const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

    // 1) fondo
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2) encabezado: etiqueta + mes y año
    const mesLargo = new Date(calY, calM, 1).toLocaleDateString('es-MX', {month:'long', year:'numeric'});
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.font = '600 28px ' + FONT;
    ctx.fillText('MI MES EN REPS', PAD, 100);
    ctx.fillStyle = text;
    ctx.font = '800 64px ' + FONT;
    ctx.fillText(mesLargo.charAt(0).toUpperCase() + mesLargo.slice(1), PAD, 175);

    // 3) métricas: ganados del mes y mejor racha histórica
    const daysInMonth = new Date(calY, calM + 1, 0).getDate();
    let wonMes = 0;
    for(let d = 1; d <= daysInMonth; d++){
      if(isWon(dias[localISO(new Date(calY, calM, d))])) wonMes++;
    }
    ctx.fillStyle = accent;
    ctx.font = '800 88px ' + FONT;
    ctx.fillText(String(wonMes), PAD, 330);
    ctx.fillText(String(statsData().best), W/2 + 20, 330);
    ctx.fillStyle = muted;
    ctx.font = '600 26px ' + FONT;
    ctx.fillText('DÍAS GANADOS', PAD, 372);
    ctx.fillText('MEJOR RACHA', W/2 + 20, 372);

    // 4) calendario: misma lógica que renderCal, pero pintada a mano
    const gap = 12;
    const cell = (W - PAD*2 - gap*6) / 7;
    ctx.textAlign = 'center';
    ctx.fillStyle = muted;
    ctx.font = '700 26px ' + FONT;
    ['D','L','M','M','J','V','S'].forEach((n,i) =>
      ctx.fillText(n, PAD + i*(cell+gap) + cell/2, 445));

    const todayKey = today();
    let col = new Date(calY, calM, 1).getDay(), rowY = 470;
    for(let day = 1; day <= daysInMonth; day++){
      const x = PAD + col*(cell+gap);
      const key = localISO(new Date(calY, calM, day));
      const r = dias[key], w = isWon(r);
      const partial = !w && r && HABITS.some(h => r[h.id]);
      ctx.globalAlpha = key > todayKey ? 0.3 : 1; // días futuros: fantasmas
      ctx.beginPath();
      ctx.roundRect(x, rowY, cell, cell, 22);
      ctx.fillStyle = w ? accent : card;
      ctx.fill();
      if(partial){ ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.fillStyle = w ? onAccent : (partial ? accent : muted);
      ctx.font = (w ? '800' : '600') + ' 34px ' + FONT;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(day), x + cell/2, rowY + cell/2 + 2);
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
      col++;
      if(col === 7){ col = 0; rowY += cell + gap; }
    }

    // 5) logo "REPS." abajo, con el punto en color de acento
    ctx.font = '800 60px ' + FONT;
    const wReps = ctx.measureText('REPS').width, wDot = ctx.measureText('.').width;
    const x0 = W/2 - (wReps + wDot)/2;
    ctx.textAlign = 'left';
    ctx.fillStyle = text;   ctx.fillText('REPS', x0, 1315);
    ctx.fillStyle = accent; ctx.fillText('.', x0 + wReps, 1315);

    const mesCorto = new Date(calY, calM, 1).toLocaleDateString('es-MX', {month:'long'});
    return { canvas, nombre: 'reps-' + mesCorto + '-' + calY + '.png' };
  }

  $('shareBtn').addEventListener('click', ()=>{
    const { canvas, nombre } = drawMonthImage();
    // toBlob convierte los píxeles del canvas en un archivo PNG real
    canvas.toBlob(async (blob)=>{
      if(!blob){ toast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], nombre, {type:'image/png'});
      // en celular: hoja de compartir nativa (WhatsApp, Instagram...)
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file], title:'Mi mes en REPS'}); return; }
        catch(err){ if(err && err.name === 'AbortError') return; } // canceló: no forzar descarga
      }
      // en PC (o si compartir falló): descarga clásica
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      toast('Imagen descargada. 📤');
    }, 'image/png');
  });

  // ===== Cierre del día =====
  const MOODS = [
    {id:'bien',    emoji:'🔥', name:'Bien'},
    {id:'regular', emoji:'😐', name:'Regular'},
    {id:'mal',     emoji:'💀', name:'Mal'},
  ];
  const CIERRES_KEY = 'reps-cierres';
  let cierres = {};      // { 'YYYY-MM-DD': {animo, notas, plan, guardado} }
  let moodSel = null;    // ánimo elegido en el formulario de hoy
  let detailKey = null;  // día abierto en el detalle del calendario

  function loadCierres(){
    try{
      const v = localStorage.getItem(CIERRES_KEY);
      if(v) cierres = JSON.parse(v);
    }catch(e){ cierres = {}; }
  }
  function saveCierres(){
    try{ localStorage.setItem(CIERRES_KEY, JSON.stringify(cierres)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  // botones de ánimo: uno activo a la vez; tocar el activo lo des-selecciona
  document.querySelectorAll('.mood').forEach(b => {
    b.addEventListener('click', ()=>{
      moodSel = (moodSel === b.dataset.mood) ? null : b.dataset.mood;
      document.querySelectorAll('.mood').forEach(x =>
        x.classList.toggle('active', x.dataset.mood === moodSel));
    });
  });

  $('cierreBtn').addEventListener('click', ()=>{
    const notas = $('notasHoy').value.trim();
    const plan = $('planManana').value.trim();
    if(!moodSel && !notas && !plan){ toast('El cierre está vacío.'); return; }
    cierres[today()] = { animo: moodSel, notas, plan, guardado: new Date().toISOString() };
    saveCierres();
    renderCal(); // para que aparezca el puntito de hoy en el calendario
    toast('Cierre guardado. A dormir tranquilo. 🌙');
  });

  // si hoy ya tiene cierre, el formulario amanece con sus valores (editable)
  function fillCierreForm(){
    const c = cierres[today()];
    if(!c) return;
    moodSel = c.animo || null;
    document.querySelectorAll('.mood').forEach(x =>
      x.classList.toggle('active', x.dataset.mood === moodSel));
    $('notasHoy').value = c.notas || '';
    $('planManana').value = c.plan || '';
  }

  // el "plan de mañana" que escribiste AYER es el "plan de hoy" de HOY
  function renderPlanHoy(){
    const y = new Date(); y.setDate(y.getDate() - 1);
    const c = cierres[localISO(y)];
    const hay = !!(c && c.plan);
    $('planHoy').hidden = !hay;
    if(hay) $('planHoyTxt').textContent = c.plan;
  }

  // detalle de un día del calendario (solo días con cierre)
  function showDayDetail(key){
    if(detailKey === key && !$('calDetail').hidden){ // tocar de nuevo lo cierra
      $('calDetail').hidden = true; detailKey = null; return;
    }
    const c = cierres[key];
    const m = MOODS.find(x => x.id === c.animo);
    $('cdFecha').textContent =
      new Date(key + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});
    $('cdMood').textContent = m ? (m.emoji + ' ' + m.name) : '';
    $('cdNotasWrap').hidden = !c.notas;
    $('cdNotas').textContent = c.notas || '';
    $('cdPlanWrap').hidden = !c.plan;
    $('cdPlan').textContent = c.plan || '';
    $('calDetail').hidden = false;
    detailKey = key;
  }

  // ===== Temas =====
  // Cada tema es solo un juego de valores para las MISMAS variables CSS.
  const THEMES = [
    {id:'carbon',  name:'Carbón · ámbar',  vars:{bg:'#12161d', card:'#1a2029', card2:'#20262f', line:'#2a3340', text:'#e9edf3', muted:'#8b95a3', accent:'#ffb454', onAccent:'#191204', teal:'#4fd6be'}},
    {id:'oceano',  name:'Océano · azul',   vars:{bg:'#0d141f', card:'#141d2b', card2:'#1a2536', line:'#243349', text:'#e8eef6', muted:'#8b98ab', accent:'#6ab8ff', onAccent:'#04182b', teal:'#57dbb1'}},
    {id:'bosque',  name:'Bosque · verde',  vars:{bg:'#0f1613', card:'#16201b', card2:'#1c2822', line:'#28382f', text:'#e9f2ec', muted:'#8fa398', accent:'#7fd88f', onAccent:'#08210d', teal:'#ffd166'}},
    {id:'claro',   name:'Claro · limpio',  vars:{bg:'#f2f4f7', card:'#ffffff', card2:'#e9edf2', line:'#d4dae2', text:'#1a2230', muted:'#66717f', accent:'#c76a04', onAccent:'#ffffff', teal:'#0c8a70'}},
    {id:'violeta', name:'Violeta · neón',  vars:{bg:'#131020', card:'#1a1629', card2:'#211c34', line:'#2f2847', text:'#ece9f6', muted:'#968fae', accent:'#b795ff', onAccent:'#160b2b', teal:'#ff8ad8'}},
  ];
  const TEMA_KEY = 'reps-tema';
  let themeSel = {modo:'preset', id:'carbon'};

  // --- matemáticas de color (para el modo personalizado) ---
  function hexToRgb(h){
    h = h.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function rgbToHex(r,g,b){
    return '#' + [r,g,b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2,'0')).join('');
  }
  // mezcla dos colores: t=0 da A puro, t=1 da B puro
  function mix(hexA, hexB, t){
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t);
  }
  // luminancia percibida (0=negro, 1=blanco): el ojo pesa más el verde
  function isLight(hex){
    const [r,g,b] = hexToRgb(hex);
    return (0.2126*r + 0.7152*g + 0.0722*b) / 255 > 0.55;
  }

  // Modo personalizado: de 2 colores elegidos se DERIVA la paleta entera,
  // garantizando contraste: el texto se decide por la luz del fondo.
  function customVars(accent, bg){
    const light = isLight(bg);
    return {
      bg, accent,
      card:  light ? mix(bg,'#ffffff',.75) : mix(bg,'#ffffff',.05),
      card2: light ? mix(bg,'#ffffff',.35) : mix(bg,'#ffffff',.09),
      line:  light ? mix(bg,'#000000',.12) : mix(bg,'#ffffff',.16),
      text:  light ? '#1a2230' : '#e9edf3',
      muted: light ? '#66717f' : '#98a1ad',
      onAccent: isLight(accent) ? '#191204' : '#ffffff',
      teal:  light ? '#0c8a70' : '#4fd6be',
    };
  }

  // AQUÍ ocurre la magia: escribir las variables CSS en el elemento raíz.
  // Todas las reglas con var(--x) se repintan solas, sin tocar el CSS.
  function applyVars(v){
    const root = document.documentElement.style;
    root.setProperty('--bg', v.bg);
    root.setProperty('--card', v.card);
    root.setProperty('--card-2', v.card2);
    root.setProperty('--line', v.line);
    root.setProperty('--text', v.text);
    root.setProperty('--muted', v.muted);
    root.setProperty('--amber', v.accent);
    root.setProperty('--on-accent', v.onAccent);
    root.setProperty('--teal', v.teal);
    // la barra de estado de Android acompaña al fondo
    document.querySelector('meta[name="theme-color"]').setAttribute('content', v.bg);
  }

  function currentVars(){
    if(themeSel.modo === 'custom') return customVars(themeSel.accent, themeSel.bg);
    const t = THEMES.find(x => x.id === themeSel.id) || THEMES[0];
    return t.vars;
  }
  function applyThemeSel(){ applyVars(currentVars()); }

  function loadTheme(){
    try{
      const v = localStorage.getItem(TEMA_KEY);
      if(v) themeSel = JSON.parse(v);
    }catch(e){ themeSel = {modo:'preset', id:'carbon'}; }
  }
  function saveTheme(){
    try{ localStorage.setItem(TEMA_KEY, JSON.stringify(themeSel)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  // --- interfaz del selector ---
  function renderThemeUI(){
    const list = $('themeList'); list.innerHTML = '';
    THEMES.forEach(t => {
      const b = document.createElement('button');
      b.className = 'swatch' + (themeSel.modo === 'preset' && themeSel.id === t.id ? ' active' : '');
      b.innerHTML =
        '<span class="s-dots">' +
          '<span class="s-dot" style="background:' + t.vars.bg + '"></span>' +
          '<span class="s-dot" style="background:' + t.vars.accent + '"></span>' +
        '</span>' + t.name + '<span class="s-check">✓</span>';
      b.addEventListener('click', ()=>{
        themeSel = {modo:'preset', id:t.id};
        applyThemeSel(); saveTheme(); renderThemeUI();
      });
      list.appendChild(b);
    });
    // los selectores de color reflejan el tema vigente
    const v = currentVars();
    $('pickAccent').value = v.accent;
    $('pickBg').value = v.bg;
  }

  $('themeBtn').addEventListener('click', ()=>{ renderThemeUI(); $('themeWrap').hidden = false; });
  $('themeClose').addEventListener('click', ()=>{ $('themeWrap').hidden = true; });
  $('themeWrap').addEventListener('click', (e)=>{ if(e.target === $('themeWrap')) $('themeWrap').hidden = true; });

  // mover cualquier selector activa el modo personalizado y aplica EN VIVO
  function onPick(){
    themeSel = {modo:'custom', accent: $('pickAccent').value, bg: $('pickBg').value};
    applyThemeSel(); saveTheme(); renderThemeUI();
  }
  $('pickAccent').addEventListener('input', onPick);
  $('pickBg').addEventListener('input', onPick);

  // ===== Respaldo: exportar / importar =====
  function exportBackup(){
    const backup = {
      app: 'reps',          // firma: identifica que este json es nuestro
      formato: 1,           // versión del formato, por si algún día cambia
      exportado: new Date().toISOString(),
      data: { 'reps-dias': dias, 'reps-bandeja': ideas, 'reps-cierres': cierres, 'reps-tema': themeSel },
    };
    // un Blob es un "archivo en memoria"; el <a download> lo baja al disco
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reps-respaldo-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000); // libera la memoria
    toast('Respaldo descargado. 💾');
  }

  function importBackup(file){
    const reader = new FileReader();
    reader.onload = () => {
      let b;
      try { b = JSON.parse(reader.result); }
      catch(e){ toast('Ese archivo no es un respaldo válido.'); return; }
      if(!b || b.app !== 'reps' || !b.data || typeof b.data !== 'object'){
        toast('Ese archivo no es un respaldo de REPS.'); return;
      }
      const d = b.data['reps-dias'], i = b.data['reps-bandeja'], z = b.data['reps-cierres'];
      if((d && typeof d !== 'object') || (i && !Array.isArray(i)) || (z && typeof z !== 'object')){
        toast('El respaldo tiene un formato incorrecto.'); return;
      }
      const fecha = (b.exportado || '').slice(0,10) || 'fecha desconocida';
      if(!confirm('Esto reemplazará tus datos actuales con el respaldo del ' + fecha + '. ¿Continuar?')) return;
      dias = d || {};
      ideas = i || [];
      cierres = z || {}; // respaldos viejos no traen cierres: queda vacío
      if(b.data['reps-tema'] && typeof b.data['reps-tema'] === 'object'){
        themeSel = b.data['reps-tema'];
        applyThemeSel(); saveTheme();
      }
      save(); saveTray(); saveCierres();
      render(); renderTray();
      fillCierreForm(); renderPlanHoy();
      toast('Respaldo restaurado. 💾');
    };
    reader.onerror = () => toast('No se pudo leer el archivo.');
    reader.readAsText(file);
  }

  $('exportBtn').addEventListener('click', exportBackup);
  $('importBtn').addEventListener('click', ()=> $('importFile').click());
  $('importFile').addEventListener('change', ()=>{
    const f = $('importFile').files[0];
    if(f) importBackup(f);
    $('importFile').value = ''; // permite re-elegir el mismo archivo después
  });

  loadTheme();
  applyThemeSel(); // primero el tema: la app ya nace pintada del color elegido
  load();
  loadTray();
  loadCierres();   // antes de render(): el calendario ya lee los cierres
  render();
  renderTray();
  fillCierreForm();
  renderPlanHoy();

  // Registra el service worker (cache offline). Solo existe en http/https,
  // por eso el "if": abriendo el archivo con doble clic (file://) no corre.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW no registrado:', e));
  }
})();
