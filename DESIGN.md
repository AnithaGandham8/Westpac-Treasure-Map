---
name: Westpac Treasure Map
description: A calm, clear banking experience that makes local rewards easy to explore and connect to savings goals.
colors:
  westpac-red: "#DA1710"
  westpac-red-deep: "#B51610"
  westpac-indigo: "#1F1C4F"
  text-primary: "#181B25"
  text-secondary: "#595767"
  screen-surface: "#F3F4F6"
  card-surface: "#FFFFFF"
  card-border: "#DEDEE1"
  ai-blue: "#0074C4"
  ai-surface: "#EBF4FB"
  ai-border: "#BFDBEF"
  success-green: "#008000"
  danger-red: "#C40000"
  warning-orange: "#C53B00"
rounded:
  button: "12px"
  card: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.westpac-red}"
    textColor: "{colors.card-surface}"
    rounded: "{rounded.button}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.westpac-indigo}"
    rounded: "{rounded.button}"
    height: "44px"
  card:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
  ai-callout:
    backgroundColor: "{colors.ai-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.button}"
---

## Overview

Treasure Map is a Westpac customer demo for exploring Gold Coast merchants, understanding card rewards, and directing those rewards toward a personal savings goal. Its visual character is dependable, approachable, and quietly optimistic. Banking clarity leads; the map and small moments of discovery supply the product's warmth. Follow the approved brand direction in [`../LOOK-AND-FEEL.md`](../LOOK-AND-FEEL.md).

## Colors

Westpac red is reserved for primary actions, active navigation, and goal progress. Deep indigo anchors headings, navigation, and key values. Use the neutral text and surface colors for most content. Green communicates earned rewards or positive outcomes; danger and warning colors retain their semantic meanings. IA blue is exclusive to assisted search, generated recommendations, and clearly identified AI explanations. Pair status colors with text or icons; do not rely on color alone.

The map may use subdued sea, land, road, and neighborhood colors as geographic context. Distinguish Extras, ShopBack, and Altitude with their icon/shape treatment and written labels as well as color.

## Typography

Use Inter when installed, followed by the system sans-serif stack. Keep body copy highly readable, with moderate weights and clear hierarchy. Use tabular numerals for balances, reward values, and progress figures. Keep labels and navigation comfortably legible on small screens; avoid condensed display faces and long all-caps headings.

## Layout

The demo presents a mobile app inside a phone frame on wider screens, with scenario controls alongside it. At mobile widths, let the phone fill the viewport and place demo controls after the app content. Start with a dedicated Rewards screen containing four large destination cards. Each destination has a clear return-to-home control in the header. Keep the card power-up selector on the destination screens, the balance available there, and the main content scrollable. A five-item bottom navigation stays visible across screens, with Rewards selected throughout the Rewards flow; Overview, Payments, Products, and Inbox are presentational placeholders with no action. Keep the map as a full interactive geographic canvas; place floating chips and zoom controls where they do not obscure essential content.

Use a 4/8 px spacing rhythm. Cards and forms scroll within the app area above the bottom navigation. Preserve touch targets of at least 44 px for primary controls and icon-only buttons. Test realistic copy at narrow widths and with device safe areas.

## Elevation & Depth

Prefer thin neutral borders and restrained, offset shadows. Use stronger elevation only for floating controls, sheets, and dialogs. Avoid colored glow as a generic card effect. Keep focus rings visibly distinct and use the IA blue accent for keyboard focus.

## Shapes

Cards use a 16 px radius; buttons, inputs, and compact controls use about 12 px. Filter chips are pills. Inputs retain visible labels, native date/number behavior, clear focus indication, and error copy beside the affected form. Dialog sheets have a rounded upper edge and a clear close action.

## Components

- **Home destination cards:** white, softly elevated cards with an indigo Bootstrap Icon, a concise destination label, and a Westpac red right chevron. Use the four existing destinations and preserve their routing.
- **Bottom navigation:** five equal destinations with a centered Bootstrap Icon and concise label. Highlight Rewards in Westpac red throughout the current product flow; keep the four unimplemented destinations visibly quiet and non-interactive.
- **Return-to-home control:** a compact, accessible arrow button at the start of the header on destination screens; it returns to the Rewards card menu.
- **Primary buttons:** Westpac red with white text; use for the single most important action in a task.
- **Secondary buttons:** white with a neutral border and indigo text.
- **Cards:** white surfaces with a quiet border and restrained elevation; keep information hierarchy inside rather than nesting decorative cards.
- **Map markers:** retain merchant identity, reward amount, reward source, and used state. Keep the SVG map and its pan, zoom, area selection, and offer-opening behavior intact.
- **Progress:** use the existing goal ring for amount saved versus target and the stacked horizontal bar for contribution sources. Show amounts, percentages, labels, and totals in HTML text; charts must not be the only access to their data. Do not add decorative charts or change calculations to improve presentation.
- **Icons:** use the locally bundled Bootstrap Icons 1.13.2 set, with one-color `currentColor` glyphs. Functional icons with adjacent text are hidden from assistive technology; icon-only controls have accessible names and visible keyboard focus.
- **AI surfaces:** use pale blue with an explicit label or explanation. AI content is advisory; the JavaScript engine remains the source of truth for monetary values and rules.
- **Demo controls:** keep scenario selection and reset clearly outside the phone on desktop and reachable beneath the app on mobile.

## Do's and Don'ts

- Do preserve every current ID, `data-*` hook, public `window.App` method, script load order, and state transition when changing presentation.
- Do keep Bootstrap 5.3.8 and Bootstrap Icons 1.13.2 local and version-pinned so the demo works offline.
- Do keep the start screen limited to the product header, Rewards destination cards, and persistent bottom navigation; put balance and card controls inside the destination views.
- Do retain the local SVG map, reward math, ledger, goal rules, mission safeguards, AI fallback, and reset behavior.
- Do use real Bootstrap Icons for interface actions; retain emoji only as expressive goal content where the existing product uses it.
- Don't use Bootstrap's default primary color as a substitute for Westpac red or indigo.
- Don't invent real merchant partnerships, customer outcomes, or financial claims from demo content.
- Don't remove accessible labels, text alternatives for chart values, focus states, or labels that distinguish reward sources.
