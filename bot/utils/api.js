// bot/utils/api.js
// Thin HTTP client the bot uses to talk to the Community API.
// Every request is authenticated with X-API-Key.

const config = require('../config');

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, body) {
  const url = `${config.api.baseUrl}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.api.key,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(`Kon geen verbinding maken met de API (${url}): ${err.message}`, 0, null);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = (data && data.error) || `API request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

const api = {
  ApiError,

  // ---- Discord guilds (powers the dashboard's "kies een server" screen) ----
  syncDiscordGuilds: (guilds) => request('POST', '/discord-guilds/sync', { guilds }),
  upsertDiscordGuild: (id, name, icon) => request('POST', '/discord-guilds/upsert', { id, name, icon }),
  removeDiscordGuild: (guildId) => request('DELETE', `/discord-guilds/${guildId}`),

  // ---- Welcome messages ----
  getWelcomeConfig: (guildId) => request('GET', `/welcome/config/${guildId}`),

  // ---- Giveaways ----
  createGiveaway: (data) => request('POST', '/giveaways/create', data),
  enterGiveaway: (id, userId) => request('POST', '/giveaways/enter', { id, userId }),
  getActiveGiveaways: () => request('GET', '/giveaways/active'),
  getGiveaway: (id) => request('GET', `/giveaways/${id}`),
  listGuildGiveaways: (guildId, status) => request('GET', `/giveaways/guild/${guildId}${status ? `?status=${status}` : ''}`),
  endGiveaway: (id, winners) => request('POST', '/giveaways/end', { id, winners }),
  rerollGiveaway: (id, winners) => request('POST', '/giveaways/reroll', { id, winners }),
  cancelGiveaway: (id) => request('POST', '/giveaways/cancel', { id }),
};

module.exports = api;
