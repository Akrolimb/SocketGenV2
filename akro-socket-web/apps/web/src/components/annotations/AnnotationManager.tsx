/**
 * Annotation Manager Component
 * 
 * Main component that orchestrates the annotation system:
 * - Handles mouse interactions for placing annotations
 * - Manages raycasting for 3D point placement
 * - Integrates with the 3D scene and camera
 */

import React, { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { AnnotationRaycaster } from '../../utils/raycasting'
import { AnnotationMarkers } from './AnnotationMarkers'
import { useAnnotationContext } from '../../contexts/AnnotationContext'
import { Annotation } from '../../types/annotations'

interface AnnotationManagerProps {
  camera: THREE.Camera
  scene: THREE.Scene
  meshes: THREE.Object3D[] // Meshes that can be annotated
  canvasElement: HTMLCanvasElement | null
  enabled?: boolean
}

export const AnnotationManager: React.FC<AnnotationManagerProps> = ({
  camera,
  scene,
  meshes,
  canvasElement,
  enabled = true
}) => {
  const raycaster = useRef(new AnnotationRaycaster())
  
  const {
    annotations,
    selectedAnnotationId,
    isAnnotationMode,
    addAnnotation,
    removeAnnotation,
    setSelectedAnnotation
  } = useAnnotationContext()

  // Handle mouse click for placing annotations
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    console.log('🖱️ Canvas click detected:', {
      enabled,
      hasCanvas: !!canvasElement,
      isAnnotationMode,
      meshCount: meshes.length,
      eventType: event.type,
      button: event.button
    })

    if (!enabled) {
      console.log('❌ Annotation manager disabled')
      return
    }
    
    if (!canvasElement) {
      console.log('❌ No canvas element')
      return
    }
    
    if (!isAnnotationMode) {
      console.log('❌ Not in annotation mode')
      return
    }

    if (meshes.length === 0) {
      console.log('❌ No meshes to annotate')
      return
    }

    // Prevent default behavior
    event.preventDefault()
    event.stopPropagation()

    // Convert mouse coordinates to NDC
    const coords = AnnotationRaycaster.screenToNDC(
      event.clientX, 
      event.clientY, 
      canvasElement
    )

    console.log('🎯 Raycasting with coords:', coords, 'against', meshes.length, 'meshes')

    // Perform raycasting
    const intersection = raycaster.current.getIntersection(
      coords.x,
      coords.y,
      camera,
      meshes
    )

    if (intersection) {
      // Add annotation at intersection point
      const annotation = addAnnotation(intersection.point)
      console.log('✅ Placed annotation at:', intersection.point, annotation)
    } else {
      console.log('❌ No intersection found - debugging mesh info:')
      meshes.forEach((mesh, i) => {
        console.log(`  Mesh ${i}:`, {
          name: mesh.name,
          type: mesh.type,
          visible: mesh.visible,
          position: mesh.position,
          hasGeometry: !!(mesh as any).geometry
        })
      })
    }
  }, [enabled, canvasElement, isAnnotationMode, camera, meshes, addAnnotation])

  // Handle right-click for removing annotations
  const handleCanvasRightClick = useCallback((event: MouseEvent) => {
    if (!enabled || !canvasElement) return

    event.preventDefault()

    // Convert mouse coordinates to NDC
    const coords = AnnotationRaycaster.screenToNDC(
      event.clientX,
      event.clientY,
      canvasElement
    )

    // Check if we clicked on an annotation marker
    const intersection = raycaster.current.getIntersection(
      coords.x,
      coords.y,
      camera,
      scene.children.filter(child => child.name === 'annotation-markers')
    )

    if (intersection && intersection.object.userData?.annotationId) {
      const annotationId = intersection.object.userData.annotationId
      removeAnnotation(annotationId)
      console.log('🗑️ Removed annotation via right-click:', annotationId)
    }
  }, [enabled, canvasElement, camera, scene, removeAnnotation])

  // Handle marker selection
  const handleMarkerClick = useCallback((annotation: Annotation) => {
    setSelectedAnnotation(
      selectedAnnotationId === annotation.id ? undefined : annotation.id
    )
    console.log('👆 Selected annotation:', annotation.id)
  }, [selectedAnnotationId, setSelectedAnnotation])

  // Attach event listeners to canvas
  React.useEffect(() => {
    if (!canvasElement || !enabled) return

    // Add event listeners
    canvasElement.addEventListener('click', handleCanvasClick)
    canvasElement.addEventListener('contextmenu', handleCanvasRightClick)

    return () => {
      canvasElement.removeEventListener('click', handleCanvasClick)
      canvasElement.removeEventListener('contextmenu', handleCanvasRightClick)
    }
  }, [canvasElement, enabled, handleCanvasClick, handleCanvasRightClick])

  return (
    <AnnotationMarkers
      annotations={annotations}
      selectedAnnotationId={selectedAnnotationId}
      camera={camera}
      scene={scene}
      onMarkerClick={handleMarkerClick}
    />
  )
}

// Export the context hook for external use
export { useAnnotationContext }