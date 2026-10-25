// Investment calculator. English is copied verbatim from the original page.
export default {
  meta: {
    title: 'FC Mobile Investment Calculator | Profit & ROI Calculator | FCMOBILETOOLS',
    description: 'Calculate FC Mobile investment profit, market tax, break-even sell price, ROI and target sell price from your buy price, quantity and expected sale price.'
  },
  hero: {
    kicker: 'FC MOBILE / MARKET LAB', badge: 'LIVE CALCULATOR',
    h1a: 'Know the ', h1em: 'real return', h1b: 'before you invest',
    lede: 'Model a player-card investment with the sale tax included. See your net coins, profit, ROI and the exact sell price needed to break even.',
    pointTaxB: '10%', pointTax: 'default market tax', pointNetB: 'NET', pointNet: 'after-tax returns', pointLiveB: 'LIVE', pointLive: 'instant recalculation',
    metricAria: 'Investment calculator preview', netReturn: 'NET RETURN', breakEven: 'BREAK-EVEN'
  },
  calc: {
    eyebrow: '01 / INVESTMENT ANALYZER', title: 'Run the deal',
    lead: 'Enter the market numbers you are actually considering. Everything updates as you type.',
    taxChip: 'MARKET TAX',
    buy: 'BUY PRICE', sell: 'SELL PRICE', perCard: 'PER CARD', qty: 'QUANTITY', cards: 'CARDS', tax: 'MARKET TAX', percent: 'PERCENT',
    targetQ: 'WANT A TARGET PROFIT?', targetHelp: 'Use normal numbers or shorthand such as 750K, 12.5M or 1.25B.', coins: 'coins'
  },
  result: {
    label: 'PROJECTED PROFIT', afterTax: 'after {rate} market tax', pill: 'PROFITABLE',
    totalCost: 'TOTAL COST', netSale: 'NET SALE', taxPaid: 'TAX PAID', roi: 'ROI',
    formula: 'FORMULA: NET SALE − TOTAL COST = PROFIT', reset: 'RESET CALCULATION ↺'
  },
  insight: {
    breakEven: 'BREAK-EVEN', breakEvenText: 'Minimum sell price per card to recover your buy price after the selected market tax.', breakEvenMove: 'PRICE MOVE REQUIRED',
    target: 'TARGET SELL PRICE', targetText: 'Sell price per card needed to reach your target profit after tax.', yourTarget: 'YOUR TARGET',
    exposure: 'CAPITAL AT RISK', exposureText: 'Total coins committed to this position before any sale happens.', quantity: 'QUANTITY'
  },
  explain: {
    eyebrow: '02 / READ THE DEAL', h2a: 'Profit is not the', h2em: 'listing price',
    text: 'The market tax is taken from the sale. This calculator works from the money you actually receive, not the headline market price.',
    flow: [
      { s: 'BUY', d: 'Your total acquisition cost' },
      { s: 'SELL', d: 'Gross market sale value' },
      { s: 'AFTER TAX', d: 'Coins that come back to you' },
      { s: 'RETURN', d: 'Actual profit on the position' }
    ]
  },
  reference: {
    eyebrow: '03 / QUICK REFERENCE', title: 'Useful market math', lead: 'Keep these relationships in mind when you are checking a card investment.',
    items: [
      { b: 'Break-even multiplier', d: 'At 10% tax, your sale needs to be 11.1% above the buy price to break even.' },
      { b: 'Profit margin', d: 'Profit measured against the net coins received from the sale.' },
      { b: 'Price movement', d: 'Change from your buy price to your expected gross sell price.' }
    ]
  },
  faq: {
    eyebrow: '04 / FAQ', title: 'FC Mobile Investment Calculator FAQ',
    items: [
      { q: 'Does the calculator include market tax?', a: 'Yes. The default is 10%, and you can change the tax field if the in-game rate changes. Profit and ROI are calculated from the net sale after tax.' },
      { q: 'What is the break-even sell price?', a: 'It is the lowest gross sale price that returns your full purchase cost after tax. At a 10% tax rate, selling at the same price you bought for would create a loss.' },
      { q: 'Can I calculate an investment with multiple cards?', a: 'Yes. Enter the number of cards in Quantity. Total cost, sale value, tax, net return and profit are scaled across the whole position.' },
      { q: 'Does this predict whether a card will rise?', a: 'No. It calculates the financial outcome of the prices you enter. Market movement, supply, demand and liquidity still determine whether a target sale is actually reached.' }
    ]
  },
  ui: {
    roi: '{n}% ROI',
    status: { profit: 'PROFITABLE', loss: 'LOSS', even: 'BREAK EVEN' },
    qtyOne: '{n} CARD', qtyMany: '{n} CARDS'
  }
};
