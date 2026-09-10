---
name: Cober360 · El Padrón
description: Registro nominal para el CRM de Cober — una fila por persona, el documento como eje, el estado estampado y graduado.
colors:
  paper: "#FFFFFF"
  paper-sunk: "#FAFAFA"
  paper-mark: "#F4F1F6"
  ink: "#121212"
  ink-2: "#3D3D3D"
  muted: "#737373"
  rule: "#E5E5E5"
  rule-firm: "#C9C9C9"
  rule-heavy: "#121212"
  violet: "#660E80"
  violet-deep: "#4E0A62"
  violet-wash: "#F4EDF7"
  on-violet: "#FFFFFF"
  ok: "#15803D"
  ok-fill: "#22C55E"
  warn: "#854D0E"
  warn-fill: "#FACC15"
  risk: "#B91C1C"
  risk-fill: "#EF4444"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 1.24
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  annotation:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  register:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.01em"
    fontVariation: "tabular-nums"
  label:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.09em"
rounded:
  none: "0"
  xs: "3px"
  sm: "2px"
  md: "0.5rem"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  gutter: "20px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-hover:
    backgroundColor: "{colors.paper-mark}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.on-violet}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
    textColor: "{colors.on-violet}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "30px"
  button-sm:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 9px"
    height: "26px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "30px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "22px"
  register-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "38px"
  register-row-selected:
    backgroundColor: "{colors.violet-wash}"
    textColor: "{colors.ink}"
  stage-band:
    backgroundColor: "{colors.paper-sunk}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "30px"
  stage-band-active:
    backgroundColor: "{colors.violet-wash}"
    textColor: "{colors.violet}"
  modal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "18px"
    width: "min(560px, calc(100vw - 32px))"
---

# Design System: Cober360 · El Padrón

> **Scope.** This document governs `design-concepts/` only — the standalone concept set
> (`prospectos.html`, `backoffice.html`, `supervisor.html`, `admin.html`, `login.html`,
> `index.html`, `assets/cober.css`, `assets/app.js`, `assets/fonts/`). That set imports nothing
> from `src/` by design. **The migrating React app in `src/` is not governed by this file** and
> must not be described or refactored as if it were: it runs Tailwind v4 + shadcn (`radix-nova`)
> with its own token layer. Porting El Padrón into `src/` would be a separate, explicit decision.

## Overview

**Creative North Star: "El Padrón"**

A padrón is an Argentine civil register: one ruled line per person, the identity document as the
spine, nothing floating. This system is that book rendered for a seller working a full shift. It
rejects the card-per-prospect grid the incumbent screen uses — a card wraps one person in a box and
forces the eye to re-enter it 400 times. Here the register is one continuous ruled sheet: the folio
bar says how many exist and which ones you see, stage bands say where in the funnel you are, and
each row says who, what state, blocked against what, and how long since contact. Nothing is hidden
behind an expand.

The world is white paper (`#FFFFFF`), near-black ink (`#121212`), and 1px rules. Density is
deliberately high: rows are 38px, body text is 12.5px, the base font-size is 13px. That density is
the product argument — a seller scanning hundreds of records should get more per screen, not a more
comfortable card. Depth is drawn, not lit: there is exactly one shadow in the entire product surface
(the modal), and everything else separates by rule weight and tonal ground.

Brand identity is honored where it is binding and translated where it fails. Montserrat is
self-hosted as a variable font in two subsets (latin, latin-ext) covering weights 400–800; the build
deliberately refuses `@import` from Google Fonts because a cold open without network fell back to
`system-ui`, which would put the platform's default sans in a display role. The Cober violet
`#660E80` is the brand accent, never the primary, and it is rationed. The system's `--radius: .5rem`
is honored on real containers and is absent from the register, which is ruled rather than boxed.

**Key Characteristics:**
- One ruled register, never a card grid; one row per person.
- The document column carries a visible 1px vertical rule — the padrón's axis.
- Violet appears exactly twice per screen, in fixed roles.
- State is an ordinal four-segment meter first, a color second, and always carries its printed word.
- Density over comfort: 38px rows, 13px base, tabular figures on every compared number.
- Depth by rule weight and tonal ground; a single shadow, on the modal.

