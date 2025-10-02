import { z } from 'zod'
import * as THREE from 'three'

// Units schema
export const UnitsSchema = z.enum(['mm', 'cm', 'm'])
export type Units = z.infer<typeof UnitsSchema>

// Marking classification schema
export const MarkClassSchema = z.enum(['trimline', 'relief_tender', 'pad_load', 'landmark'])
export type MarkClass = z.infer<typeof MarkClassSchema>

// Geometry types
export const Geometry3DSchema = z.object({
  kind: z.enum(['polyline', 'polygon']),
  points: z.array(z.tuple([z.number(), z.number(), z.number()]))
})
export type Geometry3D = z.infer<typeof Geometry3DSchema>

// Case metadata schema
export const CaseMetaSchema = z.object({
  name: z.string(),
  units: UnitsSchema,
  triCount: z.number(),
  bbox: z.object({
    min: z.tuple([z.number(), z.number(), z.number()]),
    max: z.tuple([z.number(), z.number(), z.number()])
  })
})
export type CaseMeta = z.infer<typeof CaseMetaSchema>

// Marking schema
export const MarkingSchema = z.object({
  id: z.string(),
  label: z.string(),
  cls: MarkClassSchema,
  geom: Geometry3DSchema,
  strength: z.number().min(0).max(1).default(0.5),
  color: z.string()
})
export type Marking = z.infer<typeof MarkingSchema>

// Socket parameters schema
export const SocketParamsSchema = z.object({
  thicknessMM: z.number().positive().default(4.0),
  sliceStepMM: z.number().positive().default(5.0),
  smoothingMM: z.number().nonnegative().default(2.0),
  reliefPct: z.record(MarkClassSchema, z.number()).default({
    trimline: 0,
    relief_tender: 120,
    pad_load: 60,
    landmark: 0
  }),
  trimlineId: z.string().nullable().default(null)
})
export type SocketParams = z.infer<typeof SocketParamsSchema>

// QC Report schema
export const QCReportSchema = z.object({
  manifold: z.boolean(),
  minWallOK: z.boolean(),
  minWallMM: z.number(),
  selfIntersections: z.number().nonnegative(),
  notes: z.array(z.string())
})
export type QCReport = z.infer<typeof QCReportSchema>

// Case state schema
export const CaseStateSchema = z.object({
  meta: CaseMetaSchema.nullable().default(null),
  limb: z.any().nullable().default(null), // THREE.Mesh - can't easily validate
  markings: z.array(MarkingSchema).default([]),
  socketParams: SocketParamsSchema,
  qc: QCReportSchema.nullable().default(null),
  evidenceScene: z.any().nullable().default(null) // THREE.Scene
})
export type CaseState = z.infer<typeof CaseStateSchema>

// Socket export metadata
export const SocketExportMetadataSchema = z.object({
  units: UnitsSchema,
  thicknessMM: z.number(),
  sliceStepMM: z.number(),
  smoothingMM: z.number(),
  reliefPct: z.record(MarkClassSchema, z.number())
})
export type SocketExportMetadata = z.infer<typeof SocketExportMetadataSchema>

// Report JSON schema
export const ReportJSONSchema = z.object({
  case: z.string(),
  mesh: z.object({
    triangles: z.number(),
    bboxMM: z.tuple([z.number(), z.number(), z.number()])
  }),
  params: SocketParamsSchema,
  qc: QCReportSchema,
  counters: z.object({
    slices: z.number(),
    offsetFailures: z.number(),
    capHolesClosed: z.number()
  }),
  timingsMs: z.object({
    slice: z.number(),
    offset: z.number(),
    loft: z.number(),
    capping: z.number(),
    smoothing: z.number(),
    qc: z.number()
  }),
  notes: z.array(z.string())
})
export type ReportJSON = z.infer<typeof ReportJSONSchema>

// Helper types for Three.js objects that we need to pass around
export interface LimbMesh extends THREE.Mesh {
  userData: {
    originalTriangleCount?: number
    wasDecimated?: boolean
  }
}

export interface SocketMesh extends THREE.Mesh {
  userData: {
    socketParams: SocketParams
    qcReport: QCReport
    exportMetadata: SocketExportMetadata
  }
}