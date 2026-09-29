/**
 * content.js — Injected into YouTube pages
 *
 * Core State Machine:
 *   - `extensionEnabled`: Whether the extension toggle is ON (from storage).
 *   - `pausedByExtension`: Flag to track if WE paused the video (vs. user pause).
 *     This is the critical flag that prevents the extension from resuming a video
 *     the user manually paused.
 *   - `userManuallyPaused`: Tracks if the user clicked pause while the tab was
 *     active/visible. If true, we won't auto-resume on tab return.
 *
 * Detection Strategy:
 *   1. Page Visibility API (`visibilitychange` event) — catches tab switches
 *      within the same window and app switches on most platforms.
 *   2. `chrome.runtime.onMessage` from background.js — catches tab switches
 *      that the Visibility API might miss (e.g., switching between browser windows).
 *   Both fire `handleVisibilityChange(isVisible)` so the logic is unified.
 */

(function () {
  'use strict';

  // ─── State Variables ─────────────────────────────────────────────────────────
  let extensionEnabled = true;    // Mirrors the toggle in the popup
  let pausedByExtension = false;  // True only when *we* triggered the pause
  let isTabVisible = !document.hidden; // Current visibility state

  // ─── Initialize: Load Saved State ──────────────────────────────────────────
  chrome.storage.local.get('enabled', (result) => {
    extensionEnabled = result.enabled !== undefined ? result.enabled : true;
  });

  // ─── Utility: Get the YouTube Video Player ────────────────────────────────
  // YouTube's main video element. May not exist immediately on SPAs,
  // so we always query it fresh.
  function getVideoElement() {
    // Primary: the main player video
    const video = document.querySelector('video.html5-main-video')
      || document.querySelector('ytd-player video')
      || document.querySelector('video');
    return video;
  }

  // ─── Utility: Check if an Ad is Currently Playing ─────────────────────────
  // We don't want to interfere with ad playback — YouTube handles that itself.
  function isAdPlaying() {
    // YouTube adds specific classes/elements when an ad is active
    const adOverlay = document.querySelector('.ad-showing');
    const adModule = document.querySelector('.ytp-ad-player-overlay');
    const adText = document.querySelector('.ytp-ad-text');
    return !!(adOverlay || adModule || adText);
  }

  // ─── Core Logic: Handle Visibility Change ─────────────────────────────────
  /**
   * Called whenever tab visibility changes (from either the Page Visibility API
   * or a message from the background script).
   *
   * @param {boolean} visible - Whether the tab is now visible/active
   */
  function handleVisibilityChange(visible) {
    // If the extension is disabled, do absolutely nothing
    if (!extensionEnabled) return;

    const video = getVideoElement();
    if (!video) return;

    // Don't interfere with ad playback
    if (isAdPlaying()) return;

    if (!visible) {
      // ── Tab Lost Focus ──────────────────────────────────────────────────
      // Only pause if the video is currently playing.
      // If the user already paused it, we leave it alone.
      if (!video.paused) {
        video.pause();
        pausedByExtension = true; // Mark that WE did this
      }
      // If video was already paused (user did it), we don't touch the flag
    } else {
      // ── Tab Regained Focus ──────────────────────────────────────────────
      // Only resume if WE were the ones who paused it.
      // This prevents overriding a deliberate user pause.
      if (pausedByExtension) {
        video.play().catch(() => {
          // Autoplay may be blocked by browser policy — fail silently
        });
        pausedByExtension = false; // Reset the flag
      }
    }

    isTabVisible = visible;
  }

  // ─── Event: Page Visibility API ───────────────────────────────────────────
  // This is the primary detection mechanism for tab switches and app switches.
  document.addEventListener('visibilitychange', () => {
    handleVisibilityChange(!document.hidden);
  });

  // ─── Event: Messages from Background Script ──────────────────────────────
  // Supplements the Visibility API for edge cases (e.g., multi-window switching).
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TAB_VISIBILITY_CHANGED') {
      handleVisibilityChange(message.isActive);
    }

    if (message.type === 'EXTENSION_STATE_CHANGED') {
      extensionEnabled = message.enabled;

      // If the extension was just disabled and we have a pending pause,
      // resume the video so the user isn't left with a mysteriously paused video
      if (!extensionEnabled && pausedByExtension) {
        const video = getVideoElement();
        if (video) {
          video.play().catch(() => {});
        }
        pausedByExtension = false;
      }
    }

    // Respond to pings from the popup (for connection checking)
    if (message.type === 'PING') {
      sendResponse({ status: 'alive' });
    }
  });

  // ─── Event: Detect Manual User Pause/Play ─────────────────────────────────
  // If the user manually pauses the video while the tab is active,
  // clear our flag so we don't auto-resume it when they come back.
  //
  // We use MutationObserver + event listeners because YouTube's SPA navigation
  // can swap out the video element.
  function attachVideoListeners(video) {
    if (!video || video._ytAutoPauseListenersAttached) return;

    video.addEventListener('pause', () => {
      // If the tab is visible and the video paused, the USER did it (not us)
      if (isTabVisible && extensionEnabled) {
        pausedByExtension = false;
      }
    });

    video.addEventListener('play', () => {
      // If the user manually plays while tab is visible, clear our flag
      if (isTabVisible && extensionEnabled) {
        pausedByExtension = false;
      }
    });

    // Mark so we don't double-attach
    video._ytAutoPauseListenersAttached = true;
  }

  // ─── Observer: Watch for Video Element Changes ────────────────────────────
  // YouTube is a SPA — the video element can be replaced during navigation.
  // We observe the DOM to re-attach our listeners when a new video appears.
  const observer = new MutationObserver(() => {
    const video = getVideoElement();
    if (video) {
      attachVideoListeners(video);
    }
  });

  // Start observing the body for child list changes (subtree for deep SPA nav)
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial attachment attempt
  const initialVideo = getVideoElement();
  if (initialVideo) {
    attachVideoListeners(initialVideo);
  }

  // ─── Storage Change Listener ──────────────────────────────────────────────
  // In case storage is updated from another context (e.g., different popup instance)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled !== undefined) {
      extensionEnabled = changes.enabled.newValue;

      // Same resume-on-disable logic
      if (!extensionEnabled && pausedByExtension) {
        const video = getVideoElement();
        if (video) {
          video.play().catch(() => {});
        }
        pausedByExtension = false;
      }
    }
  });

})();
