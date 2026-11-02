import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Direction, RiskLevel } from '../../constants/hazards';
import type { DetectedHazard } from '../../types/detection.types';
import type { PerfStats } from '../../services/detection/perfMeter';
import type { ScanStatus } from '../../services/ai/sceneIdentifier';

const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, warning: 1, info: 2 };
// Same colours as the boxes and the hazard banner
const RISK_COLOR: Record<RiskLevel, string> = { critical: '#EF4444', warning: '#F97316', info: '#16A34A' };
const ZONES: { dir: Direction; name: string }[] = [
  { dir: 'left', name: 'LEFT' },
  { dir: 'ahead', name: 'AHEAD' },
  { dir: 'right', name: 'RIGHT' },
];

export interface ZoneSummary {
  count: number;
  /** Most serious risk in the zone, or null when nothing is there */
  risk: RiskLevel | null;
}

/** How many objects are on the left, ahead and on the right, and the worst risk in each */
export function summarizeZones(detections: DetectedHazard[]): Record<Direction, ZoneSummary> {
  const zones: Record<Direction, ZoneSummary> = {
    left: { count: 0, risk: null },
    ahead: { count: 0, risk: null },
    right: { count: 0, risk: null },
  };
  for (const d of detections) {
    const zone = zones[d.direction];
    zone.count++;
    if (zone.risk === null || RISK_ORDER[d.riskLevel] < RISK_ORDER[zone.risk]) zone.risk = d.riskLevel;
  }
  return zones;
}

export interface AiScanInfo {
  status: ScanStatus;
  /** Objects only the AI identifier found in its last scan */
  extras: number;
  lastScanAt: number | null;
}

interface DetectionHudProps {
  detections: DetectedHazard[];
  /** Measured camera AI speed; null when the camera AI is not running (cane only / demo) */
  perf: PerfStats | null;
  /** AI object identification status; null when it is turned off */
  ai?: AiScanInfo | null;
}

/** "AI names: scanning…", "AI names: 3 more objects · 4 s ago", "AI names: offline" */
export function describeAiScan(ai: AiScanInfo, now = Date.now()): string {
  if (ai.status === 'off') return 'AI names: paused (camera can’t see)';
  if (ai.status === 'offline') return 'AI names: offline (YOLO only)';
  if (ai.status === 'scanning' && ai.lastScanAt === null) return 'AI names: looking…';
  if (ai.lastScanAt === null) return 'AI names: starting…';
  const ago = Math.max(0, Math.round((now - ai.lastScanAt) / 1000));
  const found = ai.extras === 0 ? 'nothing extra' : `${ai.extras} more ${ai.extras === 1 ? 'object' : 'objects'}`;
  return `AI names: ${found} · ${ago} s ago${ai.status === 'scanning' ? ' · looking…' : ''}`;
}

/**
 * Status strip for sighted helpers, testers and demos: object count, measured speed, and
 * left / ahead / right zones coloured by their most serious hazard. Hidden from the screen
 * reader (the spoken alerts carry the same information).
 */
export function DetectionHud({ detections, perf, ai }: DetectionHudProps) {
  const zones = summarizeZones(detections);
  const count = detections.length;
  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.stats}>
        {count} {count === 1 ? 'object' : 'objects'}
        {perf ? ` · ${perf.fps.toFixed(1)} FPS · ${Math.round(perf.inferenceMs)} ms` : ''}
      </Text>
      {ai && <Text style={styles.aiStatus}>{describeAiScan(ai)}</Text>}
      <View style={styles.zones}>
        {ZONES.map(({ dir, name }) => {
          const zone = zones[dir];
          return (
            <View
              key={dir}
              style={[styles.zone, zone.risk ? { backgroundColor: RISK_COLOR[zone.risk] } : styles.zoneEmpty]}
            >
              <Text style={styles.zoneText}>
                {name}
                {zone.count > 0 ? ` ${zone.count}` : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 4,
  },
  stats: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  aiStatus: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  zones: {
    flexDirection: 'row',
    gap: 6,
  },
  zone: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  zoneEmpty: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  zoneText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
