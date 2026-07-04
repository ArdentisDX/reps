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

  load();
  render();

  // Registra el service worker (cache offline). Solo existe en http/https,
  // por eso el "if": abriendo el archivo con doble clic (file://) no corre.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW no registrado:', e));
  }
})();
