/**
 * Mesh Painting Utilities
 * 
 * Provides functionality for painting regions on mesh surfaces
 * by detecting face intersections and applying vertex colors or overlays.
 */

import * as THREE from 'three'

export interface PaintStroke {
  points: THREE.Vector3[]
  brushSize: number
  color: string
  opacity: number
}

export interface MeshPaintingResult {
  affectedFaces: number[]
  overlayGeometry: THREE.BufferGeometry
  material: THREE.Material
}

/**
 * Paint a region on a mesh by creating an overlay geometry
 */
export function paintMeshRegion(
  mesh: THREE.Mesh,
  worldPosition: THREE.Vector3,
  brushSize: number,
  color: string,
  opacity: number,
  normal?: THREE.Vector3
): MeshPaintingResult | null {
  if (!mesh.geometry || !mesh.geometry.attributes.position) {
    return null
  }

  const geometry = mesh.geometry as THREE.BufferGeometry
  const positionAttribute = geometry.attributes.position
  const vertices: THREE.Vector3[] = []
  const faces: number[] = []

  // Convert world position to local mesh coordinates
  const localPosition = mesh.worldToLocal(worldPosition.clone())

  // Find vertices within brush radius
  const affectedVertices: number[] = []
  for (let i = 0; i < positionAttribute.count; i++) {
    const vertex = new THREE.Vector3(
      positionAttribute.getX(i),
      positionAttribute.getY(i),
      positionAttribute.getZ(i)
    )
    
    const distance = vertex.distanceTo(localPosition)
    if (distance <= brushSize) {
      affectedVertices.push(i)
      vertices.push(vertex)
    }
  }

  if (affectedVertices.length === 0) {
    return null
  }

  // Create overlay geometry for the painted region
  const overlayGeometry = new THREE.BufferGeometry()
  const overlayVertices: number[] = []
  
  // Create a very small disc directly on the mesh surface
  const segments = 8 // Fewer segments for small annotations
  const center = worldPosition // Use world position directly
  
  // Use surface normal for proper orientation (default to up if not provided)
  const surfaceNormal = normal ? normal.clone().normalize() : new THREE.Vector3(0, 0, 1)
  
  // Create tangent vectors for the disc plane
  const tangent1 = new THREE.Vector3()
  const tangent2 = new THREE.Vector3()
  
  // Find two perpendicular vectors to the normal
  if (Math.abs(surfaceNormal.dot(new THREE.Vector3(1, 0, 0))) < 0.9) {
    tangent1.crossVectors(surfaceNormal, new THREE.Vector3(1, 0, 0)).normalize()
  } else {
    tangent1.crossVectors(surfaceNormal, new THREE.Vector3(0, 1, 0)).normalize()
  }
  tangent2.crossVectors(surfaceNormal, tangent1).normalize()
  
  // Make the radius extremely small for precise annotations
  const actualRadius = brushSize * 0.1 // 10x smaller radius
  
  // Create center vertex (slightly offset from surface to avoid z-fighting)
  const offset = surfaceNormal.clone().multiplyScalar(0.001) // Very small offset
  const centerWithOffset = center.clone().add(offset)
  overlayVertices.push(centerWithOffset.x, centerWithOffset.y, centerWithOffset.z)
  
  // Create circle vertices using the tangent vectors
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const circlePoint = centerWithOffset.clone()
      .add(tangent1.clone().multiplyScalar(Math.cos(angle) * actualRadius))
      .add(tangent2.clone().multiplyScalar(Math.sin(angle) * actualRadius))
    
    overlayVertices.push(circlePoint.x, circlePoint.y, circlePoint.z)
  }

  overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(overlayVertices, 3))

  // Create indices for the disc
  const indices: number[] = []
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i === segments ? 1 : i + 1)
  }
  overlayGeometry.setIndex(indices)
  overlayGeometry.computeVertexNormals()

  // Create material for the overlay - use MeshLambertMaterial for better surface integration
  const material = new THREE.MeshLambertMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending
  })

  return {
    affectedFaces: [], // TODO: Calculate actual face indices
    overlayGeometry,
    material
  }
}

/**
 * Create a brush stroke path from mouse movements
 */
export function createBrushStroke(
  startPosition: THREE.Vector3,
  endPosition: THREE.Vector3,
  brushSize: number,
  color: string,
  opacity: number
): PaintStroke {
  const points: THREE.Vector3[] = []
  const distance = startPosition.distanceTo(endPosition)
  const steps = Math.max(2, Math.floor(distance / (brushSize * 0.1)))

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const point = startPosition.clone().lerp(endPosition, t)
    points.push(point)
  }

  return {
    points,
    brushSize,
    color,
    opacity
  }
}

/**
 * Combine multiple paint strokes into a region
 */
export function combineStrokes(strokes: PaintStroke[]): THREE.BufferGeometry {
  const combinedGeometry = new THREE.BufferGeometry()
  // TODO: Implement stroke combination logic
  return combinedGeometry
}

/**
 * Calculate UV coordinates for texture painting (alternative approach)
 */
export function calculateUVPainting(
  mesh: THREE.Mesh,
  worldPosition: THREE.Vector3,
  brushSize: number
): { u: number; v: number; radius: number } | null {
  // TODO: Implement UV-based painting for texture overlays
  return null
}