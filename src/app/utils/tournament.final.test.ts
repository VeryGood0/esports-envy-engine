import { describe, it, expect } from 'vitest';
import { createCustomTournament, createEmptyPlayoffBracket, updateGroupMatchResult, updatePlayoffMatchResult } from './tournament';

describe('playoff final detection', () => {
  it('finishing a quarterfinal does not end the tournament', () => {
    const m = createEmptyPlayoffBracket(true).map((x) =>
      x.id === 'playoff_qf1' ? { ...x, teamAId: 'a', teamBId: 'b', status: 'ready' as const } : x
    );
    const res = updatePlayoffMatchResult(m, 'playoff_qf1', 2, 0, true, 'BO3');
    expect(res.isTournamentOver).toBe(false);
  });
});


describe('eight-team GSL groups and six-team playoff seeding', () => {
  const makeTeams = () => Array.from({ length: 16 }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    shortName: `T${i + 1}`,
    points: 1000 - i,
    defaultPoints: 1000 - i,
    logoUrl: '',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    country: 'Test',
    region: 'Test',
    rosterSnippet: []
  } as any));

  it('generates 12 games per eight-team group with no extra match after the lower final', () => {
    const tournament = createCustomTournament({
      name: 'GSL test',
      mode: 'gsl_groups',
      teams: makeTeams(),
      stageFormats: { groupCount: 2, groupStyle: 'gsl', groupFormat: 'BO1' }
    });

    expect(tournament.groups).toHaveLength(2);
    for (const group of tournament.groups || []) {
      expect(group.teamIds).toHaveLength(8);
      expect(group.matches).toHaveLength(12);
      expect(group.matches.some((m) => m.poolKey.endsWith('_lf'))).toBe(false);
      expect(group.matches.find((m) => m.poolKey.endsWith('_u1_1'))?.teamAId).toBe(group.teamIds[0]);
      expect(group.matches.find((m) => m.poolKey.endsWith('_u1_1'))?.teamBId).toBe(group.teamIds[7]);
      expect(group.matches.find((m) => m.poolKey.endsWith('_u1_2'))?.teamAId).toBe(group.teamIds[3]);
      expect(group.matches.find((m) => m.poolKey.endsWith('_u1_2'))?.teamBId).toBe(group.teamIds[4]);
      expect(group.matches.find((m) => m.poolKey.endsWith('_ls'))?.sourceA).toBe(`gsl_${group.letter}_l2_1`);
      expect(group.matches.find((m) => m.poolKey.endsWith('_ls'))?.sourceB).toBe(`gsl_${group.letter}_l2_2`);
    }
  });

  it('crosses second- and third-place teams and places group winners in opposite semifinals', () => {
    let tournament = createCustomTournament({
      name: 'GSL seeding test',
      mode: 'gsl_groups',
      teams: makeTeams(),
      stageFormats: { groupCount: 2, groupStyle: 'gsl', groupFormat: 'BO1', semifinalFormat: 'BO3' }
    });

    let guard = 0;
    while (tournament.currentStage !== 'playoffs' && guard++ < 100) {
      const readyMatch = (tournament.groupMatches || []).find((m) => m.status === 'ready' && m.teamAId && m.teamBId);
      if (!readyMatch) break;
      tournament = updateGroupMatchResult(tournament, readyMatch.id, 1, 0, 'BO1').updatedTournament;
    }

    expect(tournament.currentStage).toBe('playoffs');
    const groupA = tournament.groups?.find((g) => g.letter === 'A')!;
    const groupB = tournament.groups?.find((g) => g.letter === 'B')!;
    const qf1 = tournament.playoffMatches.find((m) => m.poolKey === 'qf1')!;
    const qf2 = tournament.playoffMatches.find((m) => m.poolKey === 'qf2')!;
    const sf1 = tournament.playoffMatches.find((m) => m.poolKey === 'sf1')!;
    const sf2 = tournament.playoffMatches.find((m) => m.poolKey === 'sf2')!;

    expect(groupA.qualifiedTeamIds).toHaveLength(3);
    expect(groupB.qualifiedTeamIds).toHaveLength(3);
    expect(qf1.teamAId).toBe(groupA.qualifiedTeamIds?.[1]);
    expect(qf1.teamBId).toBe(groupB.qualifiedTeamIds?.[2]);
    expect(qf2.teamAId).toBe(groupB.qualifiedTeamIds?.[1]);
    expect(qf2.teamBId).toBe(groupA.qualifiedTeamIds?.[2]);
    expect(sf1.teamAId).toBe(groupB.qualifiedTeamIds?.[0]);
    expect(sf2.teamAId).toBe(groupA.qualifiedTeamIds?.[0]);
  });
});
