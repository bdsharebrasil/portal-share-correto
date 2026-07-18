import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFuelRecordPartnerName } from './fuelRecordsUtils.ts';

test('prefers nome_socio when available', () => {
  const name = resolveFuelRecordPartnerName({
    nome_socio: 'João da Silva',
    partner_name: 'Maria da Silva',
  });

  assert.equal(name, 'João da Silva');
});

test('falls back to partner_name when nome_socio is missing', () => {
  const name = resolveFuelRecordPartnerName({
    partner_name: 'Maria da Silva',
  });

  assert.equal(name, 'Maria da Silva');
});

test('falls back to socio_nome when other fields are empty', () => {
  const name = resolveFuelRecordPartnerName({
    socio_nome: 'Carlos Pereira',
  });

  assert.equal(name, 'Carlos Pereira');
});

test('returns empty string when no partner name exists', () => {
  const name = resolveFuelRecordPartnerName({});

  assert.equal(name, '');
});
