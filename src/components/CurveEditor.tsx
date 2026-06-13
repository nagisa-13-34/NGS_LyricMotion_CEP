import { useEffect, useRef, useState, useCallback } from 'react';
import type { CubicCurve, CurvePoint } from '../lib/types';

type CurveEditorProps = {
  label: string;
  curve: CubicCurve;
  onChange: (curve: CubicCurve) => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const lerpVal = (a: number, b: number, t: number) => a + (b - a) * t;

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
};

/** Grid cell size in data-space (0.25 = 4 cells per unit) */
const CELL = 0.25;
const PAD = 16;
const ANIM_SPEED = 0.18;

type Viewport = { minX: number; maxX: number; minY: number; maxY: number };

function computeTarget(p1y: number, p2y: number): Viewport {
  const allY = [0, 1, p1y, p2y];
  const dataMin = Math.min(...allY);
  const dataMax = Math.max(...allY);

  // Snap to grid with 1-cell padding
  let lo = Math.floor((dataMin - CELL * 0.6) / CELL) * CELL;
  let hi = Math.ceil((dataMax + CELL * 0.6) / CELL) * CELL;

  // Ensure 0 and 1 are always visible
  if (lo > 0) lo = 0;
  if (hi < 1) hi = 1;

  // Minimum 4 cells tall
  while (hi - lo < CELL * 4) {
    lo -= CELL;
    hi += CELL;
  }

  const rangeY = hi - lo;
  // Square: X range = Y range, centered on 0.5
  const rangeX = rangeY;
  return {
    minX: 0.5 - rangeX / 2,
    maxX: 0.5 + rangeX / 2,
    minY: lo,
    maxY: hi,
  };
}

