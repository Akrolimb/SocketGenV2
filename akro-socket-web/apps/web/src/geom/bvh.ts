import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { LimbMesh } from '../types'

/**
 * BVH-enhanced mesh for fast geometric operations
 */
export interface BVHMesh extends LimbMesh {
  geometry: THREE.BufferGeometry & { boundsTree: MeshBVH }
}

/**
 * Build BVH acceleration structure for a mesh
 * @param mesh Input mesh to build BVH for
 * @returns Mesh with BVH bounds tree
 */
export function buildBVH(mesh: LimbMesh): BVHMesh {
  const geometry = mesh.geometry
  
  // Ensure geometry is properly indexed
  if (!geometry.index) {
    // Convert non-indexed geometry to indexed
    const indexedGeometry = geometry.toNonIndexed().index ? geometry : geometry.toNonIndexed()
    if (!indexedGeometry.index) {
      // Create a simple index for the geometry
      const indices = []
      const positionCount = geometry.attributes.position.count
      for (let i = 0; i < positionCount; i++) {
        indices.push(i)
      }
      geometry.setIndex(indices)
    }
  }
  
  // Build BVH
  console.time('BVH build')
  const boundsTree = new MeshBVH(geometry)
  console.timeEnd('BVH build')
  
  // Attach to geometry
  ;(geometry as any).boundsTree = boundsTree
  
  return mesh as BVHMesh
}

/**
 * Fast raycast using BVH acceleration
 * @param mesh BVH-enabled mesh
 * @param ray Ray to cast
 * @param maxDistance Maximum ray distance
 * @returns Intersection result or null
 */
export function raycastBVH(
  mesh: BVHMesh, 
  ray: THREE.Ray, 
  maxDistance = Infinity
): THREE.Intersection | null {
  const raycaster = new THREE.Raycaster()
  raycaster.ray.copy(ray)
  raycaster.far = maxDistance
  
  const intersections = raycaster.intersectObject(mesh)
  return intersections.length > 0 ? intersections[0] : null
}

/**
 * Find closest point on mesh surface to a given point
 * @param mesh BVH-enabled mesh
 * @param point Target point
 * @returns Closest point on surface and related info
 */
export function closestPointOnSurface(
  mesh: BVHMesh,
  point: THREE.Vector3
): {
  point: THREE.Vector3
  distance: number
  normal: THREE.Vector3
  faceIndex: number | null
} {
  const target = new THREE.Vector3()
  
  // Simple approach: cast rays in multiple directions to find closest surface point
  let closestPoint = target.clone()
  let minDistance = Infinity
  let closestNormal = new THREE.Vector3(0, 1, 0)
  let closestFaceIndex: number | null = null
  
  // Try multiple ray directions from the point
  const directions = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1)
  ]
  
  for (const direction of directions) {
    const ray = new THREE.Ray(point, direction)
    const intersection = raycastBVH(mesh, ray, 1000) // Max distance
    
    if (intersection) {
      const dist = point.distanceTo(intersection.point)
      if (dist < minDistance) {
        minDistance = dist
        closestPoint.copy(intersection.point)
        closestNormal.copy(intersection.normal!)
        closestFaceIndex = intersection.faceIndex!
      }
    }
  }
  
  return {
    point: closestPoint,
    distance: minDistance,
    normal: closestNormal,
    faceIndex: closestFaceIndex
  }
}

/**
 * Snap a point to the mesh surface along a ray direction
 * @param mesh BVH-enabled mesh  
 * @param point Starting point
 * @param direction Ray direction (will be normalized)
 * @param maxDistance Maximum snap distance
 * @returns Snapped surface point or null if no intersection
 */
export function snapToSurface(
  mesh: BVHMesh,
  point: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance = 10
): THREE.Vector3 | null {
  const ray = new THREE.Ray(point, direction.clone().normalize())
  const intersection = raycastBVH(mesh, ray, maxDistance)
  
  return intersection ? intersection.point : null
}

/**
 * Intersect mesh with a plane to get intersection segments
 * Used for slicing operations in socket generation
 * @param mesh BVH-enabled mesh
 * @param plane Cutting plane
 * @returns Array of line segments representing the intersection
 */
export function intersectMeshWithPlane(
  mesh: BVHMesh,
  plane: THREE.Plane
): THREE.Vector3[][] {
  const geometry = mesh.geometry
  const boundsTree = geometry.boundsTree
  
  // Get triangles that intersect the plane
  const intersectedTriangles: number[] = []
  
  boundsTree.shapecast({
    intersectsBounds: (box: THREE.Box3) => {
      return plane.intersectsBox(box)
    },
    intersectsTriangle: (triangle: THREE.Triangle, triangleIndex: number) => {
      // Check if triangle intersects plane
      const d1 = plane.distanceToPoint(triangle.a)
      const d2 = plane.distanceToPoint(triangle.b) 
      const d3 = plane.distanceToPoint(triangle.c)
      
      // If all points are on same side, no intersection
      if ((d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0)) {
        return false
      }
      
      intersectedTriangles.push(triangleIndex)
      return false // Continue traversal
    }
  })
  
  // Extract line segments from intersected triangles
  const segments: THREE.Vector3[][] = []
  const positionAttr = geometry.attributes.position
  const indexAttr = geometry.index
  
  for (const triangleIndex of intersectedTriangles) {
    const i1 = indexAttr!.getX(triangleIndex * 3)
    const i2 = indexAttr!.getX(triangleIndex * 3 + 1)
    const i3 = indexAttr!.getX(triangleIndex * 3 + 2)
    
    const v1 = new THREE.Vector3().fromBufferAttribute(positionAttr, i1)
    const v2 = new THREE.Vector3().fromBufferAttribute(positionAttr, i2)
    const v3 = new THREE.Vector3().fromBufferAttribute(positionAttr, i3)
    
    // Find intersection points on triangle edges
    const intersectionPoints: THREE.Vector3[] = []
    
    const checkEdge = (va: THREE.Vector3, vb: THREE.Vector3) => {
      const da = plane.distanceToPoint(va)
      const db = plane.distanceToPoint(vb)
      
      // Edge crosses plane if distances have different signs
      if (da * db < 0) {
        const t = da / (da - db)
        const intersection = va.clone().lerp(vb, t)
        intersectionPoints.push(intersection)
      }
    }
    
    checkEdge(v1, v2)
    checkEdge(v2, v3)
    checkEdge(v3, v1)
    
    // Add segment if we have exactly 2 intersection points
    if (intersectionPoints.length === 2) {
      segments.push([intersectionPoints[0], intersectionPoints[1]])
    }
  }
  
  return segments
}

/**
 * Get mesh statistics for debugging and QC
 */
export function getMeshStats(mesh: BVHMesh): {
  triangleCount: number
  vertexCount: number
  hasNormals: boolean
  hasUVs: boolean
  boundingBox: THREE.Box3
  volume: number
} {
  const geometry = mesh.geometry
  const triangleCount = geometry.index 
    ? geometry.index.count / 3 
    : geometry.attributes.position.count / 3
    
  const vertexCount = geometry.attributes.position.count
  const hasNormals = !!geometry.attributes.normal
  const hasUVs = !!geometry.attributes.uv
  
  // Compute bounding box from position attribute
  geometry.computeBoundingBox()
  const boundingBox = geometry.boundingBox || new THREE.Box3()
  const size = boundingBox.getSize(new THREE.Vector3())
  const volume = size.x * size.y * size.z
  
  return {
    triangleCount,
    vertexCount,
    hasNormals,
    hasUVs,
    boundingBox,
    volume
  }
}