import { SLUG_PATTERN, slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Barbería Centro', 'barberia-centro'],
    ['  Café & Té!! ', 'cafe-te'],
    ['Peluquería  Ñandú 24/7', 'peluqueria-nandu-24-7'],
  ])('turns "%s" into "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(slugify(input)).toMatch(SLUG_PATTERN);
  });

  it('caps the length at 60 without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});
