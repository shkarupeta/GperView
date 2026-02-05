# GperView

Minimal log viewer with grep-like filtering in the browser.

## Features
- Drag & drop or file picker
- Rule-based filtering with include/exclude/starts/ends/regex
- Per-rule AND/OR for include rules
- Case-sensitive toggle per rule
- Pagination toggle and page size

## How Rules Work
- **Include/Starts/Ends/Regex** rules are combined using each rule's AND/OR selector.
- **Exclude** rules are always enforced as filters (they are not combined by OR), so a line must pass all excludes.
- Empty rules are ignored.

Example:
- Rule 1: Include `INFO`
- Rule 2: Exclude `WARN`
- Result: only lines containing `INFO` and not containing `WARN`

## Run Locally
Open `index.html` in your browser.

## GitHub Pages (later)
You can publish by pushing `index.html`, `styles.css`, `app.js` to `main` and enabling GitHub Pages in repo settings.
