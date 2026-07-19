/** Native whiteboard document format (replaces tldraw snapshots). */

export const CANVAS_VERSION = 1 as const;

export type NoteColorId = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'grey';
export type GeoKind =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'hexagon'
  | 'cylinder'
  | 'cloud'
  | 'document';

export type GeoFillMode = 'filled' | 'hollow';
export type DashStyle = 'solid' | 'dashed';
export type TextSize = 's' | 'm' | 'l';
export type ArrowEnd = 'none' | 'arrow';
export type AlignStyle = 'start' | 'middle';

export interface WhiteboardCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface ElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
}

export interface NoteElement extends ElementBase {
  type: 'note';
  text: string;
  color: NoteColorId;
  align: AlignStyle;
  ticketId?: number;
  ticketTicketId?: string;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  size: TextSize;
  bold: boolean;
}

export interface GeoElement extends ElementBase {
  type: 'geo';
  geo: GeoKind;
  color: string;
  dash: DashStyle;
  fill: string;
}

export interface ArrowElement extends Omit<ElementBase, 'width' | 'height'> {
  type: 'arrow';
  x2: number;
  y2: number;
  color: string;
  dash: DashStyle;
  start: ArrowEnd;
  end: ArrowEnd;
}

export interface DrawElement extends ElementBase {
  type: 'draw';
  points: { x: number; y: number }[];
  color: string;
  size: 's' | 'l';
}

export interface FrameElement extends ElementBase {
  type: 'frame';
  label: string;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  src: string;
}

export type WhiteboardElement =
  | NoteElement
  | TextElement
  | GeoElement
  | ArrowElement
  | DrawElement
  | FrameElement
  | ImageElement;

export interface WhiteboardCanvasDocument {
  version: typeof CANVAS_VERSION;
  camera: WhiteboardCamera;
  elements: WhiteboardElement[];
}

export type WhiteboardCanvasData = WhiteboardCanvasDocument | Record<string, unknown>;

export const NOTE_COLORS: { id: NoteColorId; hex: string; label: string }[] = [
  { id: 'yellow', hex: '#FFF3C4', label: 'Yellow' },
  { id: 'green', hex: '#D3F5DD', label: 'Green' },
  { id: 'pink', hex: '#FFDCE1', label: 'Pink' },
  { id: 'purple', hex: '#E9E3FF', label: 'Purple' },
  { id: 'blue', hex: '#D6EAFB', label: 'Blue' },
  { id: 'grey', hex: '#EAEAEA', label: 'Gray' },
];

export const GEO_COLORS = [
  { id: 'blue', hex: '#3b82f6', label: 'Blue' },
  { id: 'red', hex: '#ef4444', label: 'Red' },
  { id: 'green', hex: '#22c55e', label: 'Green' },
  { id: 'yellow', hex: '#eab308', label: 'Yellow' },
  { id: 'violet', hex: '#8b5cf6', label: 'Violet' },
  { id: 'grey', hex: '#6b7280', label: 'Gray' },
  { id: 'ink', hex: '#1e293b', label: 'Dark' },
  { id: 'light', hex: '#e2e8f0', label: 'Light' },
];

export const PEN_COLORS = [
  { id: 'black', hex: '#1e293b', label: 'Black' },
  { id: 'light', hex: '#e2e8f0', label: 'Light' },
  { id: 'blue', hex: '#3b82f6', label: 'Blue' },
  { id: 'red', hex: '#ef4444', label: 'Red' },
];

export const NOTE_TEXT_COLOR = '#0f172a';

export function readThemeAccentColor(): string {
  if (typeof window === 'undefined') return '#3b82f6';
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
}

export function readThemeStrokeDefault(): string {
  if (typeof window === 'undefined') return '#1e293b';
  return getComputedStyle(document.documentElement).getPropertyValue('--wb-stroke-default').trim() || '#1e293b';
}

const LIGHT_STROKES = new Set(['#e2e8f0', '#f8fafc', '#ffffff', '#fff', '#e1e2ec', '#f1f5f9']);
const DARK_STROKES = new Set(['#1e293b', '#0f172a', '#000000', '#000']);

export function resolveStrokeForTheme(color: string, theme: 'light' | 'dark'): string {
  const normalized = color.trim().toLowerCase();
  if (theme === 'light' && LIGHT_STROKES.has(normalized)) return '#1e293b';
  if (theme === 'dark' && DARK_STROKES.has(normalized)) return '#e2e8f0';
  return color;
}

export function defaultPenColorId(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? 'light' : 'black';
}

export function penColorHex(colorId: string): string {
  return PEN_COLORS.find((c) => c.id === colorId)?.hex ?? PEN_COLORS[0].hex;
}

export const GEO_SHAPES: { id: GeoKind; label: string }[] = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Oval' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'document', label: 'Document' },
];

export function geoFillForColor(color: string, mode: GeoFillMode): string {
  return mode === 'hollow' ? 'transparent' : `${color}40`;
}

export function emptyCanvas(): WhiteboardCanvasDocument {
  return { version: CANVAS_VERSION, camera: { x: 0, y: 0, zoom: 1 }, elements: [] };
}

export function isNativeCanvas(data: unknown): data is WhiteboardCanvasDocument {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as WhiteboardCanvasDocument).version === CANVAS_VERSION &&
    Array.isArray((data as WhiteboardCanvasDocument).elements)
  );
}

export function normalizeCanvas(data: WhiteboardCanvasData | null | undefined): WhiteboardCanvasDocument {
  if (isNativeCanvas(data)) {
    return {
      version: CANVAS_VERSION,
      camera: data.camera ?? { x: 0, y: 0, zoom: 1 },
      elements: data.elements.map((el) => ({ ...el })),
    };
  }
  return emptyCanvas();
}

export function newElementId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `el_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nextZIndex(elements: WhiteboardElement[]): number {
  if (elements.length === 0) return 1;
  return Math.max(...elements.map((e) => e.zIndex ?? 0)) + 1;
}

export function sortByZIndex(elements: WhiteboardElement[]): WhiteboardElement[] {
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

export function getElementBounds(el: WhiteboardElement): { x: number; y: number; w: number; h: number } {
  if (el.type === 'arrow') {
    const minX = Math.min(el.x, el.x2);
    const minY = Math.min(el.y, el.y2);
    const maxX = Math.max(el.x, el.x2);
    const maxY = Math.max(el.y, el.y2);
    return { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 };
  }
  if (el.type === 'draw') {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX || 1, h: maxY - minY || 1 };
  }
  return { x: el.x, y: el.y, w: el.width, h: el.height };
}

export function hitTestElement(el: WhiteboardElement, wx: number, wy: number): boolean {
  const pad = 4;
  const b = getElementBounds(el);
  return wx >= b.x - pad && wx <= b.x + b.w + pad && wy >= b.y - pad && wy <= b.y + b.h + pad;
}

export const TEXT_SIZE_PX: Record<TextSize, number> = { s: 14, m: 18, l: 24 };
export const PEN_WIDTH: Record<'s' | 'l', number> = { s: 2, l: 5 };
