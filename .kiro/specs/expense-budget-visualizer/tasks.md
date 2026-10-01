# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side-only single-page application using plain HTML, one CSS file (`css/styles.css`), and one JavaScript file (`js/app.js`). Chart.js 4.x is loaded from a CDN. All data is stored in `localStorage`. The implementation follows a unidirectional data flow pattern: User Action → Validation → State Mutation → localStorage → Re-render.

## Tasks

- [ ] 1. Scaffold project structure and create base files
  - Create the directory layout: `css/` and `js/` subdirectories alongside `index.html`
  - Create `index.html` with the full HTML skeleton (doctype, meta viewport, charset, title, CDN `<script>` for Chart.js 4.x before `js/app.js`, link to `css/styles.css`)
  - Create empty `css/styles.css` with a file-level comment block describing its purpose
  - Create empty `js/app.js` with comment headers for each module section: `StorageService`, `Validation`, `Formatters`, `ChartManager`, `Renderer`, `EventHandlers`, `App`
  - _Requirements: 7.1, 7.2_

- [ ] 2. Implement the HTML structure
  - [ ] 2.1 Write the semantic HTML markup inside `<body>`
    - Add `<header>` with `<h1>` title
    - Add `<div id="banner" role="alert" aria-live="polite" hidden>` immediately after `<header>`
    - Add `<main>` containing four `<section>` elements: `#balance-section`, `#form-section`, `#chart-section`, `#list-section`
    - Each section must have an `<h2>` heading acting as its visual boundary marker
    - _Requirements: 7.4_
  - [ ] 2.2 Write the Input Form markup inside `#form-section`
    - `<form id="transaction-form">` with three labelled controls: text input `#item-name` (`maxlength="100"`), number input `#amount` (`step="0.01" min="0.01" max="999999.99"`), and `<select id="category">` with options `Food`, `Transport`, `Fun` plus a blank default option
    - Each control must have a `<label for="…">` element programmatically associated via matching `id`
    - Add `<span class="field-error">` elements with ids `name-error`, `amount-error`, `category-error` adjacent to each control
    - Add `<button type="submit">Add Transaction</button>`
    - _Requirements: 1.1, 7.5_
  - [ ] 2.3 Write the Transaction List and Balance markup
    - Inside `#balance-section`: `<p id="balance-display">$0.00</p>`
    - Inside `#list-section`: `<ul id="transaction-list"></ul>`
    - Inside `#chart-section`: `<canvas id="spending-chart" aria-label="Pie chart of spending by category" role="img"></canvas>`
    - _Requirements: 2.1, 4.1, 5.5_

- [ ] 3. Implement CSS styling in `css/styles.css`
  - [ ] 3.1 Write base reset and typography styles
    - Box-sizing reset, font family, base spacing; ensure no inline styles are added to HTML
    - _Requirements: 7.1_
  - [ ] 3.2 Write layout styles for responsive behaviour
    - Default (desktop) layout for all four sections visible at once
    - Single-column stack for viewport widths ≤ 480 px using a media query
    - No horizontal scrollbar at any width from 320 px to 1920 px
    - Visible section separation (borders or background cards matching `7.4` requirement)
    - _Requirements: 7.3, 7.4_
  - [ ] 3.3 Write interactive control styles
    - Minimum touch target size of 44 × 44 px for all buttons and the delete control
    - Focus indicators for keyboard navigation
    - Styles for `.field-error` text (inline validation messages)
    - Styles for `#banner` (non-blocking page-level banner, visible when not `hidden`)
    - _Requirements: 7.3, 7.5_

- [ ] 4. Implement `StorageService` in `js/app.js`
  - [ ] 4.1 Write `StorageService.isAvailable()`
    - Perform a test write, read, and delete; catch `SecurityError` / `QuotaExceededError`; return `true`/`false`
    - _Requirements: 6.5, 1.6, 3.4_
  - [ ] 4.2 Write `StorageService.load()`
    - Read key `expense_visualizer_transactions` from `localStorage`; call `JSON.parse`; validate result is an array
    - Return `{ transactions: Transaction[], corrupt: boolean }` — on parse failure or non-array, return `{ transactions: [], corrupt: true }`
    - _Requirements: 6.3, 6.4_
  - [ ] 4.3 Write `StorageService.save(transactions)`
    - Serialize with `JSON.stringify` and write to `localStorage`; return `true` on success, `false` if unavailable or write throws
    - Must complete within 100 ms
    - _Requirements: 6.1, 6.2_

