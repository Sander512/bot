// api/routes/whitelist.js
// Optional join-gate. Only checked by Roblox when Config.WhitelistEnabled = true
// in ForeverIntegration.server.lua — disabled by default so it never blocks
// existing servers unless you turn it on. Powers /whitelist.

const express = require('express');
const { db } = require('../database');
const { isRobloxId, isDiscordId } = require('../utils/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

async function logAudit(action, discordId, robloxId, details) {
  await db.execute({
    sql: `INSERT INTO audit_logs (action, discord_id, roblox_id, details, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [action, discordId || null, robloxId || null, details || null, Date.now()],
  });
}

// POST /whitelist/add  { robloxId, robloxUsername, discordId, actorDiscordId }
router.post(
  '/add',
  asyncHandler(async (req, res) => {
    const { robloxId, robloxUsername, discordId, actorDiscordId } = req.body || {};

    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }
    if (discordId !== undefined && discordId !== null && !isDiscordId(discordId)) {
      return res.status(400).json({ error: 'Invalid discordId' });
    }

    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO whitelist (roblox_id, roblox_username, discord_id, added_by, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(roblox_id) DO UPDATE SET roblox_username = excluded.roblox_username, discord_id = excluded.discord_id`,
      args: [String(robloxId), robloxUsername || null, discordId || null, actorDiscordId || null, now],
    });

    await logAudit('WHITELIST_ADD', discordId, robloxId, `Toegevoegd door ${actorDiscordId || 'onbekend'}`);

    res.status(201).json({ success: true });
  })
);

// POST /whitelist/remove  { robloxId, actorDiscordId }
router.post(
  '/remove',
  asyncHandler(async (req, res) => {
    const { robloxId, actorDiscordId } = req.body || {};

    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }

    const result = await db.execute({ sql: 'DELETE FROM whitelist WHERE roblox_id = ?', args: [String(robloxId)] });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Roblox account staat niet op de whitelist' });
    }

    await logAudit('WHITELIST_REMOVE', null, robloxId, `Verwijderd door ${actorDiscordId || 'onbekend'}`);

    res.json({ success: true });
  })
);

// GET /whitelist/status/:robloxId — used by Roblox on join
router.get(
  '/status/:robloxId',
  asyncHandler(async (req, res) => {
    const { robloxId } = req.params;
    if (!isRobloxId(robloxId)) {
      return res.status(400).json({ error: 'Invalid robloxId' });
    }

    const result = await db.execute({ sql: 'SELECT 1 FROM whitelist WHERE roblox_id = ?', args: [robloxId] });
    res.json({ whitelisted: result.rows.length > 0 });
  })
);

// GET /whitelist/list
router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const result = await db.execute('SELECT * FROM whitelist ORDER BY created_at DESC');
    res.json({
      total: result.rows.length,
      entries: result.rows.map((w) => ({
        robloxId: w.roblox_id,
        robloxUsername: w.roblox_username,
        discordId: w.discord_id,
        addedBy: w.added_by,
        createdAt: w.created_at,
      })),
    });
  })
);

module.exports = router;
