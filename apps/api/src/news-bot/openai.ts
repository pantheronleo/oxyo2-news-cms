import { config } from '../config.js'

export type ArticleLanguage = 'zh-CN' | 'en'
export type InlineImagePlan = { prompt: string; altText: string; afterParagraph: number }
export type RewrittenPost = { title: string; excerpt: string; markdown: string; tags: string[]; seoTitle: string; seoDescription: string; imagePrompt: string; imageSearchQuery: string; inlineImages: InlineImagePlan[] }
export const usesLocalAi = () => config.NODE_ENV !== 'production'

const rewriteJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, excerpt: { type: 'string' }, markdown: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 8 }, seoTitle: { type: 'string' },
    seoDescription: { type: 'string' }, imagePrompt: { type: 'string' }, imageSearchQuery: { type: 'string' },
    inlineImages: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'object', additionalProperties: false, properties: { prompt: { type: 'string' }, altText: { type: 'string' }, afterParagraph: { type: 'integer', minimum: 1 } }, required: ['prompt', 'altText', 'afterParagraph'] } }
  },
  required: ['title', 'excerpt', 'markdown', 'tags', 'seoTitle', 'seoDescription', 'imagePrompt', 'imageSearchQuery']
}
const articleBodyJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: { markdown: { type: 'string' } },
  required: ['markdown']
}
const articleMetadataJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: { title: { type: 'string' }, excerpt: { type: 'string' }, seoTitle: { type: 'string' }, seoDescription: { type: 'string' } },
  required: ['title', 'excerpt', 'seoTitle', 'seoDescription']
}
const articleAuxiliaryJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    tags: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
    imagePrompt: { type: 'string' }, imageSearchQuery: { type: 'string' }
  },
  required: ['tags', 'imagePrompt', 'imageSearchQuery']
}
const categoryJsonSchema = { type: 'object', additionalProperties: false, properties: { categoryIndex: { type: 'integer' } }, required: ['categoryIndex'] }
const duplicateJsonSchema = { type: 'object', additionalProperties: false, properties: { duplicateIndex: { type: 'integer' }, reason: { type: 'string' } }, required: ['duplicateIndex', 'reason'] }

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

async function readJsonBody(response: Response, provider: string) {
  const body = await response.text()
  if (!body.trim()) throw new Error(`${provider} returned an empty response body`)
  try { return JSON.parse(body) } catch { throw new Error(`${provider} returned incomplete JSON`) }
}

async function retry<T>(stage: string, action: (attempt: number) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await action(attempt) } catch (error) {
      lastError = error
      if (attempt < attempts) await wait(350 * attempt)
    }
  }
  throw new Error(`${stage} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`)
}