- [ ] 5. Implement `Validation` module in `js/app.js`
  - [ ] 5.1 Write `Validation.isValidAmount(value)`
    - Pure function; parse input as float; return `true` iff result is a finite number in `[0.01, 999999.99]`
    - Manual console check: `Validation.isValidAmount('0.01')` → `true`; `Validation.isValidAmount('0')` → `false`; `Validation.isValidAmount('abc')` → `false`; `Validation.isValidAmount('999999.99')` → `true`
    - _Requirements: 1.1, 1.4 — Property 1_
  - [ ] 5.2 Write `Validation.validateTransaction(formData)`
    - Accept `{ name, amount, category }`; trim name; reject if name is empty or whitespace-only; reject if amount fails `isValidAmount`; reject if category is not one of `Food`, `Transport`, `Fun`
    - Return `{ valid: true }` or `{ valid: false, errors: { name?, amount?, category? } }`
    - Manual console check: pass empty name → `valid: false` with `errors.name`; pass all valid fields → `valid: true`
    - _Requirements: 1.3, 1.4 — Properties 1, 3_

- [ ] 6. Implement `Formatters` module in `js/app.js`
  - [ ] 6.1 Write `Formatters.formatCurrency(amount)`
    - Use `Intl.NumberFormat` with `style: 'currency', currency: 'USD'`; produce strings like `$1,234.56` and `-$50.00` with exactly 2 decimal places and thousands separators
    - Manual console check: `Formatters.formatCurrency(1234.56)` → `"$1,234.56"`; `Formatters.formatCurrency(-50)` → `"-$50.00"`
    - _Requirements: 2.1, 4.1 — Property 4_
  - [ ] 6.2 Write `Formatters.formatPercent(value)`
    - Return the number rounded to exactly one decimal place followed by `%` (e.g., `"42.3%"`)
    - Manual console check: `Formatters.formatPercent(42.3)` → `"42.3%"`
    - _Requirements: 5.6 — Property 9_

- [ ] 7. Implement `ChartManager` in `js/app.js`
  - [ ] 7.1 Write `ChartManager.init(canvas)`
    - Guard against `typeof Chart === 'undefined'`; if Chart.js is absent, render fallback text *"Chart unavailable — please check your internet connection."* inside `#chart-section` and return
    - Create a Chart.js 4.x pie chart with labels `['Food', 'Transport', 'Fun']`, background colours `['#f97316', '#3b82f6', '#a855f7']`, responsive layout, legend at bottom, and tooltip callback using `Formatters.formatPercent`
    - Store instance in `ChartManager._instance`
    - _Requirements: 5.1, 5.5_
  - [ ] 7.2 Write `ChartManager.update(transactions)`
    - Compute category totals from `transactions`; if all totals are zero call `ChartManager.showPlaceholder()`; otherwise update `_instance.data.datasets[0].data` and call `_instance.update()`
    - _Requirements: 5.1, 5.3, 5.4 — Property 8_
  - [ ] 7.3 Write `ChartManager.showPlaceholder()`
    - Replace chart data with `data: [1]`, `labels: ['No data']`, and a neutral grey colour; call `_instance.update()` to render the placeholder segment
    - _Requirements: 5.4_

- [ ] 8. Implement `Renderer` module in `js/app.js`
  - [ ] 8.1 Write `Renderer.renderList(transactions)`
    - Sort `transactions` by `createdAt` descending (Property 6)
    - Clear `#transaction-list`; if empty, render an `<li>` with the no-transactions message
    - For each transaction render an `<li>` showing item name, `Formatters.formatCurrency(amount)`, category label, and a delete button (`data-id` attribute holding the transaction id) with minimum 44 × 44 px touch target
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.1 — Property 6_
  - [ ] 8.2 Write `Renderer.renderBalance(transactions)`
    - Compute sum of all `amount` values (Property 7); display via `Formatters.formatCurrency(sum)` in `#balance-display`
    - Manual console check: `calculateBalance([{amount:10},{amount:5.5}])` → `15.5`
    - _Requirements: 4.1, 4.2, 4.3, 4.4 — Property 7_
  - [ ] 8.3 Write `Renderer.showFieldErrors(errors)` and `Renderer.clearFieldErrors()`
    - Populate `#name-error`, `#amount-error`, `#category-error` spans with message text or clear them
    - _Requirements: 1.3, 1.4_
  - [ ] 8.4 Write `Renderer.showBanner(message, type)` and `Renderer.clearBanner()`
    - Set inner text on `#banner`, remove `hidden` attribute; `clearBanner()` re-adds `hidden`
    - `type` drives a CSS modifier class (`error` or `info`) for visual distinction
    - _Requirements: 1.6, 3.4, 4.5, 6.4, 6.5_
  - [ ] 8.5 Write `Renderer.resetForm()`
    - Reset all `<form id="transaction-form">` fields to their default empty/unselected state; must complete within 500 ms
    - _Requirements: 1.5_

