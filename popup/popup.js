/**
 * popup.js — Extension Popup Controller
 *
 * Handles:
 *   1. Loading the current toggle state from chrome.storage.local
 *   2. Toggling the extension ON/OFF and persisting the state
 *   3. Broadcasting state changes to the background script (which relays to content scripts)
 *   4. Theme switching (dark/light) with persistence
 *   5. Expandable settings section
 *   6. Updating all UI elements to reflect current state
 */

(function () {
  'use strict';

  // ─── DOM References ───────────────────────────────────────────────────────
  const mainToggle     = document.getElementById('mainToggle');
  const toggleGlow     = document.getElementById('toggleGlow');
  const statusDot      = document.getElementById('statusDot');
  const statusText     = document.getElementById('statusText');
  const infoCard       = document.getElementById('infoCard');
  const infoText       = document.getElementById('infoText');
  const themeToggle    = document.getElementById('themeToggle');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsBody   = document.getElementById('settingsBody');
  const settingsChevron = document.getElementById('settingsChevron');

  // ─── UI State Update ──────────────────────────────────────────────────────
  /**
   * Updates all visual elements to reflect the current enabled/disabled state.
   * @param {boolean} enabled - Whether the extension is currently active
   */
  function updateUI(enabled) {
    // Toggle input state
    mainToggle.checked = enabled;

    // Glow effect
    if (enabled) {
      toggleGlow.classList.remove('inactive');
    } else {
      toggleGlow.classList.add('inactive');
    }

    // Status dot animation & color
    if (enabled) {
      statusDot.classList.remove('inactive');
    } else {
      statusDot.classList.add('inactive');
    }

    // Status text
    statusText.textContent = enabled
      ? 'Auto-pause is ON'
      : 'Auto-pause is OFF';

    // Info card
    if (enabled) {
      infoCard.classList.remove('disabled');
      infoText.innerHTML = 'YouTube will <strong>automatically pause</strong> when you switch tabs and <strong>resume</strong> when you return.';
    } else {
      infoCard.classList.add('disabled');
      infoText.innerHTML = 'Auto-pause is <strong>disabled</strong>. YouTube videos will play normally without interference.';
    }
  }

  // ─── Initialize: Load Stored State ────────────────────────────────────────
  chrome.storage.local.get(['enabled', 'theme'], (result) => {
    const enabled = result.enabled !== undefined ? result.enabled : true;
    updateUI(enabled);

    // Theme
    const theme = result.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  });

  // ─── Toggle Event Handler ─────────────────────────────────────────────────
  mainToggle.addEventListener('change', () => {
    const enabled = mainToggle.checked;

    // Persist state
    chrome.storage.local.set({ enabled });

    // Update popup UI immediately
    updateUI(enabled);

    // Broadcast to background → content scripts (live update, no reload needed)
    chrome.runtime.sendMessage({
      type: 'TOGGLE_STATE_CHANGED',
      enabled
    });
  });

  // ─── Theme Toggle ────────────────────────────────────────────────────────
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', next);
    chrome.storage.local.set({ theme: next });
  });

  // ─── Settings Accordion ───────────────────────────────────────────────────
  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsBody.classList.contains('open');

    if (isOpen) {
      settingsBody.classList.remove('open');
      settingsChevron.classList.remove('open');
    } else {
      settingsBody.classList.add('open');
      settingsChevron.classList.add('open');
    }
  });

})();
