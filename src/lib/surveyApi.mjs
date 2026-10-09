// Survey routes for the FCMobiletools Worker.
//
// Member routes live under /api/account/surveys and are called from accountApi()
// in worker.mjs after the user has been authenticated.
// Admin routes live under /api/admin/surveys and are called from the admin gate
// in worker.mjs after the admin session has been checked.
//
// All data work happens in Postgres functions (see
// supabase/migrations/20261009120000_survey_system.sql). This file only checks the
// shape of the request, calls the function and turns database errors into
// readable responses.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const MAX_BODY_CHARS = 120000;

// Messages raised by our own SQL functions. Anything else is treated as an
// infrastructure problem and is not shown to the user.
const FRIENDLY_ERROR = new RegExp([
  'honesty notice',
  'already completed',
  'response limit',
  'not open',
  'has closed',
  'not opened',
  'no longer open',
  'closed before',
  'cannot take surveys',
  'Account not found',
  'survey session',
  'needs an answer',
  'invalid answer',
  'allows at most',
  'limited to',
  'real answer',
  'could not be read',
  'do not match',
  'too quick',
  'Answer at least',
  'reward system is not configured',
  'Survey not found',
  'cannot be deleted',
  'cannot go back to draft',
  'Anonymity cannot',
  'already used',
  'Add at least one question',
  'slug needs',
  'title needs',
  'description is limited',
  'intro is limited',
  'Rewards must be',
  'response limit must',
  'Minimum time',
  'end time must',
  'Question \\d+',
  'at most 30 questions',
  'Questions are missing',
  'Survey details are missing',
  'Invalid survey status'
].join('|'), 'i');

class SurveyInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function errorStatus(message) {
  if (/not found|could not find your survey session/i.test(message)) return 404;
  if (/already completed|response limit|not open|has closed|no longer open|closed before|not opened|already used|session expired|survey session expired/i.test(message)) return 409;
  if (/too quick/i.test(message)) return 422;
  if (/cannot take surveys|Account not found/i.test(message)) return 403;
  return 400;
}

function failure(json, error, tag, { exposeAll = false } = {}) {
  const message = String(error?.message || '');
  if (error instanceof SurveyInputError) return json({ error: message }, error.status);
  if (exposeAll || FRIENDLY_ERROR.test(message)) {
    return json({ error: message || 'Request failed.' }, errorStatus(message));
  }
  console.error('[' + tag + ']', message);
  return json({ error: 'Surveys are temporarily unavailable. Please try again soon.' }, 503);
}

async function readJson(request) {
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_CHARS) throw new SurveyInputError('That request is too large.', 413);
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new SurveyInputError('That request could not be read.');
  }
}

function rpc(supabaseRest, env, name, args) {
  return supabaseRest(env, 'rpc/' + name, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(args)
  });
}

function cleanAnswerValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 2100);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.length <= 12 && value.every((x) => typeof x === 'string' && x.length <= 40)) {
    return value;
  }
  throw new SurveyInputError('Your answers could not be read.');
}

export function cleanAnswers(raw) {
  if (!Array.isArray(raw) || raw.length > 60) throw new SurveyInputError('Your answers could not be read.');
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new SurveyInputError('Your answers could not be read.');
    return {
      questionId: String(entry.questionId || ''),
      value: cleanAnswerValue(entry.value)
    };
  });
}

// ---------------------------------------------------------------------------
// Member routes
// ---------------------------------------------------------------------------

