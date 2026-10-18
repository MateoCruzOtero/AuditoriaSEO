# Prospector SEO (MVP)

Escribís el sitio web de un posible cliente y en un minuto obtenés:

1. **Un diagnóstico para mostrarle**: visitas desde Google, comparación con hasta 3 competidores, las búsquedas donde la competencia aparece y él no, y una revisión técnica del sitio. Se descarga como PDF con tu marca.
2. **Los mensajes de contacto** (email y LinkedIn) escritos por IA a partir de esos hallazgos, listos para copiar.
3. **El costo de cada informe**, para controlar el margen de la suscripción.

Los datos SEO vienen de [DataForSEO](https://dataforseo.com) (la misma fuente que usa [open-seo](https://github.com/every-app/open-seo)) y los textos los escribe Claude.

## Cómo correrlo en tu compu

Necesitás [Node.js 22](https://nodejs.org) o más nuevo.

```bash
npm install
cp .env.example .env.local   # después completá las claves (ver abajo)
npm run dev
```

Abrí http://localhost:3000.

**Sin claves también funciona**: arranca en *modo demo*, con datos de ejemplo y textos de plantilla. Sirve para probar la app y mostrársela a tu jefe sin gastar plata.

## Claves (archivo `.env.local`)

| Variable | Para qué | Dónde se consigue |
|---|---|---|
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Datos reales de Google | https://app.dataforseo.com/api-access (cargás saldo, se paga por uso) |
| `ANTHROPIC_API_KEY` | Diagnóstico y mensajes escritos por IA | https://console.anthropic.com/settings/keys |
| `AGENCY_NAME` / `AGENCY_CONTACT` | Tu marca en los informes | Lo que quieras |

Podés activarlas de a una. Por ejemplo, con DataForSEO y sin Claude obtenés datos reales con textos de plantilla.

## Cómo está organizado el código

```
app/
  page.tsx                 Pantalla principal: formulario + historial
  reports/[id]/page.tsx    El informe (lo que ve el cliente + mensajes internos)
  api/reports/route.ts     Recibe el formulario, valida y genera el informe
lib/
  analyze.ts               ⭐ El corazón: junta todo en orden
  dataforseo.ts            Llamadas a DataForSEO (+ datos de ejemplo del modo demo)
  site-audit.ts            Auditoría gratis del HTML de la página principal
  ai.ts                    Pedido a Claude (+ plantilla si no hay clave)
  db.ts                    Guarda los informes en SQLite (data/prospector.db)
  types.ts                 La forma de los datos de un informe
components/                Botones y formulario (partes interactivas)
```

Si querés cambiar **qué dice** el informe, editá el `SYSTEM_PROMPT` en `lib/ai.ts`. Si querés cambiar **qué datos** se buscan, editá `lib/analyze.ts`.

## Cuánto cuesta cada informe

Cada informe hace 2 + 2×(cantidad de competidores) llamadas a DataForSEO (una más si los competidores se buscan solos), más una llamada a Claude. El costo exacto queda guardado y se ve al final de cada informe y en el historial. **Generá 5 o 10 informes reales y mirá el promedio**: con ese número fijás los precios de los planes. La regla de oro es que el costo sea menos del 20% de lo que cobrás.

## Limitaciones conocidas (es un MVP)

- No tiene login: cualquiera que abra la URL ve todos los informes. Usalo en tu compu o detrás de una contraseña hasta agregar cuentas de usuario.
- La auditoría técnica solo mira la página principal.
- SQLite guarda todo en un archivo. Para publicarlo usá un hosting con disco persistente (Railway, Render, un VPS); en Vercel los datos se borran.
- El análisis tarda alrededor de un minuto y la pantalla espera sin barra de progreso.

## Próximos pasos sugeridos

1. Probarlo con 5 prospectos reales y medir respuestas y costo.
2. Login y planes (por ejemplo con Clerk + Stripe) para venderlo como suscripción.
3. Carga en lote: subir una lista de dominios (CSV) y generar todos los informes.
4. Informe mensual automático para clientes actuales (retención).
