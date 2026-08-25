import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

const COMBO_MARKER = 'mixmatch-corona';
const REQUIRED_LINES = 3;
const TARGET_PRICE = 300000;

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
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

  const groups = new Map();
  for (const line of input.cart.lines) {
    const marker = line.comboMarker?.value;
    const comboId = line.comboId?.value;
    if (marker !== COMBO_MARKER || !comboId) continue;
    if (!groups.has(comboId)) groups.set(comboId, []);
    groups.get(comboId).push(line);
  }

  const candidates = [];

  for (const lines of groups.values()) {
    const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (lines.length !== REQUIRED_LINES || totalQty !== REQUIRED_LINES) {
      continue;
    }

    const originalTotal = lines.reduce(
      (sum, line) => sum + Number(line.cost.subtotalAmount.amount),
      0,
    );
    const discountTotal = originalTotal - TARGET_PRICE;
    if (discountTotal <= 0) continue;

    let remaining = discountTotal;
    lines.forEach((line, index) => {
      const lineSubtotal = Number(line.cost.subtotalAmount.amount);
      let lineDiscount;
      if (index === lines.length - 1) {
        lineDiscount = Math.round(remaining * 100) / 100;
      } else {
        lineDiscount = Math.round(((lineSubtotal / originalTotal) * discountTotal) * 100) / 100;
        remaining -= lineDiscount;
      }
      if (lineDiscount <= 0) return;

      candidates.push({
        message: 'Mix & Match — precio fijo $300.000',
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
