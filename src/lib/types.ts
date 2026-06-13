export type CurvePoint = {
  x: number;
  y: number;
};

export type CubicCurve = {
  p1: CurvePoint;
  p2: CurvePoint;
};

export type MotionSettings = {
  moveX: number;
  moveY: number;
  moveZ: number;
  inDur: number;
  stagger: number;
  useOut: boolean;
  useSameOut: boolean;
  outX: number;
  outY: number;
  outZ: number;
  outDur: number;
  useOpacity: boolean;
  opIn: number;
  opOut: number;
  useScale: boolean;
  scIn: number;
  scOut: number;
  useRotation: boolean;
  rotIn: number;
  rotOut: number;
  randomAxis?: boolean;
  randomDirection?: number;
  staggerReverse: boolean;
  inCurve: CubicCurve;
  outCurve: CubicCurve;
};
