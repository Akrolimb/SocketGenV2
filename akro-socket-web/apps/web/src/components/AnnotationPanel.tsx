/**
 * Annotation Panel Component
 * 
 * Provides UI controls for the annotation system:
 * - Toggle annotation mode
 * - Select annotation types
 * - View and manage existing annotations
 * - Clear all annotations
 */

import React from 'react'
import { AnnotationType, DEFAULT_ANNOTATION_CONFIG } from '../types/annotations'
import { useAnnotationContext } from '../contexts/AnnotationContext'

interface AnnotationPanelProps {
  className?: string
}

export const AnnotationPanel: React.FC<AnnotationPanelProps> = ({ 
  className = '' 
}) => {
  const {
    annotations,
    activeAnnotationType,
    isAnnotationMode,
    selectedAnnotationId,
    setActiveAnnotationType,
    toggleAnnotationMode,
    removeAnnotation,
    clearAllAnnotations,
    annotationCount
  } = useAnnotationContext()

  const handleTypeChange = (type: AnnotationType) => {
    setActiveAnnotationType(type)
  }

  const handleDeleteAnnotation = (id: string) => {
    if (window.confirm('Delete this annotation?')) {
      removeAnnotation(id)
    }
  }

  const handleClearAll = () => {
    if (annotations.length > 0 && window.confirm(`Delete all ${annotations.length} annotations?`)) {
      clearAllAnnotations()
    }
  }

  return (
    <div className={`annotation-panel ${className}`} style={{
      background: 'white',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '16px', 
        fontWeight: 600,
        color: '#262626'
      }}>
        Prosthetic Annotations
      </h3>

      {/* Annotation Mode Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={toggleAnnotationMode}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            background: isAnnotationMode ? '#1890ff' : 'white',
            color: isAnnotationMode ? 'white' : '#262626',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          {isAnnotationMode ? '🎯 Annotation Mode ON' : '👆 Enable Annotation Mode'}
        </button>
        
        {isAnnotationMode && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#666',
            padding: '8px',
            background: '#f6f6f6',
            borderRadius: '4px'
          }}>
            💡 Click on the 3D model to add annotations. Right-click to remove.
          </div>
        )}
      </div>

      {/* Annotation Type Selector */}
      {isAnnotationMode && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 500, 
            color: '#666', 
            marginBottom: '8px' 
          }}>
            Select Annotation Type:
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.values(AnnotationType).map(type => {
              const config = DEFAULT_ANNOTATION_CONFIG[type]
              const isSelected = activeAnnotationType === type
              
              return (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${isSelected ? config.color : '#e8e8e8'}`,
                    borderRadius: '4px',
                    background: isSelected ? `${config.color}15` : 'white',
                    color: '#262626',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <div 
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: config.color,
                      flexShrink: 0
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: isSelected ? 500 : 400 }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', opacity: 0.8 }}>
                      {config.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Brush Controls */}
      {isAnnotationMode && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 500, 
            color: '#666', 
            marginBottom: '8px' 
          }}>
            Drawing Tools:
          </div>
          
          <div style={{ 
            padding: '12px',
            background: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e8e8e8'
          }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#666', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🖌️ Paint regions on the mesh surface
            </div>
            
            <div style={{ 
              fontSize: '11px', 
              color: '#666',
              lineHeight: '1.4'
            }}>
              • <strong>Click and drag</strong> to paint tiny, precise areas
              • <strong>+ / -</strong> keys to adjust brush size (0.01-0.2)
              • <strong>Draw a loop</strong> - return close to start point to auto-fill
              • <strong>Check console</strong> (F12) for fill detection status
              • Camera locked during painting (no interference)  
              • Annotations applied directly on mesh surface
            </div>
          </div>
        </div>
      )}

      {/* Annotation List */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px' 
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 500, 
            color: '#666'
          }}>
            Annotations ({annotationCount})
          </div>
          
          {annotationCount > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                padding: '4px 8px',
                border: '1px solid #ff4d4f',
                borderRadius: '4px',
                background: 'white',
                color: '#ff4d4f',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {annotationCount === 0 ? (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
            border: '1px dashed #d9d9d9',
            borderRadius: '4px',
            background: '#fafafa'
          }}>
            No annotations yet
            {!isAnnotationMode && (
              <div style={{ marginTop: '4px' }}>
                Enable annotation mode to get started
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: '4px'
          }}>
            {annotations.map(annotation => {
              const config = DEFAULT_ANNOTATION_CONFIG[annotation.type]
              const isSelected = selectedAnnotationId === annotation.id
              
              return (
                <div
                  key={annotation.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    background: isSelected ? '#f6f6f6' : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: config.color,
                        flexShrink: 0
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>
                        {annotation.label}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666' }}>
                        {config.label}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAnnotation(annotation.id)
                    }}
                    style={{
                      padding: '2px 6px',
                      border: 'none',
                      background: 'none',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '12px',
                      borderRadius: '2px'
                    }}
                    title="Delete annotation"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        fontSize: '11px',
        color: '#666',
        padding: '8px',
        background: '#f6f6f6',
        borderRadius: '4px',
        lineHeight: 1.4
      }}>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>Instructions:</div>
        <div>• Enable annotation mode to start</div>
        <div>• Click on 3D model to place markers</div>
        <div>• Right-click markers to remove them</div>
        <div>• Select annotation type before placing</div>
      </div>
    </div>
  )
}