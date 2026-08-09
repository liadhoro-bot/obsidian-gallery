# Component family — core surfaces

Core surfaces carry most of the application. They intentionally sit at physicality 1–2 so content remains dominant.

## Preferred nesting

```text
WorkbenchShell
└── SurfacePanel
    ├── Section header
    ├── EntityCard / domain content
    ├── Divider
    └── functional controls
```

Avoid:

```text
Walnut frame
└── Parchment panel
    └── Paper card
        └── Brass frame
            └── inset panel
```

If a screen reads as a stack of decorative containers before it reads as miniature-painting content, simplify it.

## SurfacePanel
- Physicality: 2.
- Radius: M.
- Depth: flat/contact.
- Hardware: none by default.
- Texture: subtle enough to disappear behind reading.
- Best for: sections, forms, workspace regions.

## EntityCard
- Physicality: 2.
- Radius: M.
- Depth: contact.
- Hardware: none.
- Content: one entity only.
- Image treatment: `ImageMount` where a physical mount is justified, otherwise normal clean media region.

## Divider
- Physicality: 1.
- Use instead of another wrapper when the goal is merely separation.
