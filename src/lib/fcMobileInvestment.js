/**
 * Pure FC Mobile market investment calculations
 * Market tax defaults to 10% and remains editable so the tool can adapt to game updates
 */
export const DEFAULT_MARKET_TAX = 10;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function calculateInvestment({ buyPrice, sellPrice, quantity = 1, taxRate = DEFAULT_MARKET_TAX, targetProfit = 0 }) {
  const buy = num(buyPrice);
  const sell = num(sellPrice);
  const qty = Math.max(1, Math.floor(num(quantity)));
  const tax = Math.min(100, Math.max(0, num(taxRate)));
  const target = num(targetProfit);

  const totalCost = buy * qty;
  const grossSale = sell * qty;
  const taxAmount = grossSale * (tax / 100);
  const netSale = grossSale - taxAmount;
  const profit = netSale - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const margin = netSale > 0 ? (profit / netSale) * 100 : 0;
  const breakEvenSell = tax >= 100 ? 0 : buy / (1 - tax / 100);
  const targetSell = tax >= 100 ? 0 : (buy + target / qty) / (1 - tax / 100);
  const priceChange = buy > 0 ? ((sell - buy) / buy) * 100 : 0;

  return {
    valid: buy > 0 && sell > 0,
    buy,
    sell,
    quantity: qty,
    taxRate: tax,
    targetProfit: target,
    totalCost,
    grossSale,
    taxAmount,
    netSale,
    profit,
    roi,
    margin,
    breakEvenSell,
    targetSell,
    priceChange,
  };
}

export function calculateTargetSell({ buyPrice, quantity = 1, taxRate = DEFAULT_MARKET_TAX, targetProfit = 0 }) {
  return calculateInvestment({ buyPrice, sellPrice: buyPrice, quantity, taxRate, targetProfit }).targetSell;
}
