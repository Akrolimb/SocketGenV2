/**
 * Annotation Context Provider
 * 
 * Provides shared annotation state across components to ensure
 * AnnotationManager and AnnotationPanel use the same state.
 */

import React, { createContext, useContext } from 'react'
import { useAnnotations } from '../hooks/useAnnotations'

type AnnotationContextType = ReturnType<typeof useAnnotations>

const AnnotationContext = createContext<AnnotationContextType | null>(null)

export const AnnotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const annotationState = useAnnotations()
  
  return (
    <AnnotationContext.Provider value={annotationState}>
      {children}
    </AnnotationContext.Provider>
  )
}

export const useAnnotationContext = (): AnnotationContextType => {
  const context = useContext(AnnotationContext)
  if (!context) {
    throw new Error('useAnnotationContext must be used within an AnnotationProvider')
  }
  return context
}