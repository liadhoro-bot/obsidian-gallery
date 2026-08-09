# Screen specification template

Create one file per approved route:
`docs/design/screens/<screen>/spec.md`

---

# [Screen name]

## Status
- Draft / Approved / Deprecated
- Owner:
- Last reviewed:

## Route
`/example/[id]`

## Objective
What is the user's main job on this screen?

## Primary next action
What should feel like the natural next meaningful action?

## References
- `reference-mobile.png` - viewport:
- `reference-desktop.png` - viewport:
- optional state refs:

## Golden implementation
Which approved route should this feel like it belongs beside?

## Preserve behavior
- ...
- ...

## Information hierarchy
1. ...
2. ...
3. ...

## Composition
Describe structure, not decoration.

Example:
- WorkbenchShell
- Page identity
- hero ImageMount + entity identity
- SurfacePanel containing status/progress
- supporting metadata
- CTA

## OG-WDS component mapping

| Content | Component | Variant |
|---|---|---|
| | | |

## Materials
- structural:
- primary surface:
- secondary:
- special accents:
- prohibited on this screen:

## Physicality
- highest physicality object:
- shadow types:
- hardware count/role:

## Typography
- title:
- section headings:
- body:
- labels:
- technical data:

## Responsive behavior

### Mobile
- order:
- scrolling:
- collapsible content:
- fixed elements:

### Tablet
- ...

### Desktop
- ...

## States not shown in the mockup
- loading:
- empty:
- error:
- disabled:
- permission:
- long text:
- many items:

## Accessibility
- focus expectations:
- keyboard behavior:
- labels/aria:
- color-independent status:

## Do not infer
List visually tempting but incorrect interpretations.

Example:
- the three mockup cards are sample data, not a hard maximum.
- the visible photo is real content, not a background decoration.
- the mockup crop does not imply removal of the bottom navigation.

## Acceptance checklist
- ...
