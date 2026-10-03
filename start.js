// start.js
// Combined entry point: runs the community API (dashboard) and the Discord
// bot in a single Node.js process. Handig als je maar ÉÉN hosted service
// wilt gebruiken (bv. één Render Web Service).
//
// Run with: node start.js
// (or: npm run start:all)
//
// Waarom dit werkt: een Web Service moet binden aan de toegewezen $PORT.
// De bot zelf heeft geen poort nodig — die verbindt uitgaand met Discord —
// dus we laden beide in hetzelfde proces. De API is dan de "web service"
// en de bot draait ernaast op de achtergrond.
//
// Deze entry point registreert ook bij elke start alle slash commands
// opnieuw bij Discord, dus je hoeft `npm run deploy` niet handmatig te
// draaien: voeg een command toe/hernoem/verwijder, herstart, klaar.

const deployCommands = require('./bot/deploy-commands');

console.log('[START] Community bot — gecombineerde modus (API + Bot in 1 proces)');

// Starts the Express API and binds to process.env.PORT / API_PORT.
require('./api/server');

(async () => {
  try {
    await deployCommands();
  } catch (err) {
    // Een mislukte command-sync mag de hele service niet laten crashen.
    console.error('[START] Slash command registratie mislukt (bot start toch door):', err);
  }

  // Logs the Discord bot in and starts listening for interactions.
  require('./bot/index');
})();
