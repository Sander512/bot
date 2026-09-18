// api/routes/warnings.js
// A moderation history separate from bans/kicks — staff can log a warning
// against a player without taking further action. Powers /warn + /warnings.

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

// POST /warnings/create  { discordId, robloxId, reason, staffId }
router.post(
  '/create',
  asyncHandler(async (req, res) => {
    const { discordId, robloxId, reason, staffId } = req.body || {};

    if (!isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid or missing discordId' });
    }
    if (robloxId !== undefined && robloxId !== null && !isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }
    if (typeof reason !== 'string' || reason.length < 1 || reason.length > 500) {
      return res.status(400).json({ error: 'reason must be a non-empty string (max 500 chars)' });
    }
    if (!isDiscordId(staffId)) {
      return res.status(400).json({ error: 'Invalid or missing staffId' });
    }

    const now = Date.now();
    const result = await db.execute({
      sql: `INSERT INTO warnings (discord_id, roblox_id, reason, staff_id, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)`,
      args: [discordId, robloxId ? String(robloxId) : null, reason, staffId, now],
    });

    await logAudit('WARN', discordId, robloxId, `${reason} (door ${staffId})`);

    res.status(201).json({ id: Number(result.lastInsertRowid), createdAt: now });
  })
);

// GET /warnings/:discordId
router.get(
  '/:discordId',
  asyncHandler(async (req, res) => {
    const { discordId } = req.params;
    if (!isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid discordId' });
    }

    const result = await db.execute({
      sql: `SELECT * FROM warnings WHERE discord_id = ? ORDER BY created_at DESC`,
      args: [discordId],
    });

    res.json({
      total: result.rows.length,
      activeCount: result.rows.filter((w) => w.active).length,
      warnings: result.rows.map((w) => ({
        id: w.id,
        reason: w.reason,
        staffId: w.staff_id,
        active: !!w.active,
        createdAt: w.created_at,
      })),
    });
  })
);

// POST /warnings/revoke  { id, actorDiscordId }
router.post(
  '/revoke',
  asyncHandler(async (req, res) => {
    const { id, actorDiscordId } = req.body || {};
    const warningId = parseInt(id, 10);

    if (!Number.isInteger(warningId) || warningId <= 0) {
      return res.status(400).json({ error: 'Invalid warning id' });
    }

    const result = await db.execute({ sql: 'SELECT * FROM warnings WHERE id = ?', args: [warningId] });
    const warning = result.rows[0];
    if (!warning) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    await db.execute({ sql: `UPDATE warnings SET active = 0 WHERE id = ?`, args: [warningId] });
    await logAudit('WARN_REVOKE', warning.discord_id, warning.roblox_id, `Warning #${warningId} ingetrokken door ${actorDiscordId || 'onbekend'}`);

    res.json({ success: true });
  })
);

module.exports = router;
