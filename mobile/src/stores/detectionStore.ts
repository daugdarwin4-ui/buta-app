import { create } from 'zustand';
import type { DetectedHazard } from '../types/detection.types';

interface DetectionState {
  isActive: boolean;
  /** Merged hazards from all active sources, most dangerous first */
  detections: DetectedHazard[];
  lastFrameTimestamp: number | null;

  setActive: (active: boolean) => void;
  setDetections: (detections: DetectedHazard[]) => void;
  clearDetections: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  isActive: false,
  detections: [],
  lastFrameTimestamp: null,

  setActive: (isActive) => set({ isActive }),
  setDetections: (detections) =>
    set({ detections, lastFrameTimestamp: Date.now() }),
  clearDetections: () =>
    set({ detections: [], lastFrameTimestamp: null }),
}));
