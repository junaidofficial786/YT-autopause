/**
 * background.js — Service Worker (Manifest V3)
 *
 * Responsibilities:
 *   1. Initialize default extension state (enabled = true) on install.
 *   2. Relay toggle-state changes from the popup to all YouTube content scripts.
 *   3. Listen for tab activation events to notify content scripts of visibility changes.
 *      (Supplements the Page Visibility API which doesn't fire when switching
 *       between browser windows of the same profile.)
 */

// ─── Installation / Default State ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default state: extension is ON
    chrome.storage.local.set({ enabled: true });
  }
});

// ─── Tab Activation Listener ─────────────────────────────────────────────────
// When the user switches between tabs, we notify ALL YouTube tabs about which
// tab is now active. Each content script decides independently whether to
// pause or resume based on whether *it* is the active tab.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Query all YouTube tabs to notify them
    const ytTabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });

    for (const tab of ytTabs) {
      // Send a message telling each content script whether it's the active tab
      chrome.tabs.sendMessage(tab.id, {
        type: 'TAB_VISIBILITY_CHANGED',
        isActive: tab.id === activeInfo.tabId
      }).catch(() => {
        // Tab may not have content script loaded yet — silently ignore
      });
    }
  } catch (err) {
    // Service worker may wake up with stale state; ignore gracefully
  }
});

// ─── Window Focus Listener ───────────────────────────────────────────────────
// Handles the case where the user switches to another application entirely.
// chrome.windows.WINDOW_ID_NONE means the browser lost focus.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    const ytTabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });

    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus — pause all YouTube tabs
      for (const tab of ytTabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TAB_VISIBILITY_CHANGED',
          isActive: false
        }).catch(() => {});
      }
    } else {
      // Browser regained focus — find the active tab in the focused window
      const [activeTab] = await chrome.tabs.query({ active: true, windowId });

      for (const tab of ytTabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TAB_VISIBILITY_CHANGED',
          isActive: tab.id === activeTab?.id
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Ignore transient errors
  }
});

// ─── Message Relay ───────────────────────────────────────────────────────────
// When the popup toggles the extension on/off, broadcast to all YouTube tabs
// so they can immediately start or stop managing playback.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_STATE_CHANGED') {
    // Broadcast to all YouTube content scripts
    chrome.tabs.query({ url: '*://www.youtube.com/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXTENSION_STATE_CHANGED',
          enabled: message.enabled
        }).catch(() => {});
      }
    });
    sendResponse({ success: true });
  }
  // Return true to keep the message channel open for async responses
  return true;
});
