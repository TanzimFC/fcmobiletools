import { createClient } from '@supabase/supabase-js';

export const ACCOUNT_SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';

// Browser Auth uses the project's publishable key. This is the public client key
// intended for browser/mobile code and is supported by the current Supabase API-key model.
export const ACCOUNT_SUPABASE_CLIENT_KEY =
  'sb_publishable_twe_ZNKiHXUB4b_J_RjGEA_rPKZrqbr';

export const IDENTITY_CACHE_KEY = 'fcmobiletools-identity-cache-v1';

export const accountAuth = createClient(
  ACCOUNT_SUPABASE_URL,
  ACCOUNT_SUPABASE_CLIENT_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'fcmobiletools-auth-v1'
    }
  }
);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '20minutemail.com',
  'anonbox.net', 'bccto.me', 'burnermail.io', 'chacuo.net', 'Cock.li',
  'crazymailing.com', 'deadaddress.com', 'despam.it', 'disposeamail.com',
  'dispostable.com', 'dodgeit.com', 'dontreg.com', 'dropmail.me',
  'e4ward.com', 'emailondeck.com', 'emailtemporanea.com', 'emailtemporanea.net',
  'ephemail.net', 'fakeinbox.com', 'fakemail.fr', 'fakemailgenerator.com',
  'fastacura.com', 'filzmail.com', 'Freespam.com', 'generator.email',
  'getairmail.com', 'getnada.com', 'gishpuppy.com', 'grr.la',
  'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com',
  'incognitomail.org', 'inboxkitten.com', 'jetable.org', 'kasmail.com',
  'koszmail.pl', 'kurzepost.de', 'lifebyfood.com', 'lookugly.com',
  'lopl.co.cc', 'lr78.com', 'maileater.com', 'mailexpire.com',
  'mailcatch.com', 'maildrop.cc', 'mailforspam.com', 'mailfreeonline.com',
  'mailimate.com', 'mailin8r.com', 'mailinater.com', 'mailinator.com',
  'mailinator.net', 'mailinator.org', 'mailinator2.com', 'mailincubator.com',
  'mailismagic.com', 'mailnesia.com', 'mailnull.com', 'mailsac.com',
  'mailscrap.com', 'mailshell.com', 'mailsiphon.com', 'mailslite.com',
  'mailtemp.info', 'mailtothis.com', 'meltmail.com', 'mintemail.com',
  'mohmal.com', 'mt2014.com', 'mt2015.com', 'mytemp.email',
  'mytrashmail.com', 'nada.email', 'neomailbox.com', 'nervmich.net',
  'no-spam.ws', 'nobulk.com', 'noclickemail.com', 'nogmailspam.info',
  'nomail.xl.cx', 'nomail2me.com', 'nospam.ze.tc', 'nospam4.us',
  'nospamfor.us', 'nowmymail.com', 'objectmail.com', 'obobbo.com',
  'oneoffemail.com', 'onewaymail.com', 'oopi.org', 'ordinaryamerican.net',
  'owlpic.com', 'pookmail.com', 'pokemail.net', 'proxymail.eu',
  'putthisinyourspamdatabase.com', 'quickinbox.com', 'rcpt.at', 'recode.me',
  'recursor.net', 'regbypass.com', 'rmqkr.net', 'rppkn.com',
  'rtrtr.com', 's0ny.net', 'safe-mail.net', 'safetymail.info',
  'safetypost.de', 'sandelf.de', 'saynotospams.com', 'selfdestructingmail.com',
  'sendspamhere.com', 'sharklasers.com', 'shiftmail.com', 'shitmail.me',
  'shortmail.net', 'sibmail.com', 'skeefmail.com', 'slaskpost.se',
  'slopsbox.com', 'smellfear.com', 'snakemail.com', 'sneakemail.com',
  'sofimail.com', 'sofort-mail.de', 'sogetthis.com', 'soodonims.com',
  'spam.la', 'spam.su', 'spam4.me', 'spamavert.com',
  'spambob.com', 'spambob.net', 'spambob.org', 'spambog.com',
  'spambog.de', 'spambog.ru', 'spambox.info', 'spambox.irishspringrealty.com',
  'spambox.us', 'spamcannon.com', 'spamcannon.net', 'spamcero.com',
  'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com', 'spamcowboy.net',
  'spamcowboy.org', 'spamday.com', 'spamex.com', 'spamfree.eu',
  'spamfree24.com', 'spamfree24.de', 'spamfree24.eu', 'spamfree24.info',
  'spamfree24.net', 'spamfree24.org', 'spamgoes.in', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org', 'spamherelots.com', 'spamhereplease.com',
  'spamhole.com', 'spamify.com', 'spaminator.de', 'spamkill.info',
  'spaml.com', 'spaml.de', 'spammotel.com', 'spamobox.com',
  'spamoff.de', 'spamslicer.com', 'spamspot.com', 'spamthis.co.uk',
  'spamthisplease.com', 'spamtrail.com', 'spamtroll.net', 'speed.1s.fr',
  'supergreatmail.com', 'supermailer.jp', 'suremail.info', 'teewars.org',
  'teleworm.com', 'teleworm.us', 'temp-mail.com', 'temp-mail.de',
  'temp-mail.org', 'temp-mail.ru', 'tempail.com', 'tempalias.com',
  'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za', 'tempemail.com',
  'tempemail.net', 'tempinbox.co.uk', 'tempinbox.com', 'tempmail.co',
  'tempmail.com', 'tempmail.de', 'tempmail.eu', 'tempmail.it',
  'tempmail.net', 'tempmail.ninja', 'tempmail.us', 'tempmail2.com',
  'tempmailaddress.com', 'tempmaildemo.com', 'tempmailer.com', 'tempmailer.de',
  'tempmailo.com', 'tempomail.fr', 'temporarily.de', 'temporarioemail.com.br',
  'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com', 'temporaryinbox.com',
  'temporarymailaddress.com', 'tempthe.net', 'thankyou2010.com', 'thc.st',
  'thelimestones.com', 'thisisnotmyrealemail.com', 'thismail.net', 'throwam.com',
  'throwawayemailaddress.com', 'throwawaymail.com', 'tilien.com', 'tittbit.in',
  'tmail.ws', 'tmailinator.com', 'tmpmail.net', 'tmpmail.org',
  'toiea.com', 'tradermail.info', 'trash-amil.com', 'trash-mail.at',
  'trash-mail.com', 'trash-mail.de', 'trash2009.com', 'trashemail.de',
  'trashmail.at', 'trashmail.com', 'trashmail.de', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.ws', 'trashmailer.com',
  'trashymail.com', 'trashymail.net', 'trbvm.com', 'turual.com',
  'twinmail.de', 'tyldd.com', 'uggsrock.com', 'upliftnow.com',
  'uplipht.com', 'venompen.com', 'veryrealemail.com', 'viditag.com',
  'viewcastmedia.com', 'viewcastmedia.net', 'viewcastmedia.org', 'webm4il.info',
  'wegwerfadresse.de', 'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.net',
  'wegwerfmail.org', 'wetrainbayarea.com', 'wetrainbayarea.org', 'wh4f.org',
  'whyspam.me', 'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'wuzupmail.net', 'www.e4ward.com', 'www.gishpuppy.com',
  'www.mailinator.com', 'wwwnew.eu', 'xagloo.com', 'xemaps.com',
  'xents.com', 'xmaily.com', 'xoxy.net', 'yep.it',
  'yogamaven.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'ypmail.webarnak.fr.eu.org', 'yuurok.com', 'zehnminutenmail.de', 'zippymail.info',
  'zoaxe.com', 'zoemail.org'
]);

