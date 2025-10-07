/**
 * Annotation Store Hook
 * 
 * Manages the state for the annotation system including:
 * - Annotation data storage
 * - Active annotation type selection
 * - Annotation mode toggle
 * - CRUD operations for annotations
 */

import { useState, useCallback } from 'react'
import * as THREE from 'three'
import { 
  Annotation, 
  AnnotationType, 
  AnnotationStore, 
  DEFAULT_ANNOTATION_CONFIG 
} from '../types/annotations'

export function useAnnotations() {
  const [store, setStore] = useState<AnnotationStore>({
    annotations: [],
    activeAnnotationType: AnnotationType.PRESSURE_POINT,
    isAnnotationMode: false,
    selectedAnnotationId: undefined
  })

  const addAnnotation = useCallback((
    position: THREE.Vector3,
    type?: AnnotationType,
    label?: string
  ) => {
    const annotationType = type || store.activeAnnotationType
    const config = DEFAULT_ANNOTATION_CONFIG[annotationType]
    
    const newAnnotation: Annotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: position.clone(),
      type: annotationType,
      label: label || `${config.label} ${store.annotations.length + 1}`,
      timestamp: new Date(),
      color: config.color,
      notes: undefined
    }

    setStore(prev => ({
      ...prev,
      annotations: [...prev.annotations, newAnnotation]
    }))

    console.log('🎯 Added annotation:', newAnnotation)
    return newAnnotation
  }, [store.activeAnnotationType, store.annotations.length])

  const removeAnnotation = useCallback((id: string) => {
    setStore(prev => ({
      ...prev,
      annotations: prev.annotations.filter(ann => ann.id !== id),
      selectedAnnotationId: prev.selectedAnnotationId === id ? undefined : prev.selectedAnnotationId
    }))
    console.log('🗑️ Removed annotation:', id)
  }, [])

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setStore(prev => ({
      ...prev,
      annotations: prev.annotations.map(ann => 
        ann.id === id ? { ...ann, ...updates } : ann
      )
    }))
    console.log('✏️ Updated annotation:', id, updates)
  }, [])

  const setActiveAnnotationType = useCallback((type: AnnotationType) => {
    setStore(prev => ({
      ...prev,
      activeAnnotationType: type
    }))
    console.log('🎨 Changed active annotation type:', type)
  }, [])

  const toggleAnnotationMode = useCallback(() => {
    setStore(prev => ({
      ...prev,
      isAnnotationMode: !prev.isAnnotationMode,
      selectedAnnotationId: undefined // Clear selection when toggling mode
    }))
    console.log('🔄 Toggled annotation mode:', !store.isAnnotationMode)
  }, [store.isAnnotationMode])

  const setSelectedAnnotation = useCallback((id?: string) => {
    setStore(prev => ({
      ...prev,
      selectedAnnotationId: id
    }))
  }, [])

  const clearAllAnnotations = useCallback(() => {
    setStore(prev => ({
      ...prev,
      annotations: [],
      selectedAnnotationId: undefined
    }))
    console.log('🧹 Cleared all annotations')
  }, [])

  const getAnnotationById = useCallback((id: string): Annotation | undefined => {
    return store.annotations.find(ann => ann.id === id)
  }, [store.annotations])

  const getAnnotationsByType = useCallback((type: AnnotationType): Annotation[] => {
    return store.annotations.filter(ann => ann.type === type)
  }, [store.annotations])

  return {
    // State
    annotations: store.annotations,
    activeAnnotationType: store.activeAnnotationType,
    isAnnotationMode: store.isAnnotationMode,
    selectedAnnotationId: store.selectedAnnotationId,
    
    // Actions
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    setActiveAnnotationType,
    toggleAnnotationMode,
    setSelectedAnnotation,
    clearAllAnnotations,
    
    // Getters
    getAnnotationById,
    getAnnotationsByType,
    
    // Computed
    annotationCount: store.annotations.length,
    selectedAnnotation: store.selectedAnnotationId 
      ? store.annotations.find(ann => ann.id === store.selectedAnnotationId)
      : undefined
  }
}