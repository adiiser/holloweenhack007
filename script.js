/* ============ LUNAR OS — script.js ============
   Vanilla JS. No network needed. Data saved in localStorage.
   Sections: 1 Utils · 2 Sound/Toasts · 3 Moon · 4 Incidents/Dashboard
             5 Khonshu engine · 6 Relic scanner · 7 Missions · 8 Lunar view
             9 Navigation · 10 Demo · 11 Init
================================================ */
(() => {
'use strict';

/* ---------- 1. UTILS ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; };
const pick = (arr, n) => arr[n % arr.length];
const SEV_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

/* ---------- 2. SOUND + TOASTS ---------- */
let soundOn = store.get('lunar_sound', false);
let actx = null;
function tone(f = 440, d = .15, type = 'sine', v = .05, when = 0) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + when;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .05);
  } catch (e) { /* audio blocked */ }
}
const sfx = {
  nav: () => tone(520, .1, 'sine', .04),
  click: () => tone(700, .06, 'square', .02),
  alert: () => { tone(880, .12, 'triangle', .05); tone(660, .22, 'triangle', .05, .13); },
  done: () => { tone(392, .15, 'sine', .05); tone(523, .15, 'sine', .05, .12); tone(784, .3, 'sine', .05, .24); },
  scan: () => tone(300, .5, 'sawtooth', .02)
};
function syncSoundBtn() {
  const b = $('#soundBtn');
  b.setAttribute('aria-pressed', String(soundOn));
  b.title = soundOn ? 'Sound on' : 'Sound off';
}
function toast(msg, sev = 'info', title) {
  const box = $('#toasts');
  while (box.children.length >= 4) box.firstElementChild.remove();
  const labels = { info: 'LUNAR OS', low: 'LOW ALERT', medium: 'MEDIUM ALERT', high: 'HIGH ALERT', critical: 'CRITICAL ALERT', ok: 'CONFIRMED' };
  const el = document.createElement('div');
  el.className = 'toast sev-' + (sev === 'info' || sev === 'ok' ? 'low' : sev);
  if (sev === 'info') el.style.setProperty('--c', '#8b7bff');
  el.innerHTML = `<i></i><div><b>${esc(title || labels[sev] || 'LUNAR OS')}</b><span>${esc(msg)}</span></div>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 380); }, 4800);
}

/* ---------- 3. MOON MATH + ILLUSTRATION ---------- */
const SYN = 29.530588853;
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);
function moonInfo(date = new Date()) {
  const days = (date.getTime() - KNOWN_NEW) / 86400000;
  const age = ((days % SYN) + SYN) % SYN;
  const frac = age / SYN;
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  let name = 'New Moon';
  if (age >= 1.85) name = 'Waxing Crescent';
  if (age >= 5.54) name = 'First Quarter';
  if (age >= 9.22) name = 'Waxing Gibbous';
  if (age >= 12.91) name = 'Full Moon';
  if (age >= 16.61) name = 'Waning Gibbous';
  if (age >= 20.30) name = 'Last Quarter';
  if (age >= 23.99) name = 'Waning Crescent';
  if (age >= 27.68) name = 'New Moon';
  return { age, frac, illum, name };
}
function moonSVG(frac, uid) {
  const r = 48, c = 50, waxing = frac <= .5, p = waxing ? frac : 1 - frac;
  const k = Math.cos(2 * Math.PI * p), rx = (Math.abs(k) * r).toFixed(2), sweep = k > 0 ? 0 : 1;
  const lit = `M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} A${rx} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
  const tf = waxing ? '' : 'transform="translate(100 0) scale(-1 1)"';
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Moon phase illustration">
    <defs>
      <radialGradient id="${uid}g" cx="35%" cy="30%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9b4e8"/></radialGradient>
      <clipPath id="${uid}c"><path d="${lit}" ${tf}/></clipPath>
    </defs>
    <circle cx="50" cy="50" r="48" fill="#0d0c1c" stroke="rgba(190,185,255,.45)" stroke-width="1"/>
    <path d="${lit}" ${tf} fill="url(#${uid}g)"/>
    <g clip-path="url(#${uid}c)" opacity=".28" fill="#6f6aa8">
      <circle cx="38" cy="36" r="7"/><circle cx="62" cy="58" r="9"/><circle cx="44" cy="68" r="4.5"/><circle cx="66" cy="32" r="3.5"/><circle cx="30" cy="56" r="3"/>
    </g>
  </svg>`;
}
const fmtPct = n => Math.round(n * 100) + '%';

/* ---------- 4. INCIDENTS + DASHBOARD ---------- */
const INCIDENTS = [
  { id: 'INC-0417', title: 'Hargrove Museum Vanishings', loc: 'Lower Manhattan · Abandoned Hargrove Museum', sev: 'critical', x: 190, y: 425, time: '02:14',
    tags: ['museum', 'vanish', 'disappear', 'egypt', 'symbol', 'glyph', 'guard'], cats: ['vanish', 'egypt'],
    desc: 'Three night-shift guards vanished from the sealed Egyptian wing. Glowing glyphs appeared on the walls.' },
  { id: 'INC-0422', title: 'Jackal Shadows of Harlem', loc: 'Harlem · 125th Street Rail Yard', sev: 'high', x: 222, y: 80, time: '23:48',
    tags: ['jackal', 'dog', 'howl', 'shadow', 'footprint', 'animal'], cats: ['beast', 'haunt'],
    desc: 'Commuters report jackal-headed silhouettes pacing the tracks. Stray dogs refuse to cross the yard.' },
  { id: 'INC-0431', title: 'Weeping Sarcophagus', loc: 'Brooklyn Docks · Pier 9 Warehouse', sev: 'high', x: 295, y: 395, time: '04:05',
    tags: ['sarcophagus', 'crate', 'shipment', 'artifact', 'tomb', 'smuggl', 'amulet'], cats: ['artifact', 'egypt'],
    desc: 'A smuggled sarcophagus is leaking black water. Customs officers report whispering from inside the lid.' },
  { id: 'INC-0436', title: 'Dream Plague', loc: 'Queens · Astoria Apartment Block', sev: 'medium', x: 345, y: 205, time: '05:30',
    tags: ['dream', 'sleep', 'nightmare', 'whisper', 'sleepwalk'], cats: ['mind'],
    desc: 'Forty residents share one recurring nightmare and wake speaking an unknown ancient language.' },
  { id: 'INC-0440', title: 'Pier Ritual Circle', loc: 'Chelsea · Under Pier 62', sev: 'high', x: 148, y: 300, time: '00:21',
    tags: ['ritual', 'cult', 'chant', 'candle', 'blood', 'altar', 'robe'], cats: ['ritual', 'egypt'],
    desc: 'Chanting robed figures and a candle circle were found under the pier, with an altar of carved stone.' },
  { id: 'INC-0445', title: 'Phantom Lights over the Hudson', loc: 'Hudson River · off Hoboken', sev: 'low', x: 100, y: 200, time: '01:37',
    tags: ['light', 'ghost', 'phantom', 'apparition', 'drown', 'fog'], cats: ['haunt', 'anomaly'],
    desc: 'Ferry crews report pale lights moving against the current, and faint faces in the fog.' }
];
const ALERT_TEMPLATES = [
  { title: 'Obelisk Hum Detected', loc: "Central Park · Cleopatra's Needle", sev: 'medium', x: 232, y: 170, tags: ['obelisk', 'light', 'egypt'], cats: ['egypt', 'anomaly'], desc: 'A low humming tone from the obelisk was recorded by park wardens; glyphs appear to glow after dusk.' },
  { title: 'Mirror Whispers', loc: 'SoHo · Antique Gallery', sev: 'high', x: 185, y: 335, tags: ['mirror', 'whisper', 'voice'], cats: ['haunt', 'mind'], desc: 'Gallery mirrors fog on cold nights and relay whispers that do not come from the room.' },
  { title: 'Black Sand at the Aquarium', loc: 'Coney Island · Aquarium Basement', sev: 'low', x: 280, y: 465, tags: ['sand', 'tomb', 'natron'], cats: ['egypt', 'anomaly'], desc: 'Dark mineral sand with no known source keeps reappearing after cleaning crews sweep.' },
  { title: 'Scarab Swarm', loc: 'Lower East Side · Subway Tunnel', sev: 'critical', x: 214, y: 395, tags: ['scarab', 'beast', 'swarm', 'tunnel'], cats: ['beast', 'egypt'], desc: 'Thousands of metallic beetles flooded a tunnel and stripped a maintenance cart to the frame.' },
  { title: 'Cold Spot Spreading', loc: 'Midtown · Old Library Reading Room', sev: 'medium', x: 200, y: 250, tags: ['cold', 'ghost', 'frost'], cats: ['haunt', 'anomaly'], desc: 'A ring of frost grows each night in the reading room. Staff report a sense of being watched.' }
];
let incidents = INCIDENTS.map(i => ({ ...i }));
let acked = new Set(store.get('lunar_ack', []));
let dynCount = 0, selectedInc = null, tickIdx = 0;

const activeIncidents = () => incidents.filter(i => !acked.has(i.id));
function countUp(el, to) {
  const from = parseInt(el.textContent, 10) || 0;
  if (reduce || from === to) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 600;
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
function renderMarkers() {
  const g = $('#markers');
  g.innerHTML = activeIncidents().map(i => `
    <g class="mk sev-${i.sev}${selectedInc === i.id ? ' sel' : ''}" data-id="${i.id}" transform="translate(${i.x} ${i.y})" tabindex="0" role="button" aria-label="${esc(i.title)}, ${i.sev} severity">
      <circle class="ring" r="5"/><circle class="core" r="4.5"/>
    </g>`).join('');
}
function renderMapDetail() {
  const box = $('#mapDetail');
  const inc = incidents.find(i => i.id === selectedInc && !acked.has(i.id));
  if (!inc) { box.innerHTML = '<p class="muted">Select a marker to inspect an incident.</p>'; return; }
  box.innerHTML = `<div class="sev-${inc.sev}"><span class="sev">${inc.sev}</span> <span class="muted small">${inc.id} · ${inc.time}</span>
    <h4>${esc(inc.title)}</h4><p class="muted">${esc(inc.loc)}</p><p>${esc(inc.desc)}</p>
    <div class="row gap"><button class="btn ghost" data-analyze="${inc.id}" type="button">ANALYZE WITH KHONSHU</button></div></div>`;
}
function selectIncident(id, flash) {
  selectedInc = id; renderMarkers(); renderMapDetail();
  if (flash) {
    const m = $(`.mk[data-id="${id}"]`);
    if (m) { m.classList.add('flash'); setTimeout(() => m.classList.remove('flash'), 4000); }
  }
}
function renderAlerts(newId) {
  const list = $('#alertList');
  const items = activeIncidents().sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev]);
  $('#alertCount').textContent = items.length + ' ACTIVE';
  if (!items.length) { list.innerHTML = '<li class="empty">All clear. No active alerts tonight.</li>'; return; }
  list.innerHTML = items.map((i, n) => `
    <li class="alert sev-${i.sev}${i.id === newId ? ' new' : ''}" style="animation-delay:${i.id === newId ? 0 : n * 70}ms">
      <span class="bar"></span>
      <div><span class="sev">${i.sev}</span> <span class="muted small">${i.id} · ${i.time}</span>
        <h4>${esc(i.title)}</h4><p>${esc(i.loc)}</p></div>
      <div class="acts">
        <button class="mini-btn" data-locate="${i.id}" type="button">Locate</button>
        <button class="mini-btn" data-analyze="${i.id}" type="button">Analyze</button>
        <button class="mini-btn danger" data-ack="${i.id}" type="button">Resolve</button>
      </div>
    </li>`).join('');
}
function renderSeverity() {
  const act = activeIncidents();
  $('#sevBars').innerHTML = ['critical', 'high', 'medium', 'low'].map(s => {
    const n = act.filter(i => i.sev === s).length, pct = act.length ? Math.round(n / act.length * 100) : 0;
    return `<div class="sev-row sev-${s}"><span class="sev">${s}</span><div class="gauge"><i data-w="${pct}"></i></div><b>${n}</b></div>`;
  }).join('');
  requestAnimationFrame(() => $$('#sevBars i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
}
function threatLabel() {
  const act = activeIncidents();
  if (!act.length) return 'All clear';
  const score = act.reduce((a, i) => a + SEV_RANK[i.sev], 0) / act.length;
  return score >= 3.2 ? 'Severe night' : score >= 2.4 ? 'Elevated' : score >= 1.6 ? 'Guarded' : 'Calm';
}
function renderDashboard(newId) {
  countUp($('#statThreats'), activeIncidents().length);
  $('#statThreatLevel').textContent = 'Overall: ' + threatLabel();
  renderMarkers(); renderMapDetail(); renderAlerts(newId); renderSeverity(); renderMissionStats();
  $('#ledgerCount').textContent = incidents.length;
}
function renderMoonStat() {
  const m = moonInfo();
  $('#miniMoon').innerHTML = moonSVG(m.frac, 'cm');
  $('#statPhase').textContent = m.name;
  $('#statIllum').textContent = fmtPct(m.illum) + ' illuminated';
  const a = activityFor(new Date(), m);
  $('#statActivity').textContent = a + '%';
  $('#statActivityLbl').textContent = activityLabel(a) + ' · fictional';
}
function tickClock() {
  const d = new Date();
  $('#clockLocal').textContent = d.toLocaleTimeString([], { hour12: false });
  $('#clockDate').textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  try { $('#clockNY').textContent = d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false }); } catch (e) { $('#clockNY').textContent = '--:--:--'; }
}
function spawnAlert() {
  if (document.hidden || dynCount >= 5) return;
  const t = ALERT_TEMPLATES[tickIdx++ % ALERT_TEMPLATES.length];
  dynCount++;
  const id = 'INC-0' + (450 + dynCount);
  const d = new Date();
  const inc = { ...t, id, time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
  incidents.unshift(inc);
  renderDashboard(id);
  toast(inc.title + ' — ' + inc.loc, inc.sev);
  sfx.alert();
}

/* ---------- 5. KHONSHU ENGINE (local, rule-based) ---------- */
const KB = [
  { key: 'vanish', short: 'Displacement', weight: 3, label: 'Spectral Abduction / Dimensional Displacement',
    words: ['disappear', 'vanish', 'missing', 'abduct', 'gone', 'taken', 'never returned', 'no trace'],
    explain: 'The victims were likely pulled through a thin place, a threshold where the Duat bleeds into the physical world. Such rifts open around sealed or consecrated sites and leave no bodies behind.',
    clues: ['No struggle or forced entry suggests displacement rather than kidnapping.', 'Residual cold spots or static at the last known location.', 'Personal items left neatly arranged, as if abandoned mid-step.'],
    steps: ['Seal the perimeter and photograph the last known position of each victim.', 'Sweep for cold spots and electromagnetic drift with a spectral meter.', 'Interview the last witnesses at dusk, because memories of such events fade by dawn.', 'Search nearby thresholds: doors, vaults, stairwells and mirrors.'],
    gear: ['Spectral EM meter', 'Tracking crescents', 'Thermal imaging visor'] },
  { key: 'egypt', short: 'Cursed Site', weight: 1.5, label: 'Ancient Egyptian Cursed-Site Activity',
    words: ['egypt', 'hieroglyph', 'symbol', 'tomb', 'pharaoh', 'sarcophag', 'ankh', 'pyramid', 'mummy', 'museum', 'scarab', 'anubis', 'glyph', 'wall', 'sand', 'obelisk', 'temple'],
    explain: 'The markings and setting point to a funerary or temple cult whose wards have been disturbed. Glyph sequences work as locks, and breaking one wakes what the site was built to contain.',
    clues: ['Inverted or repeated glyphs usually mean an awakened ward.', 'Sand or natron residue with no local source.', 'One name or cartouche repeated across several surfaces.'],
    steps: ['Photograph and transcribe every glyph before touching the surface.', 'Compare the symbols against the translation ledger in the Duat Archive.', 'Identify which ward was breached and whether it can be re-sealed.', 'Trace recent acquisitions or excavations connected to the site.'],
    gear: ['Glyph scanner and UV lamp', 'Salt and ward chalk', 'Portable translation archive'] },
  { key: 'ritual', short: 'Occult Circle', weight: 2.5, label: 'Occult Ritual / Cult Activity',
    words: ['ritual', 'cult', 'sacrific', 'chant', 'blood', 'candle', 'robed', 'robe', 'circle', 'worship', 'altar', 'incense'],
    explain: 'A devoted circle is performing rites to draw power from a dormant deity or relic. The preparation suggests repetition, so further incidents will likely follow the lunar cycle.',
    clues: ['Geometric arrangements of candles, chalk or blood.', 'Robed attendees or chanting reported by witnesses.', 'Timing aligned with moon phase or midnight.'],
    steps: ['Identify the focus object of the ritual circle.', 'Observe from above and avoid direct contact until numbers are known.', 'Trace ritual supplies (candles, incense, vessels) back to a supplier.', 'Plan to interrupt the final rite, not the preparation.'],
    gear: ['Long-range audio recorder', 'Rooftop grapple kit', 'Binding wards and non-lethal restraints'] },
  { key: 'haunt', short: 'Haunting', weight: 1.5, label: 'Spectral Manifestation',
    words: ['ghost', 'apparition', 'haunt', 'whisper', 'voice', 'shadow', 'phantom', 'spirit', 'cold', 'figure', 'faces', 'mirror'],
    explain: 'A restless presence is anchored to the location, probably bound by an unfinished rite or an unmarked death. It feeds on attention and grows stronger each night it is witnessed.',
    clues: ['Temperature drops that follow people between rooms.', 'Whispers that respond to questions.', 'Shadows that do not match their light source.'],
    steps: ['Record audio and thermal readings for one full night cycle.', 'Research deaths, burials and construction history of the site.', 'Do not feed the manifestation attention until protections are in place.', 'Prepare a banishing or release rite fitted to the entity.'],
    gear: ['Thermal camera', 'Parabolic microphone', 'Silver salt line'] },
  { key: 'artifact', short: 'Artifact', weight: 2, label: 'Cursed Artifact Resonance',
    words: ['artifact', 'relic', 'amulet', 'statue', 'idol', 'crate', 'shipment', 'glow', 'humming', 'stone', 'scepter', 'mask', 'jar', 'ankh'],
    explain: 'An object of power is radiating influence into its surroundings. Anyone who handles it becomes a carrier, which would explain the spreading pattern of events around it.',
    clues: ['Electronics failing within a few meters of the object.', 'Handlers reporting vivid dreams or sudden obsession.', 'Chain of custody with gaps or forged paperwork.'],
    steps: ['Isolate the object inside a lead-lined or salt-lined container.', 'Do not touch it bare-handed and rotate any handlers out.', 'Trace provenance: who sold, shipped and received it.', 'Scan it in the Relic Scanner and log the findings.'],
    gear: ['Salt-lined containment case', 'Gloves and tongs', 'Provenance database access'] },
  { key: 'mind', short: 'Dream Corruption', weight: 2, label: 'Psychic Intrusion / Dream Corruption',
    words: ['dream', 'sleep', 'nightmare', 'insomnia', 'hallucinat', 'possess', 'memory', 'voices', 'trance', 'sleepwalk', 'language'],
    explain: 'A dormant mind-presence is reaching through sleep, a classic way for the Duat to leak into daily life. Victims share symbols because the same entity is writing them.',
    clues: ['The same imagery appears in unconnected dreamers.', 'Victims speak or write an unknown language.', 'Symptoms peak around midnight or the full moon.'],
    steps: ['Collect dream reports and look for the repeating symbols.', 'Map victims geographically to find the center of the dream pattern.', 'Place protection wards at the epicenter before sleep.', 'Consult a trusted mind-specialist for safe interviews.'],
    gear: ['Dream-ward talismans', 'Audio log recorder', 'Sedation-free monitoring kit'] },
  { key: 'beast', short: 'Beast Hunt', weight: 2, label: 'Avatar-Beast Predation',
    words: ['jackal', 'dog', 'wolf', 'animal', 'claw', 'bite', 'howl', 'beast', 'creature', 'bird', 'scratch', 'footprint', 'swarm', 'beetle'],
    explain: 'A spirit-animal avatar linked to a death or guardian deity is hunting within the city. Such creatures follow a territory and are drawn to the scent of broken oaths.',
    clues: ['Animals avoiding or surrounding one specific spot.', 'Tracks that change shape partway.', 'Wounds that do not match any known species.'],
    steps: ['Map the animal activity to find the hunting territory.', 'Set up thermal and motion monitoring along the boundary.', 'Check for a recent breach of a sacred oath or tomb nearby.', 'Prepare a non-lethal capture plan.'],
    gear: ['Motion and thermal sensors', 'Heavy gauntlets', 'Spirit-binding chain'] },
  { key: 'anomaly', short: 'Anomaly', weight: 1, label: 'Elemental / Environmental Anomaly',
    words: ['fire', 'ice', 'frost', 'storm', 'flood', 'light', 'power', 'electric', 'flicker', 'fog', 'moon', 'glow', 'humming'],
    explain: 'Environmental disturbances such as lights, cold or storms are common leakage from a nearby breach, and are often the first visible warning before a stronger event.',
    clues: ['Localized weather unrelated to regional forecasts.', 'Power fluctuations in a tight radius.', 'Disturbances that grow around moonrise.'],
    steps: ['Log the radius and timing of every anomaly.', 'Compare with utility and weather data to rule out mundane causes.', 'Look for a hidden source object or ward at the center.', 'Return after moonrise to confirm the pattern.'],
    gear: ['Weather and EM sensors', 'Portable generator', 'Reflective signal kit'] }
];
const FALLBACK = { key: 'unknown', short: 'Anomaly', label: 'Unclassified Anomaly',
  explain: 'The description does not match a known signature. This may be a new pattern or a mundane event with a supernatural rumor attached. Gather more evidence before acting.',
  clues: ['Too little detail to isolate a signature.', 'Check whether witnesses agree on time and place.', 'Look for any object or symbol that recurs.'],
  steps: ['Interview witnesses separately and record their accounts.', 'Visit the site at the same time of night as the event.', 'Photograph every unusual detail, even if it seems unrelated.', 'Re-run the analysis with the new details.'],
  gear: ['Camera and notebook', 'Flashlight and UV lamp', 'Basic spectral meter'] };
const LEVELS = [
  { min: 12, name: 'CRITICAL', sev: 'critical', pct: 96, pri: 'Critical', window: 'P1 · Respond tonight, within the hour. Escalate to all available resources.' },
  { min: 8, name: 'HIGH', sev: 'high', pct: 74, pri: 'High', window: 'P2 · Respond before dawn. Prepare equipment now.' },
  { min: 4, name: 'MODERATE', sev: 'medium', pct: 50, pri: 'Medium', window: 'P3 · Investigate within 48 hours; keep monitoring.' },
  { min: 0, name: 'LOW', sev: 'low', pct: 24, pri: 'Low', window: 'P4 · Monitor and revisit if new reports arrive.' }
];
const NUM_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, several: 3, many: 4 };

function extractLocation(text) {
  const m = text.match(/\b(?:near|at|in|inside|under|beneath|outside|around)\s+(?:the\s+|an?\s+)?([^.,;\n]+)/i);
  if (!m) return 'Location TBD, New York';
  return m[1].trim().split(/\s+/).slice(0, 6).join(' ').replace(/[^\w\s'&-]+$/, '');
}
function analyze(text) {
  const t = text.toLowerCase();
  const found = KB.map(k => { const hits = k.words.filter(w => t.includes(w)); return { k, hits, score: hits.length * k.weight }; }).filter(f => f.hits.length);
  found.sort((a, b) => b.score - a.score);
  let score = found.reduce((a, f) => a + f.score, 0), mods = [];
  const numHit = (t.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten|dozen|several|many)\b/) || [])[1];
  if (numHit) { const n = isNaN(numHit) ? NUM_WORDS[numHit] : parseInt(numHit, 10); if (n >= 3) { score += 1 + (n >= 10 ? 1 : 0); mods.push('multiple victims or witnesses'); } }
  ['child', 'dead', 'death', 'bod', 'blood', 'dying', 'killed', 'murder'].forEach(w => { if (t.includes(w)) { score += 1; if (!mods.includes('mention of death or harm')) mods.push('mention of death or harm'); } });
  if (/midnight|full moon|at night|night/.test(t)) { score += 1; mods.push('nocturnal timing'); }
  if (found.length >= 3) { score += 2; mods.push('three or more overlapping signatures'); }
  const level = LEVELS.find(l => score >= l.min);
  const primary = found[0] ? found[0].k : FALLBACK;
  const secondary = found[1] ? found[1].k : null;
  const catKeys = found.map(f => f.k.key);
  const allHits = [...new Set(found.flatMap(f => f.hits))];
  const moon = moonInfo();
  const loc = extractLocation(text);

  const related = incidents.map(inc => {
    const sc = inc.cats.filter(c => catKeys.includes(c)), st = inc.tags.filter(tg => t.includes(tg));
    return { inc, sc, st, score: sc.length * 2 + st.length };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  const gear = [...new Set([...primary.gear, ...(secondary ? secondary.gear.slice(0, 2) : []), 'Moonlight-ready crescent blades', 'Encrypted field comms'])].slice(0, 7);
  const steps = [...primary.steps, ...(secondary ? secondary.steps.slice(0, 2) : []), 'Log every finding in Mission Control and report back before sunrise.'];
  const clues = [...primary.clues, ...(secondary ? [secondary.clues[0]] : []),
    allHits.length ? 'Detected signals in your description: ' + allHits.join(', ') + '.' : 'No strong keyword signals were detected in the description.'];
  const explain = [primary.explain + (secondary ? ' A secondary signature suggests ' + secondary.label.toLowerCase() + ' may also be involved.' : '')];
  const lunarCtx = moon.illum > .85 ? 'Near-full moon: Khonshu\'s influence and supernatural activity are expected to be at their strongest.'
    : moon.illum < .12 ? 'Near-new moon: the dark phase hides movements and weakens protective wards.' : 'Moon is ' + moon.name.toLowerCase() + ' (' + fmtPct(moon.illum) + ' lit), a moderate-influence window.';
  const coverage = Math.min(95, 25 + allHits.length * 9);

  const sections = [
    { title: 'Incident Classification', paras: [primary.label + (secondary ? ' (secondary: ' + secondary.label + ')' : '') + '.', lunarCtx], chips: found.length ? found.slice(0, 4).map(f => f.k.short + ' · ' + f.hits.length + ' signal' + (f.hits.length > 1 ? 's' : '')) : ['No matching signature'] },
    { title: 'Threat Level', gauge: { name: level.name, sev: level.sev, pct: level.pct },
      paras: ['Heuristic score: ' + score.toFixed(1) + (mods.length ? ' (raised by ' + mods.join(', ') + ')' : '') + '. Keyword coverage: ' + coverage + '%. This is a rule-based estimate, not an AI confidence value.'] },
    { title: 'Possible Supernatural Explanation', paras: explain },
    { title: 'Important Clues', list: clues },
    { title: 'Connections to Existing Incidents', list: related.length
      ? related.map(r => ({ text: r.inc.id + ' "' + r.inc.title + '" shares ' + (r.sc.map(c => (KB.find(k => k.key === c) || {}).short).filter(Boolean).join(' + ') || 'surface') + ' signature' + (r.st.length ? ' (matched: ' + r.st.join(', ') + ')' : '') + '.', incId: r.inc.id }))
      : ['No matching case in the local ledger. This may be a new pattern, so log it as a first entry.'] },
    { title: 'Recommended Investigation Steps', list: steps, ordered: true },
    { title: 'Equipment Required', chips: gear },
    { title: 'Suggested Mission Priority', paras: [level.pri.toUpperCase() + ' — ' + level.window] }
  ];
  const mission = { name: primary.short + ' Investigation: ' + loc.slice(0, 32), loc, priority: level.pri, status: 'Planned' };
  const id = 'LR-' + hash(text).toString(16).toUpperCase().slice(0, 6);
  return { id, level, score, sections, mission, related, primary, text };
}

let runId = 0, skipTyping = false, lastResult = null;
function typeText(el, text, speed = 11) {
  return new Promise(res => {
    if (skipTyping || reduce) { el.textContent = text; return res(); }
    let i = 0; el.classList.add('typing');
    (function step() {
      if (skipTyping) { el.textContent = text; el.classList.remove('typing'); return res(); }
      i += 2; el.textContent = text.slice(0, i);
      if (i >= text.length) { el.classList.remove('typing'); return res(); }
      setTimeout(step, speed);
    })();
  });
}
async function runAnalysis(text, opts = {}) {
  const my = ++runId; skipTyping = false;
  const rep = $('#report'), loader = $('#loader');
  rep.hidden = true; rep.innerHTML = ''; loader.hidden = false;
  const steps = ['Opening the Duat Archive (local ledger)…', 'Parsing incident narrative…', 'Cross-referencing ' + incidents.length + ' recorded cases…', 'Aligning with current lunar phase…', 'Composing report from templates…'];
  $('#loaderBar').style.width = '0%';
  for (let i = 0; i < steps.length; i++) {
    if (my !== runId) return null;
    $('#loaderText').textContent = steps[i];
    $('#loaderBar').style.width = ((i + 1) / steps.length * 100) + '%';
    await sleep(opts.fast ? 260 : 440);
  }
  loader.hidden = true;
  const result = analyze(text); lastResult = result;
  sfx.scan();
  await renderReport(result, my);
  return my === runId ? result : null;
}
async function renderReport(res, my) {
  const rep = $('#report'); rep.hidden = false; rep.innerHTML = '';
  const head = document.createElement('article');
  head.className = 'panel sev-' + res.level.sev;
  head.innerHTML = `<div class="rpt-head"><div><h3>INVESTIGATION REPORT</h3>
    <div class="rpt-meta">${res.id} · ${new Date().toLocaleString()} · Engine: LUNAR local rules v1</div></div>
    <button class="btn ghost" id="skipType" type="button">Skip typing</button></div>
    <p class="rpt-banner">Simulated output. Generated by a local keyword engine and sample case ledger, not by a real AI model.</p>`;
  rep.appendChild(head);
  $('#skipType').addEventListener('click', () => { skipTyping = true; });
  rep.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

  for (let i = 0; i < res.sections.length; i++) {
    if (my !== runId) return;
    const s = res.sections[i];
    const card = document.createElement('article');
    card.className = 'panel rpt-card sev-' + (s.gauge ? s.gauge.sev : i === 7 ? res.level.sev : 'low');
    if (!s.gauge && i !== 7) card.style.setProperty('--c', '#8b7bff');
    card.dataset.sec = i;
    card.innerHTML = `<h4><span>${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h4><div class="body"></div>`;
    rep.appendChild(card);
    const body = $('.body', card);
    if (s.gauge) {
      body.innerHTML = `<div class="level-line"><b>${s.gauge.name}</b><span class="muted">THREAT</span></div><div class="gauge big"><i></i></div><div style="height:10px"></div>`;
      requestAnimationFrame(() => { $('.gauge i', body).style.width = s.gauge.pct + '%'; });
    }
    for (const p of (s.paras || [])) {
      const el = document.createElement('p'); body.appendChild(el); await typeText(el, p); if (my !== runId) return;
    }
    if (s.list) {
      const ls = document.createElement(s.ordered ? 'ol' : 'ul'); body.appendChild(ls);
      for (const it of s.list) {
        const li = document.createElement('li'); ls.appendChild(li);
        const txt = typeof it === 'string' ? it : it.text;
        await typeText(li, txt, 8); if (my !== runId) return;
        if (it.incId) {
          const b = document.createElement('button');
          b.className = 'mini-btn'; b.type = 'button'; b.textContent = 'View on map'; b.style.marginLeft = '8px'; b.dataset.locate = it.incId;
          li.appendChild(b);
        }
      }
    }
    if (s.chips) {
      const c = document.createElement('div'); c.className = 'rpt-chips';
      c.innerHTML = s.chips.map(x => `<span>${esc(x)}</span>`).join(''); body.appendChild(c);
    }
    if (!skipTyping) await sleep(120);
  }
  if (my !== runId) return;
  const sk = $('#skipType'); if (sk) sk.remove();
  const act = document.createElement('div'); act.className = 'rpt-actions';
  act.innerHTML = `<button class="btn primary" id="mkMission" type="button">CREATE SUGGESTED MISSION</button>
    <button class="btn ghost" id="copyReport" type="button">Copy report</button>`;
  rep.appendChild(act);
  $('#mkMission').addEventListener('click', e => {
    const m = addMission(res.mission);
    e.currentTarget.disabled = true; e.currentTarget.textContent = 'MISSION CREATED ✓';
    toast('"' + m.name + '" added to Mission Control.', 'ok'); sfx.done();
  });
  $('#copyReport').addEventListener('click', () => copyReport(res));
  sfx.done();
}
function reportText(res) {
  return ['LUNAR OS INVESTIGATION REPORT ' + res.id + ' (simulated local engine, not a real AI)', ''].concat(res.sections.map((s, i) => {
    const lines = [(i + 1) + '. ' + s.title.toUpperCase()];
    if (s.gauge) lines.push(s.gauge.name);
    (s.paras || []).forEach(p => lines.push(p));
    (s.list || []).forEach((l, n) => lines.push((s.ordered ? (n + 1) + '. ' : '- ') + (typeof l === 'string' ? l : l.text)));
    if (s.chips) lines.push(s.chips.join(' | '));
    return lines.join('\n') + '\n';
  })).join('\n');
}
async function copyReport(res) {
  const txt = reportText(res);
  try { await navigator.clipboard.writeText(txt); toast('Report copied to clipboard.', 'ok'); }
  catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Report copied to clipboard.', 'ok'); }
    catch (e2) { toast('Copy failed. Select the text manually.', 'high'); }
  }
}
function validateIncident() {
  const v = $('#incidentInput').value.trim(), err = $('#khErr');
  if (v.length < 15) { err.textContent = 'Describe the incident in at least 15 characters.'; return null; }
  if (v.split(/\s+/).length < 4) { err.textContent = 'Add a few more words so Khonshu has something to analyze.'; return null; }
  err.textContent = ''; return v;
}

/* ---------- 6. RELIC SCANNER (simulated) ---------- */
const RELIC = {
  names: ['Scarab of the Hollow Hours', 'Eye of the Drowned Pharaoh', 'Amulet of Silent Tides', 'Canopic Jar of Ash', 'Scepter of the Black Sun', 'Ushabti of the Waking Dead', 'Ankh of Broken Oaths', 'Mask of the Midnight Priest'],
  origins: ['Old Kingdom, Memphis necropolis', 'Late Period, Theban priest cache', 'Ptolemaic Alexandria, sealed vault', 'Nubian border tomb, Third Intermediate Period', 'Unknown, predates recorded dynasties'],
  props: ['Hums softly near running water', 'Warms in moonlight and chills in sunlight', 'Reveals faint glyphs under ultraviolet light', 'Draws metal objects toward it', 'Causes vivid dreams in anyone sleeping nearby', 'Casts a shadow that lags behind its owner', 'Makes nearby animals restless', 'Whispers numbers in a dead language'],
  danger: ['Low', 'Moderate', 'High', 'Severe', 'Catastrophic'],
  handling: ['Handle with cotton gloves; store in a salt-lined box.', 'Keep it out of direct moonlight and sealed from sound.', 'Two-person rule: never handle alone and rotate handlers every hour.', 'Contain in lead and salt; do not carry it across running water.', 'Do not open or read aloud any inscription. Contact Nightwatch command immediately.']
};
let relicUrl = null, relicRun = 0, relicData = null;
function setRelicErr(m) { $('#relicErr').textContent = m || ''; }
async function handleRelicFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { setRelicErr('That file is not an image. Choose a PNG, JPG, WEBP or GIF.'); return; }
  if (file.size > 8 * 1024 * 1024) { setRelicErr('Image is larger than 8 MB. Choose a smaller file.'); return; }
  setRelicErr('');
  const my = ++relicRun;
  if (relicUrl) URL.revokeObjectURL(relicUrl);
  relicUrl = URL.createObjectURL(file);
  const img = $('#relicImg');
  img.onerror = () => { setRelicErr('This image could not be displayed. Try another file.'); $('#scanStage').hidden = true; $('#scanGaugeWrap').hidden = true; };
  const loaded = new Promise(r => { img.onload = r; });
  img.src = relicUrl;
  $('#scanStage').hidden = false; $('#scanGaugeWrap').hidden = false; $('#relicActions').hidden = true;
  $('#relicResult').innerHTML = '<p class="muted">Scanning…</p>';
  await loaded;
  if (my !== relicRun) return;
  const stage = $('#scanStage'); stage.classList.add('scanning'); sfx.scan();
  const stages = ['SCANNING SURFACE…', 'READING MATERIAL SIGNATURE…', 'MATCHING AGAINST RELIC ARCHIVE…', 'ASSESSING DANGER…'];
  for (let i = 0; i < stages.length; i++) {
    $('#scanStatus').textContent = stages[i];
    $('#scanBar').style.width = ((i + 1) / stages.length * 100) + '%';
    await sleep(reduce ? 100 : 750);
    if (my !== relicRun) return;
  }
  stage.classList.remove('scanning');
  $('#scanStatus').textContent = 'SCAN COMPLETE · SIMULATED';
  relicData = buildRelic(file, img);
  renderRelic(relicData);
  $('#relicActions').hidden = false;
  sfx.done();
}
function brightnessOf(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return Math.round(s / (d.length / 4));
  } catch (e) { return 128; }
}
function buildRelic(file, img) {
  const br = brightnessOf(img);
  const h = hash(file.name + '|' + file.size + '|' + file.type + '|' + br);
  const dIdx = (h % 3 + (br < 70 ? 2 : br < 140 ? 1 : 0)) % 5;
  return { name: pick(RELIC.names, h), origin: pick(RELIC.origins, h >> 3), props: [pick(RELIC.props, h >> 5), pick(RELIC.props, (h >> 7) + 3)].filter((v, i, a) => a.indexOf(v) === i),
    dIdx, danger: RELIC.danger[dIdx], handling: RELIC.handling[dIdx], br, file: file.name };
}
function renderRelic(r) {
  const sev = ['low', 'low', 'medium', 'high', 'critical'][r.dIdx];
  $('#relicResult').innerHTML = `
    <div class="field name"><small>ARTIFACT NAME</small><b>${esc(r.name)}</b></div>
    <div class="field" style="animation-delay:.1s"><small>ORIGIN</small>${esc(r.origin)}</div>
    <div class="field" style="animation-delay:.2s"><small>MYSTERIOUS PROPERTIES</small><ul>${r.props.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <div class="field sev-${sev}" style="animation-delay:.3s"><small>DANGER LEVEL</small><span class="sev">${r.danger}</span>
      <div class="gauge" style="margin-top:8px"><i data-w="${(r.dIdx + 1) * 20}"></i></div></div>
    <div class="field" style="animation-delay:.4s"><small>RECOMMENDED HANDLING PROCEDURE</small>${esc(r.handling)}</div>
    <p class="muted small" style="margin-top:12px">Simulated. Derived from file "${esc(r.file)}" and its average brightness (${r.br}/255). No real image recognition was performed.</p>
    <button class="btn primary" id="relicMission" type="button">CREATE CONTAINMENT MISSION</button>`;
  requestAnimationFrame(() => $$('#relicResult .gauge i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
  $('#relicMission').addEventListener('click', e => {
    const m = addMission({ name: 'Contain: ' + r.name, loc: 'Nightwatch Relic Vault, Manhattan', priority: ['Low', 'Medium', 'High', 'High', 'Critical'][r.dIdx], status: 'Planned' });
    e.currentTarget.disabled = true; e.currentTarget.textContent = 'MISSION CREATED ✓';
    toast('"' + m.name + '" added to Mission Control.', 'ok'); sfx.done();
  });
}
function resetRelic() {
  relicRun++; if (relicUrl) { URL.revokeObjectURL(relicUrl); relicUrl = null; }
  $('#relicImg').removeAttribute('src'); $('#scanStage').hidden = true; $('#scanStage').classList.remove('scanning');
  $('#scanGaugeWrap').hidden = true; $('#scanBar').style.width = '0%'; $('#relicActions').hidden = true;
  $('#relicFile').value = ''; setRelicErr('');
  $('#relicResult').innerHTML = '<p class="muted">Awaiting a relic. Upload an image to begin the scan.</p>';
}

/* ---------- 7. MISSION CONTROL ---------- */
const PRI_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const PRI_SEV = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };
let missions = store.get('lunar_missions', null);
if (!Array.isArray(missions)) {
  missions = [
    { id: 'm-seed-1', name: 'Operation Midnight Vault', loc: 'Hargrove Museum, Lower Manhattan', priority: 'High', status: 'Active', created: Date.now() - 86400000 },
    { id: 'm-seed-2', name: 'Silence the Pier Chant', loc: 'Pier 62, Chelsea', priority: 'Medium', status: 'Planned', created: Date.now() - 3600000 }
  ];
  store.set('lunar_missions', missions);
}
let missionFilter = 'all';
const saveMissions = () => store.set('lunar_missions', missions);
function addMission(m) {
  const existing = missions.find(x => x.name === m.name && x.loc === m.loc && x.status !== 'Completed');
  if (existing) return existing;
  const mission = { id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: m.name, loc: m.loc, priority: m.priority, status: m.status, created: Date.now() };
  missions.unshift(mission); saveMissions(); renderMissions(); renderMissionStats();
  return mission;
}
function renderMissions() {
  const list = $('#missionList');
  let items = missions.filter(m => missionFilter === 'all' ? true : missionFilter === 'done' ? m.status === 'Completed' : m.status !== 'Completed');
  items = items.slice().sort((a, b) => (a.status === 'Completed') - (b.status === 'Completed') || PRI_RANK[a.priority] - PRI_RANK[b.priority] || b.created - a.created);
  if (!items.length) { list.innerHTML = '<li class="empty">No missions in this view. Create one, or run an analysis in Khonshu AI.</li>'; return; }
  list.innerHTML = items.map(m => `
    <li class="mission sev-${PRI_SEV[m.priority]}${m.status === 'Completed' ? ' done' : ''}" data-id="${m.id}">
      <span class="bar"></span>
      <div><h4>${esc(m.name)}</h4><p>${esc(m.loc)} · ${new Date(m.created).toLocaleDateString()}</p>
        <div class="meta"><span class="sev">${m.priority}</span>
          <select data-status aria-label="Status for ${esc(m.name)}">${['Planned', 'Active', 'On Hold', 'Completed'].map(s => `<option${s === m.status ? ' selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="acts">
        <button class="mini-btn" data-act="toggle" type="button">${m.status === 'Completed' ? 'Reopen' : 'Complete ✓'}</button>
        <button class="mini-btn danger" data-act="delete" type="button">Delete</button>
      </div>
    </li>`).join('');
}
function renderMissionStats() {
  const open = missions.filter(m => m.status !== 'Completed');
  countUp($('#statMissions'), open.length);
  const act = missions.filter(m => m.status === 'Active').length, done = missions.length - open.length;
  $('#statMissionSub').textContent = act + ' active · ' + done + ' completed';
  const mini = $('#miniMissions');
  const top = open.slice().sort((a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority]).slice(0, 4);
  mini.innerHTML = top.length ? top.map(m => `<li class="sev-${PRI_SEV[m.priority]}"><span>${esc(m.name)}</span><span class="sev">${m.status}</span></li>`).join('')
    : '<li class="empty" style="display:block">No open missions.</li>';
}
function submitMission(e) {
  e.preventDefault();
  const name = $('#mName').value.trim(), loc = $('#mLoc').value.trim();
  let ok = true;
  $('#mNameErr').textContent = ''; $('#mLocErr').textContent = '';
  if (name.length < 3) { $('#mNameErr').textContent = 'Mission name needs at least 3 characters.'; ok = false; }
  if (loc.length < 2) { $('#mLocErr').textContent = 'Enter a location (at least 2 characters).'; ok = false; }
  if (!ok) return;
  addMission({ name, loc, priority: $('#mPri').value, status: $('#mStatus').value });
  e.target.reset(); toast('Mission "' + name + '" created.', 'ok'); sfx.click();
}

/* ---------- 8. LUNAR PROTOCOL ---------- */
function activityFor(date, m) {
  const day = Math.floor(date.getTime() / 86400000);
  const noise = hash('khonshu' + day) % 36;
  return Math.min(100, Math.round(m.illum * 55 + noise + (m.illum < .08 ? 12 : 0)));
}
const activityLabel = v => v < 30 ? 'Dormant' : v < 55 ? 'Stirring' : v < 78 ? 'Elevated' : 'Peak';
const toInputDate = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
let lunarDate = new Date();
function renderLunar(date) {
  lunarDate = date;
  const isToday = toInputDate(date) === toInputDate(new Date());
  const d = isToday ? new Date() : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const m = moonInfo(d);
  $('#lunarMoon').innerHTML = moonSVG(m.frac, 'lm');
  $('#lunarPhase').textContent = m.name;
  $('#lunarDate').textContent = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('#lunarDateInput').value = toInputDate(d);
  $('#lunarIllum').textContent = fmtPct(m.illum);
  $('#lunarAge').textContent = m.age.toFixed(1) + ' days';
  const toFull = ((SYN / 2 - m.age) % SYN + SYN) % SYN, toNew = (SYN - m.age) % SYN;
  const fmt = n => new Date(d.getTime() + n * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' (in ' + Math.round(n) + ' d)';
  $('#lunarFull').textContent = fmt(toFull); $('#lunarNew').textContent = fmt(toNew);
  const a = activityFor(d, m);
  $('#lunarAct').textContent = a + '%'; $('#lunarActLbl').textContent = activityLabel(a);
  const bar = $('#lunarActBar'); bar.parentElement.className = 'gauge big ' + (a >= 78 ? 'sev-critical' : a >= 55 ? 'sev-high' : a >= 30 ? 'sev-medium' : 'sev-low');
  requestAnimationFrame(() => { bar.style.width = a + '%'; });
  const sel = toInputDate(d);
  $('#lunarWeek').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + i, 12), mm = moonInfo(dd), aa = activityFor(dd, mm);
    const cls = aa >= 78 ? 'sev-critical' : aa >= 55 ? 'sev-high' : aa >= 30 ? 'sev-medium' : 'sev-low';
    return `<button class="day ${cls}${toInputDate(dd) === sel ? ' sel' : ''}" data-day="${toInputDate(dd)}" type="button" aria-label="${dd.toDateString()}, ${mm.name}">
      <small>${dd.toLocaleDateString(undefined, { weekday: 'short' })} ${dd.getDate()}</small>${moonSVG(mm.frac, 'wk' + i)}<small>${aa}%</small><div class="gauge"><i style="width:${aa}%"></i></div></button>`;
  }).join('');
}