## Colors

Paper and ink with a rationed violet and three semantic inks; the palette is a stationery palette,
not a UI palette.

### Primary
- **Cober Violet** (`violet`): the brand accent, never the primary surface color. It has exactly two
  places on any screen: the primary action button, and the active stage band. It additionally
  claims the browser's own surfaces — text selection, caret, focus ring, checkbox `accent-color` —
  because those are one system, not inherited defaults. The login mark panel is the one full-bleed
  violet field in the set.
- **Violet Deep** (`violet-deep`): the pressed/hover state of the primary button only.
- **Violet Wash** (`violet-wash`): the 3px focus halo on fields, the selected/focused register row,
  and the active stage band's ground. A tint, never a text color.

### Secondary
- **Ink** (`ink`) and **Ink 2** (`ink-2`): near-black is the workhorse accent. Proportion bars,
  the "comprometido" stamp, the register's heavy top rules and the selection bar's edge are all
  ink — places a lesser system would reach for the brand color. Ink 2 carries secondary prose,
  section headings, and locality/time cells.
- **Muted** (`muted`): column headers, folio metadata, counts, placeholders, unfilled labels.

### Tertiary
The semantic trio ships in two forms, and the distinction is normative. The design system's
`success 142 71% 45%`, `warning 48 96% 53%` and `destructive 0 84% 60%` are **fill** values: as
text on white they measure roughly 2.3:1, 1.6:1 and 3.8:1 and fail WCAG AA. They are kept as fills
and stamp grounds, and text-safe partners were derived in the same hue family.

- **Sale Green** — `ok-fill` fills, `ok` speaks: the closed-well stamp, upward trend figures.
- **Docket Amber** — `warn-fill` fills at 9%, `warn` speaks: the in-progress stamp.
- **Alert Red** — `risk-fill` fills at 7%, `risk` speaks: the dropped stamp, the error notice, the
  invalid field border, cold-contact times, downward trends.

### Neutral
- **Paper** (`paper`): the register ground, the folio bar, sticky headers, buttons, fields, modal.
- **Paper Sunk** (`paper-sunk`): the nav rail, stage bands, row hover, modal footer, table hover,
  meter tracks. The single step of tonal recession in the system.
- **Paper Mark** (`paper-mark`): the violet-tinted neutral that marks the current nav item and
  quiet-button hover. It is a neutral with brand in it, not an accent.
- **Rule** (`rule`): the 1px line between every row, every table cell, every section.
- **Rule Firm** (`rule-firm`): the heavier hairline that closes the folio bar and column headers,
  outlines controls, and colors scrollbar thumbs.
- **Rule Heavy** (`rule-heavy`): the 2px ink rule that opens a ruled section and the selection bar.

A full dark theme is defined on `[data-theme="dark"]`, toggled by hand and persisted in
`localStorage`. It is a token remap, not a second design: paper becomes `#121212`, ink inverts, and
violet lightens to `#C77DDB` so it survives on dark ground. The semantic text inks lighten
correspondingly; the fills do not change.

### Named Rules

**The Two Violets Rule.** Violet appears in exactly two roles per screen: the primary action and the
active stage band. It is not a highlight, not a link default, not a left border on the current nav
item, not a chart series. If a third violet appears, one of them was decoration.

**The Fill-Is-Not-Text Rule.** The design system's semantic colors are fills. Never set them as text
or as a 1px border alone. Use the derived text ink for words and the fill for grounds, at the
observed dilutions (9% amber, 11% green, 7% red) and borders mixed against `rule`.

**The Ink-Carries-Data Rule.** Quantities are drawn in ink. Proportion bars, meters, and the
committed stamp are `ink` or `rule-firm`, never brand color — a bar chart in violet would spend the
accent on something that is not an action.


### Escala secuencial de cuartiles (mapas)