export function CurveEditor({ label, curve, onChange }: CurveEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CubicCurve>(curve);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<'p1' | 'p2' | null>(null);
  const [active, setActive] = useState<'p1' | 'p2' | null>(null);

  // Animated viewport
  const currentView = useRef<Viewport>({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
  const targetView = useRef<Viewport>({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
  const animId = useRef(0);
  const isDragging = useRef(false);

  /* ── coordinate transforms (use currentView) ── */
  const toCanvas = useCallback((pt: CurvePoint, w: number, h: number) => {
    const v = currentView.current;
    const gw = w - PAD * 2;
    const gh = h - PAD * 2;
    return {
      x: PAD + ((pt.x - v.minX) / (v.maxX - v.minX)) * gw,
      y: PAD + ((v.maxY - pt.y) / (v.maxY - v.minY)) * gh,
    };
  }, []);

  const fromCanvas = useCallback((cx: number, cy: number, w: number, h: number): CurvePoint => {
    const v = currentView.current;
    const gw = w - PAD * 2;
    const gh = h - PAD * 2;
    return {
      x: round2(clamp(v.minX + ((cx - PAD) / gw) * (v.maxX - v.minX), 0, 1)),
      y: round2(v.maxY - ((cy - PAD) / gh) * (v.maxY - v.minY)),
    };
  }, []);

  /* ── drawing ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(200, Math.floor(Math.min(rect.width, rect.height)));
    const w = size;
    const h = size;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const v = currentView.current;
    const gw = w - PAD * 2;
    const gh = h - PAD * 2;

    // Background
    ctx.fillStyle = '#151615';
    ctx.fillRect(0, 0, w, h);

    // Highlight 0-1 area
    const origin = toCanvas({ x: 0, y: 0 }, w, h);
    const corner = toCanvas({ x: 1, y: 1 }, w, h);
    ctx.fillStyle = 'rgba(32, 35, 31, 0.55)';
    ctx.fillRect(
      Math.min(origin.x, corner.x),
      Math.min(origin.y, corner.y),
      Math.abs(corner.x - origin.x),
      Math.abs(corner.y - origin.y),
    );

    // Grid lines at every CELL interval
    const firstX = Math.floor(v.minX / CELL) * CELL;
    const firstY = Math.floor(v.minY / CELL) * CELL;

    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let dx = firstX; dx <= v.maxX + CELL * 0.5; dx += CELL) {
      const sx = PAD + ((dx - v.minX) / (v.maxX - v.minX)) * gw;
      if (sx < PAD - 1 || sx > PAD + gw + 1) continue;
      const isEdge = Math.abs(dx) < 0.001 || Math.abs(dx - 1) < 0.001;
      ctx.strokeStyle = isEdge ? '#6b726a' : '#343833';
      ctx.beginPath();
      ctx.moveTo(Math.round(sx) + 0.5, PAD);
      ctx.lineTo(Math.round(sx) + 0.5, PAD + gh);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let dy = firstY; dy <= v.maxY + CELL * 0.5; dy += CELL) {
      const sy = PAD + ((v.maxY - dy) / (v.maxY - v.minY)) * gh;
      if (sy < PAD - 1 || sy > PAD + gh + 1) continue;
      const isEdge = Math.abs(dy) < 0.001 || Math.abs(dy - 1) < 0.001;
      ctx.strokeStyle = isEdge ? '#6b726a' : '#343833';
      ctx.beginPath();
      ctx.moveTo(PAD, Math.round(sy) + 0.5);
      ctx.lineTo(PAD + gw, Math.round(sy) + 0.5);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#343833';
    ctx.strokeRect(PAD, PAD, gw, gh);

    // Handle lines
    const start = toCanvas({ x: 0, y: 0 }, w, h);
    const end = toCanvas({ x: 1, y: 1 }, w, h);
    const cp1 = toCanvas(draft.p1, w, h);
    const cp2 = toCanvas(draft.p2, w, h);

    ctx.strokeStyle = '#8a9085';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(cp1.x, cp1.y);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(cp2.x, cp2.y);
    ctx.stroke();

    // Bezier curve
    ctx.strokeStyle = '#5ab9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const x = cubic(0, draft.p1.x, draft.p2.x, 1, t);
      const y = cubic(0, draft.p1.y, draft.p2.y, 1, t);
      const pt = toCanvas({ x, y }, w, h);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Handles
    const drawHandle = (pt: { x: number; y: number }, color: string, on: boolean) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = on ? '#ffffff' : '#111111';
      ctx.lineWidth = on ? 3 : 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, on ? 8 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawHandle(cp1, '#ffffff', active === 'p1');
    drawHandle(cp2, '#ffffff', active === 'p2');
  }, [draft, active, toCanvas]);

  /* ── animation loop ── */
  const animate = useCallback(() => {
    const c = currentView.current;
    const t = targetView.current;

    if (isDragging.current) {
      // Snap instantly while dragging to prevent coordinate jitter
      c.minX = t.minX; c.maxX = t.maxX;
      c.minY = t.minY; c.maxY = t.maxY;
      draw();
      animId.current = 0;
      return;
    }

    c.minX = lerpVal(c.minX, t.minX, ANIM_SPEED);
    c.maxX = lerpVal(c.maxX, t.maxX, ANIM_SPEED);
    c.minY = lerpVal(c.minY, t.minY, ANIM_SPEED);
    c.maxY = lerpVal(c.maxY, t.maxY, ANIM_SPEED);

    draw();

    const diff =
      Math.abs(c.minX - t.minX) + Math.abs(c.maxX - t.maxX) +
      Math.abs(c.minY - t.minY) + Math.abs(c.maxY - t.maxY);

    if (diff > 0.0005) {
      animId.current = requestAnimationFrame(animate);
    } else {
      c.minX = t.minX; c.maxX = t.maxX;
      c.minY = t.minY; c.maxY = t.maxY;
      draw();
      animId.current = 0;
    }
  }, [draw]);

  const startAnim = useCallback(() => {
    if (!animId.current) {
      animId.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  /* ── recalculate viewport target when draft changes ── */
  useEffect(() => {
    if (!open) return;
    const next = computeTarget(draft.p1.y, draft.p2.y);
    targetView.current = next;
    startAnim();
  }, [open, draft, startAnim]);

  /* ── resize ── */
  useEffect(() => {
    if (!open) return;
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, draw]);

  /* ── cleanup animation on unmount / close ── */
  useEffect(() => {
    return () => {
      if (animId.current) cancelAnimationFrame(animId.current);
    };
  }, []);

  /* ── modal open / close ── */
  const openModal = () => {
    const d = { ...curve, p1: { ...curve.p1 }, p2: { ...curve.p2 } };
    setDraft(d);
    const initView = computeTarget(d.p1.y, d.p2.y);
    currentView.current = { ...initView };
    targetView.current = { ...initView };
    setOpen(true);
  };

  const confirmModal = () => {
    onChange(draft);
    setOpen(false);
  };

  const cancelModal = () => {
    setOpen(false);
  };

  /* ── pointer interaction ── */
  const updatePoint = (e: React.PointerEvent<HTMLCanvasElement>, handle: 'p1' | 'p2') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const pt = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, size, size);
    setDraft((prev) => (handle === 'p1' ? { ...prev, p1: pt } : { ...prev, p2: pt }));
  };

  const selectHandle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cp1 = toCanvas(draft.p1, size, size);
    const cp2 = toCanvas(draft.p2, size, size);
    const d1 = Math.hypot(mx - cp1.x, my - cp1.y);
    const d2 = Math.hypot(mx - cp2.x, my - cp2.y);
    const handle = d1 <= d2 ? 'p1' : 'p2';
    dragRef.current = handle;
    isDragging.current = true;
    setActive(handle);
    canvas.setPointerCapture(e.pointerId);
    updatePoint(e, handle);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    updatePoint(e, dragRef.current);
  };

  const stopDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    isDragging.current = false;
    setActive(null);
    // Start smooth animation back to optimal viewport
    startAnim();
  };



  return (
    <>
      <button type="button" className="curve-trigger" onClick={openModal}>
        <span className="curve-trigger-label">{label}</span>
        <span className="curve-trigger-icon">▸</span>
      </button>

      {open && (
        <div className="curve-modal-overlay" onPointerDown={cancelModal}>
          <div className="curve-modal" onPointerDown={(e) => e.stopPropagation()}>
            <div className="curve-modal-header">
              <span>{label}</span>
            </div>
            <canvas
              ref={canvasRef}
              className="curve-canvas"
              onPointerDown={selectHandle}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            />
            <div className="curve-modal-footer">
              <button type="button" className="curve-btn cancel" onClick={cancelModal}>
                キャンセル
              </button>
              <button type="button" className="curve-btn confirm" onClick={confirmModal}>
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
