// public/dashboard/app.js
// Auth flow: "Inloggen met Discord" (server-side OAuth, /auth/discord) sets
// an httpOnly session cookie — the browser never sees an API key. This
// file just calls /auth/me to find out who's logged in and which servers
// they can manage, lets them pick one, then drives the welcome and
// giveaway APIs using that cookie (credentials: 'include').

const state = {
  guildId: '',
  guildName: '',
  guilds: [],
};

const $ = (id) => document.getElementById(id);

const SELECTED_GUILD_KEY = 'communityDashboardSelectedGuild';

function loadSelectedGuild() {
  return sessionStorage.getItem(SELECTED_GUILD_KEY) || '';
}

function saveSelectedGuild(guildId) {
  sessionStorage.setItem(SELECTED_GUILD_KEY, guildId);
}

function clearSelectedGuild() {
  sessionStorage.removeItem(SELECTED_GUILD_KEY);
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function guildIconUrl(guild) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
}

function showScreen(name) {
  $('loginScreen').classList.toggle('hidden', name !== 'login');
  $('pickerScreen').classList.toggle('hidden', name !== 'picker');
  $('app').classList.toggle('hidden', name !== 'app');
}

// ---- Login screen ----
const LOGIN_ERROR_MESSAGES = {
  invalid_state: 'Inloggen mislukt (verlopen of ongeldige sessie). Probeer het opnieuw.',
  token_exchange_failed: 'Discord heeft de login geweigerd. Probeer het opnieuw.',
  access_denied: 'Je hebt het inloggen geannuleerd.',
};

function showLoginErrorFromUrl() {
  const params = new URLSearchParams(location.search);
  const err = params.get('login_error');
  if (err) {
    $('loginError').textContent = LOGIN_ERROR_MESSAGES[err] || `Inloggen mislukt: ${err}`;
    history.replaceState(null, '', location.pathname);
  }
}

// ---- Server picker ----
function renderPicker() {
  const list = $('pickerList');

  if (state.guilds.length === 0) {
    list.innerHTML =
      '<div class="empty-state">Geen servers gevonden waar je beheerrechten hebt én de bot in zit.<br />Zorg dat de bot is uitgenodigd op je server en je daar "Server beheren" of Administrator rechten hebt.</div>';
    return;
  }

  list.innerHTML = '';
  state.guilds.forEach((g) => {
    const row = document.createElement('button');
    row.className = 'picker-row';
    const iconUrl = guildIconUrl(g);
    row.innerHTML = `
      ${iconUrl
        ? `<img class="picker-icon" src="${iconUrl}" alt="" />`
        : `<div class="picker-icon picker-icon-fallback">${escapeHtml((g.name || '?').charAt(0).toUpperCase())}</div>`
      }
      <div class="picker-name">${escapeHtml(g.name)}</div>
      <span class="picker-arrow">→</span>
    `;
    row.addEventListener('click', () => selectGuild(g));
    list.appendChild(row);
  });
}

function selectGuild(guild) {
  state.guildId = guild.id;
  state.guildName = guild.name;
  saveSelectedGuild(guild.id);
  boot();
}

$('pickerLogoutBtn').addEventListener('click', logout);
$('switchServerBtn').addEventListener('click', () => {
  clearSelectedGuild();
  showScreen('picker');
});

async function logout() {
  try {
    await api('POST', '/auth/logout');
  } catch {
    // ignore — clearing local state below is enough either way
  }
  clearSelectedGuild();
  state.guildId = '';
  state.guilds = [];
  showScreen('login');
}

$('logoutBtn').addEventListener('click', logout);

// ---- Tabs ----
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.remove('hidden');

    const titles = {
      welcome: ['Welkomstbericht', 'Stel in wat er gebeurt zodra iemand de server joint.'],
      giveaways: ['Giveaways', 'Overzicht van lopende en afgelopen giveaways in deze server.'],
    };
    $('pageTitle').textContent = titles[btn.dataset.tab][0];
    $('pageSubtitle').textContent = titles[btn.dataset.tab][1];

    if (btn.dataset.tab === 'giveaways') loadGiveaways();
    if (btn.dataset.tab === 'welcome') loadWelcomeConfig();
  });
});

