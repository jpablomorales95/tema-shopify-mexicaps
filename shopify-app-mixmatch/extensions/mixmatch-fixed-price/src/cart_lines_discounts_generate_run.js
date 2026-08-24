// @ts-check
import { DiscountClass, ProductDiscountSelectionStrategy } from "../generated/api";

// Debe coincidir con el "combo_marker" configurado en el bloque Combo — Mix & Match
// del producto ancla (sections/drift-product-stack.liquid), y con el valor que
// assets/combo-widgets.js escribe en la line item property `_combo`.
const COMBO_MARKER = "mixmatch-corona";

// Piezas exactas que debe tener el set. Si el carrito trae menos, más, o
// cantidades distintas de 1 por línea para el mismo _combo_id, NO se aplica
// ningún descuento — así se evita que alguien manipule el carrito para
// pagar menos de $300.000 agregando/quitando líneas marcadas.
const REQUIRED_LINES = 3;

// Precio fijo del set, en la moneda de la tienda (COP). Cambiar aquí si el
// precio del combo cambia — requiere volver a desplegar la función
// (`shopify app deploy`).
const TARGET_PRICE = 300000;

/**
 * @param {import("../generated/api").CartLinesDiscountsGenerateRunInput} input
 * @returns {import("../generated/api").CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );
  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  // Agrupa las líneas del carrito marcadas como parte de un combo, por _combo_id
  // (un cliente podría llevar dos sets Mix & Match en el mismo pedido).
  const groups = new Map();
  for (const line of input.cart.lines) {
    const marker = line.comboMarker?.value;
    const comboId = line.comboId?.value;
    if (marker !== COMBO_MARKER || !comboId) continue;
    if (!groups.has(comboId)) groups.set(comboId, []);
    groups.get(comboId).push(line);
  }

  /** @type {any[]} */
  const candidates = [];

  for (const lines of groups.values()) {
    const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);

    // Caso borde: cualquier cosa distinta de exactamente 3 líneas x 1 unidad
    // se deja sin tocar (el cliente paga el precio normal de cada producto).
    if (lines.length !== REQUIRED_LINES || totalQty !== REQUIRED_LINES) {
      continue;
    }

    const originalTotal = lines.reduce(
      (sum, line) => sum + Number(line.cost.subtotalAmount.amount),
      0,
    );
    const discountTotal = originalTotal - TARGET_PRICE;

    // Si las 3 piezas elegidas ya suman igual o menos que el precio fijo,
    // no hay descuento que aplicar.
    if (discountTotal <= 0) continue;

    // Reparte el descuento proporcionalmente al precio de cada línea, sin que
    // ninguna línea reciba más descuento que su propio subtotal. La última
    // línea absorbe el remanente exacto para evitar drift por redondeo.
    let remaining = discountTotal;
    lines.forEach((line, index) => {
      const lineSubtotal = Number(line.cost.subtotalAmount.amount);
      let lineDiscount;
      if (index === lines.length - 1) {
        lineDiscount = Math.round(remaining * 100) / 100;
      } else {
        lineDiscount =
          Math.round(((lineSubtotal / originalTotal) * discountTotal) * 100) /
          100;
        remaining -= lineDiscount;
      }
      if (lineDiscount <= 0) return;

      candidates.push({
        message: "Mix & Match — precio fijo $300.000",
        targets: [{ cartLine: { id: line.id } }],
        value: { fixedAmount: { amount: lineDiscount } },
      });
    });
  }

  if (!candidates.length) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
