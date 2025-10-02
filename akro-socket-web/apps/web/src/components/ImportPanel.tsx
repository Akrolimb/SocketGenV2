import React, { useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { useCaseStore } from '../hooks/useCaseStore'
import { loadMeshFromFiles, validateMeshFiles } from '../utils/gltf'
import { estimateUnitsFromSize } from '../utils/units'
import { buildBVH, getMeshStats } from '../geom/bvh'
import type { Units, CaseMeta } from '../types'

interface ImportPanelProps {
  onNext: () => void
}

/**
 * Import & Scale panel for loading limb meshes
 */
export const ImportPanel: React.FC<ImportPanelProps> = ({ onNext }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<Units>('mm')
  
  // Store state
  const setMeta = useCaseStore(state => state.setMeta)
  const setLimb = useCaseStore(state => state.setLimb)
  const meta = useCaseStore(state => state.meta)
  const limb = useCaseStore(state => state.limb)

  /**
   * Handle file selection from input or drag-drop
   */
  const handleFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return

    setLoading(true)
    setError(null)

    try {
      // Validate files
      const validation = validateMeshFiles(Array.from(files))
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Load mesh with initial scale  
      const result = await loadMeshFromFiles(Array.from(files), {
        downsample: 200000, // Always downsample for performance
        scale: 1.0 // Always load at 1.0 first, then apply scaling
      })

      // Get initial size for unit detection
      const initialSize = result.boundingBox.getSize(new THREE.Vector3())
      const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z)
      
      console.log('Initial mesh size after loading:', {
        size: initialSize.toArray(),
        maxDimension: maxDim,
        boundingBox: {
          min: result.boundingBox.min.toArray(),
          max: result.boundingBox.max.toArray()
        }
      })

      // Infer or estimate units
      let detectedUnits = result.units
      if (!detectedUnits) {
        detectedUnits = estimateUnitsFromSize([initialSize.x, initialSize.y, initialSize.z])
      }

      // Automatically scale to realistic prosthetic limb size
      // Convert current size to a common unit (cm) for comparison
      const sizeInCm = detectedUnits === 'mm' ? maxDim / 10 : 
                       detectedUnits === 'm' ? maxDim * 100 : 
                       maxDim; // already cm
      
      const targetSizeInCm = 40 // Target: 40cm prosthetic limb height
      const minSizeInCm = 20    // Minimum reasonable size
      const maxSizeInCm = 80    // Maximum reasonable size
      
      let autoScale = 1.0
      
      console.log(`Object size: ${maxDim.toFixed(2)} ${detectedUnits || 'units'} = ${sizeInCm.toFixed(1)}cm`)
      
      if (sizeInCm < minSizeInCm || sizeInCm > maxSizeInCm) {
        // Calculate scale to reach target size in current units
        const targetInCurrentUnits = detectedUnits === 'mm' ? targetSizeInCm * 10 : 
                                    detectedUnits === 'm' ? targetSizeInCm / 100 : 
                                    targetSizeInCm; // cm
        
        autoScale = targetInCurrentUnits / maxDim
        console.log(`Scaling from ${sizeInCm.toFixed(1)}cm to ${targetSizeInCm}cm (scale: ${autoScale.toFixed(3)})`)
      } else {
        console.log(`Object size ${sizeInCm.toFixed(1)}cm is within reasonable range (${minSizeInCm}-${maxSizeInCm}cm)`)
      }

      // Apply the calculated scale
      if (autoScale !== 1.0) {
        result.mesh.scale.setScalar(autoScale)
        result.mesh.updateMatrixWorld(true)
        
        // Recalculate bounding box after scaling
        result.boundingBox.setFromObject(result.mesh)
        
        const newSize = result.boundingBox.getSize(new THREE.Vector3())
        const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z)
        console.log('Size after auto-scaling:', {
          originalMax: maxDim,
          scale: autoScale,
          newSize: newSize.toArray(),
          newMaxDim: newMaxDim
        })
      }

      // Scale is applied directly to mesh, no need to track in state

      if (detectedUnits) {
        setUnits(detectedUnits) // Always auto-detect units
      }

      // Build BVH for fast operations
      const bvhMesh = buildBVH(result.mesh)
      const stats = getMeshStats(bvhMesh)

      // Create case metadata
      const caseMeta: CaseMeta = {
        name: files[0].name.replace(/\.[^/.]+$/, ''), // Remove extension
        units: detectedUnits || units,
        triCount: stats.triangleCount,
        bbox: {
          min: [stats.boundingBox.min.x, stats.boundingBox.min.y, stats.boundingBox.min.z],
          max: [stats.boundingBox.max.x, stats.boundingBox.max.y, stats.boundingBox.max.z]
        }
      }

      // Store in state
      setMeta(caseMeta)
      setLimb(bvhMesh)

      console.log('Mesh loaded successfully:', {
        triangles: stats.triangleCount,
        vertices: stats.vertexCount,
        boundingBox: stats.boundingBox,
        units: caseMeta.units,
        wasDecimated: result.wasDecimated
      })

    } catch (err) {
      console.error('Failed to load mesh:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [units, setMeta, setLimb])



  /**
   * Handle unit changes with proper scaling conversion
   */
  const handleUnitsChange = useCallback((newUnits: Units) => {
    console.log('handleUnitsChange called:', { oldUnits: units, newUnits })
    
    if (limb && meta && newUnits !== units) {
      // Get current object size
      const boundingBox = new THREE.Box3()
      boundingBox.setFromObject(limb)
      const currentSize = boundingBox.getSize(new THREE.Vector3())
      const currentMaxDim = Math.max(currentSize.x, currentSize.y, currentSize.z)
      
      console.log('Current object size before unit change:', {
        size: currentSize.toArray(),
        maxDim: currentMaxDim,
        currentScale: limb.scale.x
      })
      
      // Calculate conversion factor
      const conversions = {
        'mm': 1,
        'cm': 10,
        'm': 1000
      }
      
      const oldFactor = conversions[units]
      const newFactor = conversions[newUnits]
      const conversionScale = oldFactor / newFactor
      
      console.log('Unit conversion calculation:', { 
        oldUnits: units, 
        newUnits, 
        oldFactor, 
        newFactor, 
        conversionScale 
      })
      
      // Apply conversion scaling
      const currentScale = limb.scale.x // Assuming uniform scaling
      const newScale = currentScale * conversionScale
      
      limb.scale.setScalar(newScale)
      limb.updateMatrixWorld(true)
      
      // Scale is applied directly to mesh
      
      // Update bounding box
      boundingBox.setFromObject(limb)
      const newSize = boundingBox.getSize(new THREE.Vector3())
      
      // Update metadata
      const updatedMeta: CaseMeta = {
        ...meta,
        units: newUnits,
        bbox: {
          min: [boundingBox.min.x, boundingBox.min.y, boundingBox.min.z],
          max: [boundingBox.max.x, boundingBox.max.y, boundingBox.max.z]
        }
      }
      
      setMeta(updatedMeta)
      
      console.log('Unit conversion applied:', { 
        newScale, 
        newSize: newSize.toArray(), 
        newMaxDim: Math.max(newSize.x, newSize.y, newSize.z)
      })
    }
    
    setUnits(newUnits)
  }, [units, limb, meta, setMeta])

  /**
   * Handle drag events
   */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  /**
   * Handle file input change
   */
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  /**
   * Open file browser
   */
  const openFileBrowser = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Format bounding box for display
   */
  const formatBoundingBox = useCallback((bbox: { min: number[], max: number[] }, units: Units) => {
    const size = [
      bbox.max[0] - bbox.min[0],
      bbox.max[1] - bbox.min[1], 
      bbox.max[2] - bbox.min[2]
    ]
    return `${size[0].toFixed(1)} × ${size[1].toFixed(1)} × ${size[2].toFixed(1)} ${units}`
  }, [])

  return (
    <div className="import-panel">
      <h3>Import & Scale</h3>
      
      {/* File drop zone */}
      <div 
        className={`drop-zone ${dragActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading mesh...</p>
          </div>
        ) : (
          <>
            <div className="drop-icon">📁</div>
            <p>Drag & drop your GLB, GLTF, or OBJ files here</p>
            <button 
              type="button" 
              className="browse-button"
              onClick={openFileBrowser}
              disabled={loading}
            >
              Or click to browse
            </button>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".glb,.gltf,.obj,.mtl"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {/* Error display */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Model info and controls */}
      {meta && (
        <div className="model-summary">
          <div className="model-name">{meta.name}</div>
          <div className="model-details">
            {formatBoundingBox(meta.bbox, meta.units)} • {meta.triCount.toLocaleString()} triangles
          </div>
          
          <div className="units-control">
            <label>
              Units:
              <select 
                value={units} 
                onChange={(e) => handleUnitsChange(e.target.value as Units)}
                disabled={loading}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Next button */}
      <button 
        className="next-button" 
        onClick={onNext}
        disabled={!limb || loading}
      >
        Next: Auto-Detect Markings →
      </button>
    </div>
  )
}

export default ImportPanel