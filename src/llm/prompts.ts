// Prompt builders. The app enforces most rules in code (src/lib/consistency.ts);
// the prompt states them so the model gets them right the first time.
import type { GenerateRequest, Lang } from '../types';
import { INGREDIENT_MAP, PANTRY_IDS } from '../data/ingredients';

const NO_THINK = ' /no_think';

export function buildSystemPrompt(lang: Lang): string {
  if (lang === 'ja') {
    return [
      'あなたは節約上手な家庭料理の料理人です。日本のスーパーで安く買える食材だけで、早く簡単に作れるレシピを1つ考えます。',
      '',
      '【材料のルール】',
      '- 材料は「使える食材」リストのidだけを使う。リストにない食材(水以外)は使わない。',
      '- 冷蔵庫の食材を優先。材料は3〜8個。',
      '- servingsは指定の人数と同じ数にする。amountは必ずその人数分の合計量。',
      '- unitは各食材の[ ]に書かれた単位を使う。塩・こしょうなど少量はunit "pinch"(少々)、amountは1。',
      '- 1人分の目安: 肉・魚100〜150g、野菜50〜150g、卵1〜2個、醤油などの調味料は5〜15ml。',
      '',
      '【手順のルール】',
      '- 手順は4〜7個。1つの手順に1つの動作。各40〜70文字。',
      '- 食材は必ず{id}の形で書く(例: 「{chicken_breast}を一口大に切る」)。食材名を直接書かない。',
      '- 材料の食材はすべて手順で使う。手順で使う食材はすべて材料に入れる。',
      '- 「調味料」「具材」「タレ」とまとめず、使う食材をそれぞれ{id}で書く。',
      '- 分量は手順に書かない(アプリが自動で表示する)。',
      '- 加熱する手順には火加減(弱火/中火/強火)と時間(〇分)を、仕上がりの目安(色が変わるまで等)も書く。',
      '- 下ごしらえの切り方(一口大、細切り、5mm幅など)を具体的に書く。',
      '',
      '【その他】',
      '- descriptionは料理の特徴を1文(30文字以内)。tipは節約か時短のコツを1文。',
      '- totalMinutesは下ごしらえを含む合計時間で、上限以内。',
      '- JSONだけを出力する。',
    ].join('\n');
  }
  return [
    'You are a thrifty home cook. Create ONE cheap, quick home-cooking recipe using only ingredients sold in Japanese supermarkets.',
    '',
    'INGREDIENT RULES',
    '- Use ONLY ingredient ids from the "Allowed ingredients" list. Nothing else except water.',
    '- Prefer the fridge items. 3-8 ingredients.',
    '- "servings" must equal the requested number. Every amount is the TOTAL for that many servings.',
    '- Use the unit shown in [ ] for each ingredient. For salt/pepper "to taste" use unit "pinch" with amount 1.',
    '- Per serving guide: meat/fish 100-150 g, vegetables 50-150 g, eggs 1-2, liquid seasonings 5-15 ml.',
    '',
    'STEP RULES',
    '- 4-7 steps, ONE action per step, 10-30 words each.',
    '- Write every ingredient as {id}, e.g. "Cut {chicken_breast} into bite-sized pieces." Never write ingredient names directly.',
    '- Every listed ingredient must appear in the steps, and every ingredient in the steps must be listed.',
    '- Never say "seasonings", "the sauce" or "all ingredients" - name each one as {id}.',
    '- Do not write amounts in steps (the app shows them).',
    '- For cooking steps give heat (low/medium/high), time (minutes) and a doneness cue (e.g. "until golden").',
    '- For prep steps say exactly how to cut (bite-sized, thin strips, 5 mm slices...).',
    '',
    'OTHER',
    '- "description": one sentence (max 15 words) about the dish. "tip": one money- or time-saving tip.',
    '- totalMinutes includes prep and must be within the limit.',
    '- Output JSON only, in English.',
  ].join('\n');
}

function line(id: string, lang: Lang): string {
  const ing = INGREDIENT_MAP[id];
  if (!ing) return `${id}`;
  const name = lang === 'ja' ? ing.ja : `${ing.en} / ${ing.ja}`;
  return `${id}: ${name} [${ing.unit}]`;
}

/** Groups allowed ids into fridge / other / pantry sections as `id: name [unit]` lines. */
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

