import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const slugify = (input: string) => input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100)
export const wordCount = (text: string) => (text.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length
export const renderMarkdown = (markdown: string) => sanitizeHtml(marked.parse(markdown, { async: false }) as string, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','video','source']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src','alt','title','width','height','loading'], video: ['src','controls','poster'], source: ['src','type'] },
  allowedSchemes: ['http','https','mailto'],
})
export function normalizeStatus(status: string, scheduledAt?: string | null) {
  if (status === 'SCHEDULED' && (!scheduledAt || new Date(scheduledAt) <= new Date())) throw new Error('Scheduled content requires a future date')
  return status
}
