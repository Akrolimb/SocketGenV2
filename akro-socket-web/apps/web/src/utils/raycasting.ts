/**
 * Raycasting Utilities
 * 
 * Handles 3D mouse interaction for placing annotations on mesh surfaces.
 * Uses Three.js Raycaster to convert 2D mouse coordinates to 3D world positions.
 */

import * as THREE from 'three'

export interface RaycastResult {
  point: THREE.Vector3
  normal: THREE.Vector3
  face?: THREE.Face
  faceIndex?: number
  object: THREE.Object3D
  distance: number
}

export class AnnotationRaycaster {
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2

  constructor() {
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    // Set raycaster precision for mesh intersection
    this.raycaster.params.Mesh = { threshold: 0.1 }
  }

  /**
   * Convert mouse coordinates to 3D world position on mesh surface
   */
  getIntersection(
    mouseX: number, 
    mouseY: number, 
    camera: THREE.Camera, 
    meshes: THREE.Object3D[]
  ): RaycastResult | null {
    // Convert mouse coordinates to normalized device coordinates (-1 to +1)
    this.mouse.x = mouseX
    this.mouse.y = mouseY

    // Update raycaster with camera and mouse position
    this.raycaster.setFromCamera(this.mouse, camera)

    // Check for intersections with the provided meshes
    const intersects = this.raycaster.intersectObjects(meshes, true)

    if (intersects.length > 0) {
      const intersection = intersects[0]
      return {
        point: intersection.point.clone(),
        normal: intersection.face?.normal.clone() || new THREE.Vector3(0, 1, 0),
        face: intersection.face || undefined,
        faceIndex: intersection.faceIndex,
        object: intersection.object,
        distance: intersection.distance
      }
    }

    return null
  }

  /**
   * Convert screen coordinates to normalized device coordinates
   */
  static screenToNDC(
    clientX: number, 
    clientY: number, 
    element: HTMLElement
  ): { x: number, y: number } {
    const rect = element.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1
    }
  }

  /**
   * Check if a point is visible from the camera (not occluded)
   */
  isPointVisible(
    point: THREE.Vector3,
    camera: THREE.Camera,
    meshes: THREE.Object3D[]
  ): boolean {
    const direction = new THREE.Vector3()
    direction.subVectors(point, camera.position).normalize()
    
    this.raycaster.set(camera.position, direction)
    const intersects = this.raycaster.intersectObjects(meshes, true)
    
    if (intersects.length === 0) return true
    
    const firstIntersection = intersects[0]
    const distanceToPoint = camera.position.distanceTo(point)
    
    // Point is visible if it's closer than any mesh intersection
    return firstIntersection.distance >= distanceToPoint - 0.001 // Small tolerance
  }
}