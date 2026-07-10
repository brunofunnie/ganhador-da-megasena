# Caixa-Inspired Frontend Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontend shell and reusable visual components into a responsive Caixa-inspired lottery portal without changing routes, API contracts, or lottery behavior.

**Architecture:** Keep the current React Router/page structure and Tailwind v4 setup. Centralize the visual language in CSS variables and shared components, then replace page-level gray/green utility styling with the shared shell, surfaces, controls, and responsive grids. Use the existing Recharts and API hooks unchanged.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS 4, Recharts, lucide-react, Vite.

## Global Constraints

- Preserve existing routes, API hooks, backend behavior, and lottery logic.
- Use deep navy/royal blue for shell and primary actions, warm yellow for lottery accents, and white/pale blue-gray content surfaces.
- Represent loading, empty, and error states as intentional content panels.
- Support desktop, tablet, and mobile layouts without adding dependencies.
- Validate all four routes, navigation, data displays, focus states, contrast, and responsive behavior.

## File map

- Modify `frontend/src/index.css`: global tokens, typography, base controls, scrollbar/focus rules, and responsive primitives.
- Modify `frontend/src/App.css`: remove starter Vite styles so they cannot leak into the application.
- Modify `frontend/src/components/Layout.tsx`: responsive application shell, header, breadcrumb/page context, and content container.
- Modify `frontend/src/components/Sidebar.tsx`: branded desktop navigation and mobile navigation trigger/layout.
- Modify `frontend/src/components/SyncStatus.tsx`: style sync state as a compact shell status panel.
- Modify `frontend/src/components/StatsCard.tsx`: shared metric card hierarchy.
- Modify `frontend/src/components/GameCard.tsx`: lottery game surface, number row, copy action, and optional action slot.
- Modify `frontend/src/components/NumberBall.tsx`: blue/yellow/dim ball variants with accessible sizing.
- Modify `frontend/src/components/FrequencyGrid.tsx`: align frequency cells with the new surface and number system.
- Modify `frontend/src/pages/Dashboard.tsx`: page header, hero/latest draw panel, cards, charts, and parity panel.
- Modify `frontend/src/pages/Gerador.tsx`: generator/simulator controls and result surfaces.
- Modify `frontend/src/pages/Simulador.tsx`: standalone simulator layout and results table.
- Modify `frontend/src/pages/Analise.tsx`: dense data presentation, chart surface, and styled loading/error states.

### Task 1: Establish the global visual system

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`

- [ ] Replace the neutral shadcn defaults with named tokens for `--navy-950`, `--navy-900`, `--blue-700`, `--blue-600`, `--lottery-yellow`, `--surface`, `--surface-muted`, `--line`, and readable foreground/muted colors; keep dark mode variables unused unless already activated.
- [ ] Add base rules for `body`, headings, buttons, inputs, selects, textareas, links, focus-visible outlines, and mobile horizontal overflow.
- [ ] Add reusable classes for `.app-shell`, `.page-content`, `.page-heading`, `.eyebrow`, `.surface-card`, `.surface-card-muted`, `.primary-action`, `.secondary-action`, and `.status-panel` so page components share exact behavior.
- [ ] Remove starter `.hero`, `#center`, `#next-steps`, `#docs`, `#spacer`, `.ticks`, and counter styles from `App.css`, leaving only application-specific overrides if needed.
- [ ] Run `npm run build` from `frontend`; expected result is a successful TypeScript/Vite build.

