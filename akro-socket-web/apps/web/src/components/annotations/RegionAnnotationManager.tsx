/**
 * Region Annotation Manager
 * 
 * Manages region-based annotations that can be painted on mesh surfaces
 * for prosthetic design applications.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AnnotationRaycaster } from '../../utils/raycasting'
import { useAnnotationContext } from '../../contexts/AnnotationContext'
import { DEFAULT_ANNOTATION_CONFIG } from '../../types/annotations'
import { paintMeshRegion, PaintStroke } from '../../utils/meshPainting'
import { findClosedRegions, createFilledRegion } from '../../utils/regionFilling'

interface RegionAnnotationManagerProps {
  camera: THREE.Camera
  scene: THREE.Scene
  meshes: THREE.Object3D[]
  canvasElement: HTMLCanvasElement | null
  enabled: boolean
  controls?: OrbitControls // OrbitControls reference
}

export const RegionAnnotationManager: React.FC<RegionAnnotationManagerProps> = ({
  camera,
  scene,
  meshes,
  canvasElement,
  enabled,
  controls
}) => {
  const raycasterRef = useRef<AnnotationRaycaster>()
  const overlayGroupRef = useRef<THREE.Group>()
  const [isPainting, setIsPainting] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<PaintStroke | null>(null)
  const [lastPaintPosition, setLastPaintPosition] = useState<THREE.Vector3 | null>(null)
  const [brushSize, setBrushSize] = useState(0.05) // Start with very small default

  const {
    isAnnotationMode,
    activeAnnotationType,
    annotations,
    addAnnotation
  } = useAnnotationContext()

  // Update brush size when annotation type changes
  useEffect(() => {
    const config = DEFAULT_ANNOTATION_CONFIG[activeAnnotationType]
    setBrushSize(config.defaultBrushSize)
  }, [activeAnnotationType])

  // Initialize raycaster and overlay group
  useEffect(() => {
    if (!raycasterRef.current) {
      raycasterRef.current = new AnnotationRaycaster()
    }

    if (!overlayGroupRef.current) {
      const group = new THREE.Group()
      group.name = 'annotation-overlays'
      scene.add(group)
      overlayGroupRef.current = group
    }

    return () => {
      if (overlayGroupRef.current) {
        scene.remove(overlayGroupRef.current)
        overlayGroupRef.current = undefined
      }
    }
  }, [scene])

  // Handle mouse events for painting
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!enabled || !isAnnotationMode || !canvasElement || !raycasterRef.current) {
      return
    }

    // Disable orbit controls during painting to prevent camera movement
    if (controls) {
      controls.enabled = false
    }

    console.log('🎨 Starting paint stroke', {
      enabled,
      isAnnotationMode,
      activeAnnotationType,
      brushSize
    })

    const rect = canvasElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const intersection = raycasterRef.current.getIntersection(mouse.x, mouse.y, camera, meshes)
    if (intersection) {
      setIsPainting(true)
      setLastPaintPosition(intersection.point.clone())
      
      // Start a new paint stroke
      const config = DEFAULT_ANNOTATION_CONFIG[activeAnnotationType]
      const newStroke: PaintStroke = {
        points: [intersection.point.clone()],
        brushSize,
        color: config.color,
        opacity: config.opacity
      }
      setCurrentStroke(newStroke)

      // Paint initial point
      paintAtPosition(intersection.point, intersection.object as THREE.Mesh, intersection.normal)
      
      console.log('🎨 Started stroke at', intersection.point)
    }
  }, [enabled, isAnnotationMode, activeAnnotationType, brushSize, canvasElement, meshes, camera, controls])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isPainting || !enabled || !isAnnotationMode || !canvasElement || !raycasterRef.current || !currentStroke) {
      return
    }

    const rect = canvasElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const intersection = raycasterRef.current.getIntersection(mouse.x, mouse.y, camera, meshes)
    if (intersection && lastPaintPosition) {
      const distance = intersection.point.distanceTo(lastPaintPosition)
      
      // Only paint if mouse moved enough (prevents over-painting)
      if (distance > brushSize * 0.1) {
        paintAtPosition(intersection.point, intersection.object as THREE.Mesh, intersection.normal)
        setLastPaintPosition(intersection.point.clone())
        
        // Add point to current stroke
        const updatedStroke = {
          ...currentStroke,
          points: [...currentStroke.points, intersection.point.clone()]
        }
        setCurrentStroke(updatedStroke)
      }
    }
  }, [isPainting, enabled, isAnnotationMode, currentStroke, lastPaintPosition, brushSize, canvasElement, meshes, camera])

  const handleMouseUp = useCallback(() => {
    if (isPainting && currentStroke) {
      console.log('🎨 Finishing paint stroke', {
        pointCount: currentStroke.points.length,
        type: activeAnnotationType
      })

      // Create annotation from the stroke
      const annotation = {
        id: `annotation-${Date.now()}`,
        type: activeAnnotationType,
        label: `${DEFAULT_ANNOTATION_CONFIG[activeAnnotationType].label} ${annotations.length + 1}`,
        notes: `Painted region with ${currentStroke.points.length} points`,
        timestamp: new Date(),
        color: currentStroke.color,
        opacity: currentStroke.opacity,
        points: currentStroke.points,
        brushSize: currentStroke.brushSize
      }

      // Check for closed regions and fill them
      const closedRegions = findClosedRegions(currentStroke.points, brushSize * 2)
      
      if (closedRegions.length > 0 && overlayGroupRef.current) {
        console.log('🎯 Found closed region, creating fill', closedRegions[0])
        
        // Create filled region for the largest closed area
        const region = closedRegions[0]
        const config = DEFAULT_ANNOTATION_CONFIG[activeAnnotationType]
        
        // Create surface normal (simplified - could be improved)
        const normal = new THREE.Vector3(0, 1, 0) // Default up vector
        
        const fillGeometry = createFilledRegion(region, normal, config.color, config.opacity * 0.5)
        const fillMaterial = new THREE.MeshLambertMaterial({
          color: config.color,
          transparent: true,
          opacity: config.opacity * 0.3, // More transparent for fill
          side: THREE.DoubleSide,
          depthWrite: false
        })
        
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial)
        fillMesh.name = `region-fill-${Date.now()}`
        overlayGroupRef.current.add(fillMesh)
      }

      // Add to context (this will update the annotations list)
      // Note: We'll need to update the context to handle region annotations
      // For now, we'll create a point annotation from the first point
      addAnnotation(
        currentStroke.points[0],
        activeAnnotationType,
        annotation.label
      )
    }

    // Re-enable orbit controls after painting
    if (controls) {
      controls.enabled = true
    }

    setIsPainting(false)
    setCurrentStroke(null)
    setLastPaintPosition(null)
  }, [isPainting, currentStroke, activeAnnotationType, annotations.length, addAnnotation, controls, brushSize])

  // Paint at a specific position on the mesh
  const paintAtPosition = useCallback((position: THREE.Vector3, mesh: THREE.Mesh, normal?: THREE.Vector3) => {
    if (!overlayGroupRef.current) return

    const config = DEFAULT_ANNOTATION_CONFIG[activeAnnotationType]
    const paintResult = paintMeshRegion(mesh, position, brushSize, config.color, config.opacity, normal)
    
    if (paintResult) {
      // Create overlay mesh - no need to copy transforms since we use world coordinates
      const overlayMesh = new THREE.Mesh(paintResult.overlayGeometry, paintResult.material)
      overlayMesh.name = `paint-overlay-${Date.now()}`
      
      overlayGroupRef.current.add(overlayMesh)
    }
  }, [activeAnnotationType, brushSize])

  // Add event listeners
  useEffect(() => {
    if (!canvasElement) return

    canvasElement.addEventListener('mousedown', handleMouseDown)
    canvasElement.addEventListener('mousemove', handleMouseMove)
    canvasElement.addEventListener('mouseup', handleMouseUp)
    canvasElement.addEventListener('mouseleave', handleMouseUp) // Stop painting when leaving canvas

    return () => {
      canvasElement.removeEventListener('mousedown', handleMouseDown)
      canvasElement.removeEventListener('mousemove', handleMouseMove)
      canvasElement.removeEventListener('mouseup', handleMouseUp)
      canvasElement.removeEventListener('mouseleave', handleMouseUp)
    }
  }, [canvasElement, handleMouseDown, handleMouseMove, handleMouseUp])

  // Brush size controls (could be moved to UI component)
  const increaseBrushSize = useCallback(() => {
    setBrushSize(prev => Math.min(0.2, prev + 0.01)) // Very small max and increment
  }, [])

  const decreaseBrushSize = useCallback(() => {
    setBrushSize(prev => Math.max(0.01, prev - 0.01)) // Very small min and decrement
  }, [])

  // Keyboard shortcuts for brush size
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isAnnotationMode) return

      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        increaseBrushSize()
      } else if (event.key === '-') {
        event.preventDefault()
        decreaseBrushSize()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnnotationMode, increaseBrushSize, decreaseBrushSize])

  return null // This component doesn't render JSX
}