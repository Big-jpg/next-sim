"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "water" | "facet" | "interference";

type Config = {
  mode: Mode;
  amplitude: number;
  scale: number;
  bend: number;
  focus: number;
  exposure: number;
  step: number;
  blur: number;
  speed: number;
};

const DEFAULT_CONFIG: Config = {
  mode: "water",
  amplitude: 0.72,
  scale: 7.6,
  bend: 0.92,
  focus: 1.15,
  exposure: 1.65,
  step: 3,
  blur: 1,
  speed: 0.52,
};

const PRESETS: Record<string, Config> = {
  "Water Sheet": DEFAULT_CONFIG,
  "Glass Ripple": { ...DEFAULT_CONFIG, amplitude: 0.58, scale: 6.2, bend: 1.28, focus: 1.45, exposure: 1.8, step: 2 },
  "Facet Field": { ...DEFAULT_CONFIG, mode: "facet", amplitude: 0.5, scale: 9.8, bend: 1.45, exposure: 2.05, blur: 0, step: 2, speed: 0.28 },
  "Interference Pool": { ...DEFAULT_CONFIG, mode: "interference", amplitude: 0.65, scale: 8.6, bend: 1.12, focus: 1.35, exposure: 1.95 },
};

const WAVES = [
  [1.0, 0.32, 2.0, 0.72, 1.0, 0.0],
  [-0.45, 0.95, 2.65, 0.48, -0.72, 1.7],
  [0.72, -0.86, 3.35, 0.34, 0.55, 3.1],
  [-0.95, -0.18, 4.85, 0.18, -0.38, 2.4],
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function surface(u: number, v: number, t: number, cfg: Config) {
  const x = (u - 0.5) * cfg.scale;
  const y = (v - 0.5) * cfg.scale;
  let h = 0;
  let gx = 0;
  let gy = 0;

  for (const w of WAVES) {
    const [wx, wy, freq, ampBase, rate, phaseBase] = w;
    const len = Math.hypot(wx, wy) || 1;
    const dx = wx / len;
    const dy = wy / len;
    const phase = (dx * x + dy * y) * freq + t * cfg.speed * rate + phaseBase;
    const amp = cfg.amplitude * ampBase;
    h += amp * Math.sin(phase);
    gx += amp * Math.cos(phase) * dx * freq;
    gy += amp * Math.cos(phase) * dy * freq;
  }

  if (cfg.mode === "facet") {
    const p1 = (x * 1.62 - y * 0.56) * 2.2 + t * cfg.speed * 0.32;
    const p2 = (x * -0.74 + y * 1.48) * 1.9 - t * cfg.speed * 0.26;
    const s1 = Math.sin(p1);
    const s2 = Math.sin(p2);
    const d1 = -Math.sign(s1 || 1) * Math.cos(p1) * 0.23;
    const d2 = -Math.sign(s2 || 1) * Math.cos(p2) * 0.19;
    h += cfg.amplitude * ((1 - Math.abs(s1)) * 0.42 + (1 - Math.abs(s2)) * 0.36);
    gx += cfg.amplitude * (d1 * 1.62 * 2.2 + d2 * -0.74 * 1.9);
    gy += cfg.amplitude * (d1 * -0.56 * 2.2 + d2 * 1.48 * 1.9);
  }

  if (cfg.mode === "interference") {
    const sources = [[-2.15, -1.1, 0.82, 0.3], [1.75, 1.35, -0.64, 1.9], [0.35, -2.1, 0.46, 2.7]];
    for (const [sx, sy, rate, phaseBase] of sources) {
      const dx = x - sx;
      const dy = y - sy;
      const r = Math.hypot(dx, dy) + 0.001;
      const phase = r * 4.4 + t * cfg.speed * rate + phaseBase;
      const amp = cfg.amplitude * 0.22;
      h += amp * Math.sin(phase);
      gx += amp * 4.4 * Math.cos(phase) * (dx / r);
      gy += amp * 4.4 * Math.cos(phase) * (dy / r);
    }
  }

  return { h, gx, gy };
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(240, Math.floor(rect.width * dpr));
  const height = Math.max(180, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function add(buffer: Float32Array, width: number, height: number, x: number, y: number, radius: number, amount: number) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ix = x + dx;
      const iy = y + dy;
      if (ix < 0 || iy < 0 || ix >= width || iy >= height) continue;
      buffer[iy * width + ix] += amount / (1 + dx * dx + dy * dy);
    }
  }
}

