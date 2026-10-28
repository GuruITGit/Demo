const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '.build/finance.js'), 'utf8'), context);
const { calculateFirstCharge, dailyWasteRate } = context;

test('monthly rent and waste include the start date through month end', () => {
  assert.equal(calculateFirstCharge(1200, 30, 'monthly', '2026-10-25'), 278);
});

test('monthly proration handles leap February and the last day of a month', () => {
  assert.equal(calculateFirstCharge(1200, 30, 'monthly', '2024-02-10'), 848);
  assert.equal(calculateFirstCharge(1200, 30, 'monthly', '2026-01-31'), 40);
});

test('daily lease prorates monthly waste by the actual calendar month', () => {
  assert.equal(calculateFirstCharge(80, 30, 'daily', '2026-10-25', 3), 243);
  assert.equal(dailyWasteRate(30, '2024-02-29'), 30 / 29);
});

test('daily lease splits waste correctly when it crosses month boundaries', () => {
  assert.equal(calculateFirstCharge(80, 30, 'daily', '2026-02-27', 5), 405);
});

test('invalid dates, rates, periods, and rental lengths are rejected', () => {
  const invalid = (fn) => assert.throws(fn, (error) => error.name === 'RangeError');
  invalid(() => calculateFirstCharge(1200, 30, 'monthly', '2026-02-30'));
  invalid(() => calculateFirstCharge(-1, 30, 'monthly', '2026-10-25'));
  invalid(() => calculateFirstCharge(80, 30, 'daily', '2026-10-25', 0));
  invalid(() => calculateFirstCharge(80, 30, 'weekly', '2026-10-25', 1));
});
