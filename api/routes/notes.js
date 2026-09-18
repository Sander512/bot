// api/routes/notes.js
// Free-form staff notes attached to a player's account, surfaced in /userinfo.
// Not a punishment log — see routes/warnings.js for that.

const express = require('express');
const { db } = require('../database');
const { isDiscordId, isRobloxId } = require('../utils/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

async function logAudit(action, discordId, robloxId, details) {
  await db.execute({
    sql: `INSERT INTO audit_logs (action, discord_id, roblox_id, details, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [action, discordId || null, robloxId || null, details || null, Date.now()],
  });
}

// POST /notes/create  { discordId, robloxId, note, staffId }
router.post(
  '/create',
  asyncHandler(async (req, res) => {
    const { discordId, robloxId, note, staffId } = req.body || {};

    if (!isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid or missing discordId' });
    }
    if (robloxId !== undefined && robloxId !== null && !isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }
    if (typeof note !== 'string' || note.length < 1 || note.length > 1000) {
      return res.status(400).json({ error: 'note must be a non-empty string (max 1000 chars)' });
    }
    if (!isDiscordId(staffId)) {
      return res.status(400).json({ error: 'Invalid or missing staffId' });
    }

    const now = Date.now();
    const result = await db.execute({
      sql: `INSERT INTO player_notes (discord_id, roblox_id, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [discordId, robloxId ? String(robloxId) : null, note, staffId, now],
    });

    await logAudit('NOTE_ADD', discordId, robloxId, `${note} (door ${staffId})`);

    res.status(201).json({ id: Number(result.lastInsertRowid), createdAt: now });
  })
);

// GET /notes/:discordId
router.get(
  '/:discordId',
  asyncHandler(async (req, res) => {
    const { discordId } = req.params;
    if (!isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid discordId' });
    }

    const result = await db.execute({
      sql: `SELECT * FROM player_notes WHERE discord_id = ? ORDER BY created_at DESC`,
      args: [discordId],
    });

    res.json({
      total: result.rows.length,
      notes: result.rows.map((n) => ({
        id: n.id,
        note: n.note,
        staffId: n.staff_id,
        createdAt: n.created_at,
      })),
    });
  })
);

module.exports = router;
