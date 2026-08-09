# Premium implementation quality bar

OG-WDS should not merely be recognizable. It should feel authored, coherent and production-ready.

## Gate A — fidelity

A migrated screen must feel like the same product as the approved golden implementation at first glance.

Failure examples:
- correct colors but generic SaaS composition;
- reference materials present but wrong physicality hierarchy;
- all components individually styled but overall density/hierarchy differs;
- desktop reference approximated by shrinking onto mobile.

## Gate B — restraint

Premium means fewer, better cues.

Pass when:
- one or two tactile moments carry the material story;
- content/miniatures/paint remain visually dominant;
- controls are precise and quiet;
- brass/hardware feels earned;
- texture disappears during normal reading.

Fail when:
- every card has a special material;
- every surface casts a shadow;
- every corner has hardware;
- typography itself becomes decorative scenery.

## Gate C — consistency

A visual decision that repeats should come from a token or shared component.

Pass when:
- same semantic object has same geometry and state behavior across routes;
- calibrated values are globally tunable;
- route CSS mostly handles composition, not component skinning.

Fail when:
- `CardV3`, `NewCard`, `WorkbenchCard` drift apart;
- local hex/radius/shadow values accumulate;
- each builder reinvents tabs, buttons or fields.

## Gate D — interaction finish

Premium UI includes the states users touch.

Verify:
- hover where relevant,
- focus-visible,
- pressed depth,
- selected state,
- disabled state,
- loading feedback,
- empty/error states,
- safe-area/navigation clearance,
- reduced motion,
- long labels/content,
- realistic item counts.

## Gate E — visual proof

A route is not accepted from code inspection alone.

Required evidence:
1. implementation screenshot at reference viewport;
2. side-by-side comparison with approved reference or golden route;
3. at least one correction pass after comparison;
4. explicit note for intentional deviations.

Pixel identity is not the goal. **Hierarchy, geometry, density, materials, typography and interaction language must be demonstrably coherent.**

## Gate F — preservation

A visually excellent screen that regresses product behavior fails the migration.

Check data loading/mutations, route behavior, validation, analytics, permissions, loading/error/empty states and accessibility semantics before approval.