Adición deliberada al sistema, no deriva. El coropleta de prospectos necesita una
escala **ordenable**: antes usaba cuatro tonos sueltos (carmesí, naranja, ámbar,
cyan) donde el color no ordenaba nada y había que leer la leyenda para saber si
naranja era más o menos que cyan.

| Cuartil | Valor | Uso |
|---|---|---|
| Bajo | `#E4D3EB` | < q25 |
| Medio | `#BC90CC` | ≥ q25 |
| Medio-alto | `#8C43A6` | ≥ q50 |
| Alto | `#660E80` | ≥ q75 — el violeta de marca |
| Sin datos | `#D4D4D4` | umbral en cero |

Monótona en luminosidad, así que "más oscuro" se lee como "más alto" sin leyenda.
Es fija a propósito: se dibuja sobre teselas de mapa que no siguen el tema, así
que no puede depender de claro/oscuro. Definida en `MapaCoropleta.tsx`.

## Typography

**Display / Body / Label Font:** Montserrat (self-hosted variable, weights 400–800, fallback
`ui-sans-serif, system-ui, sans-serif`)

**Character:** One family does everything, which is what a register wants. The separation is weight,
size, tracking and case — not typeface. Headings are tight (negative tracking down to −0.03em) and
heavy (700–800); labels are the opposite pole: small, 700, wide (+0.09em to +0.14em), uppercase.
Between those two poles sits an unemphatic 12.5px body that never draws attention to itself.

### Hierarchy
- **Display** (800, 27px, −0.03em): the set index title and the login mark's pull quote. One per page
  at most, and only on entry surfaces.
- **Headline** (700, 21px, −0.025em): readout figures on the dashboards and the login form title.
  This is the size a number gets when it is the point.
- **Title** (700, 14px, −0.01em): the folio's `h1`, modal titles, empty-state headings. Working
  surfaces top out here — the register never gets a page-sized headline.
- **Body** (400, 12.5px, 1.45): row cells and running prose. Prose is capped at 46ch in empty states
  and 68ch in the index lede.
- **Annotation** (400–600, 11.5px, sentence case): the step between body and label, for prose that
  qualifies something rather than states it — the folio's visible range, the blocked-against reason
  in each row, modal subtitles, field hints, error messages, inline links in the login form. It is
  prose, so it never takes the label's uppercase or tracking. Seven uses across the build make this
  a real step, not a rounding: anything secondary and sentence-shaped lands here rather than
  shrinking the body or borrowing the label.
- **Register** (600, 13.5px, tabular): the document column. It is the largest type in a row on
  purpose: the DNI is the axis and reads first.
- **Label** (700, 10.5px, +0.09em, uppercase): column headers, stage names, field labels, readout
  terms, ruled-section headings. The single most repeated type role in the build.

### Named Rules

**The Tabular Column Rule.** Any figure compared vertically down a column — document, age, elapsed
time, counts — carries `font-variant-numeric: tabular-nums`. Proportional digits in a register are
a defect, not a preference.

**The Label-Is-Not-Prose Rule.** The uppercase 10.5px label style is for naming a field or a column.
Errors and hints inside a labelled field explicitly override it back to 11.5px sentence case: an
error message rendered as a gray uppercase label is unreadable at the moment it matters.

**The One Family Rule.** Montserrat carries every role. Do not introduce a display serif, a mono for
figures, or a second sans for labels; tabular figures come from the variant setting, not a second
font.

## Layout

**The frame.** Two columns: a 208px sticky rail at full height, and the sheet. Both are declared
`min-width: 0` because a grid child otherwise defaults to `auto` and pushes the register off-screen.

**The register grid.** One `grid-template-columns` value, declared once on `.reg` as a custom
property, is consumed by the folio's column headers and by every row. Nothing on the sheet floats in
its own coordinate system; if a header aligns with its column, it is because it is literally the
same grid. Prospectos runs ten columns (mark · document · name · age · locality · origin · state ·
blocked · contact · action); BackOffice swaps in a nine-column variant (mark · document · holder ·
policy nº · seller · state · blocked · age · action). Rows are `min-height: 38px` with a `0 14px`
gap and 20px gutters.

