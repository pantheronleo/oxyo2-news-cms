import {describe,expect,it} from 'vitest'
import {renderMarkdown,slugify,wordCount,normalizeStatus} from './content.js'
describe('content utilities',()=>{
  it('creates stable safe slugs',()=>expect(slugify(' Héllo, CMS! ')).toBe('hello-cms'))
  it('counts words',()=>expect(wordCount('One two—three')).toBe(3))
  it('sanitizes rendered markdown',()=>expect(renderMarkdown('# Safe\n<script>alert(1)</script>')).not.toContain('<script>'))
  it('rejects past schedules',()=>expect(()=>normalizeStatus('SCHEDULED','2020-01-01')).toThrow())
})
