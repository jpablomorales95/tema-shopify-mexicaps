# Mix & Match Mexicaps — Discount Function

App custom (privada) que aloja la única pieza de este proyecto que **no** puede
vivir en el tema: la Discount Function que fuerza el subtotal de un combo
Mix & Match (3 gorras marcadas) a quedar en **$300.000 COP** exacto,
cualquiera sea la combinación elegida.

No requiere plan Shopify Plus ni suscripción — Shopify Functions corren gratis
en la infraestructura de Shopify una vez desplegadas.

## Qué hace la función

`extensions/mixmatch-fixed-price/src/cart_lines_discounts_generate_run.js`:

1. Agrupa las líneas del carrito por la line item property `_combo_id` (cada
   envío del selector Mix & Match genera un id único).
2. Dentro de cada grupo, exige que la property `_combo` valga exactamente
   `mixmatch-corona` y que haya **exactamente 3 líneas de 1 unidad cada una**.
   Si el conteo no cuadra (1, 2, 4+, o cantidades manipuladas), **no aplica
   ningún descuento** — el cliente paga el precio normal de cada producto.
3. Si cuadra, calcula `descuento = suma_de_los_3_subtotales - 300000` y lo
   reparte entre las 3 líneas (proporcional al precio de cada una, sin que
   ninguna reciba más descuento que su propio subtotal), de forma que el
   subtotal final de esas 3 líneas sea $300.000 exacto.

El marcador `_combo` y el precio fijo son constantes al inicio del archivo —
si cambian en el tema (bloque Combo — Mix & Match → "Marca del combo") o el
precio del combo cambia, hay que actualizarlas aquí y volver a desplegar.

## Requisitos antes de desplegar

- Node.js 18+ y [Shopify CLI](https://shopify.dev/docs/api/shopify-cli)
  (`npm install -g @shopify/cli` o usar `npx shopify`).
- Acceso de colaborador/owner a la tienda **mexicaps.co** (o a un Partner
  account con esa tienda vinculada) para crear/instalar la app custom.
- Este directorio (`shopify-app-mixmatch/`) — cloná el repo y `cd` aquí.

Este entorno (sesión en la nube) no tiene login interactivo de Shopify CLI,
así que estos pasos se corren desde tu máquina.

## Pasos de deploy

```bash
cd shopify-app-mixmatch
npm install

# 1. Vincula esta carpeta a una app en tu Partner Dashboard (crea una nueva
#    app custom si no existe una). Esto rellena client_id en shopify.app.toml.
npx shopify app config link

# 2. (Opcional pero recomendado) revisa/genera los tipos de la función a
#    partir del esquema real de tu tienda:
npx shopify app function typegen

# 3. Prueba localmente contra un carrito de prueba:
npx shopify app dev

# 4. Despliega la función a producción:
npx shopify app deploy
```

`shopify app deploy` compila `run.js` a WebAssembly y publica una nueva
versión de la extensión — no tiene costo recurrente.

## Activar el descuento en el admin

El deploy solo publica la función; hay que activarla como descuento:

1. **Shopify Admin → Configuración → Aplicaciones y canales de venta** →
   instala/activa la app custom (`mixmatch-mexicaps`) en la tienda si aún no
   quedó instalada tras el `deploy`.
2. **Shopify Admin → Descuentos → Crear descuento** → en la lista de tipos de
   descuento de apps, elegí **"Mix & Match — Fixed Price"**.
3. Dale un nombre interno (ej. "Mix & Match — precio fijo") y guardalo como
   **descuento automático** (no requiere código). No necesita configuración
   adicional: la lógica ya sabe qué marcar y qué precio aplicar.
4. Publicalo. A partir de ahí, cualquier carrito con 3 líneas marcadas
   `_combo: mixmatch-corona` bajo el mismo `_combo_id` recibe el ajuste de
   precio automáticamente, en carrito y en checkout.

## QA sugerido tras activar

- Armar el combo con 3 gorras de precios distintos → el subtotal en checkout
  debe quedar en $300.000 exacto.
- Repetirlo con otra combinación de 3 gorras → mismo resultado, $300.000.
- Manipular el carrito a mano (`/cart/add.js` con 2 o 4 líneas marcadas) →
  confirmar que NO se aplica ningún descuento sobre esas líneas.
- Confirmar que Shop Pay, códigos de descuento adicionales y el resto del
  checkout nativo siguen funcionando sin cambios.

## Nota sobre el scaffold

Este `shopify.extension.toml` y `package.json` reflejan la estructura pública
que usa Shopify para extensiones de Discount Function en JavaScript
(api_version 2026-01, target `cart.lines.discounts.generate.run`). Si tu CLI
instalada genera una estructura distinta al correr
`shopify app generate extension --template discount`, es más seguro dejar que
el CLI regenere `shopify.extension.toml`/`package.json`/`generated/` y pegar
ahí el contenido de `src/cart_lines_discounts_generate_run.js` y `.graphql`
de este repo — esa lógica (agrupar por `_combo_id`, exigir 3 líneas, prorratear
el descuento) es la parte que no cambia entre versiones del CLI.
