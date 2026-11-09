// Prompt builders. Kept short and concrete for small (0.6B-1.7B) models.
import type { GenerateRequest, Lang } from '../types';
import { INGREDIENT_MAP, PANTRY_IDS } from '../data/ingredients';

const NO_THINK = ' /no_think';

export function buildSystemPrompt(lang: Lang): string {
  if (lang === 'ja') {
    return [
      'あなたは節約上手な家庭料理の料理人です。',
      '日本のスーパーで安く買える食材だけで、早く簡単に作れるレシピを1つ考えます。',
      'ルール:',
      '- 材料は指定リストのidだけを使う。リストにない食材は使わない。',
      '- 冷蔵庫の食材を優先して使う。材料は少なめ(3〜8個)。',
      '- 分量は人数分。unitは g / ml / piece のどれか。',
      '- 調理時間は上限以内。手順は日本語で3〜6個、各40文字以内。',
      '- JSONだけを出力する。',
    ].join('\n');
  }
  return [
    'You are a thrifty home cook.',
    'Create ONE cheap, quick home-cooking recipe using only ingredients from a Japanese supermarket.',
    'Rules:',
    '- Use ONLY ingredient ids from the given list. Nothing else.',
    '- Prefer the fridge items. Keep it short: 3-8 ingredients.',
    '- Amounts are for the given servings. unit is g, ml or piece.',
    '- Stay within the time limit. Write 3-6 short steps in English (under 20 words each).',
    '- Output JSON only.',
  ].join('\n');
}

function line(id: string, lang: Lang): string {
  const ing = INGREDIENT_MAP[id];
  if (!ing) return `${id}`;
  return lang === 'ja' ? `${id}: ${ing.ja}` : `${id}: ${ing.ja} (${ing.en})`;
}

/** Groups allowed ids into fridge / other / pantry sections as `id: name` lines. */
export function formatIngredientList(allowedIds: string[], fridge: string[], lang: Lang): string {
  const fridgeSet = new Set(fridge);
  const pantrySet = new Set(PANTRY_IDS);
  const f = allowedIds.filter((id) => fridgeSet.has(id));
  const p = allowedIds.filter((id) => !fridgeSet.has(id) && pantrySet.has(id));
  const o = allowedIds.filter((id) => !fridgeSet.has(id) && !pantrySet.has(id));
  const h =
    lang === 'ja'
      ? { f: '[冷蔵庫にある食材・優先]', o: '[買い足せる安い食材]', p: '[家にある調味料]' }
      : { f: '[In fridge - use these first]', o: '[Cheap items you may buy]', p: '[Pantry seasonings]' };
  const parts: string[] = [];
  if (f.length) parts.push(h.f, ...f.map((id) => line(id, lang)));
  if (o.length) parts.push(h.o, ...o.map((id) => line(id, lang)));
  if (p.length) parts.push(h.p, ...p.map((id) => line(id, lang)));
  return parts.join('\n');
}

export function buildUserPrompt(
  req: GenerateRequest,
  allowedIds: string[],
  prevErrors?: string[],
  opts: { noThink?: boolean } = {},
): string {
  const tail = opts.noThink === false ? '' : NO_THINK;
  const list = formatIngredientList(allowedIds, req.fridge, req.lang);
  const errs = prevErrors?.length ? prevErrors.slice(0, 4).join('; ').slice(0, 300) : '';
  if (req.lang === 'ja') {
    const lines = [
      `リクエスト: ${req.prompt.trim() || 'おまかせ'}`,
      `人数: ${req.servings}人分`,
      `調理時間: ${req.maxMinutes}分以内`,
    ];
    if (req.budgetPerServingYen) lines.push(`予算: 1人分${req.budgetPerServingYen}円以内`);
    lines.push('', '使える食材 (id: 名前):', list, '');
    lines.push(
      '出力形式: {"title":"料理名","servings":数,"totalMinutes":数,"ingredients":[{"id":"id","amount":数,"unit":"g"}],"steps":["手順"],"tip":"節約のコツ"}',
    );
    if (errs) lines.push(`前回の出力の誤り: ${errs}。直して出力してください。`);
    return lines.join('\n') + tail;
  }
  const lines = [
    `Request: ${req.prompt.trim() || 'anything'}`,
    `Servings: ${req.servings}`,
    `Time limit: ${req.maxMinutes} minutes`,
  ];
  if (req.budgetPerServingYen) lines.push(`Budget: under ${req.budgetPerServingYen} yen per serving`);
  lines.push('', 'Allowed ingredients (id: name):', list, '');
  lines.push(
    'Output format: {"title":"Dish name","servings":n,"totalMinutes":n,"ingredients":[{"id":"id","amount":n,"unit":"g"}],"steps":["step"],"tip":"money-saving tip"}',
  );
  if (errs) lines.push(`Your previous output had errors: ${errs}. Fix them.`);
  return lines.join('\n') + tail;
}
