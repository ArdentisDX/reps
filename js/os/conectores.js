/* ===== REPS OS · Conectores =====
   Catálogo de las apps externas que alimentan el Life OS (WHOOP, Google
   Calendar, YouTube, TikTok, Shopify, IA local). Cada conector declara QUÉ
   trae, CÓMO se conecta y en qué FASE entra.

   Arquitectura (para la Fase 2):
   - Las llaves/tokens de cada servicio NUNCA viven en este archivo (GitHub
     Pages entrega el código a cualquiera). Viven como secretos en el Worker
     de Cloudflare que ya existe (reps-push), igual que la llave de la IA.
   - El Worker consulta la API del servicio y devuelve un resumen pequeño.
   - La app guarda ese resumen en `reps-cx` = {id: {datos, actualizado}}:
     así las tarjetas siguen mostrando el último dato SIN internet
     (offline-first, regla 1 del proyecto).
   Hoy (Fase 1) solo existe el catálogo y la lectura del caché: ninguna
   tarjeta inventa números; si no hay datos, muestra "Conectar".
*/
(function(){
  'use strict';
  const CX_KEY = 'reps-cx';

  // icono = trazo SVG simple (24×24), sin logos de marca
  const CONECTORES = [
    { id:'whoop', nombre:'WHOOP', area:'Salud', fase:2, color:'#8fe3c0',
      trae:'Recuperación, sueño, esfuerzo y variabilidad cardiaca',
      como:'API oficial de WHOOP (inicio de sesión con tu cuenta) a través de tu Worker',
      icono:'<path d="M3 12h4l2-6 4 12 2-6h6"/>' },
    { id:'calendar', nombre:'Google Calendar', area:'Agenda', fase:2, color:'#a9dbf5',
      trae:'Tus eventos de hoy y de la semana, junto a tu rutina',
      como:'Inicio de sesión con Google (solo lectura del calendario)',
      icono:'<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/>' },
    { id:'youtube', nombre:'YouTube', area:'Contenido', fase:2, color:'#ffc4c4',
      trae:'Vistas, suscriptores y retención de tu canal',
      como:'YouTube Analytics API con tu cuenta de Google',
      icono:'<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z"/>' },
    { id:'tiktok', nombre:'TikTok', area:'Contenido', fase:2, color:'#9ff3f0',
      trae:'Vistas y seguidores de tus videos',
      como:'API para creadores de TikTok (da menos datos que YouTube)',
      icono:'<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.5 2.6 2.2 4 5 4.3"/>' },
    { id:'shopify', nombre:'Shopify', area:'Negocio', fase:2, color:'#ffcfb0',
      trae:'Ventas, pedidos y productos más vendidos',
      como:'App privada de tu tienda (token de solo lectura en el Worker)',
      icono:'<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' },
    { id:'ia-local', nombre:'IA en tu Mac', area:'IA', fase:3, color:'#cfc8ff',
      trae:'Un asistente que lee todos tus datos sin que salgan de tu casa',
      como:'Ollama o LM Studio corriendo un modelo en tu computadora',
      icono:'<path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/>' },
  ];

  // caché local de lo último que trajo cada conector (lectura defensiva:
  // un localStorage corrupto nunca rompe la app — regla de oro 1)
  function cache(){
    try{
      const v = JSON.parse(localStorage.getItem(CX_KEY));
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    }catch(e){ return {}; }
  }
  function datos(id){
    const c = cache()[id];
    return (c && c.datos && typeof c.datos === 'object') ? c : null;
  }

  window.REPS_OS = window.REPS_OS || {};
  window.REPS_OS.conectores = {
    lista: () => CONECTORES.slice(),
    get: (id) => CONECTORES.find(c => c.id === id) || null,
    datos,                         // {datos, actualizado} o null
    conectado: (id) => !!datos(id),
    icono: (id, size) => {
      const c = CONECTORES.find(x => x.id === id);
      const s = size || 18;
      return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (c ? c.icono : '') + '</svg>';
    },
  };
})();