/* ---------- 9. NAVIGATION ---------- */
function showSection(id) {
  const target = $('#view-' + id); if (!target) return;
  $$('.view').forEach(v => v.classList.toggle('active', v === target));
  $$('.nav-btn').forEach(b => { const on = b.dataset.target === id; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  if (id === 'lunar') renderLunar(lunarDate);
  if (id === 'command') { renderMoonStat(); renderDashboard(); }
}

/* ---------- 10. DEMO MODE ---------- */
const DEMO_TEXT = 'Three night-shift guards vanished from the abandoned Hargrove Museum near the old pier. Strange Egyptian symbols are glowing on the walls, a cold whisper echoes through the vaults, and jackal-like footprints lead to a sealed crate at midnight.';
let demoBusy = false;
async function initiateDemo() {
  if (demoBusy) return; demoBusy = true;
  const btn = $('#demoBtn'), banner = $('#demoBanner'), txt = $('#demoText');
  btn.disabled = true; banner.hidden = false;
  const say = m => { txt.textContent = 'DEMONSTRATION MODE // ' + m; };
  try {
    say('Intercepting a mysterious incident report…'); toast('Demo started: an unknown incident has been reported.', 'critical', 'DEMO · INCIDENT'); sfx.alert();
    showSection('khonshu'); await sleep(500);
    const ta = $('#incidentInput'); ta.value = ''; $('#khCount').textContent = '0';
    for (let i = 0; i <= DEMO_TEXT.length; i += 4) { ta.value = DEMO_TEXT.slice(0, i); $('#khCount').textContent = ta.value.length; await sleep(reduce ? 0 : 12); }
    ta.value = DEMO_TEXT; $('#khCount').textContent = DEMO_TEXT.length; $('#khErr').textContent = '';
    say('Running the local investigation engine…');
    const res = await runAnalysis(DEMO_TEXT, { fast: true });
    if (!res) return;
    say('Creating the suggested mission…');
    const before = missions.length, m = addMission(res.mission);
    const mk = $('#mkMission'); if (mk) { mk.disabled = true; mk.textContent = 'MISSION CREATED ✓'; }
    toast(before < missions.length ? 'Mission created: ' + m.name : 'Mission already exists: ' + m.name, 'ok', 'DEMO · MISSION'); sfx.done();
    await sleep(600);
    say('Revealing connection to an existing case…');
    const conn = $('.rpt-card[data-sec="4"]');
    if (conn) { conn.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); conn.classList.add('flash'); setTimeout(() => conn.classList.remove('flash'), 1800); }
    if (res.related[0]) { selectedInc = res.related[0].inc.id; renderDashboard(); toast('Linked to ' + res.related[0].inc.id + ' "' + res.related[0].inc.title + '". Use "View on map" in the report.', 'high', 'DEMO · CONNECTION'); }
    say('Complete. Everything above ran locally, with no API or internet.');
    await sleep(6000);
  } finally {
    banner.hidden = true; btn.disabled = false; demoBusy = false;
  }
}

/* ---------- 11. INIT ---------- */
function initParticles() {
  const c = $('#particles'), x = c.getContext('2d'); let w, h, ps = [];
  const build = () => {
    w = c.width = innerWidth; h = c.height = innerHeight;
    ps = Array.from({ length: Math.min(80, Math.floor(w * h / 20000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .3, vx: (Math.random() - .5) * .15, vy: -Math.random() * .25 - .05, a: Math.random() * .6 + .2, p: Math.random() * 6 }));
  };
  const draw = t => {
    x.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5;
      x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283);
      x.fillStyle = `rgba(210,205,255,${(p.a * (.6 + .4 * Math.sin(t / 1200 + p.p))).toFixed(3)})`; x.fill();
    }
    if (!reduce) requestAnimationFrame(draw);
  };
  build(); addEventListener('resize', build); requestAnimationFrame(draw);
}

