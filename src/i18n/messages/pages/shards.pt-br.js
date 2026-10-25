export default {
  meta: { title: 'Contador de Shards do FC Mobile', description: 'Acompanhe seus Star Shards do FC Mobile, defina uma meta e veja exatamente quantos faltam.' },
  hero: {
    eyebrow: 'FC MOBILE / LABORATÓRIO DE SHARDS', h1a: 'Contador de ', h1em: 'Shards',
    points: ['Contador ao vivo', 'Metas predefinidas', 'Salva neste navegador'],
    balance: 'Saldo atual', progress: 'Progresso'
  },
  counter: {
    label: 'ACOMPANHAMENTO DE SHARDS', title: 'Acompanhe sua próxima recompensa',
    lead: 'Escolha uma meta predefinida no painel de administração ou digite a sua própria.',
    inputsAria: 'Campos de Shards', preset: 'META PREDEFINIDA', custom: 'Meta personalizada', target: 'SHARDS DA META', targetPh: 'Digite a meta',
    current: 'SHARDS ATUAIS', daily: 'TAXA DIÁRIA', optional: 'opcional',
    quickAdd: 'ADIÇÃO RÁPIDA', quickHint: 'Some shards conforme você os ganha', minus: '−1 shard', reset: 'Zerar contador'
  },
  result: {
    remaining: 'FALTAM', target: 'META', current: 'ATUAL', over: 'ACIMA DA META', days: 'DIAS RESTANTES',
    statusTitle: 'Defina uma meta', statusDetail: 'Adicione uma meta predefinida ou digite quantos shards você quer alcançar.',
    footer: 'CONTADOR DO JOGADOR', clear: 'LIMPAR DADOS SALVOS ↺'
  },
  guide: {
    eyebrow: 'COMO FUNCIONA', h2a: 'Contador simples. ', h2em: 'Meta clara.',
    lead: 'As metas predefinidas são mantidas pelo painel de administração do site, enquanto seu saldo fica salvo apenas no seu navegador.',
    cards: [
      { t: 'Defina sua meta', d: 'Escolha uma meta predefinida pelo administrador ou digite qualquer meta de shards.' },
      { t: 'Conte o que você ganha', d: 'Digite seu saldo atual ou use os botões de adição rápida enquanto joga.' },
      { t: 'Saiba a diferença', d: 'O contador mostra os shards restantes, o progresso e, opcionalmente, os dias até a meta.' }
    ]
  },
  ui: {
    custom: 'Meta personalizada', enterTarget: 'Digite uma meta para começar', setTarget: 'Defina uma meta',
    pickPreset: 'Escolha uma meta predefinida ou digite a sua própria meta de shards.', enterNumber: 'Digite quantos shards você quer alcançar.',
    over: '{n} acima da meta', reached: 'Meta atingida', secured: 'Meta garantida',
    securedDetail: 'Você tem shards suficientes para esta meta, com folga.', reachedDetail: 'Você atingiu a meta de shards selecionada.',
    remaining: 'faltam {n}', keepGoing: 'Continue assim',
    daysOne: 'No seu ritmo diário, falta cerca de {n} dia.', daysMany: 'No seu ritmo diário, faltam cerca de {n} dias.',
    quickHint: 'Use os botões de adição rápida conforme ganha mais shards.'
  }
};
