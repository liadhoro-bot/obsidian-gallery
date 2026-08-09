# Visual QA acceptance checklist

A UI migration is not complete until it has been visually inspected.

## Required viewports

Default:
- 390 x 844
- 768 x 1024
- 1440 x 900

Add route-specific sizes when the screen spec requires them.

## Compare in this order

### 1. Content/behavior preservation
- Is all previous functionality still present?
- Are important states missing because the mockup did not show them?
- Are loading/error/empty/permissions represented?

### 2. Macro geometry
- shell,
- page width,
- header height,
- content order,
- column/grid structure,
- fixed navigation clearance,
- overflow.

### 3. Hierarchy
- Is the active task obvious?
- Do image/miniature/paint dominate appropriately?
- Is there exactly one strongest CTA?
- Are supporting controls quieter?

### 4. Materials
- Is each material semantically justified?
- Is walnut structural rather than decorative?
- Is parchment the reading surface?
- Is brass restrained?
- Are rare materials actually rare?

### 5. Typography
- correct family,
- correct hierarchy,
- correct case,
- readable line-height,
- no Cormorant in functional UI,
- no Mono as decoration.

### 6. Physicality
- correct radius,
- correct shadow meaning,
- no shadow inflation for importance,
- hardware has a job,
- hardware count within budget.

### 7. Detail
- divider weight,
- icon alignment,
- button pressed/hover/focus state,
- label sizing,
- image mount spacing,
- progress track embedding,
- swatch color honesty.

## Red-flag test

If the screen can be described as any of these, iterate:
- "fantasy dashboard",
- "wooden skeuomorphic app",
- "parchment everywhere",
- "steampunk",
- "RPG inventory screen",
- "glassmorphism workbench",
- "generic beige SaaS with texture",
- "mood board rather than product UI".

The target is a believable modern application with carefully rationed physical craft.

## Screenshot proof

For each migrated route, retain:
- reference screenshot/mockup,
- implementation screenshot at matching viewport,
- optional diff/annotation.

Store under:
`docs/design/screens/<screen>/comparisons/`

## Completion gate

A route passes only if:
- behavior checks pass,
- visual inspection passes,
- mobile overflow is clean,
- accessibility basics pass,
- no forbidden hard-coded visual values were introduced,
- any intentional deviation is documented.
