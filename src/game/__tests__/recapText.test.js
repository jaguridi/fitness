import { describe, it, expect } from 'vitest'
import { genderGuide, stripGenderTags } from '../recapText.js'

const NAMES = ['Jose', 'Javi', 'Gonza', 'Fran']

describe('stripGenderTags', () => {
  it('scrubs the tags the W42 recap leaked', () => {
    const leaked = 'Semana 42: Jose (hombre) y Gonza (hombre) quedaron 0/3. Fran (mujer) también. ' +
      'Javi (mujer) sigue en pausa.'
    expect(stripGenderTags(leaked, NAMES)).toBe(
      'Semana 42: Jose y Gonza quedaron 0/3. Fran también. Javi sigue en pausa.')
  })

  it('handles accents, case, plurals and "género:" forms', () => {
    expect(stripGenderTags('José (Hombre) ganó.', NAMES)).toBe('José ganó.')
    expect(stripGenderTags('Jose y Gonza ( hombres ) cumplieron', NAMES)).toBe('Jose y Gonza cumplieron')
    expect(stripGenderTags('Fran (género: mujer) arrasó', NAMES)).toBe('Fran arrasó')
    expect(stripGenderTags('Javi — género: femenino, volvió', NAMES)).toBe('Javi, volvió')
  })

  it('leaves ordinary prose and unknown names alone', () => {
    const prose = 'Jose, hombre de pocas palabras, cumplió. Una mujer (mujer) cualquiera. Javi (la campeona) brilló.'
    expect(stripGenderTags(prose, NAMES)).toBe(prose)
    expect(stripGenderTags('Francisca (mujer) llegó', ['Fran'])).toBe('Francisca (mujer) llegó')
  })

  it('tolerates empty input', () => {
    expect(stripGenderTags('', NAMES)).toBe('')
    expect(stripGenderTags('Jose (hombre)', [undefined])).toBe('Jose (hombre)')
  })
})

describe('genderGuide', () => {
  it('lists grammatical gender apart from the data lines', () => {
    expect(genderGuide([{ name: 'Jose', gender: 'm' }, { name: 'Javi', gender: 'f' }])).toBe(
      'Género gramatical (solo para conjugar bien; NO lo escribas en el texto):\n- Jose: masculino\n- Javi: femenino')
    expect(genderGuide([{ name: 'X' }])).toBe('')
  })
})