// ---- Giveaways tab (read-only) ----
async function loadGiveaways() {
  const activeList = $('activeGiveawaysList');
  const endedList = $('endedGiveawaysList');
  activeList.innerHTML = '<div class="empty-state">Laden...</div>';
  endedList.innerHTML = '<div class="empty-state">Laden...</div>';

  try {
    const [{ giveaways: active }, { giveaways: ended }] = await Promise.all([
      api('GET', `/giveaways/guild/${state.guildId}?status=active`),
      api('GET', `/giveaways/guild/${state.guildId}?status=ended`),
    ]);

    renderGiveawayList(activeList, active, 'Geen lopende giveaways.', (g) => `eindigt over ${formatCountdown(g.endsAt)}`);
    renderGiveawayList(endedList, ended, 'Nog geen afgelopen giveaways.', (g) =>
      g.winners?.length ? `${g.winners.length} winnaar(s)` : 'niemand deed mee'
    );
  } catch (err) {
    activeList.innerHTML = `<div class="empty-state">Fout bij laden: ${escapeHtml(err.message)}</div>`;
    endedList.innerHTML = '';
  }
}

function formatCountdown(endsAt) {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'zo';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}u`;
  return `${Math.round(hours / 24)}d`;
}

function renderGiveawayList(container, giveaways, emptyText, badgeText) {
  if (giveaways.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  container.innerHTML = '';
  giveaways.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'ticket-row';
    row.innerHTML = `
      <div>🎉 ${escapeHtml(g.prize)} — ${g.winnerCount} winnaar(s)</div>
      <span class="ticket-badge">${escapeHtml(badgeText(g))}</span>
    `;
    container.appendChild(row);
  });
}

$('refreshGiveawaysBtn').addEventListener('click', loadGiveaways);

// ---- Welcome message tab ----
function fillWelcomeForm(config) {
  $('wc_enabled').checked = !!config.enabled;
  $('wc_channelId').value = config.channelId || '';
  $('wc_content').value = config.content || '';
  $('wc_embedEnabled').checked = !!config.embedEnabled;
  $('wc_embedTitle').value = config.embedTitle || '';
  $('wc_embedDescription').value = config.embedDescription || '';
  $('wc_embedColor').value = config.embedColor || '7c5cff';
  $('wc_embedColorPicker').value = `#${config.embedColor || '7c5cff'}`;
  $('wc_embedImage').value = config.embedImage || '';
  $('wc_embedFooter').value = config.embedFooter || '';
  $('wc_useAvatarThumbnail').checked = !!config.useAvatarThumbnail;
  $('wc_autoRoleId').value = config.autoRoleId || '';
  $('wc_dmEnabled').checked = !!config.dmEnabled;
  $('wc_dmMessage').value = config.dmMessage || '';
  updateWelcomePreview();
}

const WELCOME_PREVIEW_MEMBER = { user: 'NieuwLid', server: state.guildName || 'de server', membercount: '128' };

function fillWelcomePreviewPlaceholders(text) {
  return String(text || '')
    .replaceAll('{user}', `@${WELCOME_PREVIEW_MEMBER.user}`)
    .replaceAll('{username}', WELCOME_PREVIEW_MEMBER.user)
    .replaceAll('{server}', state.guildName || WELCOME_PREVIEW_MEMBER.server)
    .replaceAll('{membercount}', WELCOME_PREVIEW_MEMBER.membercount);
}

function updateWelcomePreview() {
  const enabled = $('wc_embedEnabled').checked;
  $('wcPreviewEmbed').classList.toggle('hidden', !enabled);
  if (!enabled) return;

  $('wcPreviewBar').style.background = `#${($('wc_embedColor').value || '7c5cff').replace('#', '')}`;
  $('wcPreviewTitle').textContent = fillWelcomePreviewPlaceholders($('wc_embedTitle').value) || 'Welkom in de community! 🌙';
  $('wcPreviewDesc').textContent = fillWelcomePreviewPlaceholders($('wc_embedDescription').value);
  $('wcPreviewFooter').textContent = $('wc_embedFooter').value || '';

  const thumb = $('wc_useAvatarThumbnail').checked;
  $('wcPreviewThumb').src = thumb ? 'https://cdn.discordapp.com/embed/avatars/1.png' : '';
  $('wcPreviewThumb').classList.toggle('hidden', !thumb);

  const image = $('wc_embedImage').value;
  $('wcPreviewImage').src = image;
  $('wcPreviewImage').classList.toggle('hidden', !image);
}

