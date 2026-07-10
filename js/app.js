(function(){
  // Lista de fábrica: la migración v4→v5 siembra reps-habitos con esto.
  // Sus IDs son sagrados: el historial de reps-dias se guarda por ID.
  // days: 'all' = todos los días, o un array de días de semana (0=domingo..6=sábado)
  const HABITS_DEFAULT = [
    {id:'despertar', name:'Despertar 8:30', hint:'Pies al piso, sin snooze', core:true, days:'all', planB:'levantarte, aunque sea 10 min tarde'},
    {id:'correr',    name:'Correr / perrita + 10 min calistenia', hint:'20–30 min, antes de la PC', core:true, days:'all', planB:'caminar 5 min con la perrita'},
    {id:'bloque1',   name:'Bloque de construcción', hint:'Mínimo 1 hr, celular en otro cuarto', core:true, days:'all', planB:'15 min, aunque sea abrir el proyecto'},
    {id:'cama',      name:'Cama tendida', hint:'Ya lo tienes automático', core:false, days:'all'},
    {id:'bloque2',   name:'Bloque corto (1 hr)', hint:'App, leer, practicar', core:false, days:'all'},
    {id:'dormir',    name:'Leer 20 min + dormir 1:00 am', hint:'Celular a cargar lejos de la cama', core:false, days:'all'},
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
  const dowDe = k => new Date(k + 'T12:00:00').getDay(); // día de semana de una fecha

  // ¿el hábito aplica ese día de la semana?
  function habAplica(h, dow){
    return h.days === 'all' || (Array.isArray(h.days) && h.days.includes(dow));
  }
  // ids de los hábitos CORE programados para ese día (según su calendario)
  function coreDelDia(dateKey){
    const dow = dowDe(dateKey);
    return HABITS.filter(h => h.core && habAplica(h, dow)).map(h => h.id);
  }
  // día de DESCANSO = ese día no tiene ningún core programado (neutral)
  function esDescanso(dateKey){ return coreDelDia(dateKey).length === 0; }
  // día GANADO = tiene core programado y TODOS están hechos
  function esGanado(dateKey){
    const c = coreDelDia(dateKey), rec = dias[dateKey];
    return c.length > 0 && !!rec && c.every(id => rec[id]);
  }
  // isWon date-aware: con fecha usa el core de ESE día; sin fecha, todos los
  // core (compatibilidad). Un día de descanso nunca es "ganado" (es neutral).
  function isWon(rec, dateKey){
    if(!rec) return false;
    const c = dateKey ? coreDelDia(dateKey) : CORE;
    return c.length > 0 && c.every(id => rec[id]);
  }

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
  // un 'days' válido: 'all', o un array con al menos un día de semana (0-6).
  // Vacío o inválido → 'all' (mejor mostrar el hábito que esconderlo por error).
  function sanearDays(d){
    if(!Array.isArray(d)) return 'all';
    const ds = [...new Set(d.map(x => parseInt(x, 10)).filter(x => x >= 0 && x <= 6))].sort();
    return (ds.length === 0 || ds.length === 7) ? 'all' : ds;
  }
  function sanearHabitos(v){
    if(!Array.isArray(v)) return null;
    const vistos = {};
    const limpio = v
      .filter(h => h && typeof h.id === 'string' && h.id && typeof h.name === 'string' && h.name.trim())
      .filter(h => vistos[h.id] ? false : (vistos[h.id] = true)) // ids únicos
      .map(h => ({ id: h.id, name: h.name.trim(), hint: typeof h.hint === 'string' ? h.hint.trim() : '', core: !!h.core, days: sanearDays(h.days), planB: typeof h.planB === 'string' ? h.planB.trim() : '' }))
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

  // racha "pura": ganados consecutivos, saltando descansos (neutrales),
  // sin contar congeladores (la usa procesarRacha para sembrar fabRun)
  function streakBase(){
    let n = 0;
    const d = new Date();
    if(!esGanado(today())) d.setDate(d.getDate()-1); // hoy en curso: no lo exijas
    while(true){
      const k = localISO(d);
      if(esGanado(k)) n++;
      else if(esDescanso(k)){ /* descanso: salta sin contar ni romper */ }
      else break;
      d.setDate(d.getDate()-1);
    }
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
      if(esDescanso(k)){
        /* día de descanso: neutral, ni fabrica ni consume ni rompe */
      } else if(esGanado(k)){
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

  // racha visible: descansos y congelados no suman, pero tampoco rompen
  function streak(){
    let n = 0;
    const d = new Date();
    if(!esGanado(today())) d.setDate(d.getDate()-1);
    while(true){
      const k = localISO(d);
      if(esGanado(k)) n++;
      else if(esDescanso(k) || racha.congelados[k]){ /* salta */ }
      else break;
      d.setDate(d.getDate()-1);
    }
    return n;
  }
  function lostYesterday(){
    const y = new Date(); y.setDate(y.getDate()-1);
    const key = localISO(y);
    return (key in dias) && !esGanado(key) && !esDescanso(key) && !racha.congelados[key];
  }

  // ===== Levantarse: rescate, ritual de derrota, regresos =====
  const CAIDAS_KEY = 'reps-caidas';
  let caidas = {}; // { 'YYYY-MM-DD': motivo } — por qué murió una racha ese día
  const MOTIVOS = [
    {id:'desvelo',    emoji:'😴', name:'Desvelo'},
    {id:'celular',    emoji:'📱', name:'Celular'},
    {id:'animo',      emoji:'🌧️', name:'Ánimo'},
    {id:'imprevisto', emoji:'🌀', name:'Imprevisto'},
    {id:'otro',       emoji:'·',  name:'Otro'},
  ];
  function loadCaidas(){
    try{
      const v = JSON.parse(localStorage.getItem(CAIDAS_KEY));
      if(esMapa(v)){
        caidas = {};
        Object.keys(v).forEach(k => { if(typeof v[k] === 'string') caidas[k] = v[k]; });
      }
    }catch(e){ caidas = {}; }
  }
  function saveCaidas(){
    try{ localStorage.setItem(CAIDAS_KEY, JSON.stringify(caidas)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }

  const primerDia = () => { const f = Object.keys(dias); return f.length ? f.sort()[0] : null; };

  // días consecutivos que pasaron sin ganarse ni congelarse, terminando AYER;
  // no juzga el tiempo anterior al primer registro (evita falsos en día 1)
  function diasCaidosSeguidos(){
    const primero = primerDia();
    if(!primero) return 0;
    let n = 0;
    const d = new Date(); d.setDate(d.getDate() - 1);
    while(localISO(d) >= primero){
      const k = localISO(d);
      if(esGanado(k) || racha.congelados[k]) break;
      if(!esDescanso(k)) n++; // el descanso es neutral: no cuenta ni rompe
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // longitud de la racha de días ganados que TERMINA justo antes de la fecha k
  function rachaAntesDe(k){
    let n = 0;
    const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() - 1);
    while(true){
      const pk = localISO(d);
      if(esGanado(pk)) n++;
      else if(esDescanso(pk) || racha.congelados[pk]){ /* salta */ }
      else break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // el día "juzgable" (no descanso) anterior a k, dentro de la historia
  function diaJuzgableAntes(k, primero){
    const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() - 1);
    while(localISO(d) >= primero){
      const pk = localISO(d);
      if(!esDescanso(pk)) return pk;
      d.setDate(d.getDate() - 1);
    }
    return null;
  }

  // regresos: días ganados cuyo día juzgable anterior fue una caída. Las
  // rachas se rompen; volver es la habilidad — y solo crece.
  function contarRegresos(){
    const primero = primerDia();
    if(!primero) return 0;
    let n = 0;
    Object.keys(dias).forEach(k => {
      if(!esGanado(k)) return;
      const pk = diaJuzgableAntes(k, primero);
      if(pk && !esGanado(pk) && !racha.congelados[pk]) n++;
    });
    return n;
  }

  // ritual de derrota: busca en los últimos 7 días la muerte de racha (de 2+)
  // más reciente que aún no hayas reconocido, y pregunta qué pasó (una vez).
  // La derrota se vuelve dato, no vergüenza.
  let ritualDate = null;
  function renderRitual(){
    const primero = primerDia();
    let target = null, largo = 0;
    if(primero){
      for(let i = 1; i <= 7; i++){
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = localISO(d);
        if(k < primero) break;
        if(k in caidas) continue;                 // ya reconocido
        const esCaida = (k in dias) && !esGanado(k) && !esDescanso(k) && !racha.congelados[k];
        if(!esCaida) continue;
        const n = rachaAntesDe(k);                // racha que murió ese día
        if(n >= 2){ target = k; largo = n; break; } // el más reciente
      }
    }
    $('ritual').hidden = !target;
    if(target){
      ritualDate = target;
      const ayer = localISO(new Date(Date.now() - 86400000));
      const cuando = target === ayer ? 'ayer' :
        'el ' + new Date(target + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long'});
      $('ritualTxt').textContent = 'Tu racha de ' + largo + ' terminó ' + cuando +
        '. Un día malo es normal — no dos. ¿Qué la cortó?';
    } else {
      ritualDate = null;
    }
  }
  // botones de motivo (se crean una vez)
  MOTIVOS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'ri-opt'; b.type = 'button';
    b.textContent = m.emoji + ' ' + m.name;
    b.addEventListener('click', ()=>{
      if(!ritualDate) return;
      caidas[ritualDate] = m.id;
      saveCaidas();
      $('ritual').hidden = true;
      renderStats(); // El Espejo puede tener un insight nuevo de caídas
      toast('Anotado. Mañana lo intentas de nuevo. 🌱');
    });
    $('ritualOpts').appendChild(b);
  });

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
    // Plan B: el mínimo aceptable, como permiso para el día difícil.
    // Solo se muestra si el hábito aún no está hecho.
    if(h.planB && !done){
      const pb = document.createElement('div'); pb.className = 'h-planb';
      pb.textContent = '🅱️ mínimo: ' + h.planB;
      body.appendChild(pb);
    }
    b.append(check, body);
    // ▶ enfocar: abre el temporizador para este hábito. role=button (no se
    // puede anidar <button> real dentro del <button> de la tarjeta).
    if(!done){
      const play = document.createElement('span');
      play.className = 'h-foco'; play.textContent = '▶';
      play.setAttribute('role', 'button'); play.setAttribute('tabindex', '0');
      play.setAttribute('aria-label', 'Enfocar en ' + h.name);
      const lanzar = (e)=>{ e.stopPropagation(); e.preventDefault(); abrirFoco(h.id, h.name); };
      play.addEventListener('click', lanzar);
      play.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') lanzar(e); });
      b.appendChild(play);
    }
    if(h.core){
      const mark = document.createElement('span'); mark.className = 'core-mark'; mark.textContent = 'CORE';
      b.appendChild(mark);
    }
    b.addEventListener('click', ()=>{
      // fecha y registro FRESCOS: si pasó la medianoche desde que se pintó
      // la pantalla, el "rec" viejo pertenece a AYER y no debe tocarse
      const k = today();
      const cur = dias[k] || {};
      const wasWon = isWon(cur, k);
      cur[h.id] = !cur[h.id];
      const nowOn = !!cur[h.id];
      dias[k] = cur;
      save();
      render();
      if(!wasWon && isWon(cur, k)){ sonarGanado(); toast('Día ganado. Una rep más. 🔥'); }
      else if(nowOn) sonarCheck(); // solo al marcar, no al desmarcar
    });
    return b;
  }

  function render(){
    $('fecha').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long', day:'numeric', month:'long'});
    const rec = dias[today()] || {};
    dias[today()] = rec;

    // solo se muestran los hábitos que aplican HOY (según su calendario)
    const hoyKey = today(), hoyDow = dowDe(hoyKey);
    const hoyHabs = HABITS.filter(h => habAplica(h, hoyDow));
    const coreHoy = coreDelDia(hoyKey); // ids de core programados hoy
    const desc = coreHoy.length === 0;  // hoy es día de descanso

    const coreL = $('coreList'), extraL = $('extraList');
    coreL.innerHTML=''; extraL.innerHTML='';
    hoyHabs.forEach(h=> (h.core?coreL:extraL).appendChild(habitBtn(h,rec)) );
    // secciones vacías se ocultan (según lo que toca hoy)
    const secExtra = $('secExtra');
    if(secExtra) secExtra.hidden = !hoyHabs.some(h => !h.core);
    const secCore = $('secCore');
    if(secCore) secCore.hidden = !hoyHabs.some(h => h.core);

    const coreDone = coreHoy.filter(id => rec[id]).length;
    $('coreTag').textContent = desc ? 'descanso' : (coreDone + '/' + coreHoy.length + ' = día ganado');

    const won = esGanado(hoyKey);
    $('stamp').classList.toggle('show', won);

    const done = hoyHabs.filter(h=>rec[h.id]).length;
    const pct = hoyHabs.length ? Math.round(done/hoyHabs.length*100) : 0;
    $('progPct').textContent = pct+'%';
    $('progBar').style.width = pct+'%';
    $('prog').hidden = desc; // sin nada que cumplir, no hay barra

    const s = streak();
    $('streakNum').textContent = s;
    $('streakSub').textContent =
      desc ? 'Hoy es descanso. Tu racha te espera intacta.' :
      won ? 'Hoy ya cayó. Bien.' :
      s>0 ? 'La racha vive. Cierra hoy los ' + coreHoy.length + ' core.' :
      'Gana hoy para encenderla.';
    $('frzInfo').hidden = racha.congeladores === 0;
    $('frzInfo').textContent = '🧊 ×' + racha.congeladores +
      (racha.congeladores === 1 ? ' congelador listo' : ' congeladores listos');

    // modo rescate: 2+ días caídos y hoy aún sin ganar (y hoy NO es descanso).
    const caidosN = diasCaidosSeguidos();
    const enPeligro = caidosN >= 2 && !won && !desc;
    $('rescate').hidden = !enPeligro;
    if(enPeligro){
      $('rescateTxt').textContent = 'Llevas ' + caidosN + ' días fuera. No busques el día perfecto: ' +
        'haz UNA sola cosa hoy y rompe la inercia. Volver ya es ganar.';
    }
    $('streakWarn').hidden = !(lostYesterday() && !won) || enPeligro;

    renderRitual();

    const wk = $('week'); wk.innerHTML='';
    const names = ['dom','lun','mar','mié','jue','vie','sáb'];
    for(let i=6;i>=0;i--){
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = localISO(d), r = dias[key];
      const w = esGanado(key);
      const rest = esDescanso(key);
      const partial = !w && !rest && r && HABITS.some(h=>r[h.id]);
      const el = document.createElement('div');
      el.className='day';
      el.innerHTML =
        '<div class="d-lbl">'+names[d.getDay()]+'</div>' +
        '<div class="dot'+(w?' won':'')+(partial?' partial':'')+(rest?' rest':'')+(i===0?' today':'')+'">' +
        (w?'✓':(rest?'·':(partial?'·':''))) + '</div>';
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
    const pend = coreDelDia(today()).filter(id => !rec[id]).length;
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
      main.addEventListener('click', ()=>{ i.done = !i.done; if(i.done) sonarCheck(); saveTray(); renderTray(); });

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
    // total = fechas registradas que están ganadas (descansos no cuentan)
    const total = Object.keys(dias).filter(k => esGanado(k)).length;

    // mejor racha histórica: recorre del primer día a hoy contando ganados
    // seguidos; descanso y congelado sostienen (saltan), una caída reinicia
    let best = 0, run = 0;
    const primero = primerDia();
    if(primero){
      const hoyKey = today();
      const d = new Date(primero + 'T12:00:00');
      while(localISO(d) <= hoyKey){
        const k = localISO(d);
        if(esGanado(k)){ run++; if(run > best) best = run; }
        else if(esDescanso(k) || racha.congelados[k]){ /* sostiene */ }
        else if(k === hoyKey){ /* hoy en curso: no rompe la racha */ }
        else { run = 0; }
        d.setDate(d.getDate() + 1);
      }
    }

    // % de días ganados en los últimos 30 días CON requisito (sin descansos)
    let g30 = 0, req30 = 0;
    for(let i = 0; i < 30; i++){
      const k = localISO(new Date(Date.now() - i*86400000));
      if(esDescanso(k)) continue;
      req30++;
      if(esGanado(k)) g30++;
    }

    return { total, best, now: streak(), pct30: req30 ? Math.round(g30/req30*100) : 0 };
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

    // 2) mejor y peor día de la semana (mínimo 3 muestras por día; los días
    // de descanso no cuentan porque no hay nada que ganar)
    const porDow = Array.from({length:7}, ()=>({won:0, tot:0}));
    keys.forEach(k => {
      if(esDescanso(k)) return;
      const dow = new Date(k + 'T12:00:00').getDay();
      porDow[dow].tot++;
      if(esGanado(k)) porDow[dow].won++;
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
    const primero3 = primerDia();
    const muertes = Array.from({length:7}, ()=>0); let total = 0;
    if(primero3) Object.keys(dias).forEach(k => {
      if(esGanado(k) || esDescanso(k) || racha.congelados[k]) return; // solo caídas reales
      const pk = diaJuzgableAntes(k, primero3);
      if(pk && esGanado(pk)){ muertes[new Date(k + 'T12:00:00').getDay()]++; total++; }
    });
    if(total >= 3){
      const peor = muertes.indexOf(Math.max(...muertes));
      out.push('Tus rachas suelen morir en ' + nombres[peor] + '. Ese día, protégete.');
    }

    // 4) el motivo más común de tus caídas (del ritual de derrota, mín. 3)
    const claves = Object.keys(caidas);
    if(claves.length >= 3){
      const cuenta = {};
      claves.forEach(k => { cuenta[caidas[k]] = (cuenta[caidas[k]] || 0) + 1; });
      const topId = Object.keys(cuenta).reduce((a,b)=> cuenta[b] > cuenta[a] ? b : a);
      const m = MOTIVOS.find(x => x.id === topId);
      if(m) out.push('Lo que más corta tus rachas: ' + m.emoji + ' ' + m.name.toLowerCase() + '. Ahí está tu punto débil.');
    }
    return out;
  }

  // ===== Hitos: celebrar los saltos =====
  const HITOS_KEY = 'reps-hitos';
  let hitosVistos = [];

  function hitosLogrados(){
    const s = statsData();
    const reg = contarRegresos();
    const L = [];
    const push = (cond, id, emoji, title, sub) => { if(cond) L.push({id, emoji, title, sub}); };
    [[1,'🌱','Día 1','Empezaste. Eso ya te separa de ayer.'],
     [7,'🔥','7 días ganados','Una semana de pruebas. Vas en serio.'],
     [30,'💪','30 días ganados','Un mes construido. Esto ya es identidad.'],
     [50,'⭐','50 días ganados','Medio centenar. Nadie te quita esto.'],
     [100,'🏆','100 días ganados','Cien. Eres otra persona.'],
     [365,'👑','365 días ganados','Un año entero. Leyenda.']
    ].forEach(([n,e,t,su]) => push(s.total >= n, 'dias'+n, e, t, su));
    [[7,'🧊','Racha de 7','Siete seguidos. La inercia ya juega a tu favor.'],
     [14,'⚡','Racha de 14','Dos semanas sin fallar. Impresionante.'],
     [30,'🌟','Racha de 30','Treinta seguidos. Élite.']
    ].forEach(([n,e,t,su]) => push(s.best >= n, 'racha'+n, e, t, su));
    [[5,'🔄','5 regresos','Caíste y volviste cinco veces. Esa es LA habilidad.'],
     [10,'🛡️','10 regresos','Diez regresos. Ya no te rompe una caída.']
    ].forEach(([n,e,t,su]) => push(reg >= n, 'reg'+n, e, t, su));
    return L;
  }
  function loadHitos(){
    let crudo = null;
    try{ crudo = localStorage.getItem(HITOS_KEY); }catch(e){}
    if(crudo === null){
      // primera vez: se siembra lo YA logrado sin celebrar (evita una lluvia
      // de celebraciones al estrenar la feature). Solo lo nuevo se festeja.
      hitosVistos = hitosLogrados().map(h => h.id);
      saveHitos();
    } else {
      try{ const v = JSON.parse(crudo); hitosVistos = Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
      catch(e){ hitosVistos = []; }
    }
  }
  function saveHitos(){
    try{ localStorage.setItem(HITOS_KEY, JSON.stringify(hitosVistos)); }catch(e){}
  }
  let colaCel = [];
  function mostrarSiguienteCel(){
    if(!colaCel.length){ $('celebra').hidden = true; return; }
    const h = colaCel.shift();
    $('celEmoji').textContent = h.emoji;
    $('celTitle').textContent = h.title;
    $('celSub').textContent = h.sub;
    $('celebra').hidden = false;
  }
  function checkHitos(){
    const nuevos = hitosLogrados().filter(h => !hitosVistos.includes(h.id));
    if(!nuevos.length) return;
    nuevos.forEach(h => hitosVistos.push(h.id));
    saveHitos();
    colaCel.push(...nuevos);
    if($('celebra').hidden) mostrarSiguienteCel();
  }
  $('celBtn').addEventListener('click', mostrarSiguienteCel);
  $('celebra').addEventListener('click', (e)=>{ if(e.target === $('celebra')) mostrarSiguienteCel(); });

  // ===== Mapa de calor del año (estilo GitHub) =====
  function renderHeatmap(){
    const heat = $('heat'); heat.innerHTML = '';
    const SEMANAS = 53;
    const start = mondayOf(new Date());
    start.setDate(start.getDate() - (SEMANAS - 1) * 7);
    const todayKey = today();
    let ganados = 0;
    for(let w = 0; w < SEMANAS; w++){
      const col = document.createElement('div'); col.className = 'heat-col';
      for(let d = 0; d < 7; d++){
        const day = new Date(start); day.setDate(day.getDate() + w*7 + d);
        const k = localISO(day);
        const cell = document.createElement('div'); cell.className = 'heat-cell';
        if(k > todayKey){ cell.classList.add('fut'); }
        else {
          const r = dias[k];
          if(esGanado(k)){ cell.classList.add('won'); ganados++; }
          else if(racha.congelados[k]) cell.classList.add('frozen');
          else if(esDescanso(k)) cell.classList.add('rest');
          else if(r && HABITS.some(h => r[h.id])) cell.classList.add('partial');
        }
        col.appendChild(cell);
      }
      heat.appendChild(col);
    }
    $('yearTag').textContent = ganados + ' días ganados';
  }

  // ===== El Pulso: cómo vienes, según ánimo + consistencia =====
  const ANIMO_SCORE = { bien: 2, regular: 1, mal: 0 };

  function pulsoData(){
    const conAnimo = Object.keys(cierres).filter(k => cierres[k] && cierres[k].animo).sort();
    const ult = conAnimo.slice(-5); // los 5 cierres con ánimo más recientes
    const animoAvg = ult.length ? ult.reduce((s,k)=> s + ANIMO_SCORE[cierres[k].animo], 0) / ult.length : null;
    // consistencia de los últimos 7 días CON requisito (los descansos no cuentan)
    let g7 = 0, req7 = 0;
    for(let i = 0; i < 7; i++){
      const k = localISO(new Date(Date.now() - i*86400000));
      if(esDescanso(k)) continue;
      req7++; if(esGanado(k)) g7++;
    }
    const consist = req7 ? g7 / req7 : 0;
    if(animoAvg === null && Object.keys(dias).length < 3) return { nivel: null };
    // el ánimo pesa más (es el dato que el cierre nocturno alimenta)
    const pulso = animoAvg === null ? Math.round(consist * 100)
      : Math.round((animoAvg / 2 * 0.6 + consist * 0.4) * 100);
    const nivel = pulso >= 66 ? 'verde' : pulso >= 40 ? 'ambar' : 'rojo';
    return { nivel, pulso };
  }

  // promedio de ánimo por semana (lunes a domingo) de las últimas 8 semanas
  function moodTrend(){
    const out = [];
    for(let w = 7; w >= 0; w--){
      const mon = mondayOf(new Date()); mon.setDate(mon.getDate() - w * 7);
      let sum = 0, n = 0;
      for(let i = 0; i < 7; i++){
        const d = new Date(mon); d.setDate(d.getDate() + i);
        const c = cierres[localISO(d)];
        if(c && c.animo){ sum += ANIMO_SCORE[c.animo]; n++; }
      }
      out.push(n ? sum / n : null);
    }
    return out;
  }

  function renderPulso(){
    const p = pulsoData();
    const nivelTxt = { verde: 'En forma', ambar: 'Sostente', rojo: 'Cuídate' };
    const msgTxt = {
      verde: 'Vienes fuerte. Aprovecha para subir un peldaño.',
      ambar: 'Ritmo estable. Un día a la vez.',
      rojo: 'Semana pesada. Hoy gana chiquito, sin culpa.',
    };
    const dot = $('pulsoDot');
    dot.className = 'pu-dot' + (p.nivel ? ' ' + p.nivel : '');
    if(!p.nivel){
      $('pulsoNivel').textContent = 'Aún sin pulso';
      $('pulsoMsg').textContent = 'Cierra tus días unos días y aquí verás cómo vienes.';
    } else {
      $('pulsoNivel').textContent = nivelTxt[p.nivel];
      $('pulsoMsg').textContent = msgTxt[p.nivel];
    }

    // barras: una por semana; altura = ánimo promedio (0–2). Sin datos = fantasma.
    const chart = $('pulsoChart'); chart.innerHTML = '';
    moodTrend().forEach(avg => {
      const bar = document.createElement('div'); bar.className = 'pu-bar';
      if(avg === null){ bar.classList.add('empty'); }
      else {
        bar.style.height = Math.max(8, Math.round(avg / 2 * 100)) + '%';
        bar.classList.add(avg >= 1.34 ? 'verde' : avg >= 0.67 ? 'ambar' : 'rojo');
      }
      chart.appendChild(bar);
    });
  }

  function renderStats(){
    renderPulso();
    const s = statsData();
    $('stTotal').textContent = s.total;
    $('stBest').textContent = s.best;
    $('stNow').textContent = s.now;
    $('stMonth').textContent = s.pct30 + '%';

    // contador de identidad: cada rep es un VOTO por quién te estás volviendo.
    // Las rachas se rompen; estos números solo crecen.
    const il = $('identList'); il.innerHTML = '';

    // regresos: caer y volver es la habilidad. Va primero y resaltado.
    const reg = contarRegresos();
    if(reg > 0){
      const row = document.createElement('div'); row.className = 'id-row id-regresos';
      const name = document.createElement('span'); name.textContent = '🔄 Has vuelto después de caer';
      const num = document.createElement('span'); num.className = 'id-num'; num.textContent = reg + '×';
      row.append(name, num);
      il.appendChild(row);
    }
    if(focoTotal > 0){
      const row = document.createElement('div'); row.className = 'id-row id-regresos';
      const name = document.createElement('span'); name.textContent = '🎯 Tiempo enfocado';
      const h = Math.floor(focoTotal / 60), m = focoTotal % 60;
      const num = document.createElement('span'); num.className = 'id-num';
      num.textContent = h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
      row.append(name, num);
      il.appendChild(row);
    }

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

    renderHeatmap();
    renderCal();
    checkHitos(); // al final: los stats ya están calculados
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
      const w = esGanado(key);
      const rest = esDescanso(key);
      const partial = !w && !rest && r && HABITS.some(h => r[h.id]);
      const el = document.createElement('div');
      el.className = 'cal-day'
        + (w ? ' won' : '') + (partial ? ' partial' : '')
        + (racha.congelados[key] ? ' frozen' : '')
        + (rest && key <= todayKey ? ' rest' : '')
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
      if(esGanado(localISO(new Date(calY, calM, d)))) wonMes++;
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
      const r = dias[key], w = esGanado(key);
      const partial = !w && !esDescanso(key) && r && HABITS.some(h => r[h.id]);
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
    renderCierreSemana(); // el cierre de la semana visible
  }

  // ===== Cierre de semana (ritual dominical) =====
  const CIERRE_SEM_KEY = 'reps-cierre-semana';
  let cierreSemana = {}; // { lunesKey: {animo, mejor, intencion, guardado} }
  let wcMoodSel = null;

  function loadCierreSemana(){
    try{
      const v = JSON.parse(localStorage.getItem(CIERRE_SEM_KEY));
      if(esMapa(v)) cierreSemana = v;
    }catch(e){ cierreSemana = {}; }
  }
  function saveCierreSemana(){
    try{ localStorage.setItem(CIERRE_SEM_KEY, JSON.stringify(cierreSemana)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  // el lunes (clave) de la semana que se está viendo en el plan
  function lunesVisible(){
    const m = mondayOf(new Date()); m.setDate(m.getDate() + weekOff * 7);
    return localISO(m);
  }
  function renderCierreSemana(){
    const c = cierreSemana[lunesVisible()] || {};
    wcMoodSel = c.animo || null;
    document.querySelectorAll('#wcMoods .mood').forEach(x =>
      x.classList.toggle('active', x.dataset.wcmood === wcMoodSel));
    $('wcMejor').value = c.mejor || '';
    $('wcIntencion').value = c.intencion || '';
  }
  function guardarWc(){
    const mk = lunesVisible();
    const mejor = $('wcMejor').value.trim();
    const intencion = $('wcIntencion').value.trim();
    if(!wcMoodSel && !mejor && !intencion) delete cierreSemana[mk]; // vacío = sin cierre
    else cierreSemana[mk] = { animo: wcMoodSel, mejor, intencion, guardado: new Date().toISOString() };
    saveCierreSemana();
  }
  document.querySelectorAll('#wcMoods .mood').forEach(b => {
    b.addEventListener('click', ()=>{
      wcMoodSel = (wcMoodSel === b.dataset.wcmood) ? null : b.dataset.wcmood;
      document.querySelectorAll('#wcMoods .mood').forEach(x =>
        x.classList.toggle('active', x.dataset.wcmood === wcMoodSel));
      guardarWc();
    });
  });
  $('wcMejor').addEventListener('input', guardarWc);
  $('wcIntencion').addEventListener('input', guardarWc);

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

    // estado del día: ganado, descanso, congelado, parcial o sin registro
    const coreDia = coreDelDia(key);
    const coreHechos = coreDia.filter(id => r && r[id]).length;
    $('cdEstado').textContent =
      esGanado(key) ? 'Día ganado 🔥' :
      esDescanso(key) ? 'Descanso · no tocaba ningún core' :
      racha.congelados[key] ? 'Congelado 🧊 · un congelador salvó la racha' :
      (r && HABITS.some(h => r[h.id])) ? 'Parcial · ' + coreHechos + '/' + coreDia.length + ' core' :
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
  // Los IDs son inmutables (viven en reps-tema); los nombres son libres.
  const THEMES = [
    // — oscuros —
    {id:'carbon',     name:'Carbón',     vars:{bg:'#12161d', card:'#1a2029', card2:'#20262f', line:'#2a3340', text:'#e9edf3', muted:'#8b95a3', accent:'#ffb454', onAccent:'#191204', teal:'#4fd6be'}},
    {id:'oceano',     name:'Océano',     vars:{bg:'#0d141f', card:'#141d2b', card2:'#1a2536', line:'#243349', text:'#e8eef6', muted:'#8b98ab', accent:'#6ab8ff', onAccent:'#04182b', teal:'#57dbb1'}},
    {id:'medianoche', name:'Medianoche', vars:{bg:'#0a0e18', card:'#121828', card2:'#182034', line:'#232e48', text:'#e8edf8', muted:'#8a94ab', accent:'#4f8cff', onAccent:'#041028', teal:'#7dd3ff'}},
    {id:'atardecer',  name:'Atardecer',  vars:{bg:'#1a1210', card:'#251a17', card2:'#2f211d', line:'#443029', text:'#f5ece7', muted:'#a89388', accent:'#ff7e5f', onAccent:'#2b0f06', teal:'#ffd166'}},
    {id:'cafe',       name:'Café',       vars:{bg:'#16110d', card:'#201812', card2:'#2a2018', line:'#3c2f23', text:'#f0e8de', muted:'#a09384', accent:'#d7b899', onAccent:'#241505', teal:'#8fbf9f'}},
    {id:'sakura',     name:'Sakura',     vars:{bg:'#171019', card:'#211826', card2:'#2a1f31', line:'#3b2c46', text:'#f4ecf4', muted:'#a391a8', accent:'#ff9ec7', onAccent:'#2b0a1c', teal:'#b6f0d0'}},
    {id:'bosque',     name:'Bosque',     vars:{bg:'#0f1613', card:'#16201b', card2:'#1c2822', line:'#28382f', text:'#e9f2ec', muted:'#8fa398', accent:'#7fd88f', onAccent:'#08210d', teal:'#ffd166'}},
    {id:'cereza',     name:'Cereza',     vars:{bg:'#140d10', card:'#1e1418', card2:'#281a1f', line:'#3a262e', text:'#f6eaee', muted:'#a68f97', accent:'#ff6b81', onAccent:'#2a060e', teal:'#7dd3ff'}},
    {id:'esmeralda',  name:'Esmeralda',  vars:{bg:'#0a1410', card:'#102019', card2:'#152a21', line:'#223c30', text:'#e9f5ef', muted:'#8aa598', accent:'#3ddc97', onAccent:'#032015', teal:'#ffd166'}},
    {id:'oxido',      name:'Óxido',      vars:{bg:'#14100e', card:'#1e1815', card2:'#28201b', line:'#3b2f26', text:'#f2ebe5', muted:'#a3948a', accent:'#e2725b', onAccent:'#260b04', teal:'#9cc5a1'}},
    {id:'violeta',    name:'Violeta',    vars:{bg:'#131020', card:'#1a1629', card2:'#211c34', line:'#2f2847', text:'#ece9f6', muted:'#968fae', accent:'#b795ff', onAccent:'#160b2b', teal:'#ff8ad8'}},
    {id:'terminal',   name:'Terminal',   vars:{bg:'#050805', card:'#0c120c', card2:'#111a11', line:'#1e3320', text:'#d8f2d8', muted:'#6f9873', accent:'#33ff66', onAccent:'#02180a', teal:'#ffb454'}},
    {id:'synthwave',  name:'Synthwave',  vars:{bg:'#120c22', card:'#1a1230', card2:'#221840', line:'#35255c', text:'#efe9fb', muted:'#9d8fc0', accent:'#ff3ec8', onAccent:'#2b0320', teal:'#22d3ee'}},
    {id:'cristal',    name:'Hielo negro', vars:{bg:'#0b1220', card:'#141d30', card2:'#1a2540', line:'#2a3a5c', text:'#eaf1ff', muted:'#8fa0bd', accent:'#7dd3ff', onAccent:'#04263a', teal:'#b795ff'}},
    {id:'dorado',     name:'Dorado',     vars:{bg:'#0f0d08', card:'#1a160e', card2:'#232013', line:'#383418', text:'#f4efe2', muted:'#a49b7f', accent:'#e6c26e', onAccent:'#241a02', teal:'#9fd8cb'}},
    // — claros —
    {id:'claro',      name:'Claro',      vars:{bg:'#f2f4f7', card:'#ffffff', card2:'#e9edf2', line:'#d4dae2', text:'#1a2230', muted:'#66717f', accent:'#c76a04', onAccent:'#ffffff', teal:'#0c8a70'}},
    {id:'hielo',      name:'Hielo',      vars:{bg:'#eef4f8', card:'#ffffff', card2:'#e2ecf3', line:'#cfdde8', text:'#14222e', muted:'#5d7181', accent:'#1273b8', onAccent:'#ffffff', teal:'#0c8a70'}},
    {id:'matcha',     name:'Matcha',     vars:{bg:'#f3f2ea', card:'#ffffff', card2:'#eaeadd', line:'#d6d6c2', text:'#232a1e', muted:'#6f7a63', accent:'#5c8a3a', onAccent:'#ffffff', teal:'#b3593d'}},
    {id:'lavanda',    name:'Lavanda',    vars:{bg:'#f3f0f9', card:'#ffffff', card2:'#eae5f4', line:'#d8d0e8', text:'#241f33', muted:'#6f6885', accent:'#7c5cd6', onAccent:'#ffffff', teal:'#c2508f'}},
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
  // desbloqueables: cada tema se gana con días ganados totales. Los tonos
  // se derivan del stats, sin clave extra. (Carbón y Océano siempre libres.)
  const THEME_UNLOCK = {
    carbon:0, oceano:0, medianoche:0, atardecer:0,   // libres desde el día 0
    cafe:1, sakura:2, bosque:3, cereza:4, esmeralda:5, oxido:6,
    claro:7, hielo:8, matcha:10, lavanda:12,
    violeta:15, terminal:20, synthwave:25, cristal:30,
    dorado:40,                                        // el de prestigio
  };
  function renderThemeUI(){
    const list = $('themeList'); list.innerHTML = '';
    const ganados = statsData().total;
    THEMES.forEach(t => {
      const need = THEME_UNLOCK[t.id] || 0;
      const locked = ganados < need;
      const b = document.createElement('button');
      b.className = 'swatch' + (themeSel.modo === 'preset' && themeSel.id === t.id ? ' active' : '') + (locked ? ' locked' : '');
      b.innerHTML =
        '<span class="s-dots">' +
          '<span class="s-dot" style="background:' + t.vars.bg + '"></span>' +
          '<span class="s-dot" style="background:' + t.vars.accent + '"></span>' +
        '</span><span class="s-name">' + t.name + '</span>' +
        (locked ? '<span class="s-lock">🔒' + need + '</span>' : '<span class="s-check">✓</span>');
      b.addEventListener('click', ()=>{
        if(locked){ toast('Se desbloquea a los ' + need + ' días ganados. Vas ' + ganados + '.'); return; }
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

  $('themeBtn').addEventListener('click', ()=>{ renderThemeUI(); $('sonidoToggle').checked = focoSonido; $('themeWrap').hidden = false; });
  $('sonidoToggle').addEventListener('change', ()=>{
    focoSonido = $('sonidoToggle').checked; saveSonido();
    if(focoSonido) sonarCheck(); // pequeña confirmación al encender
  });
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
  const FXS = ['ninguno', 'glass', 'clay', 'neon'];
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
    document.body.classList.toggle('fx-neon', fx === 'neon');
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

      // Plan B: la versión mínima para días difíciles (opcional)
      const planb = document.createElement('input');
      planb.type = 'text'; planb.className = 'hab-hint'; planb.value = h.planB || ''; planb.maxLength = 60;
      planb.placeholder = '🅱️ Plan B: el mínimo en un mal día';
      planb.setAttribute('aria-label', 'Plan B del hábito');
      planb.addEventListener('input', ()=>{ h.planB = planb.value; saveHabitos(); render(); });

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

      // selector de días: 7 chips (L M M J V S D). Todos activos = 'all'.
      const daysRow = document.createElement('div'); daysRow.className = 'hab-days';
      const etiquetas = ['L','M','M','J','V','S','D']; // lunes..domingo (visual)
      const dowReal = [1,2,3,4,5,6,0];                 // su día de semana real
      etiquetas.forEach((et, idx) => {
        const dw = dowReal[idx];
        const activo = habAplica(h, dw);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'hab-day' + (activo ? ' on' : '');
        chip.textContent = et;
        chip.setAttribute('aria-label', 'Día ' + et + (activo ? ' activo' : ''));
        chip.addEventListener('click', ()=>{
          // set actual de días activos (0-6)
          const set = new Set(h.days === 'all' ? [0,1,2,3,4,5,6] : h.days);
          if(set.has(dw)) set.delete(dw); else set.add(dw);
          if(set.size === 0){ toast('Deja al menos un día.'); return; }
          h.days = sanearDays([...set]); // 7 días → 'all'
          saveHabitos(); render(); renderHabEditor();
        });
        daysRow.appendChild(chip);
      });

      row.append(top, hint, planb, daysRow);
      list.appendChild(row);
    });
  }

  $('editHabBtn').addEventListener('click', ()=>{ renderHabEditor(); $('habWrap').hidden = false; });
  $('habClose').addEventListener('click', ()=>{ $('habWrap').hidden = true; });
  $('habWrap').addEventListener('click', (e)=>{ if(e.target === $('habWrap')) $('habWrap').hidden = true; });
  $('habAdd').addEventListener('click', ()=>{
    if(HABITS.length >= MAX_HABITS){ toast('Máximo ' + MAX_HABITS + ' hábitos.'); return; }
    HABITS.push({ id: nuevoHabId(), name: 'Nuevo hábito', hint: '', core: false, days: 'all', planB: '' }); // nace como extra, todos los días
    rebuildCore(); saveHabitos(); render(); renderHabEditor();
  });

  // ===== Metas (corto / mediano / largo plazo) =====
  const METAS_KEY = 'reps-metas';
  const PLAZOS = [
    {id:'corto',   name:'Corto plazo',   sub:'semanas'},
    {id:'mediano', name:'Mediano plazo', sub:'meses'},
    {id:'largo',   name:'Largo plazo',   sub:'el año o más'},
  ];
  let metas = [];
  let metaPlazoSel = 'corto';

  function loadMetas(){
    try{
      const v = JSON.parse(localStorage.getItem(METAS_KEY));
      if(Array.isArray(v)){
        metas = v.filter(m => m && typeof m.texto === 'string' && m.texto.trim()).map(m => ({
          id: typeof m.id === 'string' ? m.id : 'm' + Math.random().toString(36).slice(2,8),
          texto: m.texto.trim(),
          plazo: ['corto','mediano','largo'].includes(m.plazo) ? m.plazo : 'corto',
          hecha: !!m.hecha,
          creada: m.creada || new Date().toISOString(),
        }));
      }
    }catch(e){ metas = []; }
  }
  function saveMetas(){
    try{ localStorage.setItem(METAS_KEY, JSON.stringify(metas)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  function addMeta(texto, plazo){
    metas.unshift({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,5), texto, plazo, hecha:false, creada:new Date().toISOString() });
    saveMetas(); renderMetas();
  }

  function renderMetas(){
    const hechas = metas.filter(m => m.hecha).length;
    $('metasTag').textContent = metas.length ? (hechas + '/' + metas.length + ' cumplidas') : '';

    const list = $('metasList'); list.innerHTML = '';
    if(metas.length === 0){
      const e = document.createElement('div'); e.className = 'meta-empty';
      e.textContent = 'Aún no tienes metas. Escribe una arriba 👆 — un norte le da sentido a los días.';
      list.appendChild(e);
      return;
    }
    PLAZOS.forEach(p => {
      const grupo = metas.filter(m => m.plazo === p.id);
      if(!grupo.length) return;
      const done = grupo.filter(m => m.hecha).length;

      const g = document.createElement('div'); g.className = 'meta-group';
      const head = document.createElement('div'); head.className = 'mg-head';
      const t = document.createElement('span'); t.className = 'mg-t'; t.textContent = p.name;
      const n = document.createElement('span'); n.className = 'mg-n'; n.textContent = done + '/' + grupo.length;
      head.append(t, n);
      const bar = document.createElement('div'); bar.className = 'mg-bar';
      const fill = document.createElement('i'); fill.style.width = Math.round(done/grupo.length*100) + '%';
      bar.appendChild(fill);
      g.append(head, bar);

      grupo.forEach(m => {
        const row = document.createElement('div'); row.className = 'meta' + (m.hecha ? ' done' : '');
        const main = document.createElement('button');
        main.className = 'm-main'; main.setAttribute('aria-pressed', m.hecha);
        const box = document.createElement('span'); box.className = 'm-box'; box.textContent = '✓';
        const txt = document.createElement('span'); txt.className = 'm-text'; txt.textContent = m.texto;
        main.append(box, txt);
        main.addEventListener('click', ()=>{
          m.hecha = !m.hecha; saveMetas(); renderMetas();
          if(m.hecha){
            (p.id === 'largo' ? sonarGanado : sonarCheck)();
            toast(p.id === 'largo' ? '🏆 ¡Meta grande cumplida! Enorme.' : '🎯 ¡Meta cumplida!');
          }
        });
        const del = document.createElement('button');
        del.className = 'm-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar meta');
        del.addEventListener('click', ()=>{
          metas = metas.filter(x => x.id !== m.id); saveMetas(); renderMetas();
          toast('Meta borrada.');
        });
        row.append(main, del);
        g.appendChild(row);
      });
      list.appendChild(g);
    });
  }

  document.querySelectorAll('.meta-plazo').forEach(b => b.addEventListener('click', ()=>{
    metaPlazoSel = b.dataset.plazo;
    document.querySelectorAll('.meta-plazo').forEach(x => x.classList.toggle('on', x === b));
  }));
  function capturarMeta(){
    const t = $('metaInput').value.trim();
    if(!t) return;
    addMeta(t, metaPlazoSel);
    $('metaInput').value = '';
    toast('Meta agregada. A por ella.');
  }
  $('metaAdd').addEventListener('click', capturarMeta);
  $('metaInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); capturarMeta(); } });

  // ===== Temporizador de foco (estilo Forest) =====
  const FOCO_KEY = 'reps-foco';
  let focoTotal = 0; // minutos enfocados acumulados (solo crecen)
  let foco = { habitId:null, habitName:'', min:25, endTime:0, totalSec:0, timer:null, wakeLock:null };

  function loadFoco(){
    try{ const v = parseInt(localStorage.getItem(FOCO_KEY), 10); if(v >= 0) focoTotal = v; }
    catch(e){ focoTotal = 0; }
  }
  function saveFoco(){ try{ localStorage.setItem(FOCO_KEY, String(focoTotal)); }catch(e){} }

  // preferencia de sonido al terminar (por defecto encendido)
  const SONIDO_KEY = 'reps-foco-sonido';
  let focoSonido = true;
  function loadSonido(){ try{ focoSonido = localStorage.getItem(SONIDO_KEY) !== '0'; }catch(e){ focoSonido = true; } }
  function saveSonido(){ try{ if(focoSonido) localStorage.removeItem(SONIDO_KEY); else localStorage.setItem(SONIDO_KEY, '0'); }catch(e){} }

  // sonido sintetizado con Web Audio (sin archivos: offline eterno). El
  // AudioContext se "desbloquea" en el gesto de Empezar para que suene
  // después, cuando el temporizador llega a 0 sin que toques nada.
  let audioCtx = null;
  function unlockAudio(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume();
    }catch(e){}
  }
  function tono(freq, start, dur, vol){
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sonarFin(){
    try{ if(navigator.vibrate) navigator.vibrate([120, 60, 120]); }catch(e){}
    if(!focoSonido) return;
    try{
      unlockAudio();
      if(!audioCtx) return;
      // campanita: arpegio cálido ascendente (Do–Mi–Sol)
      tono(523.25, 0,    0.55, 0.28);
      tono(659.25, 0.13, 0.55, 0.24);
      tono(783.99, 0.26, 0.80, 0.22);
    }catch(e){}
  }
  // pop corto y satisfactorio al marcar algo como hecho (hábito, meta, idea)
  function sonarCheck(){
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
    if(!focoSonido) return;
    try{
      unlockAudio(); if(!audioCtx) return;
      tono(660, 0,    0.09, 0.20);
      tono(990, 0.05, 0.11, 0.16);
    }catch(e){}
  }
  // pequeño fanfarrón al GANAR el día (los 3 core listos) o cumplir meta grande
  function sonarGanado(){
    try{ if(navigator.vibrate) navigator.vibrate([40, 50, 90]); }catch(e){}
    if(!focoSonido) return;
    try{
      unlockAudio(); if(!audioCtx) return;
      tono(659.25, 0,    0.18, 0.24);
      tono(783.99, 0.09, 0.18, 0.24);
      tono(1046.5, 0.18, 0.40, 0.22);
    }catch(e){}
  }

  async function pedirWakeLock(){
    try{ if('wakeLock' in navigator) foco.wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
  }
  function soltarWakeLock(){
    try{ if(foco.wakeLock){ foco.wakeLock.release(); foco.wakeLock = null; } }catch(e){}
  }

  function pintarSonidoBtn(){
    const b = $('focoSonidoBtn');
    b.classList.toggle('off', !focoSonido);
    b.textContent = focoSonido ? '🔊 Sonido al terminar' : '🔇 Sin sonido';
  }
  function abrirFoco(habitId, habitName){
    foco.habitId = habitId; foco.habitName = habitName; foco.min = 25;
    $('focoHab').textContent = '🎯 ' + habitName;
    document.querySelectorAll('.foco-dur').forEach(b => b.classList.toggle('on', b.dataset.min === '25'));
    pintarSonidoBtn();
    $('focoSetup').hidden = false; $('focoRun').hidden = true;
    $('foco').hidden = false;
  }
  function cerrarFoco(){
    if(foco.timer){ clearInterval(foco.timer); foco.timer = null; }
    soltarWakeLock();
    $('foco').hidden = true;
  }
  function pintarFoco(){
    const left = Math.max(0, Math.round((foco.endTime - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    $('focoTime').textContent = mm + ':' + ss;
    const pct = foco.totalSec ? (foco.totalSec - left) / foco.totalSec * 100 : 0;
    $('focoRing').style.setProperty('--p', pct.toFixed(1) + '%');
    if(left <= 0){ completarFoco(true); }
  }
  function empezarFoco(){
    unlockAudio(); // gesto del usuario: deja el audio listo para sonar al final
    foco.totalSec = foco.min * 60;
    foco.endTime = Date.now() + foco.totalSec * 1000; // por reloj real: sobrevive al throttle en segundo plano
    $('focoSetup').hidden = true; $('focoRun').hidden = false;
    pintarFoco();
    foco.timer = setInterval(pintarFoco, 1000);
    pedirWakeLock();
  }
  // completar: full = llegó a 0; si no, cuenta los minutos transcurridos
  function completarFoco(full){
    if(full) sonarFin(); // el ciclo llegó a 0: campanita + vibración
    const transcurridos = full ? foco.min : Math.max(1, Math.round((foco.totalSec - Math.max(0, (foco.endTime - Date.now())/1000)) / 60));
    focoTotal += transcurridos; saveFoco();
    // marca el hábito hecho hoy (misma lógica que el clic normal, fecha fresca)
    const k = today(); const cur = dias[k] || {}; const wasWon = isWon(cur, k);
    cur[foco.habitId] = true; dias[k] = cur; save();
    cerrarFoco();
    render();
    if(!wasWon && isWon(cur, k)) toast('Día ganado. Una rep más. 🔥');
    else toast('🎯 ' + transcurridos + ' min de foco. Bien hecho.');
  }
  // re-pide el wake lock al volver a la app (el sistema lo suelta al ocultar)
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && foco.timer && !foco.wakeLock) pedirWakeLock();
  });
  document.querySelectorAll('.foco-dur').forEach(b => b.addEventListener('click', ()=>{
    foco.min = parseInt(b.dataset.min, 10);
    document.querySelectorAll('.foco-dur').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('focoSonidoBtn').addEventListener('click', ()=>{
    focoSonido = !focoSonido; saveSonido(); pintarSonidoBtn();
    if(focoSonido){ unlockAudio(); sonarFin(); } // preescucha al encender
  });
  $('focoStart').addEventListener('click', empezarFoco);
  $('focoCancelSetup').addEventListener('click', cerrarFoco);
  $('focoCancel').addEventListener('click', cerrarFoco);
  $('focoDone').addEventListener('click', ()=> completarFoco(false));

  // ===== Bienvenida: cuestionario que moldea los hábitos al usuario =====
  // 100% local: construye un perfil y una lista de hábitos a la medida.
  // (El perfil será, en la fase 2, el contexto que la IA use para conocerte.)
  const PERFIL_KEY = 'reps-perfil';
  let perfil = null;
  function loadPerfil(){
    try{ const v = JSON.parse(localStorage.getItem(PERFIL_KEY)); if(esMapa(v)) perfil = v; }
    catch(e){ perfil = null; }
  }
  function savePerfil(){
    try{ localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil)); }catch(e){}
  }
  function aplicarNombre(){
    let n = null;
    if(perfil && typeof perfil.nombre === 'string' && perfil.nombre.trim()) n = perfil.nombre.trim();
    else if(!perfil) n = 'Luis Fernando'; // instalación previa al perfil
    $('eyebrow').textContent = 'Sistema diario' + (n ? ' · ' + n : '');
  }

  // catálogo: cada área elegida aporta uno o dos hábitos sugeridos
  const ONB_AREAS = [
    {id:'cuerpo',   emoji:'💪', name:'Mi cuerpo',      hab:{name:'Moverte 20 min', hint:'Caminar, correr, lo que sea', core:true}, extra:{name:'Calistenia 5 min', hint:'Lagartijas, sentadillas', core:false}},
    {id:'aprender', emoji:'🧠', name:'Aprender algo',  hab:{name:'Aprender 30 min', hint:'Idioma, curso, leer', core:true}},
    {id:'proyecto', emoji:'🎯', name:'Un proyecto',    hab:{name:'Bloque de proyecto', hint:'Mínimo 1 hr, sin distracciones', core:true}},
    {id:'calma',    emoji:'🧘', name:'Calma mental',   hab:{name:'Respirar 5 min', hint:'Meditar o solo respirar', core:false}},
    {id:'pantalla', emoji:'📵', name:'Menos pantalla', hab:{name:'Comida sin celular', hint:'Presencia, no scroll', core:false}},
    {id:'dormir',   emoji:'😴', name:'Dormir mejor',   hab:{name:'Leer 15 min + dormir', hint:'Celular lejos de la cama', core:true}},
  ];
  const ONB_DESPERTAR = [
    {id:'temprano', emoji:'🌅', name:'Temprano', sub:'antes de las 7', hora:'6:30'},
    {id:'media',    emoji:'☀️', name:'Media mañana', sub:'7 a 9', hora:'8:00'},
    {id:'tarde',    emoji:'🌤️', name:'Más tarde', sub:'después de 9', hora:'10:00'},
    {id:'variable', emoji:'🔀', name:'Variable', sub:'cambia mucho', hora:''},
  ];
  const ONB_TIEMPO = [
    {id:'poco',     emoji:'⏳', name:'Poco', sub:'empiezo chiquito', core:2},
    {id:'medio',    emoji:'⏱️', name:'Algo', sub:'un rato al día', core:3},
    {id:'bastante', emoji:'🕰️', name:'Bastante', sub:'quiero exigirme', core:4},
  ];

  function generarHabitos(d){
    const nid = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    const out = [];
    const desp = ONB_DESPERTAR.find(x => x.id === d.despertar);
    out.push({id:nid(), name:'Despertar' + (desp && desp.hora ? ' ' + desp.hora : ''), hint:'Pies al piso, sin snooze', core:true, days:'all'});
    (d.construir || []).forEach(aid => {
      const a = ONB_AREAS.find(x => x.id === aid); if(!a) return;
      if(a.hab)   out.push({id:nid(), name:a.hab.name,   hint:a.hab.hint,   core:a.hab.core,   days:'all'});
      if(a.extra) out.push({id:nid(), name:a.extra.name, hint:a.extra.hint, core:a.extra.core, days:'all'});
    });
    let list = out.slice(0, MAX_HABITS);
    // ajustar core al tiempo disponible (2/3/4), respetando 2..4
    const maxCore = (ONB_TIEMPO.find(x => x.id === d.tiempo) || {core:3}).core;
    let cores = list.filter(h => h.core);
    if(cores.length > maxCore) cores.slice(maxCore).forEach(h => h.core = false);
    cores = list.filter(h => h.core);
    if(cores.length < MIN_CORE){
      list.filter(h => !h.core).slice(0, MIN_CORE - cores.length).forEach(h => h.core = true);
    }
    if(list.length < 2) list.push({id:nid(), name:'Cama tendida', hint:'Un ancla fácil', core:false, days:'all'});
    return sanearHabitos(list) || HABITS_DEFAULT.map(h => Object.assign({}, h));
  }

  // --- el asistente paso a paso ---
  let onb = null;
  const ONB_PASOS = 6; // 0 intro · 1 nombre · 2 despertar · 3 construir · 4 tiempo · 5 preview
  function abrirBienvenida(){
    onb = { step:0, nombre:'', despertar:null, construir:[], tiempo:null };
    $('welcome').hidden = false;
    renderOnb();
  }
  function opBtn(label, sub, activo, onClick){
    const b = document.createElement('button');
    b.className = 'wel-op' + (activo ? ' on' : '');
    b.type = 'button';
    const t = document.createElement('div'); t.className = 'wo-t'; t.textContent = label; b.appendChild(t);
    if(sub){ const s = document.createElement('div'); s.className = 'wo-s'; s.textContent = sub; b.appendChild(s); }
    b.addEventListener('click', onClick);
    return b;
  }
  function renderOnb(){
    const body = $('welBody'); body.innerHTML = '';
    const next = $('welNext'), back = $('welBack');
    back.hidden = onb.step === 0;
    next.hidden = false; next.disabled = false; next.textContent = 'Siguiente ›';

    // puntos de progreso
    const dots = $('welDots'); dots.innerHTML = '';
    for(let i = 0; i < ONB_PASOS; i++){
      const d = document.createElement('span'); d.className = 'wd' + (i === onb.step ? ' on' : '');
      dots.appendChild(d);
    }

    const title = (t, s) => {
      const h = document.createElement('div'); h.className = 'wel-title'; h.textContent = t; body.appendChild(h);
      if(s){ const p = document.createElement('div'); p.className = 'wel-sub'; p.textContent = s; body.appendChild(p); }
    };
    const grid = () => { const g = document.createElement('div'); g.className = 'wel-grid'; body.appendChild(g); return g; };

    if(onb.step === 0){
      const logo = document.createElement('div'); logo.className = 'wel-logo'; logo.innerHTML = 'REPS<span>.</span>'; body.appendChild(logo);
      title('Vamos a armar tu sistema', 'Unas preguntas rápidas y la app se adapta a ti. Nada invasivo — en un minuto estás listo.');
      next.textContent = 'Empezar ›';
      const skip = document.createElement('button');
      skip.className = 'wel-skip'; skip.type = 'button'; skip.textContent = 'Prefiero usar el de ejemplo';
      skip.addEventListener('click', saltarBienvenida);
      body.appendChild(skip);
    }
    else if(onb.step === 1){
      title('¿Cómo te llamas?', 'Solo para saludarte. Puedes dejarlo en blanco.');
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'wel-input'; inp.maxLength = 20; inp.placeholder = 'Tu nombre';
      inp.value = onb.nombre;
      inp.addEventListener('input', ()=> onb.nombre = inp.value);
      body.appendChild(inp);
    }
    else if(onb.step === 2){
      title('¿A qué hora despiertas?', 'Tu primer innegociable se ajusta a esto.');
      const g = grid();
      ONB_DESPERTAR.forEach(o => g.appendChild(opBtn(o.emoji + ' ' + o.name, o.sub, onb.despertar === o.id, ()=>{
        onb.despertar = o.id; onb.step++; renderOnb();
      })));
      next.hidden = true; // se avanza al elegir
    }
    else if(onb.step === 3){
      title('¿Qué quieres construir?', 'Elige 1 a 3. La app arma tus hábitos con esto.');
      const g = grid();
      ONB_AREAS.forEach(o => g.appendChild(opBtn(o.emoji + ' ' + o.name, '', onb.construir.includes(o.id), ()=>{
        if(onb.construir.includes(o.id)) onb.construir = onb.construir.filter(x => x !== o.id);
        else if(onb.construir.length < 3) onb.construir.push(o.id);
        else { toast('Máximo 3 por ahora. Menos es más.'); return; }
        renderOnb();
      })));
      next.disabled = onb.construir.length === 0;
    }
    else if(onb.step === 4){
      title('¿Cuánto tiempo real tienes?', 'Define cuántos innegociables al día.');
      const g = grid();
      ONB_TIEMPO.forEach(o => g.appendChild(opBtn(o.emoji + ' ' + o.name, o.sub, onb.tiempo === o.id, ()=>{
        onb.tiempo = o.id; onb.step++; renderOnb();
      })));
      next.hidden = true;
    }
    else if(onb.step === 5){
      const habs = generarHabitos(onb);
      title('Tu sistema', 'Así queda. Podrás editarlo cuando quieras.');
      const lista = document.createElement('div'); lista.className = 'wel-preview';
      habs.forEach(h => {
        const row = document.createElement('div'); row.className = 'wp-prev-row';
        const nm = document.createElement('span'); nm.textContent = h.name;
        row.appendChild(nm);
        if(h.core){ const c = document.createElement('span'); c.className = 'wp-core'; c.textContent = 'CORE'; row.appendChild(c); }
        lista.appendChild(row);
      });
      body.appendChild(lista);
      next.textContent = 'Empezar mi sistema 🔥';
    }
  }
  function saltarBienvenida(){
    perfil = { saltado:true, creado:new Date().toISOString() };
    savePerfil();
    aplicarNombre();
    $('welcome').hidden = true;
  }
  function finalizarBienvenida(){
    // confirma solo si hay historial REAL (un registro de hoy vacío no cuenta)
    const tieneHistorial = Object.keys(dias).some(k => dias[k] && Object.keys(dias[k]).length > 0);
    if(tieneHistorial){
      if(!confirm('Esto reemplazará tus hábitos actuales por los nuevos. Tu historial de días se conserva. ¿Continuar?')) return;
    }
    perfil = { nombre: onb.nombre.trim(), despertar: onb.despertar, construir: onb.construir, tiempo: onb.tiempo, creado: new Date().toISOString() };
    savePerfil();
    HABITS = generarHabitos(onb); rebuildCore(); saveHabitos();
    aplicarNombre();
    $('welcome').hidden = true;
    render();
    toast('¡Tu sistema está listo! A ganar el día. 🔥');
  }
  $('welNext').addEventListener('click', ()=>{
    if(onb.step === 5){ finalizarBienvenida(); return; }
    onb.step++; renderOnb();
  });
  $('welBack').addEventListener('click', ()=>{ if(onb.step > 0){ onb.step--; renderOnb(); } });
  $('welcome').addEventListener('click', (e)=>{ /* fondo no cierra: es un flujo */ });
  $('rehacerBienvenida').addEventListener('click', ()=>{ $('themeWrap').hidden = true; abrirBienvenida(); });

  // Escape siempre cierra las hojas de Ajustes y del editor (vía de escape
  // extra; la bienvenida no, porque es un flujo con su propio botón)
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      $('themeWrap').hidden = true;
      $('habWrap').hidden = true;
    }
  });

  // ===== Esquema y migraciones =====
  // reps-schema versiona el FORMATO de los datos (no confundir con la
  // versión del cache en sw.js, que versiona los archivos de la app).
  const SCHEMA_KEY = 'reps-schema';
  const SCHEMA = 6; // versión de formato que esta app espera
  // incluye 'reps-compacto' (clave retirada en v3) para que el respaldo
  // pre-migración también la proteja
  const DATA_KEYS = ['reps-dias', 'reps-bandeja', 'reps-cierres', 'reps-semana', 'reps-cierre-semana', 'reps-tema', 'reps-distribucion', 'reps-efecto', 'reps-racha', 'reps-habitos', 'reps-caidas', 'reps-hitos', 'reps-perfil', 'reps-foco', 'reps-foco-sonido', 'reps-metas', 'reps-compacto'];

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

    // v5 → v6: los hábitos ganan el campo "days". Los existentes pasan a
    // 'all' (todos los días) para conservar exactamente el comportamiento.
    5: function(){
      try{
        const hs = JSON.parse(localStorage.getItem('reps-habitos'));
        if(Array.isArray(hs)){
          hs.forEach(h => { if(h && h.days === undefined) h.days = 'all'; });
          localStorage.setItem('reps-habitos', JSON.stringify(hs));
        }
      }catch(e){ /* si está ilegible, loadHabitos caerá a fábrica */ }
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
      data: { 'reps-dias': dias, 'reps-bandeja': ideas, 'reps-cierres': cierres, 'reps-tema': themeSel, 'reps-semana': semana, 'reps-cierre-semana': cierreSemana, 'reps-distribucion': dist, 'reps-efecto': fx, 'reps-racha': racha, 'reps-habitos': HABITS, 'reps-caidas': caidas, 'reps-hitos': hitosVistos, 'reps-perfil': perfil, 'reps-foco': focoTotal, 'reps-foco-sonido': focoSonido, 'reps-metas': metas },
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
        const cd = b.data['reps-caidas'];
        if(esMapa(cd)) localStorage.setItem(CAIDAS_KEY, JSON.stringify(cd));
        else localStorage.removeItem(CAIDAS_KEY);
        const ht = b.data['reps-hitos'];
        if(Array.isArray(ht)) localStorage.setItem(HITOS_KEY, JSON.stringify(ht));
        else localStorage.removeItem(HITOS_KEY);
        const cs = b.data['reps-cierre-semana'];
        if(esMapa(cs)) localStorage.setItem(CIERRE_SEM_KEY, JSON.stringify(cs));
        else localStorage.removeItem(CIERRE_SEM_KEY);
        const pf = b.data['reps-perfil'];
        if(esMapa(pf)) localStorage.setItem(PERFIL_KEY, JSON.stringify(pf));
        else localStorage.removeItem(PERFIL_KEY);
        const fo = parseInt(b.data['reps-foco'], 10);
        if(fo >= 0) localStorage.setItem(FOCO_KEY, String(fo));
        else localStorage.removeItem(FOCO_KEY);
        const mt = b.data['reps-metas'];
        if(Array.isArray(mt)) localStorage.setItem(METAS_KEY, JSON.stringify(mt));
        else localStorage.removeItem(METAS_KEY);
        // sonido: solo se guarda cuando está APAGADO (ausente = encendido)
        if(b.data['reps-foco-sonido'] === false) localStorage.setItem(SONIDO_KEY, '0');
        else localStorage.removeItem(SONIDO_KEY);
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
      caidas = {}; loadCaidas();
      hitosVistos = []; loadHitos();
      cierreSemana = {}; loadCierreSemana();
      perfil = null; loadPerfil(); aplicarNombre();
      focoTotal = 0; loadFoco(); loadSonido();
      metas = []; loadMetas(); renderMetas();
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

  // instalación nueva de verdad: ni datos, ni perfil, ni hábitos guardados
  const instalacionNueva = !localStorage.getItem('reps-dias')
    && !localStorage.getItem('reps-perfil') && !localStorage.getItem('reps-habitos');

  migrate();       // ANTES que todo: los datos suben al formato actual
  loadHabitos();   // antes de load/render: la racha y las vistas usan HABITS/CORE
  loadPerfil();    // perfil del usuario (nombre para el saludo)
  aplicarNombre();
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
  loadCierreSemana(); // antes de renderSemana(): muestra el cierre de la semana
  loadRacha();     // antes de render(): la racha visible usa los congelados
  procesarRacha(); // aplica congeladores por los días transcurridos
  loadCaidas();    // antes de render(): el ritual y El Espejo leen las caídas
  loadHitos();     // antes de render(): siembra lo ya logrado sin celebrar
  loadFoco();      // antes de render(): el total de foco se muestra en Stats
  loadSonido();
  loadMetas();
  render();
  renderMetas();
  renderTray();
  renderSemana();
  fillCierreForm();
  renderPlanHoy();

  // usuario nuevo: tras la intro, abre el cuestionario de bienvenida
  if(instalacionNueva) setTimeout(abrirBienvenida, 2100);

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
