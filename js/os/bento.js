/* ===== REPS OS · Hoy de REPS en Bento =====
   Viste la pestaña "Hoy" de REPS (la de hábitos) como tablero de recuadros
   y le agrega el recuadro del puntaje. Lo del Life OS (salud, dinero,
   creador, agenda, IA) vive en js/os/shell.js.

   Cómo encaja con el motor (js/app.js):
   - Lee datos SOLO por window.REPS y se repinta con REPS.on('render').
   - Las tarjetas viejas de Hoy NO se mueven ni se reescriben: el acomodo en
     retícula es 100% CSS (css/bento.css). Así ningún id ni listener se rompe.
   - Texto de usuario al DOM siempre con textContent.
*/
(function(){
  'use strict';
  const R = window.REPS;
  if(!R) return;
  const $ = id => document.getElementById(id);
  function el(tag, cls, txt){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(txt != null) e.textContent = txt;
    return e;
  }

  const hoy = $('p-hoy');
  if(!hoy) return;
  document.body.classList.add('bento');

  // Recuadro del puntaje (toca para ver Stats)
  const score = el('button', 'bt bt-hero'); score.type = 'button'; score.id = 'btScore';
  score.appendChild(el('span', 'bt-lbl', 'Puntaje de hoy'));
  const spark = el('span', 'bt-spark'); spark.setAttribute('aria-hidden', 'true');
  for(let i = 0; i < 7; i++) spark.appendChild(el('i'));
  const num = el('span', 'bt-num bt-xl', '—');
  const foot = el('span', 'bt-foot', '');
  score.append(spark, num, foot);
  score.addEventListener('click', () => { const t = document.querySelector('.tab[data-panel="p-stats"]'); if(t) t.click(); });
  hoy.appendChild(score);

  function pintar(){
    const H = R.hoy();
    if(H.descanso){ num.textContent = '·'; foot.textContent = 'Hoy es descanso'; }
    else {
      num.textContent = String(H.puntaje == null ? 0 : H.puntaje);
      // el día va en curso: el promedio es referencia, no juicio
      foot.textContent = H.promedio7 == null ? H.core.hechos + ' de ' + H.core.total + ' innegociables' : 'Promedio de 7 días: ' + H.promedio7;
    }
    score.classList.toggle('ganado', H.ganado);
    H.semana.forEach((d, i) => {
      const b = spark.children[i];
      b.style.height = d.puntaje == null ? '10%' : Math.max(8, d.puntaje) + '%';
      b.className = (d.puntaje == null ? 'rest' : '') + (d.hoy ? ' hoy' : '');
    });
  }
  R.on('render', pintar);

  // color de los recuadros según el tema: claro/oscuro por la luz del fondo,
  // héroe lima en los temas Bento y el acento en los demás
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
})();
