import { describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { setLang, t, tOptional } from '.'

describe('i18n', () => {
  it('has the same keys and placeholders in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort())
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const k of Object.keys(de) as (keyof typeof de)[]) {
      expect(placeholders(en[k]), k).toEqual(placeholders(de[k]))
      expect(en[k].trim(), k).not.toBe('')
    }
  })

  it('translates and interpolates', () => {
    setLang('en')
    expect(t('list.countView', { n: 3 })).toBe('3 post boxes in the visible area')
    expect(tOptional('colour.yellow')).toBe('Yellow')
    expect(tOptional('colour.fuchsia')).toBeNull()
    setLang('de')
    expect(t('list.countView', { n: 3 })).toBe('3 Briefkästen im Kartenausschnitt')
  })
})
