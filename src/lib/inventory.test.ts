import { test } from 'node:test';
import assert from 'node:assert/strict';
import { divideText, inputCents } from './inventory';

test('Belgian prices retain cents and do not guess ambiguous values', () => {
  assert.equal(inputCents('€ 45,50'), 4550);
  assert.equal(inputCents('1.245,99'), 124599);
  assert.equal(inputCents('45.50'), 4550);
  assert.equal(inputCents(''), null);
  assert.equal(inputCents('0'), 0);
  assert.ok(Number.isNaN(inputCents('45 of 50')));
  assert.ok(Number.isNaN(inputCents('-45')));
  assert.ok(Number.isNaN(inputCents('1.234')));
});
test('text distribution preserves unrecognized and multiline text without inventing fields', () => {
  const result = divideText('Herkomst nog nakijken\nTitel: Groene vaas\nBeschrijving: Eerste zin\nTweede zin\nStijl / Periode: Onbekend\nAfmetingen: H 24 cm\nConditie: Chip onderaan\nPrijs: € 45,50');
  assert.equal(result.remainder, 'Herkomst nog nakijken');
  assert.deepEqual(result.fields, { title: 'Groene vaas', description: 'Eerste zin\nTweede zin', date: 'Onbekend', dimensions: 'H 24 cm', condition: 'Chip onderaan', price: '€ 45,50' });
  assert.deepEqual(divideText('Een vaas uit een erfenis').fields, {});
  assert.equal(divideText('Een vaas uit een erfenis').remainder, 'Een vaas uit een erfenis');
});
