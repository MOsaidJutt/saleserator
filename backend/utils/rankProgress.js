const pool = require('../db');

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Converts totalSp into:
 * {
 *   totalSp,
 *   rankName,
 *   nextRank,
 *   nextRankAt,
 *   progressPct
 * }
 */
async function computeRankProgress(totalSp) {
  const sp = Math.max(0, Math.floor(num(totalSp)));

  // current rank
  const { rows: curRows } = await pool.query(
    `SELECT name, min_sp
       FROM rank_rules
      WHERE min_sp <= $1
      ORDER BY min_sp DESC
      LIMIT 1`,
    [sp]
  );

  const rankName = curRows?.[0]?.name || 'Rookie';
  const curMin = num(curRows?.[0]?.min_sp ?? 0);

  // next rank
  const { rows: nextRows } = await pool.query(
    `SELECT name, min_sp
       FROM rank_rules
      WHERE min_sp > $1
      ORDER BY min_sp ASC
      LIMIT 1`,
    [sp]
  );

  const nextRank = nextRows?.[0]?.name || rankName;
  const nextRankAt =
    nextRows?.[0]?.min_sp != null ? num(nextRows[0].min_sp) : sp;

  let progressPct = 100;
  if (nextRankAt > curMin) {
    progressPct = Math.round(
      ((sp - curMin) / (nextRankAt - curMin)) * 100
    );
    progressPct = Math.max(0, Math.min(100, progressPct));
  }

  return {
    totalSp: sp,
    rankName,
    nextRank,
    nextRankAt,
    progressPct,
  };
}

module.exports = { computeRankProgress };
