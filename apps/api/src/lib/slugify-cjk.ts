import { pinyin } from 'pinyin-pro'
import { slugify } from './content.js'

/** Best-effort Latin-script slug base for a CJK title, without altering slugify() itself. Returns '' if neither the English title nor pinyin transliteration produce a usable result. */
export function transliterateSlugBase(title: string, englishTitle?: string | null) {
  const fromEnglish = englishTitle ? slugify(englishTitle) : ''
  if (fromEnglish.length >= 3) return fromEnglish
  const romanized = pinyin(title, { toneType: 'none', type: 'string', separator: '-' })
  const fromPinyin = slugify(romanized)
  return fromPinyin.length >= 3 ? fromPinyin : ''
}
