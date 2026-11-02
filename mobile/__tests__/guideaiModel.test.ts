/**
 * Unit Tests — GuideAI model integration: labels follow the model, "camera can't see" warnings,
 * new Philippine hazard classes, update service safety
 */
import { GUIDEAI_LABELS, GUIDEAI_V3_LABELS, YOLO_LABELS, labelsForOutputShape } from '../src/services/detection/yolo/yoloLabels';
import { assessView, CameraViewMonitor } from '../src/services/detection/yolo/viewQuality';
import { classifyHazard } from '../src/services/detection/hazardClassifier';
import { objectDetectionService } from '../src/services/detection/objectDetection.service';
import { estimateDistanceMeters } from '../src/utils/distanceEstimator';
import { confidenceThresholdFor, isAnnouncedHazard } from '../src/constants/hazards';

describe('labelsForOutputShape', () => {
  it('picks the labels that match the model', () => {
    expect(labelsForOutputShape([1, 84, 2100])).toBe(YOLO_LABELS);
    expect(labelsForOutputShape([1, 29, 2100])).toBe(GUIDEAI_LABELS);
    expect(labelsForOutputShape([1, 2100, 29])).toBe(GUIDEAI_LABELS);
    // v3: 45 classes; the first 25 keep the same names and numbers
    expect(labelsForOutputShape([1, 49, 2100])).toBe(GUIDEAI_V3_LABELS);
    expect(GUIDEAI_V3_LABELS.slice(0, 25)).toEqual(GUIDEAI_LABELS);
    expect(GUIDEAI_V3_LABELS).toHaveLength(45);
  });

  it('gives no names to an unknown model rather than wrong ones', () => {
    expect(labelsForOutputShape([1, 10, 2100])).toEqual([]);
  });

  it('every GuideAI class is something the app can announce', () => {
    expect(GUIDEAI_LABELS).toHaveLength(25);
    for (const label of GUIDEAI_LABELS) expect(isAnnouncedHazard(label)).toBe(true);
  });
});

describe('assessView', () => {
  const S = 8;
  /** S×S letterboxed input of a square frame (no padding), filled by fn(x, y) → gray value */
  const image = (fn: (x: number, y: number) => number) => {
    const rgb = new Uint8Array(S * S * 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) rgb.fill(fn(x, y), (y * S + x) * 3, (y * S + x) * 3 + 3);
    return rgb;
  };

  it('flags a dark view', () => {
    expect(assessView(image(() => 10), S, 100, 100)).toBe('dark');
  });

  it('flags a flat, featureless view (lens covered in light)', () => {
    expect(assessView(image(() => 150), S, 100, 100)).toBe('blocked');
  });

  it('accepts a normal view with detail', () => {
    // Light and dark halves (the check samples every 4th pixel, so detail must span that)
    expect(assessView(image((x) => (x < S / 2 ? 60 : 200)), S, 100, 100)).toBe('ok');
  });

  it('ignores the gray letterbox padding', () => {
    // Portrait frame: middle half is the image (dark), sides are padding gray 114
    const rgb = image((x) => (x < 2 || x >= 6 ? 114 : 5));
    expect(assessView(rgb, S, 50, 100)).toBe('dark');
  });
});

describe('CameraViewMonitor', () => {
  it('needs 3 frames in a row before warning, and before clearing', () => {
    const m = new CameraViewMonitor(3);
    expect(m.update('dark')).toBeNull();
    expect(m.update('dark')).toBeNull();
    expect(m.update('dark')).toBe('dark');
    expect(m.update('ok')).toBeNull();
    expect(m.update('ok')).toBeNull();
    expect(m.update('ok')).toBe('ok');
  });

  it('ignores a passing shadow', () => {
    const m = new CameraViewMonitor(3);
    m.update('dark');
    m.update('dark');
    m.update('ok');
    m.update('dark');
    expect(m.view).toBe('ok');
  });

  it('reset reports whether it changed anything', () => {
    const m = new CameraViewMonitor(1);
    expect(m.reset()).toBe(false);
    m.update('blocked');
    expect(m.reset()).toBe(true);
    expect(m.view).toBe('ok');
  });
});

