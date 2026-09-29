# YT AutoPause — Chrome Extension

> Automatically pauses YouTube videos when you switch tabs or leave the browser, and resumes playback when you return.

---

## ✨ Features

- **Auto-pause on tab switch** — YouTube videos pause instantly when you navigate to another tab.
- **Auto-pause on window switch** — Also pauses when you Alt-Tab to another application.
- **Smart resume** — Only resumes if the extension paused the video. If *you* manually paused it, it stays paused.
- **Ad-aware** — Won't interfere with YouTube ad playback.
- **Multi-tab support** — Each YouTube tab operates independently.
- **ON/OFF toggle** — Easily enable or disable via the popup, persisted across sessions.
- **Dark & Light mode** — Toggle between themes in the popup UI.
- **Zero permissions abuse** — Only requests `storage` and `activeTab`.

---

## 📦 Installation

1. **Download / Clone** this repository to your local machine.

2. Open **Google Chrome** and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right corner).

4. Click **"Load unpacked"** and select the `stopYtVideoUponBlur` folder (the root folder containing `manifest.json`).

5. The **YT AutoPause** extension icon will appear in your toolbar. Pin it for easy access!

---

## 🚀 Usage

1. **Click the extension icon** in the Chrome toolbar to open the popup.
2. Use the **toggle switch** to enable or disable auto-pause.
   - **ON (green):** Videos auto-pause when you switch away, auto-resume when you return.
   - **OFF (gray):** Extension does nothing; YouTube behaves normally.
3. The toggle state **persists** across browser restarts — no need to re-enable it each time.
4. Use the **sun/moon button** in the header to switch between dark and light themes.

---

## 🗂 File Structure

```
stopYtVideoUponBlur/
├── manifest.json        # Manifest V3 configuration
├── background.js        # Service worker — tab/window focus detection & message relay
├── content.js           # Injected into YouTube — handles pause/resume logic
├── popup/
│   ├── popup.html       # Popup UI structure
│   ├── popup.css        # Popup styles (dark/light themes, animations)
│   └── popup.js         # Popup controller (toggle, theme, settings)
├── icons/
│   ├── icon16.png       # 16×16 toolbar icon
│   ├── icon48.png       # 48×48 extensions page icon
│   └── icon128.png      # 128×128 Chrome Web Store icon
└── README.md            # This file
```

---

## ⚙️ How It Works

### Detection
The extension uses **two complementary detection mechanisms**:
1. **Page Visibility API** (`document.visibilitychange`) — Detects tab switches within the same browser window and app-level focus changes.
2. **Chrome Tab/Window Events** (`chrome.tabs.onActivated`, `chrome.windows.onFocusChanged`) — Detects multi-window tab switches and browser-level focus loss (e.g., switching to another app).

### State Tracking
A `pausedByExtension` flag in the content script tracks whether the extension caused the pause:
- If the video was **playing** when the tab lost focus → pause it and set the flag to `true`.
- If the video was **already paused** (user did it) → don't touch it, flag stays `false`.
- On tab return, only resume if the flag is `true` (i.e., the extension paused it).
- If the user manually pauses/plays while the tab is active, the flag resets to `false`.

### Toggle
- State is stored in `chrome.storage.local` and loaded on popup open and content script initialization.
- When toggled, the popup sends a message via `chrome.runtime.sendMessage` → background script relays to all YouTube content scripts via `chrome.tabs.sendMessage`.
- If disabled while a video is extension-paused, the video is immediately resumed.

---

## 🛡 Edge Cases Handled

| Scenario | Behavior |
|---|---|
| User manually pauses before switching tabs | Video stays paused on return |
| Multiple YouTube tabs open | Each tab tracks its own state independently |
| YouTube ad is playing | Extension does not interfere |
| Extension toggled OFF while video is paused by it | Video resumes immediately |
| Browser completely loses focus (Alt-Tab) | Videos pause across all YouTube tabs |
| YouTube SPA navigation (clicking between videos) | MutationObserver re-attaches listeners |

---

## 📝 License

MIT — free to use, modify, and distribute.
