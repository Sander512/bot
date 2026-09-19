// start.js
// Combined entry point: runs the Forever RP API and the Discord bot
// in a single Node.js process. Use this when you only want (or can only
// afford) ONE hosted service — e.g. a single Render Web Service — instead
// of a separate API service + background worker.
//
// Run with: node start.js
// (or: npm run start:all)
//
// Why this works: Render (and most PaaS providers) require a Web Service
// to bind to the assigned $PORT. The bot itself doesn't need a port — it
// connects out to Discord's gateway — so by loading both in the same
// process, Render sees the API's app.listen() as the "web service" while
// the bot quietly runs alongside it in the background.
//
// This entry point ALSO re-registers all slash commands with Discord on
// every boot, so you never have to manually run `npm run deploy` on hosts
// (like Render) where you don't have easy shell access — add/rename/remove
// a command file, push, and the next restart picks it up automatically.
//
// IMPORTANT: we wait for the API to actually be listening (app.listen's
// callback has fired) before starting the bot. Otherwise the bot's
// `ready` handler can try to call the API (e.g. /discord-guilds/sync)
// before Express is accepting connections yet — a race condition that
// shows up as "fetch failed" in the logs.

const deployCommands = require('./bot/deploy-commands');
const api = require('./api/server');

console.log('[START] Forever RP — gecombineerde modus (API + Bot in 1 proces)');

(async () => {
  // Wacht tot de API daadwerkelijk luistert voordat we verdergaan.
  // api/server.js moet hiervoor een `start()` functie exporteren die een
  // Promise teruggeeft die resolvet in de app.listen(...) callback.
  await api.start();

  try {
    await deployCommands();
  } catch (err) {
    // Don't crash the whole service over a failed command sync — the bot
    // and API can still function with whatever commands were last
    // registered. Just log it loudly so it's visible in the logs.
    console.error('[START] Slash command registratie mislukt (bot start toch door):', err);
  }

  // Logs the Discord bot in and starts listening for interactions.
  require('./bot/index');
})();