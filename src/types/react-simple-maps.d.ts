/**
 * Ambient type declarations for react-simple-maps@3 (no bundled .d.ts).
 */
declare module 'react-simple-maps' {
  import type { ReactNode, SVGProps, MouseEvent, FocusEvent, CSSProperties, Ref } from 'react';

  // ─── Shared ────────────────────────────────────────────────────────────

  type Coordinates = [longitude: number, latitude: number];

  interface StyleStates {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  }

  // ─── ComposableMap ────────────────────────────────────────────────────

  interface ProjectionConfig {
    center?: Coordinates;
    rotate?: [number, number, number];
    scale?: number;
    parallels?: [number, number];
  }

  interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    width?: number;
    height?: number;
    projection?: string | ((width: number, height: number) => unknown);
    projectionConfig?: ProjectionConfig;
    className?: string;
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps & { ref?: Ref<SVGSVGElement> }): JSX.Element;

  // ─── ZoomableGroup ────────────────────────────────────────────────────

  interface ZoomState {
    coordinates: Coordinates;
    zoom: number;
  }

  interface ZoomableGroupProps extends SVGProps<SVGGElement> {
    center?: Coordinates;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: (state: ZoomState, event: unknown) => void;
    onMove?: (state: { x: number; y: number; zoom: number }, event: unknown) => void;
    onMoveEnd?: (state: ZoomState, event: unknown) => void;
    filterZoomEvent?: (event: unknown) => boolean;
    className?: string;
    children?: ReactNode;
  }

  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;

  // ─── Geographies ──────────────────────────────────────────────────────

  export interface GeographyFeature {
    rsmKey: string;
    svgPath: string;
    type: string;
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: unknown;
    };
  }

  interface GeographiesRenderProps {
    geographies: GeographyFeature[];
    outline: unknown;
    borders: unknown;
    path: (feature: unknown) => string;
    projection: (coords: Coordinates) => [number, number];
  }

  interface GeographiesProps {
    geography: string | object | unknown[];
    parseGeographies?: (features: unknown[]) => unknown[];
    className?: string;
    children: (props: GeographiesRenderProps) => ReactNode;
  }

  export function Geographies(props: GeographiesProps): JSX.Element;

  // ─── Geography ────────────────────────────────────────────────────────

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeographyFeature;
    style?: StyleStates;
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseDown?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseUp?: (event: MouseEvent<SVGPathElement>) => void;
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
    onFocus?: (event: FocusEvent<SVGPathElement>) => void;
    onBlur?: (event: FocusEvent<SVGPathElement>) => void;
    className?: string;
  }

  export function Geography(props: GeographyProps): JSX.Element;

  // ─── Marker ───────────────────────────────────────────────────────────

  interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: Coordinates;
    style?: StyleStates;
    onMouseEnter?: (event: MouseEvent<SVGGElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGGElement>) => void;
    onMouseDown?: (event: MouseEvent<SVGGElement>) => void;
    onMouseUp?: (event: MouseEvent<SVGGElement>) => void;
    onClick?: (event: MouseEvent<SVGGElement>) => void;
    onFocus?: (event: FocusEvent<SVGGElement>) => void;
    onBlur?: (event: FocusEvent<SVGGElement>) => void;
    className?: string;
    children?: ReactNode;
  }

  export function Marker(props: MarkerProps): JSX.Element;

  // ─── Sphere ───────────────────────────────────────────────────────────

  interface SphereProps extends SVGProps<SVGPathElement> {
    id?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    className?: string;
  }

  export function Sphere(props: SphereProps): JSX.Element;

  // ─── Graticule ────────────────────────────────────────────────────────

  interface GraticuleProps extends SVGProps<SVGPathElement> {
    step?: [number, number];
    fill?: string;
    stroke?: string;
    className?: string;
  }

  export function Graticule(props: GraticuleProps): JSX.Element;

  // ─── Hooks ────────────────────────────────────────────────────────────

  interface MapContextValue {
    width: number;
    height: number;
    projection: ((coords: Coordinates) => [number, number]) | null;
    path: ((feature: unknown) => string) | null;
  }

  export function useMapContext(): MapContextValue;

  interface ZoomPanContextValue {
    x: number;
    y: number;
    k: number;
    transformString: string;
  }

  export function useZoomPanContext(): ZoomPanContextValue;
}
