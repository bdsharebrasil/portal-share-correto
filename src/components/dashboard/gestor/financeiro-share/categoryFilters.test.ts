// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import { agruparCategoriasPorGrupo, categoriaCorrespondeAoTipo, formatarCategoriaParaLabel } from './categoryFilters';

test('filtra categorias exatamente pelo tipo selecionado', () => {
  assert.equal(categoriaCorrespondeAoTipo('despesa', 'despesa'), true);
  assert.equal(categoriaCorrespondeAoTipo('despesa', 'saida'), false);
  assert.equal(categoriaCorrespondeAoTipo('saida', 'saida'), true);
  assert.equal(categoriaCorrespondeAoTipo('receita', 'receita'), true);
  assert.equal(categoriaCorrespondeAoTipo('entrada', 'entrada'), true);
  assert.equal(categoriaCorrespondeAoTipo('receita', 'entrada'), false);
  assert.equal(categoriaCorrespondeAoTipo('estorno', 'receita'), true);
});

test('formata o rótulo com grupo e subcategoria', () => {
  assert.equal(
    formatarCategoriaParaLabel({ nome: 'Internet', grupo_categoria: 'DESPESAS EMPRESA' }),
    'DESPESAS EMPRESA › Internet',
  );
  assert.equal(
    formatarCategoriaParaLabel({ nome: 'Recebimento', grupo_categoria: '' }),
    'SEM GRUPO › Recebimento',
  );
});

test('agrupar categorias por grupo deixa apenas o grupo visível primeiro', () => {
  const agrupadas = agruparCategoriasPorGrupo([
    { nome: 'Internet', grupo_categoria: 'DESPESAS EMPRESA', tipo: 'despesa' },
    { nome: 'Luz', grupo_categoria: 'DESPESAS EMPRESA', tipo: 'despesa' },
    { nome: 'Combustível', grupo_categoria: 'OPERACIONAL', tipo: 'despesa' },
    { nome: 'Recebimento', grupo_categoria: 'RECEITAS', tipo: 'receita' },
  ], 'despesa');

  assert.deepEqual(
    agrupadas.map((g) => g.grupo),
    ['DESPESAS EMPRESA', 'OPERACIONAL'],
  );
  assert.deepEqual(
    agrupadas[0].categorias.map((c) => c.nome),
    ['Internet', 'Luz'],
  );
});
