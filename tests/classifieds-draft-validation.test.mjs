import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDraft, createDraft, updateClassifiedDraft } from '../src/classifieds/repository.ts';

const draft = {
  city: 'Енисейск', deal_type: 'sell', category: 'Мебель',
  title: 'Стол письменный', description: 'Состояние хорошее, самовывоз',
  district: '', price_rub: null,
};

for (const [name, values, reason] of [
  ['city', { city: ['', '   ', null, undefined, 5] }, /город/],
  ['deal type', { deal_type: ['', 'SELL', 'auction', 'constructor', '__proto__', 'toString', null, undefined] }, /тип объявления/],
  ['title', { title: ['', 'abcd', 'x'.repeat(141), null, undefined, 42] }, /Название/],
  ['description', { description: ['x'.repeat(14), 'x'.repeat(4001), null, undefined, 42] }, /Описание/],
  ['category', { category: ['', 'x', 'x'.repeat(81), null, undefined, 42] }, /категорию/],
  ['district', { district: ['x'.repeat(101), null, undefined, 42] }, /района/],
  ['price', { price_rub: [-0.01, 1000000000, NaN, Infinity, -Infinity, '', '10', undefined] }, /цену/],
]) {
  test(`invalid ${name} is rejected before either persistence operation`, async () => {
    const client = { from() { assert.fail('Invalid draft must not reach the database'); } };
    const [field, cases] = Object.entries(values)[0];
    for (const value of cases) {
      const invalid = { ...draft, [field]: value };
      assert.match(validateDraft(invalid), reason);
      await assert.rejects(createDraft(client, invalid), reason);
      await assert.rejects(updateClassifiedDraft(client, 'listing', 'seller', invalid), reason);
    }
  });
}

test('accepts supported deal types, schema boundaries and additional city names', () => {
  for (const deal_type of ['sell', 'buy', 'rent_out', 'rent_in']) {
    for (const price_rub of [null, 0, 0.01, 999999999.99]) {
      assert.equal(validateDraft({ ...draft, deal_type, price_rub }), null);
    }
  }
  for (const [title, description, category, district] of [
    ['x'.repeat(5), 'x'.repeat(15), 'xx', ''],
    ['x'.repeat(140), 'x'.repeat(4000), 'x'.repeat(80), 'x'.repeat(100)],
  ]) {
    assert.equal(validateDraft({ ...draft, city: 'Новый город', title, description, category, district }), null);
  }
});

test('create persists trimmed text and city without accepting privilege fields', async () => {
  let payload;
  const client = { from(table) {
    assert.equal(table, 'classifieds');
    return { insert(value) { payload = value; return Promise.resolve({ error: null }); } };
  } };
  await createDraft(client, { ...draft, city: ' Енисейск ', title: ' Стол письменный ',
    description: ' Состояние хорошее, самовывоз ', category: ' Мебель ', district: ' Центр ',
    author_id: 'other', status: 'published', role: 'owner' });
  assert.deepEqual(payload, { ...draft, district: 'Центр' });
});
