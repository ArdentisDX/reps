# REPS OS · Guía para activar las conexiones

Esta guía activa **WHOOP, Google Calendar, YouTube, TikTok** (por tu Worker de
Cloudflare) y la **IA en tu computadora** (Ollama). Shopify llega cuando
exista la tienda.

Tiempo aproximado: 45–60 min la primera vez. Hazlo en tu **PC**.

Tu Worker: `https://reps-push.iivf-2806.workers.dev`

---

## Cómo funciona (en 4 líneas)

1. Cada servicio te pide permiso en su pantalla oficial (solo **lectura**).
2. Tu Worker guarda el acceso, **cifrado por una llave que solo tu dispositivo conoce**.
3. REPS le pide a tu Worker un **resumen** (no tus datos completos) y lo guarda en el teléfono.
4. Las llaves secretas de Google, WHOOP y TikTok viven en Cloudflare, **nunca en la app**.

---

## Paso 0 · Actualizar tu Worker (obligatorio, primero)

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → `reps-push`.
2. **Edit code** → borra todo → pega el contenido de `workers/push-worker.js` de este repo → **Deploy**.
3. **Settings → Variables and Secrets → Add** (tipo *Secret*):

| Nombre | Valor |
|---|---|
| `APP_URL` | `https://ardentisdx.github.io/reps/` |

> Tip: si prefieres, pídele a Claude Code en tu Mac: *"despliega workers/push-worker.js en mi Worker reps-push con wrangler"*.

Los demás secretos los agregas en cada paso de abajo.

---

## Paso 1 · Google (Calendar + YouTube)

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto llamado **REPS**.
2. **APIs y servicios → Biblioteca** → habilita estas 3:
   - Google Calendar API
   - YouTube Data API v3
   - YouTube Analytics API
3. **Pantalla de consentimiento de OAuth** (o *Google Auth Platform*):
   - Tipo: **Externo**. Nombre: `REPS`. Correo: el tuyo.
   - En **Público / Usuarios de prueba** agrega tu correo de Gmail.
   - ⚠️ **Publica la app** ("Publicar app" / *In production*). Si la dejas en
     "Prueba", Google corta el permiso **cada 7 días**. Al conectar verás un
     aviso de "app no verificada": es normal porque es tuya →
     *Configuración avanzada → Ir a REPS*.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **URI de redireccionamiento autorizados**:
     `https://reps-push.iivf-2806.workers.dev/cx/callback/google`
5. Copia el **ID de cliente** y el **Secreto** → agrégalos en Cloudflare:

| Nombre | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | el ID de cliente |
| `GOOGLE_CLIENT_SECRET` | el secreto |

> YouTube: al conectar, elige la cuenta (o la *cuenta de marca*) dueña de tu canal.

---

## Paso 2 · WHOOP

1. Entra a [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com) con tu cuenta de WHOOP.
2. Crea un equipo (si te lo pide) y luego **Create App**.
3. **Redirect URL**: `https://reps-push.iivf-2806.workers.dev/cx/callback/whoop`
4. **Scopes**: `read:recovery`, `read:sleep`, `read:cycles`, `read:profile`, `offline`.
5. Copia **Client ID** y **Client Secret** → Cloudflare:

| Nombre | Valor |
|---|---|
| `WHOOP_CLIENT_ID` | Client ID |
| `WHOOP_CLIENT_SECRET` | Client Secret |

---

## Paso 3 · TikTok