const EXAMPLE_JA =
  '{"title":"鶏むね肉とキャベツのポン酢炒め","description":"さっぱり味で、むね肉がやわらかい節約おかず。","servings":2,"totalMinutes":15,' +
  '"ingredients":[{"id":"chicken_breast","amount":250,"unit":"g"},{"id":"cabbage","amount":200,"unit":"g"},{"id":"katakuriko","amount":10,"unit":"g"},{"id":"ponzu","amount":30,"unit":"ml"},{"id":"salad_oil","amount":10,"unit":"ml"},{"id":"salt_pepper","amount":1,"unit":"pinch"}],' +
  '"steps":["{chicken_breast}を1cm厚のそぎ切りにし、{salt_pepper}をふって{katakuriko}を薄くまぶす。","{cabbage}を4cm角のざく切りにする。","フライパンに{salad_oil}を中火で熱し、{chicken_breast}を両面2分ずつ焼き色がつくまで焼く。","{cabbage}を加え、強火で1〜2分しんなりするまで炒める。","{ponzu}を回し入れ、全体にからめて火を止める。"],' +
  '"tip":"むね肉は片栗粉をまぶすと安くてもやわらかく仕上がります。"}';
const EXAMPLE_EN =
  '{"title":"Ponzu Chicken & Cabbage Stir-fry","description":"Light, tangy stir-fry with tender chicken breast.","servings":2,"totalMinutes":15,' +
  '"ingredients":[{"id":"chicken_breast","amount":250,"unit":"g"},{"id":"cabbage","amount":200,"unit":"g"},{"id":"katakuriko","amount":10,"unit":"g"},{"id":"ponzu","amount":30,"unit":"ml"},{"id":"salad_oil","amount":10,"unit":"ml"},{"id":"salt_pepper","amount":1,"unit":"pinch"}],' +
  '"steps":["Slice {chicken_breast} into 1 cm thick pieces, season with {salt_pepper} and coat lightly with {katakuriko}.","Cut {cabbage} into 4 cm squares.","Heat {salad_oil} in a pan over medium heat and cook {chicken_breast} 2 minutes per side until golden.","Add {cabbage} and stir-fry over high heat for 1-2 minutes until just wilted.","Pour in {ponzu}, toss to coat and turn off the heat."],' +
  '"tip":"Coating cheap chicken breast with starch keeps it juicy."}';

export function buildUserPrompt(
  req: GenerateRequest,
  allowedIds: string[],
  prevErrors?: string[],
  opts: { noThink?: boolean } = {},
): string {
  const tail = opts.noThink === false ? '' : NO_THINK;
  const list = formatIngredientList(allowedIds, req.fridge, req.lang);
  const errs = prevErrors?.length ? prevErrors.slice(0, 8).map((e) => `- ${e}`).join('\n').slice(0, 900) : '';
  if (req.lang === 'ja') {
    const lines = [
      `リクエスト: ${req.prompt.trim() || 'おまかせ'}`,
      `人数: ${req.servings}人分 (servings=${req.servings})`,
      `調理時間: ${req.maxMinutes}分以内`,
    ];
    if (req.budgetPerServingYen) lines.push(`予算: 1人分${req.budgetPerServingYen}円以内`);
    lines.push('', '使える食材 (id: 名前 [単位]):', list, '');
    lines.push('出力例 (形式の参考。内容はリクエストに合わせる):', EXAMPLE_JA);
    if (errs) lines.push('', '前回の出力には次の誤りがありました。すべて直して、レシピ全体をもう一度出力してください:', errs);
    return lines.join('\n') + tail;
  }
  const lines = [
    `Request: ${req.prompt.trim() || 'anything'}`,
    `Servings: ${req.servings} (servings=${req.servings})`,
    `Time limit: ${req.maxMinutes} minutes`,
  ];
  if (req.budgetPerServingYen) lines.push(`Budget: under ${req.budgetPerServingYen} yen per serving`);
  lines.push('', 'Allowed ingredients (id: name [unit]):', list, '');
  lines.push('Example (format only - fit the content to the request):', EXAMPLE_EN);
  if (errs) lines.push('', 'Your previous output had these errors. Fix ALL of them and output the whole recipe again:', errs);
  return lines.join('\n') + tail;
}