function bindEvents() {
  $('#nav').addEventListener('click', e => { const b = e.target.closest('.nav-btn'); if (b) { showSection(b.dataset.target); sfx.nav(); } });
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-goto]'); if (go) { showSection(go.dataset.goto); return; }
    const loc = e.target.closest('[data-locate]');
    if (loc) { showSection('command'); selectIncident(loc.dataset.locate, true); sfx.click(); setTimeout(() => $('#nyMap').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }), 80); return; }
    const an = e.target.closest('[data-analyze]');
    if (an) {
      const inc = incidents.find(i => i.id === an.dataset.analyze); if (!inc) return;
      showSection('khonshu'); $('#incidentInput').value = inc.title + '. ' + inc.desc + ' Location: ' + inc.loc + '.'; $('#khCount').textContent = $('#incidentInput').value.length;
      runAnalysis($('#incidentInput').value); return;
    }
    const ak = e.target.closest('[data-ack]');
    if (ak) { acked.add(ak.dataset.ack); store.set('lunar_ack', [...acked]); if (selectedInc === ak.dataset.ack) selectedInc = null; renderDashboard(); toast('Incident ' + ak.dataset.ack + ' marked as resolved.', 'ok'); sfx.click(); }
  });
  const svg = $('#nyMap');
  svg.addEventListener('click', e => { const m = e.target.closest('.mk'); if (m) { selectIncident(m.dataset.id); sfx.click(); } });
  svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const m = e.target.closest('.mk'); if (m) { e.preventDefault(); selectIncident(m.dataset.id); } } });

  $('#soundBtn').addEventListener('click', () => { soundOn = !soundOn; store.set('lunar_sound', soundOn); syncSoundBtn(); toast('Sound ' + (soundOn ? 'enabled' : 'muted') + '.', 'info'); sfx.click(); });
  $('#demoBtn').addEventListener('click', initiateDemo);

  const ta = $('#incidentInput');
  ta.addEventListener('input', () => { $('#khCount').textContent = ta.value.length; if ($('#khErr').textContent) $('#khErr').textContent = ''; });
  ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('#khForm').requestSubmit(); });
  $('#khForm').addEventListener('submit', e => { e.preventDefault(); const v = validateIncident(); if (v) { sfx.click(); runAnalysis(v); } });
  $('#khClear').addEventListener('click', () => { runId++; ta.value = ''; $('#khCount').textContent = '0'; $('#khErr').textContent = ''; $('#report').hidden = true; $('#report').innerHTML = ''; $('#loader').hidden = true; });
  $$('.chip[data-ex]').forEach(c => c.addEventListener('click', () => { ta.value = c.dataset.ex; $('#khCount').textContent = ta.value.length; $('#khErr').textContent = ''; ta.focus(); }));

  const file = $('#relicFile'), dz = $('#dropzone');
  file.addEventListener('change', () => handleRelicFile(file.files[0]));
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => handleRelicFile(e.dataTransfer.files[0]));
  $('#relicReset').addEventListener('click', resetRelic);

  $('#missionForm').addEventListener('submit', submitMission);
  $('#missionTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    missionFilter = t.dataset.filter; $$('.tab').forEach(x => x.classList.toggle('active', x === t)); renderMissions();
  });
  const ml = $('#missionList');
  ml.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const li = b.closest('.mission'), m = missions.find(x => x.id === li.dataset.id); if (!m) return;
    if (b.dataset.act === 'delete') { missions = missions.filter(x => x.id !== m.id); toast('Mission "' + m.name + '" deleted.', 'info'); }
    else { m.status = m.status === 'Completed' ? 'Active' : 'Completed'; if (m.status === 'Completed') { toast('Mission "' + m.name + '" completed.', 'ok'); sfx.done(); } }
    saveMissions(); renderMissions(); renderMissionStats();
  });
  ml.addEventListener('change', e => {
    const s = e.target.closest('[data-status]'); if (!s) return;
    const m = missions.find(x => x.id === s.closest('.mission').dataset.id); if (!m) return;
    m.status = s.value; saveMissions(); renderMissions(); renderMissionStats();
  });

  $('#lunarDateInput').addEventListener('change', e => { if (e.target.value) renderLunar(new Date(e.target.value + 'T12:00:00')); });
  $('#lunarToday').addEventListener('click', () => renderLunar(new Date()));
  $('#lunarWeek').addEventListener('click', e => { const d = e.target.closest('[data-day]'); if (d) renderLunar(new Date(d.dataset.day + 'T12:00:00')); });
}

function init() {
  initParticles(); syncSoundBtn(); bindEvents();
  tickClock(); setInterval(tickClock, 1000);
  renderMoonStat(); renderDashboard(); renderMissions(); renderLunar(new Date());
  setInterval(renderMoonStat, 60000);
  setTimeout(() => toast('Nightwatch online. Click INITIATE DEMO for a guided run.', 'info', 'LUNAR OS'), 900);
  setTimeout(spawnAlert, 14000);
  setInterval(spawnAlert, 32000);
}
init();
})();