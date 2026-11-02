/**
 * Unit Tests — placing detection boxes over the full-screen camera preview
 */
import { frameBoxToView } from '../src/utils/overlayGeometry';

describe('frameBoxToView', () => {
  // 3:4 camera frame shown on a taller 9:20 phone screen: the picture is cropped left and right
  const frame = { width: 480, height: 640 };
  const view = { width: 360, height: 800 };

  it('keeps the middle of the frame in the middle of the screen', () => {
    const box = frameBoxToView({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, frame, view)!;
    expect(box.left + box.width / 2).toBeCloseTo(180);
    expect(box.top + box.height / 2).toBeCloseTo(400);
  });

  it('scales by the larger factor so the picture covers the screen', () => {
    // scale = max(360/480, 800/640) = 1.25 → the frame is drawn 600 wide, 120 cropped each side
    const box = frameBoxToView({ x: 0.5, y: 0, width: 0.25, height: 0.5 }, frame, view)!;
    expect(box).toEqual({ left: 180, top: 0, width: 150, height: 400 });
  });

  it('clips boxes at the screen edge and drops ones that are cropped away', () => {
    const partly = frameBoxToView({ x: 0.1, y: 0.2, width: 0.3, height: 0.2 }, frame, view)!;
    expect(partly.left).toBe(0);
    expect(partly.width).toBeCloseTo(120);
    expect(frameBoxToView({ x: 0, y: 0.2, width: 0.15, height: 0.2 }, frame, view)).toBeNull();
  });

  it('returns nothing before the sizes are known', () => {
    expect(frameBoxToView({ x: 0, y: 0, width: 1, height: 1 }, frame, { width: 0, height: 0 })).toBeNull();
  });
});
