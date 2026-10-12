import { afterEach, describe, expect, it } from 'vitest'
import { setLang } from '../i18n'
import { formatCollectionTimes, nextCollection, parseSimpleCollectionTimes } from './collectionTimes'

describe('collection times', () => {
  afterEach(() => setLang('de'))

  it('parses simple schedules', () => {
    const w = parseSimpleCollectionTimes('Mo-Fr 17:45; Sa 12:00')!
    expect(w[0]).toEqual(['17:45'])
    expect(w[4]).toEqual(['17:45'])
    expect(w[5]).toEqual(['12:00'])
    expect(w[6]).toEqual([])
  })

  it('handles multiple times, PH and off', () => {
    const w = parseSimpleCollectionTimes('Mo-Sa 09:00,16:00; Su off; PH off')!
    expect(w[2]).toEqual(['09:00', '16:00'])
    expect(w[6]).toEqual([])
  })

  it('refuses complex syntax instead of guessing', () => {
    expect(parseSimpleCollectionTimes('Mo-Fr 17:45; Jan-Mar Sa 12:00')).toBeNull()
    expect(parseSimpleCollectionTimes('week 1-53/2 Fr 10:00')).toBeNull()
  })

  it('computes the next collection', () => {
    setLang('de')
    // Wednesday 2026-10-14 10:00 local time
    const wed10 = new Date(2026, 9, 14, 10, 0)
    expect(nextCollection('Mo-Fr 17:45; Sa 12:00', wed10)?.label).toBe('heute 17:45 Uhr')
    const wed18 = new Date(2026, 9, 14, 18, 0)
    expect(nextCollection('Mo-Fr 17:45; Sa 12:00', wed18)?.label).toBe('morgen 17:45 Uhr')
    const sat13 = new Date(2026, 9, 17, 13, 0)
    expect(nextCollection('Mo-Fr 17:45; Sa 12:00', sat13)?.label).toBe('Mo 17:45 Uhr')
  })

  it('formats in English', () => {
    setLang('en')
    expect(formatCollectionTimes('Mo-Fr 17:45; Su off')).toEqual(['Mon–Fri 17:45', 'Sun no collection'])
    expect(nextCollection('Mo-Fr 17:45', new Date(2026, 9, 14, 10, 0))?.label).toBe('today 17:45')
  })

  it('formats in German', () => {
    setLang('de')
    expect(formatCollectionTimes('Mo-Fr 17:45; Su off')).toEqual(['Mo–Fr 17:45 Uhr', 'So keine Leerung'])
  })
})