describe('Philippine hazard classes', () => {
  const det = (label: string, confidence = 0.9, bbox = { x: 0.4, y: 0.3, width: 0.2, height: 0.3 }) => ({
    classId: 0, label, confidence, bbox,
  });

  it('treats jeepneys as critical moving vehicles', () => {
    expect(classifyHazard(det('jeepney')).riskLevel).toBe('critical');
    expect(classifyHazard(det('jeepney'), { approaching: true }).announcement).toMatch(/^Approaching jeepney/);
  });

  it('announces bumps and vendor carts', () => {
    expect(classifyHazard(det('bump')).announcement).toMatch(/^Bump ahead/);
    expect(classifyHazard(det('cart')).riskLevel).toBe('warning');
  });

  it('measures bumps on the ground like potholes', () => {
    const near = estimateDistanceMeters({ x: 0.4, y: 0.85, width: 0.2, height: 0.08 }, 'bump')!;
    const far = estimateDistanceMeters({ x: 0.4, y: 0.6, width: 0.2, height: 0.04 }, 'bump')!;
    expect(near).toBeLessThan(far);
  });

  it('accepts potholes and open drains at lower confidence (they are often missed)', () => {
    expect(confidenceThresholdFor('pothole')).toBe(0.3);
    expect(confidenceThresholdFor('open_drainage')).toBe(0.3);
    const kept = objectDetectionService.filterConfident([det('open_drainage', 0.32), det('person', 0.32)]);
    expect(kept.map((d) => d.label)).toEqual(['open_drainage']);
  });
});

describe('app updates', () => {
  type AppUpdates = typeof import('../src/services/updates/appUpdates');
  /**
   * A fresh copy of the update service (with its own empty device storage) whose expo-updates
   * is `fake`. The service reads expo-updates on every call, so changing `fake` later
   * simulates the app being relaunched on another version.
   */
  const withUpdates = (fake: object): AppUpdates => {
    jest.resetModules();
    jest.doMock('expo-updates', () => fake);
    return require('../src/services/updates/appUpdates');
  };
  afterAll(() => jest.dontMock('expo-updates'));

  it('reports a development build instead of failing when updates are off', async () => {
    const u = withUpdates({ isEnabled: false });
    expect(u.getUpdateInfo().enabled).toBe(false);
    expect(u.describeVersion()).toContain('(development build)');
    await expect(u.checkForUpdateNow()).resolves.toBe('unavailable');
    await expect(u.consumeUpdateNotice()).resolves.toBe(false);
  });

  it('says up to date, and never throws when the network fails', async () => {
    const base = { isEnabled: true, isEmbeddedLaunch: false, updateId: 'u1', createdAt: new Date() };
    const ok = withUpdates({ ...base, checkForUpdateAsync: async () => ({ isAvailable: false }) });
    await expect(ok.checkForUpdateNow()).resolves.toBe('up-to-date');
    const offline = withUpdates({ ...base, checkForUpdateAsync: async () => { throw new Error('offline'); } });
    await expect(offline.checkForUpdateNow()).resolves.toBe('error');
  });

  it('downloads and restarts into a new update, announcing first', async () => {
    const reloadAsync = jest.fn(async () => {});
    const order: string[] = [];
    const u = withUpdates({
      isEnabled: true, isEmbeddedLaunch: false, updateId: 'u1', createdAt: new Date(),
      checkForUpdateAsync: async () => ({ isAvailable: true }),
      fetchUpdateAsync: async () => ({ isNew: true }),
      reloadAsync: async () => { order.push('restart'); await reloadAsync(); },
    });
    await expect(u.checkForUpdateNow(() => { order.push('announce'); })).resolves.toBe('installing');
    expect(order).toEqual(['announce', 'restart']);
  });

  it('announces a new update once, but not the first launch after install', async () => {
    const fake = { isEnabled: true, isEmbeddedLaunch: true, updateId: 'embedded' };
    const u = withUpdates(fake);
    await expect(u.consumeUpdateNotice()).resolves.toBe(false); // first launch after install
    Object.assign(fake, { isEmbeddedLaunch: false, updateId: 'u2' }); // relaunched on an update
    await expect(u.consumeUpdateNotice()).resolves.toBe(true);
    await expect(u.consumeUpdateNotice()).resolves.toBe(false); // only once
  });

  it('describes an updated install with its date', () => {
    const u = withUpdates({ isEnabled: false });
    const text = u.describeVersion({ appVersion: '1.0.0', enabled: true, updateId: 'abc', publishedAt: new Date(2026, 9, 9) });
    expect(text.startsWith('Version 1.0.0, updated ')).toBe(true);
    expect(u.describeVersion({ appVersion: '1.0.0', enabled: true, updateId: null, publishedAt: null })).toBe(
      'Version 1.0.0, original install'
    );
  });
});
