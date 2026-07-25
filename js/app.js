(function(){
  // Lista de fábrica: la migración v4→v5 siembra reps-habitos con esto.
  // Sus IDs son sagrados: el historial de reps-dias se guarda por ID.
  // days: 'all' = todos los días, o un array de días de semana (0=domingo..6=sábado)
  // Hábitos de fábrica GENÉRICOS: sirven para cualquier usuario nuevo. Cada quien
  // los edita (o los rediseña con la IA). No son datos personales de nadie.
  const HABITS_DEFAULT = [
    {id:'despertar', name:'Despertar temprano', hint:'Pies al piso, sin snooze', core:true, days:'all', planB:'levantarte, aunque sea 10 min tarde'},
    {id:'mover',     name:'Moverte 20 min', hint:'Camina, corre o estírate', core:true, days:'all', planB:'5 min de estiramiento'},
    {id:'bloque1',   name:'Bloque de enfoque', hint:'Mínimo 1 hr, celular lejos', core:true, days:'all', planB:'15 min, aunque sea empezar'},
    {id:'agua',      name:'Tomar agua', hint:'Un vaso al despertar', core:false, days:'all'},
    {id:'aprender',  name:'Aprender algo (30 min)', hint:'Leer, practicar, un curso', core:false, days:'all'},
    {id:'dormir',    name:'Dormir a buena hora', hint:'Celular a cargar lejos de la cama', core:false, days:'all', planB:'apagar pantallas 15 min antes'},
  ];
  const HABITS_KEY = 'reps-habitos';
  const MAX_HABITS = 8, MIN_CORE = 2, MAX_CORE = 4;
  let HABITS = HABITS_DEFAULT.map(h => Object.assign({}, h)); // editable en runtime
  let CORE = [];
  function rebuildCore(){ CORE = HABITS.filter(h => h.core).map(h => h.id); }
  rebuildCore();

  const KEY = 'reps-dias';
  let dias = {};
  // modo viaje/vacaciones (idea #116): días marcados como neutrales. Se
  // declara aquí arriba porque coreDelDia lo consulta desde el arranque.
  let viaje = { activo:false, dias:{} };

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
    // modo viaje/vacaciones (idea #116): un día marcado como viaje no exige
    // nada → es DESCANSO (neutral, la racha se sostiene, sin culpa).
    if(viaje && viaje.dias && viaje.dias[dateKey]) return [];
    const dow = dowDe(dateKey);
    return HABITS.filter(h => h.core && habAplica(h, dow)).map(h => h.id);
  }
  // día de DESCANSO = ese día no tiene ningún core programado (neutral)
  function esDescanso(dateKey){ return coreDelDia(dateKey).length === 0; }
  // busca un hábito por id (para leer su meta/unidad)
  function habById(id){ return HABITS.find(h => h.id === id); }
  // ¿el hábito `id` está HECHO en el registro `rec`?
  // - hábito normal: valor truthy (true)
  // - hábito con contador (meta > 0): el valor guardado (número) alcanza la meta
  // Unifica todas las comprobaciones de "hecho" para que el contador no rompa
  // isWon ni el puntaje. Progreso parcial (0 < n < meta) NO cuenta como hecho.
  function hecho(rec, id){
    if(!rec) return false;
    const v = rec[id];
    if(v == null || v === false) return false;
    const h = habById(id);
    if(h && h.meta > 0) return (Number(v) || 0) >= h.meta;
    return !!v;
  }
  // día GANADO = tiene core programado y TODOS están hechos
  function esGanado(dateKey){
    const c = coreDelDia(dateKey), rec = dias[dateKey];
    return c.length > 0 && !!rec && c.every(id => hecho(rec, id));
  }
  // isWon date-aware: con fecha usa el core de ESE día; sin fecha, todos los
  // core (compatibilidad). Un día de descanso nunca es "ganado" (es neutral).
  function isWon(rec, dateKey){
    if(!rec) return false;
    const c = dateKey ? coreDelDia(dateKey) : CORE;
    return c.length > 0 && c.every(id => hecho(rec, id));
  }
  // racha individual de un hábito: días PROGRAMADOS consecutivos en que se
  // hizo, terminando hoy. Si hoy está programado pero aún no lo haces, no
  // rompe la racha (cuenta hasta ayer). Los días no programados se saltan.
  function rachaHabito(h){
    let n = 0; const d = new Date();
    for(let i = 0; i < 400; i++){
      const key = localISO(d);
      if(habAplica(h, dowDe(key))){
        if(hecho(dias[key], h.id)) n++;
        else if(i > 0) break; // un día pasado programado y no hecho corta
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // veces que un hábito de frecuencia semanal (idea #71) se hizo en la
  // semana en curso (lunes..hoy). Cuenta días con registro "hecho".
  function frecHechaSemana(h){
    const mon = mondayOf(new Date());
    let n = 0;
    for(let i = 0; i < 7; i++){
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const k = localISO(d);
      if(k > today()) break;
      if(hecho(dias[k], h.id)) n++;
    }
    return n;
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
  // emoji opcional del hábito: cadena corta (un emoji puede ser varios code
  // points, p.ej. 👨‍👩‍👧); se recorta defensivamente sin romper la secuencia
  function sanearEmoji(v){
    return typeof v === 'string' ? v.trim().slice(0, 8) : '';
  }
  // meta numérica del hábito: entero 0..999 (0/ausente = sin contador)
  function sanearMeta(v){
    const n = parseInt(v, 10);
    return (Number.isFinite(n) && n > 0) ? Math.min(999, n) : 0;
  }
  // frecuencia semanal (idea #71): entero 1..7 = "N veces por semana" (sin
  // fijar qué días). 0/ausente = hábito diario normal. Un hábito con
  // frecSemanal NUNCA es core (no gana/pierde el día): se cuenta aparte.
  function sanearFrec(v){
    const n = parseInt(v, 10);
    return (Number.isFinite(n) && n >= 1 && n <= 7) ? n : 0;
  }
  function sanearHabitos(v){
    if(!Array.isArray(v)) return null;
    const vistos = {};
    const limpio = v
      .filter(h => h && typeof h.id === 'string' && h.id && typeof h.name === 'string' && h.name.trim())
      .filter(h => vistos[h.id] ? false : (vistos[h.id] = true)) // ids únicos
      .map(h => { const frec = sanearFrec(h.frecSemanal); return { id: h.id, name: h.name.trim(), hint: typeof h.hint === 'string' ? h.hint.trim() : '', core: frec ? false : !!h.core, days: sanearDays(h.days), planB: typeof h.planB === 'string' ? h.planB.trim() : '', emoji: sanearEmoji(h.emoji), porQue: typeof h.porQue === 'string' ? h.porQue.trim() : '', meta: sanearMeta(h.meta), unidad: typeof h.unidad === 'string' ? h.unidad.trim().slice(0, 16) : '', tras: typeof h.tras === 'string' ? h.tras.trim().slice(0, 60) : '', frecSemanal: frec }; })
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

  // ===== Racha de presencia: días seguidos haciendo AL MENOS una cosa =====
  // La racha amable: aunque no ganes el día, apareciste — y eso cuenta.
  function huboPresencia(k){
    const rec = dias[k];
    return !!rec && HABITS.some(h => rec[h.id]);
  }
  function rachaPresencia(){
    let n = 0;
    const d = new Date();
    if(!huboPresencia(today())) d.setDate(d.getDate()-1);
    while(true){
      const k = localISO(d);
      if(huboPresencia(k)) n++;
      else if(esDescanso(k) || racha.congelados[k]){ /* neutral: salta */ }
      else break;
      d.setDate(d.getDate()-1);
    }
    return n;
  }

  // ===== Empujón del día: una línea que sí te conoce =====
  // Plantillas locales según tu estado; varía con el día del mes para no
  // repetirse, pero es estable dentro del mismo día.
  function empujeDelDia(won, desc, s, caidosN){
    const pick = arr => arr[new Date().getDate() % arr.length];
    if(desc) return pick([
      'Descansar también construye.',
      'Día libre por diseño. Disfrútalo sin culpa.',
    ]);
    if(won) return pick([
      'Ya está. Lo de hoy nadie te lo quita.',
      'Un voto más por quien te estás volviendo.',
      'Día ganado. Ahora sí: cero culpa.',
    ]);
    if(caidosN >= 2) return ''; // el modo rescate ya habla
    if(s >= 7) return pick([
      'Llevas ' + s + '. Hoy la única misión es no romper la cadena.',
      'Racha de ' + s + '. Protégela con lo mínimo si hace falta.',
      s + ' días hablan por ti. Hoy solo firma uno más.',
    ]);
    if(s >= 1) return pick([
      'Día ' + (s + 1) + ' en camino. Pequeño y constante gana.',
      'La cadena apenas nace. Aliméntala hoy.',
      'Vas ' + s + '. El impulso se construye ahora.',
    ]);
    return pick([
      'Hoy es un buen día para el primer voto.',
      'No necesitas ganas, necesitas empezar. Una cosa.',
      'Empieza chiquito: el primer check jala al resto.',
    ]);
  }

  // Hoy pide: la recomendación única del día (estilo WHOOP: UNA acción, no
  // ánimo). Mira el estado y el bloque en curso para decir qué toca AHORA.
  function hoyPide(won, desc, s, caidosN, coreHoy, coreDone, bloque){
    if(desc) return '😌 Hoy pide descanso. Recupera sin culpa — tu racha te espera intacta.';
    if(won) return '🔥 Ya ganaste el día. Lo que hagas ahora es puro bonus.';
    if(caidosN >= 2) return '🌱 Hoy pide solo UNA cosa. Rompe la inercia; lo perfecto viene después.';
    const faltan = coreHoy.length - coreDone;
    if(faltan <= 0) return ''; // sin core pendiente y sin "ganado": nada que recomendar
    // si estás dentro de un bloque de estructura, ese ES el momento
    if(bloque && bloque.cur && bloque.cur.tipo === 'core')
      return '🎯 Estás en «' + bloque.cur.nombre + '». Este es el momento de tus innegociables.';
    const cuantos = faltan === 1 ? '1 innegociable' : faltan + ' innegociables';
    if(s >= 3) return '⚡ Racha de ' + s + '. Hoy pide cerrar tus ' + cuantos + ' sin falta.';
    return '✅ Hoy pide ' + cuantos + ' para que el día cuente.';
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

  // ===== Carta a tu yo perdido =====
  // Un día bueno escribes por qué empezaste. La app la guarda y SOLO la
  // muestra cuando llevas 2+ días caídos: tu propia voz, no frases ajenas.
  const CARTA_KEY = 'reps-carta';
  let carta = null; // {texto, fecha}
  function loadCarta(){
    try{
      const v = JSON.parse(localStorage.getItem(CARTA_KEY));
      if(esMapa(v) && typeof v.texto === 'string' && v.texto.trim()) carta = v;
      else carta = null;
    }catch(e){ carta = null; }
  }
  function saveCarta(){
    try{
      if(carta) localStorage.setItem(CARTA_KEY, JSON.stringify(carta));
      else localStorage.removeItem(CARTA_KEY);
    }catch(e){}
  }
  function renderCarta(){
    const visible = !$('rescate').hidden && !!carta;
    $('rsCarta').hidden = !visible;
    if(visible){
      const f = new Date(carta.fecha + 'T12:00:00').toLocaleDateString('es-MX', {day:'numeric', month:'long'});
      $('rsCartaDe').textContent = '💌 De tu yo del ' + f + ':';
      $('rsCartaTxt').textContent = '«' + carta.texto + '»';
    }
  }
  function abrirCarta(){
    $('cartaTxt').value = carta ? carta.texto : '';
    $('cartaWrap').hidden = false;
  }
  $('cartaClose').addEventListener('click', ()=>{ $('cartaWrap').hidden = true; });
  $('cartaWrap').addEventListener('click', (e)=>{ if(e.target === $('cartaWrap')) $('cartaWrap').hidden = true; });
  $('cartaSave').addEventListener('click', ()=>{
    const t = $('cartaTxt').value.trim();
    carta = t ? { texto: t, fecha: today() } : null;
    saveCarta();
    $('cartaWrap').hidden = true;
    render();
    toast(t ? '💌 Guardada. Ojalá no haga falta pronto.' : 'Carta borrada.');
  });

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
    const num = h.meta > 0;                // hábito con contador
    const cnt = Number(rec[h.id]) || 0;    // progreso de hoy
    const done = hecho(rec, h.id);
    const b = document.createElement('button');
    b.className = 'habit' + (done?' done':'') + (num?' has-count':'');
    b.setAttribute('aria-pressed', done);
    // textContent (no innerHTML): el nombre y la pista son texto del usuario
    const check = document.createElement('span');
    check.className = 'check'; check.setAttribute('aria-hidden','true');
    // en un hábito con contador el "check" muestra el número (o ✓ al llegar)
    check.textContent = num ? (done ? '✓' : String(cnt)) : '✓';
    const body = document.createElement('span'); body.className = 'h-body';
    const name = document.createElement('span'); name.className = 'h-name';
    // emoji propio del hábito (opcional): antecede al nombre
    if(h.emoji){ const em = document.createElement('span'); em.className = 'h-emoji'; em.textContent = h.emoji; name.appendChild(em); }
    name.appendChild(document.createTextNode(h.name));
    // racha individual del hábito (🔥N), visible desde 2 días seguidos
    const rh = rachaHabito(h);
    if(rh >= 2){
      const st = document.createElement('span'); st.className = 'h-streak'; st.textContent = '🔥' + rh;
      st.setAttribute('role', 'button'); st.setAttribute('tabindex', '0');
      st.setAttribute('aria-label', 'Ver la cadena de ' + h.name);
      const verCad = (e)=>{ e.stopPropagation(); e.preventDefault(); abrirCadena(h.id); };
      st.addEventListener('click', verCad);
      st.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') verCad(e); });
      name.appendChild(st);
    }
    body.appendChild(name);
    // contador: "3 / 8 vasos" bajo el nombre
    if(num){
      const cd = document.createElement('div'); cd.className = 'h-count';
      cd.textContent = cnt + ' / ' + h.meta + (h.unidad ? ' ' + h.unidad : '');
      body.appendChild(cd);
    }
    // frecuencia semanal (idea #71): "2 / 3 esta semana"
    if(h.frecSemanal > 0){
      const fh = frecHechaSemana(h);
      const fd = document.createElement('div'); fd.className = 'h-frec' + (fh >= h.frecSemanal ? ' full' : '');
      fd.textContent = fh + ' / ' + h.frecSemanal + ' esta semana' + (fh >= h.frecSemanal ? ' ✓' : '');
      body.appendChild(fd);
    }
    if(h.hint){
      const hint = document.createElement('div'); hint.className = 'h-hint'; hint.textContent = h.hint;
      body.appendChild(hint);
    }
    // ancla / hábito apilado (idea #73): "después de X, hago esto"
    if(h.tras && !done){
      const tr = document.createElement('div'); tr.className = 'h-tras';
      tr.textContent = '⛓ después de ' + h.tras;
      body.appendChild(tr);
    }
    // Plan B: el mínimo aceptable, como permiso para el día difícil.
    // Solo se muestra si el hábito aún no está hecho.
    if(h.planB && !done){
      const pb = document.createElement('div'); pb.className = 'h-planb';
      pb.textContent = '🅱️ mínimo: ' + h.planB;
      body.appendChild(pb);
    }
    // el "por qué": tu motivo, visible cuando el hábito aún no cae (el
    // empujón para el día flojo)
    if(h.porQue && !done){
      const pq = document.createElement('div'); pq.className = 'h-porque';
      pq.textContent = '💭 ' + h.porQue;
      body.appendChild(pq);
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
    // contador: botón − para restar (solo si ya hay progreso)
    if(num && cnt > 0){
      const minus = document.createElement('span');
      minus.className = 'h-minus'; minus.textContent = '−';
      minus.setAttribute('role', 'button'); minus.setAttribute('tabindex', '0');
      minus.setAttribute('aria-label', 'Restar uno a ' + h.name);
      const restar = (e)=>{ e.stopPropagation(); e.preventDefault(); incHabit(h, -1); };
      minus.addEventListener('click', restar);
      minus.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') restar(e); });
      b.appendChild(minus);
    }
    b.addEventListener('click', ()=>{
      if(b._swiped){ b._swiped = false; return; } // el gesto ya actuó: ignora el click
      const cur = dias[today()] || {};
      if(num) incHabit(h, +1);          // contador: cada toque suma 1
      else setHabit(h, !cur[h.id]);     // normal: toque = alterna
    });
    // deslizar para completar (estilo Instagram): derecha marca, izquierda
    // desmarca. touch-action:pan-y deja el scroll vertical intacto (CSS).
    let sx = 0, sy = 0, drag = false;
    const UMBRAL = 64;
    b.addEventListener('pointerdown', (e)=>{
      if(e.target.closest('.h-foco') || e.target.closest('.h-minus') || e.target.closest('.h-streak')) return; // controles propios
      sx = e.clientX; sy = e.clientY; drag = false;
    });
    b.addEventListener('pointermove', (e)=>{
      if(sx === 0 && sy === 0) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if(!drag && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy))) return; // aún no es swipe horizontal
      drag = true;
      const cap = Math.max(-90, Math.min(90, dx));
      b.style.transform = 'translateX(' + cap + 'px)';
      b.style.transition = 'none';
      b.classList.toggle('swipe-on', dx > 20);
      b.classList.toggle('swipe-off', dx < -20);
    });
    const finSwipe = (e)=>{
      if(!drag){ sx = sy = 0; return; }
      const dx = e.clientX - sx;
      b.style.transition = ''; b.style.transform = '';
      b.classList.remove('swipe-on', 'swipe-off');
      sx = sy = 0;
      if(Math.abs(dx) >= UMBRAL){
        b._swiped = true; // evita el click que sigue al soltar
        if(num) setCount(h, dx > 0 ? h.meta : 0); // contador: completa / reinicia
        else setHabit(h, dx > 0); // derecha = hecho, izquierda = deshacer
      }
    };
    b.addEventListener('pointerup', finSwipe);
    b.addEventListener('pointercancel', ()=>{ b.style.transition=''; b.style.transform=''; b.classList.remove('swipe-on','swipe-off'); sx=sy=0; drag=false; });
    return b;
  }
  // marca/desmarca un hábito a un estado concreto (compartido por toque y
  // swipe). Devuelve false si ya estaba así (sin cambio, sin sonido).
  function setHabit(h, want){
    const k = today();               // fecha FRESCA (bug de medianoche)
    const cur = dias[k] || {};
    if(!!cur[h.id] === want) return false;
    const wasWon = isWon(cur, k);
    cur[h.id] = want;
    dias[k] = cur;
    save();
    render();
    if(want){
      if(!wasWon && isWon(cur, k)){ sonarGanado(); toast('Día ganado. Una rep más. 🔥'); }
      else sonarCheck();
    }
    return true;
  }
  // fija el contador de un hábito con meta a un valor (0..meta). Igual que
  // setHabit pero para hábitos numéricos: 0 borra la clave (registro vacío).
  function setCount(h, n){
    const k = today();
    const cur = dias[k] || {};
    n = Math.max(0, Math.min(h.meta, Math.round(n)));
    const prev = Number(cur[h.id]) || 0;
    if(prev === n) return false;
    const wasWon = isWon(cur, k);
    if(n <= 0) delete cur[h.id]; else cur[h.id] = n;
    dias[k] = cur;
    save();
    render();
    if(n > prev){ // subió: festeja si completó o ganó el día
      if(!wasWon && isWon(cur, k)){ sonarGanado(); toast('Día ganado. Una rep más. 🔥'); }
      else if(n >= h.meta){ sonarCheck(); toast(h.name + ' completo ✓'); }
      else sonarCheck();
    }
    return true;
  }
  function incHabit(h, delta){
    const cur = dias[today()] || {};
    setCount(h, (Number(cur[h.id]) || 0) + delta);
  }

  // ===== Semáforo de energía (idea #77) =====
  // Marcas tu energía del día (verde/ámbar/rojo) y la app sugiere cómo
  // encarar lo que falta: con todo, a ritmo, o bajando el listón (plan B).
  const ENERGIA_KEY = 'reps-energia';
  let energia = {}; // {fecha: 'verde'|'ambar'|'rojo'}
  function loadEnergia(){
    try{ const v = JSON.parse(localStorage.getItem(ENERGIA_KEY)); if(esMapa(v)) energia = v; }catch(e){ energia = {}; }
  }
  function saveEnergia(){ try{ localStorage.setItem(ENERGIA_KEY, JSON.stringify(energia)); }catch(e){} }
  function sugEnergia(nivel, pendientes){
    const p = pendientes[0]; // un core pendiente concreto, si hay
    if(nivel === 'verde') return '🟢 Vienes con todo. Ataca lo más pesado ahora' + (p ? ': «' + p.name + '».' : '.');
    if(nivel === 'rojo') return '🔴 Día bajo. Baja el listón: haz solo el mínimo' + (p && p.planB ? ' («' + p.planB + '»)' : '') + '. Presentarte ya es ganar.';
    return '🟡 Ritmo estable. Cierra un core y sigue' + (p ? ': «' + p.name + '».' : '.');
  }
  function renderEnergia(){
    const card = $('energiaCard'); if(!card) return;
    const hoy = today();
    const nivel = energia[hoy] || null;
    // marca la opción elegida
    card.querySelectorAll('.en-opt').forEach(b => b.classList.toggle('on', b.dataset.en === nivel));
    const sug = $('enSug');
    if(nivel){
      const pend = coreDelDia(hoy).map(id => habById(id)).filter(h => h && !hecho(dias[hoy], h.id));
      sug.hidden = false; sug.textContent = sugEnergia(nivel, pend);
    } else { sug.hidden = true; sug.textContent = ''; }
  }
  // wiring de los botones (una vez)
  (function initEnergia(){
    const opts = document.getElementById('enOpts'); if(!opts) return;
    opts.addEventListener('click', (e)=>{
      const b = e.target.closest('.en-opt'); if(!b) return;
      const hoy = today();
      if(energia[hoy] === b.dataset.en) delete energia[hoy]; // segundo toque = quitar
      else energia[hoy] = b.dataset.en;
      saveEnergia(); renderEnergia(); sonarCheck();
    });
  })();

  // ===== Modo "un solo hábito" (idea #74) =====
  // Foco absoluto en un hábito hasta consolidarlo: oculta el resto y deja
  // solo su tarjeta. Es un FILTRO visual; el puntaje/racha no se tocan.
  const SOLO_KEY = 'reps-solo';
  let solo = ''; // id del hábito en foco, o '' (ver todos)
  function loadSolo(){ try{ const v = localStorage.getItem(SOLO_KEY); solo = (typeof v === 'string' && v) ? v : ''; }catch(e){ solo = ''; } }
  function saveSolo(){ try{ if(solo) localStorage.setItem(SOLO_KEY, solo); else localStorage.removeItem(SOLO_KEY); }catch(e){} }
  function setSolo(id){ solo = (solo === id) ? '' : id; saveSolo(); render(); if(typeof renderHabEditor === 'function') renderHabEditor(); }

  // ===== Aviso de riesgo (idea #88): predice una posible caída HOY =====
  // Detección 100% local: cruza tu historial por día de la semana con tu
  // estado de ahora (hora, core pendientes, racha). Avisa ANTES de caer
  // (distinto del modo rescate, que actúa DESPUÉS de 2 días caídos).
  function tasaDiaSemana(dow){
    let req = 0, won = 0;
    Object.keys(dias).forEach(k => {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(k) || k >= today()) return;
      if(dowDe(k) !== dow || esDescanso(k)) return;
      req++; if(esGanado(k)) won++;
    });
    return req >= 3 ? won / req : null; // null = pocos datos para opinar
  }
  function renderRiesgo(won, desc, s, caidosN, coreHoy, coreDone){
    const card = $('riesgoCard'); if(!card) return;
    if(won || desc || caidosN >= 2 || coreHoy.length === 0){ card.hidden = true; return; } // no competir con rescate/descanso
    const hora = new Date().getHours();
    const tasa = tasaDiaSemana(dowDe(today()));
    const faltan = coreHoy.length - coreDone;
    const tardeSinCerrar = hora >= 18 && faltan > 0;
    const diaDebil = tasa !== null && tasa < 0.5 && faltan > 0;
    if(!(tardeSinCerrar || diaDebil)){ card.hidden = true; return; }
    const nombreDia = new Date(today() + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long'});
    let msg = diaDebil ? 'Los ' + nombreDia + ' se te suelen escapar. ' : 'Se hace tarde y ';
    msg += 'te falta' + (faltan === 1 ? '' : 'n') + ' ' + faltan + ' core. ';
    msg += s >= 3 ? 'Tu racha de ' + s + ' está en juego: cae UNO ahora y la salvas.' : 'Cierra uno ahora y evitas el bajón.';
    card.hidden = false; card.textContent = '⚠️ ' + msg;
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

    // modo "un solo hábito" (idea #74): filtro visual. Solo aplica si el
    // hábito elegido existe y toca hoy; si no, se muestra todo (sin sorpresas).
    const soloHab = solo ? hoyHabs.find(h => h.id === solo) : null;
    const visibles = soloHab ? [soloHab] : hoyHabs;
    const sb = $('soloBanner');
    if(sb){
      sb.hidden = !soloHab;
      if(soloHab) $('soloTxt').textContent = '🎯 Foco en: ' + soloHab.name;
    }

    const coreL = $('coreList'), extraL = $('extraList');
    coreL.innerHTML=''; extraL.innerHTML='';
    visibles.forEach(h=> (h.core?coreL:extraL).appendChild(habitBtn(h,rec)) );
    // secciones vacías se ocultan (según lo que toca hoy)
    const secExtra = $('secExtra');
    if(secExtra) secExtra.hidden = !visibles.some(h => !h.core);
    const secCore = $('secCore');
    if(secCore) secCore.hidden = !visibles.some(h => h.core);

    const coreDone = coreHoy.filter(id => hecho(rec, id)).length;
    $('coreTag').textContent = desc ? 'descanso' : (coreDone + '/' + coreHoy.length + ' = día ganado');

    const won = esGanado(hoyKey);
    $('stamp').classList.toggle('show', won);

    // anillo del día (WHOOP): se llena con los core; ✓ al ganar, · en descanso
    const ring = $('dayRing');
    const ringPct = coreHoy.length ? Math.round(coreDone / coreHoy.length * 100) : 0;
    ring.style.setProperty('--p', desc ? 0 : ringPct);
    ring.classList.toggle('done', won);
    ring.classList.toggle('rest', desc);
    $('ringTxt').textContent = desc ? '·' : (won ? '✓' : coreDone + '/' + coreHoy.length);

    const done = hoyHabs.filter(h=>hecho(rec, h.id)).length;
    const pct = hoyHabs.length ? Math.round(done/hoyHabs.length*100) : 0;
    $('progPct').textContent = pct+'%';
    $('progBar').style.width = pct+'%';
    $('prog').hidden = desc; // sin nada que cumplir, no hay barra

    const s = streak();
    $('streakNum').textContent = s;
    $('srEmoji').textContent = won ? '✅' : (s > 0 ? '🔥' : '🌅'); // anillo de Stories
    $('streakSub').textContent =
      desc ? 'Hoy es descanso. Tu racha te espera intacta.' :
      won ? 'Hoy ya cayó. Bien.' :
      s>0 ? 'La racha vive. Cierra hoy los ' + coreHoy.length + ' core.' :
      'Gana hoy para encenderla.';
    $('frzInfo').hidden = racha.congeladores === 0;
    $('frzInfo').textContent = '🧊 ×' + racha.congeladores +
      (racha.congeladores === 1 ? ' congelador listo' : ' congeladores listos');

    // racha de presencia: solo se muestra cuando cuenta una historia DISTINTA
    // a la racha de días ganados (si son iguales, sería ruido)
    const pres = rachaPresencia();
    $('presInfo').hidden = !(pres > 0 && pres !== s);
    $('presInfo').textContent = '🙌 Te has presentado ' + pres + ' día' + (pres === 1 ? '' : 's') + ' seguidos';

    // modo rescate: 2+ días caídos y hoy aún sin ganar (y hoy NO es descanso).
    const caidosN = diasCaidosSeguidos();
    const enPeligro = caidosN >= 2 && !won && !desc;
    $('rescate').hidden = !enPeligro;
    if(enPeligro){
      $('rescateTxt').textContent = 'Llevas ' + caidosN + ' días fuera. No busques el día perfecto: ' +
        'haz UNA sola cosa hoy y rompe la inercia. Volver ya es ganar.';
    }
    $('streakWarn').hidden = !(lostYesterday() && !won) || enPeligro;
    renderRiesgo(won, desc, s, caidosN, coreHoy, coreDone); // aviso de posible caída (idea #88)

    // Hoy pide: la recomendación única (acción), leyendo el bloque en curso
    const pide = hoyPide(won, desc, s, caidosN, coreHoy, coreDone, bloqueActual());
    $('pide').hidden = !pide;
    if(pide) $('pide').textContent = pide;

    // empujón del día: una frase que sí sabe cómo vienes
    const emp = empujeDelDia(won, desc, s, caidosN);
    $('empuje').hidden = !emp;
    if(emp) $('empuje').textContent = emp;

    renderRitual();
    renderCarta(); // la carta aparece junto al rescate cuando hace falta

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

    renderAhora(); // HUD del bloque en curso (El Ahora)
    const dw = $('despWrap'); if(dw){ dw.innerHTML = ''; dw.appendChild(buildDespertarUI(hoyKey)); }
    renderMantra(); // frase/mantra arriba de Hoy (idea #97)
    renderCuentaCard(); // cuenta regresiva al próximo evento (idea #115)
    renderViajeBanner(); // banner de modo viaje (idea #116)
    renderEnergia(); // semáforo de energía del día (idea #77)
    renderCheckin(); // chequeo de ánimo a media jornada (idea #91)
    renderStats(); // mantiene la pestaña Stats al día con cada cambio
    applyHoyCfg(); // enciende/apaga tarjetas de Hoy según tu gusto (idea #106/#107)
    updateBadge(); // la insignia del ícono refleja los core pendientes
  }
  // El Ahora avanza solo: refresca el bloque en curso cada minuto sin
  // repintar todo (el visibilitychange ya cubre el regreso de la app)
  setInterval(() => { try{ renderAhora(); }catch(e){} }, 60000);

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

  // Bandeja inteligente: la IA sugiere en qué categoría cae una idea.
  // Devuelve un id de CATS o null (si no hay internet o no está claro).
  // No guarda nada en el Worker: es una consulta suelta ("cerebro de visita").
  async function sugerirCategoria(texto){
    const ids = CATS.map(c => c.id).join(', ');
    const sistema = 'Clasificas una idea suelta en UNA sola categoría de una bandeja de tareas. ' +
      'Categorías (id: para qué): ya: hacer cuanto antes; social: gente, salidas, mensajes, citas; ' +
      'compras: comprar algo; aprender: estudiar, leer, cursos, temas; algundia: algún día / tal vez. ' +
      'Responde SOLO con el id exacto, en minúsculas, sin nada más. Ids válidos: ' + ids + '.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Idea: ' + texto }) });
      if(!res.ok) return null;
      const d = await res.json();
      const raw = (d.texto || '').toLowerCase();
      return CATS.find(c => raw.includes(c.id)) ? CATS.find(c => raw.includes(c.id)).id : null;
    }catch(e){ return null; }
  }
  // pinta la sugerencia: resalta el botón de la categoría propuesta
  function marcarSugerencia(catId){
    $('cpOpts').querySelectorAll('.cp-opt').forEach(b => b.classList.toggle('sug', b.dataset.cat === catId));
    const c = catOf(catId);
    $('cpSug').hidden = !c;
    if(c) $('cpSug').textContent = '🤖 sugiere: ' + c.emoji + ' ' + c.name;
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

    // lista de ideas: importantes (no hechas) arriba, luego el resto por fecha
    const list = $('trayList'); list.innerHTML = '';
    const shown = ideas.filter(i => trayFilter === 'todas' || i.cat === trayFilter)
      .slice().sort((a,b) => ((b.prio && !b.done) ? 1 : 0) - ((a.prio && !a.done) ? 1 : 0));
    $('trayEmpty').hidden = shown.length > 0;

    shown.forEach(i => {
      const c = catOf(i.cat);
      const card = document.createElement('div');
      card.className = 'idea' + (i.done ? ' done' : '') + (i.prio && !i.done ? ' prio' : '');

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

      // ✨ IA: convierte la idea en pasos concretos
      const plan = document.createElement('button');
      plan.className = 'i-plan'; plan.textContent = '✨';
      plan.setAttribute('aria-label', 'Convertir en pasos con IA');
      plan.addEventListener('click', ()=> ideaAPlan(i.text));

      // estrella de prioridad: marca la idea como importante (la sube)
      const star = document.createElement('button');
      star.className = 'i-star' + (i.prio ? ' on' : '');
      star.textContent = i.prio ? '★' : '☆';
      star.setAttribute('aria-label', i.prio ? 'Quitar importante' : 'Marcar importante');
      star.addEventListener('click', ()=>{ i.prio = !i.prio; saveTray(); renderTray(); });

      const del = document.createElement('button');
      del.className = 'i-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar idea');
      del.addEventListener('click', ()=>{
        ideas = ideas.filter(x => x.id !== i.id);
        saveTray(); renderTray();
        toast('Idea borrada.');
      });

      card.append(main, plan, star, del);
      list.appendChild(card);
    });
  }
  // #12 idea → plan: la IA la desarma en pasos concretos (sheet #ideaPlanWrap)
  async function ideaAPlan(texto){
    if(iaOcupado) return;
    $('ipIdea').textContent = '«' + texto + '»';
    const out = $('ipOut'); out.textContent = 'Armando los pasos… ✨';
    $('ideaPlanWrap').hidden = false;
    iaOcupado = true;
    const sistema = 'Convierte una idea/pendiente en un plan de acción claro. Devuelve 3 a 5 pasos concretos y ' +
      'accionables, cada uno en su línea empezando con "• ". Si aplica, sugiere cuándo hacer el primero. ' +
      'En español, breve, sin markdown ni encabezados.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Idea: ' + texto }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      out.textContent = (d.texto || '').trim() || 'No pude armar el plan. Intenta de nuevo.';
    }catch(e){ out.textContent = 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'; }
    iaOcupado = false;
  }
  $('ipClose').addEventListener('click', ()=>{ $('ideaPlanWrap').hidden = true; });
  $('ideaPlanWrap').addEventListener('click', (e)=>{ if(e.target === $('ideaPlanWrap')) $('ideaPlanWrap').hidden = true; });

  // #30 Dictar por voz: rellena el input de la Bandeja con reconocimiento de
  // voz del navegador (donde exista). Si no hay soporte, el botón queda oculto.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR){
    $('trayMic').hidden = false;
    let rec = null, escuchando = false;
    $('trayMic').addEventListener('click', ()=>{
      if(escuchando){ try{ rec.stop(); }catch(e){} return; }
      rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = ()=>{ escuchando = true; $('trayMic').classList.add('rec'); };
      rec.onresult = (ev)=>{
        const t = ev.results[0][0].transcript;
        const inp = $('trayInput');
        inp.value = (inp.value.trim() ? inp.value.trim() + ' ' : '') + t;
        inp.dispatchEvent(new Event('input')); // que crezca el textarea
      };
      rec.onerror = (ev)=>{ toast(ev.error === 'not-allowed' ? 'Da permiso al micrófono para dictar.' : 'No pude escuchar. Intenta de nuevo.'); };
      rec.onend = ()=>{ escuchando = false; $('trayMic').classList.remove('rec'); $('trayInput').focus(); };
      try{ rec.start(); }catch(e){}
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
    // limpia cualquier sugerencia anterior y pide una nueva a la IA
    $('cpOpts').querySelectorAll('.cp-opt').forEach(b => b.classList.remove('sug'));
    $('cpSug').hidden = false; $('cpSug').textContent = '🤖 pensando…';
    $('catPick').classList.add('show');
    sugerirCategoria(t).then(catId => {
      // solo aplica si el usuario sigue eligiendo para ESTA idea
      if(pendingText !== t){ return; }
      if(catId) marcarSugerencia(catId);
      else $('cpSug').hidden = true; // sin internet / sin certeza: manual, sin ruido
    });
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
    b.dataset.cat = c.id;
    b.textContent = c.emoji + ' ' + c.name;
    b.addEventListener('click', ()=>{
      if(pendingText == null) return;
      addIdea(pendingText, c.id);
      pendingText = null;
      $('catPick').classList.remove('show');
      $('cpSug').hidden = true;
      b.classList.remove('sug');
      toast('Guardada en ' + c.name + '.');
    });
    $('cpOpts').appendChild(b);
  });

  // cancelar: devuelve el texto al input para no perder lo escrito
  $('cpCancel').addEventListener('click', ()=>{
    $('trayInput').value = pendingText || '';
    pendingText = null;
    $('catPick').classList.remove('show');
    $('cpSug').hidden = true;
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

    // 5) tu hábito más flojo: el que menos cierras cuando SÍ toca (mín. 6 días
    // aplicables registrados). El denominador honesto: días en que aplicaba.
    const dReg = Object.keys(dias).filter(k => dias[k]);
    let flojo = null;
    HABITS.forEach(h => {
      const aplica = dReg.filter(k => !esDescanso(k) && habAplica(h, new Date(k + 'T12:00:00').getDay()));
      if(aplica.length < 6) return;
      const pct = Math.round(aplica.filter(k => dias[k][h.id]).length / aplica.length * 100);
      if(!flojo || pct < flojo.pct) flojo = { nombre: h.name, pct };
    });
    if(flojo && flojo.pct < 70) out.push('Tu hábito más flojo: «' + flojo.nombre + '» — lo cierras el ' + flojo.pct + '% de las veces. Empieza por ahí.');

    // 6) tu puntaje promedio (WHOOP) en los días con actividad (mín. 7)
    const dPunt = dReg.filter(k => !esDescanso(k));
    if(dPunt.length >= 7){
      const avg = Math.round(dPunt.reduce((a, k) => a + (puntajeDia(k) || 0), 0) / dPunt.length);
      out.push('Tu puntaje promedio: ' + avg + '/100 en ' + dPunt.length + ' días con actividad.');
    }

    // 7) despertar temprano ↔ días ganados: compara el % de ganados cuando
    // despiertas a tiempo vs tarde (mín. 4 muestras por lado)
    const conDesp = Object.keys(cierres).filter(k => esHora((cierres[k]||{}).despierta) && !esDescanso(k));
    const temprano = conDesp.filter(k => minsHora(cierres[k].despierta) <= minsHora(despConf.meta) + graceDesp(despConf.rigor));
    const tarde = conDesp.filter(k => !temprano.includes(k));
    if(temprano.length >= 4 && tarde.length >= 4){
      const pT = Math.round(temprano.filter(esGanado).length / temprano.length * 100);
      const pL = Math.round(tarde.filter(esGanado).length / tarde.length * 100);
      if(pT !== pL) out.push(pT > pL
        ? 'Cuando despiertas a tiempo ganas el ' + pT + '% de los días; tarde, solo el ' + pL + '%. La mañana decide.'
        : 'Curioso: ganas más aun despertando tarde (' + pL + '% vs ' + pT + '%). Tu mañana no es el problema.');
    }

    // 8) sueño ↔ ánimo: ¿dormir bien te pone 🔥? (usa reps-sueno; mín. 3 por lado)
    const nochesAnimo = Object.keys(sueno).filter(k => minDormidos(sueno[k]) != null && (cierres[k] || {}).animo);
    if(nochesAnimo.length >= 6){
      const bien = nochesAnimo.filter(k => minDormidos(sueno[k]) >= 420); // 7h+
      const poco = nochesAnimo.filter(k => minDormidos(sueno[k]) < 420);
      if(bien.length >= 3 && poco.length >= 3){
        const pB = Math.round(bien.filter(k => cierres[k].animo === 'bien').length / bien.length * 100);
        const pP = Math.round(poco.filter(k => cierres[k].animo === 'bien').length / poco.length * 100);
        if(pB > pP) out.push('Durmiendo 7h+, tu ánimo es 🔥 el ' + pB + '%; con menos, el ' + pP + '%. El sueño te sostiene.');
      }
    }

    // 9) predicción de racha: qué tan cerca estás de tu récord
    const sp = statsData();
    if(sp.now > 0 && sp.best > 0){
      if(sp.now >= sp.best){
        out.push('Estás en tu mejor racha de la historia (' + sp.now + ' días). Cada día es un récord nuevo. 🔥');
      } else if(sp.best - sp.now <= 7){
        const faltan = sp.best - sp.now;
        out.push('Te faltan ' + faltan + ' día' + (faltan === 1 ? '' : 's') + ' para igualar tu mejor racha (' + sp.best + '). Vas.');
      }
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
     [200,'🎖️','200 días ganados','Doscientos. Esto es quien eres.'],
     [365,'👑','365 días ganados','Un año entero. Leyenda.']
    ].forEach(([n,e,t,su]) => push(s.total >= n, 'dias'+n, e, t, su));
    [[7,'🧊','Racha de 7','Siete seguidos. La inercia ya juega a tu favor.'],
     [14,'⚡','Racha de 14','Dos semanas sin fallar. Impresionante.'],
     [30,'🌟','Racha de 30','Treinta seguidos. Élite.'],
     [60,'☄️','Racha de 60','Dos meses sin fallar. Imparable.']
    ].forEach(([n,e,t,su]) => push(s.best >= n, 'racha'+n, e, t, su));
    [[5,'🔄','5 regresos','Caíste y volviste cinco veces. Esa es LA habilidad.'],
     [10,'🛡️','10 regresos','Diez regresos. Ya no te rompe una caída.']
    ].forEach(([n,e,t,su]) => push(reg >= n, 'reg'+n, e, t, su));
    // foco acumulado (minutos → medallas)
    [[60,'⏳','1 hora enfocado','Tu primer bloque profundo cuenta.'],
     [600,'🎯','10 horas enfocado','Diez horas de foco real.'],
     [3000,'🧘','50 horas enfocado','Cincuenta horas. Concentración de élite.']
    ].forEach(([n,e,t,su]) => push((typeof focoTotal === 'number' ? focoTotal : 0) >= n, 'foco'+n, e, t, su));
    // primera meta de ahorro cumplida
    push(fin && Array.isArray(fin.metas) && fin.metas.some(g => g.objetivo > 0 && g.ahorrado >= g.objetivo),
      'ahorro1', '🐷', 'Meta de ahorro cumplida', 'Juntaste lo que te propusiste. Va en serio.');
    // días sin recaída (lo más limpio que llevas)
    const maxSin = (evitares || []).reduce((m, e) => Math.max(m, diasSin(e.desde)), 0);
    push(maxSin >= 30,  'sin30',  '🚭', '30 días sin', 'Un mes limpio de algo que dejaste.');
    push(maxSin >= 100, 'sin100', '💎', '100 días sin', 'Cien días. Eso es libertad.');
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
  let heatHab = ''; // #101: id del hábito a mostrar en el heatmap, o '' (global)
  function renderHeatmap(){
    const heat = $('heat'); heat.innerHTML = '';
    const SEMANAS = 53;
    const start = mondayOf(new Date());
    start.setDate(start.getDate() - (SEMANAS - 1) * 7);
    const todayKey = today();
    const hSel = heatHab ? habById(heatHab) : null; // hábito filtrado (idea #101)
    let ganados = 0;
    for(let w = 0; w < SEMANAS; w++){
      const col = document.createElement('div'); col.className = 'heat-col';
      for(let d = 0; d < 7; d++){
        const day = new Date(start); day.setDate(day.getDate() + w*7 + d);
        const k = localISO(day);
        const cell = document.createElement('div'); cell.className = 'heat-cell';
        if(k > todayKey){ cell.classList.add('fut'); }
        else if(hSel){
          // vista por hábito: hecho / no tocaba / fallado
          if(!habAplica(hSel, dowDe(k))) cell.classList.add('rest');
          else if(hecho(dias[k], hSel.id)){ cell.classList.add('won'); ganados++; }
          // si no, queda vacío (fallado)
        } else {
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
    $('yearTag').textContent = hSel ? (ganados + ' veces · ' + hSel.name) : (ganados + ' días ganados');
    // rellena el selector (una vez, o si cambian los hábitos)
    const sel = $('heatHab');
    if(sel && sel.options.length !== HABITS.length + 1){
      const prev = sel.value; sel.innerHTML = '<option value="">Todos (día ganado)</option>';
      HABITS.forEach(h => { const o = document.createElement('option'); o.value = h.id; o.textContent = (h.emoji ? h.emoji + ' ' : '') + h.name; sel.appendChild(o); });
      sel.value = prev;
    }
  }
  { const sel = document.getElementById('heatHab'); if(sel) sel.addEventListener('change', ()=>{ heatHab = sel.value; renderHeatmap(); }); }

  // ===== Cadena del hábito (idea #72: "no rompas la cadena") =====
  // Pantalla por hábito: cuadrícula de sus últimas ~12 semanas marcando
  // los días PROGRAMADOS como hecho / fallado / no tocaba, más racha
  // actual, mejor racha histórica y total de veces hecho.
  let cadenaHabId = null;
  // recorre el historial (fechas con registro) del hábito y devuelve
  // {mejor, total}: mejor racha de días programados consecutivos hechos y
  // cuántas veces en total se hizo.
  function cadenaStats(h){
    const keys = Object.keys(dias).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    if(keys.length === 0) return { mejor: 0, total: 0 };
    let total = 0, mejor = 0, run = 0;
    // desde el primer registro hasta hoy, día por día
    const d = new Date(keys[0] + 'T12:00:00');
    const fin = new Date(today() + 'T12:00:00');
    while(d <= fin){
      const k = localISO(d);
      if(habAplica(h, dowDe(k))){
        if(hecho(dias[k], h.id)){ run++; total++; if(run > mejor) mejor = run; }
        else run = 0;
      }
      d.setDate(d.getDate() + 1);
    }
    return { mejor, total };
  }
  function abrirCadena(habId){
    cadenaHabId = habId;
    renderCadena();
    $('cadenaWrap').hidden = false;
  }
  function renderCadena(){
    const h = habById(cadenaHabId); if(!h) return;
    $('cadTitle').textContent = (h.emoji ? h.emoji + ' ' : '') + h.name;
    const racha = rachaHabito(h);
    const { mejor, total } = cadenaStats(h);
    $('cadRacha').textContent = racha;
    $('cadMejor').textContent = mejor;
    $('cadTotal').textContent = total;
    $('cadFrase').textContent =
      racha >= 2 ? '🔥 ' + racha + ' seguidos. No rompas la cadena.' :
      total === 0 ? 'Aún sin marcas. Hoy empiezas la cadena.' :
      'Retoma hoy y enciende la racha.';

    const grid = $('cadGrid'); grid.innerHTML = '';
    const SEMANAS = 12;
    const start = mondayOf(new Date());
    start.setDate(start.getDate() - (SEMANAS - 1) * 7);
    const todayKey = today();
    for(let w = 0; w < SEMANAS; w++){
      const col = document.createElement('div'); col.className = 'cad-col';
      for(let d = 0; d < 7; d++){
        const day = new Date(start); day.setDate(day.getDate() + w*7 + d);
        const k = localISO(day);
        const cell = document.createElement('div'); cell.className = 'cad-cell';
        if(k > todayKey) cell.classList.add('fut');
        else if(!habAplica(h, dowDe(k))) cell.classList.add('off'); // no tocaba
        else if(hecho(dias[k], h.id)) cell.classList.add('done');
        else if(k === todayKey) cell.classList.add('hoy'); // hoy, aún pendiente
        else cell.classList.add('miss');
        col.appendChild(cell);
      }
      grid.appendChild(col);
    }
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

  // ===== Este mes contra el pasado =====
  // Compara el RITMO (% de días juzgables ganados), no los totales crudos:
  // a mitad de mes los totales engañan, el ritmo no.
  function mesVsData(){
    const hoy = new Date();
    const ritmo = (y, m, hastaDia) => {
      const dmax = hastaDia || new Date(y, m + 1, 0).getDate();
      let g = 0, req = 0;
      for(let d = 1; d <= dmax; d++){
        const k = localISO(new Date(y, m, d));
        if(k > today()) break;
        if(esDescanso(k)) continue;
        req++;
        if(esGanado(k)) g++;
      }
      return { g, req, pct: req ? Math.round(g / req * 100) : null };
    };
    const actual = ritmo(hoy.getFullYear(), hoy.getMonth());
    const prevDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const pasado = ritmo(prevDate.getFullYear(), prevDate.getMonth());
    return { actual, pasado };
  }
  function renderMesVs(){
    const { actual, pasado } = mesVsData();
    const el = $('mesVs');
    // solo habla cuando hay algo que comparar
    if(actual.pct === null || pasado.pct === null || pasado.req < 5){ el.hidden = true; return; }
    const diff = actual.pct - pasado.pct;
    const signo = diff > 0 ? '📈 +' + diff : diff < 0 ? '📉 ' + diff : '➡️ igual,';
    el.hidden = false;
    el.textContent = 'Este mes vas al ' + actual.pct + '% · el pasado cerraste al ' + pasado.pct + '% · ' + signo + (diff !== 0 ? ' puntos' : ' que el pasado');
  }

  // ===== Recap semanal: tu semana pasada, tipo Wrapped =====
  // Deriva de la última semana COMPLETA (lunes–domingo anterior a la actual);
  // aparece si esa semana tuvo al menos un día con requisito.
  function recapData(){
    const monActual = mondayOf(new Date());
    const mon = new Date(monActual); mon.setDate(mon.getDate() - 7);
    let ganados = 0, req = 0, sumP = 0, nP = 0, mejor = null;
    let sumDesp = 0, nDesp = 0;
    const animos = { bien:0, regular:0, mal:0 };
    for(let i = 0; i < 7; i++){
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const k = localISO(d);
      if(!esDescanso(k)){
        req++;
        if(esGanado(k)) ganados++;
        const p = puntajeDia(k);
        if(p !== null){ sumP += p; nP++; if(!mejor || p > mejor.p) mejor = { p, k }; }
      }
      const c = cierres[k] || {};
      if(c.animo && animos[c.animo] !== undefined) animos[c.animo]++;
      if(esHora(c.despierta)){ sumDesp += minsHora(c.despierta); nDesp++; }
    }
    return { mon, ganados, req, prom: nP ? Math.round(sumP / nP) : null, mejor,
             desp: nDesp ? Math.round(sumDesp / nDesp) : null, animos };
  }
  function renderRecap(){
    const r = recapData();
    const el = $('recapSem');
    if(!r.req){ el.hidden = true; return; }
    el.hidden = false;
    const g = $('rpGrid'); g.innerHTML = '';
    const celda = (num, lbl) => {
      const c = document.createElement('div'); c.className = 'rp-cell';
      const n = document.createElement('div'); n.className = 'rp-num'; n.textContent = num;
      const l = document.createElement('div'); l.className = 'rp-lbl'; l.textContent = lbl;
      c.append(n, l); g.appendChild(c);
    };
    celda(r.ganados + '/' + r.req, 'días ganados');
    if(r.prom !== null) celda(r.prom, 'puntaje prom.');
    if(r.desp !== null){
      const h = Math.floor(r.desp / 60), m = r.desp % 60;
      celda(h + ':' + String(m).padStart(2, '0'), 'despertar prom.');
    }
    const extra = [];
    if(r.mejor) extra.push('Tu mejor día: ' +
      new Date(r.mejor.k + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long'}) + ' (' + r.mejor.p + ' pts)');
    const totalAnimo = r.animos.bien + r.animos.regular + r.animos.mal;
    if(totalAnimo) extra.push('Ánimo: 🔥×' + r.animos.bien + ' 😐×' + r.animos.regular + ' 💀×' + r.animos.mal);
    $('rpExtra').textContent = extra.join(' · ');
    $('rpExtra').hidden = !extra.length;
  }

  // ===== Museo: tus logros reales, con fecha =====
  function museoItems(){
    const out = [];
    const wonDates = Object.keys(dias).filter(k => esGanado(k)).sort();
    if(wonDates.length) out.push({ fecha: wonDates[0], txt: '🌱 Tu primer día ganado' });
    [[7,'🔥 Llegaste a 7 días ganados'],[30,'💪 Llegaste a 30 días ganados'],
     [50,'⭐ Medio centenar: 50 días'],[100,'🏆 Cien días ganados'],[365,'👑 365 días: un año entero']
    ].forEach(([n, txt]) => { if(wonDates.length >= n) out.push({ fecha: wonDates[n-1], txt }); });

    // mejor mes (mínimo 5 ganados para presumir)
    const porMes = {};
    wonDates.forEach(k => { const m = k.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; });
    const mejorMes = Object.keys(porMes).reduce((a, b) => porMes[b] > porMes[a] ? b : a, Object.keys(porMes)[0]);
    if(mejorMes && porMes[mejorMes] >= 5){
      const nombre = new Date(mejorMes + '-15T12:00:00').toLocaleDateString('es-MX', {month:'long', year:'numeric'});
      out.push({ fecha: mejorMes + '-28', txt: '📅 Tu mejor mes: ' + nombre + ' (' + porMes[mejorMes] + ' ganados)' });
    }
    // metas cumplidas (la fecha mostrada es la de creación: cuándo te la propusiste)
    metas.filter(m => m.hecha).forEach(m => {
      out.push({ fecha: (m.creada || '').slice(0, 10) || today(), txt: '🎯 Meta cumplida: ' + m.texto });
    });
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha)); // lo más reciente arriba
  }
  function renderMuseo(){
    const list = $('museoList'); list.innerHTML = '';
    const items = museoItems();
    if(!items.length){
      const p = document.createElement('div'); p.className = 'es-row es-empty';
      p.textContent = 'Tu museo se llena solo, con hechos. El primer día ganado inaugura la colección.';
      list.appendChild(p);
      return;
    }
    items.forEach(it => {
      const p = document.createElement('div'); p.className = 'es-row';
      const f = document.createElement('span'); f.className = 'mu-fecha';
      f.textContent = new Date(it.fecha + 'T12:00:00').toLocaleDateString('es-MX', {day:'numeric', month:'short'}) + ' · ';
      p.appendChild(f);
      p.appendChild(document.createTextNode(it.txt));
      list.appendChild(p);
    });
  }

  // Puntaje del día (WHOOP): 0–100 de qué tan completo fue un día. Núcleo =
  // los core (70, u 85 si no hay extras hoy); extras 15; ánimo del cierre 15.
  // Devuelve null en día de descanso (no hay nada que puntuar).
  function puntajeDia(fecha){
    const core = coreDelDia(fecha);
    if(!core.length) return null;
    const rec = dias[fecha] || {};
    const dow = dowDe(fecha);
    const extras = HABITS.filter(h => !h.core && habAplica(h, dow));
    const coreRatio = core.filter(id => hecho(rec, id)).length / core.length;
    const extraRatio = extras.length ? extras.filter(h => hecho(rec, h.id)).length / extras.length : 0;
    const animo = cierres[fecha] && cierres[fecha].animo;
    const moodPts = animo === 'bien' ? 15 : animo === 'regular' ? 8 : animo === 'mal' ? 4 : 0;
    const coreW = extras.length ? 70 : 85, extraW = extras.length ? 15 : 0;
    const base = coreRatio * coreW + extraRatio * extraW + moodPts;
    const desp = despertarEval(fecha).modifier; // + puntual / − tarde (0 si no cuenta)
    const recB = bonoRecordatorios(fecha);      // + por recordatorios cumplidos
    return Math.max(0, Math.min(100, Math.round(base + desp + recB)));
  }
  function renderScore(){
    const p = puntajeDia(today());
    const descanso = p === null;
    $('scNum').textContent = descanso ? '·' : p;
    $('scRing').style.setProperty('--p', descanso ? 0 : p);
    $('scMsg').textContent = descanso ? 'Hoy es descanso. Sin puntaje, y está bien.' :
      p >= 85 ? '¡Día excelente! 🔥' : p >= 60 ? 'Buen día. Vas bien.' :
      p >= 35 ? 'A medias — aún hay tiempo.' : p > 0 ? 'Apenas arranca.' : 'Aún en cero. Una cosa basta.';
    // tendencia de los últimos 7 días
    const sp = $('scSpark'); sp.innerHTML = '';
    for(let i = 6; i >= 0; i--){
      const key = localISO(new Date(Date.now() - i*86400000));
      const pv = puntajeDia(key);
      const bar = document.createElement('div'); bar.className = 'sp-bar';
      if(pv === null){ bar.classList.add('rest'); bar.style.height = '22%'; }
      else { bar.style.height = Math.max(6, pv) + '%'; if(pv >= 60) bar.classList.add('good'); }
      sp.appendChild(bar);
    }
  }

  // Resumen "Esta semana": lo esencial de tu vida + dinero en un vistazo
  function renderResumen(){
    const mon = mondayOf(new Date());
    let ganados = 0, animoSum = 0, animoN = 0;
    const animoVal = { bien:3, regular:2, mal:1 };
    for(let i = 0; i < 7; i++){
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const key = localISO(d);
      if(esGanado(key)) ganados++;
      const a = (cierres[key] || {}).animo;
      if(animoVal[a]){ animoSum += animoVal[a]; animoN++; }
    }
    $('rzDias').textContent = ganados + '/7';
    const prom = animoN ? animoSum / animoN : 0;
    $('rzAnimo').textContent = !animoN ? '·' : prom >= 2.5 ? '🔥' : prom >= 1.7 ? '😐' : '💀';
    const h = Math.floor(focoTotal / 60), m = focoTotal % 60;
    $('rzFoco').textContent = h > 0 ? (h + 'h') : (m + 'm');
    // saldo del mes (ingresos - gastos)
    const mes = today().slice(0, 7);
    const dm = fin.movs.filter(x => (x.fecha || '').startsWith(mes));
    const saldo = dm.filter(x => x.tipo === 'ingreso').reduce((a,x)=>a+(+x.monto),0) -
                  dm.filter(x => x.tipo === 'gasto').reduce((a,x)=>a+(+x.monto),0);
    $('rzSaldo').textContent = fmtDinero(saldo);
    $('rzSaldo').style.color = saldo < 0 ? 'var(--red)' : saldo > 0 ? 'var(--teal)' : 'var(--amber)';
    $('rzRacha').textContent = statsData().now;
    $('rzIdeas').textContent = ideas.filter(i => !i.done).length;
  }
  function renderStats(){
    renderInsightProx(); // insight proactivo al abrir Stats (idea #105)
    renderResumen();
    renderPulso();
    renderScore();
    const s = statsData();
    $('stTotal').textContent = s.total;
    $('stBest').textContent = s.best;
    $('stNow').textContent = s.now;
    $('stMonth').textContent = s.pct30 + '%';

    // contador de identidad: cada rep es un VOTO por quién te estás volviendo.
    // Las rachas se rompen; estos números solo crecen.
    const il = $('identList'); il.innerHTML = '';

    // frases de identidad (idea #99): "ya eres alguien que…" al cruzar umbrales
    frasesIdentidad().forEach(f => {
      const row = document.createElement('div'); row.className = 'id-frase';
      row.textContent = '✦ ' + f.txt;
      il.appendChild(row);
    });

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

    renderBrutal(); // modo espejo brutal (idea #100)
    renderCompa(s.total);
    renderRecompensas(s.total);
    renderRecordatorios();
    renderMesVs();
    renderRecap();
    renderMuseo();
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

  // convierte un canvas en PNG y lo comparte (hoja nativa) o descarga (PC)
  function compartirCanvas(canvas, nombre, titulo){
    canvas.toBlob(async (blob)=>{
      if(!blob){ toast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], nombre, {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file], title: titulo}); return; }
        catch(err){ if(err && err.name === 'AbortError') return; } // canceló: no forzar descarga
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      toast('Imagen descargada. 📤');
    }, 'image/png');
  }
  $('shareBtn').addEventListener('click', ()=>{
    const { canvas, nombre } = drawMonthImage();
    compartirCanvas(canvas, nombre, 'Mi mes en REPS');
  });

  // ===== Compartir año: la postal de 12 meses =====
  function drawYearImage(){
    const W = 1080, H = 1350, PAD = 80;
    const css = getComputedStyle(document.documentElement);
    const C = n => css.getPropertyValue(n).trim();
    const bg = C('--bg'), card = C('--card-2'), text = C('--text'),
          muted = C('--muted'), accent = C('--amber'), teal = C('--teal');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
    ctx.fillStyle = muted; ctx.font = '600 28px ' + FONT;
    ctx.fillText('MI AÑO EN REPS', PAD, 100);
    const anio = new Date().getFullYear();
    ctx.fillStyle = text; ctx.font = '800 72px ' + FONT;
    ctx.fillText(String(anio), PAD, 185);

    // métricas: ganados (últimas 53 semanas), mejor racha, regresos
    const s = statsData();
    const reg = contarRegresos();
    const met = [[String(s.total), 'DÍAS GANADOS'], [String(s.best), 'MEJOR RACHA'], [reg + '×', 'REGRESOS']];
    met.forEach(([num, lbl], i) => {
      const x = PAD + i * ((W - PAD*2) / 3);
      ctx.fillStyle = accent; ctx.font = '800 72px ' + FONT; ctx.fillText(num, x, 330);
      ctx.fillStyle = muted;  ctx.font = '600 22px ' + FONT; ctx.fillText(lbl, x, 368);
    });

    // mapa de calor de 53 semanas (mismo cálculo que renderHeatmap)
    const SEM = 53, gap = 4;
    const cell = Math.floor((W - PAD*2 - gap*(SEM-1)) / SEM);
    const start = mondayOf(new Date());
    start.setDate(start.getDate() - (SEM - 1) * 7);
    const gridW = SEM * cell + (SEM - 1) * gap;
    const gx = PAD + Math.floor((W - PAD*2 - gridW) / 2);
    const gy = 470;
    const todayKey = today();
    for(let w = 0; w < SEM; w++){
      for(let d = 0; d < 7; d++){
        const day = new Date(start); day.setDate(day.getDate() + w*7 + d);
        const k = localISO(day);
        if(k > todayKey) continue;
        const r = dias[k];
        ctx.fillStyle =
          esGanado(k) ? accent :
          racha.congelados[k] ? teal :
          (r && HABITS.some(h => r[h.id])) ? C('--line') : card;
        ctx.fillRect(gx + w*(cell+gap), gy + d*(cell+gap), cell, cell);
      }
    }

    // frase de cierre + logo
    ctx.textAlign = 'center';
    ctx.fillStyle = muted; ctx.font = '600 26px ' + FONT;
    ctx.fillText('Cada cuadro ámbar es un día que nadie te quita.', W/2, gy + 7*(cell+gap) + 70);
    ctx.font = '800 60px ' + FONT;
    const wReps = ctx.measureText('REPS').width, wDot = ctx.measureText('.').width;
    const x0 = W/2 - (wReps + wDot)/2;
    ctx.textAlign = 'left';
    ctx.fillStyle = text;   ctx.fillText('REPS', x0, 1315);
    ctx.fillStyle = accent; ctx.fillText('.', x0 + wReps, 1315);

    return { canvas, nombre: 'reps-año-' + anio + '.png' };
  }
  $('shareYearBtn').addEventListener('click', ()=>{
    const { canvas, nombre } = drawYearImage();
    compartirCanvas(canvas, nombre, 'Mi año en REPS');
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
  // ajuste de flexibilidad por día que propone la IA (día ligero por viaje,
  // mover el enfoque por un evento…). Plano por día, aditivo, va en el respaldo.
  const SEMANA_FLEX_KEY = 'reps-semana-flex';
  let semFlex = {};
  function loadSemFlex(){
    semFlex = {};
    try{
      const v = JSON.parse(localStorage.getItem(SEMANA_FLEX_KEY));
      if(esMapa(v)) Object.keys(v).forEach(k => { if(typeof v[k] === 'string') semFlex[k] = v[k]; });
    }catch(e){ semFlex = {}; }
  }
  function saveSemFlex(){
    try{ localStorage.setItem(SEMANA_FLEX_KEY, JSON.stringify(semFlex)); }
    catch(e){}
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
  // ===== Plan de la semana (pop dominical) =====
  // El domingo salta un pop que pregunta qué viene: pendientes, eventos/citas
  // y el enfoque. Se guarda por el lunes de la semana PLANEADA y se muestra en
  // Mi día toda la semana. Será el contexto clave del asistente IA (Capa 3.2).
  const PLANSEM_KEY = 'reps-plan-semana';
  const PLANSEM_VISTO = 'reps-plansem-visto'; // transitoria: no va en el respaldo
  let planSemana = {}; // { lunesKey: {foco, pendientes, eventos, guardado} }
  function loadPlanSemana(){
    try{
      const v = JSON.parse(localStorage.getItem(PLANSEM_KEY));
      if(esMapa(v)) planSemana = v;
    }catch(e){ planSemana = {}; }
  }
  function savePlanSemana(){
    try{ localStorage.setItem(PLANSEM_KEY, JSON.stringify(planSemana)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  // la semana que toca planear: si es domingo, la ENTRANTE; si no, la actual
  function planSemTarget(){
    const m = mondayOf(new Date());
    if(new Date().getDay() === 0) m.setDate(m.getDate() + 7);
    return localISO(m);
  }
  function abrirPlanSem(){
    const key = planSemTarget();
    const p = planSemana[key] || {};
    $('psFoco').value = p.foco || '';
    $('psPend').value = p.pendientes || '';
    $('psEven').value = p.eventos || '';
    const ini = new Date(key + 'T12:00:00');
    const fin = new Date(ini); fin.setDate(fin.getDate() + 6);
    $('psRango').textContent = 'Semana del ' + ini.toLocaleDateString('es-MX', {day:'numeric', month:'long'}) +
      ' al ' + fin.toLocaleDateString('es-MX', {day:'numeric', month:'long'});
    $('planSemWrap').hidden = false;
  }
  function guardarPlanSem(){
    const key = planSemTarget();
    planSemana[key] = {
      foco: $('psFoco').value.trim(),
      pendientes: $('psPend').value.trim(),
      eventos: $('psEven').value.trim(),
      guardado: true,
    };
    savePlanSemana(); renderPlanSemCard();
    $('planSemWrap').hidden = true;
    toast('Semana planeada. 🗓️');
  }
  // tarjeta en Mi día con el plan de la semana ACTUAL
  function renderPlanSemCard(){
    const key = localISO(mondayOf(new Date()));
    const p = planSemana[key];
    const card = $('semPlanCard');
    const hay = p && (p.foco || p.pendientes || p.eventos);
    card.hidden = !hay;
    if(!hay) return;
    const set = (id, val, pre) => {
      const el = $(id);
      el.hidden = !val;
      if(val) el.textContent = pre + val;
    };
    set('spFoco', p.foco, '🎯 Enfoque: ');
    set('spPend', p.pendientes, '📋 Pendientes: ');
    set('spEven', p.eventos, '📅 Eventos: ');
  }

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

  // ===== Rutina de Mi día (editable) =====
  // Los bloques del timeline dejaron de estar clavados en el código: viven
  // en reps-rutina. Ausente = la rutina de fábrica (comportamiento previo).
  const RUTINA_KEY = 'reps-rutina';
  const MAX_BLOQUES = 16;
  // Rutina de fábrica GENÉRICA: una plantilla neutral para cualquier usuario
  // nuevo. Cada quien la edita en Mi día (o la arma la IA). Sin datos personales.
  const RUTINA_DEFAULT = [
    {id:'r1',  hora:'7:30',  nombre:'Despertar', desc:'Cama · dientes · un poco de sol. Sin pantallas todavía.', tipo:'core'},
    {id:'r2',  hora:'8:00',  nombre:'Moverte', desc:'20–30 min: caminar, correr o estirar.', tipo:'core'},
    {id:'r3',  hora:'8:45',  nombre:'Baño + desayuno', desc:'Tranquilo, sin prisa.', tipo:'free'},
    {id:'r4',  hora:'9:30',  nombre:'Bloque de enfoque', desc:'Celular lejos. Tu trabajo o estudio más importante.', tipo:'core'},
    {id:'r5',  hora:'12:00', nombre:'Libre', desc:'Descansa sin culpa. Te lo ganaste.', tipo:'free'},
    {id:'r6',  hora:'14:00', nombre:'Comida', desc:'Sin celular = tiempo para ti o los tuyos.', tipo:'free'},
    {id:'r7',  hora:'15:00', nombre:'Aprender / practicar', desc:'Leer, un curso, practicar algo.', tipo:'core'},
    {id:'r8',  hora:'16:00', nombre:'Tiempo libre', desc:'Amigos, salir, tus cosas.', tipo:'free'},
    {id:'r9',  hora:'21:30', nombre:'Bajando revoluciones', desc:'Nada intenso ya; empieza a relajarte.', tipo:'free'},
    {id:'r10', hora:'22:30', nombre:'Leer un poco 📖', desc:'Celular cargando LEJOS de la cama.', tipo:'core'},
    {id:'r11', hora:'23:00', nombre:'A dormir', desc:'La meta es constante, no perfecta.', tipo:'core'},
  ];
  let rutina = [];

  function sanearRutina(v){
    if(!Array.isArray(v)) return null;
    const limpio = v
      .filter(s => s && typeof s.nombre === 'string' && s.nombre.trim() &&
                   typeof s.hora === 'string' && /^\d{1,2}:\d{2}$/.test(s.hora.trim()))
      .map(s => ({
        id: typeof s.id === 'string' ? s.id : 'r' + Math.random().toString(36).slice(2,8),
        hora: s.hora.trim(),
        nombre: s.nombre.trim(),
        desc: typeof s.desc === 'string' ? s.desc.trim() : '',
        tipo: s.tipo === 'core' ? 'core' : 'free',
      }))
      .slice(0, MAX_BLOQUES);
    return limpio.length ? limpio : null;
  }
  function loadRutina(){
    let crudo = null;
    try{ crudo = localStorage.getItem(RUTINA_KEY); }catch(e){}
    let v = null;
    try{ v = sanearRutina(JSON.parse(crudo)); }catch(e){}
    rutina = v || RUTINA_DEFAULT.map(s => Object.assign({}, s));
    if(crudo === null || !v) saveRutina(); // persiste/sanea desde el arranque
  }
  function saveRutina(){
    try{ localStorage.setItem(RUTINA_KEY, JSON.stringify(rutina)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
    // si el push está activo, el Worker y el espejo del SW deben enterarse
    try{ if(typeof pushSync === 'function') setTimeout(pushSync, 0); }catch(e){}
  }
  // orden del día real: la madrugada (antes de las 4) va al FINAL
  function minutosDe(hora){
    const [h, m] = hora.split(':').map(x => parseInt(x, 10));
    return (h < 4 ? h + 24 : h) * 60 + m;
  }
  const rutinaOrdenada = () => [...rutina].sort((a, b) => minutosDe(a.hora) - minutosDe(b.hora));

  // ⏰ alarma del sistema vía intent de Android (una PWA no puede programar
  // alarmas por sí sola; el Reloj se abre prellenado y el usuario confirma)
  const esAndroid = /android/i.test(navigator.userAgent);
  // dispara UNA alarma del sistema. skipUi=true la crea sin abrir la pantalla
  // del Reloj (para armar varias de golpe); false abre el Reloj prellenado.
  function dispararAlarma(hora, nombre, skipUi){
    const [h, m] = hora.split(':').map(x => parseInt(x, 10));
    const uri = 'intent://alarma/#Intent;action=android.intent.action.SET_ALARM;' +
      'i.android.intent.extra.alarm.HOUR=' + h + ';' +
      'i.android.intent.extra.alarm.MINUTES=' + m + ';' +
      (skipUi ? 'B.android.intent.extra.alarm.SKIP_UI=true;' : '') +
      'S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent('REPS · ' + nombre) + ';' +
      'S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
    const a = document.createElement('a');
    a.href = uri; document.body.appendChild(a); a.click(); a.remove();
  }
  function botonAlarma(s){
    const btn = document.createElement('button');
    btn.className = 'slot-alarm';
    btn.textContent = '⏰';
    btn.setAttribute('aria-label', 'Poner alarma: ' + s.nombre + ' a las ' + s.hora);
    btn.addEventListener('click', ()=>{
      if(!esAndroid){ toast('Las alarmas se ponen desde el celular. 📱'); return; }
      toast('Abriendo el Reloj… confirma la alarma ahí.');
      dispararAlarma(s.hora, s.nombre, false);
    });
    return btn;
  }
  // Alarmas del día: un recordatorio real con la app cerrada (lo dispara el
  // reloj de Android, no la PWA). Android EXIGE un toque por alarma —un intent
  // sin gesto de usuario se bloquea—, así que se listan y el usuario toca cada
  // ⏰ en fila. La fila se marca "puesta" como acuse.
  function renderAlarmList(){
    const cont = $('alarmList'); cont.innerHTML = '';
    rutinaOrdenada().forEach(s => {
      const row = document.createElement('div'); row.className = 'alarm-row';
      const t = document.createElement('div'); t.className = 'al-hora'; t.textContent = s.hora;
      const n = document.createElement('div'); n.className = 'al-nom'; n.textContent = s.nombre;
      const btn = document.createElement('button'); btn.className = 'al-btn'; btn.textContent = '⏰ Poner';
      btn.addEventListener('click', ()=>{
        if(!esAndroid){ toast('Las alarmas se ponen desde el celular. 📱'); return; }
        dispararAlarma(s.hora, s.nombre, false); // un toque = un gesto: el intent sí abre
        row.classList.add('puesta'); btn.textContent = '✓ Puesta';
      });
      row.append(t, n, btn);
      cont.appendChild(row);
    });
  }
  function armarDia(){
    renderAlarmList();
    $('alarmWrap').hidden = false;
  }

  // minutos crudos del día (0–1439), SIN el corrimiento de madrugada: para
  // "en qué bloque estoy" el reloj real manda (0:40 es de madrugada, no del final)
  function minCrudos(hora){
    const [h, m] = hora.split(':').map(x => parseInt(x, 10));
    return h * 60 + m;
  }
  // devuelve el bloque en curso y el siguiente según la hora actual
  function bloqueActual(){
    if(!rutina.length) return null;
    const orden = [...rutina].map(s => ({ s, min: minCrudos(s.hora) }))
      .sort((a, b) => a.min - b.min);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let cur = null;
    for(const o of orden){ if(o.min <= nowMin) cur = o; }
    if(!cur) cur = orden[orden.length - 1]; // antes del primer bloque: sigue el de anoche
    const next = orden.find(o => o.min > nowMin) || orden[0];
    // ventana del bloque, cruzando medianoche si hace falta
    let ini = cur.min, fin = next.min;
    if(fin <= ini) fin += 1440;
    let ahora = nowMin; if(ahora < ini) ahora += 1440;
    const dur = Math.max(1, fin - ini);
    const pct = Math.min(100, Math.max(0, Math.round((ahora - ini) / dur * 100)));
    return { cur: cur.s, next: next.s, resta: Math.max(0, fin - ahora), pct };
  }
  function textoResta(min){
    if(min >= 60){
      const h = Math.floor(min / 60), m = min % 60;
      return m ? h + ' h ' + m + ' min' : h + ' h';
    }
    return min + ' min';
  }
  function renderAhora(){
    const box = $('ahora'); if(!box) return;
    const b = bloqueActual();
    if(!b){ box.hidden = true; return; }
    box.hidden = false;
    $('ahName').textContent = b.cur.hora + ' · ' + b.cur.nombre;
    $('ahRest').textContent = 'faltan ' + textoResta(b.resta);
    $('ahBar').style.width = b.pct + '%';
    $('ahNext').textContent = 'Luego · ' + b.next.nombre + ' ' + b.next.hora;
  }

  function renderRutina(){
    const tl = $('tlList'); tl.innerHTML = '';
    const b = bloqueActual(); // #112: bloque en curso para resaltarlo
    const curId = b && b.cur ? b.cur.id : null;
    rutinaOrdenada().forEach(s => {
      const slot = document.createElement('div');
      slot.className = 'slot ' + (s.tipo === 'core' ? 'core' : 'free') + (s.id === curId ? ' now' : '');
      // asa para arrastrar el bloque en el tiempo (idea #113)
      const grip = document.createElement('span'); grip.className = 'slot-grip'; grip.textContent = '⠿';
      grip.setAttribute('aria-label', 'Arrastra para mover «' + s.nombre + '» en el tiempo');
      const t = document.createElement('div'); t.className = 't'; t.textContent = s.hora;
      const n = document.createElement('div'); n.className = 'n'; n.textContent = s.nombre + (s.id === curId ? ' · ahora' : '');
      slot.append(grip, t, n);
      if(s.desc){
        const d = document.createElement('div'); d.className = 'd'; d.textContent = s.desc;
        slot.appendChild(d);
      }
      slot.appendChild(botonAlarma(s));
      // arrastre vertical → cambia la hora (3px ≈ 1 min, se ajusta a 5)
      arrastrarBloque(grip, t, s);
      tl.appendChild(slot);
    });
  }
  // #113 arrastre de un bloque para reprogramarlo. El asa evita chocar con
  // el scroll de la página (solo arrastra si empiezas en el ⠿).
  function arrastrarBloque(grip, tLabel, s){
    grip.addEventListener('pointerdown', (e)=>{
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const startY = e.clientY; const baseMin = minCrudos(s.hora);
      let nuevoMin = baseMin;
      const move = (ev)=>{
        const delta = Math.round((ev.clientY - startY) / 3 / 5) * 5; // 3px/min, paso 5
        nuevoMin = Math.max(0, Math.min(1439, baseMin + delta));
        const h = Math.floor(nuevoMin / 60), m = nuevoMin % 60;
        tLabel.textContent = h + ':' + String(m).padStart(2, '0'); // vista previa
        tLabel.classList.add('drag');
      };
      const up = ()=>{
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        tLabel.classList.remove('drag');
        const h = Math.floor(nuevoMin / 60), m = nuevoMin % 60;
        const nueva = h + ':' + String(m).padStart(2, '0');
        if(nueva !== s.hora){ s.hora = nueva; saveRutina(); renderRutina(); renderRutEditor(); }
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  // --- editor de rutina (misma receta que el editor de hábitos) ---
  function renderRutEditor(){
    const list = $('rutList'); list.innerHTML = '';
    rutinaOrdenada().forEach(s => {
      const row = document.createElement('div'); row.className = 'hab-row';

      // ⏰ = bloque de estructura; apagado = tiempo libre
      const tipo = document.createElement('button');
      tipo.className = 'hab-star' + (s.tipo === 'core' ? ' on' : '');
      tipo.textContent = '⏰';
      tipo.setAttribute('aria-label', s.tipo === 'core' ? 'Cambiar a libre' : 'Cambiar a estructura');
      tipo.addEventListener('click', ()=>{
        s.tipo = s.tipo === 'core' ? 'free' : 'core';
        saveRutina(); renderRutina(); renderRutEditor();
      });

      // hora (input nativo de tiempo, guarda sin cero inicial)
      const hora = document.createElement('input');
      hora.type = 'time'; hora.className = 'hab-name rut-hora';
      const [hh, mm] = s.hora.split(':');
      hora.value = hh.padStart(2, '0') + ':' + mm;
      hora.setAttribute('aria-label', 'Hora del bloque');
      hora.addEventListener('change', ()=>{
        if(!/^\d{2}:\d{2}$/.test(hora.value)) return;
        s.hora = hora.value.replace(/^0(\d)/, '$1'); // '08:30' → '8:30'
        saveRutina(); renderRutina(); renderRutEditor(); // re-ordena
      });

      const nombre = document.createElement('input');
      nombre.type = 'text'; nombre.className = 'hab-name'; nombre.value = s.nombre; nombre.maxLength = 50;
      nombre.setAttribute('aria-label', 'Nombre del bloque');
      nombre.addEventListener('input', ()=>{ s.nombre = nombre.value; saveRutina(); renderRutina(); });

      const del = document.createElement('button');
      del.className = 'hab-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar bloque');
      del.addEventListener('click', ()=>{
        if(rutina.length <= 1){ toast('Deja al menos un bloque.'); return; }
        if(!confirm('¿Borrar «' + s.nombre + '» de tu rutina?')) return;
        rutina = rutina.filter(x => x.id !== s.id);
        saveRutina(); renderRutina(); renderRutEditor();
      });

      const desc = document.createElement('input');
      desc.type = 'text'; desc.className = 'hab-hint'; desc.value = s.desc; desc.maxLength = 100;
      desc.placeholder = 'Descripción (opcional)';
      desc.setAttribute('aria-label', 'Descripción del bloque');
      desc.addEventListener('input', ()=>{ s.desc = desc.value; saveRutina(); renderRutina(); });

      const top = document.createElement('div'); top.className = 'hab-top';
      top.append(tipo, hora, nombre, del);
      row.append(top, desc);
      list.appendChild(row);
    });
  }
  $('editRutBtn').addEventListener('click', ()=>{ renderRutEditor(); $('rutWrap').hidden = false; });
  $('armarBtn').addEventListener('click', armarDia);
  $('rutClose').addEventListener('click', ()=>{ $('rutWrap').hidden = true; });
  $('rutWrap').addEventListener('click', (e)=>{ if(e.target === $('rutWrap')) $('rutWrap').hidden = true; });
  $('alarmClose').addEventListener('click', ()=>{ $('alarmWrap').hidden = true; });
  $('alarmWrap').addEventListener('click', (e)=>{ if(e.target === $('alarmWrap')) $('alarmWrap').hidden = true; });
  $('planSemBtn').addEventListener('click', abrirPlanSem);
  $('psSave').addEventListener('click', guardarPlanSem);
  $('psClose').addEventListener('click', ()=>{ $('planSemWrap').hidden = true; });
  $('planSemWrap').addEventListener('click', (e)=>{ if(e.target === $('planSemWrap')) $('planSemWrap').hidden = true; });
  $('storyRing').addEventListener('click', abrirStories);
  $('stClose').addEventListener('click', cerrarStories);
  $('stNext').addEventListener('click', siguienteStory);
  $('stPrev').addEventListener('click', anteriorStory);
  $('stShare').addEventListener('click', ()=>{
    clearTimeout(stTimer); // pausa el auto-avance mientras compartes
    const canvas = drawStoryImage();
    if(canvas) compartirCanvas(canvas, 'reps-story.png', 'Mi día en REPS');
  });
  $('rutAdd').addEventListener('click', ()=>{
    if(rutina.length >= MAX_BLOQUES){ toast('Máximo ' + MAX_BLOQUES + ' bloques.'); return; }
    rutina.push({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,5), hora:'12:00', nombre:'Nuevo bloque', desc:'', tipo:'free' });
    saveRutina(); renderRutina(); renderRutEditor();
  });

  // ===== Plantillas de rutina =====
  // Días base listos para distintas vidas. Cada quien elige el suyo y lo
  // ajusta: la estructura del día también se moldea a la persona.
  const RUTINA_PLANTILLAS = [
    { id:'productivo', nombre:'Mañana productiva', sub:'Madrugar y sacar lo importante temprano', bloques:[
      {hora:'6:30', nombre:'Despertar', desc:'Cama, agua, sol. Sin pantallas.', tipo:'core'},
      {hora:'7:00', nombre:'Moverte', desc:'20–30 min de ejercicio.', tipo:'core'},
      {hora:'8:00', nombre:'Baño + desayuno', desc:'Tranquilo.', tipo:'free'},
      {hora:'9:00', nombre:'Bloque de enfoque', desc:'Lo más importante, sin distracciones.', tipo:'core'},
      {hora:'13:00', nombre:'Comida', desc:'Sin celular.', tipo:'free'},
      {hora:'15:00', nombre:'Segundo bloque', desc:'Pendientes o aprender.', tipo:'core'},
      {hora:'18:00', nombre:'Tiempo libre', desc:'Tus cosas, gente.', tipo:'free'},
      {hora:'22:30', nombre:'Bajar revoluciones', desc:'Leer, celular lejos.', tipo:'core'},
      {hora:'23:00', nombre:'A dormir', desc:'Constante, no perfecto.', tipo:'core'},
    ]},
    { id:'estudiante', nombre:'Día de estudio', sub:'Bloques de estudio con descansos', bloques:[
      {hora:'7:00', nombre:'Despertar', desc:'Arranca sin prisa.', tipo:'core'},
      {hora:'7:45', nombre:'Repaso ligero', desc:'Revisa lo de ayer.', tipo:'free'},
      {hora:'9:00', nombre:'Estudio profundo', desc:'45 min y descansa.', tipo:'core'},
      {hora:'11:00', nombre:'Descanso', desc:'Camina, despeja.', tipo:'free'},
      {hora:'12:00', nombre:'Segundo bloque de estudio', desc:'Otra materia.', tipo:'core'},
      {hora:'14:00', nombre:'Comida + pausa', desc:'Desconecta un rato.', tipo:'free'},
      {hora:'16:00', nombre:'Tareas / práctica', desc:'Ejercicios, entregas.', tipo:'core'},
      {hora:'19:00', nombre:'Libre', desc:'Te lo ganaste.', tipo:'free'},
      {hora:'22:30', nombre:'Leer + dormir', desc:'Descansa la mente.', tipo:'core'},
    ]},
    { id:'trabajo', nombre:'Día de trabajo', sub:'Alrededor de tu jornada laboral', bloques:[
      {hora:'7:00', nombre:'Despertar', desc:'Rutina de mañana.', tipo:'core'},
      {hora:'7:30', nombre:'Moverte o estirar', desc:'Activa el cuerpo.', tipo:'free'},
      {hora:'9:00', nombre:'Trabajo', desc:'Tu jornada.', tipo:'core'},
      {hora:'14:00', nombre:'Comida', desc:'Despega de la pantalla.', tipo:'free'},
      {hora:'18:00', nombre:'Cierre laboral', desc:'Ordena y suelta el trabajo.', tipo:'core'},
      {hora:'19:00', nombre:'Algo tuyo', desc:'Ejercicio, hobby, gente.', tipo:'core'},
      {hora:'22:00', nombre:'Relajarte', desc:'Sin trabajo ya.', tipo:'free'},
      {hora:'23:00', nombre:'A dormir', desc:'Recarga.', tipo:'core'},
    ]},
    { id:'tranquilo', nombre:'Día tranquilo', sub:'Ligero: descanso o fin de semana', bloques:[
      {hora:'8:30', nombre:'Despertar sin alarma', desc:'A tu ritmo.', tipo:'free'},
      {hora:'10:00', nombre:'Algo que disfrutes', desc:'Paseo, hobby, cocinar.', tipo:'free'},
      {hora:'13:00', nombre:'Comida rica', desc:'Con calma.', tipo:'free'},
      {hora:'16:00', nombre:'Una cosa útil', desc:'Un pendiente chiquito.', tipo:'core'},
      {hora:'19:00', nombre:'Gente que quieres', desc:'Tiempo real, presente.', tipo:'free'},
      {hora:'23:00', nombre:'A dormir', desc:'Descansa de verdad.', tipo:'core'},
    ]},
  ];
  function renderRutPlantillas(){
    const cont = $('rutPlanList'); cont.innerHTML = '';
    RUTINA_PLANTILLAS.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rutplan';
      const nm = document.createElement('div'); nm.className = 'rp-nm'; nm.textContent = p.nombre;
      const sub = document.createElement('div'); sub.className = 'rp-sub'; sub.textContent = p.sub;
      const prev = document.createElement('div'); prev.className = 'rp-prev';
      prev.textContent = p.bloques.slice(0, 4).map(x => x.hora + ' ' + x.nombre).join(' · ') + '…';
      b.append(nm, sub, prev);
      b.addEventListener('click', ()=>{
        if(!confirm('Esto reemplaza tu rutina actual (' + rutina.length + ' bloques) por «' + p.nombre + '». ¿Aplicar?')) return;
        rutina = p.bloques.map(x => ({ id:'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,5), ...x }));
        saveRutina(); renderRutina(); renderRutEditor();
        $('rutPlanWrap').hidden = true;
        toast('Rutina «' + p.nombre + '» aplicada. Ajústala a tu gusto. 🗓️');
      });
      cont.appendChild(b);
    });
  }
  // #114 plantillas PROPIAS: guarda tu rutina actual (ej. «Entre semana»,
  // «Finde») y aplícala cuando quieras.
  const RUT_TPL_KEY = 'reps-rutina-tpl';
  let rutTpl = []; // [{id, nombre, bloques}]
  function loadRutTpl(){
    rutTpl = [];
    try{ const v = JSON.parse(localStorage.getItem(RUT_TPL_KEY));
      if(Array.isArray(v)) rutTpl = v.filter(t => t && typeof t.nombre === 'string' && Array.isArray(t.bloques))
        .map(t => ({ id: t.id || ('t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)), nombre: t.nombre.trim().slice(0,30), bloques: sanearRutina(t.bloques) || [] }))
        .filter(t => t.bloques.length);
    }catch(e){ rutTpl = []; }
  }
  function saveRutTpl(){ try{ localStorage.setItem(RUT_TPL_KEY, JSON.stringify(rutTpl)); }catch(e){} }
  function renderRutPlanUser(){
    const cont = $('rutPlanUser'); if(!cont) return; cont.innerHTML = '';
    if(!rutTpl.length) return;
    const t = document.createElement('div'); t.className = 't-sub'; t.textContent = 'Tus plantillas'; t.style.marginTop = '0';
    cont.appendChild(t);
    rutTpl.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rutplan';
      const nm = document.createElement('div'); nm.className = 'rp-nm'; nm.textContent = p.nombre;
      const prev = document.createElement('div'); prev.className = 'rp-prev';
      prev.textContent = [...p.bloques].sort((a,c)=>minutosDe(a.hora)-minutosDe(c.hora)).slice(0,4).map(x => x.hora + ' ' + x.nombre).join(' · ') + '…';
      const del = document.createElement('span'); del.className = 'rp-del'; del.textContent = '✕'; del.setAttribute('role','button'); del.setAttribute('aria-label','Borrar plantilla');
      del.addEventListener('click', (e)=>{ e.stopPropagation(); if(!confirm('¿Borrar la plantilla «' + p.nombre + '»?')) return; rutTpl = rutTpl.filter(x => x.id !== p.id); saveRutTpl(); renderRutPlanUser(); });
      b.append(nm, prev, del);
      b.addEventListener('click', ()=>{
        if(!confirm('Reemplazar tu rutina actual por «' + p.nombre + '»?')) return;
        rutina = p.bloques.map(x => ({ id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), ...x }));
        saveRutina(); renderRutina(); renderRutEditor(); $('rutPlanWrap').hidden = true;
        toast('Rutina «' + p.nombre + '» aplicada.');
      });
      cont.appendChild(b);
    });
  }
  $('rutSaveTpl').addEventListener('click', ()=>{
    const nombre = (prompt('Nombre de la plantilla (ej. «Entre semana», «Finde»):', '') || '').trim().slice(0,30);
    if(!nombre) return;
    rutTpl.unshift({ id:'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), nombre, bloques: rutina.map(s => ({ hora:s.hora, nombre:s.nombre, desc:s.desc, tipo:s.tipo })) });
    saveRutTpl(); renderRutPlanUser(); toast('Plantilla «' + nombre + '» guardada. 💾');
  });
  $('rutPlantilla').addEventListener('click', ()=>{ renderRutPlanUser(); renderRutPlantillas(); $('rutPlanWrap').hidden = false; });
  $('rutPlanClose').addEventListener('click', ()=>{ $('rutPlanWrap').hidden = true; });
  $('rutPlanWrap').addEventListener('click', (e)=>{ if(e.target === $('rutPlanWrap')) $('rutPlanWrap').hidden = true; });

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

  // ===== Despertar a tiempo =====
  // Registras a qué hora despertaste; puntual o antes suma al puntaje, tarde
  // resta (según el rigor). Los fines de semana no cuentan salvo que marques
  // "hoy sí cuenta". NO toca isWon/racha: es solo un modificador del puntaje.
  // Config global en reps-despertar; la hora del día vive en cierres[fecha]
  // (.despierta = "H:MM", .despiertaCuenta = override opcional del finde).
  const DESPERTAR_KEY = 'reps-despertar';
  let despConf = { meta: '8:30', rigor: 'medio', finde: false };
  const esHora = h => typeof h === 'string' && /^\d{1,2}:\d{2}$/.test(h);
  function loadDespertar(){
    try{
      const v = JSON.parse(localStorage.getItem(DESPERTAR_KEY));
      if(esMapa(v)) despConf = {
        meta: esHora(v.meta) ? v.meta : '8:30',
        rigor: ['suave','medio','estricto'].includes(v.rigor) ? v.rigor : 'medio',
        finde: !!v.finde,
      };
    }catch(e){}
  }
  function saveDespertar(){
    try{ localStorage.setItem(DESPERTAR_KEY, JSON.stringify(despConf)); }catch(e){}
  }
  const minsHora = h => { const [a,b] = h.split(':').map(x=>parseInt(x,10)); return a*60+b; };
  const graceDesp = r => r === 'suave' ? 120 : r === 'medio' ? 30 : 0;   // margen sin castigo
  const rateDesp  = r => r === 'suave' ? 3   : r === 'medio' ? 5  : 8;    // puntos perdidos por hora tarde
  // evalúa el despertar de una fecha: hora registrada, si cuenta, y el
  // modificador de puntaje que produce (+ si puntual, − si tarde)
  function despertarEval(fecha){
    const c = cierres[fecha] || {};
    const logged = esHora(c.despierta) ? c.despierta : null;
    const dow = new Date(fecha + 'T12:00:00').getDay();
    const finde = dow === 0 || dow === 6;
    const cuenta = typeof c.despiertaCuenta === 'boolean' ? c.despiertaCuenta : (finde ? despConf.finde : true);
    let dt = null, estado = 'none', modifier = 0;
    if(logged){
      dt = minsHora(logged) - minsHora(despConf.meta); // + = tarde
      if(!cuenta){ estado = 'nocuenta'; }
      else if(dt <= graceDesp(despConf.rigor)){ estado = 'ontime'; modifier = 6; }
      else { estado = 'late'; modifier = -Math.min(15, Math.round((dt - graceDesp(despConf.rigor)) / 60 * rateDesp(despConf.rigor))); }
    }
    return { logged, meta: despConf.meta, dt, finde, cuenta, estado, modifier };
  }
  function textoDespertar(e){
    if(!e.logged) return 'Registra a qué hora despertaste.';
    if(e.estado === 'nocuenta') return 'Fin de semana relajado · no afecta tu puntaje.';
    if(e.estado === 'ontime') return e.dt < 0 ? '✓ ' + (-e.dt) + ' min antes de tu meta. +' + e.modifier + ' pts' :
      '✓ Puntual (dentro del margen). +' + e.modifier + ' pts';
    return '⚠ ' + e.dt + ' min tarde · ' + e.modifier + ' pts';
  }
  // construye el control de despertar para una fecha (se usa en Hoy y en el
  // detalle de un día pasado). Al cambiar, guarda y repinta todo con render().
  function buildDespertarUI(fecha){
    const e = despertarEval(fecha);
    const wrap = document.createElement('div'); wrap.className = 'desp';
    const top = document.createElement('div'); top.className = 'desp-top';
    top.textContent = '⏰ Despertar · meta ' + e.meta;
    const row = document.createElement('div'); row.className = 'desp-row';
    const inp = document.createElement('input'); inp.type = 'time'; inp.className = 'desp-hora';
    if(e.logged) inp.value = e.logged.padStart(5, '0');
    inp.addEventListener('change', ()=>{
      const cc = cierres[fecha] || {};
      if(inp.value) cc.despierta = inp.value; else delete cc.despierta;
      cierres[fecha] = cc; saveCierres(); render();
    });
    row.appendChild(inp);
    const est = document.createElement('div'); est.className = 'desp-estado ' + e.estado;
    est.textContent = textoDespertar(e);
    wrap.append(top, row, est);
    if(e.finde){
      const tog = document.createElement('button'); tog.type = 'button';
      tog.className = 'desp-cuenta' + (e.cuenta ? ' on' : '');
      tog.textContent = e.cuenta ? '✓ Este día sí cuenta' : 'Hacer que este día cuente';
      tog.addEventListener('click', ()=>{
        const cc = cierres[fecha] || {};
        const cur = typeof cc.despiertaCuenta === 'boolean' ? cc.despiertaCuenta : despConf.finde;
        cc.despiertaCuenta = !cur; cierres[fecha] = cc; saveCierres(); render();
      });
      wrap.appendChild(tog);
    }
    return wrap;
  }

  // botones de ánimo: uno activo a la vez; tocar el activo lo des-selecciona
  document.querySelectorAll('.mood').forEach(b => {
    b.addEventListener('click', ()=>{
      moodSel = (moodSel === b.dataset.mood) ? null : b.dataset.mood;
      document.querySelectorAll('.mood').forEach(x =>
        x.classList.toggle('active', x.dataset.mood === moodSel));
    });
  });

  // #41 ánimo detallado: emociones opcionales (una a la vez) en el cierre
  const EMOCIONES = [
    {id:'energico', emoji:'⚡', name:'Con energía'},
    {id:'tranquilo',emoji:'😌', name:'Tranquilo'},
    {id:'motivado', emoji:'🚀', name:'Motivado'},
    {id:'contento', emoji:'😊', name:'Contento'},
    {id:'cansado',  emoji:'😮‍💨', name:'Cansado'},
    {id:'estresado',emoji:'😰', name:'Estresado'},
    {id:'triste',   emoji:'😔', name:'Triste'},
    {id:'enojado',  emoji:'😤', name:'Enojado'},
  ];
  let emoSel = null;
  function renderEmociones(){
    const wrap = $('emoRow'); wrap.innerHTML = '';
    EMOCIONES.forEach(e => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'emo-chip' + (emoSel === e.id ? ' on' : '');
      b.textContent = e.emoji + ' ' + e.name;
      b.addEventListener('click', ()=>{ emoSel = (emoSel === e.id) ? null : e.id; renderEmociones(); });
      wrap.appendChild(b);
    });
  }

  $('cierreBtn').addEventListener('click', ()=>{
    const notas = $('notasHoy').value.trim();
    const plan = $('planManana').value.trim();
    if(!moodSel && !emoSel && !notas && !plan){ toast('El cierre está vacío.'); return; }
    // merge: preserva otros campos del día (despierta, despiertaCuenta…)
    cierres[today()] = Object.assign({}, cierres[today()] || {}, { animo: moodSel, emocion: emoSel, notas, plan, guardado: new Date().toISOString() });
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
    emoSel = EMOCIONES.some(e => e.id === c.emocion) ? c.emocion : null;
    renderEmociones();
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
    const flex = (semFlex[today()] || '').trim();
    $('planHoy').hidden = partes.length === 0 && !flex;
    $('planHoyTxt').textContent = partes.join(' · ');
    $('planHoyFlex').hidden = !flex;
    $('planHoyFlex').textContent = flex ? '\n🤖 ' + flex : '';
  }

  // ===== Frase del día =====
  // Una cita que rota cada día (índice = día del año). 100% local, sin internet.
  const FRASES = [
    ['El secreto para salir adelante es empezar.', 'Mark Twain'],
    ['No cuentes los días, haz que los días cuenten.', 'Muhammad Ali'],
    ['La disciplina es el puente entre metas y logros.', 'Jim Rohn'],
    ['Lo que haces cada día importa más que lo que haces de vez en cuando.', 'Gretchen Rubin'],
    ['Un poco de progreso cada día suma grandes resultados.', 'Anónimo'],
    ['No tienes que ser grande para empezar, pero tienes que empezar para ser grande.', 'Zig Ziglar'],
    ['La motivación te pone en marcha; el hábito te mantiene.', 'Jim Rohn'],
    ['Caer está permitido. Levantarse es obligatorio.', 'Proverbio'],
    ['Hazlo hoy. El mañana perfecto nunca llega.', 'Anónimo'],
    ['Somos lo que hacemos repetidamente.', 'Aristóteles'],
    ['El único mal entrenamiento es el que no hiciste.', 'Anónimo'],
    ['Pequeños pasos también son pasos hacia adelante.', 'Anónimo'],
    ['La constancia vence al talento cuando el talento no es constante.', 'Anónimo'],
    ['Enfócate en el sistema, no solo en la meta.', 'James Clear'],
    ['Cada acción es un voto por la persona que quieres ser.', 'James Clear'],
    ['No busques ser perfecto, busca ser constante.', 'Anónimo'],
    ['El futuro depende de lo que hagas hoy.', 'Gandhi'],
    ['Empieza donde estás, usa lo que tienes, haz lo que puedas.', 'Arthur Ashe'],
    ['La energía y la persistencia lo conquistan todo.', 'Benjamin Franklin'],
    ['Tu único límite eres tú, y hoy puedes moverlo un poco.', 'Anónimo'],
    ['La calma también es productividad.', 'Anónimo'],
    ['Lo difícil de hoy es la fuerza de mañana.', 'Anónimo'],
  ];
  function renderFrase(){
    const inicio = new Date(new Date().getFullYear(), 0, 0);
    const dia = Math.floor((new Date() - inicio) / 86400000); // día del año
    const [txt, aut] = FRASES[dia % FRASES.length];
    const el = $('frase');
    el.hidden = false;
    el.textContent = '“' + txt + '”';
    const a = document.createElement('span'); a.className = 'fr-aut'; a.textContent = '— ' + aut;
    el.appendChild(a);
  }

  // ===== Resumen de la mañana (IA, 1×/día) =====
  // Al abrir la app en un día nuevo, la IA arma un saludo breve con lo que
  // toca hoy (evento, bloque en curso, un consejo). Se cachea por fecha en
  // reps-brief para no re-generar (ni gastar) el mismo día y servir offline.
  const BRIEF_KEY = 'reps-brief';
  let brief = { fecha:'', texto:'' };
  function loadBrief(){
    brief = { fecha:'', texto:'' };
    try{
      const v = JSON.parse(localStorage.getItem(BRIEF_KEY));
      if(esMapa(v) && typeof v.texto === 'string'){ brief.fecha = String(v.fecha||''); brief.texto = v.texto; }
    }catch(e){}
  }
  function saveBrief(){
    try{ localStorage.setItem(BRIEF_KEY, JSON.stringify(brief)); }catch(e){}
  }
  // arma el resumen con la IA (a menos que forzar sea false y ya haya de hoy)
  async function generarBrief(forzar){
    const k = today();
    if(!forzar && brief.fecha === k && brief.texto){ pintarBrief(); return; }
    if(iaOcupado){ return; }
    // saludo local mientras piensa (o si no hay internet, se queda este)
    $('brief').hidden = false;
    $('briefBody').classList.add('loading');
    $('briefBody').textContent = 'Preparando tu resumen…';
    iaOcupado = true;
    const deSemana = (semana[k] || '').trim();
    const flex = (semFlex[k] || '').trim();
    const b = bloqueActual();
    const extra = [];
    if(deSemana) extra.push('Lo que tengo hoy: ' + deSemana);
    if(flex) extra.push('Ajuste sugerido del día: ' + flex);
    if(b) extra.push('Bloque en curso: ' + b.cur.hora + ' ' + b.cur.nombre + '; luego ' + b.next.nombre + ' ' + b.next.hora);
    const sistema = contextoIA() + '\nEscribe un RESUMEN DE LA MAÑANA cálido y motivante, máximo 3 frases cortas. ' +
      'Saluda por su nombre si lo sabes, di qué es lo más importante de hoy y UNA acción concreta para arrancar. ' +
      'Nada de listas ni markdown: texto corrido, cercano.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Arma mi resumen de hoy. ' + extra.join('. ') }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      const txt = (d.texto || '').trim();
      if(!txt) throw new Error('vacío');
      brief = { fecha:k, texto:txt }; saveBrief();
      pintarBrief();
    }catch(e){
      // sin internet: si hay uno viejo, se muestra; si no, se oculta la tarjeta
      if(brief.texto) pintarBrief();
      else $('brief').hidden = true;
    }
    iaOcupado = false;
  }
  function pintarBrief(){
    if(!brief.texto){ $('brief').hidden = true; return; }
    $('brief').hidden = false;
    $('briefBody').classList.remove('loading');
    $('briefBody').textContent = brief.texto;
  }
  // en init / al despertar en día nuevo: muestra el de hoy o genera si falta
  function renderBrief(){
    if(brief.fecha === today() && brief.texto){ pintarBrief(); }
    else { generarBrief(false); } // día nuevo (o primera vez): la IA lo arma
  }

  // ===== Arma mi día (IA, #31) =====
  // Cada mañana: la IA organiza el día con tus hábitos pendientes y tu rutina
  // según el tiempo que tengas. Si no alcanza, prioriza los core y sugiere las
  // versiones mínimas del resto. reps-diaplan {fecha,texto} guarda el aplicado.
  const DIAPLAN_KEY = 'reps-diaplan';
  let diaPlan = { fecha:'', texto:'' };
  let adPropuesta = '';
  function loadDiaPlan(){
    diaPlan = { fecha:'', texto:'' };
    try{ const v = JSON.parse(localStorage.getItem(DIAPLAN_KEY));
      if(esMapa(v) && typeof v.texto === 'string'){ diaPlan.fecha = String(v.fecha||''); diaPlan.texto = v.texto; } }catch(e){}
  }
  function saveDiaPlan(){ try{ localStorage.setItem(DIAPLAN_KEY, JSON.stringify(diaPlan)); }catch(e){} }
  function renderDiaPlan(){
    const on = diaPlan.fecha === today() && diaPlan.texto.trim();
    $('diaPlanCard').hidden = !on;
    if(on) $('diaPlanBody').textContent = diaPlan.texto;
  }
  // contexto del día para la IA: hábitos pendientes hoy + rutina + pendientes
  function contextoDia(){
    const k = today(), dow = dowDe(k), rec = dias[k] || {};
    const pend = HABITS.filter(h => habAplica(h, dow) && !hecho(rec, h.id))
      .map(h => h.name + (h.core ? ' (innegociable)' : '') + (h.planB ? ' [mínimo: ' + h.planB + ']' : ''));
    const p = [];
    if(pend.length) p.push('Hábitos que me faltan hoy: ' + pend.join('; ') + '.');
    else p.push('Ya cumplí mis hábitos de hoy.');
    const rut = rutinaOrdenada();
    if(rut.length) p.push('Mi rutina base: ' + rut.map(x => x.hora + ' ' + x.nombre).join(', ') + '.');
    const ps = planSemana[localISO(mondayOf(new Date()))];
    if(ps && ps.pendientes) p.push('Pendientes de la semana: ' + ps.pendientes + '.');
    const sm = (semana[k] || '').trim();
    if(sm) p.push('Ya tenía anotado para hoy: ' + sm + '.');
    return p.join(' ');
  }
  $('armaDia').addEventListener('click', ()=>{
    adPropuesta = ''; $('adOut').hidden = true; $('adSave').hidden = true; $('armaDiaWrap').hidden = false;
  });
  $('adClose').addEventListener('click', ()=>{ $('armaDiaWrap').hidden = true; });
  $('armaDiaWrap').addEventListener('click', (e)=>{ if(e.target === $('armaDiaWrap')) $('armaDiaWrap').hidden = true; });
  $('adGo').addEventListener('click', async ()=>{
    if(iaOcupado) return; iaOcupado = true;
    adPropuesta = ''; $('adSave').hidden = true;
    const out = $('adOut'); out.hidden = false; out.textContent = 'Organizando tu día… ✨';
    const hora = new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
    const sistema = 'Eres un organizador del día, cálido y realista. Con el tiempo disponible y los compromisos de la ' +
      'persona, arma un plan para HOY por bloques con horas ("HH:MM — actividad"), metiendo sus hábitos pendientes. ' +
      'REGLA CLAVE: si no alcanza el tiempo para todo, prioriza los hábitos innegociables, usa la versión mínima de los ' +
      'demás y di con claridad qué conviene dejar para otro día. Sé breve y concreto, en español, sin markdown. Ahora son las ' + hora + '.';
    const preg = (($('adInput').value.trim()) ? 'Así viene mi día: ' + $('adInput').value.trim() + '. ' : '') + contextoDia();
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: preg }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      adPropuesta = (d.texto || '').trim();
      out.textContent = adPropuesta || 'No pude armar el día. Intenta de nuevo.';
      $('adSave').hidden = !adPropuesta;
    }catch(e){ out.textContent = 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'; }
    iaOcupado = false;
  });
  $('adSave').addEventListener('click', ()=>{
    if(!adPropuesta) return;
    diaPlan = { fecha: today(), texto: adPropuesta }; saveDiaPlan(); renderDiaPlan();
    $('armaDiaWrap').hidden = true;
    toast('Guardado. Tu plan de hoy está en la pantalla de inicio. ✨');
  });
  $('diaPlanClear').addEventListener('click', ()=>{
    diaPlan = { fecha:'', texto:'' }; saveDiaPlan(); renderDiaPlan();
  });

  // detalle EDITABLE de cualquier día (hoy o pasado): permite marcar hábitos,
  // poner el ánimo y escribir notas que recuerdas después. La honestidad
  // tardía vale: nunca serás perfecto, pero sí honesto.
  function showDayDetail(key){
    if(detailKey === key && !$('calDetail').hidden){ // tocar de nuevo lo cierra
      $('calDetail').hidden = true; detailKey = null; return;
    }
    detailKey = key;
    $('calDetail').hidden = false;
    pintarDayDetail(key);
  }
  // repinta el contenido del detalle (se llama al abrir y tras cada edición)
  function pintarDayDetail(key){
    const c = cierres[key] || {};
    const r = dias[key] || {};

    $('cdFecha').textContent =
      new Date(key + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});

    // estado del día (se recalcula tras cada cambio)
    const coreDia = coreDelDia(key);
    const coreHechos = coreDia.filter(id => hecho(r, id)).length;
    $('cdEstado').textContent =
      esGanado(key) ? '🔥 Ganado' :
      esDescanso(key) ? '· Descanso' :
      racha.congelados[key] ? '🧊 Congelado' :
      HABITS.some(h => r[h.id]) ? 'Parcial ' + coreHechos + '/' + coreDia.length :
      'Sin registro';

    // hábitos que APLICABAN ese día, como toggles editables
    const dow = dowDe(key);
    const habs = HABITS.filter(h => habAplica(h, dow));
    const cont = $('cdHabList'); cont.innerHTML = '';
    if(!habs.length){
      const vacio = document.createElement('div'); vacio.className = 'cd-vacio';
      vacio.textContent = 'Ese día era de descanso: no tocaba ningún hábito.';
      cont.appendChild(vacio);
    }
    habs.forEach(h => {
      const done = hecho(r, h.id);
      const num = h.meta > 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cd-hab' + (done ? ' on' : '');
      const chk = document.createElement('span'); chk.className = 'cd-chk'; chk.textContent = done ? '✓' : '';
      const nm = document.createElement('span'); nm.className = 'cd-hab-nm';
      const etiqueta = num ? h.name + ' · ' + (Number(r[h.id])||0) + '/' + h.meta : h.name + (h.core ? '' : ' · extra');
      nm.textContent = (h.emoji ? h.emoji + ' ' : '') + etiqueta;
      btn.append(chk, nm);
      btn.addEventListener('click', ()=>{
        const cur = dias[key] || {};
        if(num){ // contador: alterna entre completo (meta) y vacío
          if(hecho(cur, h.id)) delete cur[h.id]; else cur[h.id] = h.meta;
        } else {
          cur[h.id] = !cur[h.id];
          if(!cur[h.id]) delete cur[h.id]; // no dejar false: registro vacío = válido
        }
        dias[key] = cur;
        save();
        pintarDayDetail(key); render(); renderCal(); // recalcula todo con el cambio
      });
      cont.appendChild(btn);
    });

    // ánimo: 3 botones que fijan/limpian cierres[key].animo
    const moodsC = $('cdMoods'); moodsC.innerHTML = '';
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cd-mood' + (c.animo === m.id ? ' on' : '');
      btn.textContent = m.emoji + ' ' + m.name;
      btn.addEventListener('click', ()=>{
        const cc = cierres[key] || {};
        cc.animo = cc.animo === m.id ? null : m.id; // volver a tocar lo quita
        cc.guardado = true;
        cierres[key] = cc; saveCierres();
        pintarDayDetail(key); renderStats();
      });
      moodsC.appendChild(btn);
    });

    // despertar de ese día (registrar/editar la hora también en retrospectiva)
    const dw = $('cdDespWrap');
    if(dw){ dw.innerHTML = ''; dw.appendChild(buildDespertarUI(key)); }

    // notas: se guardan al escribir (sin botón)
    const notas = $('cdNotasInp');
    notas.value = c.notas || '';
    notas.oninput = ()=>{
      const cc = cierres[key] || {};
      cc.notas = notas.value; cc.guardado = true;
      cierres[key] = cc; saveCierres();
    };
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
  const AUTO_KEY = 'reps-tema-auto'; // "1" = cambia claro/oscuro por hora
  let themeSel = {modo:'preset', id:'carbon'};
  let temaAuto = false;

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

  // ¿es de día? (para el modo automático). 7:00–18:59 = día
  function esHoraDia(){ const h = new Date().getHours(); return h >= 7 && h < 19; }
  // ¿el tema elegido por el usuario es claro?
  function selEsClaro(sel){
    if(sel.modo === 'custom') return isLight(sel.bg);
    return isLight((THEMES.find(x => x.id === sel.id) || THEMES[0]).vars.bg);
  }
  // tema efectivo: si auto está activo, alterna claro (día) / el elegido (noche).
  // Si el usuario ya eligió un tema claro, ese se usa de día y Carbón de noche.
  function selEfectivo(){
    if(!temaAuto) return themeSel;
    const baseClaro = selEsClaro(themeSel);
    if(esHoraDia()) return baseClaro ? themeSel : {modo:'preset', id:'claro'};
    return baseClaro ? {modo:'preset', id:'carbon'} : themeSel;
  }
  function currentVars(){
    const sel = selEfectivo();
    if(sel.modo === 'custom') return customVars(sel.accent, sel.bg);
    const t = THEMES.find(x => x.id === sel.id) || THEMES[0];
    return t.vars;
  }
  function applyThemeSel(){ applyVars(currentVars()); try{ applyGrad(); }catch(e){} }
  function loadTemaAuto(){ temaAuto = localStorage.getItem(AUTO_KEY) === '1'; }
  function saveTemaAuto(){
    try{ if(temaAuto) localStorage.setItem(AUTO_KEY, '1'); else localStorage.removeItem(AUTO_KEY); }catch(e){}
  }

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

  // abre el sheet de Apariencia (tema, color, distribución, tipografía, efecto)
  function abrirApariencia(){
    renderThemeUI();
    marcarAuto();
    renderGradCfg();  // #108 fondo degradado
    renderHoyCfg();   // #106/#107 personalizar Hoy
    renderSonCfg();   // #109 sonidos por acción
    $('themeWrap').hidden = false;
  }
  // abre el sheet de Avisos y sonido (sonidos, despertar, notificaciones)
  function abrirNotif(){
    $('sonidoToggle').checked = focoSonido;
    $('despMeta').value = despConf.meta.padStart(5, '0');
    $('despFinde').checked = despConf.finde;
    document.querySelectorAll('#despRigor button').forEach(b => b.classList.toggle('on', b.dataset.r === despConf.rigor));
    $('pushToggle').checked = pushActivo();
    $('notifWrap').hidden = false;
  }
  // el ⚙ del encabezado abre el menú de Ajustes (hub)
  const cerrarMas = ()=>{ $('masWrap').hidden = true; };
  $('themeBtn').addEventListener('click', ()=>{ $('masWrap').hidden = false; });
  $('masClose').addEventListener('click', cerrarMas);
  $('masWrap').addEventListener('click', (e)=>{ if(e.target === $('masWrap')) cerrarMas(); });
  $('masFin').addEventListener('click', ()=>{ cerrarMas(); abrirFinanzas(); });
  $('masApariencia').addEventListener('click', ()=>{ cerrarMas(); abrirApariencia(); });
  $('masNotif').addEventListener('click', ()=>{ cerrarMas(); abrirNotif(); });
  $('masHabitos').addEventListener('click', ()=>{ cerrarMas(); renderHabEditor(); $('habWrap').hidden = false; });
  $('masRutina').addEventListener('click', ()=>{ cerrarMas(); renderRutEditor(); $('rutWrap').hidden = false; });
  $('masEvitar').addEventListener('click', ()=>{ cerrarMas(); renderEvitarEditor(); $('evitarWrap').hidden = false; });
  $('masCarta').addEventListener('click', ()=>{ cerrarMas(); abrirCarta(); });
  $('masPerfil').addEventListener('click', ()=>{ cerrarMas(); abrirBienvenida(); });
  $('masExport').addEventListener('click', ()=>{ cerrarMas(); exportBackup(); });
  $('masImport').addEventListener('click', ()=>{ cerrarMas(); $('importFile').click(); });
  $('masReset').addEventListener('click', ()=>{ cerrarMas(); $('resetBtn').click(); });
  $('notifClose').addEventListener('click', ()=>{ $('notifWrap').hidden = true; });
  $('notifWrap').addEventListener('click', (e)=>{ if(e.target === $('notifWrap')) $('notifWrap').hidden = true; });
  $('sonidoToggle').addEventListener('change', ()=>{
    focoSonido = $('sonidoToggle').checked; saveSonido();
    if(focoSonido) sonarCheck(); // pequeña confirmación al encender
  });
  $('despMeta').addEventListener('change', ()=>{
    if(esHora($('despMeta').value)){ despConf.meta = $('despMeta').value; saveDespertar(); render(); }
  });
  $('despFinde').addEventListener('change', ()=>{ despConf.finde = $('despFinde').checked; saveDespertar(); render(); });
  document.querySelectorAll('#despRigor button').forEach(b => b.addEventListener('click', ()=>{
    despConf.rigor = b.dataset.r; saveDespertar();
    document.querySelectorAll('#despRigor button').forEach(x => x.classList.toggle('on', x === b));
    render();
  }));
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

  // ===== Posición de la barra de navegación (arriba / abajo) =====
  const NAV_KEY = 'reps-nav';
  let navPos = 'abajo'; // predeterminado: barra abajo (estilo app moderna)
  function loadNav(){
    try{ navPos = localStorage.getItem(NAV_KEY) === 'arriba' ? 'arriba' : 'abajo'; }catch(e){ navPos = 'abajo'; }
  }
  function applyNav(){
    document.body.classList.toggle('nav-bottom', navPos === 'abajo');
    document.querySelectorAll('.dist-opt[data-nav]').forEach(b =>
      b.classList.toggle('active', b.dataset.nav === navPos));
  }
  document.querySelectorAll('.dist-opt[data-nav]').forEach(b => {
    b.addEventListener('click', ()=>{
      navPos = b.dataset.nav;
      try{
        if(navPos === 'arriba') localStorage.setItem(NAV_KEY, 'arriba'); // abajo = por defecto (sin clave)
        else localStorage.removeItem(NAV_KEY);
      }catch(e){}
      applyNav();
    });
  });

  // ===== Tipografía (elegante serif / sistema) =====
  const FONT_KEY = 'reps-fuente';
  let fuente = 'serif'; // predeterminado: títulos elegantes
  function loadFont(){
    try{ fuente = localStorage.getItem(FONT_KEY) === 'sistema' ? 'sistema' : 'serif'; }catch(e){ fuente = 'serif'; }
  }
  function applyFont(){
    document.body.classList.toggle('font-serif', fuente === 'serif');
    document.querySelectorAll('.dist-opt[data-font]').forEach(b =>
      b.classList.toggle('active', b.dataset.font === fuente));
  }
  document.querySelectorAll('.dist-opt[data-font]').forEach(b => {
    b.addEventListener('click', ()=>{
      fuente = b.dataset.font;
      try{
        if(fuente === 'sistema') localStorage.setItem(FONT_KEY, 'sistema'); // serif = por defecto (sin clave)
        else localStorage.removeItem(FONT_KEY);
      }catch(e){}
      applyFont();
    });
  });

  // ===== Tema automático por hora (claro de día / oscuro de noche) =====
  function marcarAuto(){
    document.querySelectorAll('.dist-opt[data-auto]').forEach(b =>
      b.classList.toggle('active', (b.dataset.auto === 'on') === temaAuto));
  }
  document.querySelectorAll('.dist-opt[data-auto]').forEach(b => {
    b.addEventListener('click', ()=>{
      temaAuto = b.dataset.auto === 'on';
      saveTemaAuto();
      marcarAuto();
      applyThemeSel(); // repinta ya con el tema efectivo (según la hora)
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
        if(!h.core && h.frecSemanal > 0){ toast('Un hábito «N× por semana» no puede ser core.'); return; }
        if(h.core && coreCount <= MIN_CORE){ toast('Necesitas al menos ' + MIN_CORE + ' core.'); return; }
        if(!h.core && coreCount >= MAX_CORE){ toast('Máximo ' + MAX_CORE + ' core.'); return; }
        h.core = !h.core;
        rebuildCore(); saveHabitos(); render(); renderHabEditor();
        toast('Ojo: cambiar los core re-evalúa tus días pasados.');
      });

      // emoji propio (opcional): un ícono para la tarjeta
      const emoji = document.createElement('input');
      emoji.type = 'text'; emoji.className = 'hab-emoji'; emoji.value = h.emoji || ''; emoji.maxLength = 8;
      emoji.placeholder = '🙂'; emoji.setAttribute('aria-label', 'Emoji del hábito');
      emoji.addEventListener('input', ()=>{ h.emoji = sanearEmoji(emoji.value); saveHabitos(); render(); });

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

      // el "por qué" (opcional): tu motivo, se muestra en la tarjeta
      const porque = document.createElement('input');
      porque.type = 'text'; porque.className = 'hab-hint'; porque.value = h.porQue || ''; porque.maxLength = 70;
      porque.placeholder = '💭 Por qué: tu motivo para este hábito';
      porque.setAttribute('aria-label', 'Por qué de este hábito');
      porque.addEventListener('input', ()=>{ h.porQue = porque.value; saveHabitos(); render(); });

      // contador (opcional): meta numérica + unidad. Meta 0/vacío = sin contador.
      const cnt = document.createElement('div'); cnt.className = 'hab-count-edit';
      const meta = document.createElement('input');
      meta.type = 'number'; meta.className = 'hab-meta'; meta.min = '0'; meta.max = '999';
      meta.value = h.meta > 0 ? String(h.meta) : ''; meta.placeholder = '#';
      meta.setAttribute('aria-label', 'Meta numérica (ej. 8)');
      meta.addEventListener('input', ()=>{ h.meta = sanearMeta(meta.value); saveHabitos(); render(); });
      const uni = document.createElement('input');
      uni.type = 'text'; uni.className = 'hab-unidad'; uni.value = h.unidad || ''; uni.maxLength = 16;
      uni.placeholder = 'unidad (vasos, páginas…)';
      uni.setAttribute('aria-label', 'Unidad del contador');
      uni.addEventListener('input', ()=>{ h.unidad = uni.value.trim().slice(0,16); saveHabitos(); render(); });
      const cLbl = document.createElement('span'); cLbl.className = 'hab-count-lbl'; cLbl.textContent = '🔢';
      cnt.append(cLbl, meta, uni);

      // ancla (idea #73): "después de X" (hábito apilado)
      const tras = document.createElement('input');
      tras.type = 'text'; tras.className = 'hab-hint'; tras.value = h.tras || ''; tras.maxLength = 60;
      tras.placeholder = '⛓ Después de… (ej. "el café", "lavarme los dientes")';
      tras.setAttribute('aria-label', 'Después de qué hábito o momento');
      tras.addEventListener('input', ()=>{ h.tras = tras.value; saveHabitos(); render(); });

      // frecuencia semanal (idea #71): N veces por semana (sin fijar días).
      // Al ponerla, el hábito deja de ser core (no gana/pierde el día).
      const frecW = document.createElement('div'); frecW.className = 'hab-count-edit';
      const frecLbl = document.createElement('span'); frecLbl.className = 'hab-count-lbl'; frecLbl.textContent = '📅';
      const frec = document.createElement('input');
      frec.type = 'number'; frec.className = 'hab-meta'; frec.min = '0'; frec.max = '7';
      frec.value = h.frecSemanal > 0 ? String(h.frecSemanal) : ''; frec.placeholder = '#';
      frec.setAttribute('aria-label', 'Veces por semana');
      const frecTxt = document.createElement('span'); frecTxt.className = 'hab-frec-txt'; frecTxt.textContent = '× por semana (en vez de diario)';
      frec.addEventListener('input', ()=>{
        h.frecSemanal = sanearFrec(frec.value);
        if(h.frecSemanal) h.core = false; // frecuencia semanal ⇒ no core
        rebuildCore(); saveHabitos(); render(); renderHabEditor();
      });
      frecW.append(frecLbl, frec, frecTxt);

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

      // asa de arrastre: reordena la lista con el dedo (pointer events)
      const grip = document.createElement('span');
      grip.className = 'hab-grip'; grip.textContent = '⠿';
      grip.setAttribute('aria-label', 'Arrastrar para reordenar');
      grip.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        row.classList.add('dragging');
        const move = (ev)=>{ row.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)'; };
        const up = (ev)=>{
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          row.classList.remove('dragging'); row.style.transform = '';
          // índice destino: la fila cuyo centro quedó más cerca del dedo
          const rows = [...$('habList').children];
          const from = rows.indexOf(row);
          let to = from;
          rows.forEach((r2, i) => {
            const rc = r2.getBoundingClientRect();
            if(ev.clientY > rc.top && ev.clientY < rc.bottom) to = i;
          });
          if(to !== from){
            const [mv] = HABITS.splice(from, 1);
            HABITS.splice(to, 0, mv);
            saveHabitos(); render(); renderHabEditor();
          }
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
      });

      // ⛓ ver la cadena de este hábito (idea #72)
      const cad = document.createElement('button');
      cad.className = 'hab-cad'; cad.textContent = '⛓'; cad.setAttribute('aria-label', 'Ver la cadena de ' + h.name);
      cad.addEventListener('click', ()=> abrirCadena(h.id));

      // 🎯 modo un solo hábito (idea #74): foco en este
      const foco1 = document.createElement('button');
      foco1.className = 'hab-solo' + (solo === h.id ? ' on' : '');
      foco1.textContent = '🎯'; foco1.setAttribute('aria-label', solo === h.id ? 'Salir del foco' : 'Foco solo en ' + h.name);
      foco1.addEventListener('click', ()=>{ setSolo(h.id); toast(solo === h.id ? 'Foco en «' + h.name + '».' : 'Mostrando todos.'); });

      const top = document.createElement('div'); top.className = 'hab-top';
      top.append(grip, star, emoji, name, foco1, cad, del);

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

      row.append(top, hint, planb, porque, tras, cnt, frecW, daysRow);
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

  // ===== Biblioteca de actividades =====
  // Catálogo de hábitos listos por actividad/interés: así la app se moldea a
  // cada persona (yoga, pilates, correr, leer…). Cada item = una plantilla de
  // hábito (nombre, pista, emoji y opcional meta/unidad). Toca = se suma.
  const ACTIVIDADES = [
    { cat:'Movimiento', items:[
      {name:'Correr',        emoji:'🏃', hint:'20–30 min a tu ritmo'},
      {name:'Ir al gym',     emoji:'🏋️', hint:'Aunque sea entrenar ligero'},
      {name:'Yoga',          emoji:'🧘', hint:'15–20 min de práctica'},
      {name:'Pilates',       emoji:'🤸', hint:'Sesión de control y fuerza'},
      {name:'Caminar',       emoji:'🚶', hint:'Una vuelta despejando la mente'},
      {name:'Natación',      emoji:'🏊', hint:'Vueltas en la alberca'},
      {name:'Bici',          emoji:'🚴', hint:'Rodar un rato'},
      {name:'Estirar',       emoji:'🤾', hint:'5–10 min de movilidad'},
      {name:'Bailar',        emoji:'💃', hint:'Mover el cuerpo con música'},
      {name:'Deporte',       emoji:'⚽', hint:'Tu deporte favorito'},
    ]},
    { cat:'Mente y estudio', items:[
      {name:'Leer',          emoji:'📚', hint:'Un rato de lectura', meta:20, unidad:'páginas'},
      {name:'Meditar',       emoji:'🧠', hint:'10 min de calma'},
      {name:'Estudiar',      emoji:'📖', hint:'Bloque de estudio enfocado'},
      {name:'Practicar idioma',emoji:'🗣️', hint:'15 min de tu idioma'},
      {name:'Escribir',      emoji:'✍️', hint:'Diario o lo que fluya'},
      {name:'Aprender algo', emoji:'💡', hint:'Curso, video, tutorial'},
    ]},
    { cat:'Creatividad', items:[
      {name:'Tocar guitarra',emoji:'🎸', hint:'Practicar un rato'},
      {name:'Dibujar',       emoji:'🎨', hint:'Aunque sea un boceto'},
      {name:'Cocinar',       emoji:'🍳', hint:'Prepararte algo rico'},
      {name:'Fotografía',    emoji:'📷', hint:'Captura del día'},
      {name:'Producir música',emoji:'🎧', hint:'Un rato en el DAW'},
    ]},
    { cat:'Bienestar', items:[
      {name:'Tomar agua',    emoji:'💧', hint:'Mantente hidratado', meta:8, unidad:'vasos'},
      {name:'Dormir temprano',emoji:'😴', hint:'A buena hora, sin pantallas'},
      {name:'Cuidado de piel',emoji:'🧴', hint:'Tu rutina de skincare'},
      {name:'Vitaminas',     emoji:'💊', hint:'No olvidarlas'},
      {name:'Sin celular en cama',emoji:'📵', hint:'Cargar lejos de la almohada'},
      {name:'Respirar',      emoji:'🌬️', hint:'3 min de respiración'},
    ]},
    { cat:'Micro-hábitos (2 min) · arranques fáciles', items:[
      {name:'Una flexión',       emoji:'💪', hint:'Solo una. Casi siempre siguen más.'},
      {name:'2 min de lectura',  emoji:'📖', hint:'Abre el libro, lee un párrafo.'},
      {name:'Tender la cama',    emoji:'🛏️', hint:'La primera victoria del día.'},
      {name:'Un vaso de agua',   emoji:'💧', hint:'Nada más despertar.'},
      {name:'3 respiraciones',   emoji:'🌬️', hint:'Lento. Reinicia el sistema.'},
      {name:'Escribir 1 línea',  emoji:'✍️', hint:'Una frase en el diario basta.'},
      {name:'Estirar 2 min',     emoji:'🤸', hint:'Suelta el cuello y la espalda.'},
      {name:'Ordenar 1 cosa',    emoji:'🧹', hint:'Un objeto a su lugar.'},
    ]},
    { cat:'Vida y vínculos', items:[
      {name:'Llamar a familia',emoji:'📞', hint:'Un mensaje o llamada'},
      {name:'Tiempo en pareja',emoji:'❤️', hint:'Presencia de verdad'},
      {name:'Pasear al perro',emoji:'🐕', hint:'Su paseo diario'},
      {name:'Ordenar la casa',emoji:'🧹', hint:'10 min de orden'},
      {name:'Gratitud',      emoji:'🙏', hint:'Anota 3 cosas buenas'},
    ]},
  ];
  // ¿ya tienes un hábito con ese nombre? (para marcarlo en la biblioteca)
  function tieneHabito(nombre){
    const n = nombre.trim().toLowerCase();
    return HABITS.some(h => h.name.trim().toLowerCase() === n);
  }
  function addActividad(a){
    if(tieneHabito(a.name)){ toast('«' + a.name + '» ya está en tus hábitos.'); return; }
    if(HABITS.length >= MAX_HABITS){ toast('Máximo ' + MAX_HABITS + ' hábitos. Borra uno para sumar otro.'); return; }
    HABITS.push({
      id: nuevoHabId(), name: a.name, hint: a.hint || '', core: false,
      days: 'all', planB: '', emoji: a.emoji || '', porQue: '',
      meta: a.meta || 0, unidad: a.unidad || '',
    });
    rebuildCore(); saveHabitos(); render(); renderHabEditor(); renderBiblioteca();
    sonarCheck();
    toast(a.emoji + ' «' + a.name + '» agregado.');
  }
  function renderBiblioteca(){
    const cont = $('bibList'); cont.innerHTML = '';
    ACTIVIDADES.forEach(grupo => {
      const t = document.createElement('div'); t.className = 'bib-cat'; t.textContent = grupo.cat;
      cont.appendChild(t);
      const grid = document.createElement('div'); grid.className = 'bib-grid';
      grupo.items.forEach(a => {
        const have = tieneHabito(a.name);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'bib-item' + (have ? ' have' : '');
        const em = document.createElement('span'); em.className = 'bi-em'; em.textContent = a.emoji;
        const nm = document.createElement('span'); nm.className = 'bi-nm'; nm.textContent = a.name;
        b.append(em, nm);
        if(have){ const c = document.createElement('span'); c.className = 'bi-check'; c.textContent = '✓'; b.appendChild(c); }
        b.addEventListener('click', ()=> addActividad(a));
        grid.appendChild(b);
      });
      cont.appendChild(grid);
    });
  }
  // modo un solo hábito (idea #74): salir
  { const se = $('soloExit'); if(se) se.addEventListener('click', ()=> setSolo('')); }

  // cadena del hábito (idea #72)
  $('cadClose').addEventListener('click', ()=>{ $('cadenaWrap').hidden = true; });
  $('cadenaWrap').addEventListener('click', (e)=>{ if(e.target === $('cadenaWrap')) $('cadenaWrap').hidden = true; });

  $('habBiblioteca').addEventListener('click', ()=>{ renderBiblioteca(); $('bibWrap').hidden = false; });
  $('bibClose').addEventListener('click', ()=>{ $('bibWrap').hidden = true; });
  $('bibWrap').addEventListener('click', (e)=>{ if(e.target === $('bibWrap')) $('bibWrap').hidden = true; });

  // ===== Compañero: crece contigo y nunca retrocede =====
  // Su etapa depende del TOTAL de días ganados (que solo crece): a
  // diferencia de Forest, aquí nada muere por un mal día. Es PERSONALIZABLE:
  // le pones nombre y eliges qué es (planta, delfín, jirafa… o cualquier emoji).
  const COMPA_ETAPAS = [
    {min:0,   emoji:'🥚', nombre:'Cría',        sub:'Todo empieza quieto.'},
    {min:1,   emoji:'🌱', nombre:'Pequeño',     sub:'Ya diste el primer paso.'},
    {min:5,   emoji:'🌿', nombre:'Creciendo',   sub:'Cinco días te sostienen.'},
    {min:12,  emoji:'🪴', nombre:'Fuerte',      sub:'Esto ya tiene raíces.'},
    {min:25,  emoji:'🌳', nombre:'Grande',      sub:'Se nota. Es tuyo.'},
    {min:50,  emoji:'🌸', nombre:'Radiante',    sub:'Cincuenta días brillando.'},
    {min:100, emoji:'✨', nombre:'Legendario',  sub:'Cien días. Leyenda viva.'},
  ];
  // criatura = juego de emoji. 'planta' evoluciona (huevo→árbol, la clásica);
  // las demás muestran su emoji en todas las etapas (crecen por nivel + barra).
  const CRIATURAS = [
    {id:'planta', emoji:'🌳', nombre:'Retoño', stages:['🥚','🌱','🌿','🪴','🌳','🌸','✨']},
    {id:'delfin', emoji:'🐬', nombre:'Delfín'},
    {id:'jirafa', emoji:'🦒', nombre:'Jirafa'},
    {id:'gato',   emoji:'🐱', nombre:'Gato'},
    {id:'perro',  emoji:'🐶', nombre:'Perro'},
    {id:'zorro',  emoji:'🦊', nombre:'Zorro'},
    {id:'buho',   emoji:'🦉', nombre:'Búho'},
    {id:'dragon', emoji:'🐉', nombre:'Dragón'},
    {id:'pinguino',emoji:'🐧', nombre:'Pingüino'},
    {id:'tortuga',emoji:'🐢', nombre:'Tortuga'},
  ];
  const COMPA_KEY = 'reps-compa';
  let compaConf = { nombre:'', criatura:'planta', emoji:'' };
  function loadCompa(){
    compaConf = { nombre:'', criatura:'planta', emoji:'' };
    try{
      const v = JSON.parse(localStorage.getItem(COMPA_KEY));
      if(esMapa(v)){
        if(typeof v.nombre === 'string') compaConf.nombre = v.nombre.trim().slice(0,24);
        if(CRIATURAS.some(c => c.id === v.criatura)) compaConf.criatura = v.criatura;
        if(typeof v.emoji === 'string') compaConf.emoji = sanearEmoji(v.emoji);
      }
    }catch(e){}
  }
  function saveCompa(){
    try{ localStorage.setItem(COMPA_KEY, JSON.stringify(compaConf)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  function etapaIdx(total){
    let idx = 0;
    for(let i = COMPA_ETAPAS.length - 1; i >= 0; i--){
      if(total >= COMPA_ETAPAS[i].min){ idx = i; break; }
    }
    return idx;
  }
  // el emoji a mostrar según total: emoji custom > etapa de planta > emoji de la criatura
  function compaEmojiDe(total){
    if(compaConf.emoji) return compaConf.emoji;
    const cri = CRIATURAS.find(c => c.id === compaConf.criatura) || CRIATURAS[0];
    if(cri.stages) return cri.stages[etapaIdx(total)];
    return cri.emoji;
  }
  function renderCompa(total){
    const idx = etapaIdx(total);
    const etapa = COMPA_ETAPAS[idx], siguiente = COMPA_ETAPAS[idx+1] || null;
    $('compa').hidden = false;
    $('compaEmoji').textContent = compaEmojiDe(total);
    // nombre propio si lo puso; si no, el nivel
    $('compaNombre').textContent = compaConf.nombre || etapa.nombre;
    const nivel = compaConf.nombre ? etapa.nombre + ' · ' : '';
    if(siguiente){
      const base = etapa.min, span = siguiente.min - base;
      const pct = Math.min(100, Math.round((total - base) / span * 100));
      $('compaSub').textContent = nivel + etapa.sub + ' · ' + (siguiente.min - total) + ' días para evolucionar';
      $('compaBar').style.width = pct + '%';
      $('compaBar').parentElement.hidden = false;
    } else {
      $('compaSub').textContent = nivel + etapa.sub;
      $('compaBar').parentElement.hidden = true;
    }
  }
  // editor del compañero (se abre tocando la tarjeta)
  function renderCompaGrid(){
    const g = $('coGrid'); g.innerHTML = '';
    CRIATURAS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.stages ? c.stages[etapaIdx(statsData().total)] : c.emoji;
      b.title = c.nombre;
      if(!compaConf.emoji && compaConf.criatura === c.id) b.className = 'sel';
      b.addEventListener('click', ()=>{
        compaConf.criatura = c.id; compaConf.emoji = ''; $('coEmoji').value = '';
        renderCompaGrid();
      });
      g.appendChild(b);
    });
  }
  function abrirCompaEditor(){
    $('coNombre').value = compaConf.nombre;
    $('coEmoji').value = compaConf.emoji;
    renderCompaGrid();
    $('compaWrap').hidden = false;
  }
  $('compa').addEventListener('click', abrirCompaEditor);
  $('coClose').addEventListener('click', ()=>{ $('compaWrap').hidden = true; });
  $('compaWrap').addEventListener('click', (e)=>{ if(e.target === $('compaWrap')) $('compaWrap').hidden = true; });
  $('coEmoji').addEventListener('input', ()=>{ if($('coEmoji').value.trim()) renderCompaGridClear(); });
  function renderCompaGridClear(){ // un emoji custom deselecciona las criaturas
    $('coGrid').querySelectorAll('button').forEach(b => b.classList.remove('sel'));
  }
  $('coSave').addEventListener('click', ()=>{
    compaConf.nombre = $('coNombre').value.trim().slice(0,24);
    compaConf.emoji = sanearEmoji($('coEmoji').value);
    saveCompa();
    renderCompa(statsData().total);
    $('compaWrap').hidden = true;
    toast('Tu compañero está listo. ' + compaEmojiDe(statsData().total));
  });

  // ===== Stories del día (carrusel estilo Instagram) =====
  // Tarjetas a pantalla completa que resumen tu día: derivadas del estado, se
  // arman al vuelo. Auto-avanzan; toque izq/der navega; ✕ cierra. reps-stories
  // guarda la última fecha mostrada para auto-abrirlas una vez por día.
  const STORIES_KEY = 'reps-stories';
  const ST_MS = 4500;
  let stIdx = 0, stTimer = null, stCards = [];

  function etapaCompaDe(total){
    let etapa = COMPA_ETAPAS[0];
    for(let i = COMPA_ETAPAS.length - 1; i >= 0; i--){
      if(total >= COMPA_ETAPAS[i].min){ etapa = COMPA_ETAPAS[i]; break; }
    }
    return etapa;
  }
  function buildStories(){
    const k = today();
    const s = streak();
    const won = esGanado(k), desc = esDescanso(k);
    const caidosN = diasCaidosSeguidos();
    const coreHoy = coreDelDia(k);
    const rec = dias[k] || {};
    const coreDone = coreHoy.filter(id => hecho(rec, id)).length;
    const cards = [];
    // 1 · saludo + racha
    const h = new Date().getHours();
    const saludo = h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
    cards.push({ emoji: won ? '✅' : (s > 0 ? '🔥' : '🌅'), title: saludo,
      body: won ? 'Día ganado. Ya está.' :
            s > 0 ? 'Racha de ' + s + ' día' + (s === 1 ? '' : 's') + '.\nSigue encendida.' :
            'Hoy es un buen día\npara empezar.' });
    // 2 · El Ahora (bloque en curso)
    const b = bloqueActual();
    if(b) cards.push({ emoji: '⏳', title: 'Ahora',
      body: b.cur.hora + ' · ' + b.cur.nombre + '\n\nLuego: ' + b.next.nombre + ' ' + b.next.hora });
    // 3 · Hoy pide
    const rp = hoyPide(won, desc, s, caidosN, coreHoy, coreDone, b);
    if(rp) cards.push({ emoji: '🎯', title: 'Hoy pide', body: rp.replace(/^\S+\s/, '') });
    // 4 · compañero
    const total = statsData().total;
    const et = etapaCompaDe(total);
    cards.push({ emoji: compaEmojiDe(total), title: compaConf.nombre || et.nombre,
      body: (compaConf.nombre ? et.nombre + '. ' : et.sub + ' ') + '\n\n' + total + ' días ganados.' });
    // 5 · empujón
    const emp = empujeDelDia(won, desc, s, caidosN);
    if(emp) cards.push({ emoji: '💬', title: 'Para hoy', body: emp });
    return cards;
  }
  function pintarStory(){
    const c = stCards[stIdx]; if(!c) return;
    $('stEmoji').textContent = c.emoji;
    $('stTitle').textContent = c.title;
    $('stBody').textContent = c.body;
    const card = $('stCard'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    [...$('stBars').children].forEach((bar, i) => {
      bar.classList.toggle('done', i < stIdx);
      const fill = bar.querySelector('i');
      fill.style.transition = 'none';
      fill.style.width = i < stIdx ? '100%' : '0%';
      if(i === stIdx){ void fill.offsetWidth; fill.style.transition = 'width ' + ST_MS + 'ms linear'; fill.style.width = '100%'; }
    });
    clearTimeout(stTimer);
    stTimer = setTimeout(siguienteStory, ST_MS);
  }
  function siguienteStory(){ if(stIdx >= stCards.length - 1){ cerrarStories(); return; } stIdx++; pintarStory(); }
  function anteriorStory(){ if(stIdx <= 0){ pintarStory(); return; } stIdx--; pintarStory(); }
  function abrirStories(){
    stCards = buildStories();
    if(!stCards.length) return;
    stIdx = 0;
    $('stBars').innerHTML = '';
    stCards.forEach(() => { const bar = document.createElement('div'); bar.className = 'st-bar'; bar.innerHTML = '<i></i>'; $('stBars').appendChild(bar); });
    $('stories').hidden = false;
    pintarStory();
  }
  function cerrarStories(){ clearTimeout(stTimer); $('stories').hidden = true; }
  // dibuja la tarjeta actual como postal 1080x1350 con el tema vigente
  function drawStoryImage(){
    const c = stCards[stIdx]; if(!c) return null;
    const W = 1080, H = 1350;
    const css = getComputedStyle(document.documentElement);
    const col = v => css.getPropertyValue(v).trim();
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = col('--bg'); ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '200px serif';
    ctx.fillText(c.emoji, W/2, 420);
    ctx.fillStyle = col('--amber');
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(c.title.toUpperCase(), W/2, 580);
    ctx.fillStyle = col('--text');
    ctx.font = '700 58px system-ui, sans-serif';
    const lineas = [];
    c.body.split('\n').forEach(parr => { // envuelve cada párrafo a ~28 chars
      let cur = '';
      parr.split(' ').forEach(w => {
        if((cur + ' ' + w).trim().length > 28){ lineas.push(cur.trim()); cur = w; }
        else cur += ' ' + w;
      });
      lineas.push(cur.trim());
    });
    lineas.forEach((l, i) => ctx.fillText(l, W/2, 720 + i*80));
    ctx.fillStyle = col('--muted');
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.fillText('REPS · ' + new Date().toLocaleDateString('es-MX', {day:'numeric', month:'long'}), W/2, H - 90);
    return canvas;
  }

  // ===== Recompensas: tratos contigo mismo =====
  const RECOMP_KEY = 'reps-recompensas';
  let recompensas = [];
  function loadRecompensas(){
    try{
      const v = JSON.parse(localStorage.getItem(RECOMP_KEY));
      if(Array.isArray(v)){
        recompensas = v.filter(r => r && typeof r.premio === 'string' && r.premio.trim() && parseInt(r.dias, 10) > 0)
          .map(r => ({
            id: typeof r.id === 'string' ? r.id : 'rc' + Math.random().toString(36).slice(2,8),
            premio: r.premio.trim(),
            dias: parseInt(r.dias, 10),
            cobrada: !!r.cobrada,
            creada: r.creada || new Date().toISOString(),
          }));
      }
    }catch(e){ recompensas = []; }
  }
  function saveRecompensas(){
    try{ localStorage.setItem(RECOMP_KEY, JSON.stringify(recompensas)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  function renderRecompensas(total){
    const list = $('recompList'); list.innerHTML = '';
    if(recompensas.length === 0){
      const e = document.createElement('div'); e.className = 'meta-empty';
      e.textContent = 'Ej: «a los 30 días ganados, me compro los tenis». La app te recuerda tu propio trato.';
      list.appendChild(e);
      return;
    }
    [...recompensas].sort((a,b) => a.dias - b.dias).forEach(rc => {
      const row = document.createElement('div');
      row.className = 'meta' + (rc.cobrada ? ' done' : '');
      const main = document.createElement('div'); main.className = 'm-main'; main.style.cursor = 'default';
      const box = document.createElement('span'); box.className = 'm-box'; box.textContent = '🎁';
      if(rc.cobrada){ box.style.color = 'inherit'; }
      const body = document.createElement('span');
      const txt = document.createElement('div'); txt.className = 'm-text'; txt.textContent = rc.premio;
      const sub = document.createElement('div'); sub.className = 'rc-sub';
      const alcanzada = total >= rc.dias;
      sub.textContent = rc.cobrada ? 'Cobrada ✓ (' + rc.dias + ' días)' :
        alcanzada ? '¡Lo lograste! ' + rc.dias + ' días ganados.' :
        total + '/' + rc.dias + ' días ganados';
      body.append(txt, sub);
      main.append(box, body);
      row.appendChild(main);
      if(alcanzada && !rc.cobrada){
        const cobrar = document.createElement('button');
        cobrar.className = 'rc-cobrar'; cobrar.textContent = 'Cobrar 🎁';
        cobrar.addEventListener('click', ()=>{
          rc.cobrada = true; saveRecompensas(); renderRecompensas(total);
          sonarGanado();
          toast('🎁 Cóbratelo. Te lo ganaste con ' + rc.dias + ' días.');
        });
        row.appendChild(cobrar);
      }
      const del = document.createElement('button');
      del.className = 'm-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar recompensa');
      del.addEventListener('click', ()=>{
        recompensas = recompensas.filter(x => x.id !== rc.id);
        saveRecompensas(); renderRecompensas(total);
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  }
  $('recompAdd').addEventListener('click', ()=>{
    const premio = $('recompInput').value.trim();
    const dias = parseInt($('recompDias').value, 10);
    if(!premio || !(dias > 0)){ toast('Escribe el premio y a los cuántos días.'); return; }
    recompensas.push({ id: 'rc' + Date.now().toString(36), premio, dias, cobrada:false, creada:new Date().toISOString() });
    saveRecompensas();
    $('recompInput').value = ''; $('recompDias').value = '';
    renderRecompensas(statsData().total);
    toast('Trato hecho. A ganarlo.');
  });

  // ===== Recordatorios (medicinas, etc.) que suman al puntaje =====
  // Lista de recordatorios diarios con hora opcional. Palomearlos hoy suma un
  // bono al puntaje del día; los que tienen hora también se notifican (usan
  // el mismo espejo/push que la rutina). El estado "hecho" es por fecha.
  const REC_KEY = 'reps-recordatorios';       // [{id, texto, hora, creado}]
  const REC_HECHOS_KEY = 'reps-record-hechos'; // {fecha: {id:true}}
  let recordatorios = [];
  let recordHechos = {};
  function loadRecordatorios(){
    try{
      const v = JSON.parse(localStorage.getItem(REC_KEY));
      recordatorios = Array.isArray(v) ? v.filter(r => r && typeof r.texto === 'string' && r.texto.trim())
        .map(r => ({ id: typeof r.id === 'string' ? r.id : 'rr' + Math.random().toString(36).slice(2,8),
          texto: r.texto.trim().slice(0,60),
          hora: (typeof r.hora === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora)) ? r.hora : '',
          creado: r.creado || new Date().toISOString() })) : [];
    }catch(e){ recordatorios = []; }
    try{ const h = JSON.parse(localStorage.getItem(REC_HECHOS_KEY)); recordHechos = esMapa(h) ? h : {}; }catch(e){ recordHechos = {}; }
  }
  function saveRecordatorios(){ try{ localStorage.setItem(REC_KEY, JSON.stringify(recordatorios)); }catch(e){} }
  function saveRecordHechos(){ try{ localStorage.setItem(REC_HECHOS_KEY, JSON.stringify(recordHechos)); }catch(e){} }
  const recHechoHoy = id => !!(recordHechos[today()] && recordHechos[today()][id]);
  // bono al puntaje: +2 por recordatorio cumplido hoy, tope +10
  function bonoRecordatorios(fecha){
    const m = recordHechos[fecha]; if(!m) return 0;
    const ids = new Set(recordatorios.map(r => r.id));
    let n = 0; Object.keys(m).forEach(id => { if(m[id] && ids.has(id)) n++; });
    return Math.min(10, n * 2);
  }
  function renderRecordatorios(){
    const cont = $('recList'); if(!cont) return;
    cont.innerHTML = '';
    const hechos = recordatorios.filter(r => recHechoHoy(r.id)).length;
    $('recTag').textContent = recordatorios.length ? hechos + '/' + recordatorios.length + ' hoy' : 'del día';
    recordatorios.forEach(r => {
      const done = recHechoHoy(r.id);
      const row = document.createElement('div'); row.className = 'rec-row' + (done ? ' done' : '');
      const chk = document.createElement('button'); chk.className = 'rec-chk'; chk.type = 'button';
      chk.textContent = done ? '✓' : ''; chk.setAttribute('aria-label', 'Cumplir: ' + r.texto);
      chk.addEventListener('click', ()=>{
        const k = today(); const m = recordHechos[k] || {};
        if(m[r.id]) delete m[r.id]; else m[r.id] = true;
        recordHechos[k] = m; saveRecordHechos();
        if(m[r.id]) sonarCheck();
        renderRecordatorios(); renderStats(); // el puntaje del día se recalcula
      });
      const txt = document.createElement('div'); txt.className = 'rec-txt';
      txt.textContent = (r.hora ? r.hora + ' · ' : '') + r.texto;
      const del = document.createElement('button'); del.className = 'rec-del'; del.type = 'button';
      del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar recordatorio');
      del.addEventListener('click', ()=>{
        recordatorios = recordatorios.filter(x => x.id !== r.id);
        saveRecordatorios(); renderRecordatorios(); pushSync(); espejoParaSW();
      });
      row.append(chk, txt, del);
      cont.appendChild(row);
    });
  }
  $('recAdd').addEventListener('click', ()=>{
    const texto = $('recInput').value.trim();
    if(!texto){ toast('Escribe el recordatorio.'); return; }
    const hora = $('recHora').value && /^\d{1,2}:\d{2}$/.test($('recHora').value) ? $('recHora').value : '';
    recordatorios.push({ id: 'rr' + Date.now().toString(36), texto: texto.slice(0,60), hora, creado: new Date().toISOString() });
    saveRecordatorios();
    $('recInput').value = ''; $('recHora').value = '';
    renderRecordatorios();
    pushSync(); espejoParaSW(); // si tiene hora, entra a las notificaciones
    toast('Recordatorio agregado.');
  });

  // ===== Mi ruta: capas editables (plan de largo plazo, a tu medida) =====
  // Antes eran fijas en el HTML (la historia personal del autor). Ahora viven
  // en reps-capas: cada usuario tiene la suya, editable a mano o con IA.
  const CAPAS_KEY = 'reps-capas';
  const MAX_CAPAS = 8;
  const CAPAS_DEFAULT = [
    {titulo:'La base',        cuando:'Ahora',       items:['Cumple tus innegociables casi todos los días','Que la rutina deje de costarte fuerza de voluntad','Todavía nada nuevo: primero cimientos firmes'], cond:'Desbloquea la siguiente: ~2 semanas de rachas estables'},
    {titulo:'Suma UNA cosa',  cuando:'~Semana 3',   items:['Elige un solo hábito o meta nuevos','Uno a la vez: no diez frentes abiertos','Encájalo en un bloque libre de tu día'], cond:'Desbloquea la siguiente: cuando esta ya sea automática'},
    {titulo:'Profundiza',     cuando:'~Mes 2',      items:['Sube el nivel de lo que ya dominas','Agrega un segundo frente, ahora que hay base','Empieza a medir y ajustar con tus datos'], cond:'Desbloquea la siguiente: constancia de 2 meses'},
    {titulo:'Expándete',      cuando:'Mes 3+',      items:['Metas más grandes o de largo plazo','Un hobby o proyecto que te llene','Convierte tus hábitos en resultados reales'], cond:'Lo grande llega cuando lo pequeño ya es automático.'},
  ];
  let capas = [];
  function sanearCapas(v){
    if(!Array.isArray(v)) return null;
    const c = v.filter(x => x && typeof x.titulo === 'string' && x.titulo.trim())
      .map(x => ({
        titulo: x.titulo.trim().slice(0, 50),
        cuando: typeof x.cuando === 'string' ? x.cuando.trim().slice(0, 30) : '',
        items: Array.isArray(x.items) ? x.items.filter(i => typeof i === 'string' && i.trim()).map(i => i.trim().slice(0, 90)).slice(0, 6) : [],
        cond: typeof x.cond === 'string' ? x.cond.trim().slice(0, 120) : '',
      }))
      .slice(0, MAX_CAPAS);
    return c.length ? c : null;
  }
  function loadCapas(){
    let v = null;
    try{ v = sanearCapas(JSON.parse(localStorage.getItem(CAPAS_KEY))); }catch(e){}
    capas = v || CAPAS_DEFAULT.map(c => ({...c, items:[...c.items]}));
  }
  function saveCapas(){ try{ localStorage.setItem(CAPAS_KEY, JSON.stringify(capas)); }catch(e){} }
  function renderCapas(){
    const cont = $('capasList'); if(!cont) return;
    cont.innerHTML = '';
    capas.forEach((c, i) => {
      const box = document.createElement('div'); box.className = 'capa' + (i === 0 ? ' activa' : '');
      const head = document.createElement('div'); head.className = 'c-head';
      const num = document.createElement('span'); num.className = 'c-num';
      num.textContent = 'Capa ' + (i + 1) + (c.cuando ? ' · ' + c.cuando : '');
      const st = document.createElement('span'); st.className = 'c-status ' + (i === 0 ? 'on' : 'wait');
      st.textContent = i === 0 ? 'Activa' : 'En fila';
      head.append(num, st);
      const t = document.createElement('div'); t.className = 'c-title'; t.textContent = c.titulo;
      box.append(head, t);
      if(c.items.length){
        const ul = document.createElement('ul'); ul.className = 'c-items';
        c.items.forEach(it => { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); });
        box.appendChild(ul);
      }
      if(c.cond){ const cd = document.createElement('div'); cd.className = 'c-cond'; cd.textContent = c.cond; box.appendChild(cd); }
      cont.appendChild(box);
    });
  }
  function renderCapasEditor(){
    const cont = $('capasEditList'); cont.innerHTML = '';
    capas.forEach((c, i) => {
      const row = document.createElement('div'); row.className = 'capa-edit';
      const cab = document.createElement('div'); cab.className = 'ce-cab';
      const lbl = document.createElement('span'); lbl.className = 'ce-num'; lbl.textContent = 'Capa ' + (i + 1);
      const del = document.createElement('button'); del.className = 'hab-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar capa');
      del.addEventListener('click', ()=>{
        if(capas.length <= 1){ toast('Deja al menos una capa.'); return; }
        capas.splice(i, 1); saveCapas(); renderCapas(); renderCapasEditor();
      });
      cab.append(lbl, del);
      const tit = document.createElement('input'); tit.type = 'text'; tit.className = 'hab-name'; tit.maxLength = 50;
      tit.value = c.titulo; tit.placeholder = 'Título de la capa';
      tit.addEventListener('input', ()=>{ c.titulo = tit.value; saveCapas(); renderCapas(); });
      const cua = document.createElement('input'); cua.type = 'text'; cua.className = 'hab-hint'; cua.maxLength = 30;
      cua.value = c.cuando; cua.placeholder = 'Cuándo (ej: ~Mes 2)';
      cua.addEventListener('input', ()=>{ c.cuando = cua.value; saveCapas(); renderCapas(); });
      const its = document.createElement('textarea'); its.className = 'cd-notas'; its.rows = 3;
      its.value = c.items.join('\n'); its.placeholder = 'Un punto por línea';
      its.addEventListener('input', ()=>{ c.items = its.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0,6); saveCapas(); renderCapas(); });
      const cnd = document.createElement('input'); cnd.type = 'text'; cnd.className = 'hab-hint'; cnd.maxLength = 120;
      cnd.value = c.cond; cnd.placeholder = 'Condición para desbloquear la siguiente';
      cnd.addEventListener('input', ()=>{ c.cond = cnd.value; saveCapas(); renderCapas(); });
      row.append(cab, tit, cua, its, cnd);
      cont.appendChild(row);
    });
  }
  $('capasEdit').addEventListener('click', ()=>{ renderCapasEditor(); $('capasWrap').hidden = false; });
  $('capasClose').addEventListener('click', ()=>{ $('capasWrap').hidden = true; });
  $('capasWrap').addEventListener('click', (e)=>{ if(e.target === $('capasWrap')) $('capasWrap').hidden = true; });
  $('capaAdd').addEventListener('click', ()=>{
    if(capas.length >= MAX_CAPAS){ toast('Máximo ' + MAX_CAPAS + ' capas.'); return; }
    capas.push({ titulo:'Nueva capa', cuando:'', items:[], cond:'' });
    saveCapas(); renderCapas(); renderCapasEditor();
  });
  // diseñar la ruta con IA
  let ciPropuesta = null;
  $('capasIA').addEventListener('click', ()=>{ ciPropuesta = null; $('ciApply').hidden = true; $('ciOut').hidden = true; $('capasIAWrap').hidden = false; });
  $('ciClose').addEventListener('click', ()=>{ $('capasIAWrap').hidden = true; });
  $('capasIAWrap').addEventListener('click', (e)=>{ if(e.target === $('capasIAWrap')) $('capasIAWrap').hidden = true; });
  $('ciGo').addEventListener('click', async ()=>{
    const meta = $('ciMeta').value.trim();
    if(!meta){ toast('Cuéntale a dónde quieres llegar.'); return; }
    if(iaOcupado) return; iaOcupado = true;
    ciPropuesta = null; $('ciApply').hidden = true;
    const out = $('ciOut'); out.hidden = false; out.textContent = 'Diseñando tu ruta… 🤖';
    const sistema = 'Eres un coach de desarrollo personal. Diseña un plan de largo plazo en CAPAS progresivas ' +
      '(primero la base, luego una cosa a la vez). Responde ÚNICAMENTE con JSON válido, sin markdown, con la forma: ' +
      '{"capas":[{"titulo":"...","cuando":"Ahora","items":["...","..."],"cond":"..."}]}. ' +
      'Entre 3 y 5 capas, en español. titulo corto (máx 50). cuando = horizonte (ej "Ahora", "~Mes 2"). ' +
      'items = 2 a 4 acciones concretas por capa (máx 90 c/u). cond = qué hay que lograr para pasar a la siguiente.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Diseña mi ruta por capas. A dónde quiero llegar: ' + meta + '. ' + contextoIA() }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      const m = (d.texto || '').match(/\{[\s\S]*\}/);
      const cp = sanearCapas(m ? (JSON.parse(m[0]).capas) : null);
      if(!cp) throw new Error('formato');
      ciPropuesta = cp;
      out.textContent = cp.map((c, i) => 'Capa ' + (i+1) + (c.cuando ? ' · ' + c.cuando : '') + ': ' + c.titulo +
        (c.items.length ? '\n   → ' + c.items.join('\n   → ') : '')).join('\n\n');
      $('ciApply').hidden = false;
    }catch(e){ out.textContent = 'No se pudo generar la ruta. Revisa tu internet e intenta de nuevo.'; }
    iaOcupado = false;
  });
  $('ciApply').addEventListener('click', ()=>{
    if(!ciPropuesta) return;
    if(!confirm('Esto reemplaza tu ruta actual (' + capas.length + ' capas) por las ' + ciPropuesta.length + ' propuestas. ¿Aplicar?')) return;
    capas = ciPropuesta.map(c => ({...c, items:[...c.items]}));
    saveCapas(); renderCapas();
    $('capasIAWrap').hidden = true; ciPropuesta = null;
    toast('Tu ruta está lista. 🗺️');
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
  let foco = { habitId:null, habitName:'', min:25, endTime:0, totalSec:0, timer:null, wakeLock:null, modo:'simple', fase:'', ciclos:0 };
  const BREAK_MIN = 5; // descanso del Pomodoro

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
    vibrar([120, 60, 120]); // háptica configurable (idea #109)
    if(!focoSonido || sonCfg.fin === false) return;
    try{
      unlockAudio();
      if(!audioCtx) return;
      // campanita: arpegio cálido ascendente (Do–Mi–Sol)
      tono(523.25, 0,    0.55, 0.28);
      tono(659.25, 0.13, 0.55, 0.24);
      tono(783.99, 0.26, 0.80, 0.22);
    }catch(e){}
  }
  // ===== Ruido de fondo para el foco (marrón sintetizado, tipo lluvia) =====
  // Sin archivos: un buffer de ruido en loop + filtro grave. Solo dura la
  // sesión de foco; no se guarda preferencia (decisión por sesión).
  let ambNodes = null;
  function ambienteOn(){
    try{
      unlockAudio(); if(!audioCtx) return false;
      const len = audioCtx.sampleRate * 2;
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for(let i = 0; i < len; i++){
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02; // integración: blanco → marrón
        data[i] = last * 3.5;
      }
      const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
      const g = audioCtx.createGain(); g.gain.value = 0.12;
      src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
      src.start();
      ambNodes = { src };
      return true;
    }catch(e){ return false; }
  }
  function ambienteOff(){
    try{ if(ambNodes){ ambNodes.src.stop(); ambNodes = null; } }catch(e){ ambNodes = null; }
  }
  function pintarAmbBtn(){
    const b = $('focoAmb');
    b.classList.toggle('off', !ambNodes);
    b.textContent = ambNodes ? '🌧️ Ruido de fondo (sonando)' : '🌧️ Ruido de fondo';
  }
  $('focoAmb').addEventListener('click', ()=>{
    if(ambNodes) ambienteOff(); else ambienteOn();
    pintarAmbBtn();
  });

  // pop corto y satisfactorio al marcar algo como hecho (hábito, meta, idea)
  function sonarCheck(){
    vibrar(12);
    if(!focoSonido || sonCfg.check === false) return;
    try{
      unlockAudio(); if(!audioCtx) return;
      tono(660, 0,    0.09, 0.20);
      tono(990, 0.05, 0.11, 0.16);
    }catch(e){}
  }
  // pequeño fanfarrón al GANAR el día (los 3 core listos) o cumplir meta grande
  function sonarGanado(){
    vibrar([40, 50, 90]);
    if(!focoSonido || sonCfg.ganado === false) return;
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
    foco.modo = 'simple'; foco.fase = ''; foco.ciclos = 0;
    $('focoPomo').classList.remove('on'); $('focoFase').hidden = true;
    $('focoHab').textContent = '🎯 ' + habitName;
    document.querySelectorAll('.foco-dur').forEach(b => b.classList.toggle('on', b.dataset.min === '25'));
    const ci = $('focoCustom'); ci.value = ''; ci.classList.remove('on'); // arranca en el preset 25
    pintarSonidoBtn();
    $('focoSetup').hidden = false; $('focoRun').hidden = true;
    $('foco').hidden = false;
  }
  function cerrarFoco(){
    if(foco.timer){ clearInterval(foco.timer); foco.timer = null; }
    soltarWakeLock();
    ambienteOff(); pintarAmbBtn(); // el ruido de fondo muere con la sesión
    $('foco').hidden = true;
  }
  function pintarFoco(){
    const left = Math.max(0, Math.round((foco.endTime - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    $('focoTime').textContent = mm + ':' + ss;
    const pct = foco.totalSec ? (foco.totalSec - left) / foco.totalSec * 100 : 0;
    $('focoRing').style.setProperty('--p', pct.toFixed(1) + '%');
    if(left <= 0){
      if(foco.modo === 'pomo') finFase();   // Pomodoro: encadena trabajo/descanso
      else completarFoco(true);              // simple: cuenta y cierra
    }
  }
  // arranca una fase (Pomodoro) o el conteo simple; reusa el mismo intervalo
  function iniciarFase(min, fase){
    foco.totalSec = min * 60;
    foco.endTime = Date.now() + foco.totalSec * 1000; // reloj real: sobrevive al throttle
    foco.fase = fase;
    const fl = $('focoFase');
    if(foco.modo === 'pomo'){
      fl.hidden = false; fl.className = 'foco-fase ' + fase;
      fl.textContent = fase === 'trabajo' ? ('Enfoque · ciclo ' + (foco.ciclos + 1)) : 'Descanso';
    } else fl.hidden = true;
    pintarFoco();
    if(!foco.timer) foco.timer = setInterval(pintarFoco, 1000);
  }
  function empezarFoco(){
    unlockAudio(); // gesto del usuario: deja el audio listo para sonar al final
    $('focoSetup').hidden = true; $('focoRun').hidden = false;
    foco.ciclos = 0;
    iniciarFase(foco.min, foco.modo === 'pomo' ? 'trabajo' : 'simple');
    pedirWakeLock();
  }
  // marca el hábito hecho hoy sin cerrar la sesión (para el Pomodoro)
  function marcarFocoHecho(){
    const k = today(); const cur = dias[k] || {};
    cur[foco.habitId] = true; dias[k] = cur; save();
  }
  // fin de una fase del Pomodoro: trabajo → descanso → trabajo…
  function finFase(){
    sonarFin();
    if(foco.fase === 'trabajo'){
      focoTotal += foco.min; saveFoco(); marcarFocoHecho(); foco.ciclos++;
      render();
      iniciarFase(BREAK_MIN, 'descanso');
      toast('Ciclo ' + foco.ciclos + ' hecho. Descansa ' + BREAK_MIN + ' min. ☕');
    } else {
      iniciarFase(foco.min, 'trabajo');
      toast('De vuelta al foco. 🍅');
    }
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
    const ci = $('focoCustom'); ci.value = ''; ci.classList.remove('on'); // preset gana
  }));
  // minutos a medida: el usuario pone su propia duración (1–240)
  $('focoCustom').addEventListener('input', ()=>{
    const n = parseInt($('focoCustom').value, 10);
    if(!Number.isFinite(n) || n < 1){ $('focoCustom').classList.remove('on'); return; }
    foco.min = Math.min(240, n);
    document.querySelectorAll('.foco-dur').forEach(x => x.classList.remove('on')); // ningún preset activo
    $('focoCustom').classList.add('on');
  });
  $('focoSonidoBtn').addEventListener('click', ()=>{
    focoSonido = !focoSonido; saveSonido(); pintarSonidoBtn();
    if(focoSonido){ unlockAudio(); sonarFin(); } // preescucha al encender
  });
  $('focoPomo').addEventListener('click', ()=>{
    foco.modo = foco.modo === 'pomo' ? 'simple' : 'pomo';
    $('focoPomo').classList.toggle('on', foco.modo === 'pomo');
  });
  $('focoStart').addEventListener('click', empezarFoco);
  $('focoCancelSetup').addEventListener('click', cerrarFoco);
  $('focoCancel').addEventListener('click', cerrarFoco);
  $('focoDone').addEventListener('click', ()=>{
    if(foco.modo !== 'pomo'){ completarFoco(false); return; }
    // Pomodoro: si estás enfocando, cuenta el rato hecho y marca el hábito
    if(foco.fase === 'trabajo'){
      const mins = Math.max(1, Math.round((foco.totalSec - Math.max(0, (foco.endTime - Date.now())/1000)) / 60));
      focoTotal += mins; saveFoco(); marcarFocoHecho();
    }
    const c = foco.ciclos;
    cerrarFoco(); render();
    toast('Pomodoro terminado. ' + c + ' ciclo' + (c === 1 ? '' : 's') + ' completo' + (c === 1 ? '' : 's') + '. 🍅');
  });

  // ===== Notificaciones push (Capa 3) =====
  // El Worker (reps-push) solo conoce: la suscripción del navegador y las
  // horas de tus bloques. A cada hora manda un "tick" vacío; el service
  // worker arma el texto con el espejo LOCAL de tu rutina (cache reps-datos).
  const PUSH_WORKER = 'https://reps-push.iivf-2806.workers.dev';
  const PUSH_PUB = 'BEK7vM7D_6DKh22xgYxr3eAjySz_X_5jbc4_HBDWIz0jZ-bnWjyIei6Sjz_vkasIZKxSs4ivlSD6q9bD_-ka7Zc';
  const PUSH_KEY = 'reps-push';

  function b64uToU8(s){
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while(s.length % 4) s += '=';
    const bin = atob(s);
    return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  }
  // espejo de la rutina para el SW: el push event no puede leer localStorage,
  // pero sí el Cache API. Se refresca en cada guardado de rutina.
  async function espejoParaSW(){
    try{
      // rutina + recordatorios con hora, en el formato que el SW ya entiende
      const bloques = rutina.concat(
        (recordatorios || []).filter(r => r.hora).map(r => ({ hora: r.hora, nombre: '💊 ' + r.texto, desc: '', tipo: 'free' }))
      );
      const c = await caches.open('reps-datos');
      await c.put('./rutina-espejo.json', new Response(JSON.stringify(bloques), {headers:{'Content-Type':'application/json'}}));
    }catch(e){}
  }
  // todas las horas que deben avisar: bloques de rutina + recordatorios
  function horasAviso(){
    const h = rutinaOrdenada().map(s => s.hora);
    (recordatorios || []).forEach(r => { if(r.hora) h.push(r.hora); });
    return [...new Set(h)];
  }
  const pushActivo = () => { try{ return localStorage.getItem(PUSH_KEY) === '1'; }catch(e){ return false; } };
  async function pushSubscribe(){
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64uToU8(PUSH_PUB) });
    const res = await fetch(PUSH_WORKER + '/subscribe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subscription: sub.toJSON(), times: horasAviso(), tz: new Date().getTimezoneOffset() }),
    });
    if(!res.ok) throw new Error('worker ' + res.status);
    return sub;
  }
  async function pushOn(){
    if(!('serviceWorker' in navigator) || !('PushManager' in window)){ toast('Este navegador no soporta notificaciones push.'); return false; }
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('Sin permiso de notificaciones. Revisa los ajustes del navegador.'); return false; }
    try{
      await espejoParaSW();
      await pushSubscribe();
      try{ localStorage.setItem(PUSH_KEY, '1'); }catch(e){}
      toast('🔔 Notificaciones activadas: te avisará cada bloque.');
      return true;
    }catch(e){ toast('No se pudo conectar con el servidor de avisos.'); return false; }
  }
  async function pushOff(){
    try{
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if(sub){
        fetch(PUSH_WORKER + '/unsubscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(()=>{});
        await sub.unsubscribe();
      }
    }catch(e){}
    try{ localStorage.removeItem(PUSH_KEY); }catch(e){}
    toast('Notificaciones apagadas.');
  }
  // si cambias la rutina y el push está activo, re-manda las horas al Worker
  function pushSync(){
    if(!pushActivo()) return;
    espejoParaSW();
    pushSubscribe().catch(()=>{});
  }
  async function pushTest(){
    try{
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if(!sub){ toast('Primero activa las notificaciones.'); return; }
      const res = await fetch(PUSH_WORKER + '/test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint }) });
      toast(res.ok ? 'Enviada. Debe llegar en segundos. 🔔' : 'El servidor no pudo enviarla.');
    }catch(e){ toast('No se pudo probar.'); }
  }
  $('pushToggle').addEventListener('change', async ()=>{
    const el = $('pushToggle');
    if(el.checked){ const ok = await pushOn(); el.checked = ok; }
    else await pushOff();
  });
  $('pushTest').addEventListener('click', pushTest);

  // ===== Asistente (IA de visita, Capa 3.2) =====
  // La app arma un contexto MÍNIMO al momento (perfil, semana, metas, rutina),
  // lo manda al Worker /ia junto con la pregunta, y muestra el consejo. El
  // servidor piensa y olvida: nada de esto se guarda fuera del dispositivo.
  function contextoIA(){
    const partes = [];
    partes.push('Eres el asistente personal dentro de REPS, la app de hábitos de ' +
      (perfil && perfil.nombre ? perfil.nombre : 'el usuario') + '.');
    partes.push('Responde SIEMPRE en español, breve, concreto y accionable: di el cuándo y el cómo. Si te falta información, dilo y pregunta.');
    partes.push('Hoy es ' + new Date().toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) +
      ' y son las ' + new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}) + '.');
    const s = statsData();
    partes.push('Racha actual: ' + s.now + ' días. Total de días ganados: ' + s.total + '.');
    partes.push('Sus hábitos: ' + HABITS.map(h => h.name + (h.core ? ' (core)' : '')).join(' · '));
    partes.push('Su rutina: ' + rutinaOrdenada().map(x => x.hora + ' ' + x.nombre).join(' · '));
    const ps = planSemana[localISO(mondayOf(new Date()))];
    if(ps){
      if(ps.foco) partes.push('Enfoque de la semana: ' + ps.foco);
      if(ps.pendientes) partes.push('Pendientes de la semana: ' + ps.pendientes);
      if(ps.eventos) partes.push('Eventos y citas de la semana: ' + ps.eventos);
    }
    const mp = metas.filter(m => !m.hecha).map(m => m.texto).slice(0, 6);
    if(mp.length) partes.push('Sus metas pendientes: ' + mp.join(' · '));
    return partes.join('\n');
  }
  async function preguntarIA(pregunta){
    const res = await fetch(PUSH_WORKER + '/ia', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ sistema: contextoIA(), pregunta }),
    });
    if(!res.ok) throw new Error('worker ' + res.status);
    const d = await res.json();
    return d.texto || '';
  }
  let iaOcupado = false;

  // ===== Chat con memoria persistente (idea #84) =====
  // El hilo completo se guarda en localStorage: el asistente "recuerda" tus
  // charlas entre sesiones. El Worker es stateless, así que en cada turno le
  // mandamos el contexto + los últimos mensajes del hilo.
  const IA_CHAT_KEY = 'reps-ia-chat';
  let iaChat = []; // [{who:'yo'|'ia', text}]
  function loadIaChat(){
    iaChat = [];
    try{ const v = JSON.parse(localStorage.getItem(IA_CHAT_KEY));
      if(Array.isArray(v)) iaChat = v.filter(m => m && (m.who === 'yo' || m.who === 'ia') && typeof m.text === 'string').slice(-60);
    }catch(e){ iaChat = []; }
  }
  function saveIaChat(){ try{ localStorage.setItem(IA_CHAT_KEY, JSON.stringify(iaChat.slice(-60))); }catch(e){} }
  function renderIaChat(pensando){
    const c = $('iaChat'); if(!c) return; c.innerHTML = '';
    if(!iaChat.length && !pensando){
      const d = document.createElement('div'); d.className = 'ia-empty';
      d.textContent = 'Pregúntame lo que quieras. Recuerdo lo que hablamos.';
      c.appendChild(d);
    }
    iaChat.forEach(m => {
      const d = document.createElement('div'); d.className = 'ia-msg ' + m.who; d.textContent = m.text;
      c.appendChild(d);
    });
    if(pensando){ const d = document.createElement('div'); d.className = 'ia-msg ia pensando'; d.textContent = 'Pensando… 🤖'; c.appendChild(d); }
    c.scrollTop = c.scrollHeight;
  }
  async function iaEnviar(texto){
    const q = (texto || '').trim();
    if(!q || iaOcupado) return;
    iaOcupado = true;
    iaChat.push({ who:'yo', text: q }); saveIaChat();
    $('iaTxt').value = '';
    renderIaChat(true);
    // arma el hilo reciente para darle memoria (últimos ~16 mensajes)
    const hilo = iaChat.slice(-16).map(m => (m.who === 'ia' ? 'Asistente: ' : 'Yo: ') + m.text).join('\n');
    const sistema = contextoIA() + '\nEsta es una conversación continua: RECUERDA lo que ya se dijo en el hilo. Responde en 1–4 frases, cálido y útil.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: hilo }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      iaChat.push({ who:'ia', text: (d.texto || '').trim() || 'Cuéntame un poco más.' });
    }catch(e){ iaChat.push({ who:'ia', text:'(Sin conexión ahora. Tu mensaje quedó guardado; cuando vuelva el internet seguimos.)' }); }
    saveIaChat(); renderIaChat(false);
    iaOcupado = false;
  }
  $('iaBtn').addEventListener('click', ()=>{ renderIaChat(false); $('iaWrap').hidden = false; });
  $('iaClose').addEventListener('click', ()=>{ $('iaWrap').hidden = true; });
  $('iaWrap').addEventListener('click', (e)=>{ if(e.target === $('iaWrap')) $('iaWrap').hidden = true; });
  $('iaAsk').addEventListener('click', ()=>{ iaEnviar($('iaTxt').value); });
  $('iaClear').addEventListener('click', ()=>{
    if(!iaChat.length){ toast('No hay nada que olvidar.'); return; }
    if(!confirm('¿Borrar toda la conversación con el asistente? No se puede deshacer.')) return;
    iaChat = []; saveIaChat(); renderIaChat(false); toast('Conversación olvidada.');
  });
  $('iaSemana').addEventListener('click', ()=>{
    iaEnviar('Dame un consejo concreto para organizar mi semana: qué hacer cada día con mis pendientes y eventos, usando mis bloques de rutina.');
  });

  // ===== Desatóralo (idea #86): el primer paso mínimo ante un bloqueo =====
  async function desatorar(){
    if(iaOcupado) return;
    const t = $('dtInput').value.trim();
    if(!t){ toast('Cuéntame qué te tiene atorado.'); return; }
    iaOcupado = true;
    const out = $('dtOut'); out.hidden = false; out.textContent = 'Pensando el primer paso… 🧩';
    const sistema = contextoIA() + '\nLa persona está ATORADA en algo. Da EXACTAMENTE UN primer paso concreto, ' +
      'ridículamente pequeño y que se pueda hacer en 2 minutos AHORA (di el qué y cómo empezar). ' +
      'Nada de listas ni sermones. 1–3 frases, cálido y directo, en español.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Estoy atorado con: ' + t }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      out.textContent = (d.texto || '').trim() || 'Empieza por lo más pequeño que puedas nombrar ahora mismo.';
    }catch(e){ out.textContent = 'No hay conexión ahora. Aun así: haz la versión más pequeña posible de eso, solo 2 minutos.'; }
    iaOcupado = false;
  }
  $('iaDesatora').addEventListener('click', ()=>{ $('iaWrap').hidden = true; $('dtInput').value = ''; $('dtOut').hidden = true; $('desatoraWrap').hidden = false; });
  $('dtGo').addEventListener('click', desatorar);
  $('dtClose').addEventListener('click', ()=>{ $('desatoraWrap').hidden = true; });
  $('desatoraWrap').addEventListener('click', (e)=>{ if(e.target === $('desatoraWrap')) $('desatoraWrap').hidden = true; });

  // ===== Reencuadre (idea #87): mini-TCC ante un pensamiento que pesa =====
  async function reencuadrar(){
    if(iaOcupado) return;
    const t = $('reInput').value.trim();
    if(!t){ toast('Escribe el pensamiento que te pesa.'); return; }
    iaOcupado = true;
    const out = $('reOut'); out.hidden = false; out.textContent = 'Tomando aire contigo… 🌥️';
    const sistema = 'Eres un acompañante cálido con base en terapia cognitiva (TCC), dentro de una app personal. ' +
      'La persona comparte un pensamiento negativo o autocrítico. Ayúdala a reencuadrarlo en 3 pasos BREVES: ' +
      '(1) valida lo que siente sin juzgar; (2) señala con suavidad una distorsión o matiz (¿es 100% cierto? ¿siempre?); ' +
      '(3) ofrece una mirada alternativa más justa y una micro-acción amable. ' +
      'No diagnostiques ni sustituyas ayuda profesional; si detectas riesgo serio, sugiere buscar apoyo. ' +
      'Máximo 5 frases, tono humano y cercano, español, sin markdown.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'El pensamiento que me pesa es: ' + t }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      out.textContent = (d.texto || '').trim() || 'Ese pensamiento no es un hecho: es un estado. Respira, ya pasará.';
    }catch(e){ out.textContent = 'No hay conexión ahora. Recuerda: un mal momento no te define. Respira hondo tres veces.'; }
    iaOcupado = false;
  }
  $('iaReencuadre').addEventListener('click', ()=>{ $('iaWrap').hidden = true; $('reInput').value = ''; $('reOut').hidden = true; $('reencuadreWrap').hidden = false; });
  $('reGo').addEventListener('click', reencuadrar);
  $('reClose').addEventListener('click', ()=>{ $('reencuadreWrap').hidden = true; });
  $('reencuadreWrap').addEventListener('click', (e)=>{ if(e.target === $('reencuadreWrap')) $('reencuadreWrap').hidden = true; });

  // #32 Reflexión guiada: la IA hace preguntas para pensar. Mini conversación;
  // el Worker es stateless, así que en cada turno le mando el hilo completo.
  let rxConv = [];
  function renderRxConv(pensando){
    const c = $('rxConv'); c.innerHTML = '';
    rxConv.forEach(m => {
      const d = document.createElement('div'); d.className = 'rx-msg ' + m.who; d.textContent = m.text;
      c.appendChild(d);
    });
    if(pensando){ const d = document.createElement('div'); d.className = 'rx-msg ia pensando'; d.textContent = 'Pensando… 🪞'; c.appendChild(d); }
    c.scrollTop = c.scrollHeight;
  }
  const RX_SISTEMA = 'Eres un guía de reflexión personal, cálido y curioso. Haz UNA sola pregunta a la vez, ' +
    'breve y que invite a pensar (sobre su día, sus hábitos, cómo se siente, qué aprendió). Escucha lo que responde y ' +
    'profundiza con la siguiente. Tras 3 respuestas de la persona, en vez de otra pregunta, cierra con una observación ' +
    'breve y alentadora y NO preguntes más. Responde SOLO con tu mensaje, en español, sin markdown ni comillas.';
  async function reflexTurno(){
    if(iaOcupado) return; iaOcupado = true;
    renderRxConv(true);
    const respuestas = rxConv.filter(m => m.who === 'yo').length;
    const hilo = rxConv.map(m => (m.who === 'ia' ? 'Guía: ' : 'Yo: ') + m.text).join('\n');
    const pregunta = rxConv.length === 0
      ? contextoIA() + '\nInicia la reflexión de hoy con UNA pregunta cálida.'
      : hilo + '\n\n(La persona ya dio ' + respuestas + ' respuesta(s). ' +
        (respuestas >= 3 ? 'Cierra con una observación alentadora, sin más preguntas.' : 'Haz la siguiente pregunta, más profunda.') + ')';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema: RX_SISTEMA, pregunta }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      rxConv.push({ who:'ia', text: (d.texto || '').trim() || '¿Cómo te sientes ahora mismo?' });
    }catch(e){ rxConv.push({ who:'ia', text:'(No hay conexión. Cuando vuelva el internet seguimos.)' }); }
    renderRxConv(false);
    iaOcupado = false;
  }
  $('iaReflex').addEventListener('click', ()=>{
    $('iaWrap').hidden = true;
    rxConv = []; renderRxConv(false); $('rxInput').value = '';
    $('reflexWrap').hidden = false;
    reflexTurno(); // la IA lanza la primera pregunta
  });
  $('rxSend').addEventListener('click', ()=>{
    const t = $('rxInput').value.trim();
    if(!t || iaOcupado) return;
    rxConv.push({ who:'yo', text: t }); $('rxInput').value = '';
    reflexTurno();
  });
  $('rxClose').addEventListener('click', ()=>{ $('reflexWrap').hidden = true; });
  $('reflexWrap').addEventListener('click', (e)=>{ if(e.target === $('reflexWrap')) $('reflexWrap').hidden = true; });

  // ===== Diseñar mi semana con IA =====
  // Lee lo escrito en cada día de la semana VISIBLE (weekOff) y propone, por
  // día: tareas concretas + un ajuste de flexibilidad (día ligero por viaje,
  // mover el enfoque por un evento). Vista previa; el usuario SIEMPRE confirma.
  // Al aplicar: las tareas se suman al texto del día y el ajuste va a semFlex.
  let siPropuesta = null;
  // las 7 fechas de la semana visible, con etiqueta y lo ya escrito
  function semanaVisibleDias(){
    const mon = mondayOf(new Date());
    mon.setDate(mon.getDate() + weekOff * 7);
    const out = [];
    for(let i = 0; i < 7; i++){
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const key = localISO(d);
      out.push({
        key,
        etiqueta: d.toLocaleDateString('es-MX', {weekday:'long', day:'numeric'}),
        texto: (semana[key] || '').trim(),
      });
    }
    return out;
  }
  function sanearSemIA(v, validKeys){
    if(!v || !Array.isArray(v.dias)) return null;
    const out = [];
    v.dias.forEach(d => {
      if(!d || !validKeys.includes(d.fecha)) return;
      const tareas = Array.isArray(d.tareas)
        ? d.tareas.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0,100)).slice(0,4)
        : [];
      const flex = typeof d.flex === 'string' ? d.flex.trim().slice(0,140) : '';
      if(tareas.length || flex) out.push({ fecha: d.fecha, tareas, flex });
    });
    return out.length ? out : null;
  }
  $('semIA').addEventListener('click', ()=>{
    siPropuesta = null; $('siApply').hidden = true; $('siOut').hidden = true; $('semIAWrap').hidden = false;
  });
  $('siClose').addEventListener('click', ()=>{ $('semIAWrap').hidden = true; });
  $('semIAWrap').addEventListener('click', (e)=>{ if(e.target === $('semIAWrap')) $('semIAWrap').hidden = true; });
  $('siGo').addEventListener('click', async ()=>{
    const dias7 = semanaVisibleDias();
    if(!dias7.some(d => d.texto)){ toast('Escribe primero qué tienes en algunos días.'); return; }
    if(iaOcupado) return; iaOcupado = true;
    siPropuesta = null; $('siApply').hidden = true;
    const out = $('siOut'); out.hidden = false; out.textContent = 'Diseñando tu semana… 🤖';
    const validKeys = dias7.map(d => d.key);
    const sistema = 'Eres el asistente personal de organización semanal dentro de REPS. ' +
      'Recibes lo que la persona tiene planeado cada día de una semana. Para cada día propón: ' +
      '(a) 1 a 3 TAREAS concretas y accionables alrededor de lo que ya tiene (di el qué y, si aplica, el cuándo); ' +
      '(b) un ajuste de FLEXIBILIDAD del día en UNA frase corta (ej: "Día de viaje: hazlo ligero, solo lo esencial", ' +
      '"Evento en la tarde: adelanta tu bloque de enfoque a la mañana"). ' +
      'NUNCA muevas ni inventes eventos: respeta lo que la persona escribió, solo organiza alrededor. ' +
      'Si un día no tiene nada escrito, puedes omitirlo o proponer algo ligero acorde a sus metas. ' +
      'Responde ÚNICAMENTE con JSON válido, sin markdown, con la forma exacta: ' +
      '{"dias":[{"fecha":"YYYY-MM-DD","tareas":["...","..."],"flex":"..."}]}. En español.';
    const agenda = dias7.map(d => d.key + ' (' + d.etiqueta + '): ' + (d.texto || '(sin plan)')).join('\n');
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Diseña mi semana. Esto tengo cada día:\n' + agenda + '\n\n' + contextoIA() }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      const m = (d.texto || '').match(/\{[\s\S]*\}/);
      const prop = sanearSemIA(m ? JSON.parse(m[0]) : null, validKeys);
      if(!prop) throw new Error('formato');
      siPropuesta = prop;
      const etiquetaDe = k => (dias7.find(x => x.key === k) || {}).etiqueta || k;
      out.textContent = prop.map(p => '📅 ' + etiquetaDe(p.fecha) +
        (p.tareas.length ? '\n   • ' + p.tareas.join('\n   • ') : '') +
        (p.flex ? '\n   🤖 ' + p.flex : '')).join('\n\n');
      $('siApply').hidden = false;
    }catch(e){ out.textContent = 'No se pudo diseñar la semana. Revisa tu internet e intenta de nuevo.'; }
    iaOcupado = false;
  });
  $('siApply').addEventListener('click', ()=>{
    if(!siPropuesta) return;
    if(!confirm('Esto suma las tareas propuestas al texto de cada día y guarda los ajustes. ¿Aplicar?')) return;
    siPropuesta.forEach(p => {
      if(p.tareas.length){
        const prev = (semana[p.fecha] || '').trim();
        const nuevo = (prev ? prev + ' · ' : '') + p.tareas.join(' · ');
        semana[p.fecha] = nuevo;
      }
      if(p.flex) semFlex[p.fecha] = p.flex;
      else delete semFlex[p.fecha];
    });
    saveSemana(); saveSemFlex();
    renderSemana(); renderPlanHoy();
    $('semIAWrap').hidden = true; siPropuesta = null;
    toast('Tu semana está diseñada. 🗓️');
  });

  // ===== Diseñador de hábitos con IA =====
  // Cuestionario → la IA propone hábitos con horarios → el usuario SIEMPRE
  // confirma antes de aplicar. Reemplaza HABITS (el historial se conserva:
  // los ids viejos siguen en reps-dias) y opcionalmente suma bloques a la rutina.
  let ihPropuesta = null;
  function ihSanear(v){
    if(!v || !Array.isArray(v.habitos)) return null;
    const habs = v.habitos
      .filter(h => h && typeof h.name === 'string' && h.name.trim())
      .map(h => ({
        name: h.name.trim().slice(0, 40),
        hint: typeof h.hint === 'string' ? h.hint.trim().slice(0, 60) : '',
        core: !!h.core,
        planB: typeof h.planB === 'string' ? h.planB.trim().slice(0, 60) : '',
        emoji: sanearEmoji(h.emoji),
        hora: (typeof h.hora === 'string' && /^\d{1,2}:\d{2}$/.test(h.hora.trim())) ? h.hora.trim() : '',
      }))
      .slice(0, MAX_HABITS);
    if(habs.length < 2) return null;
    // respeta las reglas de la app: entre MIN_CORE y MAX_CORE núcleos
    let cores = habs.filter(h => h.core).length;
    for(let i = 0; i < habs.length && cores < MIN_CORE; i++){ if(!habs[i].core){ habs[i].core = true; cores++; } }
    for(let i = habs.length - 1; i >= 0 && cores > MAX_CORE; i--){ if(habs[i].core){ habs[i].core = false; cores--; } }
    return habs;
  }
  // núcleo reusable: recibe una descripción libre y devuelve hábitos saneados
  // (lo usan el diseñador de hábitos Y el onboarding con IA)
  const IH_SISTEMA = 'Eres un diseñador de hábitos experto (estilo Hábitos Atómicos): pocos hábitos, chicos y sostenibles, ' +
    'realistas para el horario y los traslados de la persona (si sale tarde y tarda en llegar, no le pongas cosas en ese hueco). ' +
    'Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto extra, con esta forma exacta: ' +
    '{"habitos":[{"name":"...","hint":"...","emoji":"🏃","core":true,"planB":"...","hora":"7:30"}]}. ' +
    'Entre 4 y 6 hábitos; de ellos exactamente 2 a 4 con core:true (los innegociables que definen un día ganado). ' +
    'name máx 40 caracteres, en español. hint = consejo práctico corto (máx 60). planB = la versión mínima para un día malo (máx 60). ' +
    'hora = hora sugerida en formato 24h H:MM, realista para su día.';
  async function ihGenerar(descripcion){
    const res = await fetch(PUSH_WORKER + '/ia', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ sistema: IH_SISTEMA, pregunta: descripcion }),
    });
    if(!res.ok) throw new Error('worker ' + res.status);
    const d = await res.json();
    const m = (d.texto || '').match(/\{[\s\S]*\}/); // tolera texto alrededor del JSON
    const habs = ihSanear(m ? JSON.parse(m[0]) : null);
    if(!habs) throw new Error('formato');
    return habs;
  }
  async function ihProponer(){
    const meta = $('ihMeta').value.trim();
    if(!meta){ toast('Cuéntale qué quieres lograr.'); return; }
    if(iaOcupado) return;
    iaOcupado = true;
    ihPropuesta = null; $('ihApply').hidden = true;
    const out = $('ihOut'); out.hidden = false; out.textContent = 'Diseñando tus hábitos… 🤖';
    const pregunta = 'Diseña mis hábitos. Lo que quiero lograr: ' + meta + '. Mi horario: ' +
      ($('ihHorario').value.trim() || 'no especificado') + '. Tiempo libre: ' +
      ($('ihTiempo').value.trim() || 'no especificado') + '. Quiero dejar/evitar: ' +
      ($('ihDejar').value.trim() || 'nada en particular') + '.';
    try{
      const habs = await ihGenerar(pregunta);
      ihPropuesta = habs;
      out.textContent = 'Te propongo:\n\n' + habs.map(h =>
        (h.emoji ? h.emoji + ' ' : '') + h.name + (h.core ? ' ⭐' : '') +
        (h.hora ? ' · ' + h.hora : '') +
        (h.hint ? '\n   ' + h.hint : '') +
        (h.planB ? '\n   🅱️ mínimo: ' + h.planB : '')
      ).join('\n\n') + '\n\n⭐ = innegociable (define tu día ganado)';
      $('ihApply').hidden = false;
    }catch(e){
      out.textContent = 'No se pudo generar la propuesta. Revisa tu internet e intenta de nuevo.';
    }
    iaOcupado = false;
  }
  function ihAplicar(){
    if(!ihPropuesta) return;
    // SIEMPRE preguntar antes: nada cambia sin un sí explícito
    if(!confirm('Esto REEMPLAZA tus ' + HABITS.length + ' hábitos actuales por los ' + ihPropuesta.length +
      ' propuestos. Tu historial de días se conserva. ¿Aplicar?')) return;
    HABITS = ihPropuesta.map(h => ({
      id: nuevoHabId(), name: h.name, hint: h.hint, core: h.core,
      days: 'all', planB: h.planB, emoji: h.emoji, porQue: '',
    }));
    rebuildCore(); saveHabitos(); render();
    // segunda decisión, también tuya: sumar las horas a la rutina
    const conHora = ihPropuesta.filter(h => h.hora);
    if(conHora.length && confirm('¿Agregar también sus horarios como bloques en tu rutina de Mi día? (' +
      conHora.map(h => h.hora + ' ' + h.name).join(' · ') + ')')){
      conHora.forEach(h => {
        if(rutina.length >= MAX_BLOQUES) return;
        rutina.push({ id: 'r' + Math.random().toString(36).slice(2, 8), hora: h.hora,
          nombre: (h.emoji ? h.emoji + ' ' : '') + h.name, desc: h.hint || '', tipo: h.core ? 'core' : 'free' });
      });
      saveRutina(); renderRutina();
    }
    $('iaHabWrap').hidden = true; $('habWrap').hidden = true;
    ihPropuesta = null;
    toast('Hábitos aplicados. A construir. 🤖🔥');
  }
  $('iaHabBtn').addEventListener('click', ()=>{ $('iaHabWrap').hidden = false; });
  $('ihClose').addEventListener('click', ()=>{ $('iaHabWrap').hidden = true; });
  $('iaHabWrap').addEventListener('click', (e)=>{ if(e.target === $('iaHabWrap')) $('iaHabWrap').hidden = true; });
  $('ihGo').addEventListener('click', ihProponer);
  $('ihApply').addEventListener('click', ihAplicar);

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
    {id:'cuerpo',    emoji:'💪', name:'Mi cuerpo',      hab:{name:'Moverte 20 min', hint:'Caminar, correr, lo que sea', core:true}, extra:{name:'Calistenia 5 min', hint:'Lagartijas, sentadillas', core:false}},
    {id:'aprender',  emoji:'🧠', name:'Aprender algo',  hab:{name:'Aprender 30 min', hint:'Idioma, curso, leer', core:true}},
    {id:'proyecto',  emoji:'🎯', name:'Un proyecto',    hab:{name:'Bloque de proyecto', hint:'Mínimo 1 hr, sin distracciones', core:true}},
    {id:'estudiar',  emoji:'📚', name:'Estudiar',       hab:{name:'Estudiar en bloques', hint:'45 min y descansa', core:true}},
    {id:'calma',     emoji:'🧘', name:'Calma mental',   hab:{name:'Respirar 5 min', hint:'Meditar o solo respirar', core:false}},
    {id:'comer',     emoji:'🥗', name:'Comer mejor',    hab:{name:'Una comida sana', hint:'Verdura o fruta al día', core:false}},
    {id:'dinero',    emoji:'💰', name:'Mis finanzas',   hab:{name:'Anotar mis gastos', hint:'2 min al final del día', core:false}},
    {id:'relacion',  emoji:'❤️', name:'Mis relaciones', hab:{name:'Tiempo con alguien', hint:'Llamar, ver, escribir', core:false}},
    {id:'pantalla',  emoji:'📵', name:'Menos pantalla', hab:{name:'Comida sin celular', hint:'Presencia, no scroll', core:false}},
    {id:'vicio',     emoji:'🚫', name:'Dejar un vicio', hab:{name:'Un día sin ___', hint:'Escribe cuál al editar', core:false}},
    {id:'dormir',    emoji:'😴', name:'Dormir mejor',   hab:{name:'Leer 15 min + dormir', hint:'Celular lejos de la cama', core:true}},
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
  // actividades concretas para el onboarding (yoga vs pilates vs correr…):
  // cada quien elige LO SUYO y se vuelve un hábito a su medida.
  const ONB_ACTIVIDADES = [
    {name:'Correr',        emoji:'🏃', hint:'20–30 min a tu ritmo'},
    {name:'Ir al gym',     emoji:'🏋️', hint:'Aunque sea ligero'},
    {name:'Yoga',          emoji:'🧘', hint:'15–20 min de práctica'},
    {name:'Pilates',       emoji:'🤸', hint:'Control y fuerza'},
    {name:'Caminar',       emoji:'🚶', hint:'Una vuelta despejando'},
    {name:'Leer',          emoji:'📚', hint:'Un rato', meta:20, unidad:'páginas'},
    {name:'Meditar',       emoji:'🧠', hint:'10 min de calma'},
    {name:'Tomar agua',    emoji:'💧', hint:'Hidrátate', meta:8, unidad:'vasos'},
    {name:'Tocar guitarra',emoji:'🎸', hint:'Practicar un rato'},
    {name:'Dibujar',       emoji:'🎨', hint:'Aunque sea un boceto'},
    {name:'Escribir',      emoji:'✍️', hint:'Diario o lo que fluya'},
    {name:'Estudiar',      emoji:'📖', hint:'Bloque enfocado'},
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
    // actividades concretas elegidas (yoga, pilates…): hábitos a su medida
    (d.actividades || []).forEach(a => {
      if(out.some(h => h.name.toLowerCase() === a.name.toLowerCase())) return; // sin duplicar
      out.push({id:nid(), name:a.name, hint:a.hint || '', core:false, days:'all',
        emoji:a.emoji || '', meta:a.meta || 0, unidad:a.unidad || ''});
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
  const ONB_PASOS = 8; // 0 intro·1 nombre·2 despertar·3 construir·4 actividades·5 tiempo·6 detalle·7 preview
  function abrirBienvenida(){
    onb = { step:0, nombre:'', despertar:null, construir:[], actividades:[], tiempo:null, horario:'', libre:'', iaHabs:null, iaRut:null };
    $('welcome').hidden = false;
    renderOnb();
  }
  // arma una descripción rica de las respuestas para que la IA diseñe
  function descripcionOnb(){
    const areas = onb.construir.map(id => (ONB_AREAS.find(a => a.id === id) || {}).name).filter(Boolean);
    const desp = ONB_DESPERTAR.find(x => x.id === onb.despertar);
    const t = ONB_TIEMPO.find(x => x.id === onb.tiempo);
    const p = [];
    p.push('Diseña mis hábitos diarios.');
    if(areas.length) p.push('Quiero enfocarme en: ' + areas.join(', ') + '.');
    if(onb.actividades.length) p.push('Actividades concretas que hago: ' + onb.actividades.map(a => a.name).join(', ') + '.');
    if(desp) p.push('Despierto ' + desp.name.toLowerCase() + (desp.hora ? ' (~' + desp.hora + ')' : '') + '.');
    if(t) p.push('Tiempo disponible: ' + t.name.toLowerCase() + ' (' + t.core + ' innegociables al día como máximo).');
    if(onb.horario) p.push('Mi horario y traslados: ' + onb.horario + '.');
    if(onb.libre) p.push('Además, en mis palabras: ' + onb.libre + '.');
    p.push('Ajusta las horas a mi día real; no pongas hábitos en huecos de traslado o clase/trabajo.');
    return p.join(' ');
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
      title('¿Algo que hagas en específico?', 'Yoga, correr, pilates… elige lo tuyo (hasta 4). Se vuelven hábitos a tu medida. Opcional.');
      const g = grid();
      ONB_ACTIVIDADES.forEach(a => {
        const activo = onb.actividades.some(x => x.name === a.name);
        g.appendChild(opBtn(a.emoji + ' ' + a.name, '', activo, ()=>{
          if(activo) onb.actividades = onb.actividades.filter(x => x.name !== a.name);
          else if(onb.actividades.length < 4) onb.actividades.push(a);
          else { toast('Hasta 4 aquí. Podrás sumar más desde la biblioteca.'); return; }
          renderOnb();
        }));
      });
    }
    else if(onb.step === 5){
      title('¿Cuánto tiempo real tienes?', 'Define cuántos innegociables al día.');
      const g = grid();
      ONB_TIEMPO.forEach(o => g.appendChild(opBtn(o.emoji + ' ' + o.name, o.sub, onb.tiempo === o.id, ()=>{
        onb.tiempo = o.id; onb.step++; renderOnb();
      })));
      next.hidden = true;
    }
    else if(onb.step === 6){
      title('Cuéntame de tu día', 'Con esto la IA puede armarte algo que de verdad te quede. Opcional — puedes saltarlo.');
      const l1 = document.createElement('div'); l1.className = 'wel-sub'; l1.style.marginTop = '10px'; l1.textContent = 'Tu horario y traslados';
      body.appendChild(l1);
      const ta1 = document.createElement('textarea'); ta1.className = 'ps-txt'; ta1.rows = 2;
      ta1.placeholder = 'Ej: entro a la escuela 7:30, salgo 3pm, hago 1.5 h de regreso';
      ta1.value = onb.horario; ta1.addEventListener('input', ()=> onb.horario = ta1.value);
      body.appendChild(ta1);
      const l2 = document.createElement('div'); l2.className = 'wel-sub'; l2.style.marginTop = '10px'; l2.textContent = 'Algo específico que quieras (en tus palabras)';
      body.appendChild(l2);
      const ta2 = document.createElement('textarea'); ta2.className = 'ps-txt'; ta2.rows = 2;
      ta2.placeholder = 'Ej: estudiar veterinaria y no descuidar el gym';
      ta2.value = onb.libre; ta2.addEventListener('input', ()=> onb.libre = ta2.value);
      body.appendChild(ta2);
    }
    else if(onb.step === 7){
      title('Tu sistema', 'Así queda. Podrás editarlo cuando quieras.');
      const usadosIA = !!onb.iaHabs;
      const habs = usadosIA ? onb.iaHabs : generarHabitos(onb);
      const lista = document.createElement('div'); lista.className = 'wel-preview';
      habs.forEach(h => {
        const row = document.createElement('div'); row.className = 'wp-prev-row';
        const nm = document.createElement('span');
        nm.textContent = (h.emoji ? h.emoji + ' ' : '') + h.name + (h.hora ? '  ·  ' + h.hora : '');
        row.appendChild(nm);
        if(h.core){ const c = document.createElement('span'); c.className = 'wp-core'; c.textContent = 'CORE'; row.appendChild(c); }
        lista.appendChild(row);
      });
      body.appendChild(lista);
      // botón de IA: rediseña con todo el contexto (siempre puedes no usarlo)
      const iaBtn = document.createElement('button');
      iaBtn.className = 'wel-skip'; iaBtn.type = 'button';
      iaBtn.textContent = usadosIA ? '✨ Rediseñar con IA' : '✨ Que la IA lo diseñe por mí';
      iaBtn.addEventListener('click', async ()=>{
        if(iaOcupado) return; iaOcupado = true;
        iaBtn.textContent = 'Diseñando…'; iaBtn.disabled = true;
        try{
          const habs2 = await ihGenerar(descripcionOnb());
          onb.iaHabs = habs2;
          // rutina reflejando sus horarios (solo los hábitos con hora)
          const conHora = habs2.filter(h => h.hora);
          onb.iaRut = conHora.length ? conHora.map(h => ({
            id: 'r' + Math.random().toString(36).slice(2, 8), hora: h.hora,
            nombre: (h.emoji ? h.emoji + ' ' : '') + h.name, desc: h.hint || '', tipo: h.core ? 'core' : 'free',
          })) : null;
          renderOnb();
        }catch(e){ toast('No se pudo con la IA. Revisa tu internet.'); iaBtn.textContent = '✨ Reintentar con IA'; iaBtn.disabled = false; }
        iaOcupado = false;
      });
      body.appendChild(iaBtn);
      if(usadosIA){
        const nota = document.createElement('div'); nota.className = 'wel-sub'; nota.style.marginTop = '8px';
        nota.textContent = '✨ Diseñado por la IA con tus respuestas.';
        body.appendChild(nota);
      }
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
    perfil = { nombre: onb.nombre.trim(), despertar: onb.despertar, construir: onb.construir,
      actividades: onb.actividades.map(a => a.name), tiempo: onb.tiempo,
      horario: onb.horario, libre: onb.libre, creado: new Date().toISOString() };
    savePerfil();
    if(onb.iaHabs){
      // hábitos diseñados por la IA (con historial nuevo; ids frescos)
      HABITS = onb.iaHabs.map(h => ({
        id: nuevoHabId(), name: h.name, hint: h.hint, core: h.core,
        days: 'all', planB: h.planB, emoji: h.emoji, porQue: '',
      }));
      if(onb.iaRut && onb.iaRut.length){ rutina = onb.iaRut.slice(0, MAX_BLOQUES); saveRutina(); renderRutina(); }
    } else {
      HABITS = generarHabitos(onb);
    }
    rebuildCore(); saveHabitos();
    aplicarNombre();
    $('welcome').hidden = true;
    render();
    toast('¡Tu sistema está listo! A ganar el día. 🔥');
  }
  $('welNext').addEventListener('click', ()=>{
    if(onb.step === 7){ finalizarBienvenida(); return; }
    onb.step++; renderOnb();
  });
  $('welBack').addEventListener('click', ()=>{ if(onb.step > 0){ onb.step--; renderOnb(); } });
  $('welcome').addEventListener('click', (e)=>{ /* fondo no cierra: es un flujo */ });

  // Escape siempre cierra las hojas de Ajustes y del editor (vía de escape
  // extra; la bienvenida no, porque es un flujo con su propio botón)
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      $('masWrap').hidden = true;
      $('themeWrap').hidden = true;
      $('notifWrap').hidden = true;
      $('finWrap').hidden = true;
      $('diarioWrap').hidden = true;
      $('suenoWrap').hidden = true;
      $('anioWrap').hidden = true;
      $('ideaPlanWrap').hidden = true;
      $('armaDiaWrap').hidden = true;
      $('reflexWrap').hidden = true;
      $('kanbanWrap').hidden = true;
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
  const DATA_KEYS = ['reps-dias', 'reps-bandeja', 'reps-cierres', 'reps-semana', 'reps-cierre-semana', 'reps-tema', 'reps-distribucion', 'reps-efecto', 'reps-racha', 'reps-habitos', 'reps-caidas', 'reps-hitos', 'reps-perfil', 'reps-foco', 'reps-foco-sonido', 'reps-metas', 'reps-rutina', 'reps-carta', 'reps-recompensas', 'reps-despertar', 'reps-plan-semana', 'reps-recordatorios', 'reps-record-hechos', 'reps-capas', 'reps-nav', 'reps-fuente', 'reps-semana-flex', 'reps-compa', 'reps-tema-auto', 'reps-finanzas', 'reps-evitar', 'reps-diario', 'reps-sueno', 'reps-kanban', 'reps-retos', 'reps-energia', 'reps-solo', 'reps-ia-chat', 'reps-gratitud', 'reps-agua', 'reps-pausas', 'reps-sueno-rutina', 'reps-checkin', 'reps-mantra', 'reps-carta-futuro', 'reps-victorias', 'reps-brutal', 'reps-hoy-cfg', 'reps-degradado', 'reps-sonidos', 'reps-eventos', 'reps-viaje', 'reps-rutina-tpl', 'reps-compacto'];

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

  // ===== Finanzas (en el menú "Más") =====
  // Registro simple de dinero, 100% local. reps-finanzas =
  // { movs:[{id,tipo,monto,cat,nota,fecha,creado}], presupuesto, metas:[{id,nombre,objetivo,ahorrado,creada}] }
  const FIN_KEY = 'reps-finanzas';
  const FIN_CATS = {
    gasto: [
      {id:'comida',emoji:'🍔',name:'Comida'},{id:'transporte',emoji:'🚌',name:'Transporte'},
      {id:'ocio',emoji:'🎉',name:'Ocio'},{id:'hogar',emoji:'🏠',name:'Hogar'},
      {id:'salud',emoji:'💊',name:'Salud'},{id:'compras',emoji:'🛍️',name:'Compras'},
      {id:'servicios',emoji:'📄',name:'Servicios'},{id:'otros',emoji:'📦',name:'Otros'},
    ],
    ingreso: [
      {id:'sueldo',emoji:'💼',name:'Sueldo'},{id:'extra',emoji:'✨',name:'Extra'},
      {id:'regalo',emoji:'🎁',name:'Regalo'},{id:'venta',emoji:'🏷️',name:'Venta'},
      {id:'otros',emoji:'📦',name:'Otros'},
    ],
  };
  let fin = { movs:[], presupuesto:0, presuCat:{}, metas:[], subs:[], deudas:[], carteras:[], noGasto:[] };
  let finTipo = 'gasto';
  let finCatSel = { gasto:'comida', ingreso:'sueldo' };

  function loadFin(){
    fin = { movs:[], presupuesto:0, presuCat:{}, metas:[], subs:[], deudas:[], carteras:[], noGasto:[] };
    try{
      const v = JSON.parse(localStorage.getItem(FIN_KEY));
      if(esMapa(v)){
        if(Array.isArray(v.movs)) fin.movs = v.movs.filter(m => m && typeof m.id === 'string' &&
          (m.tipo === 'gasto' || m.tipo === 'ingreso' || m.tipo === 'ahorro') && Number.isFinite(+m.monto) && typeof m.fecha === 'string');
        if(Number.isFinite(+v.presupuesto) && +v.presupuesto >= 0) fin.presupuesto = +v.presupuesto;
        if(esMapa(v.presuCat)) Object.keys(v.presuCat).forEach(k => {
          if(Number.isFinite(+v.presuCat[k]) && +v.presuCat[k] > 0) fin.presuCat[k] = +v.presuCat[k];
        });
        if(Array.isArray(v.metas)) fin.metas = v.metas.filter(g => g && typeof g.id === 'string' &&
          typeof g.nombre === 'string' && Number.isFinite(+g.objetivo));
        if(Array.isArray(v.subs)) fin.subs = v.subs.filter(sb => sb && typeof sb.id === 'string' &&
          typeof sb.nombre === 'string' && sb.nombre.trim() && Number.isFinite(+sb.monto) && +sb.monto > 0)
          .map(sb => ({ id: sb.id, nombre: sb.nombre.trim().slice(0,30), monto: +sb.monto,
            dia: Math.min(31, Math.max(1, parseInt(sb.dia,10) || 1)),
            cat: FIN_CATS.gasto.some(c => c.id === sb.cat) ? sb.cat : 'servicios' }));
        if(Array.isArray(v.deudas)) fin.deudas = v.deudas.filter(d => d && typeof d.id === 'string' &&
          typeof d.quien === 'string' && d.quien.trim() && Number.isFinite(+d.monto) && +d.monto > 0)
          .map(d => ({ id: d.id, quien: d.quien.trim().slice(0,30), monto: +d.monto,
            tipo: d.tipo === 'meDeben' ? 'meDeben' : 'debo', saldada: !!d.saldada, creada: d.creada || new Date().toISOString() }));
        if(Array.isArray(v.carteras)) fin.carteras = v.carteras.filter(w => w && typeof w.id === 'string' &&
          typeof w.nombre === 'string' && w.nombre.trim()).map(w => ({ id: w.id, nombre: w.nombre.trim().slice(0,24) }));
        if(Array.isArray(v.noGasto)) fin.noGasto = [...new Set(v.noGasto.filter(id => FIN_CATS.gasto.some(c => c.id === id)))]; // categorías vigiladas (idea #83)
      }
    }catch(e){ fin = { movs:[], presupuesto:0, presuCat:{}, metas:[], subs:[], deudas:[], carteras:[], noGasto:[] }; }
    procesarSubs(); // registra los fijos que ya tocan este mes
  }
  // registra como gasto las suscripciones cuyo día ya llegó y aún no están
  // registradas este mes (dedupe por m.sub). Idempotente.
  function procesarSubs(){
    const mes = mesActual();
    const hoyDia = new Date().getDate();
    let cambio = false;
    (fin.subs || []).forEach(sb => {
      if(hoyDia < sb.dia) return; // aún no toca este mes
      if(fin.movs.some(m => m.sub === sb.id && (m.fecha || '').startsWith(mes))) return; // ya está
      fin.movs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        tipo: 'gasto', monto: sb.monto, cat: sb.cat, nota: sb.nombre + ' (fijo)',
        fecha: mes + '-' + String(sb.dia).padStart(2,'0'), creado: new Date().toISOString(), sub: sb.id,
      });
      cambio = true;
    });
    if(cambio) saveFin();
  }
  function saveFin(){
    try{ localStorage.setItem(FIN_KEY, JSON.stringify(fin)); }
    catch(e){ toast('No se pudo guardar. Reintenta.'); }
  }
  // formato de dinero en pesos (es-MX). Redondea a 2 decimales.
  function fmtDinero(n){
    return (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:0, maximumFractionDigits:2});
  }
  const mesActual = () => today().slice(0, 7); // 'YYYY-MM'
  function finCatOf(tipo, id){ return (FIN_CATS[tipo] || []).find(c => c.id === id); }

  function abrirFinanzas(){
    procesarSubs(); // por si un fijo venció mientras la app estaba abierta
    renderFinCats();
    renderFin();
    $('finWrap').hidden = false;
  }
  // chips de categoría (según el tipo elegido)
  function renderFinCats(){
    const cont = $('finCats'); cont.innerHTML = '';
    (FIN_CATS[finTipo] || []).forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fin-cat' + (finCatSel[finTipo] === c.id ? ' on' : '');
      b.textContent = c.emoji + ' ' + c.name;
      b.addEventListener('click', ()=>{ finCatSel[finTipo] = c.id; renderFinCats(); });
      cont.appendChild(b);
    });
  }
  // suma de gastos "de verdad" (excluye ahorro y fijos) en un rango de fechas
  function gastoEntre(desde, hasta){
    return fin.movs.filter(m => m.tipo === 'gasto' && m.fecha >= desde && m.fecha <= hasta)
      .reduce((s,m) => s + (+m.monto), 0);
  }
  // #78 Reporte semanal: gasto de esta semana (lun–hoy) vs la anterior
  function renderFinSemana(){
    const card = $('finSemana'); if(!card) return;
    const mon = mondayOf(new Date());
    const lunKey = localISO(mon);
    const hoyKey = today();
    const estaSem = gastoEntre(lunKey, hoyKey);
    // misma cantidad de días de la semana pasada
    const monPrev = new Date(mon); monPrev.setDate(monPrev.getDate() - 7);
    const finPrev = new Date(monPrev); finPrev.setDate(finPrev.getDate() + (new Date(hoyKey+'T12:00:00') - mon) / 86400000);
    const semPrev = gastoEntre(localISO(monPrev), localISO(finPrev));
    if(estaSem === 0 && semPrev === 0){ card.hidden = true; return; }
    // categoría top de la semana
    const porCat = {};
    fin.movs.filter(m => m.tipo === 'gasto' && m.fecha >= lunKey && m.fecha <= hoyKey)
      .forEach(m => { porCat[m.cat] = (porCat[m.cat] || 0) + (+m.monto); });
    const topId = Object.keys(porCat).sort((a,b)=>porCat[b]-porCat[a])[0];
    const topC = topId ? finCatOf('gasto', topId) : null;
    let cmp = '';
    if(semPrev > 0){ const dif = Math.round((estaSem - semPrev)/semPrev*100);
      cmp = dif === 0 ? ' · igual que la semana pasada' : (dif > 0 ? ' · ' + dif + '% más que la pasada' : ' · ' + Math.abs(dif) + '% menos que la pasada'); }
    card.hidden = false;
    card.innerHTML = '';
    const t = document.createElement('div'); t.className = 'fin-card-t'; t.textContent = '🗓️ Esta semana';
    const big = document.createElement('div'); big.className = 'fin-sem-big'; big.textContent = fmtDinero(estaSem);
    const sub = document.createElement('div'); sub.className = 'fin-sem-sub';
    sub.textContent = (topC ? 'Más en ' + topC.emoji + ' ' + topC.name : 'Sin gastos aún') + cmp;
    card.append(t, big, sub);
  }
  // #81 Próximos pagos: suscripciones ordenadas por cuándo toca su día
  function renderFinProximos(){
    const wrap = $('finProximos'); if(!wrap) return;
    const list = $('finProxList'); list.innerHTML = '';
    const subs = (fin.subs || []);
    if(!subs.length){ wrap.hidden = true; return; }
    wrap.hidden = false;
    const hoyDia = new Date().getDate();
    const conFalta = subs.map(sb => {
      const pagadoEsteMes = fin.movs.some(m => m.sub === sb.id && (m.fecha||'').startsWith(mesActual()));
      // días hasta su próximo cobro (si ya pasó y está pagado, cuenta al mes que viene)
      let falta = sb.dia - hoyDia;
      if(falta < 0 || (falta === 0 && pagadoEsteMes)) falta += 30; // aprox mes siguiente
      return { sb, falta, pagadoEsteMes };
    }).sort((a,b) => a.falta - b.falta);
    conFalta.forEach(({sb, falta, pagadoEsteMes}) => {
      const c = finCatOf('gasto', sb.cat);
      const row = document.createElement('div'); row.className = 'fin-prox';
      const em = document.createElement('span'); em.className = 'fp-em'; em.textContent = c ? c.emoji : '📄';
      const body = document.createElement('div'); body.className = 'fp-body';
      const nm = document.createElement('div'); nm.className = 'fp-nm'; nm.textContent = sb.nombre;
      const meta = document.createElement('div'); meta.className = 'fp-when';
      meta.textContent = pagadoEsteMes && sb.dia <= hoyDia ? 'pagado este mes' : (falta === 0 ? '¡hoy!' : 'en ' + falta + ' día' + (falta===1?'':'s'));
      body.append(nm, meta);
      const amt = document.createElement('span'); amt.className = 'fp-amt'; amt.textContent = fmtDinero(sb.monto);
      if(falta <= 3 && !(pagadoEsteMes && sb.dia <= hoyDia)) row.classList.add('pronto');
      row.append(em, body, amt);
      list.appendChild(row);
    });
  }
  // #82 Gastos hormiga: compras chicas y repetidas (detección local, sin IA)
  function renderFinHormiga(){
    const card = $('finHormiga'); if(!card) return;
    const mes = mesActual();
    const UMBRAL = 150; // "chico" (pesos)
    const chicos = fin.movs.filter(m => m.tipo === 'gasto' && !m.sub && (m.fecha||'').startsWith(mes) && (+m.monto) <= UMBRAL);
    if(chicos.length < 5){ card.hidden = true; return; }
    const total = chicos.reduce((s,m)=>s+(+m.monto),0);
    const porCat = {};
    chicos.forEach(m => { porCat[m.cat] = (porCat[m.cat] || 0) + (+m.monto); });
    const topId = Object.keys(porCat).sort((a,b)=>porCat[b]-porCat[a])[0];
    const topC = finCatOf('gasto', topId);
    card.hidden = false; card.innerHTML = '';
    const t = document.createElement('div'); t.className = 'fin-card-t'; t.textContent = '🐜 Gastos hormiga';
    const b = document.createElement('div'); b.className = 'fin-horm-b';
    b.textContent = chicos.length + ' compras chicas (≤' + fmtDinero(UMBRAL) + ') suman ' + fmtDinero(total) + ' este mes' + (topC ? ', sobre todo en ' + topC.emoji + ' ' + topC.name : '') + '.';
    card.append(t, b);
  }
  // #83 Días sin gastar: por cada categoría vigilada, racha de días limpios
  function renderFinNoGasto(){
    const cont = $('finNoGasto'); if(!cont) return; cont.innerHTML = '';
    const hoyKey = today();
    (fin.noGasto || []).forEach(catId => {
      const c = finCatOf('gasto', catId); if(!c) return;
      // última fecha con gasto en esa categoría
      const fechas = fin.movs.filter(m => m.tipo === 'gasto' && m.cat === catId).map(m => m.fecha).sort();
      const ultima = fechas[fechas.length - 1] || null;
      let dias;
      if(!ultima) dias = null; // nunca has gastado ahí
      else { dias = Math.round((new Date(hoyKey+'T12:00:00') - new Date(ultima+'T12:00:00')) / 86400000); }
      const row = document.createElement('div'); row.className = 'fin-ng';
      const em = document.createElement('span'); em.className = 'fng-em'; em.textContent = c.emoji;
      const body = document.createElement('div'); body.className = 'fng-body';
      const nm = document.createElement('div'); nm.className = 'fng-nm'; nm.textContent = c.name;
      const st = document.createElement('div'); st.className = 'fng-st';
      st.textContent = dias === null ? 'Aún limpio (sin registros)' : dias === 0 ? 'Hoy gastaste aquí' : dias + ' día' + (dias===1?'':'s') + ' sin gastar 🔥';
      body.append(nm, st);
      const del = document.createElement('button'); del.className = 'fng-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Dejar de vigilar');
      del.addEventListener('click', ()=>{ fin.noGasto = fin.noGasto.filter(x => x !== catId); saveFin(); renderFin(); });
      row.append(em, body, del);
      cont.appendChild(row);
    });
    // llena el select con categorías aún no vigiladas
    const sel = $('finNoGastoCat'); if(sel){ sel.innerHTML = '';
      FIN_CATS.gasto.filter(c => !(fin.noGasto||[]).includes(c.id)).forEach(c => {
        const o = document.createElement('option'); o.value = c.id; o.textContent = c.emoji + ' ' + c.name; sel.appendChild(o);
      });
    }
  }

  function renderFin(){
    const mes = mesActual();
    const delMes = fin.movs.filter(m => (m.fecha || '').startsWith(mes));
    const ingresos = delMes.filter(m => m.tipo === 'ingreso').reduce((s,m) => s + (+m.monto), 0);
    const gastos = delMes.filter(m => m.tipo === 'gasto').reduce((s,m) => s + (+m.monto), 0);
    // ahorro apartado este mes (idea #79): 'in' resta del saldo, 'out' (retiro) suma
    const ahorroMes = delMes.filter(m => m.tipo === 'ahorro')
      .reduce((s,m) => s + (m.dir === 'out' ? -(+m.monto) : (+m.monto)), 0);
    const saldo = ingresos - gastos - ahorroMes; // lo que te queda tras gastar Y apartar
    // línea "apartado a ahorro este mes"
    const amEl = $('finAhorroMes');
    if(amEl){ if(ahorroMes !== 0){ amEl.hidden = false; amEl.textContent = (ahorroMes > 0 ? '🏦 Apartaste ' + fmtDinero(ahorroMes) + ' a tus metas este mes.' : '🏦 Retiraste ' + fmtDinero(-ahorroMes) + ' de tus ahorros este mes.'); } else amEl.hidden = true; }
    renderFinSemana();   // #78
    renderFinProximos(); // #81
    renderFinHormiga();  // #82
    renderFinNoGasto();  // #83

    $('finMes').textContent = new Date(mes + '-15T12:00:00').toLocaleDateString('es-MX', {month:'long', year:'numeric'});
    const sc = $('finSaldo'); sc.textContent = fmtDinero(saldo);
    sc.className = 'fin-saldo' + (saldo < 0 ? ' neg' : saldo > 0 ? ' pos' : '');
    $('finIng').textContent = '+ ' + fmtDinero(ingresos);
    $('finGas').textContent = '− ' + fmtDinero(gastos);

    // mes vs mes: compara los GASTOS con el mes anterior
    const [ay, am] = mes.split('-').map(Number);
    const prevD = new Date(ay, am - 2, 15); // am-2 = mes anterior (0-index)
    const prevKey = prevD.getFullYear() + '-' + String(prevD.getMonth() + 1).padStart(2, '0');
    const gastosPrev = fin.movs.filter(m => m.tipo === 'gasto' && (m.fecha || '').startsWith(prevKey))
      .reduce((s, m) => s + (+m.monto), 0);
    const vs = $('finVs');
    if(gastosPrev > 0 && gastos > 0){
      const dif = Math.round((gastos - gastosPrev) / gastosPrev * 100);
      vs.hidden = false;
      if(dif === 0) vs.innerHTML = 'Igual que el mes pasado.';
      else vs.innerHTML = (dif > 0 ? 'Gastaste <b class="up">' + dif + '% más</b>' : 'Gastaste <b class="down">' + Math.abs(dif) + '% menos</b>') +
        ' que el mes pasado (' + fmtDinero(gastosPrev) + ').';
    } else vs.hidden = true;

    // proyección de fin de mes (según el ritmo de gasto)
    const proy = $('finProy');
    const diaHoy = new Date().getDate();
    const diasMes = new Date(ay, am, 0).getDate(); // último día del mes
    if(gastos > 0 && diaHoy < diasMes){
      const est = Math.round(gastos / diaHoy * diasMes);
      proy.hidden = false;
      proy.innerHTML = 'A este ritmo cerrarás el mes en <b>' + fmtDinero(est) + '</b> de gastos.';
    } else proy.hidden = true;

    // presupuesto del mes (vs gastos)
    if(fin.presupuesto > 0){
      $('finPresuBar').hidden = false;
      const pct = Math.min(100, Math.round(gastos / fin.presupuesto * 100));
      const over = gastos > fin.presupuesto;
      $('finPresuTxt').textContent = fmtDinero(gastos) + ' de ' + fmtDinero(fin.presupuesto);
      $('finPresuPct').textContent = (over ? '¡pasado! ' : '') + pct + '%';
      $('finPresuPct').style.color = over ? 'var(--red)' : 'var(--muted)';
      const fill = $('finPresuFill');
      fill.style.width = pct + '%';
      fill.classList.toggle('over', over);
    } else {
      $('finPresuBar').hidden = true;
    }
    $('finPresuInput').value = fin.presupuesto > 0 ? String(fin.presupuesto) : '';

    // desglose de GASTOS por categoría (en qué se te va), barras ordenadas
    const porCat = {};
    delMes.filter(m => m.tipo === 'gasto').forEach(m => { porCat[m.cat] = (porCat[m.cat] || 0) + (+m.monto); });
    const cats = Object.keys(porCat).sort((a,b) => porCat[b] - porCat[a]);
    const brk = $('finCatBreak'); brk.innerHTML = '';
    $('finCatTitle').hidden = cats.length === 0;
    cats.forEach(id => {
      const c = finCatOf('gasto', id);
      const monto = porCat[id];
      const pct = gastos > 0 ? Math.round(monto / gastos * 100) : 0;
      const row = document.createElement('div'); row.className = 'fin-catrow';
      const em = document.createElement('span'); em.className = 'fc-em'; em.textContent = c ? c.emoji : '💵';
      const body = document.createElement('div'); body.className = 'fc-body';
      const top = document.createElement('div'); top.className = 'fc-top';
      const nm = document.createElement('span'); nm.className = 'fc-nm'; nm.textContent = c ? c.name : id;
      const cb = fin.presuCat[id] || 0; // presupuesto de esta categoría
      const over = cb > 0 && monto > cb;
      const amt = document.createElement('span'); amt.className = 'fc-amt';
      // sobre (idea #80): con tope, muestra "gastado / tope · queda $X"
      amt.textContent = cb > 0 ? (fmtDinero(monto) + ' / ' + fmtDinero(cb) + (over ? ' · pasado' : ' · queda ' + fmtDinero(cb - monto))) : (fmtDinero(monto) + ' · ' + pct + '%');
      if(over) amt.style.color = 'var(--red)';
      top.append(nm, amt);
      const bar = document.createElement('div'); bar.className = 'fc-bar';
      // con presupuesto de categoría, la barra mide monto/presupuesto; si no, share del total
      const barPct = cb > 0 ? Math.min(100, Math.round(monto / cb * 100)) : pct;
      const fill = document.createElement('i'); fill.style.width = barPct + '%';
      if(over) fill.style.background = 'var(--red)';
      bar.appendChild(fill);
      body.append(top, bar);
      row.append(em, body);
      brk.appendChild(row);
    });

    // config de presupuesto por categoría (una fila por categoría de gasto)
    const cfg = $('finPresuCatCfg'); cfg.innerHTML = '';
    FIN_CATS.gasto.forEach(c => {
      const row = document.createElement('div'); row.className = 'fin-pcat';
      const lab = document.createElement('span'); lab.className = 'fp-lab'; lab.textContent = c.emoji + ' ' + c.name;
      const inp = document.createElement('input'); inp.type = 'number'; inp.inputMode = 'decimal'; inp.min = '0';
      inp.className = 'fp-inp'; inp.placeholder = '$'; inp.value = fin.presuCat[c.id] > 0 ? String(fin.presuCat[c.id]) : '';
      inp.addEventListener('change', ()=>{
        const v = parseFloat(inp.value);
        if(Number.isFinite(v) && v > 0) fin.presuCat[c.id] = Math.round(v * 100) / 100;
        else delete fin.presuCat[c.id];
        saveFin(); renderFin();
      });
      row.append(lab, inp);
      cfg.appendChild(row);
    });

    // lista de movimientos del mes (recientes primero)
    const list = $('finList'); list.innerHTML = '';
    const orden = delMes.filter(m => m.tipo !== 'ahorro').slice().sort((a,b) => (b.creado||'').localeCompare(a.creado||''));
    $('finVacio').hidden = orden.length > 0;
    orden.forEach(m => {
      const c = finCatOf(m.tipo, m.cat);
      const row = document.createElement('div'); row.className = 'fin-mov';
      const ic = document.createElement('span'); ic.className = 'fm-ic'; ic.textContent = c ? c.emoji : '💵';
      const body = document.createElement('div'); body.className = 'fm-body';
      const cat = document.createElement('div'); cat.className = 'fm-cat'; cat.textContent = c ? c.name : m.tipo;
      const meta = document.createElement('div'); meta.className = 'fm-meta';
      const dia = new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-MX', {day:'numeric', month:'short'});
      meta.textContent = dia + (m.nota ? ' · ' + m.nota : '');
      body.append(cat, meta);
      const amt = document.createElement('span'); amt.className = 'fm-amt ' + m.tipo;
      amt.textContent = (m.tipo === 'gasto' ? '− ' : '+ ') + fmtDinero(+m.monto);
      const del = document.createElement('button'); del.className = 'fm-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar movimiento');
      del.addEventListener('click', ()=>{
        fin.movs = fin.movs.filter(x => x.id !== m.id); saveFin(); renderFin();
      });
      row.append(ic, body, amt, del);
      list.appendChild(row);
    });

    // metas de ahorro
    const mc = $('finMetas'); mc.innerHTML = '';
    if(!fin.metas.length){
      const v = document.createElement('div'); v.className = 'fin-meta-vacio';
      v.textContent = 'Sin metas todavía. Crea una abajo.';
      mc.appendChild(v);
    }
    fin.metas.forEach(g => {
      const card = document.createElement('div'); card.className = 'fin-meta';
      const top = document.createElement('div'); top.className = 'fin-meta-top';
      const nom = document.createElement('span'); nom.className = 'fin-meta-nom'; nom.textContent = g.nombre;
      const num = document.createElement('span'); num.className = 'fin-meta-num';
      const pct = g.objetivo > 0 ? Math.min(100, Math.round(g.ahorrado / g.objetivo * 100)) : 0;
      num.textContent = fmtDinero(g.ahorrado) + ' / ' + fmtDinero(g.objetivo) + ' · ' + pct + '%';
      top.append(nom, num);
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
      const acts = document.createElement('div'); acts.className = 'fin-meta-acts';
      const inp = document.createElement('input'); inp.type = 'number'; inp.inputMode = 'decimal';
      inp.placeholder = '$ aportar'; inp.min = '0';
      const add = document.createElement('button'); add.textContent = 'Aportar';
      // aportar (idea #79): registra un movimiento de AHORRO para que tu
      // saldo del mes baje de verdad — sabes EXACTO cuánto tienes apartado.
      const aportar = ()=>{
        const v = parseFloat(inp.value);
        if(!(v > 0)){ toast('Escribe cuánto aportas.'); return; }
        g.ahorrado = Math.max(0, (+g.ahorrado || 0) + v);
        fin.movs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
          tipo: 'ahorro', dir: 'in', monto: Math.round(v * 100) / 100, cat: 'ahorro',
          nota: g.nombre, meta: g.id, fecha: today(), creado: new Date().toISOString() });
        saveFin(); renderFin();
        if(g.ahorrado >= g.objetivo){ sonarGanado(); toast('¡Meta «' + g.nombre + '» cumplida! 🎉'); }
        else { sonarCheck(); toast('Apartaste ' + fmtDinero(v) + '. Tu saldo bajó igual.'); }
      };
      add.addEventListener('click', aportar);
      // retirar: devuelve dinero del ahorro al saldo (registra el movimiento inverso)
      const ret = document.createElement('button'); ret.textContent = 'Retirar'; ret.className = 'fin-meta-ret';
      ret.addEventListener('click', ()=>{
        const v = parseFloat(inp.value);
        if(!(v > 0)){ toast('Escribe cuánto retiras.'); return; }
        const real = Math.min(v, +g.ahorrado || 0);
        if(real <= 0){ toast('No hay nada que retirar.'); return; }
        g.ahorrado = Math.max(0, (+g.ahorrado || 0) - real);
        fin.movs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
          tipo: 'ahorro', dir: 'out', monto: Math.round(real * 100) / 100, cat: 'ahorro',
          nota: g.nombre, meta: g.id, fecha: today(), creado: new Date().toISOString() });
        saveFin(); renderFin(); sonarCheck(); toast('Retiraste ' + fmtDinero(real) + '.');
      });
      const del = document.createElement('button'); del.className = 'fin-meta-del'; del.textContent = 'borrar';
      del.addEventListener('click', ()=>{
        if(!confirm('¿Borrar la meta «' + g.nombre + '»?')) return;
        fin.metas = fin.metas.filter(x => x.id !== g.id); saveFin(); renderFin();
      });
      acts.append(inp, add, ret, del);
      card.append(top, bar, acts);
      mc.appendChild(card);
    });

    // suscripciones / gastos fijos
    const subsCont = $('finSubs'); subsCont.innerHTML = '';
    (fin.subs || []).forEach(sb => {
      const c = finCatOf('gasto', sb.cat);
      const row = document.createElement('div'); row.className = 'fin-sub';
      const em = document.createElement('span'); em.className = 'fs-em'; em.textContent = c ? c.emoji : '📄';
      const body = document.createElement('div'); body.className = 'fs-body';
      const nm = document.createElement('div'); nm.className = 'fs-nm'; nm.textContent = sb.nombre;
      const meta = document.createElement('div'); meta.className = 'fs-meta'; meta.textContent = 'cada mes · día ' + sb.dia;
      body.append(nm, meta);
      const amt = document.createElement('span'); amt.className = 'fs-amt'; amt.textContent = '− ' + fmtDinero(sb.monto);
      const del = document.createElement('button'); del.className = 'fs-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar suscripción');
      del.addEventListener('click', ()=>{ fin.subs = fin.subs.filter(x => x.id !== sb.id); saveFin(); renderFin(); });
      row.append(em, body, amt, del);
      subsCont.appendChild(row);
    });
    // llena el <select> de categoría (una sola vez)
    const sel = $('finSubCat');
    if(!sel.options.length) FIN_CATS.gasto.forEach(c => {
      const o = document.createElement('option'); o.value = c.id; o.textContent = c.emoji + ' ' + c.name; sel.appendChild(o);
    });

    // deudas y préstamos (solo cuentan las NO saldadas en los totales)
    const dc = $('finDeudas'); dc.innerHTML = '';
    const activas = (fin.deudas || []).filter(d => !d.saldada);
    const debo = activas.filter(d => d.tipo === 'debo').reduce((a,d)=>a+d.monto, 0);
    const deben = activas.filter(d => d.tipo === 'meDeben').reduce((a,d)=>a+d.monto, 0);
    const dt = $('finDeudaTot');
    dt.hidden = (fin.deudas || []).length === 0;
    dt.innerHTML = '<span class="fd-debo">Debo ' + fmtDinero(debo) + '</span><span class="fd-deben">Me deben ' + fmtDinero(deben) + '</span>';
    (fin.deudas || []).forEach(d => {
      const row = document.createElement('div'); row.className = 'fin-deuda' + (d.saldada ? ' saldada' : '');
      const chk = document.createElement('button'); chk.className = 'fd-chk'; chk.textContent = '✓';
      chk.setAttribute('aria-label', 'Marcar saldada');
      chk.addEventListener('click', ()=>{ d.saldada = !d.saldada; saveFin(); renderFin(); });
      const body = document.createElement('div'); body.className = 'fd-body';
      const q = document.createElement('div'); q.className = 'fd-quien'; q.textContent = d.quien;
      const tp = document.createElement('div'); tp.className = 'fd-tipo'; tp.textContent = d.tipo === 'debo' ? 'le debo' : 'me debe';
      body.append(q, tp);
      const amt = document.createElement('span'); amt.className = 'fd-monto ' + d.tipo; amt.textContent = fmtDinero(d.monto);
      const del = document.createElement('button'); del.className = 'fd-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar');
      del.addEventListener('click', ()=>{ fin.deudas = fin.deudas.filter(x => x.id !== d.id); saveFin(); renderFin(); });
      row.append(chk, body, amt, del);
      dc.appendChild(row);
    });

    // carteras: lista con saldo (todos los movimientos asignados a cada una)
    const wc = $('finCarteras'); wc.innerHTML = '';
    (fin.carteras || []).forEach(w => {
      const bal = fin.movs.filter(m => m.cart === w.id)
        .reduce((a,m) => a + (m.tipo === 'ingreso' ? +m.monto : -m.monto), 0);
      const row = document.createElement('div'); row.className = 'fin-cart';
      const nm = document.createElement('span'); nm.className = 'fw-nm'; nm.textContent = w.nombre;
      const b = document.createElement('span'); b.className = 'fw-bal ' + (bal < 0 ? 'neg' : 'pos'); b.textContent = fmtDinero(bal);
      const del = document.createElement('button'); del.className = 'fw-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar cartera');
      del.addEventListener('click', ()=>{
        if(!confirm('¿Borrar la cartera «' + w.nombre + '»? Los movimientos se conservan, solo pierden la asignación.')) return;
        fin.carteras = fin.carteras.filter(x => x.id !== w.id);
        fin.movs.forEach(m => { if(m.cart === w.id) delete m.cart; });
        saveFin(); renderFin();
      });
      row.append(nm, b, del);
      wc.appendChild(row);
    });
    // el selector de cartera del formulario: solo si hay carteras
    const msel = $('finMovCart');
    msel.hidden = (fin.carteras || []).length === 0;
    const prev = msel.value;
    msel.innerHTML = '';
    (fin.carteras || []).forEach(w => { const o = document.createElement('option'); o.value = w.id; o.textContent = w.nombre; msel.appendChild(o); });
    if(prev) msel.value = prev;
  }
  // tipo gasto/ingreso
  document.querySelectorAll('#finTipo button').forEach(b => {
    b.addEventListener('click', ()=>{
      finTipo = b.dataset.tipo;
      document.querySelectorAll('#finTipo button').forEach(x => x.classList.toggle('on', x === b));
      renderFinCats();
    });
  });
  $('finAdd').addEventListener('click', ()=>{
    const monto = parseFloat($('finMonto').value);
    if(!(monto > 0)){ toast('Escribe un monto válido.'); return; }
    const mov = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      tipo: finTipo, monto: Math.round(monto * 100) / 100,
      cat: finCatSel[finTipo], nota: $('finNota').value.trim().slice(0,60),
      fecha: today(), creado: new Date().toISOString(),
    };
    if(fin.carteras.length && $('finMovCart').value) mov.cart = $('finMovCart').value; // cartera opcional
    fin.movs.push(mov);
    saveFin();
    $('finMonto').value = ''; $('finNota').value = '';
    sonarCheck(); renderFin();
    toast('Movimiento registrado.');
  });
  $('finCartAdd').addEventListener('click', ()=>{
    const nombre = $('finCartNom').value.trim().slice(0,24);
    if(!nombre){ toast('Ponle nombre a la cartera.'); return; }
    fin.carteras.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), nombre });
    saveFin();
    $('finCartNom').value = '';
    renderFin();
    toast('Cartera creada.');
  });
  $('finMetaAdd').addEventListener('click', ()=>{
    const nombre = $('finMetaNom').value.trim().slice(0,30);
    const obj = parseFloat($('finMetaObj').value);
    if(!nombre){ toast('Ponle nombre a la meta.'); return; }
    if(!(obj > 0)){ toast('¿Cuánto quieres juntar?'); return; }
    fin.metas.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      nombre, objetivo: Math.round(obj * 100) / 100, ahorrado: 0, creada: new Date().toISOString(),
    });
    saveFin();
    $('finMetaNom').value = ''; $('finMetaObj').value = '';
    renderFin();
    toast('Meta creada. 🎯');
  });
  $('finSubAdd').addEventListener('click', ()=>{
    const nombre = $('finSubNom').value.trim().slice(0,30);
    const monto = parseFloat($('finSubMonto').value);
    const dia = parseInt($('finSubDia').value, 10);
    if(!nombre){ toast('Ponle nombre al gasto fijo.'); return; }
    if(!(monto > 0)){ toast('¿De cuánto es?'); return; }
    if(!(dia >= 1 && dia <= 31)){ toast('¿Qué día del mes se paga? (1–31)'); return; }
    fin.subs.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      nombre, monto: Math.round(monto * 100) / 100, dia, cat: $('finSubCat').value || 'servicios',
    });
    saveFin();
    procesarSubs(); // si ya pasó su día este mes, lo registra al toque
    $('finSubNom').value = ''; $('finSubMonto').value = ''; $('finSubDia').value = '';
    renderFin();
    toast('Gasto fijo guardado.');
  });
  $('finDeudaAdd').addEventListener('click', ()=>{
    const quien = $('finDeudaQuien').value.trim().slice(0,30);
    const monto = parseFloat($('finDeudaMonto').value);
    if(!quien){ toast('¿Quién?'); return; }
    if(!(monto > 0)){ toast('¿De cuánto?'); return; }
    fin.deudas.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      quien, monto: Math.round(monto * 100) / 100, tipo: $('finDeudaTipo').value === 'meDeben' ? 'meDeben' : 'debo',
      saldada: false, creada: new Date().toISOString(),
    });
    saveFin();
    $('finDeudaQuien').value = ''; $('finDeudaMonto').value = '';
    renderFin();
    toast('Anotado.');
  });
  $('finNoGastoAdd').addEventListener('click', ()=>{
    const id = $('finNoGastoCat').value;
    if(!id){ toast('No hay más categorías por vigilar.'); return; }
    if(!fin.noGasto) fin.noGasto = [];
    if(!fin.noGasto.includes(id)) fin.noGasto.push(id);
    saveFin(); renderFin(); toast('Vigilando esa categoría. 👀');
  });
  $('finPresuSave').addEventListener('click', ()=>{
    const p = parseFloat($('finPresuInput').value);
    fin.presupuesto = (Number.isFinite(p) && p > 0) ? Math.round(p * 100) / 100 : 0;
    saveFin(); renderFin();
    toast(fin.presupuesto > 0 ? 'Presupuesto guardado.' : 'Sin límite de presupuesto.');
  });
  $('finClose').addEventListener('click', ()=>{ $('finWrap').hidden = true; });
  $('finWrap').addEventListener('click', (e)=>{ if(e.target === $('finWrap')) $('finWrap').hidden = true; });

  // #5 Coach financiero (IA): analiza el mes y da UN consejo. Stateless.
  $('finCoach').addEventListener('click', async ()=>{
    if(iaOcupado) return;
    const mes = mesActual();
    const dm = fin.movs.filter(m => (m.fecha || '').startsWith(mes));
    const ingresos = dm.filter(m => m.tipo === 'ingreso').reduce((a,m)=>a+(+m.monto),0);
    const gastos = dm.filter(m => m.tipo === 'gasto').reduce((a,m)=>a+(+m.monto),0);
    if(gastos === 0){ toast('Registra algunos gastos primero.'); return; }
    const porCat = {};
    dm.filter(m => m.tipo === 'gasto').forEach(m => { porCat[m.cat] = (porCat[m.cat]||0)+(+m.monto); });
    const desglose = Object.keys(porCat).sort((a,b)=>porCat[b]-porCat[a])
      .map(id => { const c = finCatOf('gasto', id); return (c?c.name:id) + ': ' + fmtDinero(porCat[id]); }).join(', ');
    iaOcupado = true;
    const out = $('finCoachOut'); out.hidden = false; out.textContent = 'Analizando tus gastos… ✨';
    const sistema = 'Eres un asesor financiero cercano y práctico (no un asesor de inversiones). ' +
      'Da UN consejo concreto y accionable para ahorrar este mes, en 2-3 frases, en español, sin juzgar. ' +
      'Usa los números que te doy. Nada de listas ni markdown.';
    const preg = 'Mi mes (pesos MX): ingresos ' + fmtDinero(ingresos) + ', gastos ' + fmtDinero(gastos) +
      (fin.presupuesto > 0 ? ', presupuesto ' + fmtDinero(fin.presupuesto) : '') +
      '. Gastos por categoría: ' + desglose + '.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: preg }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      out.textContent = (d.texto || '').trim() || 'No pude generar el consejo. Intenta de nuevo.';
    }catch(e){ out.textContent = 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'; }
    iaOcupado = false;
  });

  // ===== Días sin… (hábitos a evitar) =====
  // Cosas que quieres dejar (fumar, celular en cama…). Se cuenta cuántos días
  // llevas limpio desde `desde`; "Recaí" reinicia a hoy. 100% local.
  const EVITAR_KEY = 'reps-evitar';
  let evitares = [];
  function loadEvitar(){
    evitares = [];
    try{
      const v = JSON.parse(localStorage.getItem(EVITAR_KEY));
      if(Array.isArray(v)) evitares = v.filter(e => e && typeof e.nombre === 'string' && e.nombre.trim() &&
        typeof e.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.desde)).map(e => ({
          id: typeof e.id === 'string' ? e.id : 'e' + Math.random().toString(36).slice(2,8),
          nombre: e.nombre.trim().slice(0,40), emoji: sanearEmoji(e.emoji) || '🚫',
          desde: e.desde, creado: e.creado || new Date().toISOString(),
        }));
    }catch(e){ evitares = []; }
  }
  function saveEvitar(){
    try{ localStorage.setItem(EVITAR_KEY, JSON.stringify(evitares)); }catch(e){}
  }
  function diasSin(desde){
    const a = new Date(desde + 'T00:00:00'), b = new Date(today() + 'T00:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function renderEvitar(){
    const sec = $('evitarSec'), list = $('evitarList');
    sec.hidden = evitares.length === 0;
    list.innerHTML = '';
    evitares.forEach(e => {
      const n = diasSin(e.desde);
      const row = document.createElement('div'); row.className = 'evitar-item';
      const em = document.createElement('span'); em.className = 'ev-em'; em.textContent = e.emoji;
      const body = document.createElement('div'); body.className = 'ev-body';
      const d = document.createElement('div'); d.className = 'ev-dias';
      d.textContent = n; const s = document.createElement('small'); s.textContent = ' día' + (n === 1 ? '' : 's') + ' sin'; d.appendChild(s);
      const nm = document.createElement('div'); nm.className = 'ev-nm'; nm.textContent = e.nombre;
      body.append(d, nm);
      const cai = document.createElement('button'); cai.className = 'ev-cai'; cai.textContent = 'Recaí';
      cai.addEventListener('click', ()=>{
        if(!confirm('¿Reiniciar «' + e.nombre + '» a 0 días? (llevas ' + n + ')')) return;
        e.desde = today(); saveEvitar(); renderEvitar();
        toast('Reiniciado. Mañana es día 1 otra vez. 🌱');
      });
      row.append(em, body, cai);
      list.appendChild(row);
    });
  }
  function renderEvitarEditor(){
    const cont = $('evitarEditList'); cont.innerHTML = '';
    evitares.forEach(e => {
      const row = document.createElement('div'); row.className = 'ev-edit-row';
      const em = document.createElement('input'); em.className = 'ev-emoji'; em.value = e.emoji; em.maxLength = 8;
      em.addEventListener('input', ()=>{ e.emoji = sanearEmoji(em.value) || '🚫'; saveEvitar(); renderEvitar(); });
      const nm = document.createElement('input'); nm.className = 'ev-name'; nm.value = e.nombre; nm.maxLength = 40;
      nm.placeholder = 'Ej: fumar, celular en cama';
      nm.addEventListener('input', ()=>{ e.nombre = nm.value; saveEvitar(); renderEvitar(); });
      const del = document.createElement('button'); del.className = 'ev-del'; del.textContent = '✕';
      del.setAttribute('aria-label', 'Borrar');
      del.addEventListener('click', ()=>{
        evitares = evitares.filter(x => x.id !== e.id); saveEvitar(); renderEvitar(); renderEvitarEditor();
      });
      row.append(em, nm, del);
      cont.appendChild(row);
    });
  }
  $('evitarEdit').addEventListener('click', ()=>{ renderEvitarEditor(); $('evitarWrap').hidden = false; });
  $('evitarAdd').addEventListener('click', ()=>{
    if(evitares.length >= 12){ toast('Con 12 basta. Enfócate.'); return; }
    evitares.push({ id:'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      nombre:'Algo que quiero dejar', emoji:'🚫', desde: today(), creado: new Date().toISOString() });
    saveEvitar(); renderEvitar(); renderEvitarEditor();
  });
  $('evitarClose').addEventListener('click', ()=>{ $('evitarWrap').hidden = true; });
  $('evitarWrap').addEventListener('click', (e)=>{ if(e.target === $('evitarWrap')) $('evitarWrap').hidden = true; });

  // ===== Diario del día =====
  // Un espacio libre para escribir sobre tu día, aparte del cierre. Guarda
  // por fecha; muestra hoy editable y las entradas pasadas abajo. 100% local.
  const DIARIO_KEY = 'reps-diario';
  let diario = {};
  function loadDiario(){
    diario = {};
    try{
      const v = JSON.parse(localStorage.getItem(DIARIO_KEY));
      if(esMapa(v)) Object.keys(v).forEach(k => { if(typeof v[k] === 'string') diario[k] = v[k]; });
    }catch(e){ diario = {}; }
  }
  function saveDiario(){
    try{ localStorage.setItem(DIARIO_KEY, JSON.stringify(diario)); }catch(e){}
  }
  function renderDiario(){
    const k = today();
    $('diarioTxt').value = diario[k] || '';
    const list = $('diarioList'); list.innerHTML = '';
    Object.keys(diario).filter(f => f !== k && diario[f].trim()).sort().reverse().slice(0, 30).forEach(f => {
      const e = document.createElement('div'); e.className = 'diario-entry';
      const fe = document.createElement('div'); fe.className = 'de-fecha';
      fe.textContent = new Date(f + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});
      const tx = document.createElement('div'); tx.className = 'de-txt'; tx.textContent = diario[f];
      e.append(fe, tx); list.appendChild(e);
    });
  }
  $('diarioTxt').addEventListener('input', ()=>{
    const k = today(), v = $('diarioTxt').value;
    if(v.trim()) diario[k] = v; else delete diario[k];
    saveDiario();
  });
  // Diario tiene su propia pantalla (se abre desde Mi día)
  $('diarioOpen').addEventListener('click', ()=>{ renderDiario(); $('diarioPrompt').hidden = true; $('diarioWrap').hidden = false; });
  $('diarioClose').addEventListener('click', ()=>{ $('diarioWrap').hidden = true; });
  $('diarioWrap').addEventListener('click', (e)=>{ if(e.target === $('diarioWrap')) $('diarioWrap').hidden = true; });
  // #89 Pregunta de journaling generada a tu momento (ánimo/día/racha)
  $('diarioPregunta').addEventListener('click', async ()=>{
    if(iaOcupado) return; iaOcupado = true;
    const p = $('diarioPrompt'); p.hidden = false; p.textContent = 'Buscando una buena pregunta… 🤖';
    const cx = cierres[today()] || {};
    const estado = 'Ánimo de hoy: ' + (cx.animo || 'sin registrar') + '. Racha: ' + streak() + ' días.';
    const sistema = contextoIA() + '\nGenera UNA sola pregunta de journaling, abierta y personal, ' +
      'ajustada a su momento de hoy (' + estado + '). Que invite a escribir sin ser genérica ni intrusiva. ' +
      'Responde SOLO con la pregunta, en español, sin comillas ni markdown.';
    try{
      const res = await fetch(PUSH_WORKER + '/ia', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sistema, pregunta: 'Dame mi pregunta de hoy.' }) });
      if(!res.ok) throw new Error('worker ' + res.status);
      const d = await res.json();
      p.textContent = '💭 ' + ((d.texto || '').trim() || '¿Qué es lo que más te pesó o te movió hoy?');
    }catch(e){
      // sin internet: banco local de preguntas
      const banco = ['¿Qué es lo que más te movió hoy, para bien o para mal?','¿De qué te sientes orgulloso de este día, aunque sea pequeño?','¿Qué te quitó energía hoy y qué podrías soltar?','Si hoy tuviera una lección, ¿cuál sería?','¿Qué necesitas mañana que hoy no te diste?'];
      p.textContent = '💭 ' + banco[Math.floor(Math.random()*banco.length)];
    }
    iaOcupado = false;
  });

  // ===== Sueño (pantalla propia) =====
  // Registro simple por noche: a qué hora te acostaste y despertaste →
  // horas dormidas (maneja el cruce de medianoche). 100% local.
  const SUENO_KEY = 'reps-sueno';
  let sueno = {};
  function loadSueno(){
    sueno = {};
    try{
      const v = JSON.parse(localStorage.getItem(SUENO_KEY));
      if(esMapa(v)) Object.keys(v).forEach(k => {
        const r = v[k];
        if(r && (esHora(r.acostar) || esHora(r.despertar))) sueno[k] = { acostar: esHora(r.acostar) ? r.acostar : '', despertar: esHora(r.despertar) ? r.despertar : '' };
      });
    }catch(e){ sueno = {}; }
  }
  function saveSueno(){ try{ localStorage.setItem(SUENO_KEY, JSON.stringify(sueno)); }catch(e){} }
  const minDe = h => { const [a,b] = h.split(':').map(Number); return a * 60 + b; };
  // minutos dormidos de un registro (o null si falta un dato)
  function minDormidos(r){
    if(!r || !esHora(r.acostar) || !esHora(r.despertar)) return null;
    let d = minDe(r.despertar) - minDe(r.acostar);
    if(d <= 0) d += 1440; // cruzó medianoche
    return d;
  }
  const fmtHoras = min => Math.floor(min/60) + 'h' + (min % 60 ? ' ' + (min%60) + 'm' : '');
  function renderSueno(){
    const k = today(), r = sueno[k] || {};
    $('snAcostar').value = r.acostar || '';
    $('snDespertar').value = r.despertar || '';
    const m = minDormidos(r);
    $('snHoras').textContent = m == null ? '—' : fmtHoras(m);
    // promedio de las últimas noches con datos completos
    const conDatos = Object.keys(sueno).map(f => minDormidos(sueno[f])).filter(x => x != null);
    const prom = conDatos.length ? Math.round(conDatos.reduce((a,b)=>a+b,0) / conDatos.length) : 0;
    $('snProm').textContent = conDatos.length ? ('Promedio: ' + fmtHoras(prom) + ' · ' + conDatos.length + ' noche' + (conDatos.length===1?'':'s')) : 'Registra tu noche de hoy';
    // lista de las últimas 10 noches
    const list = $('snList'); list.innerHTML = '';
    Object.keys(sueno).sort().reverse().slice(0, 10).forEach(f => {
      const mm = minDormidos(sueno[f]); if(mm == null) return;
      const row = document.createElement('div'); row.className = 'sn-row';
      const fe = document.createElement('span'); fe.className = 'snr-f';
      fe.textContent = new Date(f + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'short'});
      const sub = document.createElement('span'); sub.className = 'snr-sub'; sub.textContent = sueno[f].acostar + '–' + sueno[f].despertar;
      const h = document.createElement('span'); h.className = 'snr-h'; h.textContent = fmtHoras(mm);
      row.append(fe, sub, h);
      list.appendChild(row);
    });
  }
  function setSueno(campo, val){
    const k = today();
    const r = sueno[k] || { acostar:'', despertar:'' };
    r[campo] = esHora(val) ? val : '';
    if(!r.acostar && !r.despertar) delete sueno[k]; else sueno[k] = r;
    saveSueno(); renderSueno();
  }
  $('snAcostar').addEventListener('change', ()=> setSueno('acostar', $('snAcostar').value));
  $('snDespertar').addEventListener('change', ()=> setSueno('despertar', $('snDespertar').value));
  $('suenoOpen').addEventListener('click', ()=>{ renderSueno(); $('suenoWrap').hidden = false; });
  $('suenoClose').addEventListener('click', ()=>{ $('suenoWrap').hidden = true; });
  $('suenoWrap').addEventListener('click', (e)=>{ if(e.target === $('suenoWrap')) $('suenoWrap').hidden = true; });

  // ===== Tu año en REPS (pantalla propia, estilo "wrapped") =====
  function renderAnio(){
    const y = String(new Date().getFullYear());
    $('anioTitle').textContent = 'Tu ' + y + ' en REPS';
    const delAnio = Object.keys(dias).filter(k => k.startsWith(y));
    const ganados = delAnio.filter(k => esGanado(k)).length;
    $('anBig').textContent = ganados;
    // mejor mes (más días ganados)
    const porMes = {};
    delAnio.filter(k => esGanado(k)).forEach(k => { const m = k.slice(5,7); porMes[m] = (porMes[m]||0)+1; });
    let mejorMes = '—';
    const mm = Object.keys(porMes).sort((a,b)=>porMes[b]-porMes[a])[0];
    if(mm) mejorMes = new Date(y + '-' + mm + '-15T12:00:00').toLocaleDateString('es-MX',{month:'long'});
    const s = statsData();
    const focoH = Math.floor(focoTotal / 60);
    const noches = Object.keys(sueno).filter(k => k.startsWith(y)).length;
    const diarios = Object.keys(diario).filter(k => k.startsWith(y) && diario[k].trim()).length;
    const tiles = [
      [s.best, 'racha más larga'],
      [focoH + 'h', 'de foco acumulado'],
      [ideas.length, 'ideas capturadas'],
      [mejorMes, 'tu mejor mes'],
      [noches, 'noches registradas'],
      [diarios, 'días de diario'],
    ];
    const grid = $('anioGrid'); grid.innerHTML = '';
    tiles.forEach(([n, l]) => {
      const t = document.createElement('div'); t.className = 'anio-tile';
      const num = document.createElement('div'); num.className = 'at-num'; num.textContent = n;
      const lab = document.createElement('div'); lab.className = 'at-lbl'; lab.textContent = l;
      t.append(num, lab); grid.appendChild(t);
    });
    $('anioFrase').textContent = ganados === 0
      ? 'Tu año apenas empieza. El primer día ganado está a un toque.'
      : ganados < 30 ? 'Cada día ganado es un voto por quien te estás volviendo. Vas.'
      : ganados < 150 ? 'Esto ya no es un intento: es un patrón. Sigue.'
      : 'Un año construido a pulso. Nadie te quita esto.';
  }
  $('anioOpen').addEventListener('click', ()=>{ renderAnio(); $('anioWrap').hidden = false; });
  $('anioClose').addEventListener('click', ()=>{ $('anioWrap').hidden = true; });
  $('anioWrap').addEventListener('click', (e)=>{ if(e.target === $('anioWrap')) $('anioWrap').hidden = true; });

  // ===== Kanban (tablero de proyectos) =====
  const KANBAN_KEY = 'reps-kanban';
  const KB_COLS = [{id:'todo', name:'Por hacer'}, {id:'doing', name:'Haciendo'}, {id:'done', name:'Hecho'}];
  let kanban = [];
  function loadKanban(){
    kanban = [];
    try{ const v = JSON.parse(localStorage.getItem(KANBAN_KEY));
      if(Array.isArray(v)) kanban = v.filter(c => c && typeof c.id === 'string' && typeof c.texto === 'string' && c.texto.trim())
        .map(c => ({ id: c.id, texto: c.texto.trim().slice(0,80), col: ['todo','doing','done'].includes(c.col) ? c.col : 'todo' }));
    }catch(e){ kanban = []; }
  }
  function saveKanban(){ try{ localStorage.setItem(KANBAN_KEY, JSON.stringify(kanban)); }catch(e){} }
  function renderKanban(){
    const board = $('kbBoard'); board.innerHTML = '';
    KB_COLS.forEach((col, ci) => {
      const wrap = document.createElement('div'); wrap.className = 'kb-col ' + col.id;
      const cards = kanban.filter(c => c.col === col.id);
      const h = document.createElement('div'); h.className = 'kb-col-head'; h.textContent = col.name + ' · ' + cards.length; wrap.appendChild(h);
      if(!cards.length){ const e = document.createElement('div'); e.className = 'kb-empty'; e.textContent = '—'; wrap.appendChild(e); }
      cards.forEach(c => {
        const card = document.createElement('div'); card.className = 'kb-card';
        const left = document.createElement('button'); left.className = 'kb-mv'; left.textContent = '‹'; left.disabled = ci === 0;
        left.setAttribute('aria-label', 'Mover a la izquierda');
        left.addEventListener('click', ()=>{ c.col = KB_COLS[Math.max(0, ci-1)].id; saveKanban(); renderKanban(); });
        const tx = document.createElement('span'); tx.className = 'kb-tx'; tx.textContent = c.texto;
        const right = document.createElement('button'); right.className = 'kb-mv'; right.textContent = '›'; right.disabled = ci === KB_COLS.length-1;
        right.setAttribute('aria-label', 'Mover a la derecha');
        right.addEventListener('click', ()=>{ c.col = KB_COLS[Math.min(KB_COLS.length-1, ci+1)].id; saveKanban(); renderKanban(); if(c.col === 'done') sonarCheck(); });
        const del = document.createElement('button'); del.className = 'kb-del'; del.textContent = '✕';
        del.setAttribute('aria-label', 'Borrar tarjeta');
        del.addEventListener('click', ()=>{ kanban = kanban.filter(x => x.id !== c.id); saveKanban(); renderKanban(); });
        card.append(left, tx, right, del); wrap.appendChild(card);
      });
      board.appendChild(wrap);
    });
  }
  $('kbAddBtn').addEventListener('click', ()=>{
    const t = $('kbInput').value.trim().slice(0,80);
    if(!t) return;
    kanban.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), texto: t, col: 'todo' });
    saveKanban(); $('kbInput').value = ''; renderKanban();
  });
  $('kbInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); $('kbAddBtn').click(); } });
  $('masKanban').addEventListener('click', ()=>{ cerrarMas(); renderKanban(); $('kanbanWrap').hidden = false; });
  $('kbClose').addEventListener('click', ()=>{ $('kanbanWrap').hidden = true; });
  $('kanbanWrap').addEventListener('click', (e)=>{ if(e.target === $('kanbanWrap')) $('kanbanWrap').hidden = true; });

  // ===== Retos (idea #75: objetivo con fecha límite y barra) =====
  const RETOS_KEY = 'reps-retos';
  let retos = []; // [{id, texto, meta, hechos, limite, creado}]
  function loadRetos(){
    retos = [];
    try{ const v = JSON.parse(localStorage.getItem(RETOS_KEY));
      if(Array.isArray(v)) retos = v.filter(r => r && typeof r.id === 'string' && typeof r.texto === 'string' && r.texto.trim())
        .map(r => ({ id: r.id, texto: r.texto.trim().slice(0,60),
          meta: Math.max(1, Math.min(9999, parseInt(r.meta,10) || 1)),
          hechos: Math.max(0, parseInt(r.hechos,10) || 0),
          limite: /^\d{4}-\d{2}-\d{2}$/.test(r.limite) ? r.limite : '',
          creado: r.creado || today() }));
    }catch(e){ retos = []; }
  }
  function saveRetos(){ try{ localStorage.setItem(RETOS_KEY, JSON.stringify(retos)); }catch(e){} }
  // días que faltan para la fecha límite (negativo = vencido)
  function diasRestantes(limite){
    if(!limite) return null;
    const a = new Date(today() + 'T12:00:00'), b = new Date(limite + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }
  function renderRetos(){
    const cont = $('retosList'); if(!cont) return; cont.innerHTML = '';
    if(!retos.length){ const e = document.createElement('div'); e.className = 'reto-empty'; e.textContent = 'Aún no tienes retos. Crea el primero arriba.'; cont.appendChild(e); return; }
    retos.forEach(r => {
      const done = r.hechos >= r.meta;
      const card = document.createElement('div'); card.className = 'reto-card' + (done ? ' done' : '');
      const head = document.createElement('div'); head.className = 'reto-head';
      const tx = document.createElement('div'); tx.className = 'reto-tx'; tx.textContent = r.texto;
      const del = document.createElement('button'); del.className = 'reto-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Borrar reto');
      del.addEventListener('click', ()=>{ if(!confirm('¿Borrar el reto «' + r.texto + '»?')) return; retos = retos.filter(x => x.id !== r.id); saveRetos(); renderRetos(); });
      head.append(tx, del);
      // barra de avance
      const barW = document.createElement('div'); barW.className = 'reto-bar';
      const bar = document.createElement('i'); bar.style.width = Math.min(100, Math.round(r.hechos / r.meta * 100)) + '%'; barW.appendChild(bar);
      // meta + días restantes
      const meta = document.createElement('div'); meta.className = 'reto-meta';
      const dr = diasRestantes(r.limite);
      let plazo = '';
      if(r.limite){ plazo = dr > 0 ? ' · faltan ' + dr + ' día' + (dr===1?'':'s') : dr === 0 ? ' · ¡hoy vence!' : ' · vencido hace ' + (-dr) + ' día' + (dr===-1?'':'s'); }
      meta.textContent = r.hechos + ' / ' + r.meta + (done ? ' ✓ completado' : plazo);
      // controles + / −
      const ops = document.createElement('div'); ops.className = 'reto-ops';
      const menos = document.createElement('button'); menos.className = 'reto-op'; menos.textContent = '−'; menos.setAttribute('aria-label', 'Restar uno');
      menos.addEventListener('click', ()=>{ r.hechos = Math.max(0, r.hechos - 1); saveRetos(); renderRetos(); });
      const mas = document.createElement('button'); mas.className = 'reto-op mas'; mas.textContent = '+1'; mas.setAttribute('aria-label', 'Sumar uno');
      mas.addEventListener('click', ()=>{ const wasDone = r.hechos >= r.meta; r.hechos = Math.min(r.meta, r.hechos + 1); saveRetos(); renderRetos(); if(!wasDone && r.hechos >= r.meta){ sonarGanado(); toast('¡Reto «' + r.texto + '» completado! 🏆'); } else sonarCheck(); });
      ops.append(menos, mas);
      card.append(head, barW, meta, ops);
      cont.appendChild(card);
    });
  }
  $('retoAdd').addEventListener('click', ()=>{
    const t = $('retoTexto').value.trim().slice(0,60);
    const m = parseInt($('retoMeta').value, 10);
    if(!t){ toast('Ponle nombre al reto.'); return; }
    if(!(m >= 1)){ toast('Pon una meta numérica (ej. 30).'); return; }
    const lim = $('retoLimite').value;
    retos.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), texto: t, meta: Math.min(9999, m), hechos: 0, limite: /^\d{4}-\d{2}-\d{2}$/.test(lim) ? lim : '', creado: today() });
    saveRetos();
    $('retoTexto').value = ''; $('retoMeta').value = ''; $('retoLimite').value = '';
    renderRetos(); sonarCheck(); toast('Reto creado. 🎯');
  });
  $('masRetos').addEventListener('click', ()=>{ cerrarMas(); renderRetos(); $('retosWrap').hidden = false; });
  $('retosClose').addEventListener('click', ()=>{ $('retosWrap').hidden = true; });
  $('retosWrap').addEventListener('click', (e)=>{ if(e.target === $('retosWrap')) $('retosWrap').hidden = true; });

  // ===== Bienestar (ideas #90–#95) =====
  $('masBienestar').addEventListener('click', ()=>{ cerrarMas(); $('bienestarWrap').hidden = false; });
  $('bienClose').addEventListener('click', ()=>{ $('bienestarWrap').hidden = true; });
  $('bienestarWrap').addEventListener('click', (e)=>{ if(e.target === $('bienestarWrap')) $('bienestarWrap').hidden = true; });

  // ---- #90 Respiración guiada ----
  const RESP_TECNICAS = [
    { id:'478', name:'4-7-8', fases:[{lbl:'Inhala',s:4,c:'in'},{lbl:'Retén',s:7,c:'hold'},{lbl:'Exhala',s:8,c:'out'}], nota:'Relaja y ayuda a dormir. Exhala largo por la boca.' },
    { id:'caja', name:'Caja', fases:[{lbl:'Inhala',s:4,c:'in'},{lbl:'Retén',s:4,c:'hold'},{lbl:'Exhala',s:4,c:'out'},{lbl:'Retén',s:4,c:'hold'}], nota:'Equilibra y enfoca. La usan hasta los marines.' },
    { id:'calma', name:'Calma', fases:[{lbl:'Inhala',s:4,c:'in'},{lbl:'Exhala',s:6,c:'out'}], nota:'Exhalar más largo que inhalar baja el pulso.' },
  ];
  let respTec = RESP_TECNICAS[0], respOn = false, respTimer = null, respFaseIdx = 0, respRestante = 0;
  function renderRespTecnicas(){
    const cont = $('respTecnicas'); cont.innerHTML = '';
    RESP_TECNICAS.forEach(t => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'resp-tec' + (t.id === respTec.id ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', ()=>{ if(respOn) pararRespira(); respTec = t; renderRespTecnicas(); $('respNota').textContent = t.nota; });
      cont.appendChild(b);
    });
    $('respNota').textContent = respTec.nota;
  }
  function pasoRespira(){
    const fase = respTec.fases[respFaseIdx];
    const circle = $('respCircle');
    circle.className = 'resp-circle ' + fase.c;
    circle.style.transitionDuration = fase.s + 's';
    $('respFase').textContent = fase.lbl;
    respRestante = fase.s;
    $('respCount').textContent = respRestante;
    clearInterval(respTimer);
    respTimer = setInterval(()=>{
      respRestante--;
      $('respCount').textContent = respRestante > 0 ? respRestante : '';
      if(respRestante <= 0){
        clearInterval(respTimer);
        respFaseIdx = (respFaseIdx + 1) % respTec.fases.length;
        if(respOn) pasoRespira();
      }
    }, 1000);
  }
  function pararRespira(){
    respOn = false; clearInterval(respTimer);
    const circle = $('respCircle'); circle.className = 'resp-circle'; circle.style.transitionDuration = '';
    $('respFase').textContent = 'Listo'; $('respCount').textContent = '';
    $('respToggle').textContent = 'Empezar';
  }
  $('respToggle').addEventListener('click', ()=>{
    if(respOn){ pararRespira(); return; }
    respOn = true; respFaseIdx = 0; $('respToggle').textContent = 'Detener'; pasoRespira();
  });
  function abrirRespira(){ pararRespira(); renderRespTecnicas(); $('respiraWrap').hidden = false; }
  $('biRespira').addEventListener('click', abrirRespira);
  $('respClose').addEventListener('click', ()=>{ pararRespira(); $('respiraWrap').hidden = true; });
  $('respiraWrap').addEventListener('click', (e)=>{ if(e.target === $('respiraWrap')){ pararRespira(); $('respiraWrap').hidden = true; } });

  // ---- #93 Gratitud ----
  const GRAT_KEY = 'reps-gratitud';
  let gratitud = {}; // {fecha:[s1,s2,s3]}
  function loadGratitud(){ gratitud = {}; try{ const v = JSON.parse(localStorage.getItem(GRAT_KEY)); if(esMapa(v)) Object.keys(v).forEach(k => { if(Array.isArray(v[k])) gratitud[k] = v[k].filter(s => typeof s === 'string').slice(0,3); }); }catch(e){ gratitud = {}; } }
  function saveGratitud(){ try{ localStorage.setItem(GRAT_KEY, JSON.stringify(gratitud)); }catch(e){} }
  function renderGratitud(){
    const hoy = today();
    const g = gratitud[hoy] || [];
    $('grIn1').value = g[0] || ''; $('grIn2').value = g[1] || ''; $('grIn3').value = g[2] || '';
    // recuerdo de hace un año (misma fecha)
    const d = new Date(hoy + 'T12:00:00'); d.setFullYear(d.getFullYear() - 1);
    const hace1 = gratitud[localISO(d)];
    const rec = $('grRecuerdo');
    if(hace1 && hace1.some(s => s && s.trim())){
      rec.hidden = false; rec.textContent = '🗓️ Hace un año agradecías: ' + hace1.filter(s => s && s.trim()).join(' · ');
    } else rec.hidden = true;
    // historial (últimos 14, menos hoy)
    const hist = $('grHist'); hist.innerHTML = '';
    const keys = Object.keys(gratitud).filter(k => k !== hoy && gratitud[k].some(s => s && s.trim())).sort().reverse().slice(0,14);
    if(!keys.length){ const e = document.createElement('div'); e.className = 'gr-empty'; e.textContent = 'Aún no hay historial.'; hist.appendChild(e); }
    keys.forEach(k => {
      const row = document.createElement('div'); row.className = 'gr-h-row';
      const dt = document.createElement('div'); dt.className = 'gr-h-fecha'; dt.textContent = new Date(k+'T12:00:00').toLocaleDateString('es-MX', {day:'numeric', month:'short', year:'numeric'});
      const li = document.createElement('div'); li.className = 'gr-h-items'; li.textContent = gratitud[k].filter(s => s && s.trim()).join(' · ');
      row.append(dt, li); hist.appendChild(row);
    });
  }
  $('grSave').addEventListener('click', ()=>{
    const arr = [$('grIn1').value.trim(), $('grIn2').value.trim(), $('grIn3').value.trim()];
    const hoy = today();
    if(arr.every(s => !s)){ delete gratitud[hoy]; } else { gratitud[hoy] = arr.map(s => s.slice(0,120)); }
    saveGratitud(); renderGratitud(); sonarCheck(); toast('Gratitud guardada. 🙏');
  });
  $('biGratitud').addEventListener('click', ()=>{ renderGratitud(); $('gratitudWrap').hidden = false; });
  $('grClose').addEventListener('click', ()=>{ $('gratitudWrap').hidden = true; });
  $('gratitudWrap').addEventListener('click', (e)=>{ if(e.target === $('gratitudWrap')) $('gratitudWrap').hidden = true; });

  // ---- #92 Agua ----
  const AGUA_KEY = 'reps-agua';
  let agua = { meta:8, dias:{} };
  function loadAgua(){ agua = { meta:8, dias:{} }; try{ const v = JSON.parse(localStorage.getItem(AGUA_KEY)); if(esMapa(v)){ if(Number.isFinite(+v.meta) && +v.meta > 0) agua.meta = Math.min(20, +v.meta); if(esMapa(v.dias)) Object.keys(v.dias).forEach(k => { if(Number.isFinite(+v.dias[k])) agua.dias[k] = Math.max(0, +v.dias[k]); }); } }catch(e){ agua = { meta:8, dias:{} }; } }
  function saveAgua(){ try{ localStorage.setItem(AGUA_KEY, JSON.stringify(agua)); }catch(e){} }
  function renderAgua(){
    const hoy = today();
    const n = agua.dias[hoy] || 0;
    $('agCount').textContent = n; $('agMeta').textContent = agua.meta; $('agMetaIn').value = agua.meta;
    const drops = $('agDrops'); drops.innerHTML = '';
    for(let i = 0; i < agua.meta; i++){ const s = document.createElement('span'); s.className = 'ag-drop' + (i < n ? ' on' : ''); s.textContent = '💧'; drops.appendChild(s); }
    const nota = $('agNota');
    const hora = new Date().getHours();
    if(n >= agua.meta) nota.textContent = '¡Meta cumplida! Bien hidratado. 💪';
    else if(hora >= 18 && n < agua.meta * 0.6) nota.textContent = 'Vas ' + n + ' y ya es tarde. Un par de vasos más te caen bien.';
    else if(hora >= 12 && n === 0) nota.textContent = 'Aún no registras agua hoy. Arranca con un vaso.';
    else nota.textContent = 'Toca ＋ cada vez que tomes un vaso.';
  }
  function setAgua(delta){ const hoy = today(); agua.dias[hoy] = Math.max(0, (agua.dias[hoy] || 0) + delta); saveAgua(); renderAgua(); if(delta > 0) sonarCheck(); }
  $('agPlus').addEventListener('click', ()=> setAgua(1));
  $('agMinus').addEventListener('click', ()=> setAgua(-1));
  $('agMetaIn').addEventListener('change', ()=>{ const m = parseInt($('agMetaIn').value,10); if(m >= 1 && m <= 20){ agua.meta = m; saveAgua(); renderAgua(); } });
  $('biAgua').addEventListener('click', ()=>{ renderAgua(); $('aguaWrap').hidden = false; });
  $('agClose').addEventListener('click', ()=>{ $('aguaWrap').hidden = true; });
  $('aguaWrap').addEventListener('click', (e)=>{ if(e.target === $('aguaWrap')) $('aguaWrap').hidden = true; });

  // ---- #94 Pausas activas ----
  const PAUSAS_KEY = 'reps-pausas';
  const PAUSAS_SUG = ['Ponte de pie y estira los brazos al techo 10 seg.','Rueda los hombros hacia atrás 10 veces.','Gira el cuello despacio a cada lado.','Camina 20 pasos y vuelve.','Estira el cuello llevando la oreja al hombro.','Ponte de puntas 15 veces.','Abre y cierra las manos, sacude las muñecas.','Mira lejos por la ventana 20 seg (descansa la vista).'];
  let pausas = { intervalo:60, activo:false };
  let pausasTimer = null;
  function loadPausas(){ pausas = { intervalo:60, activo:false }; try{ const v = JSON.parse(localStorage.getItem(PAUSAS_KEY)); if(esMapa(v)){ if([30,45,60,90].includes(+v.intervalo)) pausas.intervalo = +v.intervalo; pausas.activo = !!v.activo; } }catch(e){} }
  function savePausas(){ try{ localStorage.setItem(PAUSAS_KEY, JSON.stringify(pausas)); }catch(e){} }
  function sugPausa(){ return PAUSAS_SUG[Math.floor(Math.random()*PAUSAS_SUG.length)]; }
  function armarPausas(){
    clearInterval(pausasTimer); pausasTimer = null;
    if(pausas.activo){ pausasTimer = setInterval(()=>{ toast('🤸 Pausa: ' + sugPausa()); try{ sonarCheck(); }catch(e){} }, pausas.intervalo * 60000); }
  }
  function renderPausas(){
    $('paInt').value = String(pausas.intervalo);
    document.querySelectorAll('#pausasWrap .pa-opts .dist-opt').forEach(b => b.classList.toggle('on', (b.dataset.pa === 'on') === pausas.activo));
  }
  $('paInt').addEventListener('change', ()=>{ pausas.intervalo = parseInt($('paInt').value,10) || 60; savePausas(); armarPausas(); });
  document.querySelectorAll('#pausasWrap .pa-opts .dist-opt').forEach(b => b.addEventListener('click', ()=>{ pausas.activo = b.dataset.pa === 'on'; savePausas(); renderPausas(); armarPausas(); toast(pausas.activo ? 'Pausas activadas.' : 'Pausas apagadas.'); }));
  $('paNow').addEventListener('click', ()=>{ const s = $('paSug'); s.hidden = false; s.textContent = '🤸 ' + sugPausa(); });
  $('biPausas').addEventListener('click', ()=>{ renderPausas(); $('paSug').hidden = true; $('pausasWrap').hidden = false; });
  $('paClose').addEventListener('click', ()=>{ $('pausasWrap').hidden = true; });
  $('pausasWrap').addEventListener('click', (e)=>{ if(e.target === $('pausasWrap')) $('pausasWrap').hidden = true; });

  // ---- #95 Higiene del sueño ----
  const SUENO_RUT_KEY = 'reps-sueno-rutina';
  const SR_PASOS = [
    {id:'pantallas', txt:'Sin pantallas 30 min antes'},
    {id:'luz', txt:'Baja las luces'},
    {id:'cafe', txt:'Nada de cafeína en la tarde'},
    {id:'prepara', txt:'Deja listo lo de mañana'},
    {id:'agradece', txt:'Piensa algo bueno del día'},
    {id:'respira', txt:'Respira lento un minuto'},
  ];
  let suenoRut = {}; // {fecha:{id:true}}
  function loadSuenoRut(){ suenoRut = {}; try{ const v = JSON.parse(localStorage.getItem(SUENO_RUT_KEY)); if(esMapa(v)) Object.keys(v).forEach(k => { if(esMapa(v[k])) suenoRut[k] = v[k]; }); }catch(e){ suenoRut = {}; } }
  function saveSuenoRut(){ try{ localStorage.setItem(SUENO_RUT_KEY, JSON.stringify(suenoRut)); }catch(e){} }
  function renderSuenoRut(){
    const hoy = today();
    const est = suenoRut[hoy] || {};
    const list = $('srList'); list.innerHTML = '';
    SR_PASOS.forEach(p => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'sr-item' + (est[p.id] ? ' on' : '');
      const ck = document.createElement('span'); ck.className = 'sr-ck'; ck.textContent = est[p.id] ? '✓' : '';
      const tx = document.createElement('span'); tx.className = 'sr-tx'; tx.textContent = p.txt;
      b.append(ck, tx);
      b.addEventListener('click', ()=>{
        const cur = suenoRut[hoy] || {};
        if(cur[p.id]) delete cur[p.id]; else cur[p.id] = true;
        if(Object.keys(cur).length) suenoRut[hoy] = cur; else delete suenoRut[hoy];
        saveSuenoRut(); renderSuenoRut(); sonarCheck();
      });
      list.appendChild(b);
    });
    const hechos = Object.keys(est).length;
    const done = $('srDone');
    if(hechos >= SR_PASOS.length){ done.hidden = false; done.textContent = '🌙 Rutina completa. Dulces sueños.'; }
    else done.hidden = true;
  }
  $('biSueno').addEventListener('click', ()=>{ renderSuenoRut(); $('suenoRutinaWrap').hidden = false; });
  $('srClose').addEventListener('click', ()=>{ $('suenoRutinaWrap').hidden = true; });
  $('suenoRutinaWrap').addEventListener('click', (e)=>{ if(e.target === $('suenoRutinaWrap')) $('suenoRutinaWrap').hidden = true; });

  // ---- #91 Chequeo de ánimo a media jornada (tarjeta en Hoy) ----
  const CHECKIN_KEY = 'reps-checkin';
  let checkin = {}; // {fecha:{mid}}
  function loadCheckin(){ checkin = {}; try{ const v = JSON.parse(localStorage.getItem(CHECKIN_KEY)); if(esMapa(v)) checkin = v; }catch(e){ checkin = {}; } }
  function saveCheckin(){ try{ localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkin)); }catch(e){} }
  function renderCheckin(){
    const card = $('checkinCard'); if(!card) return;
    const hoy = today();
    const hora = new Date().getHours();
    const yaHoy = checkin[hoy] && checkin[hoy].mid;
    // se muestra en la franja de media jornada (11–17h) si aún no lo hiciste
    card.hidden = !(hora >= 11 && hora < 17 && !yaHoy);
    card.querySelectorAll('.ci-opt').forEach(b => b.classList.toggle('on', yaHoy === b.dataset.ci));
  }
  (function initCheckin(){
    const opts = document.getElementById('ciOpts'); if(!opts) return;
    opts.addEventListener('click', (e)=>{
      const b = e.target.closest('.ci-opt'); if(!b) return;
      const hoy = today();
      checkin[hoy] = Object.assign({}, checkin[hoy], { mid: b.dataset.ci });
      saveCheckin(); sonarCheck();
      $('checkinCard').hidden = true;
      toast('Anotado. Gracias por chequearte. 💙');
    });
  })();

  // ===== Motivación / identidad (ideas #96–#100) =====

  // ---- #97 Mantra fijado arriba de Hoy ----
  const MANTRA_KEY = 'reps-mantra';
  let mantra = '';
  function loadMantra(){ try{ const v = localStorage.getItem(MANTRA_KEY); mantra = typeof v === 'string' ? v : ''; }catch(e){ mantra = ''; } }
  function saveMantra(){ try{ if(mantra) localStorage.setItem(MANTRA_KEY, mantra); else localStorage.removeItem(MANTRA_KEY); }catch(e){} }
  function renderMantra(){
    const el = $('mantra'); if(!el) return;
    el.hidden = false;
    el.textContent = mantra ? '“' + mantra + '”' : '✏️ Fija tu frase o mantra';
    el.classList.toggle('vacio', !mantra);
  }
  $('mantra').addEventListener('click', ()=>{
    const v = prompt('Tu frase o mantra (aparece arriba de Hoy):', mantra);
    if(v === null) return;
    mantra = v.trim().slice(0, 120); saveMantra(); renderMantra();
    toast(mantra ? 'Mantra fijado.' : 'Mantra quitado.');
  });

  // ---- #96 Carta a tu futuro yo (sellada 1 año) ----
  const CARTA_FUT_KEY = 'reps-carta-futuro';
  let cartaFut = null; // {texto, escrita, abre}
  function loadCartaFut(){
    cartaFut = null;
    try{ const v = JSON.parse(localStorage.getItem(CARTA_FUT_KEY));
      if(esMapa(v) && typeof v.texto === 'string' && v.texto.trim()) cartaFut = { texto: v.texto, escrita: v.escrita || today(), abre: /^\d{4}-\d{2}-\d{2}$/.test(v.abre) ? v.abre : today() };
    }catch(e){ cartaFut = null; }
  }
  function saveCartaFut(){ try{ if(cartaFut) localStorage.setItem(CARTA_FUT_KEY, JSON.stringify(cartaFut)); else localStorage.removeItem(CARTA_FUT_KEY); }catch(e){} }
  function renderCartaFut(){
    const ed = $('cfEditor'), se = $('cfSellada'), ab = $('cfAbierta');
    ed.hidden = true; se.hidden = true; ab.hidden = true;
    if(!cartaFut){ ed.hidden = false; $('cfTxt').value = ''; return; }
    const abierta = today() >= cartaFut.abre;
    if(abierta){
      ab.hidden = false;
      $('cfAbiertaMeta').textContent = 'La escribiste el ' + new Date(cartaFut.escrita+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) + '. Hoy se abre.';
      $('cfCartaTxt').textContent = cartaFut.texto;
    } else {
      se.hidden = false;
      const d = new Date(cartaFut.abre+'T12:00:00');
      const faltan = Math.ceil((d - new Date(today()+'T12:00:00')) / 86400000);
      $('cfLockTxt').textContent = 'Sellada hasta el ' + d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) + '. Faltan ' + faltan + ' día' + (faltan===1?'':'s') + '.';
    }
  }
  $('masCartaFuturo').addEventListener('click', ()=>{ cerrarMas(); renderCartaFut(); $('cartaFuturoWrap').hidden = false; });
  $('cfClose').addEventListener('click', ()=>{ $('cartaFuturoWrap').hidden = true; });
  $('cartaFuturoWrap').addEventListener('click', (e)=>{ if(e.target === $('cartaFuturoWrap')) $('cartaFuturoWrap').hidden = true; });
  $('cfSave').addEventListener('click', ()=>{
    const t = $('cfTxt').value.trim();
    if(!t){ toast('Escribe algo primero.'); return; }
    const d = new Date(today()+'T12:00:00'); d.setFullYear(d.getFullYear() + 1);
    cartaFut = { texto: t.slice(0,2000), escrita: today(), abre: localISO(d) };
    saveCartaFut(); renderCartaFut(); sonarGanado(); toast('Sellada. Nos vemos en un año. 🔒');
  });
  $('cfBorrar').addEventListener('click', ()=>{ if(!confirm('¿Romper el sello y escribir otra? La actual se borra.')) return; cartaFut = null; saveCartaFut(); renderCartaFut(); });
  $('cfNueva').addEventListener('click', ()=>{ cartaFut = null; saveCartaFut(); renderCartaFut(); });

  // ---- #98 Muro de victorias ----
  const VICT_KEY = 'reps-victorias';
  let victorias = []; // [{id, texto, fecha}]
  function loadVictorias(){
    victorias = [];
    try{ const v = JSON.parse(localStorage.getItem(VICT_KEY));
      if(Array.isArray(v)) victorias = v.filter(x => x && typeof x.id === 'string' && typeof x.texto === 'string' && x.texto.trim())
        .map(x => ({ id: x.id, texto: x.texto.trim().slice(0,140), fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : today() }));
    }catch(e){ victorias = []; }
  }
  function saveVictorias(){ try{ localStorage.setItem(VICT_KEY, JSON.stringify(victorias)); }catch(e){} }
  function renderVictorias(){
    const cont = $('viList'); if(!cont) return; cont.innerHTML = '';
    if(!victorias.length){ const e = document.createElement('div'); e.className = 'vi-empty'; e.textContent = 'Aún no hay victorias. Anota la primera arriba. 🏆'; cont.appendChild(e); return; }
    victorias.forEach(v => {
      const card = document.createElement('div'); card.className = 'vi-card';
      const body = document.createElement('div'); body.className = 'vi-body';
      const tx = document.createElement('div'); tx.className = 'vi-tx'; tx.textContent = v.texto;
      const dt = document.createElement('div'); dt.className = 'vi-fecha'; dt.textContent = new Date(v.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
      body.append(tx, dt);
      const del = document.createElement('button'); del.className = 'vi-del'; del.textContent = '✕'; del.setAttribute('aria-label','Borrar');
      del.addEventListener('click', ()=>{ victorias = victorias.filter(x => x.id !== v.id); saveVictorias(); renderVictorias(); });
      card.append(body, del); cont.appendChild(card);
    });
  }
  $('viAdd').addEventListener('click', ()=>{
    const t = $('viInput').value.trim().slice(0,140);
    if(!t){ toast('Escribe tu victoria.'); return; }
    victorias.unshift({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), texto: t, fecha: today() });
    saveVictorias(); $('viInput').value = ''; renderVictorias(); sonarCheck(); toast('¡Victoria guardada! 🏆');
  });
  $('viInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); $('viAdd').click(); } });
  $('masVictorias').addEventListener('click', ()=>{ cerrarMas(); renderVictorias(); $('victoriasWrap').hidden = false; });
  $('viClose').addEventListener('click', ()=>{ $('victoriasWrap').hidden = true; });
  $('victoriasWrap').addEventListener('click', (e)=>{ if(e.target === $('victoriasWrap')) $('victoriasWrap').hidden = true; });

  // ---- #99 Frases de identidad ("ya eres alguien que…") ----
  // Derivadas de tus totales: al cruzar umbrales, un hábito deja de ser algo
  // que "haces" y pasa a ser algo que "eres". Se muestran arriba de Identidad.
  function frasesIdentidad(){
    const out = [];
    HABITS.forEach(h => {
      const n = Object.keys(dias).filter(k => dias[k] && hecho(dias[k], h.id)).length;
      if(n >= 10){
        // plantilla que suena natural con cualquier nombre de hábito
        out.push({ txt: h.name + ' ya es parte de quién eres (' + n + '×)', n });
      }
    });
    return out.sort((a,b) => b.n - a.n).slice(0, 6);
  }

  // ---- #100 Modo espejo brutal ----
  const BRUTAL_KEY = 'reps-brutal';
  let brutal = false;
  function loadBrutal(){ try{ brutal = localStorage.getItem(BRUTAL_KEY) === '1'; }catch(e){ brutal = false; } }
  function renderBrutal(){
    const card = $('brutalCard'), tg = $('brutalToggle'); if(!card || !tg) return;
    tg.classList.toggle('on', brutal);
    if(!brutal){ card.hidden = true; return; }
    // números duros, sin adornos: días con requisito, ganados, perdidos, tasa real
    let req = 0, won = 0, lost = 0;
    Object.keys(dias).forEach(k => {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(k) || k > today() || esDescanso(k)) return;
      req++; if(esGanado(k)) won++; else lost++;
    });
    const s = statsData();
    const tasa = req ? Math.round(won / req * 100) : 0;
    // caídas de racha (transiciones ganado→perdido) ~ regresos requeridos
    const lineas = [
      'Días que exigían core: ' + req,
      'Ganados: ' + won + '  ·  Perdidos: ' + lost,
      'Tasa real de cumplimiento: ' + tasa + '%',
      'Racha actual: ' + s.now + '  ·  Mejor histórica: ' + s.best,
      s.now < s.best ? 'Estás ' + (s.best - s.now) + ' días por debajo de tu mejor marca.' : 'Estás en tu mejor marca. No la sueltes.',
    ];
    card.hidden = false; card.innerHTML = '';
    lineas.forEach(t => { const d = document.createElement('div'); d.className = 'br-line'; d.textContent = t; card.appendChild(d); });
  }
  $('brutalToggle').addEventListener('click', ()=>{
    brutal = !brutal;
    try{ if(brutal) localStorage.setItem(BRUTAL_KEY, '1'); else localStorage.removeItem(BRUTAL_KEY); }catch(e){}
    renderBrutal();
  });

  // ===== Estructura / tiempo (ideas #115–#116) =====

  // ---- #115 Cuenta regresiva a eventos ----
  const EVENTOS_KEY = 'reps-eventos';
  let eventos = []; // [{id, nombre, fecha}]
  function loadEventos(){
    eventos = [];
    try{ const v = JSON.parse(localStorage.getItem(EVENTOS_KEY));
      if(Array.isArray(v)) eventos = v.filter(e => e && typeof e.id === 'string' && typeof e.nombre === 'string' && e.nombre.trim() && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha))
        .map(e => ({ id: e.id, nombre: e.nombre.trim().slice(0,40), fecha: e.fecha }));
    }catch(e){ eventos = []; }
  }
  function saveEventos(){ try{ localStorage.setItem(EVENTOS_KEY, JSON.stringify(eventos)); }catch(e){} }
  // el próximo evento futuro (o de hoy), el más cercano
  function proximoEvento(){
    const hoy = today();
    return eventos.filter(e => e.fecha >= hoy).sort((a,b) => a.fecha.localeCompare(b.fecha))[0] || null;
  }
  function renderCuentaCard(){
    const card = $('cuentaCard'); if(!card) return;
    const ev = proximoEvento();
    if(!ev){ card.hidden = true; return; }
    const d = diasRestantes(ev.fecha);
    card.hidden = false;
    card.textContent = d === 0 ? '📅 ¡Hoy es «' + ev.nombre + '»!' : '📅 Faltan ' + d + ' día' + (d===1?'':'s') + ' para «' + ev.nombre + '»';
  }
  function renderEventos(){
    const cont = $('evList'); if(!cont) return; cont.innerHTML = '';
    const hoy = today();
    const orden = eventos.slice().sort((a,b) => a.fecha.localeCompare(b.fecha));
    if(!orden.length){ const e = document.createElement('div'); e.className = 'ev-empty'; e.textContent = 'Sin fechas aún. Agrega una arriba.'; cont.appendChild(e); return; }
    orden.forEach(ev => {
      const d = diasRestantes(ev.fecha);
      const row = document.createElement('div'); row.className = 'ev-row' + (ev.fecha < hoy ? ' pasado' : '');
      const body = document.createElement('div'); body.className = 'ev-body';
      const nm = document.createElement('div'); nm.className = 'ev-nm'; nm.textContent = ev.nombre;
      const ft = document.createElement('div'); ft.className = 'ev-ft';
      ft.textContent = new Date(ev.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) +
        ' · ' + (d > 0 ? 'faltan ' + d + 'd' : d === 0 ? '¡hoy!' : 'hace ' + (-d) + 'd');
      body.append(nm, ft);
      const del = document.createElement('button'); del.className = 'ev-del'; del.textContent = '✕'; del.setAttribute('aria-label','Borrar');
      del.addEventListener('click', ()=>{ eventos = eventos.filter(x => x.id !== ev.id); saveEventos(); renderEventos(); renderCuentaCard(); });
      row.append(body, del); cont.appendChild(row);
    });
  }
  $('evAdd').addEventListener('click', ()=>{
    const nombre = $('evNombre').value.trim().slice(0,40);
    const fecha = $('evFecha').value;
    if(!nombre){ toast('Ponle nombre al evento.'); return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){ toast('Elige una fecha.'); return; }
    eventos.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), nombre, fecha });
    saveEventos(); $('evNombre').value = ''; $('evFecha').value = '';
    renderEventos(); renderCuentaCard(); sonarCheck(); toast('Evento agregado. 📅');
  });
  $('masEventos').addEventListener('click', ()=>{ cerrarMas(); renderEventos(); $('eventosWrap').hidden = false; });
  $('evClose').addEventListener('click', ()=>{ $('eventosWrap').hidden = true; });
  $('eventosWrap').addEventListener('click', (e)=>{ if(e.target === $('eventosWrap')) $('eventosWrap').hidden = true; });
  $('cuentaCard').addEventListener('click', ()=>{ renderEventos(); $('eventosWrap').hidden = false; });

  // ---- #116 Modo viaje / vacaciones ----
  const VIAJE_KEY = 'reps-viaje';
  function loadViaje(){
    viaje = { activo:false, dias:{} };
    try{ const v = JSON.parse(localStorage.getItem(VIAJE_KEY)); if(esMapa(v)){ viaje.activo = !!v.activo; if(esMapa(v.dias)) viaje.dias = v.dias; } }catch(e){ viaje = { activo:false, dias:{} }; }
    // si el viaje está activo, hoy cuenta como viaje; si NO, hoy nunca debe
    // ser día de viaje (sana un "hoy" que quedó atascado al terminar un viaje).
    if(viaje.activo) viaje.dias[today()] = true;
    else if(viaje.dias[today()]){ delete viaje.dias[today()]; saveViaje(); }
  }
  function saveViaje(){ try{ localStorage.setItem(VIAJE_KEY, JSON.stringify(viaje)); }catch(e){} }
  function renderViajeBanner(){
    const b = $('viajeBanner'); if(b) b.hidden = !viaje.activo;
    const st = $('masViajeState'); if(st) st.textContent = viaje.activo ? '● Activo' : '';
    const sub = $('masViajeSub'); if(sub) sub.textContent = viaje.activo ? 'Activo — hoy y los días de viaje no cuentan' : 'Pausa expectativas sin romper tu racha';
  }
  function setViaje(on){
    viaje.activo = on;
    if(on){
      viaje.dias[today()] = true; // marca hoy; los días siguientes se marcan al abrir la app
    } else {
      // al terminar, HOY vuelve a contar (ya no estás de viaje). Los días
      // PASADOS de viaje se conservan neutrales (fue tu historia real).
      delete viaje.dias[today()];
    }
    saveViaje();
    // el banner refleja el estado YA, antes de cualquier cosa que pudiera
    // fallar (así "Terminar" siempre lo apaga a la vista, pase lo que pase)
    renderViajeBanner();
    try{ procesarRacha(); }catch(e){}
    try{ render(); }catch(e){}
    renderViajeBanner(); // por si render() falló, reafirma el estado del banner
    toast(on ? '✈️ Modo viaje activado. Descansa sin culpa.' : 'Modo viaje terminado. ¡Bienvenido de vuelta!');
  }
  $('masViaje').addEventListener('click', ()=>{ cerrarMas(); setViaje(!viaje.activo); });
  { const vo = $('viajeOff'); if(vo) vo.addEventListener('click', ()=>{ $('viajeBanner').hidden = true; setViaje(false); }); }

  // ===== Experiencia / personalización (ideas #106–#111) =====

  // ---- #106/#107 Personalizar Hoy: enciende/apaga tarjetas ----
  const HOY_CFG_KEY = 'reps-hoy-cfg';
  const HOY_CARDS = [
    {id:'mantra', name:'Mantra'},
    {id:'brief', name:'Resumen de la mañana'},
    {id:'armaDia', name:'Botón «Arma mi día»'},
    {id:'ahora', name:'El Ahora (bloque en curso)'},
    {id:'energiaCard', name:'Semáforo de energía'},
    {id:'checkinCard', name:'Chequeo de ánimo'},
    {id:'week', name:'Mini-semana'},
    {id:'compa', name:'Compañero'},
    {id:'despWrap', name:'Despertar a tiempo'},
  ];
  let hoyCfg = {}; // {id:false} = oculto
  function loadHoyCfg(){ hoyCfg = {}; try{ const v = JSON.parse(localStorage.getItem(HOY_CFG_KEY)); if(esMapa(v)) Object.keys(v).forEach(k => { if(v[k] === false) hoyCfg[k] = false; }); }catch(e){ hoyCfg = {}; } }
  function saveHoyCfg(){ try{ localStorage.setItem(HOY_CFG_KEY, JSON.stringify(hoyCfg)); }catch(e){} }
  function applyHoyCfg(){
    HOY_CARDS.forEach(c => { const el = $(c.id); if(!el) return;
      if(hoyCfg[c.id] === false) el.style.display = 'none';
      else if(el.style.display === 'none') el.style.display = ''; // devuelve el control a su lógica propia
    });
  }
  function renderHoyCfg(){
    const cont = $('hoyCfgList'); if(!cont) return; cont.innerHTML = '';
    HOY_CARDS.forEach(c => {
      const row = document.createElement('label'); row.className = 'cfg-row';
      const tx = document.createElement('span'); tx.textContent = c.name;
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = hoyCfg[c.id] !== false;
      chk.addEventListener('change', ()=>{ if(chk.checked) delete hoyCfg[c.id]; else hoyCfg[c.id] = false; saveHoyCfg(); applyHoyCfg(); });
      row.append(tx, chk); cont.appendChild(row);
    });
  }

  // ---- #108 Fondo degradado ----
  const GRAD_KEY = 'reps-degradado';
  let grad = { on:false, color:'#1a1030' };
  function loadGrad(){ grad = { on:false, color:'#1a1030' }; try{ const v = JSON.parse(localStorage.getItem(GRAD_KEY)); if(esMapa(v)){ grad.on = !!v.on; if(/^#[0-9a-fA-F]{6}$/.test(v.color)) grad.color = v.color; } }catch(e){} }
  function saveGrad(){ try{ if(grad.on) localStorage.setItem(GRAD_KEY, JSON.stringify(grad)); else localStorage.removeItem(GRAD_KEY); }catch(e){} }
  function applyGrad(){
    const css = getComputedStyle(document.documentElement);
    const base = css.getPropertyValue('--bg').trim() || '#12161d';
    document.body.style.backgroundImage = grad.on ? 'linear-gradient(180deg, ' + base + ' 0%, ' + grad.color + ' 100%)' : '';
    document.body.style.backgroundAttachment = grad.on ? 'fixed' : '';
  }
  function renderGradCfg(){
    const p = $('pickBg2'); if(p) p.value = grad.color;
    document.querySelectorAll('#themeWrap .grad-opts .dist-opt').forEach(b => b.classList.toggle('on', (b.dataset.grad === 'on') === grad.on));
  }
  { const p = $('pickBg2'); if(p) p.addEventListener('input', ()=>{ grad.color = p.value; if(grad.on){ saveGrad(); applyGrad(); } }); }
  document.querySelectorAll('#themeWrap .grad-opts .dist-opt').forEach(b => b.addEventListener('click', ()=>{ grad.on = b.dataset.grad === 'on'; saveGrad(); applyGrad(); renderGradCfg(); }));

  // ---- #109 Sonidos y vibración por acción ----
  const SONIDOS_KEY = 'reps-sonidos';
  let sonCfg = { check:true, ganado:true, fin:true, haptic:true };
  function loadSonCfg(){ sonCfg = { check:true, ganado:true, fin:true, haptic:true }; try{ const v = JSON.parse(localStorage.getItem(SONIDOS_KEY)); if(esMapa(v)){ ['check','ganado','fin','haptic'].forEach(k => { if(v[k] === false) sonCfg[k] = false; }); } }catch(e){} }
  function saveSonCfg(){ try{ localStorage.setItem(SONIDOS_KEY, JSON.stringify(sonCfg)); }catch(e){} }
  function vibrar(ms){ if(sonCfg.haptic && navigator.vibrate){ try{ navigator.vibrate(ms); }catch(e){} } }
  function renderSonCfg(){
    const cont = $('sonidosCfg'); if(!cont) return; cont.innerHTML = '';
    const items = [['check','Al completar un hábito o idea'],['ganado','Al ganar el día o una meta'],['fin','Al terminar el temporizador'],['haptic','Vibración (háptica)']];
    items.forEach(([k, name]) => {
      const row = document.createElement('label'); row.className = 'cfg-row';
      const tx = document.createElement('span'); tx.textContent = name;
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = sonCfg[k] !== false;
      chk.addEventListener('change', ()=>{ sonCfg[k] = chk.checked; saveSonCfg(); if(chk.checked && k === 'check') sonarCheck(); if(chk.checked && k === 'haptic') vibrar(30); });
      row.append(tx, chk); cont.appendChild(row);
    });
  }

  // ===== Datos / visualización (ideas #101–#105) =====

  // ---- #105 Insight proactivo al abrir Stats ----
  // Un dato local y sorprendente. Se elige de forma estable por día (no
  // cambia a cada repintado) entre los candidatos que hoy tienen sustancia.
  function insightsProactivos(){
    const out = [];
    const keys = Object.keys(dias).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    if(keys.length < 5) return out;
    const nombres = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    // mejor día de la semana (mayor tasa de ganado, con requisito)
    const perDow = Array.from({length:7}, ()=>({req:0,won:0}));
    keys.forEach(k => { if(k > today() || esDescanso(k)) return; const dw = dowDe(k); perDow[dw].req++; if(esGanado(k)) perDow[dw].won++; });
    const conDatos = perDow.map((x,i)=>({i, tasa: x.req>=3 ? x.won/x.req : -1, req:x.req})).filter(x=>x.tasa>=0);
    if(conDatos.length >= 2){
      const mejor = conDatos.slice().sort((a,b)=>b.tasa-a.tasa)[0];
      const peor = conDatos.slice().sort((a,b)=>a.tasa-b.tasa)[0];
      if(mejor.tasa > peor.tasa) out.push('Tu mejor día es el ' + nombres[mejor.i] + ' (' + Math.round(mejor.tasa*100) + '% ganados). El más flojo, el ' + nombres[peor.i] + '.');
    }
    // foco acumulado
    if(focoTotal >= 60){ const h = Math.floor(focoTotal/60); out.push('Llevas ' + h + ' hora' + (h===1?'':'s') + ' de foco acumulado. Eso es tiempo que sí fue tuyo.'); }
    // total de veces del hábito más hecho
    let topH = null, topN = 0;
    HABITS.forEach(h => { const n = keys.filter(k => hecho(dias[k], h.id)).length; if(n > topN){ topN = n; topH = h; } });
    if(topH && topN >= 10) out.push('Tu hábito más constante es «' + topH.name + '»: ' + topN + ' veces registradas.');
    // regresos
    const reg = contarRegresos();
    if(reg >= 2) out.push('Has caído y vuelto ' + reg + ' veces. Esa es la habilidad que de verdad importa.');
    // primer día
    const primero = keys.sort()[0];
    if(primero){ const d = Math.round((new Date(today()+'T12:00:00') - new Date(primero+'T12:00:00'))/86400000); if(d >= 14) out.push('Llevas ' + d + ' días desde que empezaste esto. Nada mal.'); }
    return out;
  }
  function renderInsightProx(){
    const card = $('insightProx'); if(!card) return;
    const ins = insightsProactivos();
    if(!ins.length){ card.hidden = true; return; }
    // estable por día: índice según la fecha
    const idx = parseInt(today().replace(/-/g,''), 10) % ins.length;
    card.hidden = false; card.textContent = '💡 ' + ins[idx];
  }

  // ---- #102 Línea de tiempo (mes a mes) ----
  function mesStats(mesKey){
    let ganados = 0, conReg = 0;
    Object.keys(dias).forEach(k => {
      if(!k.startsWith(mesKey)) return;
      if(dias[k] && HABITS.some(h => dias[k][h.id])) conReg++;
      if(esGanado(k)) ganados++;
    });
    return { ganados, conReg };
  }
  function renderTimeline(){
    const cont = $('tlMeses'); if(!cont) return; cont.innerHTML = '';
    const keys = Object.keys(dias).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    if(!keys.length){ const e = document.createElement('div'); e.className = 'tl-empty'; e.textContent = 'Aún no hay historia. Empieza hoy.'; cont.appendChild(e); return; }
    const primero = keys[0].slice(0,7);
    const [py, pm] = primero.split('-').map(Number);
    const now = new Date();
    const meses = [];
    let y = py, m = pm;
    while(y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()+1)){
      meses.push(y + '-' + String(m).padStart(2,'0'));
      m++; if(m > 12){ m = 1; y++; }
    }
    const maxG = Math.max(1, ...meses.map(mk => mesStats(mk).ganados));
    meses.reverse().forEach(mk => {
      const st = mesStats(mk);
      const row = document.createElement('div'); row.className = 'tl-row';
      const lbl = document.createElement('div'); lbl.className = 'tl-mes';
      lbl.textContent = new Date(mk + '-15T12:00:00').toLocaleDateString('es-MX', {month:'long', year:'numeric'});
      const barW = document.createElement('div'); barW.className = 'tl-bar';
      const fill = document.createElement('i'); fill.style.width = Math.round(st.ganados/maxG*100) + '%'; barW.appendChild(fill);
      const num = document.createElement('div'); num.className = 'tl-num'; num.textContent = st.ganados + ' ganados';
      row.append(lbl, barW, num);
      cont.appendChild(row);
    });
  }
  $('openTimeline').addEventListener('click', ()=>{ renderTimeline(); $('timelineWrap').hidden = false; });
  $('tlClose').addEventListener('click', ()=>{ $('timelineWrap').hidden = true; });
  $('timelineWrap').addEventListener('click', (e)=>{ if(e.target === $('timelineWrap')) $('timelineWrap').hidden = true; });

  // ---- #103 Tú vs tú (trimestre actual vs anterior) ----
  function rangoStats(desde, hasta){
    let req = 0, won = 0, foco = 0, animoSum = 0, animoN = 0;
    const AS = { bien:2, regular:1, mal:0 };
    const d = new Date(desde + 'T12:00:00'), fin = new Date(hasta + 'T12:00:00');
    while(d <= fin){
      const k = localISO(d);
      if(!esDescanso(k) && k <= today()){ req++; if(esGanado(k)) won++; }
      const c = cierres[k]; if(c && c.animo != null){ animoSum += AS[c.animo]; animoN++; }
      d.setDate(d.getDate() + 1);
    }
    return { won, tasa: req ? Math.round(won/req*100) : 0, animo: animoN ? (animoSum/animoN) : null };
  }
  function renderVsTu(){
    const hoy = new Date(today() + 'T12:00:00');
    const finNow = today();
    const iniNow = localISO(new Date(hoy.getTime() - 89*86400000));
    const finPrev = localISO(new Date(hoy.getTime() - 90*86400000));
    const iniPrev = localISO(new Date(hoy.getTime() - 179*86400000));
    const nowS = rangoStats(iniNow, finNow), prevS = rangoStats(iniPrev, finPrev);
    const animoTxt = a => a == null ? '·' : (a >= 1.5 ? '🙂' : a >= 0.75 ? '😐' : '☹️');
    $('vtPrev').innerHTML = '<div class="vt-h">Trimestre anterior</div>' +
      '<div class="vt-big">' + prevS.won + '</div><div class="vt-sub">días ganados</div>' +
      '<div class="vt-line">' + prevS.tasa + '% cumplido</div><div class="vt-line">ánimo ' + animoTxt(prevS.animo) + '</div>';
    $('vtNow').innerHTML = '<div class="vt-h">Este trimestre</div>' +
      '<div class="vt-big">' + nowS.won + '</div><div class="vt-sub">días ganados</div>' +
      '<div class="vt-line">' + nowS.tasa + '% cumplido</div><div class="vt-line">ánimo ' + animoTxt(nowS.animo) + '</div>';
    const dif = nowS.won - prevS.won;
    const st = $('vtStats');
    st.className = 'vt-verdict ' + (dif > 0 ? 'up' : dif < 0 ? 'down' : '');
    st.textContent = dif > 0 ? '📈 Vas ' + dif + ' días ganados por encima del trimestre pasado.' :
      dif < 0 ? '📉 Vas ' + (-dif) + ' días por debajo. Aún hay tiempo de darle la vuelta.' :
      '➡️ Empatas con tu trimestre pasado.';
  }
  $('openVsTu').addEventListener('click', ()=>{ renderVsTu(); $('vsTuWrap').hidden = false; });
  $('vtClose').addEventListener('click', ()=>{ $('vsTuWrap').hidden = true; });
  $('vsTuWrap').addEventListener('click', (e)=>{ if(e.target === $('vsTuWrap')) $('vsTuWrap').hidden = true; });

  // ---- #104 Compartir progreso (imagen con canvas, mismo estilo que el mes) ----
  function drawProgresoImage(){
    const W = 1080, H = 1350, PAD = 80;
    const css = getComputedStyle(document.documentElement);
    const C = n => css.getPropertyValue(n).trim();
    const bg = C('--bg'), card = C('--card-2'), text = C('--text'), muted = C('--muted'), accent = C('--amber');
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
    ctx.fillStyle = muted; ctx.font = '600 28px ' + FONT; ctx.fillText('MI PROGRESO EN REPS', PAD, 110);
    ctx.fillStyle = text; ctx.font = '800 64px ' + FONT;
    ctx.fillText(perfil && perfil.nombre ? perfil.nombre : 'Mi camino', PAD, 195);
    const s = statsData();
    const tiles = [[String(s.now), 'RACHA ACTUAL'], [String(s.best), 'MEJOR RACHA'], [String(s.total), 'DÍAS GANADOS'], [s.pct30 + '%', 'ÚLTIMO MES']];
    tiles.forEach(([num, lbl], i) => {
      const cx = i % 2, cy = Math.floor(i / 2);
      const bx = PAD + cx * ((W - PAD*2)/2 + 0) , by = 320 + cy * 300;
      const bw = (W - PAD*2 - 40) / 2, bh = 260;
      ctx.fillStyle = card; roundRect(ctx, bx, by, bw, bh, 28); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = accent; ctx.font = '800 96px ' + FONT; ctx.fillText(num, bx + bw/2, by + 140);
      ctx.fillStyle = muted; ctx.font = '600 24px ' + FONT; ctx.fillText(lbl, bx + bw/2, by + 190);
      ctx.textAlign = 'left';
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = muted; ctx.font = '600 26px ' + FONT;
    ctx.fillText('Un día a la vez. Cada rep, un voto por quién soy.', W/2, 1000);
    ctx.font = '800 60px ' + FONT;
    const wReps = ctx.measureText('REPS').width, wDot = ctx.measureText('.').width;
    const x0 = W/2 - (wReps + wDot)/2; ctx.textAlign = 'left';
    ctx.fillStyle = text; ctx.fillText('REPS', x0, 1300);
    ctx.fillStyle = accent; ctx.fillText('.', x0 + wReps, 1300);
    return { canvas, nombre: 'reps-progreso-' + today() + '.png' };
  }
  // helper rectángulo redondeado (para el canvas)
  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  }
  $('shareProgreso').addEventListener('click', ()=>{
    const { canvas, nombre } = drawProgresoImage();
    compartirCanvas(canvas, nombre, 'Mi progreso en REPS');
  });

  // ===== Respaldo: exportar / importar =====
  function exportBackup(){
    const backup = {
      app: 'reps',          // firma: identifica que este json es nuestro
      schema: SCHEMA,       // versión del formato de los datos que contiene
      exportado: new Date().toISOString(),
      data: { 'reps-dias': dias, 'reps-bandeja': ideas, 'reps-cierres': cierres, 'reps-tema': themeSel, 'reps-semana': semana, 'reps-cierre-semana': cierreSemana, 'reps-distribucion': dist, 'reps-efecto': fx, 'reps-racha': racha, 'reps-habitos': HABITS, 'reps-caidas': caidas, 'reps-hitos': hitosVistos, 'reps-perfil': perfil, 'reps-foco': focoTotal, 'reps-foco-sonido': focoSonido, 'reps-metas': metas, 'reps-rutina': rutina, 'reps-carta': carta, 'reps-recompensas': recompensas, 'reps-despertar': despConf, 'reps-plan-semana': planSemana, 'reps-recordatorios': recordatorios, 'reps-record-hechos': recordHechos, 'reps-capas': capas, 'reps-semana-flex': semFlex, 'reps-compa': compaConf, 'reps-finanzas': fin, 'reps-evitar': evitares, 'reps-diario': diario, 'reps-sueno': sueno, 'reps-kanban': kanban, 'reps-retos': retos, 'reps-energia': energia, 'reps-solo': solo, 'reps-ia-chat': iaChat, 'reps-gratitud': gratitud, 'reps-agua': agua, 'reps-pausas': pausas, 'reps-sueno-rutina': suenoRut, 'reps-checkin': checkin, 'reps-mantra': mantra, 'reps-carta-futuro': cartaFut, 'reps-victorias': victorias, 'reps-brutal': brutal ? '1' : '', 'reps-hoy-cfg': hoyCfg, 'reps-degradado': grad.on ? grad : '', 'reps-sonidos': sonCfg, 'reps-eventos': eventos, 'reps-viaje': viaje, 'reps-rutina-tpl': rutTpl, 'reps-nav': navPos === 'arriba' ? 'arriba' : '', 'reps-fuente': fuente === 'sistema' ? 'sistema' : '', 'reps-tema-auto': temaAuto ? '1' : '' },
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
        if(b.data['reps-nav'] === 'arriba') localStorage.setItem(NAV_KEY, 'arriba');
        else localStorage.removeItem(NAV_KEY);
        if(b.data['reps-fuente'] === 'sistema') localStorage.setItem(FONT_KEY, 'sistema');
        else localStorage.removeItem(FONT_KEY);
        if(b.data['reps-tema-auto'] === '1') localStorage.setItem(AUTO_KEY, '1');
        else localStorage.removeItem(AUTO_KEY);
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
        const rt = b.data['reps-rutina'];
        if(Array.isArray(rt)) localStorage.setItem(RUTINA_KEY, JSON.stringify(rt));
        else localStorage.removeItem(RUTINA_KEY);
        const ct = b.data['reps-carta'];
        if(esMapa(ct)) localStorage.setItem(CARTA_KEY, JSON.stringify(ct));
        else localStorage.removeItem(CARTA_KEY);
        const rcs = b.data['reps-recompensas'];
        if(Array.isArray(rcs)) localStorage.setItem(RECOMP_KEY, JSON.stringify(rcs));
        else localStorage.removeItem(RECOMP_KEY);
        const dsp = b.data['reps-despertar'];
        if(esMapa(dsp)) localStorage.setItem(DESPERTAR_KEY, JSON.stringify(dsp));
        else localStorage.removeItem(DESPERTAR_KEY);
        const psm = b.data['reps-plan-semana'];
        if(esMapa(psm)) localStorage.setItem(PLANSEM_KEY, JSON.stringify(psm));
        else localStorage.removeItem(PLANSEM_KEY);
        const rcd = b.data['reps-recordatorios'];
        if(Array.isArray(rcd)) localStorage.setItem(REC_KEY, JSON.stringify(rcd));
        else localStorage.removeItem(REC_KEY);
        const rch = b.data['reps-record-hechos'];
        if(esMapa(rch)) localStorage.setItem(REC_HECHOS_KEY, JSON.stringify(rch));
        else localStorage.removeItem(REC_HECHOS_KEY);
        const cps = b.data['reps-capas'];
        if(Array.isArray(cps)) localStorage.setItem(CAPAS_KEY, JSON.stringify(cps));
        else localStorage.removeItem(CAPAS_KEY);
        const sfx = b.data['reps-semana-flex'];
        if(esMapa(sfx)) localStorage.setItem(SEMANA_FLEX_KEY, JSON.stringify(sfx));
        else localStorage.removeItem(SEMANA_FLEX_KEY);
        const cmp = b.data['reps-compa'];
        if(esMapa(cmp)) localStorage.setItem(COMPA_KEY, JSON.stringify(cmp));
        else localStorage.removeItem(COMPA_KEY);
        const fnz = b.data['reps-finanzas'];
        if(esMapa(fnz)) localStorage.setItem(FIN_KEY, JSON.stringify(fnz));
        else localStorage.removeItem(FIN_KEY);
        const evt = b.data['reps-evitar'];
        if(Array.isArray(evt)) localStorage.setItem(EVITAR_KEY, JSON.stringify(evt));
        else localStorage.removeItem(EVITAR_KEY);
        const dry = b.data['reps-diario'];
        if(esMapa(dry)) localStorage.setItem(DIARIO_KEY, JSON.stringify(dry));
        else localStorage.removeItem(DIARIO_KEY);
        const slp = b.data['reps-sueno'];
        if(esMapa(slp)) localStorage.setItem(SUENO_KEY, JSON.stringify(slp));
        else localStorage.removeItem(SUENO_KEY);
        const kbn = b.data['reps-kanban'];
        if(Array.isArray(kbn)) localStorage.setItem(KANBAN_KEY, JSON.stringify(kbn));
        else localStorage.removeItem(KANBAN_KEY);
        const rts = b.data['reps-retos'];
        if(Array.isArray(rts)) localStorage.setItem(RETOS_KEY, JSON.stringify(rts));
        else localStorage.removeItem(RETOS_KEY);
        const eng = b.data['reps-energia'];
        if(esMapa(eng)) localStorage.setItem(ENERGIA_KEY, JSON.stringify(eng));
        else localStorage.removeItem(ENERGIA_KEY);
        const slo = b.data['reps-solo'];
        if(typeof slo === 'string' && slo) localStorage.setItem(SOLO_KEY, slo);
        else localStorage.removeItem(SOLO_KEY);
        const iac = b.data['reps-ia-chat'];
        if(Array.isArray(iac)) localStorage.setItem(IA_CHAT_KEY, JSON.stringify(iac));
        else localStorage.removeItem(IA_CHAT_KEY);
        const grt = b.data['reps-gratitud'];
        if(esMapa(grt)) localStorage.setItem(GRAT_KEY, JSON.stringify(grt));
        else localStorage.removeItem(GRAT_KEY);
        const agu = b.data['reps-agua'];
        if(esMapa(agu)) localStorage.setItem(AGUA_KEY, JSON.stringify(agu));
        else localStorage.removeItem(AGUA_KEY);
        const pau = b.data['reps-pausas'];
        if(esMapa(pau)) localStorage.setItem(PAUSAS_KEY, JSON.stringify(pau));
        else localStorage.removeItem(PAUSAS_KEY);
        const srt = b.data['reps-sueno-rutina'];
        if(esMapa(srt)) localStorage.setItem(SUENO_RUT_KEY, JSON.stringify(srt));
        else localStorage.removeItem(SUENO_RUT_KEY);
        const chk = b.data['reps-checkin'];
        if(esMapa(chk)) localStorage.setItem(CHECKIN_KEY, JSON.stringify(chk));
        else localStorage.removeItem(CHECKIN_KEY);
        const mnt = b.data['reps-mantra'];
        if(typeof mnt === 'string' && mnt) localStorage.setItem(MANTRA_KEY, mnt);
        else localStorage.removeItem(MANTRA_KEY);
        const cfu = b.data['reps-carta-futuro'];
        if(esMapa(cfu)) localStorage.setItem(CARTA_FUT_KEY, JSON.stringify(cfu));
        else localStorage.removeItem(CARTA_FUT_KEY);
        const vic = b.data['reps-victorias'];
        if(Array.isArray(vic)) localStorage.setItem(VICT_KEY, JSON.stringify(vic));
        else localStorage.removeItem(VICT_KEY);
        if(b.data['reps-brutal'] === '1') localStorage.setItem(BRUTAL_KEY, '1');
        else localStorage.removeItem(BRUTAL_KEY);
        const hcf = b.data['reps-hoy-cfg'];
        if(esMapa(hcf)) localStorage.setItem(HOY_CFG_KEY, JSON.stringify(hcf));
        else localStorage.removeItem(HOY_CFG_KEY);
        const grd = b.data['reps-degradado'];
        if(esMapa(grd) && grd.on) localStorage.setItem(GRAD_KEY, JSON.stringify(grd));
        else localStorage.removeItem(GRAD_KEY);
        const snc = b.data['reps-sonidos'];
        if(esMapa(snc)) localStorage.setItem(SONIDOS_KEY, JSON.stringify(snc));
        else localStorage.removeItem(SONIDOS_KEY);
        const evt2 = b.data['reps-eventos'];
        if(Array.isArray(evt2)) localStorage.setItem(EVENTOS_KEY, JSON.stringify(evt2));
        else localStorage.removeItem(EVENTOS_KEY);
        const vje = b.data['reps-viaje'];
        if(esMapa(vje)) localStorage.setItem(VIAJE_KEY, JSON.stringify(vje));
        else localStorage.removeItem(VIAJE_KEY);
        const rtp = b.data['reps-rutina-tpl'];
        if(Array.isArray(rtp)) localStorage.setItem(RUT_TPL_KEY, JSON.stringify(rtp));
        else localStorage.removeItem(RUT_TPL_KEY);
      }catch(e){}
      save(); saveTray(); saveCierres(); saveSemana();
      // el respaldo pudo venir de una app vieja: se marca su versión de
      // formato, se migra lo guardado y se relee ya en formato actual
      localStorage.setItem(SCHEMA_KEY, String(parseInt(b.schema, 10) || 1));
      migrate();
      loadHabitos(); // antes de load/render: todo lo demás depende de HABITS
      load(); loadTray(); loadCierres(); loadSemana(); loadSemFlex();
      loadTheme(); loadTemaAuto(); applyThemeSel();
      loadDist(); applyDist();
      loadNav(); applyNav();
      loadFont(); applyFont();
      loadFx(); applyFx();
      racha = { congeladores: 0, fabRun: 0, procesadoHasta: null, congelados: {} };
      loadRacha(); procesarRacha();
      caidas = {}; loadCaidas();
      hitosVistos = []; loadHitos();
      cierreSemana = {}; loadCierreSemana();
      perfil = null; loadPerfil(); aplicarNombre();
      focoTotal = 0; loadFoco(); loadSonido();
      metas = []; loadMetas(); renderMetas();
      rutina = []; loadRutina(); renderRutina();
      carta = null; loadCarta();
      recompensas = []; loadRecompensas();
      despConf = { meta:'8:30', rigor:'medio', finde:false }; loadDespertar();
      planSemana = {}; loadPlanSemana(); renderPlanSemCard();
      recordatorios = []; recordHechos = {}; loadRecordatorios();
      capas = []; loadCapas(); renderCapas();
      compaConf = { nombre:'', criatura:'planta', emoji:'' }; loadCompa();
      fin = { movs:[], presupuesto:0, presuCat:{}, metas:[], subs:[], deudas:[], carteras:[], noGasto:[] }; loadFin();
      evitares = []; loadEvitar(); renderEvitar();
      diario = {}; loadDiario(); renderDiario();
      sueno = {}; loadSueno();
      kanban = []; loadKanban();
      retos = []; loadRetos();
      energia = {}; loadEnergia();
      solo = ''; loadSolo();
      iaChat = []; loadIaChat();
      gratitud = {}; loadGratitud();
      agua = { meta:8, dias:{} }; loadAgua();
      pausas = { intervalo:60, activo:false }; loadPausas(); armarPausas();
      suenoRut = {}; loadSuenoRut();
      checkin = {}; loadCheckin();
      mantra = ''; loadMantra();
      cartaFut = null; loadCartaFut();
      victorias = []; loadVictorias();
      brutal = false; loadBrutal();
      loadHoyCfg();
      loadGrad(); applyGrad();
      loadSonCfg();
      loadEventos();
      viaje = { activo:false, dias:{} }; loadViaje();
      loadRutTpl();
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
  loadTemaAuto(); // antes de applyThemeSel: puede alternar claro/oscuro por hora
  applyThemeSel(); // primero el tema: la app ya nace pintada del color elegido
  loadDist();
  applyDist();
  loadNav();
  applyNav();
  loadFont();
  applyFont();
  loadFx();
  applyFx();
  loadGrad(); applyGrad();    // #108 fondo degradado (tras aplicar el tema)
  loadHoyCfg();               // #106/#107 personalizar Hoy (applyHoyCfg corre en render)
  loadSonCfg();               // #109 sonidos por acción
  load();
  loadTray();
  loadCierres();   // antes de render(): el calendario ya lee los cierres
  loadSemana();    // antes de renderPlanHoy(): el banner lee el plan semanal
  loadSemFlex();   // ajustes de flexibilidad de la IA (los muestra el banner)
  loadCierreSemana(); // antes de renderSemana(): muestra el cierre de la semana
  loadViaje();     // antes de procesarRacha: los días de viaje son descanso (idea #116)
  loadRacha();     // antes de render(): la racha visible usa los congelados
  procesarRacha(); // aplica congeladores por los días transcurridos
  loadCaidas();    // antes de render(): el ritual y El Espejo leen las caídas
  loadCarta();     // antes de render(): el rescate muestra la carta si existe
  loadHitos();     // antes de render(): siembra lo ya logrado sin celebrar
  loadFoco();      // antes de render(): el total de foco se muestra en Stats
  loadSonido();
  loadMetas();
  loadRecompensas();
  loadCompa(); // antes de render(): renderCompa lee la config del compañero
  loadFin();   // finanzas (menú Más); se renderiza al abrir el sheet
  loadEvitar(); // "días sin…" (hábitos a evitar)
  loadDiario(); renderDiario(); // diario del día
  loadSueno(); // registro de sueño (pantalla propia)
  loadKanban(); // tablero de proyectos (se renderiza al abrir)
  loadEnergia(); // semáforo de energía del día (idea #77)
  loadSolo(); // modo un solo hábito (idea #74)
  loadRetos(); // retos con fecha límite (idea #75); se renderiza al abrir
  loadIaChat(); // memoria del asistente (idea #84); se renderiza al abrir
  loadGratitud(); // gratitud (idea #93)
  loadAgua(); // agua (idea #92)
  loadPausas(); armarPausas(); // pausas activas (idea #94)
  loadSuenoRut(); // higiene del sueño (idea #95)
  loadCheckin(); // chequeo de media jornada (idea #91)
  loadMantra(); // mantra arriba de Hoy (idea #97)
  loadCartaFut(); // carta a tu futuro yo (idea #96)
  loadVictorias(); // muro de victorias (idea #98)
  loadBrutal(); // modo espejo brutal (idea #100)
  loadEventos(); // cuenta regresiva (idea #115)
  loadRutTpl(); // plantillas de rutina propias (idea #114)
  loadRecordatorios(); // antes de render(): suman al puntaje del día
  loadCapas(); renderCapas(); // mi ruta editable
  loadRutina();
  loadDespertar(); // antes de render(): la tarjeta de despertar y el puntaje
  loadPlanSemana(); renderPlanSemCard(); // el plan de la semana en Mi día
  espejoParaSW();  // el SW siempre tiene la rutina fresca para las notificaciones
  render();
  renderMetas();
  renderRutina();
  renderTray();
  renderSemana();
  fillCierreForm();
  renderPlanHoy();
  loadBrief(); renderBrief(); // resumen de la mañana (IA, 1×/día)
  loadDiaPlan(); renderDiaPlan(); // "arma mi día": plan guardado (IA)
  renderFrase(); // frase del día (local)
  renderEvitar(); // días sin… (cuenta días limpios)

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

  // Stories: se auto-abren UNA vez por día (tras la intro), como los "nuevos"
  // de Instagram. El anillo de Hoy las relanza cuando quieras.
  (function(){
    if(instalacionNueva) return; // el usuario nuevo va al cuestionario, no a stories
    let visto = null;
    try{ visto = localStorage.getItem(STORIES_KEY); }catch(e){}
    if(visto === today()) return;
    try{ localStorage.setItem(STORIES_KEY, today()); }catch(e){}
    setTimeout(()=>{ try{ abrirStories(); }catch(e){} }, 2400);
  })();

  // Pop dominical: si es domingo y la semana entrante aún no está planeada,
  // salta el plan de la semana (una vez por domingo, sin insistir)
  (function(){
    if(instalacionNueva) return;
    if(new Date().getDay() !== 0) return;
    const target = planSemTarget();
    if(planSemana[target] && planSemana[target].guardado) return; // ya planeada
    let visto = null;
    try{ visto = localStorage.getItem(PLANSEM_VISTO); }catch(e){}
    if(visto === today()) return; // hoy ya saltó (aunque lo hayas cerrado)
    try{ localStorage.setItem(PLANSEM_VISTO, today()); }catch(e){}
    setTimeout(()=>{ try{ abrirPlanSem(); }catch(e){} }, 3000);
  })();

  // ===== Atajos del ícono (shortcuts del manifest): ?tab=... =====
  (function(){
    const tab = new URLSearchParams(location.search).get('tab');
    if(!tab) return;
    const map = { bandeja:'p-bandeja', stats:'p-stats', dia:'p-dia', cierre:'p-hoy', armadia:'p-hoy' };
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
    if(tab === 'armadia'){ // atajo #111: abre «Arma mi día» directo
      setTimeout(()=>{ const b = $('armaDia'); if(b) b.click(); }, 300);
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
      renderBrief(); // día nuevo: arma el resumen de la mañana otra vez
      renderDiaPlan(); // el plan del día viejo ya no aplica (otra fecha)
      renderFrase(); // rota la frase del día
      renderEvitar(); // suma un día sin recaída
      renderDiario(); // el diario ahora apunta al día nuevo
    }
    // el modo automático re-evalúa la hora cada vez que la app vuelve al frente
    if(document.visibilityState === 'visible' && temaAuto) applyThemeSel();
  });
  // ↻ del resumen: fuerza regenerarlo (ideas frescas, plan actualizado)
  $('briefRef').addEventListener('click', ()=>{ if(navigator.onLine === false){ toast('Sin internet: no puedo actualizar el resumen ahora.'); return; } generarBrief(true); });

  // Registra el service worker (cache offline). Solo existe en http/https,
  // por eso el "if": abriendo el archivo con doble clic (file://) no corre.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW no registrado:', e));
  }
})();