**Sticky stack.** Three tiers pin, and their offsets are cumulative: the folio bar at `top: 0`
(min-height 56px), column headers at `top: 56px`, stage bands at `top: 86px`. The selection bar pins
to the bottom at 46px with a heavy ink top rule.

**Rhythm.** 4 / 6 / 10 / 14 / 20px. 20px is the page gutter and the row gutter; 14px is the standard
gap between grouped controls and stacked blocks; 6–10px is inside a control. Control heights are a
short fixed ladder: 26px (small button), 30px (button, field, stage band, column header row), 32px
(text input), 36px (the login submit), 38px (register row), 46px (selection bar), 56px (folio, rail
mark).

**Responsive: the register degrades by dropping columns, never by scrolling horizontally.** A
horizontal scrollbar under a register is a failure — the column you need is the one off-screen. The
drop order, coarsest decision first:

- **≤1380px** — the two columns that least decide who to call go: prospectos drops *age* and
  *origin*; backoffice drops *seller*. Gutters tighten to 16px, gap to 12px.
- **≤1180px** — prospectos drops *locality*; backoffice drops *policy nº*. Gutters 14px, gap 10px.
- **≤1024px** — the rail flips from a vertical 208px column to a horizontal scrolling tab strip
  56px tall; group titles, the rail footer, counts and keyboard hints hide. The login splits from
  two panes to one and the violet mark panel is dropped.
- **≤720px** — the row stops being a grid row and becomes a three-line named-area block
  (`mark name stamp / mark dni time / mark block act`). Column headers hide entirely; age, locality
  and origin are gone; the document demotes to 12px muted since the name now leads. The row action
  becomes permanently visible at a 32px touch target instead of appearing on hover, and checkboxes
  grow from 14px to 17px.

**Never drops:** document, name, state stamp, blocked-against, and elapsed time. Those five are the
register.

## Elevation & Depth

This system is flat by construction. Depth comes from three graded rule weights (`rule` 1px hairline,
`rule-firm` 1px firm, `rule-heavy` 2px ink) plus a single step of tonal recession (`paper-sunk`) for
the rail, stage bands and hover. A heavier rule means a stronger boundary; a sunk ground means a
subordinate surface. No card in the product carries a shadow, a border-radius container, or a lift
on hover.

