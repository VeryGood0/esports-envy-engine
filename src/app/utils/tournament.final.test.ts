import { describe, it, expect } from 'vitest';
import { createEmptyPlayoffBracket, updatePlayoffMatchResult } from './tournament';

describe('playoff final detection', () => {
  it('finishing a quarterfinal does not end the tournament', () => {
    const m = createEmptyPlayoffBracket(true).map((x) =>
      x.id === 'playoff_qf1' ? { ...x, teamAId: 'a', teamBId: 'b', status: 'ready' as const } : x
    );
    const res = updatePlayoffMatchResult(m, 'playoff_qf1', 2, 0, true, 'BO3');
    expect(res.isTournamentOver).toBe(false);
  });
});