export async function accountSurveyRoutes({ request, env, url, context, supabaseRest, json }) {
  const path = url.pathname;
  if (path !== '/api/account/surveys' && !path.startsWith('/api/account/surveys/')) return null;

  const { account, user } = context;
  if (!user?.email_confirmed_at) {
    return json({ error: 'Please verify your email before taking surveys.' }, 403);
  }

  try {
    if (request.method === 'GET' && (path === '/api/account/surveys' || path === '/api/account/surveys/')) {
      const data = await rpc(supabaseRest, env, 'server_list_surveys', {
        p_account_id: account.id,
        p_slug: null
      });
      return json({
        surveys: Array.isArray(data?.surveys) ? data.surveys : [],
        summary: data?.summary || { completed: 0, xpEarned: 0, tokensEarned: 0 }
      });
    }

    const slugMatch = path.match(/^\/api\/account\/surveys\/([a-z0-9][a-z0-9-]{2,63})\/?$/);
    if (request.method === 'GET' && slugMatch) {
      const data = await rpc(supabaseRest, env, 'server_list_surveys', {
        p_account_id: account.id,
        p_slug: slugMatch[1]
      });
      const survey = Array.isArray(data?.surveys) ? data.surveys[0] : null;
      if (!survey) return json({ error: 'Survey not found.' }, 404);
      return json({ survey, summary: data?.summary || null });
    }

    const startMatch = path.match(/^\/api\/account\/surveys\/([^/]+)\/start\/?$/);
    if (request.method === 'POST' && startMatch) {
      if (!UUID_RE.test(startMatch[1])) throw new SurveyInputError('Survey not found.', 404);
      const body = await readJson(request);
      if (body.acknowledged !== true) {
        throw new SurveyInputError('Please confirm the honesty notice before starting.');
      }
      const data = await rpc(supabaseRest, env, 'server_start_survey', {
        p_account_id: account.id,
        p_survey_id: startMatch[1],
        p_ack: true
      });
      return json(data);
    }

    const submitMatch = path.match(/^\/api\/account\/surveys\/([^/]+)\/submit\/?$/);
    if (request.method === 'POST' && submitMatch) {
      if (!UUID_RE.test(submitMatch[1])) throw new SurveyInputError('Survey not found.', 404);
      const body = await readJson(request);
      const sessionId = String(body.sessionId || '');
      if (!UUID_RE.test(sessionId)) {
        throw new SurveyInputError('We could not find your survey session. Start the survey again.', 404);
      }
      const answers = cleanAnswers(body.answers);
      const data = await rpc(supabaseRest, env, 'server_submit_survey', {
        p_account_id: account.id,
        p_survey_id: submitMatch[1],
        p_session_id: sessionId,
        p_answers: answers
      });
      return json(data);
    }
  } catch (error) {
    return failure(json, error, 'ACCOUNT_SURVEYS');
  }

  return json({ error: 'Survey endpoint not found.' }, 404);
}

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

function toInt(value, label, { min, max, nullable = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    return 0;
  }
  const n = Number(value);
  if (!Number.isInteger(n)) throw new SurveyInputError(label + ' must be a whole number.');
  if (min !== undefined && n < min) throw new SurveyInputError(label + ' must be at least ' + min + '.');
  if (max !== undefined && n > max) throw new SurveyInputError(label + ' must be at most ' + max + '.');
  return n;
}

function toDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new SurveyInputError(label + ' is not a valid date.');
  return d.toISOString();
}

export function normalizeSurveyInput(input, { creating }) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {
    title: String(src.title ?? '').trim(),
    description: String(src.description ?? '').trim(),
    intro: String(src.intro ?? '').trim(),
    status: String(src.status ?? 'draft'),
    rewardXp: toInt(src.rewardXp, 'XP reward', { min: 0, max: 100000 }),
    rewardTokens: toInt(src.rewardTokens, 'Token reward', { min: 0, max: 100000 }),
    anonymous: src.anonymous === true,
    maxResponses: toInt(src.maxResponses, 'Response limit', { min: 1, max: 10000000, nullable: true }),
    minSeconds: toInt(src.minSeconds, 'Minimum time', { min: 0, max: 3600, nullable: true }),
    startsAt: toDate(src.startsAt, 'Start time'),
    endsAt: toDate(src.endsAt, 'End time')
  };
  if (creating) {
    out.slug = String(src.slug ?? '').trim().toLowerCase();
    if (!SLUG_RE.test(out.slug)) {
      throw new SurveyInputError('The slug needs 3 to 64 characters: lowercase letters, numbers and hyphens.');
    }
  }
  return out;
}