### Shadow Vocabulary
- **Modal lift** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / .22), 0 2px 6px -2px rgb(0 0 0 / .12)`):
  the only shadow in the product. A dialog is genuinely above the page and says so once.
- **Focus halo** (`box-shadow: 0 0 0 3px var(--violet-wash)`): not elevation — a state ring on
  focused fields and inputs, paired with a violet border shift.
- **Backdrop** (`rgb(18 18 18 / .38)`): the modal's own scrim.

### Named Rules

**The One Shadow Rule.** The modal is the only element permitted a drop shadow, because it is the
only element genuinely off the page. Panels, rows, bars, stamps and readouts separate by rule weight.

**The Sticky-Not-Floating Rule.** Bars pin to the edge of their scroll container and are bounded by a
rule, not by a shadow or a blur. The folio, the column headers, the stage bands and the selection bar
all obey this.

## Shapes

Rectangles with hairlines. The corner strategy is deliberately split, and the split is the rule:

- **The register has no radius at all.** Rows, stage bands, the folio bar, column headers, ruled
  sections and the readout strip are `0`. They are ruled, not boxed — there is no container whose
  corner could be rounded.
- **Real containers honor the design system's `.5rem`** — buttons, search fields, text inputs,
  textareas, the error notice, the modal and its footer.
- **2px** is the stamp/meter/track corner: a stamped mark, not a pill. Elements that carry state get
  the hardest survivable corner.
- **3px** is the keycap corner on `<kbd>` chips.

Borders are 1px everywhere except two deliberate 2px ink rules: the top of a ruled section
(`.slab`, `.readout`) and the top border of an active stage band. Circles appear only where the
platform draws them (scrollbar thumbs, the focus ring's 1px softening). The state stamp's meter is a
16×8px rectangle with a 1px border and a linear-gradient fill sized by segment — geometry, not
iconography.

Motion is minimal and honest: `.12s` background/border transitions on buttons, a `.18s` rise on
the modal, and a 1.4s sweep on skeleton bars. All of it is disabled under
`prefers-reduced-motion: reduce`.

## Components

### Buttons
- **Shape:** Softly rounded (`.5rem`), 30px tall, 1px firm hairline.
- **Default:** paper ground, ink text, `rule-firm` border, 600 weight at 12.5px, 12px side padding.
- **Primary:** the violet button. One per screen — this is the accent's first of two roles. Violet
  ground, white text, violet border; hover goes to violet-deep.
- **Quiet:** transparent ground, no border, ink-2 text, 8px padding; hover fills `paper-mark`. For
  icon-only and secondary controls (theme toggle, modal close).
- **Small:** 26px / 9px padding / 12px, used inside register rows.
- **Hover / Focus:** hover fills `paper-mark` and firms the border to `muted`, over `.12s`. Focus is
  the global 2px violet outline at 1px offset. Disabled drops to 45% opacity and suppresses hover.

### Inputs / Fields
- **Search field:** a 30px flex shell (`.field`) containing an icon, a borderless input, and a `/`
  keycap. Border `rule-firm`, radius `.5rem`.
- **Text input:** 32px, `.5rem`, `rule-firm` border on paper; textareas grow, resize vertical only,
  68px minimum.
- **Focus:** border shifts to violet and a 3px `violet-wash` halo appears; the native outline is
  suppressed only because the halo replaces it.
- **Error:** `aria-invalid="true"` turns the border red; the message renders as 11.5px sentence-case
  red at 600, explicitly overriding the uppercase label style.
- **Disabled:** sunk paper ground, muted text, not-allowed cursor.

### Navigation (the rail)
- 208px, sunk ground, hairline right edge, sticky full height. A 56px brand mark on top, grouped
  links, a footer with theme toggle and identity.
- Links are 32px tall, 12.5px/500, ink-2, with a 14px icon at 62% opacity.
- **Active:** weight goes to 700, color to full ink, ground to `paper-mark`, icon to full opacity.
  There is deliberately no colored edge marker — weight and ground already say "here", and the
  accent is spent elsewhere. In the ≤1024px tab strip the active marker becomes a 2px **ink**
  bottom border, still not violet.

### The Folio Bar
The signature header. Title, then a rule-separated count block (19px bold figure + uppercase
"asientos"), then the visible range with its active filter and sort and the `J`/`K` keycaps, then
tools pushed right. It answers *how many exist, which ones am I looking at, and against what filter*
without opening anything, and it never scrolls away.

### The Register Row
Flat, 38px, hairline-bottomed, no radius, no shadow. Hover sinks to `paper-sunk`; selected and
focus-within both fill `violet-wash`. The folio number prints on the row (not only in ARIA). The
document cell stretches full row height and carries a 1px right rule with a negative margin so the
line closes the 14px gutter — that continuous vertical line running the whole register is the
padrón's axis and the single most identifying mark of the world. The row action button is
`opacity: 0` at rest and appears on hover, focus-within or selection; below 720px it is always
visible.

### The State Stamp
A 22px bordered rectangle (2px corner) with uppercase 11px text and, before the word, a 16×8px
four-segment meter filled by `--grade / 4`. **The grade is ordinal, so load reads without learning
the palette; color only confirms the count.** Five documented loads:

| load | grade | reading |
|---|---|---|
| `inerte` | 1/4 | the record exists and nothing is moving it — muted, hairline border |
| `curso` | 2/4 | work is on it — amber ink, 9% amber ground |
| `firme` | 3/4 | the funnel advanced and there is an obligation — **ink**, not violet |
| `venta` | 4/4 | closed well — green ink, 11% green ground |
| `caido` | 0/4 | the load was dropped — red ink, empty meter with a dashed stroke |

Every stamp prints its word at constant scale; the stamp never communicates by color alone, and it
lives in a fixed column rather than floating as a pill.

### Blocked-Against
A lock icon plus a truncating 11.5px line naming what a record is stuck on, on every row. It makes a
stalled entry traceable to its blocker from the list. The `data-none` variant mutes the text.

### Ruled Sections and the Readout Strip
The dashboards use the register's grammar rather than panels: a `.slab` opens with a 2px ink top
rule and an uppercase 10.5px heading over a firm hairline, with no card, no radius, no ground. Key
figures render as one ruled horizontal band (`.readout`) of auto-fitting cells divided by 1px
rules — a rule of readings, not six cards — with 21px figures and colored trend deltas. Below 720px
the cell dividers rotate from right borders to bottom borders.

### Meter Rows
Label / track / value in a three-column grid. The track is sunk with a hairline and a 2px corner;
the fill is **ink** (or `rule-firm` for a muted series). Proportion is data, not decoration, so it
is drawn in ink.

### Modal
A native `<dialog>`: `.5rem` radius, firm hairline, the system's one shadow, a 38%-black backdrop,
and a 180ms rise. Header (14px title, optional sub, quiet close), scrolling body capped at 62vh,
footer on sunk ground with actions pushed right. Backdrop click closes; destructive dialogs require
typing a confirmation word and keep the submit disabled until it matches, resetting on close.

### Selection Bar
Pins to the bottom at 46px on a heavy ink top rule when at least one row is marked, showing the
count, hairline separators, and actions pushed right. It stacks and full-widths its buttons below
720px.

## Do's and Don'ts

### Do:
- **Do** put new tabular surfaces on the register grammar: one `--cols` custom property declared
  once on the container and consumed by both the header row and every data row.
- **Do** give any vertically-compared figure tabular numerals.
- **Do** spend violet on exactly two things per screen: the primary action and the active stage band.
- **Do** print the word next to any colored state, at constant scale, in a fixed column.
- **Do** honor `.5rem` on real containers (buttons, fields, inputs, modals) and `0` on ruled
  register surfaces.
- **Do** separate surfaces with graded rule weights — 1px hairline, 1px firm, 2px ink — and one step
  of sunk ground.
- **Do** degrade a wide register by dropping the least decisive column at 1380 / 1180 / 1024, and
  keep document, name, state, blocked-against and elapsed time at every width.
- **Do** self-host any face the system depends on, so a cold or offline open never falls back to
  `system-ui` in a display role.
- **Do** use the derived semantic text inks for words and the system's semantic values only as
  fills and stamp grounds.

### Don't:
- **Don't** reintroduce card-per-record layouts for list surfaces; the register is the thesis and a
  card grid is exactly what it replaces.
- **Don't** add a drop shadow to anything but the modal.
- **Don't** round a register surface — rows, stage bands, sticky bars, ruled sections and readouts
  stay at `0`.
- **Don't** set the design system's semantic fills as text color; they fail WCAG AA on white.
- **Don't** use violet for data: no violet bars, meters, trend figures, chart series, or the
  "comprometido" stamp. Data is drawn in ink.
- **Don't** mark the current nav item with a colored edge rule; weight plus `paper-mark` ground is
  the marker, and above 1px an edge filet is a craft-floor violation anyway.
- **Don't** let a register scroll horizontally to preserve columns.
- **Don't** render a state as a floating pill or as color without its printed word.
- **Don't** style an inline error or hint with the uppercase label role; errors are sentence-case
  prose.
- **Don't** omit `min-width: 0` on grid children in this system — every overflow defect in the build
  traced to that default.

## Known Gaps

Recorded from the finish review's queued ceiling items, in its stated order. These are unbuilt, not
defects:

1. Print stylesheet — a padrón that cannot be printed is incomplete.
2. Sortable column heads with `aria-sort`.
3. Per-band subtotals on stage sections.
4. A density switch.
