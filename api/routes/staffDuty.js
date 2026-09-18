// api/routes/staffDuty.js
// Staff on-duty tracking. Fed by the Roblox script watching the existing
// "Staffdienst" BoolValue (the in-game staff-vest toggle). Powers /staffactivity.

const express = require('express');
const { db } = require('../database');
const { isRobloxId, isDiscordId } = require('../utils/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /staff-duty/toggle  { robloxId, robloxUsername, onDuty, discordId? }
// Called by Roblox every time Staffdienst.Value changes (and once on join
// with the current value, and once on leave with onDuty=false as a safety net).
router.post(
  '/toggle',
  asyncHandler(async (req, res) => {
    const { robloxId, robloxUsername, onDuty, discordId } = req.body || {};

    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }
    if (typeof onDuty !== 'boolean') {
      return res.status(400).json({ error: 'onDuty must be a boolean' });
    }
    if (discordId !== undefined && discordId !== null && !isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid discordId' });
    }

    const now = Date.now();
    const existingResult = await db.execute({
      sql: 'SELECT * FROM staff_duty WHERE roblox_id = ?',
      args: [String(robloxId)],
    });
    const existing = existingResult.rows[0];

    if (!existing) {
      await db.execute({
        sql: `INSERT INTO staff_duty (roblox_id, roblox_username, discord_id, on_duty, duty_started_at, total_duty_seconds, updated_at)
              VALUES (?, ?, ?, ?, ?, 0, ?)`,
        args: [String(robloxId), robloxUsername || null, discordId || null, onDuty ? 1 : 0, onDuty ? now : null, now],
      });
    } else {
      let totalSeconds = existing.total_duty_seconds;
      let startedAt = existing.duty_started_at;

      if (existing.on_duty && !onDuty) {
        // Going off duty — add the elapsed session to the running total.
        if (existing.duty_started_at) {
          totalSeconds += Math.floor((now - existing.duty_started_at) / 1000);
        }
        startedAt = null;
      } else if (!existing.on_duty && onDuty) {
        // Going on duty — start a new session.
        startedAt = now;
      }

      await db.execute({
        sql: `UPDATE staff_duty
              SET roblox_username = ?, discord_id = COALESCE(?, discord_id), on_duty = ?, duty_started_at = ?, total_duty_seconds = ?, updated_at = ?
              WHERE roblox_id = ?`,
        args: [robloxUsername || existing.roblox_username, discordId || null, onDuty ? 1 : 0, startedAt, totalSeconds, now, String(robloxId)],
      });
    }

    res.json({ success: true });
  })
);

// GET /staff-duty/active — everyone currently on duty
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const result = await db.execute(`SELECT * FROM staff_duty WHERE on_duty = 1 ORDER BY duty_started_at ASC`);
    res.json({
      staff: result.rows.map((s) => ({
        robloxId: s.roblox_id,
        robloxUsername: s.roblox_username,
        discordId: s.discord_id,
        dutyStartedAt: s.duty_started_at,
      })),
    });
  })
);

// GET /staff-duty/leaderboard?limit=10 — lifetime duty-time ranking
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 25);
    const now = Date.now();

    const result = await db.execute(`SELECT * FROM staff_duty ORDER BY total_duty_seconds DESC LIMIT ${limit}`);

    res.json({
      staff: result.rows.map((s) => {
        // Include the current running session so the leaderboard reflects
        // "right now", not just completed sessions.
        const liveExtra = s.on_duty && s.duty_started_at ? Math.floor((now - s.duty_started_at) / 1000) : 0;
        return {
          robloxId: s.roblox_id,
          robloxUsername: s.roblox_username,
          discordId: s.discord_id,
          onDuty: !!s.on_duty,
          totalDutySeconds: s.total_duty_seconds + liveExtra,
        };
      }),
    });
  })
);

module.exports = router;
