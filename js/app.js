(function(){
  // Lista de fábrica: la migración v4→v5 siembra reps-habitos con esto.
  // Sus IDs son sagrados: el historial de reps-dias se guarda por ID.
  const HABITS_DEFAULT = [
    {id:'despertar', name:'Despertar 8:30', hint:'Pies al piso, sin snooze', core:true},
    {id:'correr',    name:'Correr / perrita + 10 min calistenia', hint:'20–30 min, antes de la PC', core:true},
    {id:'bloque1',   name:'Bloque de construcción', hint:'Mínimo 1 hr, celular en otro cuarto', core:true},
    {id:'cama',      name:'Cama tendida', hint:'Ya lo tienes automático', core:false},
    {id:'bloque2',   name:'Bloque corto (1 hr)', hint:'App, leer, practicar', core:false},
    {id:'dormir',    name:'Leer 20 min + dormir 1:00 am', hint:'Celular a cargar lejos de la cama', core:false},
  ];
  const HABITS_KEY = 'reps-habitos';
  const MAX_HABITS = 8, MIN_CORE = 2, MAX_CORE = 4;
  let HABITS = HABITS_DEFAULT.map(h => Object.assign({}, h)); // editable en runtime
  let CORE = [];
  function rebuildCore(){ CORE = HABITS.filter(h => h.core).map(h => h.id); }
  rebuildCore();

  const KEY = 'reps-dias';
  let dias = {};

  const $ = id => document.getElementById(id);

  function localISO(d){
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
  }
  const today = () => localISO(new Date());
  // sin core definido, un registro NUNCA está ganado (evita el "true vacío"
  // de [].every, que marcaría cualquier día como ganado)
  function isWon(rec){ return !!rec && CORE.length > 0 && CORE.every(id => rec[id]); }

  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      $(t.dataset.panel).classList.add('active');
    });
  });

  // un "mapa" válido: objeto de verdad, no array ni número ni null
  function esMapa(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }

  function load(){
    try{
      const v = JSON.parse(localStorage.getItem(KEY));
      if(esMapa(v)) dias = v; // si no tiene la forma esperada, se ignora
    }catch(e){ dias = {}; }
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(dias)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  // depura una lista de hábitos cruda a la forma correcta; devuelve null
  // si no queda nada usable (para caer a la lista de fábrica)
  function sanearHabitos(v){
    if(!Array.isArray(v)) return null;
    const vistos = {};
    const limpio = v
      .filter(h => h && typeof h.id === 'string' && h.id && typeof h.name === 'string' && h.name.trim())
      .filter(h => vistos[h.id] ? false : (vistos[h.id] = true)) // ids únicos
      .map(h => ({ id: h.id, name: h.name.trim(), hint: typeof h.hint === 'string' ? h.hint.trim() : '', core: !!h.core }))
      .slice(0, MAX_HABITS);
    return limpio.length ? limpio : null;
  }
  function loadHabitos(){
    let crudo = null;
    try{ crudo = localStorage.getItem(HABITS_KEY); }catch(e){}
    let v = null;
    try{ v = sanearHabitos(JSON.parse(crudo)); }catch(e){}
    if(v) HABITS = v;                       // lista válida guardada
    else HABITS = HABITS_DEFAULT.map(h => Object.assign({}, h)); // fábrica
    rebuildCore();
    // persiste la lista efectiva cuando en storage no había una válida:
    // instalación nueva (crudo null) o datos corruptos (v null) → se sanea
    if(crudo === null || !v) saveHabitos();
  }
  function saveHabitos(){
    try{ localStorage.setItem(HABITS_KEY, JSON.stringify(HABITS)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  const nuevoHabId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  // racha "pura": solo días ganados, sin congeladores (la usa procesarRacha)
  function streakBase(){
    let n = 0;
    const d = new Date();
    if(!isWon(dias[localISO(d)])) d.setDate(d.getDate()-1);
    while(isWon(dias[localISO(d)])){ n++; d.setDate(d.getDate()-1); }
    return n;
  }

  // ===== Protector de racha (congeladores) =====
  // Cada 7 días ganados consecutivos fabricas 1 congelador (máx. 2).
  // Un día perdido consume uno automáticamente y la racha sobrevive.
  const RACHA_KEY = 'reps-racha';
  let racha = { congeladores: 0, fabRun: 0, procesadoHasta: null, congelados: {} };

  function loadRacha(){
    try{
      const v = JSON.parse(localStorage.getItem(RACHA_KEY));
      if(esMapa(v)){
        racha.congeladores = Math.max(0, Math.min(2, parseInt(v.congeladores, 10) || 0));
        racha.fabRun = Math.max(0, parseInt(v.fabRun, 10) || 0);
        racha.procesadoHasta = typeof v.procesadoHasta === 'string' ? v.procesadoHasta : null;
        racha.congelados = esMapa(v.congelados) ? v.congelados : {};
      }
    }catch(e){ /* se quedan los valores por defecto */ }
  }
  function saveRacha(){
    try{ localStorage.setItem(RACHA_KEY, JSON.stringify(racha)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  // procesa una sola vez cada día transcurrido desde la última visita
  function procesarRacha(){
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const ayerKey = localISO(ayer);
    if(racha.procesadoHasta === null){
      // primera vez: el pasado no se juzga; la racha vigente cuenta
      // para fabricar el primer congelador
      racha.procesadoHasta = ayerKey;
      racha.fabRun = streakBase();
      saveRacha();
      return;
    }
    if(racha.procesadoHasta >= ayerKey) return; // ya está al día
    let usados = 0, fabricados = 0;
    const d = new Date(racha.procesadoHasta + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    while(localISO(d) <= ayerKey){
      const k = localISO(d);
      if(isWon(dias[k])){
        racha.fabRun++;
        if(racha.fabRun % 7 === 0 && racha.congeladores < 2){ racha.congeladores++; fabricados++; }
      } else if(racha.congeladores > 0){
        racha.congeladores--;         // el congelador se sacrifica solo
        racha.congelados[k] = true;   // y ese día queda marcado como salvado
        usados++;
      } else {
        racha.fabRun = 0;             // sin protección: la fábrica reinicia
      }
      d.setDate(d.getDate() + 1);
    }
    racha.procesadoHasta = ayerKey;
    saveRacha();
    if(usados) toast('🧊 Un congelador salvó tu racha.');
    else if(fabricados) toast('🧊 Fabricaste un congelador de racha.');
  }

  // racha visible: los días congelados no suman, pero tampoco rompen
  function streak(){
    let n = 0;
    const d = new Date();
    if(!isWon(dias[localISO(d)])) d.setDate(d.getDate()-1);
    while(true){
      const k = localISO(d);
      if(isWon(dias[k])) n++;
      else if(!racha.congelados[k]) break;
      d.setDate(d.getDate()-1);
    }
    return n;
  }
  function lostYesterday(){
    const y = new Date(); y.setDate(y.getDate()-1);
    const key = localISO(y);
    return (key in dias) && !isWon(dias[key]) && !racha.congelados[key];
  }

  function habitBtn(h, rec){
    const done = !!rec[h.id];
    const b = document.createElement('button');
    b.className = 'habit' + (done?' done':'');
    b.setAttribute('aria-pressed', done);
    // textContent (no innerHTML): el nombre y la pista son texto del usuario
    const check = document.createElement('span');
    check.className = 'check'; check.setAttribute('aria-hidden','true'); check.textContent = '✓';
    const body = document.createElement('span'); body.className = 'h-body';
    const name = document.createElement('span'); name.className = 'h-name'; name.textContent = h.name;
    body.appendChild(name);
    if(h.hint){
      const hint = document.createElement('div'); hint.className = 'h-hint'; hint.textContent = h.hint;
      body.appendChild(hint);
    }
    b.append(check, body);
    if(h.core){
      const mark = document.createElement('span'); mark.className = 'core-mark'; mark.textContent = 'CORE';
      b.appendChild(mark);
    }
    b.addEventListener('click', ()=>{
      // fecha y registro FRESCOS: si pasó la medianoche desde que se pintó
      // la pantalla, el "rec" viejo pertenece a AYER y no debe tocarse
      const k = today();
      const cur = dias[k] || {};
      const wasWon = isWon(cur);
      cur[h.id] = !cur[h.id];
      dias[k] = cur;
      save();
      render();
      if(!wasWon && isWon(cur)) toast('Día ganado. Una rep más. 🔥');
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
    // sin hábitos extra, la sección "Suman puntos" se oculta
    const secExtra = $('secExtra');
    if(secExtra) secExtra.hidden = !HABITS.some(h => !h.core);
    const coreDone = CORE.filter(id => rec[id]).length;
    $('coreTag').textContent = coreDone + '/' + CORE.length + ' = día ganado';

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
      s>0 ? 'La racha vive. Cierra hoy los ' + CORE.length + ' core.' :
      'Gana hoy para encenderla.';
    $('streakWarn').hidden = !(lostYesterday() && !won);
    $('frzInfo').hidden = racha.congeladores === 0;
    $('frzInfo').textContent = '🧊 ×' + racha.congeladores +
      (racha.congeladores === 1 ? ' congelador listo' : ' congeladores listos');

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
    updateBadge(); // la insignia del ícono refleja los core pendientes
  }

  // ===== Insignia en el ícono (Badging API) =====
  // Lo más cercano a un "widget que te incita a entrar" que permite una
  // PWA: un número sobre el ícono con tus core pendientes de hoy.
  // Se limpia solo al ganar el día. Si el sistema no la soporta, no pasa nada.
  function updateBadge(){
    if(!('setAppBadge' in navigator)) return;
    const rec = dias[today()] || {};
    const pend = CORE.filter(id => !rec[id]).length;
    if(pend > 0) navigator.setAppBadge(pend).catch(()=>{});
    else navigator.clearAppBadge().catch(()=>{});
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
      const v = JSON.parse(localStorage.getItem(TRAY_KEY));
      if(Array.isArray(v)) ideas = v.filter(x => x && typeof x.text === 'string');
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

  // El Espejo: correlaciones simples entre TUS datos — pura aritmética
  // local, sin IA. Cada insight exige un mínimo de muestras para hablar.
  function espejoInsights(){
    const out = [];
    const nombres = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const keys = Object.keys(dias).filter(k => dias[k] && HABITS.some(h => dias[k][h.id]));

    // 1) hábito ↔ ánimo: ¿qué rep te pone 🔥? (mínimo 5 días con cierre)
    let mejor = null;
    HABITS.forEach(h => {
      const con = keys.filter(k => dias[k][h.id] && cierres[k] && cierres[k].animo);
      if(con.length < 5) return;
      const pct = Math.round(con.filter(k => cierres[k].animo === 'bien').length / con.length * 100);
      if(pct >= 60 && (!mejor || pct > mejor.pct)) mejor = {nombre: h.name, pct};
    });
    if(mejor) out.push('Los días con «' + mejor.nombre + '», tu ánimo es 🔥 el ' + mejor.pct + '%.');

    // 2) mejor y peor día de la semana (mínimo 3 muestras por día)
    const porDow = Array.from({length:7}, ()=>({won:0, tot:0}));
    keys.forEach(k => {
      const dow = new Date(k + 'T12:00:00').getDay();
      porDow[dow].tot++;
      if(isWon(dias[k])) porDow[dow].won++;
    });
    const conDatos = porDow
      .map((x,i) => ({i, pct: x.tot >= 3 ? Math.round(x.won / x.tot * 100) : null}))
      .filter(x => x.pct !== null);
    if(conDatos.length >= 2){
      const top = conDatos.reduce((a,b)=> b.pct > a.pct ? b : a);
      const low = conDatos.reduce((a,b)=> b.pct < a.pct ? b : a);
      if(top.i !== low.i && top.pct !== low.pct){
        out.push('Tu mejor día: ' + nombres[top.i] + ' (' + top.pct + '% ganado). El difícil: ' + nombres[low.i] + ' (' + low.pct + '%).');
      }
    }

    // 3) ¿en qué día mueren tus rachas? (mínimo 3 muertes registradas)
    const muertes = Array.from({length:7}, ()=>0); let total = 0;
    Object.keys(dias).forEach(k => {
      if(isWon(dias[k]) || racha.congelados[k]) return;
      const prev = new Date(k + 'T12:00:00'); prev.setDate(prev.getDate() - 1);
      if(isWon(dias[localISO(prev)])){ muertes[new Date(k + 'T12:00:00').getDay()]++; total++; }
    });
    if(total >= 3){
      const peor = muertes.indexOf(Math.max(...muertes));
      out.push('Tus rachas suelen morir en ' + nombres[peor] + '. Ese día, protégete.');
    }
    return out;
  }

  function renderStats(){
    const s = statsData();
    $('stTotal').textContent = s.total;
    $('stBest').textContent = s.best;
    $('stNow').textContent = s.now;
    $('stMonth').textContent = s.pct30 + '%';

    // contador de identidad: cuántas veces has hecho cada rep, en total.
    // Las rachas se rompen; estos números solo crecen.
    const il = $('identList'); il.innerHTML = '';
    HABITS.forEach(h => {
      const n = Object.keys(dias).filter(k => dias[k] && dias[k][h.id]).length;
      const row = document.createElement('div'); row.className = 'id-row';
      const name = document.createElement('span'); name.textContent = h.name;
      const num = document.createElement('span'); num.className = 'id-num'; num.textContent = n + '×';
      row.append(name, num);
      il.appendChild(row);
    });

    // el espejo
    const es = $('espejoList'); es.innerHTML = '';
    const ins = espejoInsights();
    if(ins.length === 0){
      const p = document.createElement('div'); p.className = 'es-row es-empty';
      p.textContent = 'El Espejo necesita ~2 semanas de datos para hablar de ti. Sigue sumando.';
      es.appendChild(p);
    } else {
      ins.forEach(t => {
        const p = document.createElement('div'); p.className = 'es-row';
        p.textContent = t;
        es.appendChild(p);
      });
    }

    renderCal();
  }

  function renderCal(){
    const now = new Date();
    if(calY === null){ calY = now.getFullYear(); calM = now.getMonth(); }
    // si hay un detalle abierto, se repinta con datos frescos (los hábitos
    // de hoy pueden cambiar mientras se está viendo)
    if(detailKey){ const k = detailKey; detailKey = null; showDayDetail(k); }
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
        + (racha.congelados[key] ? ' frozen' : '')
        + (key === todayKey ? ' today' : '') + (key > todayKey ? ' future' : '');
      el.textContent = day;
      if(key <= todayKey){
        el.classList.add('clickable');
        if(cierres[key]) el.classList.add('has-note'); // el punto sigue marcando cierres
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

  // ===== Plan semanal =====
  // Guardado plano por día: { 'YYYY-MM-DD': 'texto' }. Una "semana" no se
  // guarda: se DERIVA (7 fechas consecutivas desde un lunes).
  const SEMANA_KEY = 'reps-semana';
  let semana = {};
  let weekOff = 0; // 0 = semana actual, +1 = entrante, -1 = pasada...

  function loadSemana(){
    semana = {}; // siempre desde cero: esta función puede releerse tras migrar
    try{
      const v = JSON.parse(localStorage.getItem(SEMANA_KEY));
      if(esMapa(v)){
        Object.keys(v).forEach(k => { if(typeof v[k] === 'string') semana[k] = v[k]; });
      }
    }catch(e){ semana = {}; }
  }
  function saveSemana(){
    try{ localStorage.setItem(SEMANA_KEY, JSON.stringify(semana)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  // el lunes de la semana de una fecha: getDay() da 0=dom..6=sáb,
  // y (dow+6)%7 son los días transcurridos desde el lunes
  function mondayOf(date){
    const d = new Date(date);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }

  function renderSemana(){
    const mon = mondayOf(new Date());
    mon.setDate(mon.getDate() + weekOff * 7);
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);

    // título: "Semana del 6 al 12 de julio" (mes solo donde hace falta)
    const conMes = d => d.toLocaleDateString('es-MX', {day:'numeric', month:'long'});
    const inicio = mon.getMonth() === sun.getMonth() ? mon.getDate() : conMes(mon);
    $('wpTitle').textContent = 'Semana del ' + inicio + ' al ' + conMes(sun);

    const list = $('wpList'); list.innerHTML = '';
    const todayKey = today();
    for(let i = 0; i < 7; i++){
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const key = localISO(d);
      const row = document.createElement('div');
      row.className = 'wp-row' + (key === todayKey ? ' today' : '');
      const lbl = document.createElement('label');
      lbl.className = 'wp-lbl';
      lbl.textContent = d.toLocaleDateString('es-MX', {weekday:'short', day:'numeric'});
      lbl.setAttribute('for', 'wp-' + key);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'wp-' + key;
      inp.className = 'wp-inp';
      inp.placeholder = 'Plan…';
      inp.value = semana[key] || '';
      inp.addEventListener('input', ()=>{
        if(inp.value.trim()) semana[key] = inp.value;
        else delete semana[key]; // sin texto = sin plan (no guardamos vacíos)
        saveSemana();
        if(key === todayKey) renderPlanHoy(); // el banner de Hoy, al instante
      });
      row.append(lbl, inp);
      list.appendChild(row);
    }
  }

  $('wpPrev').addEventListener('click', ()=>{ weekOff--; renderSemana(); });
  $('wpNext').addEventListener('click', ()=>{ weekOff++; renderSemana(); });

  // ===== Alarmas de bloques (Mi día) =====
  // Una PWA no puede programar alarmas del sistema por sí sola. Lo que SÍ
  // puede en Android: lanzar un "intent" SET_ALARM que abre la app de
  // Reloj con la alarma prellenada (hora + nombre) — el usuario confirma.
  const esAndroid = /android/i.test(navigator.userAgent);
  document.querySelectorAll('#p-dia .slot').forEach(slot => {
    const t = slot.querySelector('.t'), n = slot.querySelector('.n');
    if(!t || !n) return;
    const hm = t.textContent.trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!hm) return; // sin hora reconocible, sin botón

    const btn = document.createElement('button');
    btn.className = 'slot-alarm';
    btn.textContent = '⏰';
    btn.setAttribute('aria-label', 'Poner alarma: ' + n.textContent + ' a las ' + t.textContent);
    btn.addEventListener('click', ()=>{
      if(!esAndroid){
        toast('Las alarmas se ponen desde el celular. 📱');
        return;
      }
      // navegar por código (location.href) a un intent suele bloquearse en
      // PWA instalada; un <a> real con click sí cuenta como gesto del usuario
      const uri = 'intent://alarma/#Intent;' +
        'action=android.intent.action.SET_ALARM;' +
        'i.android.intent.extra.alarm.HOUR=' + parseInt(hm[1], 10) + ';' +
        'i.android.intent.extra.alarm.MINUTES=' + parseInt(hm[2], 10) + ';' +
        'S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent('REPS · ' + n.textContent) + ';' +
        'S.browser_fallback_url=' + encodeURIComponent(location.href) + ';' +
        'end';
      toast('Abriendo el Reloj… confirma la alarma ahí.');
      const a = document.createElement('a');
      a.href = uri;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    slot.appendChild(btn);
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
      const v = JSON.parse(localStorage.getItem(CIERRES_KEY));
      if(esMapa(v)) cierres = v;
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

  // pinta el formulario con el cierre de HOY — y lo LIMPIA si no hay:
  // nunca debe quedarse texto de otro día esperando guardarse por error
  function fillCierreForm(){
    const c = cierres[today()] || {};
    moodSel = c.animo || null;
    document.querySelectorAll('.mood').forEach(x =>
      x.classList.toggle('active', x.dataset.mood === moodSel));
    $('notasHoy').value = c.notas || '';
    $('planManana').value = c.plan || '';
  }

  // El banner de Hoy junta dos fuentes: 1) el plan semanal de hoy,
  // 2) el "plan de mañana" del cierre de ANOCHE. Ambos sin duplicar:
  // si dicen lo mismo (ignorando mayúsculas), se muestra una sola vez.
  function renderPlanHoy(){
    const y = new Date(); y.setDate(y.getDate() - 1);
    const deCierre = ((cierres[localISO(y)] || {}).plan || '').trim();
    const deSemana = (semana[today()] || '').trim();
    const partes = [];
    if(deSemana) partes.push(deSemana);
    if(deCierre && deCierre.toLowerCase() !== deSemana.toLowerCase()) partes.push(deCierre);
    $('planHoy').hidden = partes.length === 0;
    if(partes.length) $('planHoyTxt').textContent = partes.join(' · ');
  }

  // detalle de cualquier día pasado: hábitos hechos + estado + cierre si hay
  function showDayDetail(key){
    if(detailKey === key && !$('calDetail').hidden){ // tocar de nuevo lo cierra
      $('calDetail').hidden = true; detailKey = null; return;
    }
    const c = cierres[key] || {};
    const r = dias[key];
    const m = MOODS.find(x => x.id === c.animo);

    $('cdFecha').textContent =
      new Date(key + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});
    $('cdMood').textContent = m ? (m.emoji + ' ' + m.name) : '';

    // estado del día: ganado, parcial (n/3 core) o sin registro
    const coreHechos = CORE.filter(id => r && r[id]).length;
    $('cdEstado').textContent =
      isWon(r) ? 'Día ganado 🔥' :
      racha.congelados[key] ? 'Congelado 🧊 · un congelador salvó la racha' :
      (r && HABITS.some(h => r[h.id])) ? 'Parcial · ' + coreHechos + '/' + CORE.length + ' core' :
      'Sin registro';

    // qué reps cayeron ese día
    const hechos = HABITS.filter(h => r && r[h.id]).map(h => h.name);
    $('cdHabitosWrap').hidden = hechos.length === 0;
    $('cdHabitos').textContent = hechos.join(' · ');

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
    {id:'cristal', name:'Cristal · hielo', vars:{bg:'#0b1220', card:'#141d30', card2:'#1a2540', line:'#2a3a5c', text:'#eaf1ff', muted:'#8fa0bd', accent:'#7dd3ff', onAccent:'#04263a', teal:'#b795ff'}},
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

  // un tema solo es confiable si es un preset que existe o un custom
  // con dos colores hex válidos — cualquier otra cosa rompería la pintura
  const esHex = s => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  function themeValido(t){
    if(!t || typeof t !== 'object') return false;
    if(t.modo === 'preset') return THEMES.some(x => x.id === t.id);
    if(t.modo === 'custom') return esHex(t.accent) && esHex(t.bg);
    return false;
  }

  function loadTheme(){
    try{
      const v = JSON.parse(localStorage.getItem(TEMA_KEY));
      if(themeValido(v)) themeSel = v; // inválido: se queda Carbón
    }catch(e){ /* se queda Carbón */ }
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

  // --- efecto visual (independiente del color: se combina con TODO) ---
  const FX_KEY = 'reps-efecto';
  const FXS = ['ninguno', 'glass', 'clay'];
  let fx = 'ninguno';

  function loadFx(){
    try{
      const v = localStorage.getItem(FX_KEY);
      fx = FXS.includes(v) ? v : 'ninguno';
    }catch(e){ fx = 'ninguno'; }
  }
  function applyFx(){
    document.body.classList.toggle('fx-glass', fx === 'glass');
    document.body.classList.toggle('fx-clay', fx === 'clay');
    document.querySelectorAll('.fx-opt').forEach(b =>
      b.classList.toggle('active', b.dataset.fx === fx));
  }
  document.querySelectorAll('.fx-opt').forEach(b => {
    b.addEventListener('click', ()=>{
      fx = b.dataset.fx;
      try{
        if(fx === 'ninguno') localStorage.removeItem(FX_KEY);
        else localStorage.setItem(FX_KEY, fx);
      }catch(e){}
      applyFx();
    });
  });

  // --- distribución: clases en <body>, el CSS hace el resto ---
  // 'normal' | 'compacto' (densidad) | 'minimal' (densidad + solo lo esencial)
  const DIST_KEY = 'reps-distribucion';
  const DISTS = ['normal', 'compacto', 'minimal'];
  let dist = 'normal';

  function loadDist(){
    try{
      const v = localStorage.getItem(DIST_KEY);
      dist = DISTS.includes(v) ? v : 'normal';
    }catch(e){ dist = 'normal'; }
  }
  function applyDist(){
    document.body.classList.toggle('compact', dist !== 'normal'); // minimal hereda la densidad
    document.body.classList.toggle('minimal', dist === 'minimal');
    document.querySelectorAll('.dist-opt[data-dist]').forEach(b =>
      b.classList.toggle('active', b.dataset.dist === dist));
  }
  document.querySelectorAll('.dist-opt[data-dist]').forEach(b => {
    b.addEventListener('click', ()=>{
      dist = b.dataset.dist;
      try{
        if(dist === 'normal') localStorage.removeItem(DIST_KEY); // normal = sin clave
        else localStorage.setItem(DIST_KEY, dist);
      }catch(e){}
      applyDist();
    });
  });

  // ===== Editor de hábitos =====
  function renderHabEditor(){
    const list = $('habList'); list.innerHTML = '';
    const coreCount = HABITS.filter(h => h.core).length;

    HABITS.forEach(h => {
      const row = document.createElement('div'); row.className = 'hab-row';

      // ⭐ toggle core (respeta límites 2–4 y avisa del efecto en el historial)
      const star = document.createElement('button');
      star.className = 'hab-star' + (h.core ? ' on' : '');
      star.textContent = h.core ? '⭐' : '☆';
      star.setAttribute('aria-label', h.core ? 'Quitar de core' : 'Marcar como core');
      star.addEventListener('click', ()=>{
        if(h.core && coreCount <= MIN_CORE){ toast('Necesitas al menos ' + MIN_CORE + ' core.'); return; }
        if(!h.core && coreCount >= MAX_CORE){ toast('Máximo ' + MAX_CORE + ' core.'); return; }
        h.core = !h.core;
        rebuildCore(); saveHabitos(); render(); renderHabEditor();
        toast('Ojo: cambiar los core re-evalúa tus días pasados.');
      });

      // nombre (editable en vivo)
      const name = document.createElement('input');
      name.type = 'text'; name.className = 'hab-name'; name.value = h.name; name.maxLength = 40;
      name.setAttribute('aria-label', 'Nombre del hábito');
      name.addEventListener('input', ()=>{
        h.name = name.value;
        saveHabitos(); render(); // el historial no se toca: el id es el mismo
      });

      // pista (opcional)
      const hint = document.createElement('input');
      hint.type = 'text'; hint.className = 'hab-hint'; hint.value = h.hint; hint.maxLength = 60;
      hint.placeholder = 'Pista (opcional)';
      hint.setAttribute('aria-label', 'Pista del hábito');
      hint.addEventListener('input', ()=>{ h.hint = hint.value; saveHabitos(); render(); });

      // borrar (confirma; el historial de ese id se conserva en reps-dias)
      const del = document.createElement('button');
      del.className = 'hab-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar hábito');
      del.addEventListener('click', ()=>{
        if(HABITS.length <= MIN_CORE){ toast('Deja al menos ' + MIN_CORE + ' hábitos.'); return; }
        if(h.core && HABITS.filter(x => x.core).length <= MIN_CORE){
          toast('No puedes bajar de ' + MIN_CORE + ' core. Quita el ⭐ de otro primero.'); return;
        }
        if(!confirm('¿Borrar «' + h.name + '»? Tu historial de ese hábito se conserva, solo deja de mostrarse.')) return;
        HABITS = HABITS.filter(x => x.id !== h.id);
        rebuildCore(); saveHabitos(); render(); renderHabEditor();
        toast('Hábito borrado.');
      });

      const top = document.createElement('div'); top.className = 'hab-top';
      top.append(star, name, del);
      row.append(top, hint);
      list.appendChild(row);
    });
  }

  $('editHabBtn').addEventListener('click', ()=>{ renderHabEditor(); $('habWrap').hidden = false; });
  $('habClose').addEventListener('click', ()=>{ $('habWrap').hidden = true; });
  $('habWrap').addEventListener('click', (e)=>{ if(e.target === $('habWrap')) $('habWrap').hidden = true; });
  $('habAdd').addEventListener('click', ()=>{
    if(HABITS.length >= MAX_HABITS){ toast('Máximo ' + MAX_HABITS + ' hábitos.'); return; }
    HABITS.push({ id: nuevoHabId(), name: 'Nuevo hábito', hint: '', core: false }); // nace como extra
    rebuildCore(); saveHabitos(); render(); renderHabEditor();
  });

  // ===== Esquema y migraciones =====
  // reps-schema versiona el FORMATO de los datos (no confundir con la
  // versión del cache en sw.js, que versiona los archivos de la app).
  const SCHEMA_KEY = 'reps-schema';
  const SCHEMA = 5; // versión de formato que esta app espera
  // incluye 'reps-compacto' (clave retirada en v3) para que el respaldo
  // pre-migración también la proteja
  const DATA_KEYS = ['reps-dias', 'reps-bandeja', 'reps-cierres', 'reps-semana', 'reps-tema', 'reps-distribucion', 'reps-efecto', 'reps-racha', 'reps-habitos', 'reps-compacto'];

  // Cada escalón migra de N a N+1 trabajando SOBRE localStorage crudo.
  // Regla: una migración nunca se borra ni se edita una vez publicada.
  const MIGRATIONS = {
    // v1 → v2: normaliza datos escritos por versiones sin validación
    1: function(){
      const lee = k => { try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
      const pon = (k, v) => localStorage.setItem(k, JSON.stringify(v));

      // ideas: solo objetos con texto; repara id, done y created faltantes
      if(localStorage.getItem('reps-bandeja') !== null){
        const ideas = lee('reps-bandeja');
        if(Array.isArray(ideas)){
          pon('reps-bandeja', ideas
            .filter(x => x && typeof x.text === 'string')
            .map(x => ({
              id: x.id || Date.now().toString(36) + Math.random().toString(36).slice(2,6),
              text: x.text,
              cat: typeof x.cat === 'string' ? x.cat : 'algundia',
              done: !!x.done,
              created: x.created || new Date().toISOString(),
            })));
        } else { localStorage.removeItem('reps-bandeja'); } // irrecuperable
      }
      // mapas de fechas: si no tienen forma de objeto, fuera
      ['reps-dias', 'reps-cierres'].forEach(k => {
        if(localStorage.getItem(k) !== null && !esMapa(lee(k))) localStorage.removeItem(k);
      });
      // semana: solo valores de texto sobreviven
      if(localStorage.getItem('reps-semana') !== null){
        const sem = lee('reps-semana');
        if(esMapa(sem)){
          const limpio = {};
          Object.keys(sem).forEach(k => { if(typeof sem[k] === 'string') limpio[k] = sem[k]; });
          pon('reps-semana', limpio);
        } else { localStorage.removeItem('reps-semana'); }
      }
      // tema que no pasa la validación: fuera (la app caerá a Carbón)
      if(localStorage.getItem('reps-tema') !== null && !themeValido(lee('reps-tema'))){
        localStorage.removeItem('reps-tema');
      }
    },

    // v2 → v3: el toggle reps-compacto se convierte en reps-distribucion
    2: function(){
      if(localStorage.getItem('reps-compacto') === '1'){
        localStorage.setItem('reps-distribucion', 'compacto');
      }
      localStorage.removeItem('reps-compacto'); // clave retirada
    },

    // v3 → v4: el efecto vidrio se separa del tema; quien usaba el tema
    // "Cristal · líquido" conserva su vidrio en la clave nueva reps-efecto
    3: function(){
      try{
        const t = JSON.parse(localStorage.getItem('reps-tema'));
        if(t && t.modo === 'preset' && t.id === 'cristal'){
          localStorage.setItem('reps-efecto', 'glass');
        }
      }catch(e){ /* tema ilegible: sin efecto */ }
    },

    // v4 → v5: los hábitos dejan de estar fijos en el código y pasan a
    // reps-habitos. Quien no tenga lista propia hereda la de fábrica (mismos
    // IDs), así el historial de reps-dias sigue mostrándose intacto.
    4: function(){
      if(localStorage.getItem('reps-habitos') === null){
        localStorage.setItem('reps-habitos', JSON.stringify(HABITS_DEFAULT));
      }
    },
  };

  function migrate(){
    let v = parseInt(localStorage.getItem(SCHEMA_KEY), 10);
    if(!v || v < 1){
      // sin marca de versión: si hay datos, son de la era pre-versionado (v1);
      // si no hay nada, es instalación nueva y ya nace en la versión actual
      v = DATA_KEYS.some(k => localStorage.getItem(k) !== null) ? 1 : SCHEMA;
    }
    if(v > SCHEMA) return; // datos de una app más nueva: no tocar nada
    if(v === SCHEMA){ localStorage.setItem(SCHEMA_KEY, String(SCHEMA)); return; }

    // red de seguridad: copia CRUDA de todo antes de tocar un solo byte
    try{
      const crudo = {};
      DATA_KEYS.forEach(k => { const s = localStorage.getItem(k); if(s !== null) crudo[k] = s; });
      localStorage.setItem('reps-pre-migracion',
        JSON.stringify({de: v, a: SCHEMA, fecha: new Date().toISOString(), crudo}));
    }catch(e){ /* sin espacio para la copia: migramos igual, mejor que quedarse atrás */ }

    try{
      while(v < SCHEMA){
        MIGRATIONS[v]();                              // sube un escalón
        v++;
        localStorage.setItem(SCHEMA_KEY, String(v));  // y deja constancia
      }
    }catch(e){
      // una migración falló: restaurar la copia cruda — pérdida CERO
      try{
        const snap = JSON.parse(localStorage.getItem('reps-pre-migracion'));
        if(snap && snap.crudo){
          DATA_KEYS.forEach(k => {
            if(k in snap.crudo) localStorage.setItem(k, snap.crudo[k]);
            else localStorage.removeItem(k);
          });
          localStorage.setItem(SCHEMA_KEY, String(snap.de));
        }
      }catch(e2){}
      console.warn('Migración fallida; datos restaurados tal cual estaban:', e);
    }
  }

  // ===== Respaldo: exportar / importar =====
  function exportBackup(){
    const backup = {
      app: 'reps',          // firma: identifica que este json es nuestro
      schema: SCHEMA,       // versión del formato de los datos que contiene
      exportado: new Date().toISOString(),
      data: { 'reps-dias': dias, 'reps-bandeja': ideas, 'reps-cierres': cierres, 'reps-tema': themeSel, 'reps-semana': semana, 'reps-distribucion': dist, 'reps-efecto': fx, 'reps-racha': racha, 'reps-habitos': HABITS },
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
      dias = esMapa(d) ? d : {};
      ideas = (i || []).filter(x => x && typeof x.text === 'string'); // fuera ideas malformadas
      cierres = esMapa(z) ? z : {}; // respaldos viejos no traen cierres: queda vacío
      const w = b.data['reps-semana'];
      semana = {};
      if(esMapa(w)){
        Object.keys(w).forEach(k => { if(typeof w[k] === 'string') semana[k] = w[k]; });
      }
      if(themeValido(b.data['reps-tema'])){
        themeSel = b.data['reps-tema'];
        applyThemeSel(); saveTheme();
      }
      // distribución: clave nueva directa, o la vieja (reps-compacto) que
      // se escribe cruda para que la cadena de migraciones la convierta
      try{
        const dv = b.data['reps-distribucion'];
        if(DISTS.includes(dv) && dv !== 'normal') localStorage.setItem(DIST_KEY, dv);
        else localStorage.removeItem(DIST_KEY);
        if(b.data['reps-compacto'] === true || b.data['reps-compacto'] === '1'){
          localStorage.setItem('reps-compacto', '1');
        }
        const fv = b.data['reps-efecto'];
        if(FXS.includes(fv) && fv !== 'ninguno') localStorage.setItem(FX_KEY, fv);
        else localStorage.removeItem(FX_KEY);
        const rc = b.data['reps-racha'];
        if(esMapa(rc)) localStorage.setItem(RACHA_KEY, JSON.stringify(rc));
        else localStorage.removeItem(RACHA_KEY);
        // hábitos: se escriben crudos; loadHabitos los sanea (o si el
        // respaldo es viejo y no los trae, la migración v4→v5 los siembra)
        const hb = b.data['reps-habitos'];
        if(Array.isArray(hb)) localStorage.setItem(HABITS_KEY, JSON.stringify(hb));
        else localStorage.removeItem(HABITS_KEY);
      }catch(e){}
      save(); saveTray(); saveCierres(); saveSemana();
      // el respaldo pudo venir de una app vieja: se marca su versión de
      // formato, se migra lo guardado y se relee ya en formato actual
      localStorage.setItem(SCHEMA_KEY, String(parseInt(b.schema, 10) || 1));
      migrate();
      loadHabitos(); // antes de load/render: todo lo demás depende de HABITS
      load(); loadTray(); loadCierres(); loadSemana();
      loadTheme(); applyThemeSel();
      loadDist(); applyDist();
      loadFx(); applyFx();
      racha = { congeladores: 0, fabRun: 0, procesadoHasta: null, congelados: {} };
      loadRacha(); procesarRacha();
      render(); renderTray(); renderSemana();
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

  migrate();       // ANTES que todo: los datos suben al formato actual
  loadHabitos();   // antes de load/render: la racha y las vistas usan HABITS/CORE
  loadTheme();
  applyThemeSel(); // primero el tema: la app ya nace pintada del color elegido
  loadDist();
  applyDist();
  loadFx();
  applyFx();
  load();
  loadTray();
  loadCierres();   // antes de render(): el calendario ya lee los cierres
  loadSemana();    // antes de renderPlanHoy(): el banner lee el plan semanal
  loadRacha();     // antes de render(): la racha visible usa los congelados
  procesarRacha(); // aplica congeladores por los días transcurridos
  render();
  renderTray();
  renderSemana();
  fillCierreForm();
  renderPlanHoy();

  // ===== Intro: saludo según la hora + racha; el CSS la desvanece solo =====
  (function(){
    const el = $('intro');
    if(!el) return;
    const h = new Date().getHours();
    const saludo = h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const s = streak();
    $('introLine').textContent = saludo + ' · ' + (s > 0 ? 'racha de ' + s : 'a ganar el día');
    setTimeout(()=> el.remove(), 2200); // ya invisible desde 1.95s; esto solo limpia el DOM
  })();

  // ===== Atajos del ícono (shortcuts del manifest): ?tab=... =====
  (function(){
    const tab = new URLSearchParams(location.search).get('tab');
    if(!tab) return;
    const map = { bandeja:'p-bandeja', stats:'p-stats', dia:'p-dia', cierre:'p-hoy' };
    const panel = map[tab];
    if(!panel) return;
    const btn = document.querySelector('.tab[data-panel="' + panel + '"]');
    if(btn) btn.click();
    if(tab === 'cierre'){
      setTimeout(()=> document.querySelector('.cierre').scrollIntoView({behavior:'smooth'}), 300);
    }
    if(tab === 'bandeja'){
      setTimeout(()=> $('trayInput').focus(), 300); // listo para escribir
    }
  })();

  // Si la app quedó suspendida y vuelve otro día (lo normal en una PWA
  // instalada: Android la congela, no la cierra), repinta TODO al despertar:
  // checklist del día nuevo, banner del plan, semana actual, cierre limpio.
  let uiDay = today();
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && today() !== uiDay){
      uiDay = today();
      weekOff = 0; // "esta semana" también pudo cambiar
      procesarRacha(); // días nuevos: fabrica o gasta congeladores
      render(); renderTray(); renderSemana();
      fillCierreForm(); renderPlanHoy();
    }
  });

  // Registra el service worker (cache offline). Solo existe en http/https,
  // por eso el "if": abriendo el archivo con doble clic (file://) no corre.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW no registrado:', e));
  }
})();
