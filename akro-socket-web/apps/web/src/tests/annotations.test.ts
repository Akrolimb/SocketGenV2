/**
 * Annotation System Tests
 * 
 * Basic tests to verify the annotation system functionality
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnnotations } from '../hooks/useAnnotations'
import { AnnotationType } from '../types/annotations'
import * as THREE from 'three'

// Mock Three.js Vector3
vi.mock('three', () => ({
  Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x, y, z,
    clone: vi.fn().mockReturnValue({ x, y, z })
  }))
}))

describe('Annotation System', () => {
  describe('useAnnotations hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAnnotations())
      
      expect(result.current.annotations).toEqual([])
      expect(result.current.activeAnnotationType).toBe(AnnotationType.PRESSURE_POINT)
      expect(result.current.isAnnotationMode).toBe(false)
      expect(result.current.annotationCount).toBe(0)
      expect(result.current.selectedAnnotationId).toBeUndefined()
    })

    it('should toggle annotation mode', () => {
      const { result } = renderHook(() => useAnnotations())
      
      act(() => {
        result.current.toggleAnnotationMode()
      })
      
      expect(result.current.isAnnotationMode).toBe(true)
      
      act(() => {
        result.current.toggleAnnotationMode()
      })
      
      expect(result.current.isAnnotationMode).toBe(false)
    })

    it('should change active annotation type', () => {
      const { result } = renderHook(() => useAnnotations())
      
      act(() => {
        result.current.setActiveAnnotationType(AnnotationType.RELIEF_AREA)
      })
      
      expect(result.current.activeAnnotationType).toBe(AnnotationType.RELIEF_AREA)
    })

    it('should add annotation at specified position', () => {
      const { result } = renderHook(() => useAnnotations())
      const position = new THREE.Vector3(10, 20, 30)
      
      act(() => {
        result.current.addAnnotation(position)
      })
      
      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotationCount).toBe(1)
      
      const annotation = result.current.annotations[0]
      expect(annotation.position.x).toBe(position.x)
      expect(annotation.position.y).toBe(position.y)
      expect(annotation.position.z).toBe(position.z)
      expect(annotation.type).toBe(AnnotationType.PRESSURE_POINT)
      expect(annotation.label).toBe('Pressure Point 1')
      expect(annotation.color).toBe('#ff4d4f')
      expect(annotation.id).toBeDefined()
      expect(annotation.timestamp).toBeInstanceOf(Date)
    })

    it('should remove annotation by id', () => {
      const { result } = renderHook(() => useAnnotations())
      const position = new THREE.Vector3(10, 20, 30)
      
      let annotationId: string
      
      act(() => {
        const annotation = result.current.addAnnotation(position)
        annotationId = annotation.id
      })
      
      expect(result.current.annotations).toHaveLength(1)
      
      act(() => {
        result.current.removeAnnotation(annotationId)
      })
      
      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.annotationCount).toBe(0)
    })

    it('should clear all annotations', () => {
      const { result } = renderHook(() => useAnnotations())
      
      act(() => {
        result.current.addAnnotation(new THREE.Vector3(1, 2, 3))
        result.current.addAnnotation(new THREE.Vector3(4, 5, 6))
        result.current.addAnnotation(new THREE.Vector3(7, 8, 9))
      })
      
      expect(result.current.annotations).toHaveLength(3)
      
      act(() => {
        result.current.clearAllAnnotations()
      })
      
      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.annotationCount).toBe(0)
    })

    it('should get annotations by type', () => {
      const { result } = renderHook(() => useAnnotations())
      
      act(() => {
        result.current.addAnnotation(new THREE.Vector3(1, 2, 3), AnnotationType.PRESSURE_POINT)
        result.current.addAnnotation(new THREE.Vector3(4, 5, 6), AnnotationType.RELIEF_AREA)
        result.current.addAnnotation(new THREE.Vector3(7, 8, 9), AnnotationType.PRESSURE_POINT)
      })
      
      const pressurePoints = result.current.getAnnotationsByType(AnnotationType.PRESSURE_POINT)
      const reliefAreas = result.current.getAnnotationsByType(AnnotationType.RELIEF_AREA)
      
      expect(pressurePoints).toHaveLength(2)
      expect(reliefAreas).toHaveLength(1)
      expect(pressurePoints.every(ann => ann.type === AnnotationType.PRESSURE_POINT)).toBe(true)
      expect(reliefAreas.every(ann => ann.type === AnnotationType.RELIEF_AREA)).toBe(true)
    })

    it('should select and deselect annotations', () => {
      const { result } = renderHook(() => useAnnotations())
      const position = new THREE.Vector3(10, 20, 30)
      
      let annotationId: string = ''
      
      act(() => {
        const annotation = result.current.addAnnotation(position)
        annotationId = annotation.id
      })
      
      act(() => {
        result.current.setSelectedAnnotation(annotationId)
      })
      
      expect(result.current.selectedAnnotationId).toBe(annotationId)
      expect(result.current.selectedAnnotation).toBeDefined()
      expect(result.current.selectedAnnotation?.id).toBe(annotationId)
      
      act(() => {
        result.current.setSelectedAnnotation(undefined)
      })
      
      expect(result.current.selectedAnnotationId).toBeUndefined()
      expect(result.current.selectedAnnotation).toBeUndefined()
    })
  })
})