function drawProjection(canvas: HTMLCanvasElement, cfg: Config, t: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const energy = new Float32Array(width * height);
  const bend = cfg.bend * cfg.focus * 0.0024;
  const step = Math.max(1, Math.floor(cfg.step));
  const blur = Math.max(0, Math.floor(cfg.blur));

  for (let y = 0; y < height; y += step) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += step) {
      const u = x / Math.max(1, width - 1);
      const s = surface(u, v, t, cfg);
      const ix = Math.round(x - s.gx * bend * width);
      const iy = Math.round(y - s.gy * bend * height);
      add(energy, width, height, ix, iy, blur, 1 + Math.min(1.5, Math.hypot(s.gx, s.gy) * 0.045));
    }
  }

  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let i = 0; i < energy.length; i++) {
    const shade = clamp01(1 - Math.exp(-energy[i] * cfg.exposure * 0.12));
    const p = i * 4;
    data[p] = Math.floor(6 + shade * 235);
    data[p + 1] = Math.floor(10 + shade * 245);
    data[p + 2] = Math.floor(18 + shade * 255);
    data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function drawSurface(canvas: HTMLCanvasElement, cfg: Config, t: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      const s = surface(u, v, t, cfg);
      const shade = clamp01((0.5 + s.h * 0.17) * 0.7 + Math.hypot(s.gx, s.gy) * 0.035);
      const p = (y * width + x) * 4;
      data[p] = Math.floor(8 + shade * 70);
      data[p + 1] = Math.floor(20 + shade * 110);
      data[p + 2] = Math.floor(36 + shade * 165);
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export default function OpticsLab() {
  const projectionRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLCanvasElement | null>(null);
  const cfgRef = useRef<Config>(DEFAULT_CONFIG);
  const pausedRef = useRef(false);
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [paused, setPaused] = useState(false);

  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const projection = projectionRef.current;
    const optic = surfaceRef.current;
    if (!projection || !optic) return;
    let frame = 0;
    let time = 0;

    const render = (now: number) => {
      fitCanvas(projection);
      fitCanvas(optic);
      if (!pausedRef.current) time = now * 0.001;
      drawProjection(projection, cfgRef.current, time);
      drawSurface(optic, cfgRef.current, time);
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const update = <K extends keyof Config>(key: K, value: Config[K]) => setCfg((current) => ({ ...current, [key]: value }));

  return (
    <main className="lab-shell">
      <section className="hero-panel">
        <p className="eyebrow">Computational optics starter</p>
        <h1>Caustics Lab</h1>
        <p className="hero-copy">A browser sandbox for learning the path from surface height -&gt; gradient -&gt; light deflection -&gt; projected intensity. The model is approximate by design, but the geometry is useful.</p>
      </section>

      <section className="lab-grid">
        <article className="canvas-card primary-canvas-card">
          <div className="card-header">
            <div><p className="label">Projection plane</p><h2>Accumulated light</h2></div>
            <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
          </div>
          <canvas ref={projectionRef} className="projection-canvas" />
        </article>

        <article className="canvas-card surface-card">
          <div className="card-header compact"><div><p className="label">Virtual optic</p><h2>Surface field</h2></div></div>
          <canvas ref={surfaceRef} className="surface-canvas" />
        </article>

        <aside className="control-card">
          <div className="control-heading"><p className="label">Controls</p><h2>Optical parameters</h2></div>
          <div className="preset-grid">
            {Object.keys(PRESETS).map((name) => <button key={name} type="button" onClick={() => setCfg(PRESETS[name])}>{name}</button>)}
          </div>
          <fieldset>
            <legend>Surface</legend>
            <label className="control-row"><span>Mode</span><select value={cfg.mode} onChange={(event) => update("mode", event.currentTarget.value as Mode)}><option value="water">Water</option><option value="facet">Facet</option><option value="interference">Interference</option></select></label>
            <Slider label="Amplitude" value={cfg.amplitude} min={0.1} max={1.3} step={0.01} onChange={(v) => update("amplitude", v)} />
            <Slider label="Wave scale" value={cfg.scale} min={3.5} max={13} step={0.1} onChange={(v) => update("scale", v)} />
            <Slider label="Speed" value={cfg.speed} min={0} max={1.6} step={0.01} onChange={(v) => update("speed", v)} />
          </fieldset>
          <fieldset>
            <legend>Projection</legend>
            <Slider label="Bend" value={cfg.bend} min={0.05} max={2.2} step={0.01} onChange={(v) => update("bend", v)} />
            <Slider label="Focus" value={cfg.focus} min={0.25} max={2.4} step={0.01} onChange={(v) => update("focus", v)} />
            <Slider label="Exposure" value={cfg.exposure} min={0.3} max={3.4} step={0.01} onChange={(v) => update("exposure", v)} />
            <Slider label="Blur" value={cfg.blur} min={0} max={3} step={1} onChange={(v) => update("blur", v)} />
            <Slider label="Ray step" value={cfg.step} min={1} max={8} step={1} onChange={(v) => update("step", v)} />
          </fieldset>
          <div className="note-card"><h3>Next physical step</h3><p>Freeze a surface frame, export its height field, then generate an STL for a reflective plate, vacuum-form buck, or resin-cast lens.</p></div>
        </aside>
      </section>
    </main>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="control-row"><span>{`${label} (${Number.isInteger(value) ? value : value.toFixed(2)})`}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} /></label>;
}