const TYPOSQUAT_EMAIL_DOMAINS = {
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com'
};

export function validateSignupEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { valid: false, message: 'Enter a valid email address that you permanently control.' };
  }
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return { valid: false, message: 'Enter a valid email address.' };
  }
  if (TYPOSQUAT_EMAIL_DOMAINS[domain]) {
    return {
      valid: false,
      message: `“@${domain}” looks like a typo. Did you mean @${TYPOSQUAT_EMAIL_DOMAINS[domain]}? Use an email you can permanently access.`
    };
  }
  if (local.includes('+')) {
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return {
        valid: false,
        message: 'Gmail “+” aliases (like name+tag@gmail.com) are not allowed. Please use your main Gmail address.'
      };
    }
    return {
      valid: false,
      message: 'Email “+” sub-addressing aliases are not accepted for registration. Use your primary email address.'
    };
  }
  if ((domain === 'gmail.com' || domain === 'googlemail.com') && (local.startsWith('.') || local.endsWith('.') || local.includes('..'))) {
    return {
      valid: false,
      message: 'Invalid Gmail format. Avoid leading, trailing, or consecutive dots.'
    };
  }
  if (
    DISPOSABLE_EMAIL_DOMAINS.has(domain) ||
    /(^|\.)(tempmail|trashmail|mailinator|guerrillamail|10minutemail|yopmail|throwaway|fakeinbox|sharklasers)\./i.test(domain)
  ) {
    return {
      valid: false,
      message: 'Temporary or disposable email services are not allowed. Use a permanent email address you will still have access to when verification is required.'
    };
  }
  return { valid: true, email };
}

export async function accountApi(path, options = {}) {
  const { data } = await accountAuth.auth.getSession();
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (data.session?.access_token) headers.set('authorization', 'Bearer ' + data.session.access_token);
  return fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
}

export function getCachedIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedIdentity(account) {
  try {
    if (!account || !account.username) return;
    const summary = {
      id: account.id || null,
      username: account.username,
      displayName: account.displayName || account.display_name || account.username,
      avatarUrl: account.avatarUrl || account.avatar_url || null,
      level: Number(account.level || 1),
      xp: Number(account.xp || 0),
      tokens: Number(account.tokens || 0),
      currentStreak: Number(account.currentStreak ?? account.current_streak ?? 0),
      longestStreak: Number(account.longestStreak ?? account.longest_streak ?? 0),
      emailConfirmed: Boolean(account.emailConfirmedAt || account.email_confirmed_at),
      state: account.state || 'active',
      updatedAt: Date.now()
    };
    localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(summary));
    window.dispatchEvent(new CustomEvent('fcmt:account-updated', { detail: summary }));
  } catch {}
}

export function clearCachedIdentity() {
  try {
    localStorage.removeItem(IDENTITY_CACHE_KEY);
    window.dispatchEvent(new CustomEvent('fcmt:account-updated', { detail: null }));
  } catch {}
}

export function computeLevelProgress(level = 1, xp = 0) {
  const lv = Math.max(1, Number(level) || 1);
  const currentXp = Math.max(0, Number(xp) || 0);
  // Visual progression indicator that adapts to any server-supplied level & XP
  const stepSize = lv * 250;
  const baseForLevel = Math.max(0, (lv - 1) * 200);
  const intoLevel = Math.max(0, currentXp - baseForLevel);
  const pct = currentXp === 0 ? 6 : Math.min(96, Math.max(8, Math.round((intoLevel % stepSize) / stepSize * 100)));
  return {
    level: lv,
    xp: currentXp,
    percent: pct
  };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
