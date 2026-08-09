# Composition rules

The purpose of composition is to keep the workbench calm while allowing hero content to feel special.

## Default screen anatomy

Most screens should be composed from:

1. app/workbench shell,
2. page identity,
3. one obvious primary task/content area,
4. supporting panels,
5. one clear next action,
6. restrained navigation.

Do not design every screen as a collage of physical objects.

## Hierarchy by content, not decoration

Use this priority:

1. active task/action,
2. miniature/image/paint,
3. title,
4. primary content,
5. metadata/controls,
6. surrounding workbench.

If the user notices the wood texture before the miniature/project, reduce the wood treatment.

## Surface nesting

Preferred:
- workbench -> panel -> content/card.

Avoid:
- frame -> panel -> card -> inset frame -> inner parchment -> bordered field -> decorative label.

Two obvious nested surface levels are usually enough.
Three requires a clear semantic reason.

## Cards

A card represents one thing.

Do not use cards as generic wrappers for:
- every paragraph,
- every form row,
- every statistic,
- every navigation item.

Use Panel + Divider for grouped functional information.

## Hero moments

Hero objects may use:
- larger imagery,
- more whitespace,
- parchment,
- carefully chosen brass,
- an ImageMount,
- controlled medium shadow.

They may not use:
- random wax,
- maximal texture,
- heavy framing,
- ornamental fantasy effects.

## Color balance

The UI foundation stays neutral.

Strong color belongs to:
- miniature photography,
- paint swatches,
- meaningful progress,
- status where necessary,
- achievement art.

Do not create a competing app-color palette around the hobby content.

## Empty states

An empty state should:
- explain what belongs here,
- give one clear next action,
- feel encouraging rather than administratively empty.

It should not become a giant illustrated poster unless the empty state itself is a deliberate hero moment.

## Forms

Forms are Tier-3 UI.

Use:
- clean paper/native controls,
- compact labels,
- clear grouping,
- progressive disclosure.

Do not make every field a physical object.

For builders/creation flows:
- show progress and next action clearly,
- keep a relevant preview visible when helpful,
- reveal complexity gradually,
- preserve the sense of crafting an object rather than filling a database.

## Navigation

Global navigation is structural.

Walnut can house it, but:
- labels/icons remain clear,
- the nav should not become the strongest object on screen,
- active state should be restrained.

Leather navigation is rare/premium, not the global default.

## CTA density - CALIBRATED DEFAULT

A viewport should generally have:
- one dominant primary action,
- secondary actions visually quieter,
- destructive actions separated or de-emphasized until needed.

Do not place multiple equal-weight wooden/brass buttons next to each other.

## Physical object density - CALIBRATED DEFAULT

Ordinary route:
- 0-1 high-physicality object (4-5 stars) visible in the main viewport.

Hero/achievement route:
- up to 2 when semantically justified.

This is a guardrail against turning the whole UI into a diorama.
