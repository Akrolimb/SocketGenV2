import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { MaterialAnalysis, ColorEntry } from '../utils/materials'
import { analyzeMaterials, findDominantColors } from '../utils/materials'
import { ColorHighlightController, type HighlightStats } from '../utils/colorHighlight'
import { useCaseStore } from '../hooks/useCaseStore'

interface ColorAnalysisPanelProps {
  className?: string
}

export const ColorAnalysisPanel: React.FC<ColorAnalysisPanelProps> = ({ 
  className = '' 
}) => {
  const { limb: mesh } = useCaseStore()
  const [materials, setMaterials] = useState<MaterialAnalysis[]>([])
  const [colorPalettes, setColorPalettes] = useState<Map<string, ColorEntry[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [_hoveredColor, setHoveredColor] = useState<ColorEntry | null>(null)
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set())
  const [highlightStats, setHighlightStats] = useState<HighlightStats | null>(null)
  const [isHighlighting, setIsHighlighting] = useState(false)
  
  // Advanced highlighting controller
  const highlightControllerRef = useRef<ColorHighlightController | null>(null)
  
  // Combined effect: analyze materials FIRST, then setup highlighting
  useEffect(() => {
    if (!mesh) {
      setMaterials([])
      setColorPalettes(new Map())
      highlightControllerRef.current?.cleanup()
      highlightControllerRef.current = null
      return
    }

    console.log('🎨 Analyzing mesh materials and colors...', mesh)
    setLoading(true)

    // STEP 1: Analyze the ORIGINAL materials FIRST (before highlighting changes them)
    console.log('� Step 1: Analyzing original materials')
    const materialAnalysis = analyzeMaterials(mesh)
    console.log('📊 Material analysis result:', materialAnalysis)
    setMaterials(materialAnalysis)

    // Extract color palettes for each material
    const palettePromises = materialAnalysis.map(async (mat) => {
      try {
        console.log('🔍 Processing material:', mat.name, 'hasTexture:', mat.hasTexture)
        const colors = await findDominantColors(mesh.material as THREE.Material)
        console.log('🎨 Found colors for', mat.name, ':', colors)
        return { id: mat.id, colors }
      } catch (error) {
        console.warn(`Failed to extract colors for material ${mat.name}:`, error)
        return { id: mat.id, colors: [] }
      }
    })

    Promise.all(palettePromises)
      .then(results => {
        const paletteMap = new Map()
        results.forEach(({ id, colors }) => {
          paletteMap.set(id, colors)
        })
        console.log('🎨 Final color palette map:', paletteMap)
        setColorPalettes(paletteMap)
        
        // STEP 2: Now setup highlighting AFTER color analysis is complete
        console.log('🎯 Step 2: Setting up highlighting controller')
        highlightControllerRef.current = new ColorHighlightController()
        
        // STEP 2: Now setup highlighting on the original mesh (Canvas3D no longer clones)
        console.log('🎯 Setting up highlighting controller on original mesh')
        const success = highlightControllerRef.current.setupMeshHighlighting(mesh)
        if (!success) {
          console.warn('Failed to setup mesh highlighting')
        } else {
          console.log('✅ Highlighting setup complete - ready for interactive highlighting')
        }
      })
      .catch(error => {
        console.error('❌ Error in material analysis:', error)
      })
      .finally(() => setLoading(false))
      
    return () => {
      highlightControllerRef.current?.cleanup()
    }
  }, [mesh])

  // Handle color hover - advanced highlighting with texture analysis
  const handleColorHover = async (color: ColorEntry | null) => {
    console.log('🖱️ Color hover event:', color ? `#${color.color.getHexString()}` : 'null')
    
    if (!mesh || !highlightControllerRef.current) {
      console.warn('⚠️ Missing dependencies for highlighting:', { 
        mesh: !!mesh, 
        controller: !!highlightControllerRef.current,
        meshMaterial: mesh?.material,
        materialType: mesh?.material?.type
      })
      return
    }
    
    console.log('🔍 Mesh material debug:', {
      materialType: mesh.material?.type,
      isArray: Array.isArray(mesh.material),
      hasUniforms: mesh.material && 'uniforms' in mesh.material,
      uniformKeys: mesh.material && 'uniforms' in mesh.material ? Object.keys(mesh.material.uniforms) : 'none'
    })
    
    setHoveredColor(color)
    
    if (color) {
      // Start highlighting
      setIsHighlighting(true)
      try {
        console.log('🎨 Starting color highlighting:', `#${color.color.getHexString()}`, 'HSV:', color.hsv)
        console.log('🎯 About to call highlightColor on controller')
        
        // Verify mesh material is our shader
        console.log('🔍 Current mesh material before highlighting:', {
          type: mesh.material?.type,
          isShaderMaterial: mesh.material?.type === 'ShaderMaterial',
          hasUniforms: mesh.material && 'uniforms' in mesh.material,
          enableHighlight: mesh.material && 'uniforms' in mesh.material ? (mesh.material as any).uniforms.enableHighlight?.value : 'n/a'
        })
        
        highlightControllerRef.current.highlightColor(color.hsv)
        
        // Verify after highlighting call
        setTimeout(() => {
          console.log('🔍 Current mesh material after highlighting:', {
            type: mesh.material?.type,
            isShaderMaterial: mesh.material?.type === 'ShaderMaterial',
            enableHighlight: mesh.material && 'uniforms' in mesh.material ? (mesh.material as any).uniforms.enableHighlight?.value : 'n/a'
          })
        }, 100)
        setHighlightStats({ 
          matchingPixels: 0, 
          coverage: 0, 
          boundingBox: { min: [0, 0], max: [1, 1] } 
        })
        console.log('✅ Color highlighting command sent')
      } catch (error) {
        console.warn('❌ Highlighting failed:', error)
        setHighlightStats(null)
      } finally {
        setIsHighlighting(false)
      }
    } else {
      // Clear highlighting
      console.log('🧹 Clearing highlight')
      highlightControllerRef.current.clearHighlights()
      setHighlightStats(null)
      setIsHighlighting(false)
    }
  }

  // Handle color selection
  const handleColorSelect = (color: ColorEntry) => {
    const colorKey = color.color.getHexString()
    const newSelected = new Set(selectedColors)
    
    if (selectedColors.has(colorKey)) {
      newSelected.delete(colorKey)
    } else {
      newSelected.add(colorKey)
    }
    
    setSelectedColors(newSelected)
    console.log('🎯 Selected colors:', Array.from(newSelected))
  }

  if (!mesh) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        <p>Load a mesh file to analyze materials and colors</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material & Color Analysis</h3>
        <div className="flex items-center space-x-2">
          {loading && (
            <div className="text-sm text-blue-600">Analyzing colors...</div>
          )}
          {isHighlighting && (
            <div className="text-sm text-purple-600 animate-pulse">Highlighting...</div>
          )}
          {highlightStats && (
            <div className="text-xs text-green-600">
              {highlightStats.matchingPixels} pixels ({(highlightStats.coverage * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">No materials found in the mesh</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
            💡 <strong>Advanced Color Highlighting:</strong> Hover over any color to see it highlighted on the 3D model using texture analysis
          </div>
          
          {materials.map((material, index) => (
            <MaterialCard
              key={material.id}
              material={material}
              index={index}
              colors={colorPalettes.get(material.id) || []}
              selectedColors={selectedColors}
              onColorHover={handleColorHover}
              onColorSelect={handleColorSelect}
            />
          ))}
        </div>
      )}

      {selectedColors.size > 0 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">
            Selected Colors ({selectedColors.size})
          </h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedColors).map((colorKey) => (
              <div
                key={colorKey}
                className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-green-300"
              >
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: `#${colorKey}` }}
                />
                <span className="text-xs text-green-800">#{colorKey}</span>
                <button
                  onClick={() => {
                    const newSelected = new Set(selectedColors)
                    newSelected.delete(colorKey)
                    setSelectedColors(newSelected)
                  }}
                  className="text-green-600 hover:text-green-800 text-xs ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Hover</strong> over colors to highlight regions on the mesh</li>
          <li>• <strong>Click</strong> colors to select them for marking detection</li>
          <li>• Selected colors will be used to automatically detect markings</li>
          <li>• Multiple colors can be selected for complex marking patterns</li>
        </ul>
      </div>
    </div>
  )
}

interface MaterialCardProps {
  material: MaterialAnalysis
  index: number
  colors: ColorEntry[]
  selectedColors: Set<string>
  onColorHover: (color: ColorEntry | null) => void
  onColorSelect: (color: ColorEntry) => void
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material, index, colors, selectedColors, onColorHover, onColorSelect }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">
          Material {index + 1}: {material.name}
        </h4>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
          {material.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Base Color</label>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-6 h-6 rounded border border-gray-300"
              style={{ backgroundColor: `#${material.color.getHexString()}` }}
            />
            <span className="text-sm text-gray-600">
              #{material.color.getHexString()}
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Properties</label>
          <div className="text-xs text-gray-600 mt-1">
            {material.hasTexture && (
              <div>
                Texture: {material.textureInfo?.width}×{material.textureInfo?.height}
              </div>
            )}
            {material.properties.roughness !== undefined && (
              <div>Roughness: {material.properties.roughness}</div>
            )}
            {material.properties.metalness !== undefined && (
              <div>Metalness: {material.properties.metalness}</div>
            )}
          </div>
        </div>
      </div>

      {colors.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Color Palette ({colors.length} colors)
          </label>
          <div className="grid grid-cols-6 gap-3 mb-4">
            {colors.slice(0, 12).map((color, i) => {
              const colorKey = color.color.getHexString()
              const isSelected = selectedColors.has(colorKey)
              
              return (
                <div
                  key={i}
                  className="group relative cursor-pointer flex flex-col items-center"
                  title={`#${colorKey} (${color.percentage.toFixed(1)}%) - Hover to highlight, click to select`}
                  onMouseEnter={() => onColorHover(color)}
                  onMouseLeave={() => onColorHover(null)}
                  onClick={() => onColorSelect(color)}
                >
                  <div
                    className={`w-10 h-10 rounded border-2 hover:scale-110 transition-all duration-200 ${
                      isSelected 
                        ? 'border-green-500 shadow-lg shadow-green-200' 
                        : 'border-gray-300 hover:border-blue-500'
                    }`}
                    style={{ backgroundColor: `#${colorKey}` }}
                  />
                  <div className="text-xs text-gray-600 mt-1 font-medium">
                    {color.percentage.toFixed(1)}%
                  </div>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white">
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {colors.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No texture colors available - using base material color
        </div>
      )}
    </div>
  )
}