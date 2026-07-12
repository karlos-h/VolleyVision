// Shared detailed-heatmap builder, consumed by the analytics controller and
// the coaching recommendations service. Extracted here so neither imports the other.

export interface ZoneAttack  { kills: number; errors: number; attempts: number; hittingPct: number | null }
export interface ZoneServe   { aces: number; errors: number; serveIn: number; attempts: number; efficiency: number | null }
export interface ZonePass    { pass3: number; pass2: number; pass1: number; pass0: number; attempts: number; rating: number | null }
export interface ZoneDefence { digs: number; soloBlocks: number; blockAssists: number; total: number }

export type DetailedZoneStats = {
  attack:  Record<string, ZoneAttack>;
  serve:   Record<string, ZoneServe>;
  pass:    Record<string, ZonePass>;
  defence: Record<string, ZoneDefence>;
};

export function buildDetailedHeatmap(
  events: { courtZone: number | null; eventType: string }[],
): DetailedZoneStats {
  const ZONES = ['1', '2', '3', '4', '5', '6'];
  type Acc = {
    aKills: number; aErrors: number; aInPlay: number;
    sAces: number; sErrors: number; sIn: number;
    p3: number; p2: number; p1: number; p0: number;
    digs: number; soloBlocks: number; blockAssists: number;
  };
  const acc: Record<string, Acc> = {};
  for (const z of ZONES) {
    acc[z] = { aKills: 0, aErrors: 0, aInPlay: 0, sAces: 0, sErrors: 0, sIn: 0,
               p3: 0, p2: 0, p1: 0, p0: 0, digs: 0, soloBlocks: 0, blockAssists: 0 };
  }
  for (const e of events) {
    if (e.courtZone == null) continue;
    const z = String(e.courtZone);
    if (!acc[z]) continue;
    switch (e.eventType) {
      case 'KILL':           acc[z].aKills++;       break;
      case 'ATTACK_ERROR':   acc[z].aErrors++;      break;
      case 'ATTACK_ATTEMPT': acc[z].aInPlay++;      break;
      case 'TIP':            acc[z].aInPlay++;      break; // non-scoring attack attempt
      case 'FREE_BALL':      acc[z].aInPlay++;      break; // non-scoring attack attempt
      case 'ACE':            acc[z].sAces++;        break;
      case 'SERVICE_ERROR':  acc[z].sErrors++;      break;
      case 'SERVE_IN':       acc[z].sIn++;          break;
      case 'PASS_3':         acc[z].p3++;           break;
      case 'PASS_2':         acc[z].p2++;           break;
      case 'PASS_1':         acc[z].p1++;           break;
      case 'PASS_0':         acc[z].p0++;           break;
      case 'DIG':            acc[z].digs++;         break;
      case 'SOLO_BLOCK':     acc[z].soloBlocks++;   break;
      case 'BLOCK_ASSIST':   acc[z].blockAssists++; break;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const attack:  Record<string, ZoneAttack>  = {};
  const serve:   Record<string, ZoneServe>   = {};
  const pass:    Record<string, ZonePass>    = {};
  const defence: Record<string, ZoneDefence> = {};
  for (const z of ZONES) {
    const a = acc[z];
    const attackAttempts = a.aKills + a.aErrors + a.aInPlay;
    attack[z] = {
      kills: a.aKills, errors: a.aErrors, attempts: attackAttempts,
      hittingPct: attackAttempts > 0 ? r3((a.aKills - a.aErrors) / attackAttempts) : null,
    };
    const serveAttempts = a.sAces + a.sErrors + a.sIn;
    serve[z] = {
      aces: a.sAces, errors: a.sErrors, serveIn: a.sIn, attempts: serveAttempts,
      efficiency: serveAttempts > 0 ? r2((a.sAces - a.sErrors) / serveAttempts) : null,
    };
    const passAttempts = a.p3 + a.p2 + a.p1 + a.p0;
    pass[z] = {
      pass3: a.p3, pass2: a.p2, pass1: a.p1, pass0: a.p0, attempts: passAttempts,
      rating: passAttempts > 0 ? r2((3 * a.p3 + 2 * a.p2 + 1 * a.p1) / passAttempts) : null,
    };
    const defTotal = a.digs + a.soloBlocks + a.blockAssists;
    defence[z] = { digs: a.digs, soloBlocks: a.soloBlocks, blockAssists: a.blockAssists, total: defTotal };
  }
  return { attack, serve, pass, defence };
}