### Task 2: Rebuild the responsive application shell

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/SyncStatus.tsx`

- [ ] Replace the current gray flex wrapper with an `.app-shell` containing the desktop sidebar, a mobile header, a content header, and a constrained `<main>` content area.
- [ ] Add a menu button with accessible label/state on mobile and keep navigation links available without changing route destinations.
- [ ] Update links to use lucide icons already available in dependencies and preserve `NavLink` active-route behavior with navy/yellow active styling.
- [ ] Add brand lockup copy “Ganhador Mega Sena” and a supporting “Inteligência para seus jogos” label without using emoji as the primary brand mark.
- [ ] Keep `SyncStatus` visible in the content/header area and style loading, success, and failure states as compact status panels.
- [ ] Run `npm run lint`; expected result is no new lint errors.

### Task 3: Refresh reusable lottery components

**Files:**
- Modify: `frontend/src/components/StatsCard.tsx`
- Modify: `frontend/src/components/GameCard.tsx`
- Modify: `frontend/src/components/NumberBall.tsx`
- Modify: `frontend/src/components/FrequencyGrid.tsx`

- [ ] Add a small label/icon/value/subtitle hierarchy to `StatsCard` while preserving its existing props.
- [ ] Update `NumberBall` variants to use blue default, yellow accent, and muted dim treatment; keep `sm`, `md`, and `lg` sizes and ensure numeric labels remain centered and high contrast.
- [ ] Turn `GameCard` into a padded surface with a game index, wrapped balls, optional action, and copy button that retains clipboard behavior and has a visible focus state.
- [ ] Update `FrequencyGrid` cells and legends to use the same number/accent tokens and mobile-safe wrapping.
- [ ] Run `npm run build`; expected result is successful compilation with the same component prop contracts.

### Task 4: Restyle Dashboard around the new hierarchy

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] Add the shared page heading/context treatment and a primary link/action to `/gerador` while retaining all existing statistics queries.
- [ ] Convert the latest draw block into a featured blue-tinted result panel with draw metadata and large number balls.
- [ ] Render metric cards in a responsive grid and convert chart wrappers to shared surfaces; update chart colors/tooltips to the new blue/yellow palette.
- [ ] Style the parity distribution panel as compact stat chips with accessible text.
- [ ] Replace plain loading text with a `.status-panel` loading state.
- [ ] Run `npm run lint && npm run build`; expected result is clean lint and successful build.

### Task 5: Restyle Gerador and standalone Simulador

**Files:**
- Modify: `frontend/src/pages/Gerador.tsx`
- Modify: `frontend/src/pages/Simulador.tsx`

- [ ] Add page headings and supporting copy while preserving all generator and simulation state/handlers.
- [ ] Convert generator and simulator controls into labeled surface cards with shared field styles, clear primary/secondary buttons, and full-width mobile actions.
- [ ] Keep the generated-game action flow intact; style result cards, “Simular Todos”, “Simular este jogo”, and copy controls consistently.
- [ ] Style simulation result tables with sticky-feeling headers, readable row separators, horizontal overflow on mobile, and existing hit-rate values unchanged.
- [ ] Ensure disabled/loading buttons remain visibly distinct and keyboard focusable.
- [ ] Run `npm run lint && npm run build`; expected result is clean lint and successful build.

### Task 6: Restyle Análise and data-dense surfaces

**Files:**
- Modify: `frontend/src/pages/Analise.tsx`

- [ ] Add shared page heading/context treatment and preserve the existing statistics query and derived data.
- [ ] Restyle the complete frequency table and top-15 columns with stronger headers, subtle row separators, and mobile horizontal scrolling.
- [ ] Update `FrequencyGrid` usage and parity chart wrapper to the new surface/card system and chart colors.
- [ ] Replace plain loading/error text with intentional loading and error panels using accessible status semantics.
- [ ] Run `npm run lint && npm run build`; expected result is clean lint and successful build.

### Task 7: Verify routes and responsive visual behavior

**Files:**
- Verify: `frontend/src/App.tsx`
- Verify: all modified frontend files

- [ ] Start the frontend with `npm run dev -- --host 127.0.0.1` from `frontend`.
- [ ] Use the in-app browser to inspect `/`, `/gerador`, `/simulador`, and `/analise` at desktop, tablet, and mobile widths; verify no horizontal page overflow except intended dense-table scrolling.
- [ ] Verify active navigation, mobile navigation, loading/error panels, generated/simulated number balls, clipboard action, chart readability, and keyboard focus outlines.
- [ ] Run `npm run lint && npm run build` one final time; expected result is clean lint and successful production build.
- [ ] Record any environment-only limitation separately; do not claim visual verification unless the browser inspection succeeds.

