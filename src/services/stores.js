const Store = require('electron-store');
const { DEFAULTS } = require('../core/config.js');

// Settings persist ladder timings, thresholds, night hours, final action, etc.
const settings = new Store({ name: 'settings', defaults: DEFAULTS });

// Recap keeps the most recent nightly "where I fell asleep" entries.
const recapStore = new Store({ name: 'recap', defaults: { entries: [] } });

function addRecap({ title, app, url, timestamp }) {
  const entries = recapStore.get('entries');
  entries.unshift({ title: title || 'unknown title', app: app || null, url: url || null, timestamp });
  recapStore.set('entries', entries.slice(0, 30)); // keep last 30
}

function lastRecap() {
  return recapStore.get('entries')[0] || null;
}

function recentRecaps(limit = 10) {
  return recapStore.get('entries').slice(0, limit);
}

module.exports = { settings, addRecap, lastRecap, recentRecaps };
