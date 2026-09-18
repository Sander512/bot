// api/routes/playerStats.js
// Periodic stats snapshot reported by Roblox (one call per online player,
// same spirit as the server heartbeat) so /playerstats and /leaderboard
// work without needing that player online at query time.

const express = require('express');
const { db } = require('../database');
const { isRobloxId, isPositiveInteger } = require('../utils/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const SORT_COLUMNS = { cash: 'cash', bank: 'bank', xp: 'xp', playtime: 'playtime_minutes' };

// POST /player-stats/report  { robloxId, robloxUsername, discordId?, cash, bank, xp, playtimeMinutes }
router.post(
  '/report',
  asyncHandler(async (req, res) => {
    const { robloxId, robloxUsername, discordId, cash, bank, xp, playtimeMinutes } = req.body || {};

    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }
    const safeCash = isPositiveInteger(cash, 1_000_000_000) ? cash : 0;
    const safeBank = isPositiveInteger(bank, 1_000_000_000) ? bank : 0;
    const safeXp = isPositiveInteger(xp, 1_000_000_000) ? xp : 0;
    const safePlaytime = isPositiveInteger(playtimeMinutes, 1_000_000) ? playtimeMinutes : 0;

    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO player_stats (roblox_id, roblox_username, discord_id, cash, bank, xp, playtime_minutes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(roblox_id) DO UPDATE SET
              roblox_username = excluded.roblox_username,
              discord_id = COALESCE(excluded.discord_id, player_stats.discord_id),
              cash = excluded.cash, bank = excluded.bank, xp = excluded.xp,
              playtime_minutes = excluded.playtime_minutes, updated_at = excluded.updated_at`,
      args: [String(robloxId), robloxUsername || null, discordId || null, safeCash, safeBank, safeXp, safePlaytime, now],
    });

    res.json({ success: true });
  })
);

// GET /player-stats/:robloxId
router.get(
  '/:robloxId',
  asyncHandler(async (req, res) => {
    const { robloxId } = req.params;
    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }

    const result = await db.execute({ sql: 'SELECT * FROM player_stats WHERE roblox_id = ?', args: [robloxId] });
    const row = result.rows[0];
    if (!row) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      robloxId: row.roblox_id,
      robloxUsername: row.roblox_username,
      cash: row.cash,
      bank: row.bank,
      xp: row.xp,
      playtimeMinutes: row.playtime_minutes,
      updatedAt: row.updated_at,
    });
  })
);

// GET /player-stats/leaderboard/top?sort=cash|bank|xp|playtime&limit=10
router.get(
  '/leaderboard/top',
  asyncHandler(async (req, res) => {
    const sortKey = SORT_COLUMNS[req.query.sort] || 'cash';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 25);

    const result = await db.execute(
      `SELECT roblox_id, roblox_username, cash, bank, xp, playtime_minutes FROM player_stats ORDER BY ${sortKey} DESC LIMIT ${limit}`
    );

    res.json({
      sort: Object.keys(SORT_COLUMNS).find((k) => SORT_COLUMNS[k] === sortKey),
      players: result.rows.map((r) => ({
        robloxId: r.roblox_id,
        robloxUsername: r.roblox_username,
        cash: r.cash,
        bank: r.bank,
        xp: r.xp,
        playtimeMinutes: r.playtime_minutes,
      })),
    });
  })
);

module.exports = router;