[
  'wc_embedTitle',
  'wc_embedDescription',
  'wc_embedFooter',
  'wc_embedImage',
  'wc_embedEnabled',
  'wc_useAvatarThumbnail',
].forEach((id) => $(id).addEventListener('input', updateWelcomePreview));

$('wc_embedColorPicker').addEventListener('input', () => {
  $('wc_embedColor').value = $('wc_embedColorPicker').value.replace('#', '');
  updateWelcomePreview();
});
$('wc_embedColor').addEventListener('input', () => {
  const clean = $('wc_embedColor').value.replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) $('wc_embedColorPicker').value = `#${clean}`;
  updateWelcomePreview();
});

async function loadWelcomeConfig() {
  try {
    const { config } = await api('GET', `/welcome/config/${state.guildId}`);
    fillWelcomeForm(config);
  } catch (err) {
    $('saveWelcomeStatus').style.color = 'var(--danger)';
    $('saveWelcomeStatus').textContent = `❌ Laden mislukt: ${err.message}`;
    throw err;
  }
}

$('saveWelcomeBtn').addEventListener('click', async () => {
  const btn = $('saveWelcomeBtn');
  const status = $('saveWelcomeStatus');
  btn.disabled = true;
  status.style.color = 'var(--success)';
  status.textContent = 'Opslaan...';

  const fields = {
    enabled: $('wc_enabled').checked,
    channelId: $('wc_channelId').value || null,
    content: $('wc_content').value,
    embedEnabled: $('wc_embedEnabled').checked,
    embedTitle: $('wc_embedTitle').value,
    embedDescription: $('wc_embedDescription').value,
    embedColor: $('wc_embedColor').value.replace('#', '') || '7c5cff',
    embedImage: $('wc_embedImage').value || null,
    embedFooter: $('wc_embedFooter').value || null,
    useAvatarThumbnail: $('wc_useAvatarThumbnail').checked,
    autoRoleId: $('wc_autoRoleId').value || null,
    dmEnabled: $('wc_dmEnabled').checked,
    dmMessage: $('wc_dmMessage').value,
  };

  try {
    const { config } = await api('POST', '/welcome/config', { guildId: state.guildId, ...fields });
    fillWelcomeForm(config);
    status.textContent = '✅ Opgeslagen';
  } catch (err) {
    status.style.color = 'var(--danger)';
    status.textContent = `❌ ${err.message}`;
  } finally {
    btn.disabled = false;
    setTimeout(() => (status.textContent = ''), 4000);
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}


// ---- Boot into the per-server dashboard ----
async function boot() {
  showScreen('app');
  $('guildPill').textContent = state.guildName || state.guildId;

  try {
    await loadWelcomeConfig();
    $('statusPill').textContent = '● Verbonden';
    $('statusPill').style.background = '';
    $('statusPill').style.color = '';
  } catch (err) {
    $('statusPill').textContent = '● Fout';
    $('statusPill').style.background = 'rgba(239,68,68,0.12)';
    $('statusPill').style.color = '#fca5a5';
  }
}

// ---- Entry point ----
(async function init() {
  showLoginErrorFromUrl();

  let me;
  try {
    me = await api('GET', '/auth/me');
  } catch {
    showScreen('login');
    return;
  }

  state.guilds = me.guilds || [];

  const savedGuildId = loadSelectedGuild();
  const savedGuild = state.guilds.find((g) => g.id === savedGuildId);

  if (savedGuild) {
    state.guildId = savedGuild.id;
    state.guildName = savedGuild.name;
    boot();
  } else {
    clearSelectedGuild();
    renderPicker();
    showScreen('picker');
  }
})();
