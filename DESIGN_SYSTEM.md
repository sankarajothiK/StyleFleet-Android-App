# Salon OS — Design System

## Source of truth

The supplied Salon OS prototype is the visual reference.

## Core visual system

### Colors

Primary background:
`#161826`

Primary surface:
`#1E2136`

Divider:
`#2D3154`

Primary text:
`#FFFFFF`

Primary accent:
`#D9A441`

Prototype accent alternatives:
- `#E0C068`
- `#B8863B`
- `#8C6239`

Do not invent a replacement palette.

## Accent behavior

The prototype uses the accent throughout:
- active navigation
- primary buttons
- selected chips
- highlights
- links
- charts
- focus states
- status emphasis

Accent-derived variants should be generated consistently from the selected accent.

## Typography

The prototype defines separate body and heading font roles.

Preserve:
- heading hierarchy
- weight relationships
- readable line height
- compact mobile density

Do not substitute random fonts or sizes.

## Layout

Reference target:
- mobile Android-style layout
- approximately 412×892 design reference
- dark background
- rounded surfaces
- compact but spacious information hierarchy

Production must remain responsive to real devices while retaining the visual proportions of the reference.

## Logo

Reference behavior:
- approximately 64×64 on sign-in
- rounded
- accent border
- reused in shop profile

## Inputs

Use:
- dark surface
- subtle divider
- rounded corners
- visible labels
- muted placeholders
- light text
- accent focus

Phone:
- +91 country control
- phone field

OTP:
- four separate boxes
- numeric input
- accent focus
- verification action

## Buttons

Primary:
- filled accent
- rounded
- strong label
- full width where reference uses full width

Secondary:
- dark/surface
- divider border

Icon:
- compact rounded icon control

Do not add gradients unless present in the reference.

## Chips

Used for:
- filters
- periods
- categories
- services
- staff
- payment methods
- templates

Selected:
- accent border/background
- accent text

Unselected:
- dark/surface
- divider
- muted text

## Cards

Surface:
`#1E2136`

Use:
- rounded corners
- controlled padding
- restrained shadows
- clear hierarchy

Do not turn every small element into a card.

## Bottom navigation

Exactly three primary tabs:
- Customers
- Sales
- Accounts

Active:
- accent
- active indicator

Inactive:
- muted

## Customer rows

Include the information shown by the prototype:
- avatar/initial
- name
- MVP/star
- visits
- last visit
- stylist
- lifetime spend
- due
- star action

## Financial UI

Use:
- Indian rupee symbol
- Indian number formatting
- clear hierarchy
- restrained use of accent

## Charts

Use accent-derived colors only.
Charts must display real values in production.

## Bottom sheets/modals

Use the prototype's dark rounded-surface style.

## States

Loading:
- dark-theme skeleton/spinner

Empty:
- concise explanation
- clear next action

Error:
- concise user-facing message
- retry

Do not show raw database/SQL errors.

## Accessibility

Maintain:
- sufficient contrast
- usable touch targets
- labels for icon-only actions
- keyboard-safe forms
- meaningful accessibility labels

Accessibility fixes must not alter the intended visual design.

## Visual QA

Compare implementation against the prototype for:
- colors
- typography
- spacing
- radii
- icon sizes
- buttons
- inputs
- chips
- cards
- bottom navigation
- screen transitions
- modals/bottom sheets
- text
- loading/error/empty states