- [ ] 9. Implement `EventHandlers` and `App.init()` in `js/app.js`
  - [ ] 9.1 Write `EventHandlers.onFormSubmit(event)`
    - Prevent default; call `Renderer.clearFieldErrors()`; read form values; call `Validation.validateTransaction`
    - On invalid: call `Renderer.showFieldErrors(errors)`; return without adding transaction
    - On valid: build `Transaction` object with `id: crypto.randomUUID() || Date.now().toString()`, `createdAt: Date.now()`; push to `appState.transactions`; call `StorageService.save` — on failure call `Renderer.showBanner` with storage error message and revert push; on success call `Renderer.renderList`, `Renderer.renderBalance`, `ChartManager.update`, `Renderer.resetForm`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6 — Properties 2, 3_
  - [ ] 9.2 Write `EventHandlers.onDeleteClick(event, id)`
    - Find transaction by `id` in `appState.transactions`; remove it; call `StorageService.save` — on failure call `Renderer.showBanner` with deletion error and re-add transaction; on success call `Renderer.renderList`, `Renderer.renderBalance`, `ChartManager.update`
    - Use event delegation on `#transaction-list` to detect clicks on elements with `data-id`
    - _Requirements: 3.2, 3.3, 3.4_
  - [ ] 9.3 Write `App.init()`
    - Check `StorageService.isAvailable()`; if false set `appState.storageAvailable = false` and call `Renderer.showBanner` (storage unavailable, once per session via `appState.bannerShown`)
    - Call `StorageService.load()`; if `corrupt === true` discard data, initialize empty state, call `Renderer.showBanner` with corruption warning
    - Populate `appState.transactions`; call `Renderer.renderList`, `Renderer.renderBalance`, `ChartManager.init`, `ChartManager.update`
    - Attach submit listener to `#transaction-form` and delegated click listener on `#transaction-list`
    - Call `App.init()` at the bottom of `js/app.js` after all module definitions
    - _Requirements: 2.3, 4.2, 5.2, 6.3, 6.4, 6.5_

- [ ] 10. Checkpoint — wire everything together and verify core flow
  - Ensure `App.init()` is the last statement in `js/app.js`
  - Open `index.html` in a browser (no server needed for localStorage): add a transaction, confirm it appears in the list, balance updates, and chart segment appears; reload and confirm persistence
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement all error-handling scenarios
  - [ ] 11.1 Handle Chart.js CDN failure gracefully
    - Ensure the `typeof Chart === 'undefined'` guard in `ChartManager.init` renders fallback text instead of throwing
    - _Requirements: (design error handling)_
  - [ ] 11.2 Handle `localStorage` unavailability on add and delete
    - Verify `StorageService.save` returns `false` → inline error banner is shown → transaction state is reverted
    - _Requirements: 1.6, 3.4_
  - [ ] 11.3 Handle `localStorage` unavailability on app load
    - Verify `StorageService.isAvailable()` returning `false` → page-level banner shown exactly once per session → app operates with in-memory state
    - _Requirements: 4.5, 6.5_
  - [ ] 11.4 Handle corrupted `localStorage` data on app load
    - Manually set `localStorage.setItem('expense_visualizer_transactions', 'NOT_JSON')` in DevTools, reload; verify non-blocking banner appears and app starts in empty state
    - _Requirements: 6.4_

- [ ] 12. Final checkpoint — full manual scenario verification
  - Walk through every row in the design's Scenario Checklist:
    - Submit with all valid fields → transaction at top, balance updates, chart updates
    - Submit with empty name → inline error shown, no transaction added
    - Submit with amount `0` or `abc` → inline error shown next to amount field
    - Delete a transaction → removal, balance and chart update immediately, no reload
    - Reload after adding transactions → all restored from `localStorage`
    - Open with no prior transactions → empty-state message, `$0.00`, chart placeholder
    - Resize to 320 px → single-column stack, no horizontal scrollbar
    - Resize to 1920 px → usable layout, no overflow
    - Open with corrupted `localStorage` value → non-blocking banner, empty state
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- No test framework is required; all verification is done via browser DevTools console and manual scenario walkthrough as specified in the design's Testing Strategy
- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability; requirement numbers map to `requirements.md` section headings (e.g., `1.2` = Requirement 1, Acceptance Criteria 2)
- All nine correctness properties from `design.md` are covered by implementation tasks and their manual console check bullets
- Checkpoints 10 and 12 are integration gates — do not skip them
- The `crypto.randomUUID()` call should fall back to `Date.now().toString()` for browsers that do not support it (or serve over HTTP without a secure context)
- Chart.js 4.x introduces breaking changes from v2/v3; ensure the CDN URL pins to `chart.js@4` and not `latest`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1", "5.1", "6.1", "6.2"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 6, "tasks": ["9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 9, "tasks": ["12"] }
  ]
}
```
