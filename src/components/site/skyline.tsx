"use client";

import { motion, useReducedMotion } from "motion/react";

/*
 * Skyline di Manhattan disegnata a codice (come nel logo): due piani di torri,
 * che all'apertura della pagina "crescono" dal suolo una dopo l'altra.
 */

type Tower = { x: number; w: number; h: number; top?: "spire" | "step" | "antenna" | "dome" };

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function buildTowers(seed: number, count: number, minH: number, maxH: number, width: number) {
  const r = rng(seed);
  const out: Tower[] = [];
  let x = 0;
  for (let i = 0; i < count && x < width; i++) {
    const w = 34 + Math.round(r() * 58);
    const h = Math.round(minH + r() * (maxH - minH));
    const t = r();
    out.push({ x, w, h, top: t < 0.12 ? "spire" : t < 0.3 ? "step" : t < 0.42 ? "antenna" : t < 0.48 ? "dome" : undefined });
    x += w + Math.round(r() * 6);
  }
  return out;
}

function towerPath({ x, w, h, top }: Tower, base: number) {
  const y = base - h;
  let d = `M${x},${base} V${y} H${x + w} V${base} Z`;
  const cx = x + w / 2;
  if (top === "spire") d += ` M${cx - w * 0.22},${y} L${cx},${y - h * 0.32} L${cx + w * 0.22},${y} Z M${cx - 1.5},${y - h * 0.32} h3 v-${h * 0.12} h-3 Z`;
  if (top === "step") d += ` M${x + w * 0.15},${y} V${y - 18} H${x + w * 0.85} V${y} Z M${x + w * 0.3},${y - 18} V${y - 34} H${x + w * 0.7} V${y - 18} Z`;
  if (top === "antenna") d += ` M${cx - 1.5},${y} h3 v-46 h-3 Z`;
  if (top === "dome") d += ` M${x + w * 0.12},${y} Q${cx},${y - w * 0.9} ${x + w * 0.88},${y} Z`;
  return d;
}

const W = 1600;
const H = 260;
const BACK = buildTowers(7, 60, 70, 210, W);
const FRONT = buildTowers(42, 60, 40, 150, W);

export function Skyline({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const grow = (i: number, layer: number) =>
    reduce
      ? {}
      : {
          initial: { scaleY: 0 },
          animate: { scaleY: 1 },
          transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const, delay: 0.15 + layer * 0.18 + (i % 14) * 0.035 },
        };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <g fill="var(--color-eu)" opacity="0.9">
        {BACK.map((t, i) => (
          <motion.path key={i} d={towerPath(t, H)} style={{ originY: 1, transformBox: "fill-box" }} {...grow(i, 0)} />
        ))}
      </g>
      <g fill="var(--color-eu-deep)">
        {FRONT.map((t, i) => (
          <motion.g key={i} style={{ originY: 1, transformBox: "fill-box" }} {...grow(i, 1)}>
            <path d={towerPath(t, H)} />
            {/* finestre accese */}
            {t.h > 90 &&
              Array.from({ length: Math.floor((t.h - 30) / 22) }, (_, r) =>
                Array.from({ length: Math.max(1, Math.floor((t.w - 16) / 14)) }, (_, c) =>
                  (r * 7 + c * 3 + i) % 5 === 0 ? (
                    <rect key={`${r}-${c}`} x={t.x + 10 + c * 14} y={H - t.h + 16 + r * 22} width="5" height="7" fill="#fff" opacity="0.55" />
                  ) : null,
                ),
              )}
          </motion.g>
        ))}
      </g>
      <rect x="0" y={H - 10} width={W} height="10" fill="var(--color-eu-deep)" />
    </svg>
  );
}
