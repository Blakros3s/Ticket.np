'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Link from 'next/link';
import {
  AlignCenter,
  AlignLeft,
  ArrowRight,
  Bold,
  Circle,
  Cloud,
  Cylinder,
  Diamond,
  Frame,
  Hexagon,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Square,
  StickyNote,
  Ticket,
  Trash2,
  Triangle,
  Type,
} from 'lucide-react';

import {
  type AlignStyle,
  type ArrowElement,
  type ArrowEnd,
  type DashStyle,
  type DrawElement,
  type FrameElement,
  type GeoElement,
  type GeoFillMode,
  type GeoKind,
  type ImageElement,
  type NoteColorId,
  type NoteElement,
  type TextElement,
  type TextSize,
  type WhiteboardCamera,
  type WhiteboardCanvasData,
  type WhiteboardCanvasDocument,
  type WhiteboardElement,
  GEO_COLORS,
  GEO_SHAPES,
  NOTE_COLORS,
  NOTE_TEXT_COLOR,
  PEN_COLORS,
  PEN_WIDTH,
  TEXT_SIZE_PX,
  defaultPenColorId,
  emptyCanvas,
  geoFillForColor,
  getElementBounds,
  hitTestElement,
  newElementId,
  nextZIndex,
  normalizeCanvas,
  penColorHex,
  readThemeStrokeDefault,
  resolveStrokeForTheme,
  sortByZIndex,
} from '@/lib/whiteboard-canvas';
import { useTheme } from '@/lib/theme-context';

// Re-export for consumers
export type { WhiteboardCanvasData as TldrawSnapshot };

type LinkedTicket = { id: number; ticketId: string };

export type WhiteboardSelection = {
  ids: string[];
  type: string | 'mixed';
  isMulti: boolean;
  props: Record<string, unknown>;
  ticket: LinkedTicket | null;
} | null;

type ToolId = 'select' | 'note' | 'geo' | 'arrow' | 'draw' | 'text' | 'frame' | 'image';

type ToolStyles = {
  geoType: GeoKind;
  geoFillMode: GeoFillMode;
  noteColor: NoteColorId;
  noteAlign: AlignStyle;
  penColor: string;
  penSize: 's' | 'l';
  textSize: TextSize;
  textBold: boolean;
  geoColor: string;
  geoDash: DashStyle;
  arrowDash: DashStyle;
  arrowStart: ArrowEnd;
  arrowEnd: ArrowEnd;
};

const DEFAULT_STYLES: ToolStyles = {
  geoType: 'rectangle',
  geoFillMode: 'filled',
  noteColor: 'yellow',
  noteAlign: 'start',
  penColor: 'black',
  penSize: 's',
  textSize: 'm',
  textBold: false,
  geoColor: '#1e293b',
  geoDash: 'solid',
  arrowDash: 'solid',
  arrowStart: 'none',
  arrowEnd: 'arrow',
};

const REVERT_TOOLS = new Set<ToolId>(['note', 'text', 'image']);

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

const TRANSFORMABLE_TYPES = new Set(['geo', 'note', 'text', 'image', 'frame', 'arrow']);

function elementToSelection(elements: WhiteboardElement[], ids: string[]): WhiteboardSelection {
  if (ids.length === 0) return null;
  const selected = elements.filter((e) => ids.includes(e.id));
  if (selected.length === 0) return null;
  const types = new Set(selected.map((e) => e.type));
  const primary = selected[0];
  let ticket: LinkedTicket | null = null;
  if (selected.length === 1 && primary.type === 'note') {
    const note = primary as NoteElement;
    if (note.ticketId && note.ticketTicketId) {
      ticket = { id: note.ticketId, ticketId: note.ticketTicketId };
    }
  }
  const props: Record<string, unknown> = {};
  if (types.size === 1) {
    Object.assign(props, primary);
    if (primary.type === 'note') props.text = (primary as NoteElement).text;
  }
  return {
    ids,
    type: types.size === 1 ? primary.type : 'mixed',
    isMulti: ids.length > 1,
    props,
    ticket,
  };
}

function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: WhiteboardCamera,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - camera.x) / camera.zoom,
    y: (clientY - rect.top - camera.y) / camera.zoom,
  };
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function ColorSwatch({
  hex,
  label,
  active,
  onClick,
}: {
  hex: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const needsBorder = hex.toLowerCase() === '#e2e8f0' || hex.toLowerCase() === '#f8fafc';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ background: hex }}
      className={[
        'w-5 h-5 rounded-full border transition-all',
        needsBorder ? 'border-[var(--border-default)]' : 'border-[var(--border-subtle)]',
        active
          ? 'ring-2 ring-offset-1 ring-[var(--accent)] border-transparent'
          : 'hover:scale-110',
      ].join(' ')}
    />
  );
}

function PropSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function SegmentRow({
  options,
  active,
  onPick,
}: {
  options: { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-[var(--border-subtle)] text-xs">
      {options.map((opt, idx) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onPick(opt.id)}
          className={[
            'flex-1 py-1 text-center transition-colors',
            idx > 0 ? 'border-l border-[var(--border-subtle)]' : '',
            active === opt.id
              ? 'bg-[var(--accent)] text-white font-medium'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const railBtn = (active: boolean) =>
  [
    'w-7 h-7 flex items-center justify-center rounded transition-colors',
    active
      ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
  ].join(' ');

const panelCls =
  'w-[210px] border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 shrink-0 overflow-y-auto flex flex-col';

function geoShapePoints(geo: GeoKind, w: number, h: number): string | null {
  const skew = w * 0.22;
  switch (geo) {
    case 'diamond':
      return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    case 'triangle':
      return `${w / 2},0 ${w},${h} 0,${h}`;
    case 'parallelogram':
      return `${skew},0 ${w},0 ${w - skew},${h} 0,${h}`;
    case 'hexagon': {
      const inset = w * 0.22;
      return `${inset},0 ${w - inset},0 ${w},${h / 2} ${w - inset},${h} ${inset},${h} 0,${h / 2}`;
    }
    default:
      return null;
  }
}

function GeoShapeBody({
  geo,
  width,
  height,
  common,
}: {
  geo: GeoKind;
  width: number;
  height: number;
  common: { fill: string; stroke: string; strokeWidth: number; strokeDasharray?: string };
}) {
  if (geo === 'rectangle') {
    return <rect width={width} height={height} rx={4} {...common} />;
  }
  if (geo === 'ellipse') {
    return <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...common} />;
  }
  if (geo === 'cylinder') {
    const ry = Math.min(height * 0.12, 14);
    return (
      <>
        <rect x={0} y={ry} width={width} height={Math.max(height - ry * 2, 1)} {...common} />
        <ellipse cx={width / 2} cy={ry} rx={width / 2} ry={ry} {...common} />
        <ellipse cx={width / 2} cy={height - ry} rx={width / 2} ry={ry} {...common} />
      </>
    );
  }
  if (geo === 'cloud') {
    const d = `M${width * 0.2},${height * 0.65} C${width * 0.05},${height * 0.45} ${width * 0.2},${height * 0.2} ${width * 0.4},${height * 0.28} C${width * 0.48},${height * 0.08} ${width * 0.72},${height * 0.08} ${width * 0.8},${height * 0.28} C${width * 0.95},${height * 0.3} ${width},${height * 0.5} ${width * 0.88},${height * 0.62} C${width * 0.95},${height * 0.78} ${width * 0.78},${height * 0.92} ${width * 0.58},${height * 0.88} C${width * 0.45},${height * 0.98} ${width * 0.25},${height * 0.95} ${width * 0.2},${height * 0.65} Z`;
    return <path d={d} {...common} />;
  }
  if (geo === 'document') {
    const wave = height * 0.12;
    const d = `M0,0 H${width} V${height - wave} Q${width * 0.75},${height + wave * 0.35} ${width * 0.5},${height - wave} Q${width * 0.25},${height - wave * 2.2} 0,${height - wave} Z`;
    return <path d={d} {...common} />;
  }
  const points = geoShapePoints(geo, width, height);
  if (points) return <polygon points={points} {...common} />;
  return <rect width={width} height={height} rx={4} {...common} />;
}

// ---------------------------------------------------------------------------
// Element renderers
// ---------------------------------------------------------------------------

function NoteView({
  el,
  selected,
  readOnly,
  onTextChange,
  onFocus,
}: {
  el: NoteElement;
  selected: boolean;
  readOnly: boolean;
  onTextChange: (text: string) => void;
  onFocus: () => void;
}) {
  const bg = NOTE_COLORS.find((c) => c.id === el.color)?.hex ?? '#FFF3C4';
  return (
    <div
      className={[
        'absolute rounded-md shadow-sm flex flex-col overflow-hidden',
        selected ? 'ring-2 ring-[var(--accent)] ring-offset-1' : '',
      ].join(' ')}
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        background: bg,
        zIndex: el.zIndex,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      {el.ticketTicketId && (
        <Link
          href={`/protected/dashboard/tickets/${el.ticketId}`}
          className="absolute top-1 right-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/80 text-[var(--accent)] hover:underline z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {el.ticketTicketId}
        </Link>
      )}
      <textarea
        className="flex-1 w-full h-full resize-none border-none bg-transparent p-3 text-sm outline-none"
        style={{ textAlign: el.align === 'middle' ? 'center' : 'left', color: NOTE_TEXT_COLOR }}
        value={el.text}
        readOnly={readOnly}
        placeholder="Type a note…"
        onChange={(e) => onTextChange(e.target.value)}
        onFocus={onFocus}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function GeoView({ el, selected }: { el: GeoElement; selected: boolean }) {
  const { theme } = useTheme();
  const strokeColor = resolveStrokeForTheme(el.color, theme);
  const stroke = el.dash === 'dashed' ? '8 4' : undefined;
  const common = {
    fill: el.fill,
    stroke: strokeColor,
    strokeWidth: 2.5,
    strokeDasharray: stroke,
  };
  const rotation = el.rotation ?? 0;
  return (
    <svg
      className="absolute overflow-visible pointer-events-none"
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      <GeoShapeBody geo={el.geo} width={el.width} height={el.height} common={common} />
      {selected && (
        <rect width={el.width} height={el.height} fill="none" stroke="var(--wb-selection)" strokeWidth={2} strokeDasharray="4 2" />
      )}
    </svg>
  );
}

function ArrowView({ el, selected }: { el: ArrowElement; selected: boolean }) {
  const { theme } = useTheme();
  const strokeColor = resolveStrokeForTheme(el.color, theme);
  const b = getElementBounds(el);
  const x1 = el.x - b.x;
  const y1 = el.y - b.y;
  const x2 = el.x2 - b.x;
  const y2 = el.y2 - b.y;
  const stroke = el.dash === 'dashed' ? '8 4' : undefined;
  const endId = `arrowhead-end-${el.id}`;
  const startId = `arrowhead-start-${el.id}`;
  const markerEnd = el.end === 'arrow' ? `url(#${endId})` : undefined;
  const markerStart = el.start === 'arrow' ? `url(#${startId})` : undefined;
  return (
    <svg
      className="absolute overflow-visible pointer-events-none"
      style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: el.zIndex }}
    >
      <defs>
        <marker id={endId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill={strokeColor} />
        </marker>
        <marker id={startId} markerWidth="10" markerHeight="10" refX="2" refY="3" orient="auto">
          <polygon points="10 0, 0 3, 10 6" fill={strokeColor} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={stroke}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {selected && (
        <>
          <circle cx={x1} cy={y1} r={5} fill="var(--wb-selection)" />
          <circle cx={x2} cy={y2} r={5} fill="var(--wb-selection)" />
        </>
      )}
    </svg>
  );
}

function DrawView({ el }: { el: DrawElement }) {
  if (el.points.length < 2) return null;
  const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const color = penColorHex(el.color);
  return (
    <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ zIndex: el.zIndex }}>
      <path d={d} fill="none" stroke={color} strokeWidth={PEN_WIDTH[el.size]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FrameView({ el, selected }: { el: FrameElement; selected: boolean }) {
  return (
    <div
      className={[
        'absolute rounded-lg border-2 border-dashed',
        selected ? 'border-[var(--accent)]' : 'border-[var(--border-default)]',
      ].join(' ')}
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        background: 'var(--wb-frame-fill)',
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      <span className="absolute -top-5 left-0 text-xs font-medium text-[var(--text-muted)] px-1">
        {el.label || 'Frame'}
      </span>
    </div>
  );
}

function TextView({
  el,
  selected,
  readOnly,
  onTextChange,
  onFocus,
}: {
  el: TextElement;
  selected: boolean;
  readOnly: boolean;
  onTextChange: (text: string) => void;
  onFocus: () => void;
}) {
  return (
    <textarea
      className={[
        'absolute bg-transparent border-none outline-none resize-none overflow-hidden text-[var(--text-primary)] p-0',
        selected ? 'ring-1 ring-[var(--accent)] ring-offset-2 rounded-sm' : '',
        el.bold ? 'font-bold' : '',
      ].join(' ')}
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        minHeight: el.height,
        fontSize: TEXT_SIZE_PX[el.size],
        zIndex: el.zIndex,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
      value={el.text}
      readOnly={readOnly}
      placeholder="Text"
      onChange={(e) => onTextChange(e.target.value)}
      onFocus={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

function ImageView({ el, selected }: { el: ImageElement; selected: boolean }) {
  return (
    <img
      src={el.src}
      alt=""
      className={[
        'absolute object-contain',
        selected ? 'ring-2 ring-[var(--accent)] ring-offset-1' : '',
      ].join(' ')}
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
      draggable={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Tool options + transform overlays
// ---------------------------------------------------------------------------

function ShapeIcon({ geo, size = 14 }: { geo: GeoKind; size?: number }) {
  switch (geo) {
    case 'rectangle':
      return <Square size={size} />;
    case 'ellipse':
      return <Circle size={size} />;
    case 'diamond':
      return <Diamond size={size} />;
    case 'triangle':
      return <Triangle size={size} />;
    case 'parallelogram':
      return <Square size={size} style={{ transform: 'skewX(-12deg)' }} />;
    case 'hexagon':
      return <Hexagon size={size} />;
    case 'cylinder':
      return <Cylinder size={size} />;
    case 'cloud':
      return <Cloud size={size} />;
    case 'document':
      return <StickyNote size={size} />;
    default:
      return <Square size={size} />;
  }
}

function GeoToolPanel({
  styles,
  onStyleChange,
  title,
}: {
  styles: ToolStyles;
  onStyleChange: (patch: Partial<ToolStyles>) => void;
  title?: string;
}) {
  return (
    <div className={panelCls}>
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">{title ?? 'Shapes'}</p>
      <PropSection label="Shape">
        <div className="grid grid-cols-3 gap-1">
          {GEO_SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              title={shape.label}
              onClick={() => onStyleChange({ geoType: shape.id })}
              className={[
                'flex items-center justify-center h-8 rounded border transition-colors',
                styles.geoType === shape.id
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]',
              ].join(' ')}
            >
              <ShapeIcon geo={shape.id} size={13} />
            </button>
          ))}
        </div>
      </PropSection>
      <PropSection label="Fill">
        <SegmentRow
          options={[{ id: 'filled', label: 'Filled' }, { id: 'hollow', label: 'Hollow' }]}
          active={styles.geoFillMode}
          onPick={(id) => onStyleChange({ geoFillMode: id as GeoFillMode })}
        />
      </PropSection>
      <PropSection label="Color">
        <div className="flex flex-wrap gap-2">
          {GEO_COLORS.map((c) => (
            <ColorSwatch
              key={c.id}
              hex={c.hex}
              label={c.label}
              active={styles.geoColor === c.hex}
              onClick={() => onStyleChange({ geoColor: c.hex })}
            />
          ))}
        </div>
      </PropSection>
      <PropSection label="Border">
        <SegmentRow
          options={[{ id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }]}
          active={styles.geoDash}
          onPick={(id) => onStyleChange({ geoDash: id as DashStyle })}
        />
      </PropSection>
    </div>
  );
}

function ArrowToolPanel({
  styles,
  onStyleChange,
}: {
  styles: ToolStyles;
  onStyleChange: (patch: Partial<ToolStyles>) => void;
}) {
  return (
    <div className={panelCls}>
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">Connector</p>
      <PropSection label="Color">
        <div className="flex flex-wrap gap-2">
          {GEO_COLORS.map((c) => (
            <ColorSwatch
              key={c.id}
              hex={c.hex}
              label={c.label}
              active={styles.geoColor === c.hex}
              onClick={() => onStyleChange({ geoColor: c.hex })}
            />
          ))}
        </div>
      </PropSection>
      <PropSection label="Line">
        <SegmentRow
          options={[{ id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }]}
          active={styles.arrowDash}
          onPick={(id) => onStyleChange({ arrowDash: id as DashStyle })}
        />
      </PropSection>
      <PropSection label="Arrowhead">
        <div className="flex flex-col gap-1">
          {([
            { label: 'None', start: 'none' as const, end: 'none' as const },
            { label: 'End →', start: 'none' as const, end: 'arrow' as const },
            { label: '← Both →', start: 'arrow' as const, end: 'arrow' as const },
          ]).map(({ label, start, end }) => (
            <button
              key={label}
              type="button"
              onClick={() => onStyleChange({ arrowStart: start, arrowEnd: end })}
              className={[
                'text-xs text-left px-2 py-1.5 rounded border',
                styles.arrowStart === start && styles.arrowEnd === end
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </PropSection>
    </div>
  );
}

function handleCls() {
  return 'absolute w-2.5 h-2.5 rounded-sm bg-[var(--wb-handle-bg)] border-2 border-[var(--wb-handle-border)] shadow-sm z-[10000] pointer-events-auto cursor-grab active:cursor-grabbing';
}

function SelectionTransformOverlay({
  element,
  onResizeStart,
  onRotateStart,
  onArrowEndStart,
}: {
  element: WhiteboardElement;
  onResizeStart: (corner: ResizeCorner, e: ReactPointerEvent) => void;
  onRotateStart: (e: ReactPointerEvent) => void;
  onArrowEndStart: (end: 'start' | 'end', e: ReactPointerEvent) => void;
}) {
  if (element.type === 'arrow') {
    const arrow = element as ArrowElement;
    return (
      <>
        <button
          type="button"
          className={handleCls()}
          style={{ left: arrow.x - 5, top: arrow.y - 5 }}
          onPointerDown={(e) => { e.stopPropagation(); onArrowEndStart('start', e); }}
        />
        <button
          type="button"
          className={handleCls()}
          style={{ left: arrow.x2 - 5, top: arrow.y2 - 5 }}
          onPointerDown={(e) => { e.stopPropagation(); onArrowEndStart('end', e); }}
        />
      </>
    );
  }

  if (!TRANSFORMABLE_TYPES.has(element.type) || element.type === 'draw') return null;

  const b = getElementBounds(element);
  const rotation = element.rotation ?? 0;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rotY = b.y - 28;

  const corners: { corner: ResizeCorner; left: number; top: number }[] = [
    { corner: 'nw', left: b.x, top: b.y },
    { corner: 'ne', left: b.x + b.w, top: b.y },
    { corner: 'sw', left: b.x, top: b.y + b.h },
    { corner: 'se', left: b.x + b.w, top: b.y + b.h },
  ];

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: 10000, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: 'center' }}
    >
      <div className="absolute inset-0 border-2 border-[var(--wb-selection)] border-dashed pointer-events-none" />
      {corners.map(({ corner, left, top }) => (
        <button
          key={corner}
          type="button"
          className={`${handleCls()} pointer-events-auto`}
          style={{ left: left - b.x - 5, top: top - b.y - 5 }}
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(corner, e); }}
        />
      ))}
      {element.type === 'geo' || element.type === 'note' || element.type === 'image' || element.type === 'frame' ? (
        <button
          type="button"
          className={`${handleCls()} pointer-events-auto`}
          style={{ left: cx - b.x - 5, top: rotY - b.y - 5 }}
          onPointerDown={(e) => { e.stopPropagation(); onRotateStart(e); }}
          title="Rotate"
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context panel
// ---------------------------------------------------------------------------

function ContextPanel({
  selection,
  elements,
  projectId,
  converting,
  convertError,
  onConvert,
  onUpdate,
  onDelete,
  onDeleteFrameOnly,
  onDeleteFrameWithContents,
  onGroup,
}: {
  selection: WhiteboardSelection;
  elements: WhiteboardElement[];
  projectId: number | null;
  converting: boolean;
  convertError: string | null;
  onConvert: () => void;
  onUpdate: (id: string, patch: Partial<WhiteboardElement>) => void;
  onDelete: () => void;
  onDeleteFrameOnly: () => void;
  onDeleteFrameWithContents: () => void;
  onGroup: () => void;
}) {
  const [frameDeleteOpen, setFrameDeleteOpen] = useState(false);
  if (!selection) return null;

  const { ids, type, isMulti, props, ticket } = selection;
  const primaryId = ids[0];

  const update = (patch: Record<string, unknown>) => {
    if (primaryId) onUpdate(primaryId, patch as Partial<WhiteboardElement>);
  };

  if (isMulti || type === 'mixed') {
    return (
      <div className={panelCls}>
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-4">{ids.length} items selected</p>
        <button
          type="button"
          onClick={onGroup}
          className="text-xs text-left px-2 py-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-default)] text-[var(--text-secondary)] mb-2"
        >
          Group selection
        </button>
        <div className="mt-auto pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            <Trash2 size={13} /> Delete selected
          </button>
        </div>
      </div>
    );
  }

  const color = String(props.color ?? 'yellow');
  const dash = String(props.dash ?? 'solid');
  const align = String(props.align ?? 'start');
  const size = String(props.size ?? 'm');
  const bold = Boolean(props.bold);
  const arrowStart = String(props.start ?? 'none');
  const arrowEnd = String(props.end ?? 'arrow');

  return (
    <div className={panelCls}>
      <p className="text-xs font-medium text-[var(--text-secondary)] capitalize mb-4">
        {type === 'geo' ? 'Shape' : type}
      </p>

      {type === 'note' && (
        <>
          <PropSection label="Color">
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((c) => (
                <ColorSwatch
                  key={c.id}
                  hex={c.hex}
                  label={c.label}
                  active={color === c.id}
                  onClick={() => update({ color: c.id })}
                />
              ))}
            </div>
          </PropSection>
          <PropSection label="Text align">
            <div className="flex gap-1.5">
              {(['start', 'middle'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ align: a })}
                  className={[
                    'flex items-center justify-center w-8 h-8 rounded border',
                    align === a
                      ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  {a === 'start' ? <AlignLeft size={13} /> : <AlignCenter size={13} />}
                </button>
              ))}
            </div>
          </PropSection>
          {ticket ? (
            <PropSection label="Linked ticket">
              <Link href={`/protected/dashboard/tickets/${ticket.id}`} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                <Ticket size={12} /> {ticket.ticketId}
              </Link>
            </PropSection>
          ) : (
            <PropSection label="Actions">
              <button
                type="button"
                onClick={onConvert}
                disabled={converting || !projectId}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                <Ticket size={12} /> {converting ? 'Converting…' : 'Convert to ticket'}
              </button>
              {!projectId && <p className="text-xs text-[var(--text-muted)] mt-1">Assign a project first</p>}
            </PropSection>
          )}
        </>
      )}

      {type === 'geo' && (
        <>
          <PropSection label="Shape">
            <div className="grid grid-cols-3 gap-1">
              {GEO_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  title={shape.label}
                  onClick={() => update({ geo: shape.id })}
                  className={[
                    'flex items-center justify-center h-8 rounded border transition-colors',
                    String(props.geo) === shape.id
                      ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]',
                  ].join(' ')}
                >
                  <ShapeIcon geo={shape.id} size={13} />
                </button>
              ))}
            </div>
          </PropSection>
          <PropSection label="Fill">
            <SegmentRow
              options={[{ id: 'filled', label: 'Filled' }, { id: 'hollow', label: 'Hollow' }]}
              active={String(props.fill) === 'transparent' || props.fill === 'none' ? 'hollow' : 'filled'}
              onPick={(id) => {
                const stroke = String(props.color ?? '#3b82f6');
                update({
                  fill: id === 'hollow' ? 'transparent' : geoFillForColor(stroke, 'filled'),
                });
              }}
            />
          </PropSection>
          <PropSection label="Stroke color">
            <div className="flex flex-wrap gap-2">
              {GEO_COLORS.map((c) => (
                <ColorSwatch
                  key={c.id}
                  hex={c.hex}
                  label={c.label}
                  active={String(props.color) === c.hex}
                  onClick={() => {
                    const hollow = props.fill === 'transparent' || props.fill === 'none';
                    update({
                      color: c.hex,
                      fill: hollow ? 'transparent' : geoFillForColor(c.hex, 'filled'),
                    });
                  }}
                />
              ))}
            </div>
          </PropSection>
          <PropSection label="Border">
            <SegmentRow
              options={[{ id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }]}
              active={dash}
              onPick={(id) => update({ dash: id })}
            />
          </PropSection>
          <PropSection label="Rotation">
            <input
              type="range"
              min={0}
              max={360}
              value={Number(props.rotation ?? 0)}
              onChange={(e) => update({ rotation: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{Math.round(Number(props.rotation ?? 0))}°</p>
          </PropSection>
        </>
      )}

      {type === 'arrow' && (
        <>
          <PropSection label="Color">
            <div className="flex flex-wrap gap-2">
              {GEO_COLORS.map((c) => (
                <ColorSwatch
                  key={c.id}
                  hex={c.hex}
                  label={c.label}
                  active={String(props.color) === c.hex}
                  onClick={() => update({ color: c.hex })}
                />
              ))}
            </div>
          </PropSection>
          <PropSection label="Line">
            <SegmentRow
              options={[{ id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }]}
              active={dash}
              onPick={(id) => update({ dash: id })}
            />
          </PropSection>
          <PropSection label="Arrowhead">
            <div className="flex flex-col gap-1">
              {([
                { label: 'None', start: 'none', end: 'none' },
                { label: 'End →', start: 'none', end: 'arrow' },
                { label: '← Both →', start: 'arrow', end: 'arrow' },
              ] as const).map(({ label, start, end }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => update({ start, end })}
                  className={[
                    'text-xs text-left px-2 py-1.5 rounded border',
                    arrowStart === start && arrowEnd === end
                      ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </PropSection>
        </>
      )}

      {type === 'text' && (
        <>
          <PropSection label="Size">
            <SegmentRow
              options={[{ id: 's', label: 'S' }, { id: 'm', label: 'M' }, { id: 'l', label: 'L' }]}
              active={size}
              onPick={(id) => update({ size: id })}
            />
          </PropSection>
          <PropSection label="Style">
            <button
              type="button"
              onClick={() => update({ bold: !bold })}
              className={[
                'flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border',
                bold
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
              ].join(' ')}
            >
              <Bold size={13} /> Bold
            </button>
          </PropSection>
        </>
      )}

      {type === 'frame' && (
        <p className="text-xs text-[var(--text-muted)] mb-2">Double-click the label on canvas to rename.</p>
      )}

      {convertError && <p className="text-xs text-[var(--danger)]">{convertError}</p>}

      <div className="mt-auto pt-4 border-t border-[var(--border-subtle)]">
        {type === 'frame' && frameDeleteOpen ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">Delete frame how?</p>
            <button type="button" onClick={() => { onDeleteFrameWithContents(); setFrameDeleteOpen(false); }} className="w-full text-xs text-left px-2 py-1.5 rounded border border-[var(--danger-muted)] text-[var(--danger)]">
              Frame + contents
            </button>
            <button type="button" onClick={() => { onDeleteFrameOnly(); setFrameDeleteOpen(false); }} className="w-full text-xs text-left px-2 py-1.5 rounded border border-[var(--border-subtle)]">
              Frame only
            </button>
            <button type="button" onClick={() => setFrameDeleteOpen(false)} className="text-xs text-[var(--text-muted)]">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (type === 'frame' ? setFrameDeleteOpen(true) : onDelete())}
            className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export interface WorkspaceWhiteboardEditorProps {
  snapshot: WhiteboardCanvasData;
  revision: number;
  onDirty?: () => void;
  getSnapshotRef?: React.MutableRefObject<(() => WhiteboardCanvasData) | null>;
  selection: WhiteboardSelection;
  onSelectionChange: (sel: WhiteboardSelection) => void;
  projectId: number | null;
  linkedTicket: LinkedTicket | null;
  converting: boolean;
  convertError: string | null;
  onConvert: () => void;
  readOnly?: boolean;
}

export function WorkspaceWhiteboardEditor({
  snapshot,
  revision,
  onDirty,
  getSnapshotRef,
  selection,
  onSelectionChange,
  projectId,
  converting,
  convertError,
  onConvert,
  readOnly = false,
}: WorkspaceWhiteboardEditorProps) {
  const { theme } = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const loadedRevisionRef = useRef(-1);
  const suppressDirtyRef = useRef(true);
  const focusNoteIdRef = useRef<string | null>(null);

  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [camera, setCamera] = useState<WhiteboardCamera>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<ToolId>('select');
  const [styles, setStyles] = useState<ToolStyles>(DEFAULT_STYLES);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [penFlyout, setPenFlyout] = useState(false);
  const [spacePan, setSpacePan] = useState(false);

  useEffect(() => {
    setStyles((s) => ({
      ...s,
      geoColor: readThemeStrokeDefault(),
      penColor: defaultPenColorId(theme),
    }));
  }, [theme]);

  useEffect(() => {
    if (tool !== 'arrow' && tool !== 'geo') return;
    setStyles((s) => {
      const fixed = resolveStrokeForTheme(s.geoColor, theme);
      if (fixed === s.geoColor) return s;
      return { ...s, geoColor: readThemeStrokeDefault() };
    });
  }, [tool, theme]);

  const [liveDrawPoints, setLiveDrawPoints] = useState<{ x: number; y: number }[] | null>(null);

  const dragRef = useRef<{
    kind: 'pan' | 'move' | 'create-geo' | 'create-frame' | 'create-arrow' | 'draw' | 'resize' | 'rotate' | 'arrow-end';
    startX: number;
    startY: number;
    worldStart?: { x: number; y: number };
    elementIds?: string[];
    originPositions?: Map<string, { x: number; y: number; x2?: number; y2?: number }>;
    drawPoints?: { x: number; y: number }[];
    previewId?: string;
    corner?: ResizeCorner;
    originBounds?: { x: number; y: number; w: number; h: number };
    center?: { x: number; y: number };
    startAngle?: number;
    originRotation?: number;
    arrowEnd?: 'start' | 'end';
  } | null>(null);

  const selectedIdsFromParent = selection?.ids ?? [];
  const effectiveSelection = selectedIds.length > 0 ? selectedIds : selectedIdsFromParent;

  const syncSelection = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  useEffect(() => {
    onSelectionChange(
      selectedIds.length === 0 ? null : elementToSelection(elements, selectedIds),
    );
  }, [selectedIds, elements, onSelectionChange]);

  const markDirty = useCallback(() => {
    if (!suppressDirtyRef.current) onDirty?.();
  }, [onDirty]);

  const updateElements = useCallback(
    (updater: (prev: WhiteboardElement[]) => WhiteboardElement[]) => {
      setElements((prev) => {
        const next = updater(prev);
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const getDocument = useCallback((): WhiteboardCanvasDocument => {
    return { version: 1, camera, elements };
  }, [camera, elements]);

  useEffect(() => {
    if (getSnapshotRef) {
      getSnapshotRef.current = () => getDocument();
    }
  }, [getSnapshotRef, getDocument]);

  useEffect(() => {
    if (loadedRevisionRef.current === revision) return;
    loadedRevisionRef.current = revision;
    const doc = normalizeCanvas(snapshot);
    setElements(doc.elements);
    setCamera(doc.camera);
    suppressDirtyRef.current = true;
    const t = setTimeout(() => { suppressDirtyRef.current = false; }, 400);
    return () => clearTimeout(t);
  }, [revision, snapshot]);

  const sorted = useMemo(() => sortByZIndex(elements), [elements]);

  const updateElement = useCallback(
    (id: string, patch: Partial<WhiteboardElement>) => {
      updateElements((prev) =>
        prev.map((el) => (el.id === id ? ({ ...el, ...patch } as WhiteboardElement) : el)),
      );
    },
    [updateElements],
  );

  const deleteSelected = useCallback(() => {
    if (effectiveSelection.length === 0) return;
    updateElements((prev) => prev.filter((el) => !effectiveSelection.includes(el.id)));
    syncSelection([]);
  }, [effectiveSelection, updateElements, syncSelection]);

  const deleteFrameOnly = useCallback(() => {
    const id = effectiveSelection[0];
    if (!id) return;
    updateElements((prev) => prev.filter((el) => el.id !== id));
    syncSelection([]);
  }, [effectiveSelection, updateElements, syncSelection]);

  const deleteFrameWithContents = useCallback(() => {
    const id = effectiveSelection[0];
    const frame = elements.find((e) => e.id === id);
    if (!frame || frame.type !== 'frame') return;
    const b = getElementBounds(frame);
    updateElements((prev) =>
      prev.filter((el) => {
        if (el.id === id) return false;
        const eb = getElementBounds(el);
        const cx = eb.x + eb.w / 2;
        const cy = eb.y + eb.h / 2;
        const inside = cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
        return !inside;
      }),
    );
    syncSelection([]);
  }, [effectiveSelection, elements, updateElements, syncSelection]);

  const selectGeoTool = useCallback((geoType: GeoKind) => {
    setStyles((s) => ({
      ...s,
      geoType,
      geoColor: resolveStrokeForTheme(s.geoColor, theme) === s.geoColor
        ? s.geoColor
        : readThemeStrokeDefault(),
    }));
    setTool('geo');
    setPenFlyout(false);
  }, [theme]);

  const activateArrowTool = useCallback(() => {
    setStyles((s) => ({
      ...s,
      geoColor: resolveStrokeForTheme(s.geoColor, theme) === s.geoColor
        ? s.geoColor
        : readThemeStrokeDefault(),
    }));
    setTool('arrow');
    setPenFlyout(false);
  }, [theme]);

  const patchStyles = useCallback((patch: Partial<ToolStyles>) => {
    setStyles((s) => ({ ...s, ...patch }));
  }, []);

  const startResize = useCallback((corner: ResizeCorner, e: ReactPointerEvent) => {
    const id = effectiveSelection[0];
    const el = elements.find((x) => x.id === id);
    if (!el || el.type === 'arrow' || el.type === 'draw') return;
    dragRef.current = {
      kind: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      previewId: id,
      corner,
      originBounds: { x: el.x, y: el.y, w: el.width, h: el.height },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [effectiveSelection, elements, camera]);

  const startRotate = useCallback((e: ReactPointerEvent) => {
    const id = effectiveSelection[0];
    const el = elements.find((x) => x.id === id);
    if (!el || el.type === 'arrow' || el.type === 'draw') return;
    const b = getElementBounds(el);
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, camera);
    const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    dragRef.current = {
      kind: 'rotate',
      startX: e.clientX,
      startY: e.clientY,
      previewId: id,
      center,
      startAngle: Math.atan2(world.y - center.y, world.x - center.x),
      originRotation: el.rotation ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [effectiveSelection, elements, camera]);

  const startArrowEnd = useCallback((end: 'start' | 'end', e: ReactPointerEvent) => {
    const id = effectiveSelection[0];
    if (!id) return;
    dragRef.current = {
      kind: 'arrow-end',
      startX: e.clientX,
      startY: e.clientY,
      previewId: id,
      arrowEnd: end,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [effectiveSelection]);

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (readOnly) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, camera);

    if (spacePan || e.button === 1) {
      dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY };
      return;
    }

    if (tool === 'select') {
      const hit = [...sorted].reverse().find((el) => hitTestElement(el, world.x, world.y));
      if (hit) {
        const ids = e.shiftKey
          ? effectiveSelection.includes(hit.id)
            ? effectiveSelection.filter((id) => id !== hit.id)
            : [...effectiveSelection, hit.id]
          : [hit.id];
        syncSelection(ids);
        const origins = new Map<string, { x: number; y: number; x2?: number; y2?: number }>();
        for (const id of ids) {
          const el = elements.find((x) => x.id === id);
          if (!el) continue;
          if (el.type === 'arrow') origins.set(id, { x: el.x, y: el.y, x2: el.x2, y2: el.y2 });
          else origins.set(id, { x: el.x, y: el.y });
        }
        dragRef.current = {
          kind: 'move',
          startX: e.clientX,
          startY: e.clientY,
          worldStart: world,
          elementIds: ids,
          originPositions: origins,
        };
      } else {
        syncSelection([]);
      }
      return;
    }

    if (tool === 'note') {
      const id = newElementId();
      const note: NoteElement = {
        id,
        type: 'note',
        x: world.x,
        y: world.y,
        width: 200,
        height: 160,
        zIndex: nextZIndex(elements),
        text: '',
        color: styles.noteColor,
        align: styles.noteAlign,
      };
      updateElements((prev) => [...prev, note]);
      focusNoteIdRef.current = id;
      syncSelection([id]);
      if (REVERT_TOOLS.has(tool)) setTool('select');
      return;
    }

    if (tool === 'text') {
      const id = newElementId();
      const textEl: TextElement = {
        id,
        type: 'text',
        x: world.x,
        y: world.y,
        width: 240,
        height: 32,
        zIndex: nextZIndex(elements),
        text: '',
        size: styles.textSize,
        bold: styles.textBold,
      };
      updateElements((prev) => [...prev, textEl]);
      focusNoteIdRef.current = id;
      syncSelection([id]);
      setTool('select');
      return;
    }

    if (tool === 'geo') {
      const id = newElementId();
      dragRef.current = {
        kind: 'create-geo',
        startX: e.clientX,
        startY: e.clientY,
        worldStart: world,
        previewId: id,
      };
      const geo: GeoElement = {
        id,
        type: 'geo',
        x: world.x,
        y: world.y,
        width: 1,
        height: 1,
        zIndex: nextZIndex(elements),
        geo: styles.geoType,
        color: resolveStrokeForTheme(styles.geoColor, theme),
        fill: geoFillForColor(resolveStrokeForTheme(styles.geoColor, theme), styles.geoFillMode),
        dash: styles.geoDash,
      };
      updateElements((prev) => [...prev, geo]);
      return;
    }

    if (tool === 'frame') {
      const id = newElementId();
      dragRef.current = {
        kind: 'create-frame',
        startX: e.clientX,
        startY: e.clientY,
        worldStart: world,
        previewId: id,
      };
      const frame: FrameElement = {
        id,
        type: 'frame',
        x: world.x,
        y: world.y,
        width: 1,
        height: 1,
        zIndex: nextZIndex(elements),
        label: 'Frame',
      };
      updateElements((prev) => [...prev, frame]);
      return;
    }

    if (tool === 'arrow') {
      const id = newElementId();
      const arrow: ArrowElement = {
        id,
        type: 'arrow',
        x: world.x,
        y: world.y,
        x2: world.x,
        y2: world.y,
        zIndex: nextZIndex(elements),
        color: resolveStrokeForTheme(styles.geoColor, theme),
        dash: styles.arrowDash,
        start: styles.arrowStart,
        end: styles.arrowEnd,
      };
      updateElements((prev) => [...prev, arrow]);
      dragRef.current = {
        kind: 'create-arrow',
        startX: e.clientX,
        startY: e.clientY,
        previewId: id,
      };
      return;
    }

    if (tool === 'draw') {
      dragRef.current = {
        kind: 'draw',
        startX: e.clientX,
        startY: e.clientY,
        drawPoints: [world],
      };
    }
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, camera);

    if (drag.kind === 'pan') {
      setCamera((c) => ({
        ...c,
        x: c.x + (e.clientX - drag.startX),
        y: c.y + (e.clientY - drag.startY),
      }));
      dragRef.current = { ...drag, startX: e.clientX, startY: e.clientY };
      return;
    }

    if (drag.kind === 'move' && drag.elementIds && drag.originPositions && drag.worldStart) {
      const dx = world.x - drag.worldStart.x;
      const dy = world.y - drag.worldStart.y;
      updateElements((prev) =>
        prev.map((el) => {
          if (!drag.elementIds!.includes(el.id)) return el;
          const origin = drag.originPositions!.get(el.id);
          if (!origin) return el;
          if (el.type === 'arrow') {
            return { ...el, x: origin.x + dx, y: origin.y + dy, x2: (origin.x2 ?? 0) + dx, y2: (origin.y2 ?? 0) + dy };
          }
          if (el.type === 'draw') {
            return {
              ...el,
              points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return { ...el, x: origin.x + dx, y: origin.y + dy };
        }),
      );
      return;
    }

    if (drag.kind === 'create-geo' && drag.worldStart && drag.previewId) {
      const x = Math.min(drag.worldStart.x, world.x);
      const y = Math.min(drag.worldStart.y, world.y);
      const w = Math.max(Math.abs(world.x - drag.worldStart.x), 8);
      const h = Math.max(Math.abs(world.y - drag.worldStart.y), 8);
      updateElement(drag.previewId, { x, y, width: w, height: h });
      return;
    }

    if (drag.kind === 'create-frame' && drag.worldStart && drag.previewId) {
      const x = Math.min(drag.worldStart.x, world.x);
      const y = Math.min(drag.worldStart.y, world.y);
      const w = Math.max(Math.abs(world.x - drag.worldStart.x), 40);
      const h = Math.max(Math.abs(world.y - drag.worldStart.y), 40);
      updateElement(drag.previewId, { x, y, width: w, height: h });
      return;
    }

    if (drag.kind === 'create-arrow' && drag.previewId) {
      updateElement(drag.previewId, { x2: world.x, y2: world.y });
      return;
    }

    if (drag.kind === 'resize' && drag.previewId && drag.corner && drag.originBounds) {
      const { x: ox, y: oy, w: ow, h: oh } = drag.originBounds;
      let x = ox;
      let y = oy;
      let w = ow;
      let h = oh;
      switch (drag.corner) {
        case 'se':
          w = Math.max(world.x - ox, 8);
          h = Math.max(world.y - oy, 8);
          break;
        case 'sw':
          x = world.x;
          w = Math.max(ox + ow - world.x, 8);
          h = Math.max(world.y - oy, 8);
          break;
        case 'ne':
          y = world.y;
          w = Math.max(world.x - ox, 8);
          h = Math.max(oy + oh - world.y, 8);
          break;
        case 'nw':
          x = world.x;
          y = world.y;
          w = Math.max(ox + ow - world.x, 8);
          h = Math.max(oy + oh - world.y, 8);
          break;
      }
      updateElement(drag.previewId, { x, y, width: w, height: h });
      return;
    }

    if (drag.kind === 'rotate' && drag.previewId && drag.center && drag.startAngle !== undefined) {
      const angle = Math.atan2(world.y - drag.center.y, world.x - drag.center.x);
      const deltaDeg = ((angle - drag.startAngle) * 180) / Math.PI;
      updateElement(drag.previewId, { rotation: (drag.originRotation ?? 0) + deltaDeg });
      return;
    }

    if (drag.kind === 'arrow-end' && drag.previewId && drag.arrowEnd) {
      if (drag.arrowEnd === 'start') {
        updateElement(drag.previewId, { x: world.x, y: world.y });
      } else {
        updateElement(drag.previewId, { x2: world.x, y2: world.y });
      }
      return;
    }

    if (drag.kind === 'draw') {
      const points = [...(drag.drawPoints ?? []), world];
      dragRef.current = { ...drag, drawPoints: points };
      setLiveDrawPoints(points);
      return;
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'create-geo' || drag.kind === 'create-frame' || drag.kind === 'create-arrow') {
      if (drag.previewId) {
        const previewId = drag.previewId;
        updateElements((prev) => {
          const el = prev.find((x) => x.id === previewId);
          if (!el) return prev;
          if (el.type === 'geo' || el.type === 'frame') {
            if (el.width < 8 && el.height < 8) {
              return prev.filter((x) => x.id !== previewId);
            }
          }
          if (el.type === 'arrow') {
            const arrow = el as ArrowElement;
            const len = Math.hypot(arrow.x2 - arrow.x, arrow.y2 - arrow.y);
            if (len < 4) return prev.filter((x) => x.id !== previewId);
          }
          return prev;
        });
      }
      syncSelection([]);
    }

    if (drag.kind === 'draw' && drag.drawPoints && drag.drawPoints.length > 1) {
      const drawEl: DrawElement = {
        id: newElementId(),
        type: 'draw',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        zIndex: nextZIndex(elements),
        points: drag.drawPoints,
        color: styles.penColor,
        size: styles.penSize,
      };
      updateElements((prev) => [...prev, drawEl]);
    }

    setLiveDrawPoints(null);
    dragRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setCamera((c) => {
      const newZoom = Math.min(3, Math.max(0.2, c.zoom * factor));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return {
        zoom: newZoom,
        x: mx - (mx - c.x) * (newZoom / c.zoom),
        y: my - (my - c.y) * (newZoom / c.zoom),
      };
    });
  };

  const pickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rect = viewportRef.current?.getBoundingClientRect();
        const cx = rect ? (rect.width / 2 - camera.x) / camera.zoom : 100;
        const cy = rect ? (rect.height / 2 - camera.y) / camera.zoom : 100;
        const img: ImageElement = {
          id: newElementId(),
          type: 'image',
          x: cx - 120,
          y: cy - 90,
          width: 240,
          height: 180,
          zIndex: nextZIndex(elements),
          src: String(reader.result),
        };
        updateElements((prev) => [...prev, img]);
        syncSelection([img.id]);
        setTool('select');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;

      if (e.code === 'Space') { setSpacePan(true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); setCamera((c) => ({ ...c, zoom: 1 })); return; }
      if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); return; }
      if (e.key === 'Escape') { syncSelection([]); setTool('select'); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        if (effectiveSelection.length === 0) return;
        const clones = effectiveSelection
          .map((id) => elements.find((el) => el.id === id))
          .filter(Boolean) as WhiteboardElement[];
        const newIds: string[] = [];
        const added = clones.map((el) => {
          const id = newElementId();
          newIds.push(id);
          return { ...el, id, x: el.x + 16, y: el.y + 16, zIndex: nextZIndex(elements) + newIds.length };
        });
        updateElements((prev) => [...prev, ...added]);
        syncSelection(newIds);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setTool('geo');
        setPenFlyout(false);
        return;
      }
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setStyles((s) => {
          const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
          return {
            ...s,
            geoColor: resolveStrokeForTheme(s.geoColor, currentTheme) === s.geoColor
              ? s.geoColor
              : readThemeStrokeDefault(),
          };
        });
        setTool('arrow');
        setPenFlyout(false);
        return;
      }

      const map: Record<string, ToolId> = { v: 'select', s: 'note', p: 'draw', t: 'text' };
      const next = map[e.key.toLowerCase()];
      if (next) { e.preventDefault(); setTool(next); setPenFlyout(false); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePan(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [readOnly, elements, effectiveSelection, deleteSelected, syncSelection, updateElements, camera]);

  // Auto-focus new notes
  useEffect(() => {
    const id = focusNoteIdRef.current;
    if (!id) return;
    focusNoteIdRef.current = null;
    requestAnimationFrame(() => {
      const ta = viewportRef.current?.querySelector(`[data-el-id="${id}"] textarea`) as HTMLTextAreaElement | null;
      ta?.focus();
    });
  }, [elements]);

  const drawPreview = liveDrawPoints;

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
      {!readOnly && (
        <div className="relative w-10 border-r border-[var(--border-subtle)] bg-[var(--bg-muted)] flex flex-col items-center py-1.5 gap-0.5 shrink-0 z-10 overflow-y-auto max-h-full">
          <button type="button" title="Select (V)" className={railBtn(tool === 'select')} onClick={() => setTool('select')}>
            <MousePointer2 size={14} />
          </button>
          <div className="w-4 h-px bg-[var(--border-subtle)] my-0.5" />
          <button type="button" title="Sticky note (S)" className={railBtn(tool === 'note')} onClick={() => setTool('note')}>
            <StickyNote size={14} />
          </button>
          <button type="button" title="Shape (R)" className={railBtn(tool === 'geo')} onClick={() => selectGeoTool(styles.geoType)}>
            <ShapeIcon geo={styles.geoType} size={14} />
          </button>
          <button type="button" title="Connector (A)" className={railBtn(tool === 'arrow')} onClick={activateArrowTool}>
            <ArrowRight size={14} />
          </button>
          <div className="relative">
            <button type="button" title="Pen (P)" className={railBtn(tool === 'draw' || penFlyout)} onClick={() => { setPenFlyout((v) => !v); setTool('draw'); }}>
              <Pencil size={14} />
            </button>
            {penFlyout && (
              <div className="absolute left-10 top-0 z-50 w-40 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">Color</p>
                <div className="flex gap-2 mb-3">
                  {PEN_COLORS.map((c) => (
                    <ColorSwatch key={c.id} hex={c.hex} label={c.label} active={styles.penColor === c.id} onClick={() => setStyles((s) => ({ ...s, penColor: c.id }))} />
                  ))}
                </div>
                <SegmentRow options={[{ id: 's', label: 'Thin' }, { id: 'l', label: 'Thick' }]} active={styles.penSize} onPick={(id) => setStyles((s) => ({ ...s, penSize: id as 's' | 'l' }))} />
              </div>
            )}
          </div>
          <button type="button" title="Text (T)" className={railBtn(tool === 'text')} onClick={() => setTool('text')}>
            <Type size={14} />
          </button>
          <div className="w-4 h-px bg-[var(--border-subtle)] my-0.5" />
          <button type="button" title="Frame" className={railBtn(tool === 'frame')} onClick={() => setTool('frame')}>
            <Frame size={14} />
          </button>
          <button type="button" title="Image" className={railBtn(false)} onClick={pickImage}>
            <ImageIcon size={14} />
          </button>
        </div>
      )}

      <div
        ref={viewportRef}
        className="flex-1 relative overflow-hidden min-w-0 cursor-crosshair"
        style={{
          background: 'var(--wb-canvas-surface)',
          backgroundImage: 'radial-gradient(var(--wb-canvas-dot) 1px, transparent 1px)',
          backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          cursor: spacePan ? 'grab' : tool === 'select' ? 'default' : 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          if (selection?.type === 'note' && selection.ids.length === 1) {
            e.preventDefault();
            onConvert();
          }
        }}
      >
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          {sorted.map((el) => {
            const selected = effectiveSelection.includes(el.id);
            if (el.type === 'note') {
              return (
                <div key={el.id} data-el-id={el.id}>
                  <NoteView
                    el={el}
                    selected={selected}
                    readOnly={readOnly}
                    onTextChange={(text) => updateElement(el.id, { text })}
                    onFocus={() => syncSelection([el.id])}
                  />
                </div>
              );
            }
            if (el.type === 'geo') return <GeoView key={el.id} el={el} selected={selected} />;
            if (el.type === 'arrow') return <ArrowView key={el.id} el={el} selected={selected} />;
            if (el.type === 'draw') return <DrawView key={el.id} el={el} />;
            if (el.type === 'frame') return <FrameView key={el.id} el={el} selected={selected} />;
            if (el.type === 'text') {
              return (
                <div key={el.id} data-el-id={el.id}>
                  <TextView
                    el={el}
                    selected={selected}
                    readOnly={readOnly}
                    onTextChange={(text) => updateElement(el.id, { text })}
                    onFocus={() => syncSelection([el.id])}
                  />
                </div>
              );
            }
            if (el.type === 'image') return <ImageView key={el.id} el={el} selected={selected} />;
            return null;
          })}
          {!readOnly && tool === 'select' && effectiveSelection.length === 1 && (() => {
            const el = elements.find((item) => item.id === effectiveSelection[0]);
            if (!el || !TRANSFORMABLE_TYPES.has(el.type)) return null;
            return (
              <SelectionTransformOverlay
                element={el}
                onResizeStart={startResize}
                onRotateStart={startRotate}
                onArrowEndStart={startArrowEnd}
              />
            );
          })()}
          {drawPreview && drawPreview.length > 1 && (
            <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ zIndex: 9999 }}>
              <path
                d={drawPreview.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                fill="none"
                stroke={penColorHex(styles.penColor)}
                strokeWidth={PEN_WIDTH[styles.penSize]}
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {!readOnly && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-1.5 py-1 shadow-sm z-10">
            <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(0.2, c.zoom / 1.15) }))} className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-muted)]">
              <Minus size={12} />
            </button>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums w-10 text-center">{Math.round(camera.zoom * 100)}%</span>
            <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(3, c.zoom * 1.15) }))} className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-muted)]">
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {!readOnly && tool === 'geo' && !selection && (
        <GeoToolPanel styles={styles} onStyleChange={patchStyles} />
      )}

      {!readOnly && tool === 'arrow' && !selection && (
        <ArrowToolPanel styles={styles} onStyleChange={patchStyles} />
      )}

      {!readOnly && selection && (
        <ContextPanel
          selection={selection}
          elements={elements}
          projectId={projectId}
          converting={converting}
          convertError={convertError}
          onConvert={onConvert}
          onUpdate={updateElement}
          onDelete={deleteSelected}
          onDeleteFrameOnly={deleteFrameOnly}
          onDeleteFrameWithContents={deleteFrameWithContents}
          onGroup={() => {}}
        />
      )}
    </div>
  );
}
