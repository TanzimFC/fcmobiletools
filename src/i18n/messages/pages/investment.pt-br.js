export default {
  meta: {
    title: 'Calculadora de Investimento do FC Mobile | Lucro e ROI | FCMOBILETOOLS',
    description: 'Calcule o lucro de investimento no FC Mobile, a taxa do mercado, o preço de venda de equilíbrio, o ROI e o preço de venda alvo a partir do preço de compra, da quantidade e do preço de venda esperado.'
  },
  hero: {
    kicker: 'FC MOBILE / LABORATÓRIO DE MERCADO', badge: 'CALCULADORA AO VIVO',
    h1a: 'Saiba o ', h1em: 'retorno real', h1b: 'antes de investir',
    lede: 'Simule um investimento em carta de jogador já com a taxa de venda incluída. Veja suas moedas líquidas, o lucro, o ROI e o preço de venda exato para empatar.',
    pointTaxB: '10%', pointTax: 'taxa de mercado padrão', pointNetB: 'LÍQUIDO', pointNet: 'retorno após a taxa', pointLiveB: 'AO VIVO', pointLive: 'recálculo instantâneo',
    metricAria: 'Prévia da calculadora de investimento', netReturn: 'RETORNO LÍQUIDO', breakEven: 'EQUILÍBRIO'
  },
  calc: {
    eyebrow: '01 / ANALISADOR DE INVESTIMENTO', title: 'Simule a negociação',
    lead: 'Digite os valores de mercado que você realmente está considerando. Tudo se atualiza enquanto você digita.',
    taxChip: 'TAXA DE MERCADO',
    buy: 'PREÇO DE COMPRA', sell: 'PREÇO DE VENDA', perCard: 'POR CARTA', qty: 'QUANTIDADE', cards: 'CARTAS', tax: 'TAXA DE MERCADO', percent: 'PORCENTAGEM',
    targetQ: 'QUER UM LUCRO ALVO?', targetHelp: 'Use números normais ou abreviações como 750K, 12.5M ou 1.25B.', coins: 'moedas'
  },
  result: {
    label: 'LUCRO PROJETADO', afterTax: 'após {rate} de taxa de mercado', pill: 'LUCRATIVO',
    totalCost: 'CUSTO TOTAL', netSale: 'VENDA LÍQUIDA', taxPaid: 'TAXA PAGA', roi: 'ROI',
    formula: 'FÓRMULA: VENDA LÍQUIDA − CUSTO TOTAL = LUCRO', reset: 'REDEFINIR CÁLCULO ↺'
  },
  insight: {
    breakEven: 'EQUILÍBRIO', breakEvenText: 'Preço de venda mínimo por carta para recuperar o preço de compra depois da taxa de mercado selecionada.', breakEvenMove: 'VARIAÇÃO DE PREÇO NECESSÁRIA',
    target: 'PREÇO DE VENDA ALVO', targetText: 'Preço de venda por carta necessário para atingir o lucro alvo após a taxa.', yourTarget: 'SEU ALVO',
    exposure: 'CAPITAL EM RISCO', exposureText: 'Total de moedas comprometidas nesta posição antes de qualquer venda.', quantity: 'QUANTIDADE'
  },
  explain: {
    eyebrow: '02 / ENTENDA A NEGOCIAÇÃO', h2a: 'Lucro não é o', h2em: 'preço anunciado',
    text: 'A taxa de mercado é descontada da venda. Esta calculadora trabalha com o dinheiro que você realmente recebe, não com o preço de vitrine.',
    flow: [
      { s: 'COMPRA', d: 'Seu custo total de aquisição' },
      { s: 'VENDA', d: 'Valor bruto da venda no mercado' },
      { s: 'APÓS A TAXA', d: 'Moedas que voltam para você' },
      { s: 'RETORNO', d: 'Lucro real da posição' }
    ]
  },
  reference: {
    eyebrow: '03 / REFERÊNCIA RÁPIDA', title: 'Matemática útil do mercado', lead: 'Tenha estas relações em mente ao avaliar um investimento em cartas.',
    items: [
      { b: 'Multiplicador de equilíbrio', d: 'Com 10% de taxa, sua venda precisa ficar 11.1% acima do preço de compra para empatar.' },
      { b: 'Margem de lucro', d: 'Lucro medido sobre as moedas líquidas recebidas na venda.' },
      { b: 'Variação de preço', d: 'Mudança do preço de compra até o preço de venda bruto esperado.' }
    ]
  },
  faq: {
    eyebrow: '04 / FAQ', title: 'Perguntas frequentes sobre a Calculadora de Investimento do FC Mobile',
    items: [
      { q: 'A calculadora inclui a taxa de mercado?', a: 'Sim. O padrão é 10% e você pode alterar o campo de taxa se o valor no jogo mudar. Lucro e ROI são calculados a partir da venda líquida, após a taxa.' },
      { q: 'O que é o preço de venda de equilíbrio?', a: 'É o menor preço de venda bruto que devolve todo o custo da compra depois da taxa. Com 10% de taxa, vender pelo mesmo preço que você pagou geraria prejuízo.' },
      { q: 'Posso calcular um investimento com várias cartas?', a: 'Sim. Informe o número de cartas em Quantidade. Custo total, valor da venda, taxa, retorno líquido e lucro são multiplicados para toda a posição.' },
      { q: 'Isso prevê se uma carta vai subir?', a: 'Não. Ele calcula o resultado financeiro dos preços que você informa. Movimento do mercado, oferta, demanda e liquidez ainda determinam se a venda alvo será realmente alcançada.' }
    ]
  },
  ui: {
    roi: '{n}% de ROI',
    status: { profit: 'LUCRATIVO', loss: 'PREJUÍZO', even: 'EMPATE' },
    qtyOne: '{n} CARTA', qtyMany: '{n} CARTAS'
  }
};
