# Caustics Lab

A Next.js browser sandbox for experimenting with surface-driven caustic light patterns.

The simulation intentionally starts with a fast geometric approximation rather than full physical optics:

```txt
surface height -> surface gradient -> ray deflection -> projected intensity
```

This makes it suitable for learning, live parameter tuning, and later export experiments where a frozen height field can become a reflective plate, vacuum-form buck, resin-cast optic, or 3D printed mold.

## Current features

- Animated procedural surface fields
- Water, faceted, and interference presets
- Refractive bend, focus, exposure, blur, and ray density controls
- Side-by-side projected caustic and virtual surface preview
- Client-side canvas renderer with no backend dependency

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

The original boids starter code is still present in the repository for reference, but the active route now mounts `components/OpticsLab.tsx`.

Next implementation steps:

1. Add a frozen-frame export path for the surface height field.
2. Convert the height field into an STL mesh.
3. Add material presets for reflective versus refractive physical builds.
4. Add a calibration target for real LED/projector testing.