export function parseAiJson(rawResponse: string) {
  const raw = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?\s*|\s*```/gi, '').trim()
  for (let start = raw.indexOf('{'); start >= 0; start = raw.indexOf('{', start + 1)) {
    let depth = 0; let quoted = false; let escaped = false
    for (let index = start; index < raw.length; index++) {
      const character = raw[index]
      if (quoted) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') quoted = false; continue }
      if (character === '"') { quoted = true; continue }
      if (character === '{') depth++
      if (character === '}') { depth--; if (depth === 0) { try { return JSON.parse(raw.slice(start, index + 1)) } catch { break } } }
    }
  }
  throw new Error('AI response did not contain a complete JSON object')
}

export function substantiveMarkdownDetails(markdown: string) {
  const withoutCredit = markdown.replace(sourceCreditPattern(), '').trim()
  const text = withoutCredit.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim()
  const paragraphs = withoutCredit.split(/\n{2,}/).map(part => part.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim()).filter(Boolean).length
  return { characters: Array.from(text).length, paragraphs }
}

function sourceCreditPattern() {
  return /(?:^|\n{1,})\s*(?:Originally reported by|原文来源)\s*[:：]?\s*\[[^\]]+\]\([^)]*\)[。.]?\s*$/gim
}

function withFinalSourceCredit(markdown: string, credit: string) {
  const body = markdown.replace(sourceCreditPattern(), '').trim()
  return `${body}\n\n${credit}`
}

function markdownText(markdown: string) {
  return markdown.replace(sourceCreditPattern(), '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_>#]/g, '').replace(/\s+/g, ' ').trim()
}

type RepairedMetadata = Pick<RewrittenPost, 'title' | 'excerpt' | 'seoTitle' | 'seoDescription'>

export function fallbackMetadataFromMarkdown(markdown: string, sourceTitle: string): RepairedMetadata {
  const text = markdownText(markdown)
  const firstSentence = text.split(/(?<=[。！？.!?])\s+/)[0]?.trim() || text
  const title = (firstSentence.length >= 12 ? firstSentence : sourceTitle.trim()).slice(0, 120) || 'News update'
  const excerpt = text.slice(0, 320) || title
  return { title, excerpt, seoTitle: title, seoDescription: excerpt.slice(0, 160) }
}

type RepairedAuxiliary = Pick<RewrittenPost, 'tags' | 'imagePrompt' | 'imageSearchQuery'>

/** Preserve a complete article when a provider omits non-editorial visual metadata. */
export function fallbackAuxiliaryFromSource(sourceTitle: string, articleTitle: string): RepairedAuxiliary {
  const words = sourceTitle.match(/[A-Za-z]{3,}|\d{1,4}/g)?.slice(0, 7).join(' ') || 'editorial news'
  return {
    tags: ['news'],
    imagePrompt: `A factual editorial illustration related to ${articleTitle.slice(0, 120) || 'this news story'}, without text or logos`,
    imageSearchQuery: words
  }
}

const hanCharacters = (value: string) => (value.match(/[\u3400-\u9fff]/g) ?? []).length
const latinCharacters = (value: string) => (value.match(/[A-Za-z]/g) ?? []).length

/** Chinese-primary drafts must contain real Chinese copy, not English content with a Chinese credit line. */
export function chinesePrimaryMissing(post: Pick<RewrittenPost, 'title' | 'excerpt' | 'markdown'>) {
  const body = markdownText(post.markdown)
  const bodyHan = hanCharacters(body); const bodyLatin = latinCharacters(body)
  const missing: string[] = []
  if (hanCharacters(post.title) < 2) missing.push('Chinese title')
  if (hanCharacters(post.excerpt) < 8) missing.push('Chinese excerpt')
  if (bodyHan < 80 || (bodyHan / Math.max(1, bodyHan + bodyLatin)) < 0.15) missing.push('Chinese article body')
  return missing
}

export function normalizeEditorialTitle(title: string, sourceName: string) {
  let normalized = title.replace(/\s+/g, ' ').trim()
  const publisher = sourceName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (publisher) {
    const leading = new RegExp(`^\\s*(?:\\[|【|\\()\\s*${publisher}\\s*(?:\\]|】|\\))\\s*(?:[-–—|｜:：]+\\s*)?`, 'i')
    const trailing = new RegExp(`\\s*(?:[-–—|｜:：]+\\s*)?(?:\\[|【|\\()\\s*${publisher}\\s*(?:\\]|】|\\))\\s*$`, 'i')
    normalized = normalized.replace(leading, '').replace(trailing, '')
  }
  return normalized.replace(/^\s*(?:\[[^\]]{2,70}\]|【[^】]{2,70}】)\s*(?:[-–—|｜:：]+\s*)?/, '').replace(/^[-–—|｜:：\s]+|[-–—|｜:：\s]+$/g, '').trim()
}

function normalizeEditorialPost(post: RewrittenPost, sourceName: string) {
  const title = normalizeEditorialTitle(post.title, sourceName) || post.title.trim()
  const seoTitle = normalizeEditorialTitle(post.seoTitle, sourceName) || title
  return { ...post, title, seoTitle }
}

export function validateRewrittenPost(value: any): { post?: RewrittenPost; missing: string[] } {
  const requiredStrings = ['title', 'excerpt', 'markdown', 'seoTitle', 'seoDescription', 'imagePrompt', 'imageSearchQuery'] as const
  const missing: string[] = requiredStrings.filter(field => typeof value?.[field] !== 'string' || !value[field].trim())
  if (!Array.isArray(value?.tags) || value.tags.some((tag: unknown) => typeof tag !== 'string' || !tag.trim())) missing.push('tags')
  if (typeof value?.markdown === 'string') {
    const body = substantiveMarkdownDetails(value.markdown)
    if (body.characters < 320 || body.paragraphs < 2) missing.push('substantive markdown body (at least two paragraphs and 320 characters excluding the credit)')
  }
  if (missing.length) return { missing }
  const inlineImages = Array.isArray(value.inlineImages)
    ? value.inlineImages.filter((image: any) => typeof image?.prompt === 'string' && image.prompt.trim() && typeof image?.altText === 'string' && image.altText.trim() && Number.isInteger(image?.afterParagraph) && image.afterParagraph >= 1).slice(0, 2).map((image: InlineImagePlan) => ({ prompt: image.prompt.trim(), altText: image.altText.trim(), afterParagraph: image.afterParagraph }))
    : []
  const title = value.title.trim(); const imagePrompt = value.imagePrompt.trim()
  const fallbackImage: InlineImagePlan = { prompt: `A focused editorial illustration that supports this news story: ${imagePrompt}`, altText: `Editorial illustration for ${title}`, afterParagraph: 2 }
  return { post: { title, excerpt: value.excerpt.trim(), markdown: value.markdown.trim(), tags: value.tags.map((tag: string) => tag.trim()).filter(Boolean).slice(0, 8), seoTitle: value.seoTitle.trim(), seoDescription: value.seoDescription.trim(), imagePrompt, imageSearchQuery: value.imageSearchQuery.trim(), inlineImages: inlineImages.length ? inlineImages : [fallbackImage] }, missing: [] }
}

async function requestJson(prompt: string, schema: Record<string, unknown>, stage: string) {
  return retry(stage, async () => {
    if (usesLocalAi()) {
      const response = await fetch(new URL('/api/generate', config.OLLAMA_URL), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: config.OLLAMA_MODEL, prompt, stream: false, format: schema, options: { temperature: 0.1, num_predict: 4096 } }), signal: AbortSignal.timeout(180_000) })
      if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 500)}`)
      return String((await readJsonBody(response, 'Ollama')).response ?? '')
    }
    if (!config.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is required before the production news bot can process articles')
    // DeepSeek rejects JSON mode unless the prompt explicitly contains "json".
    // Appending this at the provider boundary covers every structured bot stage.
    const deepSeekPrompt = `${prompt}\n\nReturn a valid JSON object only; do not include any prose or Markdown fences.`
    const response = await fetch(new URL('/chat/completions', config.DEEPSEEK_API_URL), { method: 'POST', headers: { authorization: `Bearer ${config.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: config.DEEPSEEK_MODEL, messages: [{ role: 'user', content: deepSeekPrompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 4096 }), signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`DeepSeek returned ${response.status}: ${(await response.text()).slice(0, 500)}`)
    const value = await readJsonBody(response, 'DeepSeek')
    const content = value?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('DeepSeek returned an empty chat completion')
    return content
  })
}

async function repairSubstantiveMarkdown(input: { sourceName: string; sourceUrl: string; title: string; body: string; language: ArticleLanguage }, credit: string) {
  const languageInstruction = input.language === 'zh-CN' ? 'Simplified Chinese (简体中文)' : 'natural English'
  return retry(`substantive-markdown-repair-${input.language}`, async attempt => {
    const retryInstruction = attempt > 1 ? 'Your prior body was too short. Expand the factual body with the available source details; do not add facts.' : ''
    const prompt = `Write only the substantive Markdown body for an original, factual news rewrite in ${languageInstruction}, based only on the supplied source material. Do not output a title, excerpt, tags, SEO fields, images, commentary, or JSON fields other than markdown. Write at least five substantive paragraphs and at least 320 meaningful characters before the source credit. Do not add facts or copy the source wording or structure. ${retryInstruction} End with this exact final credit line: ${credit}\n\nReturn exactly one JSON object: {"markdown":"..."}.\n\nSource title: ${input.title}\nSource text:\n${input.body.slice(0, 16_000)}`
    const value = parseAiJson(await requestJson(prompt, articleBodyJsonSchema, `body-repair-${input.language}-${attempt}`))
    if (typeof value?.markdown !== 'string' || !value.markdown.trim()) throw new Error('body repair did not contain markdown')
    const markdown = withFinalSourceCredit(value.markdown, credit)
    const details = substantiveMarkdownDetails(markdown)
    if (details.characters < 320 || details.paragraphs < 2) throw new Error(`body repair remained too short (${details.paragraphs} paragraphs, ${details.characters} characters)`)
    return markdown
  }, 2)
}

async function repairMetadata(input: { title: string; language: ArticleLanguage }, markdown: string): Promise<RepairedMetadata> {
  const languageInstruction = input.language === 'zh-CN' ? 'Simplified Chinese (简体中文)' : 'natural English'
  const prompt = `Create the missing article metadata in ${languageInstruction} from this already rewritten article body. Keep it factual and do not add facts. Return exactly one JSON object with non-empty title, excerpt, seoTitle, and seoDescription. Do not return markdown, commentary, or any other fields.\n\nOriginal source title: ${input.title}\nRewritten article body:\n${markdown.slice(0, 12_000)}`
  const value = parseAiJson(await requestJson(prompt, articleMetadataJsonSchema, `metadata-repair-${input.language}`))
  const fields = ['title', 'excerpt', 'seoTitle', 'seoDescription'] as const
  if (fields.some(field => typeof value?.[field] !== 'string' || !value[field].trim())) throw new Error('metadata repair did not return every required field')
  return Object.fromEntries(fields.map(field => [field, value[field].trim()])) as RepairedMetadata
}

async function repairAuxiliary(input: { title: string; language: ArticleLanguage }, post: Pick<RewrittenPost, 'title' | 'excerpt' | 'markdown'>): Promise<RepairedAuxiliary> {
  const prompt = `Create the missing visual and tag metadata for this factual news article. Return exactly one JSON object containing tags, imagePrompt, and imageSearchQuery. tags must contain 1-8 short topical labels. imagePrompt must be an editorial illustration description with no text or logos. imageSearchQuery must be a short English stock-photo search query, even when the article is in Chinese. Do not include a publisher or source name in any field.\n\nArticle title: ${post.title}\nArticle excerpt: ${post.excerpt}\nArticle body:\n${post.markdown.slice(0, 8_000)}\n\nOriginal source title: ${input.title}`
  const value = parseAiJson(await requestJson(prompt, articleAuxiliaryJsonSchema, `auxiliary-repair-${input.language}`))
  const tags = Array.isArray(value?.tags) ? value.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim()).slice(0, 8) : []
  if (!tags.length || typeof value?.imagePrompt !== 'string' || !value.imagePrompt.trim() || typeof value?.imageSearchQuery !== 'string' || !value.imageSearchQuery.trim()) throw new Error('auxiliary repair did not return every required field')
  return { tags, imagePrompt: value.imagePrompt.trim(), imageSearchQuery: value.imageSearchQuery.trim() }
}

async function repairChinesePrimary(input: { sourceName: string; sourceUrl: string; title: string; body: string }, credit: string) {
  const prompt = `请把以下新闻素材改写成完整、自然的简体中文新闻稿。标题、摘要、SEO 标题、SEO 描述和正文必须以简体中文为主；不得保留英文标题作为中文标题，也不得在标题前后加上来源名称、[来源]、【来源】或网站品牌。标题必须准确概括新闻事件，而不是复制来源标题。只能依据素材，不得添加事实。正文至少五段，并以这句作为最后一行来源标注：${credit}。imageSearchQuery 必须保留简短英文，供图库检索。仅返回符合 JSON schema 的完整对象，不要解释。\n\n来源标题：${input.title}\n来源正文：\n${input.body.slice(0, 16_000)}`
  const value = parseAiJson(await requestJson(prompt, rewriteJsonSchema, 'rewrite-chinese-language-repair'))
  const validation = validateRewrittenPost(value)
  if (!validation.post) throw new Error(`Chinese language repair was incomplete: ${validation.missing.join(', ')}`)
  const post = normalizeEditorialPost(validation.post, input.sourceName)
  const missing = chinesePrimaryMissing(post)
  if (missing.length) throw new Error(`Chinese language repair still returned ${missing.join(', ')}`)
  return post
}

export async function rewriteArticle(input: { sourceName: string; sourceUrl: string; title: string; body: string; language: ArticleLanguage }): Promise<RewrittenPost> {
  const languageInstruction = input.language === 'zh-CN' ? 'Write in Simplified Chinese (简体中文). Chinese is the primary publication language.' : 'Write in natural English.'
  const credit = input.language === 'zh-CN' ? `原文来源：[${input.sourceName}](${input.sourceUrl})。` : `Originally reported by [${input.sourceName}](${input.sourceUrl}).`
  const prompt = `Create a 600-900 word original news rewrite based only on the supplied source material. Do not copy its wording or structure, do not add facts, and use a factual, neutral style. ${languageInstruction} The title must be a standalone editorial headline that accurately reflects the news context. Never copy the source title mechanically. Never include a publisher, website name, source label, or bracketed placeholder such as [Says], [Malaysiakini], or 【Source】 in title or SEO title. ${input.language === 'zh-CN' ? 'For Chinese-primary output, title, excerpt, SEO fields, and substantive Markdown body must be written in Simplified Chinese; English is allowed only in imageSearchQuery and unavoidable proper names.' : 'For English output, use a clean English editorial headline without publisher prefixes or suffixes.'} Markdown must contain at least five substantive paragraphs before the credit line; never return only a summary, image captions, or the credit line. Include this exact final Markdown credit line in markdown: ${credit} Return a short English imageSearchQuery suitable for stock-photo search. Plan one or two optional supporting stock-image search queries in inlineImages. Each image query must be contextual, contain no text/logo/chart, and use 1-based afterParagraph placement. Return exactly one valid JSON object matching the schema; no reasoning, preamble, or Markdown fences.\n\nSource title: ${input.title}\nSource text:\n${input.body.slice(0, 16_000)}`
  const validateResponse = (raw: string) => {
    try {
      const value = parseAiJson(raw)
      return { value, validation: validateRewrittenPost(value) }
    } catch {
      return { value: null, validation: { missing: ['complete JSON object'] } as ReturnType<typeof validateRewrittenPost> }
    }
  }
  const needsBodyRepair = (validation: ReturnType<typeof validateRewrittenPost>) => validation.missing.some(field => field.startsWith('substantive markdown body'))
  const metadataFields = new Set(['title', 'excerpt', 'seoTitle', 'seoDescription'])
  const auxiliaryFields = new Set(['tags', 'imagePrompt', 'imageSearchQuery'])
  const onlyNeedsRecoverableFields = (validation: ReturnType<typeof validateRewrittenPost>) => validation.missing.length > 0 && validation.missing.every(field => metadataFields.has(field) || auxiliaryFields.has(field))

  let raw = await requestJson(prompt, rewriteJsonSchema, `rewrite-${input.language}`)
  let candidate = validateResponse(raw)
  let validation = candidate.validation
  const recoverMetadata = async () => {
    if (!candidate.value || typeof candidate.value.markdown !== 'string') return
    try {
      Object.assign(candidate.value, await repairMetadata(input, candidate.value.markdown))
    } catch {
      // The markdown is already an accepted rewrite, so derive safe metadata from it
      // instead of losing the entire article to an optional provider-format failure.
      Object.assign(candidate.value, fallbackMetadataFromMarkdown(candidate.value.markdown, input.title))
    }
    validation = validateRewrittenPost(candidate.value)
  }
  const recoverAuxiliary = async () => {
    if (!candidate.value || typeof candidate.value.markdown !== 'string') return
    const metadata = fallbackMetadataFromMarkdown(candidate.value.markdown, input.title)
    const post = {
      title: typeof candidate.value.title === 'string' && candidate.value.title.trim() ? candidate.value.title.trim() : metadata.title,
      excerpt: typeof candidate.value.excerpt === 'string' && candidate.value.excerpt.trim() ? candidate.value.excerpt.trim() : metadata.excerpt,
      markdown: candidate.value.markdown
    }
    try {
      Object.assign(candidate.value, await repairAuxiliary(input, post))
    } catch {
      // Search metadata must not discard otherwise publishable source reporting.
      Object.assign(candidate.value, fallbackAuxiliaryFromSource(input.title, post.title))
    }
    validation = validateRewrittenPost(candidate.value)
  }
  const recoverOptionalFields = async () => {
    if (validation.missing.some(field => metadataFields.has(field))) await recoverMetadata()
    if (!validation.post && validation.missing.some(field => auxiliaryFields.has(field))) await recoverAuxiliary()
  }

  // A short body is a common local-model failure. Keep the otherwise valid response
  // and repair only markdown, rather than making the model reproduce the whole schema.
  if (!validation.post && candidate.value && typeof candidate.value.markdown === 'string' && needsBodyRepair(validation)) {
    try {
      candidate.value.markdown = await repairSubstantiveMarkdown(input, credit)
      validation = validateRewrittenPost(candidate.value)
    } catch {
      // The complete-schema retry below is still useful when a compact repair fails.
    }
  }
  if (!validation.post && candidate.value && onlyNeedsRecoverableFields(validation)) await recoverOptionalFields()

  if (!validation.post) {
    raw = await requestJson(`${prompt}\n\nYour previous response was incomplete. Return the complete JSON object now. Required fields: ${validation.missing.join(', ')}.`, rewriteJsonSchema, `rewrite-repair-${input.language}`)
    candidate = validateResponse(raw)
    validation = candidate.validation
  }
  if (!validation.post && candidate.value && typeof candidate.value.markdown === 'string' && needsBodyRepair(validation)) {
    try {
      candidate.value.markdown = await repairSubstantiveMarkdown(input, credit)
      validation = validateRewrittenPost(candidate.value)
    } catch {
      // Surface the original validation reason below, which is actionable in the run log.
    }
  }
  if (!validation.post && candidate.value && onlyNeedsRecoverableFields(validation)) await recoverOptionalFields()
  if (!validation.post) throw new Error(`AI rewrite response is incomplete after retry: ${validation.missing.join(', ')}`)
  let post = normalizeEditorialPost(validation.post, input.sourceName)
  if (input.language === 'zh-CN' && chinesePrimaryMissing(post).length) post = await repairChinesePrimary(input, credit)
  return { ...post, markdown: withFinalSourceCredit(post.markdown, credit) }
}

export async function classifyArticleCategory(input: { title: string; excerpt: string; categories: string[] }) {
  if (!input.categories.length) return null
  const prompt = `Select the best CMS category for this news article. Return categoryIndex only, using the zero-based index of exactly one item in the supplied category list.\n\nCategories:\n${input.categories.map((category, index) => `${index}: ${category}`).join('\n')}\n\nArticle title: ${input.title}\nArticle excerpt: ${input.excerpt.slice(0, 1_000)}`
  for (const stage of ['category-classification', 'category-repair']) {
    try {
      const value = parseAiJson(await requestJson(stage === 'category-repair' ? `${prompt}\nReturn only a valid JSON object with an integer categoryIndex.` : prompt, categoryJsonSchema, stage))
      const index = Number(value.categoryIndex)
      if (Number.isInteger(index) && index >= 0 && index < input.categories.length) return input.categories[index]!
    } catch { /* The deterministic fallback in the worker handles a bad category response. */ }
  }
  return null
}

/** Returns undefined only when an AI response cannot safely be interpreted. */
export function duplicateIndexFromAi(value: unknown, candidateCount: number) {
  const raw = (value as { duplicateIndex?: unknown } | null)?.duplicateIndex
  const index = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^-?\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN
  return Number.isInteger(index) && index >= -1 && index < candidateCount ? index : undefined
}

export async function findSemanticDuplicate(input: { title: string; excerpt: string; category: string; candidates: Array<{ id: string; title: string; excerpt: string; sourceUrl?: string | null }> }) {
  if (!input.candidates.length) return null
  const list = input.candidates.map((candidate, index) => `${index}. id=${candidate.id}; title=${candidate.title}; excerpt=${candidate.excerpt.slice(0, 500)}; source=${candidate.sourceUrl || 'unknown'}`).join('\n')
  const prompt = `Determine whether the candidate news item reports the same underlying event, announcement, promotion, deal, or development as one recent CMS item in the same category. Treat changed wording, a different publisher, or a different headline as duplicates when the core subject and claim are materially the same. Do not treat general topical similarity as a duplicate. Return duplicateIndex as the matching list index, or -1 when no duplicate exists.\n\nCandidate category: ${input.category}\nCandidate title: ${input.title}\nCandidate excerpt: ${input.excerpt}\n\nRecent CMS items:\n${list}`
  for (const stage of ['semantic-duplicate-check', 'semantic-duplicate-repair']) {
    try {
      const repair = stage === 'semantic-duplicate-repair' ? `${prompt}\n\nReturn exactly {"duplicateIndex": -1 or a valid list index, "reason": "brief factual reason"}. Do not use null, an id, or any other value for duplicateIndex.` : prompt
      const value = parseAiJson(await requestJson(repair, duplicateJsonSchema, stage))
      const duplicateIndex = duplicateIndexFromAi(value, input.candidates.length)
      if (duplicateIndex === -1) return null
      if (duplicateIndex !== undefined && typeof value.reason === 'string' && value.reason.trim()) return { candidate: input.candidates[duplicateIndex]!, reason: value.reason.trim() }
    } catch {
      // A duplicate check is advisory. An invalid provider response must not fail
      // a complete article or cause an unverified duplicate to be skipped.
    }
  }
  return null
}
