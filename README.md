# Radar de Competencia (MVP)

Para ver qué hace la competencia e igualarla antes de quedarse atrás. Tiene dos herramientas:

1. **Competencia** (pantalla principal): vigila las páginas de tus competidores (precios, promociones, servicios…). Muestra qué cambió con lo nuevo en verde y lo quitado en rojo. Una vez por semana, la IA arma un **resumen con qué hizo cada competidor y qué deberíamos hacer nosotros**.
2. **Prospectos**: diagnóstico SEO de un sitio contra sus competidores, con mensaje de contacto (ver más abajo).

La vigilancia la hace [changedetection.io](https://github.com/dgtlmoon/changedetection.io) (licencia Apache 2.0), que corre aparte. Esta app le dice qué páginas mirar, lee los cambios y se los pasa a Claude.

## Cómo correrlo en tu compu

Necesitás [Node.js 22](https://nodejs.org) o más nuevo.

```bash
npm install
cp .env.example .env.local   # después completá las claves (ver abajo)
npm run dev
```

Abrí http://localhost:3000.

**Sin claves también funciona**: arranca en *modo demo*, con cambios y datos de ejemplo. Sirve para mostrársela a tu jefe sin instalar nada más.

## Activar la vigilancia real (changedetection.io)

Necesitás [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d        # levanta changedetection en http://localhost:5000
```

1. Abrí http://localhost:5000 → **Settings → API** y copiá la *API key*.
2. En `.env.local` poné `CHANGEDETECTION_URL=http://localhost:5000` y `CHANGEDETECTION_API_KEY=<la clave>`.
3. Completá `COMPANY_DESCRIPTION` con una frase sobre tu empresa: la IA la usa para que las recomendaciones tengan sentido.
4. Reiniciá la app (`npm run dev`) y agregá competidores desde la pantalla principal.

Cómo funciona:
- Cuando agregás un competidor, cada página queda dada de alta en changedetection con el nombre del competidor como etiqueta.
- changedetection revisa las páginas cada 3 horas por defecto (se cambia en su *Settings*). La primera revisión guarda una "foto"; los cambios aparecen desde la segunda.
- **Avisos al instante (opcional):** completá `CHANGEDETECTION_NOTIFICATION_URLS` con una dirección de [Apprise](https://github.com/caronc/apprise/wiki) (email, Telegram, Slack, WhatsApp…) y changedetection avisa en cuanto algo cambie.
- **Resumen semanal automático:** poné una clave en `CRON_SECRET` y programá una llamada semanal (por ejemplo con cron-job.org) a `https://tu-app/api/digests?secret=<CRON_SECRET>`. También podés generarlo a mano con el botón.

**Qué páginas vigilar:** precios, promociones, la página de inicio y la de servicios/productos. Evitá páginas que cambian solas todo el tiempo (noticias, contadores), porque llenan el resumen de ruido. Desde la interfaz de changedetection podés filtrar una parte de la página si hace falta.

## Claves (archivo `.env.local`)

| Variable | Para qué | Dónde se consigue |
|---|---|---|
| `CHANGEDETECTION_URL` / `CHANGEDETECTION_API_KEY` | Vigilancia real de la competencia | Ver la sección anterior |
| `COMPANY_DESCRIPTION` | Que las recomendaciones apliquen a tu empresa | Una frase tuya |
| `ANTHROPIC_API_KEY` | Resumen y recomendaciones con IA (y textos de Prospectos) | https://console.anthropic.com/settings/keys |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Datos de Google para Prospectos | https://app.dataforseo.com/api-access (se paga por uso) |
| `AGENCY_NAME` / `AGENCY_CONTACT` | Tu marca en los informes | Lo que quieras |

Cada parte funciona aunque falten las demás: lo que no tiene clave usa datos de ejemplo.

## Prospectos

Escribís el sitio web de un posible cliente y en un minuto obtenés:

1. **Un diagnóstico para mostrarle**: visitas desde Google, comparación con hasta 3 competidores, las búsquedas donde la competencia aparece y él no, y una revisión técnica del sitio. Se descarga como PDF con tu marca.
2. **Los mensajes de contacto** (email y LinkedIn) escritos por IA a partir de esos hallazgos, listos para copiar.
3. **El costo de cada informe**, para controlar el margen de la suscripción.

Los datos SEO vienen de [DataForSEO](https://dataforseo.com) (la misma fuente que usa [open-seo](https://github.com/every-app/open-seo)) y los textos los escribe Claude.

## Cómo está organizado el código

```
app/
  page.tsx                 Competencia: cambios recientes, competidores y resúmenes
  resumenes/[id]/page.tsx  Un resumen semanal
  prospectos/page.tsx      Prospectos: formulario + historial
  reports/[id]/page.tsx    El informe de un prospecto
  api/                     competitors, digests, recheck, reports
lib/
  changedetection.ts       Conexión con changedetection.io
  monitor.ts               Junta los cambios de la semana (+ cambios de ejemplo)
  digest.ts                ⭐ Resumen semanal con IA: qué hicieron y qué igualar
  analyze.ts               ⭐ Diagnóstico de un prospecto
  dataforseo.ts            Llamadas a DataForSEO (+ datos de ejemplo del modo demo)
  site-audit.ts            Auditoría gratis del HTML de la página principal
  ai.ts                    Pedido a Claude para prospectos (+ plantilla si no hay clave)
  db.ts                    Guarda todo en SQLite (data/prospector.db)
  types.ts                 La forma de los datos de un informe
components/                Botones y formulario (partes interactivas)
```

Si querés cambiar el tono o el enfoque del resumen semanal, editá el `SYSTEM_PROMPT` de `lib/digest.ts`; el de los prospectos está en `lib/ai.ts`.

## Cuánto cuesta

- **Vigilancia:** changedetection es gratis si lo corrés vos. Cada resumen semanal es una llamada a Claude y su costo aparece al pie del resumen.
- **Prospectos:** cada informe hace 2 + 2×(cantidad de competidores) llamadas a DataForSEO (una más si los competidores se buscan solos), más una llamada a Claude. El costo exacto queda guardado y se ve al final de cada informe y en el historial. **Generá 5 o 10 informes reales y mirá el promedio**: con ese número fijás los precios de los planes. La regla de oro es que el costo sea menos del 20% de lo que cobrás.

## Limitaciones conocidas (es un MVP)

- No tiene login: cualquiera que abra la URL ve todos los informes. Usalo en tu compu o detrás de una contraseña hasta agregar cuentas de usuario.
- La auditoría técnica de Prospectos solo mira la página principal.
- La vigilancia mira el texto de las páginas, no las imágenes: un banner que es solo imagen no se detecta.
- SQLite guarda todo en un archivo. Para publicarlo usá un hosting con disco persistente (Railway, Render, un VPS); en Vercel los datos se borran.
- El análisis tarda alrededor de un minuto y la pantalla espera sin barra de progreso.

## Próximos pasos sugeridos

1. Cargar 3 a 5 competidores reales y dejarlo correr una semana.
2. Mandar el resumen por email automáticamente cada lunes.
3. Sumar al resumen los datos de Google (DataForSEO): si un competidor gana o pierde visitas, o empieza a aparecer en búsquedas nuevas.
4. Vigilar también redes sociales y anuncios de la competencia.
5. Login y planes para venderlo como suscripción a otras empresas.
