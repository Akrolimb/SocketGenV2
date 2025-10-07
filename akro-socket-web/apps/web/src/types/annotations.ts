/**
 * Annotation System Types
 * 
 * Defines the data structures for the manual annotation system
 * used by prosthetists to mark anatomical landmarks on 3D limb models.
 */

import * as THREE from 'three'

export enum AnnotationType {
  PRESSURE_POINT = 'pressure_point',
  RELIEF_AREA = 'relief_area', 
  TRIM_LINE = 'trim_line',
  MEASUREMENT = 'measurement',
  CUSTOM = 'custom'
}

export interface AnnotationRegion {
  id: string
  type: AnnotationType
  label: string
  notes?: string
  timestamp: Date
  color: string // Hex color for visual representation
  opacity: number // Transparency for overlay
  points: THREE.Vector3[] // Points defining the region boundary
  faceIndices?: number[] // Mesh face indices covered by this region
  brushSize?: number // Size of brush used to create region
}

// Legacy point-based annotation (keeping for backward compatibility)
export interface Annotation {
  id: string
  position: THREE.Vector3
  type: AnnotationType
  label: string
  notes?: string
  timestamp: Date
  color: string // Hex color for visual representation
}

export type AnnotationConfig = {
  [key in AnnotationType]: {
    color: string
    label: string
    description: string
    opacity: number
    defaultBrushSize: number
  }
}

export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  [AnnotationType.PRESSURE_POINT]: {
    color: '#ff4d4f', // Red - areas to avoid pressure
    label: 'Pressure Point',
    description: 'Sensitive area that should not contact socket',
    opacity: 0.6,
    defaultBrushSize: 0.05 // Extremely small for precise marking
  },
  [AnnotationType.RELIEF_AREA]: {
    color: '#52c41a', // Green - areas that can handle pressure
    label: 'Relief Area', 
    description: 'Area that can tolerate socket contact',
    opacity: 0.4,
    defaultBrushSize: 0.08 // Larger but still very small
  },
  [AnnotationType.TRIM_LINE]: {
    color: '#1890ff', // Blue - socket boundaries
    label: 'Trim Line',
    description: 'Socket boundary or trim line',
    opacity: 0.8,
    defaultBrushSize: 0.02 // Very thin lines
  },
  [AnnotationType.MEASUREMENT]: {
    color: '#faad14', // Orange - measurement points
    label: 'Measurement',
    description: 'Reference point for measurements',
    opacity: 0.7,
    defaultBrushSize: 0.03 // Tiny measurement points
  },
  [AnnotationType.CUSTOM]: {
    color: '#722ed1', // Purple - user-defined
    label: 'Custom',
    description: 'Custom annotation type',
    opacity: 0.5,
    defaultBrushSize: 0.05 // Very small default
  }
}

export interface AnnotationStore {
  annotations: Annotation[]
  activeAnnotationType: AnnotationType
  isAnnotationMode: boolean
  selectedAnnotationId?: string
}