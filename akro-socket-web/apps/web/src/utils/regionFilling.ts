/**
 * Region Filling Utilities
 * 
 * Handles detection of closed loops in paint strokes and creates
 * filled regions that conform to mesh surface geometry.
 */

import * as THREE from 'three'

export interface ClosedRegion {
  boundaryPoints: THREE.Vector3[]
  centroid: THREE.Vector3
  area: number
  isValid: boolean
}

/**
 * Check if a stroke forms a closed loop
 */
export function isClosedLoop(points: THREE.Vector3[], tolerance: number = 0.1): boolean {
  if (points.length < 3) return false
  
  const first = points[0]
  const last = points[points.length - 1]
  
  return first.distanceTo(last) <= tolerance
}

/**
 * Detect if stroke intersects with itself to form a loop
 */
export function findClosedRegions(points: THREE.Vector3[], tolerance: number = 0.05): ClosedRegion[] {
  const regions: ClosedRegion[] = []
  
  if (points.length < 4) return regions
  
  // Check for self-intersections or end-to-start closure
  for (let i = 0; i < points.length - 3; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[j]
      const p4 = points[j + 1]
      
      // Check if line segments intersect in 3D space (simplified)
      const intersection = findLineIntersection3D(p1, p2, p3, p4, tolerance)
      if (intersection) {
        // Extract the closed region
        const regionPoints = points.slice(i, j + 1)
        regionPoints.push(intersection)
        
        const region = createClosedRegion(regionPoints)
        if (region.isValid) {
          regions.push(region)
        }
      }
    }
  }
  
  // Check if stroke naturally closes (end near start)
  if (isClosedLoop(points, tolerance)) {
    const region = createClosedRegion(points)
    if (region.isValid) {
      regions.push(region)
    }
  }
  
  return regions
}

/**
 * Find intersection point between two 3D line segments
 */
function findLineIntersection3D(
  p1: THREE.Vector3, 
  p2: THREE.Vector3, 
  p3: THREE.Vector3, 
  p4: THREE.Vector3,
  tolerance: number
): THREE.Vector3 | null {
  // Simplified 3D line intersection - check if lines are close enough
  const line1Dir = p2.clone().sub(p1).normalize()
  const line2Dir = p4.clone().sub(p3).normalize()
  
  // If lines are nearly parallel, no intersection
  if (Math.abs(line1Dir.dot(line2Dir)) > 0.99) {
    return null
  }
  
  // Find closest points on both lines
  const w0 = p1.clone().sub(p3)
  const a = line1Dir.dot(line1Dir)
  const b = line1Dir.dot(line2Dir)
  const c = line2Dir.dot(line2Dir)
  const d = line1Dir.dot(w0)
  const e = line2Dir.dot(w0)
  
  const denom = a * c - b * b
  if (Math.abs(denom) < 0.0001) return null
  
  const t1 = (b * e - c * d) / denom
  const t2 = (a * e - b * d) / denom
  
  // Check if intersection is within line segments
  if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) return null
  
  const point1 = p1.clone().add(line1Dir.clone().multiplyScalar(t1 * p1.distanceTo(p2)))
  const point2 = p3.clone().add(line2Dir.clone().multiplyScalar(t2 * p3.distanceTo(p4)))
  
  // Check if points are close enough
  if (point1.distanceTo(point2) <= tolerance) {
    return point1.clone().lerp(point2, 0.5) // Return midpoint
  }
  
  return null
}

/**
 * Create a closed region from boundary points
 */
function createClosedRegion(points: THREE.Vector3[]): ClosedRegion {
  if (points.length < 3) {
    return {
      boundaryPoints: [],
      centroid: new THREE.Vector3(),
      area: 0,
      isValid: false
    }
  }
  
  // Calculate centroid
  const centroid = new THREE.Vector3()
  points.forEach(point => centroid.add(point))
  centroid.divideScalar(points.length)
  
  // Estimate area (simplified for 3D surface)
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const triangle = new THREE.Triangle(centroid, points[i], points[j])
    area += triangle.getArea()
  }
  
  return {
    boundaryPoints: [...points],
    centroid,
    area,
    isValid: area > 0.001 // Minimum area threshold
  }
}

/**
 * Create a filled mesh region that conforms to surface
 */
export function createFilledRegion(
  region: ClosedRegion,
  surfaceNormal: THREE.Vector3,
  color: string,
  opacity: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []
  
  if (region.boundaryPoints.length < 3) {
    return geometry
  }
  
  // Create triangulated fill using centroid
  const centroid = region.centroid
  vertices.push(centroid.x, centroid.y, centroid.z)
  
  // Add boundary points
  region.boundaryPoints.forEach(point => {
    vertices.push(point.x, point.y, point.z)
  })
  
  // Create triangles from centroid to boundary
  for (let i = 1; i < region.boundaryPoints.length; i++) {
    indices.push(0, i, i + 1)
  }
  // Close the loop
  indices.push(0, region.boundaryPoints.length, 1)
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  
  return geometry
}

/**
 * Check if a point is inside a 3D polygon (simplified)
 */
export function isPointInRegion(point: THREE.Vector3, region: ClosedRegion): boolean {
  // Simplified point-in-polygon test for 3D
  // Project to 2D plane defined by region normal
  const centroid = region.centroid
  const toPoint = point.clone().sub(centroid)
  
  // Use distance from centroid as simple approximation
  const maxDistance = Math.max(...region.boundaryPoints.map(p => p.distanceTo(centroid)))
  
  return toPoint.length() <= maxDistance
}