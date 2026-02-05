# GperView

Minimal log viewer with grep-like filtering in the browser. Built with assistance from OpenAI Codex.

## Features
- Drag & drop or file picker
- Rule-based filtering: include, exclude, starts with, ends with, regex
- Per-rule AND/OR for include rules, exclude rules always enforced
- Case-sensitive toggle per rule
- Auto-apply after typing stops
- Automatic pagination for large files (>2000 lines)
- Line number for file and for display
- Highlighting for date, time, and log levels
- Copy visible page without line numbers

## How Rules Work
- Include/Starts/Ends/Regex rules are combined using each rule's AND/OR selector.
- Exclude rules are always enforced as filters (they are not combined by OR).
- Empty rules are ignored.

Example:
- Rule 1: Include `INFO`
- Rule 2: Exclude `WARN`
- Result: only lines containing `INFO` and not containing `WARN`

## Run Locally
Open `index.html` in your browser.

## Publish on GitHub Pages
1. Push `index.html`, `styles.css`, `app.js`, `README.md`, and `LICENSE` to `main`.
2. In GitHub: `Settings → Pages`.
3. Select `Deploy from a branch`, choose `main`, folder `/ (root)`.
4. Save and open the provided URL.

## License
MIT — see `LICENSE`.
