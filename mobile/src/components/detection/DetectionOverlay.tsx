import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DetectedHazard } from '../../types/detection.types';
import { frameBoxToView, type Size } from '../../utils/overlayGeometry';
import { spokenName, type ExtraObject, type TrackName } from '../../services/ai/sceneIdentifier';

const RISK_COLOR = { critical: '#EF4444', warning: '#F97316', info: '#22C55E' } as const;
/** Room for the longest label, e.g. "motorcycle 78% · moderate distance" */
const LABEL_WIDTH = 260;

const AI_COLOR = '#A855F7';

interface DetectionOverlayProps {
  detections: DetectedHazard[];
  /** Size of the camera frames the boxes were measured on */
  frame: Size | null;
  /** Size of the camera preview on screen */
  view: Size;
  /** AI names for YOLO-tracked objects, by track id */
  aiNames?: Map<number, TrackName>;
  /** Objects only the AI identifier found */
  aiExtras?: ExtraObject[];
  /** Height of the strip at the top that hides the picture (title and status) */
  coveredTop?: number;
}

/**
 * Boxes and labels drawn over the camera preview, for sighted helpers, testers and demos.
 * Purely visual: hidden from the screen reader, and never intercepts touches.
 *
 * YOLO boxes: solid, risk-coloured, with YOLO's own confidence score. AI names (Gemini) are shown
 * on a separate purple line marked "AI", without a percentage: the AI's certainty is its own
 * judgement, not a calibrated score. AI-only objects get a dashed purple box.
 */
export function DetectionOverlay({ detections, frame, view, aiNames, aiExtras = [], coveredTop = 0 }: DetectionOverlayProps) {
  if (!frame) return null;
  // Label at the box's top-left; at the right edge it grows leftwards, and when the box's top
  // is under the title strip it moves just below the strip so it can be read
  const labelRowFor = (box: { left: number; top: number; height: number }) => {
    const hidden = box.top < coveredTop;
    return [
      styles.labelRow,
      box.left + LABEL_WIDTH > view.width && styles.labelRowRight,
      hidden && { top: Math.min(coveredTop - box.top + 2, Math.max(box.height - 24, 0)) },
    ];
  };
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {detections.map((d, i) => {
        if (d.source !== 'camera' || !d.bbox) return null;
        const box = frameBoxToView(d.bbox, frame, view);
        if (!box) return null;
        const color = RISK_COLOR[d.riskLevel];
        const confidence = ` ${Math.round(d.confidence * 100)}%`;
        const distance = d.distanceEstimate ? ` · ${d.distanceEstimate}` : '';
        const ai = d.trackId !== undefined ? aiNames?.get(d.trackId) : undefined;
        return (
          <View key={`${d.label}-${d.trackId ?? i}`} style={[styles.box, box, { borderColor: color, opacity: d.quiet ? 0.55 : 1 }]}>
            {/* Wider than a narrow box (e.g. a person far away), so the label is never cut off */}
            <View style={labelRowFor(box)}>
              <View style={styles.labelStack}>
                <Text style={[styles.label, { backgroundColor: color }]} numberOfLines={1}>
                  {d.label}
                  {confidence}
                  {distance}
                </Text>
                {ai && (
                  <Text style={[styles.label, styles.aiLabel]} numberOfLines={1}>
                    AI: {spokenName(ai.name, ai.certainty)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {aiExtras.map((e, i) => {
        const box = frameBoxToView(e.bbox, frame, view);
        if (!box) return null;
        return (
          <View key={`ai-${e.name}-${i}`} style={[styles.box, styles.aiBox, box]}>
            <View style={labelRowFor(box)}>
              <Text style={[styles.label, styles.aiLabel]} numberOfLines={1}>
                AI: {spokenName(e.name, e.certainty)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 6,
  },
  labelRow: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: LABEL_WIDTH,
    flexDirection: 'row',
  },
  // Box near the right edge of the screen: grow the label leftwards so it stays visible
  labelRowRight: {
    left: undefined,
    right: -2,
    justifyContent: 'flex-end',
  },
  labelStack: {
    alignItems: 'flex-start',
    gap: 2,
  },
  aiBox: {
    borderColor: AI_COLOR,
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  aiLabel: {
    backgroundColor: AI_COLOR,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
