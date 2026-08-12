import { describe, expect, it } from 'vitest';
import { formatCompactCurrencyBRL, formatCurrencyBRL, formatPercent } from './domain';

describe('formatação executiva dos gráficos', () => {
  it.each([
    [950, 'R$ 950'],
    [12_500, 'R$ 12,5 mil'],
    [589_432, 'R$ 589,4 mil'],
    [1_450_000, 'R$ 1,45 mi'],
    [12_458_734.9, 'R$ 12,46 mi'],
  ])('compacta %s sem perder a unidade', (value, expected) => expect(formatCompactCurrencyBRL(value)).toBe(expected));
  it('mantém o valor completo em tooltips', () => expect(formatCurrencyBRL(1_234_567.89)).toBe('R$ 1.234.567,89'));
  it('limita percentuais a uma casa decimal', () => expect(formatPercent(0.186)).toBe('18,6%'));
});
