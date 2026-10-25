// Português (Brasil). Termos do jogo (Team OVR, PlayStyle, Rank Up, Gauntlet, Star Shards,
// Football Centre) ficam em inglês, como no próprio FC Mobile.
import redeem from './pages/redeem.pt-br.js';
import consent from './pages/consent.pt-br.js';
import investment from './pages/investment.pt-br.js';
import shards from './pages/shards.pt-br.js';

export default {
  redeem,
  consent,
  investment,
  shards,
  common: {
    skipToContent: 'Ir para o conteúdo',
    home: 'Início',
    homeMeta: 'Comece aqui',
    free: 'Grátis',
    mostPopular: 'Mais popular',
    openPage: 'Abrir página',
    more: 'Mais',
    update: 'Atualização',
    codes: 'Códigos',
    events: 'Eventos',
    account: 'Conta',
    login: 'Entrar',
    myProfile: 'Meu Perfil',
    myAccount: 'Minha Conta',
    accountProfile: 'Conta e Perfil',
    accountMeta: 'Identidade, progressão de XP e comunidade',
    profileMeta: 'Perfil, progressão e recompensas',
    levelShort: 'Nv. {n}',
    levelLong: 'Nível {n}',
    signInAria: 'Entrar na sua conta FCMobiletools',
    openProfileAria: 'Abrir seu perfil no FCMobiletools',
    homeAria: 'Página inicial do FCMobiletools',
    search: 'Buscar páginas',
    searchPlaceholder: 'Buscar ferramentas, eventos, códigos...',
    jumpAnywhere: 'Vá para qualquer lugar',
    noMatches: 'Nada encontrado. Tente “códigos”, “eventos” ou “atualização”.',
    primaryNav: 'Navegação principal',
    quickNav: 'Navegação rápida',
    siteMenu: 'Menu do site',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    accountMenu: {
      aria: 'Menu da conta',
      signedInAs: 'Conectado como',
      xp: 'XP',
      tokens: 'Tokens',
      streak: 'Sequência',
      streakDays: '{n} d',
      signOut: 'Sair',
      profile: 'Perfil', profileMeta: 'Seu cartão de jogador',
      quests: 'Missões', questsMeta: 'Diárias e semanais',
      surveys: 'Pesquisas', surveysMeta: 'Dê sua opinião',
      achievements: 'Conquistas', achievementsMeta: 'Emblemas e marcos',
      leaderboard: 'Ranking', leaderboardMeta: 'Melhores jogadores',
      rewards: 'Recompensas', rewardsMeta: 'Resgate e use',
      settings: 'Configurações', settingsMeta: 'Conta e privacidade'
    },
    accountNav: {
      breadcrumb: 'Trilha de navegação',
      account: 'Conta',
      sections: 'Seções da conta',
      guestLead: 'Conta opcional · ',
      guestCta: 'Entre ou cadastre-se →'
    }
  },
  nav: {
    groups: { tools: 'Ferramentas', live: 'Ao vivo', community: 'Comunidade' },
    update: { label: 'Atualização do FC Mobile 27', meta: 'Temporada 27 · 24 set', blurb: 'Mudanças da Temporada 27, guia de recursos e instalação oficial no Android.' },
    giveawaysSheetMeta: 'Ganhe prêmios. Verificado e seguro',
    items: {
      'team-ovr': { label: 'Team OVR', meta: 'Nota do elenco' },
      playstyle: { label: 'Guia de PlayStyles', meta: 'Habilidades dos jogadores' },
      'playstyle-finder': { label: 'Buscador de PlayStyle', meta: 'Seleção inteligente por função' },
      training: { label: 'Calculadora de Treino', meta: 'Planejador de XP' },
      rank: { label: 'Calculadora de Rank Up', meta: 'Custos de rank' },
      investment: { label: 'Calculadora de Investimento', meta: 'Planejamento de mercado' },
      gauntlet: { label: 'Planejador do Gauntlet', meta: 'Rodízio do elenco' },
      shards: { label: 'Contador de Shards', meta: 'Meta de Star Shards' },
      events: { label: 'Eventos', meta: 'Contagens regressivas' },
      codes: { label: 'Códigos de Resgate', meta: 'Últimas recompensas' },
      centre: { label: 'Football Centre', meta: 'Central ao vivo' },
      tracker: { label: 'Captain OVR Tracker', meta: 'Análise da Matchday 7' },
      trivia: { label: 'Trivia', meta: "Extra Time e A Nation's Story" },
      tournaments: { label: 'Torneios', meta: 'Competições da comunidade' },
      leagues: { label: 'Encontrar uma Liga', meta: 'Ache seu clube ou recrute jogadores' },
      giveaways: { label: 'Sorteios', meta: 'Ganhe prêmios. Entrada grátis' },
      articles: { label: 'Artigos', meta: 'Notícias, vazamentos, guias' }
    }
  },
  footer: {
    aria: { tools: 'Ferramentas', live: 'Ao vivo', articles: 'Artigos', legal: 'Informações e legal' },
    brand: 'Ferramentas de FC Mobile, recursos ao vivo, calculadoras e guias para manter tudo o que é útil em um só lugar.',
    note: 'Feito por fãs • Sem afiliação com o EA SPORTS FC Mobile.',
    built: 'Feito para a comunidade FC Mobile.',
    cols: { tools: 'FERRAMENTAS', live: 'AO VIVO', articles: 'ARTIGOS', legal: 'INFO E LEGAL' },
    links: {
      triviaAnswers: 'Respostas do Trivia',
      allArticles: 'Todos os artigos',
      updates: 'Atualizações',
      leaks: 'Vazamentos',
      guides: 'Guias',
      analysis: 'Análises',
      reviews: 'Reviews',
      about: 'Sobre',
      privacy: 'Privacidade',
      terms: 'Termos',
      disclaimer: 'Aviso legal',
      contact: 'Contato',
      privacyChoices: 'Opções de privacidade',
      pushAlerts: 'Alertas push'
    }
  },
  switcher: {
    label: 'Idioma',
    aria: 'Mudar idioma',
    title: 'Escolha seu idioma',
    subtitle: 'Páginas sem tradução abrem em inglês.',
    englishOnly: 'Só em inglês',
    current: 'Idioma atual'
  }
};
