/**
 * Annotation Markers Component
 * 
 * Renders 3D markers for annotations in the Three.js scene.
 * Each marker is a colored sphere positioned at the annotation's 3D coordinates.
 */

import React, { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { Annotation } from '../../types/annotations'

interface AnnotationMarkersProps {
  annotations: Annotation[]
  selectedAnnotationId?: string
  camera: THREE.Camera
  scene: THREE.Scene
  onMarkerClick?: (annotation: Annotation) => void
}

export const AnnotationMarkers: React.FC<AnnotationMarkersProps> = ({
  annotations,
  selectedAnnotationId,
  camera,
  scene,
  onMarkerClick
}) => {
  const markersGroupRef = useRef<THREE.Group>()
  const markerMeshes = useRef<Map<string, THREE.Mesh>>(new Map())

  // Create marker geometry (reused for all markers)
  const markerGeometry = useMemo(() => {
    return new THREE.SphereGeometry(0.5, 16, 16)
  }, [])

  // Update markers when annotations change
  useEffect(() => {
    if (!markersGroupRef.current) {
      // Create markers group and add to scene
      const group = new THREE.Group()
      group.name = 'annotation-markers'
      scene.add(group)
      markersGroupRef.current = group
    }

    const group = markersGroupRef.current
    const currentMeshes = markerMeshes.current

    // Remove markers that no longer exist
    const annotationIds = new Set(annotations.map(ann => ann.id))
    currentMeshes.forEach((mesh, id) => {
      if (!annotationIds.has(id)) {
        group.remove(mesh)
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
        currentMeshes.delete(id)
      }
    })

    // Add or update markers
    annotations.forEach(annotation => {
      let mesh = currentMeshes.get(annotation.id)
      
      if (!mesh) {
        // Create new marker
        const material = new THREE.MeshBasicMaterial({ 
          color: annotation.color,
          transparent: true,
          opacity: 0.8
        })
        
        mesh = new THREE.Mesh(markerGeometry, material)
        mesh.name = `annotation-marker-${annotation.id}`
        mesh.userData = { annotationId: annotation.id }
        
        group.add(mesh)
        currentMeshes.set(annotation.id, mesh)
      }

      // Update marker position
      mesh.position.copy(annotation.position)
      
      // Update marker appearance
      const material = mesh.material as THREE.MeshBasicMaterial
      material.color.setHex(parseInt(annotation.color.replace('#', ''), 16))
      
      // Highlight selected marker
      if (annotation.id === selectedAnnotationId) {
        material.opacity = 1.0
        mesh.scale.setScalar(1.3)
      } else {
        material.opacity = 0.8
        mesh.scale.setScalar(1.0)
      }

      // Scale marker based on distance to camera for consistent visual size
      const distance = camera.position.distanceTo(annotation.position)
      const baseScale = annotation.id === selectedAnnotationId ? 1.3 : 1.0
      const scaleFactor = Math.max(0.5, Math.min(3.0, distance * 0.01))
      mesh.scale.setScalar(baseScale * scaleFactor)
    })

  }, [annotations, selectedAnnotationId, camera, scene, markerGeometry])

  // Handle marker clicks via raycasting (setup in parent component)
  useEffect(() => {
    const handleMarkerInteraction = (event: CustomEvent) => {
      const { annotationId } = event.detail
      const annotation = annotations.find(ann => ann.id === annotationId)
      if (annotation && onMarkerClick) {
        onMarkerClick(annotation)
      }
    }

    window.addEventListener('annotation-marker-click', handleMarkerInteraction as EventListener)
    
    return () => {
      window.removeEventListener('annotation-marker-click', handleMarkerInteraction as EventListener)
    }
  }, [annotations, onMarkerClick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markersGroupRef.current) {
        scene.remove(markersGroupRef.current)
        
        // Dispose of all meshes
        markerMeshes.current.forEach(mesh => {
          mesh.geometry.dispose()
          if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose()
          }
        })
        markerMeshes.current.clear()
      }
    }
  }, [scene])

  // This component doesn't render JSX - it manages Three.js objects directly
  return null
}