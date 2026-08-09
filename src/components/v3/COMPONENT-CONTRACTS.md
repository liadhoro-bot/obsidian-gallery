# OG-WDS component contracts

Use these contracts when creating the first implementation of the component library. They deliberately constrain visual freedom.

| Component | Default material | Physicality | Radius | Default depth | Key contract |
|---|---|---:|---|---|---|
| `WorkbenchShell` | walnut structure + neutral content field | 2 | L structural regions | structural only where construction exists | Background supports the task; never a giant wood texture competing with content. |
| `SurfacePanel` | parchment/premium paper | 2 | M | flat/contact | Organizes workspace; no hardware by default. |
| `EntityCard` | paper; parchment when elevated in importance | 2 | M | contact | Represents one entity; content/image dominates. |
| `Tray` | walnut + optional cork/paper bed | 4 | L | structural | Must physically group a real collection of objects. |
| `Drawer` | walnut association, clean content | 3 | M/L | medium/structural while open | Secondary content reveal; not permanent atmosphere. |
| `Shelf` | walnut | 4 | L | structural | Showcase/collection only. |
| `PaperSheet` | paper | 3 | S/M | floating-paper | Freeform liftable information object. |
| `StickyNote` | warmer paper | 4 | S | floating-paper | Temporary/personal/contextual; not primary information. |
| `ImageMount` | paper/parchment mount | 2 | S/M | contact | Presents image consistently; does not alter image. |
| `Plaque` | paper/parchment; brass only prestigious | 3 | S | contact | Names permanent place/object. |
| `Label` | UI-native or contextual paper | 2 | S | flat | Classifies; compact; not a mini-card. |
| `Divider` | native/printed/seam | 1 | none | none | Separates without containment. |
| `Button` | UI-native with restrained tactile cue | 2 | S | contact/pressed | Action only; pressed state changes depth. |
| `ProgressTrack` | recessed/printed/inlaid | 3 | S | inset/flat | Always communicates a clear value; color is restrained. |
| `PaintSwatch` | actual paint/color sample | 3 | context | contact if mounted | Color accuracy outranks decorative texture. |
| `Badge` | paper/parchment/UI-native | 2 | S/pill if semantic | contact/flat | Compact status/high-salience information. |
| `Medallion` | brass/metal/enamel | 3 | L/round | medium | Rare achievement/special recognition. |
| `Stamp` | ink on receiving surface | 3 | n/a | none | State/validation with clear semantic meaning. |
| `Pin` | brass | 5 | round | tiny contact | Must attach a flexible object. |
| `StructuralHardware` | brass default; steel utility | 5 | n/a | tiny contact | Must join rigid construction; counts toward screen budget. |

## Functional controls not explicitly illustrated in the source pack

Fields, selects, segmented controls, switches, checkboxes, menus and pagination should be **visually quieter than the surrounding content**. Their implementation is calibrated from the constitution rather than invented as new physical objects.

Default contract:
- Source Sans 3;
- `radius-s`;
- neutral paper/parchment-adjacent surface or transparent context;
- restrained border;
- no material texture;
- no hardware;
- clear hover/focus/disabled/error states;
- 44px touch target where applicable.

Do not turn a select into a brass machine control or every checkbox into a physical token.

## Prop design rule

Prefer constrained semantic APIs:

```ts
type SurfacePanelProps = {
  density?: 'compact' | 'default' | 'spacious';
  elevation?: 'flat' | 'contact';
};

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'compact' | 'default' | 'large';
};
```

Avoid escape-hatch APIs such as:

```ts
material?: string;
shadow?: string;
radius?: number;
color?: string;
```

If a route needs those to match the reference, the primitive contract is probably incomplete and should be solved centrally.
