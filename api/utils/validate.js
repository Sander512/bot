// api/utils/validate.js
// Shared, strict input validation. Never trust data coming from Discord or the browser.

const DISCORD_ID_RE = /^[0-9]{15,25}$/;
const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

function isDiscordId(value) {
  return typeof value === 'string' && DISCORD_ID_RE.test(value);
}

function isPositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

function normalizeHexColor(value) {
  return value.replace('#', '').toLowerCase();
}

module.exports = {
  isDiscordId,
  isPositiveInteger,
  isHexColor,
  normalizeHexColor,
};
