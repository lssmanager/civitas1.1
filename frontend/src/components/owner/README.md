# Owner visual layer

The owner pages (`Overview`, `Create`, and `Runtime`) must compose their layout through `OwnerShell` and the base components in `OwnerUI.tsx` instead of redefining page-level cards, banners, metrics, and navigation classes inline.

- `OwnerShell` is the single primary navigation and page-width owner container.
- `PageHeader`, `SectionCard`, `MetricCard`, `StatusBanner`, and state components own recurring spacing, borders, backgrounds, radii, and typography.
- Page files keep responsibility for data loading and domain-specific content only.