export function normalizeQuestionsInput(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new SurveyInputError('Questions are missing.');
  if (raw.length > 30) throw new SurveyInputError('A survey can have at most 30 questions.');
  return raw.map((q, index) => {
    const n = index + 1;
    if (!q || typeof q !== 'object') throw new SurveyInputError('Question ' + n + ' is invalid.');
    const type = String(q.type || '');
    const out = {
      type,
      prompt: String(q.prompt ?? '').trim(),
      helpText: String(q.helpText ?? '').trim(),
      required: q.required !== false,
      options: [],
      config: {}
    };
    if (type === 'single' || type === 'multiple') {
      const list = Array.isArray(q.options) ? q.options : [];
      out.options = list.map((o, i) => ({
        id: String(o?.id || 'o' + (i + 1)).trim().toLowerCase(),
        label: String(o?.label ?? '').trim()
      }));
      if (type === 'multiple') {
        out.config.maxSelect = toInt(q.config?.maxSelect, 'Max choices', { min: 1, max: 12, nullable: true });
      }
    } else if (type === 'rating') {
      out.config = {
        max: toInt(q.config?.max ?? 5, 'Rating scale', { min: 5, max: 10 }),
        lowLabel: String(q.config?.lowLabel ?? '').trim(),
        highLabel: String(q.config?.highLabel ?? '').trim()
      };
    } else if (type === 'text') {
      out.config = { maxLength: toInt(q.config?.maxLength ?? 600, 'Answer length', { min: 20, max: 2000 }) };
    }
    return out;
  });
}

export async function adminSurveyApi({ request, env, url, supabaseRest, json }) {
  const path = url.pathname.replace(/\/+$/, '');
  try {
    if (path === '/api/admin/surveys') {
      if (request.method === 'GET') {
        return json(await rpc(supabaseRest, env, 'server_admin_list_surveys', {}));
      }
      if (request.method === 'POST') {
        const body = await readJson(request);
        const survey = normalizeSurveyInput(body.survey || body, { creating: true });
        const questions = normalizeQuestionsInput(body.questions);
        const saved = await rpc(supabaseRest, env, 'server_admin_save_survey', {
          p_survey_id: null,
          p_survey: survey,
          p_questions: questions
        });
        return json({ ok: true, ...saved });
      }
    }

    const idMatch = path.match(/^\/api\/admin\/surveys\/([^/]+)(?:\/(status|results|responses))?$/);
    if (idMatch) {
      const id = idMatch[1];
      const action = idMatch[2] || '';
      if (!UUID_RE.test(id)) throw new SurveyInputError('Survey not found.', 404);

      if (!action && request.method === 'GET') {
        return json(await rpc(supabaseRest, env, 'server_admin_get_survey', { p_survey_id: id }));
      }
      if (!action && request.method === 'PUT') {
        const body = await readJson(request);
        const survey = normalizeSurveyInput(body.survey || body, { creating: false });
        const questions = normalizeQuestionsInput(body.questions);
        const saved = await rpc(supabaseRest, env, 'server_admin_save_survey', {
          p_survey_id: id,
          p_survey: survey,
          p_questions: questions
        });
        return json({ ok: true, ...saved });
      }
      if (!action && request.method === 'DELETE') {
        return json(await rpc(supabaseRest, env, 'server_admin_delete_survey', { p_survey_id: id }));
      }
      if (action === 'status' && request.method === 'POST') {
        const body = await readJson(request);
        const status = String(body.status || '');
        if (!['draft', 'live', 'closed', 'archived'].includes(status)) {
          throw new SurveyInputError('Invalid survey status.');
        }
        return json(await rpc(supabaseRest, env, 'server_admin_set_survey_status', {
          p_survey_id: id,
          p_status: status
        }));
      }
      if (action === 'results' && request.method === 'GET') {
        return json(await rpc(supabaseRest, env, 'server_admin_survey_results', { p_survey_id: id }));
      }
      if (action === 'responses' && request.method === 'GET') {
        const limit = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get('limit') || '500', 10) || 500));
        const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
        return json(await rpc(supabaseRest, env, 'server_admin_survey_responses', {
          p_survey_id: id,
          p_limit: limit,
          p_offset: offset
        }));
      }
    }
  } catch (error) {
    return failure(json, error, 'ADMIN_SURVEYS', { exposeAll: true });
  }

  return json({ error: 'Survey admin endpoint not found.' }, 404);
}
