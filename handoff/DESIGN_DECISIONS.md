# Design and interaction decisions

These are decisions reached through repeated visual review. Treat them as defaults unless a new request explicitly changes them.

## Visual language

- Dark neutral workbench; avoid flooding the interface with the green accent.
- Selected effect/filter chips use white or neutral contrast.
- Green is for available actions, successful model status, and lightweight confirmation.
- Match the phone preview radius and restrained panel radius across the right-side UI.
- Keep the right-side information compact enough to align visually with the phone height.
- Long material and song names must truncate rather than move neighboring controls onto new lines.

## Parameter and music interaction

Rejected approaches:

- Four separate workspaces/tabs: too much navigation.
- Expanding parameters inline inside the effect card: created nested scrolling and hid materials.
- Large centered modal with page blur: blocked visual feedback and felt visually inconsistent.

Accepted approach:

- A single lightweight drawer enters from the right.
- The phone preview stays visible and interactive-looking; no backdrop blur/dim.
- The drawer is approximately phone-height and uses compact two-column controls.
- Only the drawer scrolls.
- Click the blank area or Close to dismiss.
- Music selection uses the same shell.
- Opening a drawer does not fold or mutate the effect/material cards.

## Effect behavior

- Audio response must be visible but not permanently frantic.
- Prefer transient-triggered motion with decay, inertia, and rest over continuous decorative oscillation.
- Parameters must produce obvious, inspectable changes.
- Reference-led effects should preserve the reference’s compositing logic, not only its surface motif.
- For text physics: objects must displace on collision; they must not overlap or remain glued in fixed positions.
- Palette extraction should respond to the selected image. Example swatches communicate saturation targets, not fixed colors.

## Performance

- Do not eagerly decode the whole music library.
- Cache expensive masks, luminance grids, distance fields, and static patterns.
- Reuse offscreen canvases and cap expensive procedural passes when 60 fps is unnecessary.
- Validate narrow desktop layouts; avoid unintended wrapping and nested scroll regions.