1. Entra a [developers.tiktok.com](https://developers.tiktok.com) → **Manage apps → Connect an app**.
2. Cambia a **Sandbox** (arriba) y agrega el producto **Login Kit** (Web).
   ("Display API" ya no existe como producto: sus permisos están en Scopes.)
3. **Scopes → Add scopes**: `user.info.basic`, `user.info.stats`, `video.list`.
   Si falta alguno, TikTok muestra "Hubo un problema… scope".
4. **Redirect URI** (Login Kit → Web):
   `https://reps-push.iivf-2806.workers.dev/cx/callback/tiktok`
5. Términos y Privacidad (`…/reps/terminos.html`, `…/reps/privacidad.html`) se
   verifican con *URL prefix* `https://ardentisdx.github.io/reps/`: el archivo
   `tiktok….txt` que da TikTok va en la raíz del repo (ya está subido).
   Si TikTok pide **verificar la URL del Worker**: elige *URL prefix*
   `https://reps-push.iivf-2806.workers.dev/`, descarga su archivo `tiktok….txt`,
   abre el archivo, copia TODO su contenido y guárdalo en Cloudflare como
   `TIKTOK_VERIFICACION`. Tu Worker lo sirve solo en esa dirección.
6. Mientras TikTok no apruebe tu app, usa **Sandbox** y agrega tu cuenta en
   *Target users*. (La revisión para producción puede tardar días; en
   Sandbox ya funciona para ti.)
7. Copia **Client key** y **Client secret** → Cloudflare:

| Nombre | Valor |
|---|---|
| `TIKTOK_CLIENT_KEY` | Client key |
| `TIKTOK_CLIENT_SECRET` | Client secret |

> TikTok no da vistas por día: REPS muestra las vistas de tus videos
> recientes y de los publicados esta semana.

---

## Paso 4 · Conectar desde REPS

En tu celular (o PC): **Más → Conexiones** (o *Ajustes → Conexiones*) →
**Conectar** en cada uno → acepta → regresas a REPS con "✓ conectado".

Cada dispositivo se conecta por separado (cada uno tiene su propia llave).
Los datos se actualizan solos al abrir la app (máx. cada 15 min) o con
**Actualizar ahora**.

---

## Paso 5 · IA en tu computadora (Ollama, en tu Mac)

1. Descarga e instala Ollama desde [ollama.com](https://ollama.com).
2. En Terminal descarga un modelo (cualquiera de estos):
   ```
   ollama pull llama3.2        # ligero, rápido
   ollama pull qwen2.5:7b      # mejor español, más pesado
   ```
3. Dale permiso a REPS para hablar con Ollama:
   ```
   launchctl setenv OLLAMA_ORIGINS "https://ardentisdx.github.io"
   ```
   Cierra Ollama (barra de menú → Quit) y ábrelo otra vez.
   ⚠️ Este permiso se borra al reiniciar la Mac: repite el comando.
4. En **Chrome de tu Mac** abre REPS → **Conexiones → IA en tu computadora →
   Configurar → Probar conexión**. Chrome pedirá permiso para acceder a tu
   **red local** → *Permitir*. Elige el modelo → **Guardar**.
5. Listo: en **Asistente IA** aparece la tarjeta para preguntarle. Lee el
   mismo contexto que la IA de la nube (hábitos, rutina, metas y tus apps
   conectadas), pero **nada sale de tu Mac**.

> Solo funciona en el navegador de la Mac donde corre Ollama (no en el celular).

---

## Si algo falla

| Mensaje en REPS | Qué hacer |
|---|---|
| "Primero hay que activar las conexiones en tu servidor" | Falta el Paso 0 (desplegar el Worker nuevo). |
| "falta configurar sus llaves en el Worker" | Falta el secreto de ese servicio en Cloudflare. |
| "cancelaste el permiso" | Vuelve a tocar Conectar y acepta. |
| "el servicio no entregó el acceso" | Revisa que la Redirect URI sea EXACTA (sin espacio ni `/` extra). |
| Google se desconecta cada semana | La app de Google sigue en "Prueba": publícala (Paso 1.3). |
| "⚠ HTTP 403…" en una conexión | Falta habilitar esa API en Google Cloud (Paso 1.2). |
| IA local: "No encontré Ollama" | ¿Ollama abierto? ¿Corriste el `launchctl` y reabriste Ollama? ¿Permitiste "red local" en Chrome? |
