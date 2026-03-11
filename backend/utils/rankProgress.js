const pool = require('../db');

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Converts totalSp into rank progress using company-scoped rank_rules.
 * Returns: { totalSp, rankName, nextRank, nextRankAt, progressPct }
 */
async function computeRankProgress(totalSp, company_id) {
  const sp = Math.max(0, Math.floor(num(totalSp)));

  // current rank (company scoped)
  const { rows: curRows } = await pool.query(
    `SELECT name, min_sp, badge_color
       FROM rank_rules
      WHERE min_sp <= $1
        AND company_id = $2
      ORDER BY min_sp DESC
      LIMIT 1`,
    [sp, company_id]
  );

  const rankName = curRows?.[0]?.name || 'Rookie';
  const badgeColor = curRows?.[0]?.badge_color || 'gray';
  const curMin = num(curRows?.[0]?.min_sp ?? 0);

  // next rank (company scoped)
  const { rows: nextRows } = await pool.query(
    `SELECT name, min_sp
       FROM rank_rules
      WHERE min_sp > $1
        AND company_id = $2
      ORDER BY min_sp ASC
      LIMIT 1`,
    [sp, company_id]
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
    badgeColor,
    nextRank,
    nextRankAt,
    progressPct,
  };
}

module.exports = { computeRankProgress };