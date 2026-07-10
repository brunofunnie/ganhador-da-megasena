# Caixa-Inspired Frontend Layout Redesign

## Goal

Refresh the Ganhador Mega Sena frontend so it feels like a trustworthy public-service lottery portal inspired by the Caixa lottery website, while keeping a distinct product identity and preserving all existing lottery functionality.

## Scope

The work is limited to frontend presentation, shared layout, reusable components, responsive behavior, and visual states. Existing routes, API hooks, backend behavior, and lottery logic remain unchanged.

## Visual direction

- Use deep navy and royal blue for the application shell and primary actions.
- Use warm yellow sparingly for lottery accents, active states, selections, and key calls to action.
- Use white and pale blue-gray surfaces for content areas.
- Use rounded cards, restrained shadows, clear borders, and stronger section headings.
- Establish a branded header with “Ganhador Mega Sena”, sync/status context, and current-page context.
- Use a persistent desktop sidebar that becomes a compact top bar and mobile navigation on smaller screens.
- Keep a consistent page rhythm: context/breadcrumb, title and supporting text, primary action, then cards/tables.

## Component architecture

`Layout` owns the responsive shell, page background, header, and navigation state. `Sidebar` provides desktop navigation and active-route treatment. `StatsCard`, `GameCard`, and `NumberBall` become the primary visual anchors for metrics, lottery results, and generated numbers. Existing shared UI primitives inherit common radius, typography, focus, hover, disabled, and spacing rules.

Loading, empty, and error states are represented as intentional content panels with the same visual language as the rest of the app.

## Page treatment

- Dashboard: overview, latest draw, key statistics, and synchronization state.
- Gerador: generation controls first, generated games directly below, and clear primary actions.
- Simulador: simulation controls followed by concise result summaries.
- Análise: frequency/statistics views with stronger table grouping and readable dense-data treatment.

## Responsive behavior

- Desktop: persistent sidebar, spacious content grid, and two- or three-column cards where appropriate.
- Tablet: reduced card columns and narrower shell proportions while preserving primary actions.
- Mobile: compact top bar, stacked cards, full-width controls, wrapped number rows, and horizontally scrollable dense tables.

## Validation

Validate all four routes with existing API states, navigation and active-route styling, generated and simulated number displays, loading/empty/error states, keyboard focus, readable contrast, narrow mobile widths, and the existing desktop viewport. Avoid new dependencies unless already present and necessary.

## Alternatives considered

1. CSS-only refresh: lowest risk, but leaves page composition and shared component consistency limited.
2. Shell and reusable-component refresh: recommended; creates one visual system without changing behavior.
3. Page-by-page bespoke redesign: highest control, but increases duplication and drift between routes.

