import * as THREE from 'three'

/**
 * Material analysis result
 */
export interface MaterialAnalysis {
  id: string
  name: string
  type: string
  color: THREE.Color
  hasTexture: boolean
  textureInfo?: {
    width: number
    height: number
    format: string
    hasAlpha: boolean
  }
  properties: {
    roughness?: number
    metalness?: number
    opacity?: number
    transparent?: boolean
  }
}

/**
 * Color palette entry
 */
export interface ColorEntry {
  color: THREE.Color
  count: number
  percentage: number
  hsv: { h: number, s: number, v: number }
}

/**
 * Analyze materials in a mesh
 */
export function analyzeMaterials(mesh: THREE.Mesh): MaterialAnalysis[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  
  return materials.map((material, index) => {
    const analysis: MaterialAnalysis = {
      id: material.uuid,
      name: material.name || `Material_${index}`,
      type: material.type,
      color: new THREE.Color(0xffffff),
      hasTexture: false,
      properties: {}
    }
    
    // Extract color information
    if ('color' in material && material.color instanceof THREE.Color) {
      analysis.color = material.color.clone()
    }
    
    // Check for textures - support multiple material types
    let texture: THREE.Texture | null = null
    
    // Standard materials (MeshStandardMaterial, MeshBasicMaterial, etc.)
    if ('map' in material && material.map instanceof THREE.Texture) {
      texture = material.map
    }
    // Shader materials store textures in uniforms
    else if (material instanceof THREE.ShaderMaterial && material.uniforms) {
      // Common uniform names for textures
      const textureUniforms = ['map', 'diffuse', 'texture', 'baseTexture', 'tDiffuse']
      for (const uniformName of textureUniforms) {
        if (material.uniforms[uniformName]?.value instanceof THREE.Texture) {
          texture = material.uniforms[uniformName].value
          break
        }
      }
    }
    
    if (texture) {
      analysis.hasTexture = true
      analysis.textureInfo = {
        width: texture.image?.width || 0,
        height: texture.image?.height || 0,
        format: texture.format.toString(),
        hasAlpha: texture.format === THREE.RGBAFormat
      }
      console.log('🖼️ Found texture:', texture, 'Size:', analysis.textureInfo.width + 'x' + analysis.textureInfo.height)
    } else {
      console.log('❌ No texture found in material:', material.type, material)
    }
    
    // Extract material properties
    if (material instanceof THREE.MeshStandardMaterial) {
      analysis.properties.roughness = material.roughness
      analysis.properties.metalness = material.metalness
      analysis.properties.opacity = material.opacity
      analysis.properties.transparent = material.transparent
    } else if (material instanceof THREE.MeshPhongMaterial) {
      analysis.properties.opacity = material.opacity
      analysis.properties.transparent = material.transparent
    } else if (material instanceof THREE.MeshBasicMaterial) {
      analysis.properties.opacity = material.opacity
      analysis.properties.transparent = material.transparent
    }
    
    return analysis
  })
}

/**
 * Extract color palette from texture
 */
export function extractColorPalette(texture: THREE.Texture, maxColors: number = 16): Promise<ColorEntry[]> {
  return new Promise((resolve, reject) => {
    if (!texture.image) {
      reject(new Error('Texture has no image data'))
      return
    }
    
    // Create canvas to read pixel data
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Could not create canvas context'))
      return
    }
    
    const img = texture.image
    canvas.width = img.width
    canvas.height = img.height
    
    try {
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      
      // Sample pixels (every 16th pixel for performance)
      const colorMap = new Map<string, number>()
      const stride = 16
      
      for (let i = 0; i < pixels.length; i += stride * 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const a = pixels[i + 3]
        
        // Skip transparent pixels
        if (a < 128) continue
        
        // Quantize colors to reduce palette size
        const qr = Math.round(r / 32) * 32
        const qg = Math.round(g / 32) * 32
        const qb = Math.round(b / 32) * 32
        
        const colorKey = `${qr},${qg},${qb}`
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
      }
      
      // Convert to color entries and sort by frequency
      const totalPixels = Array.from(colorMap.values()).reduce((sum, count) => sum + count, 0)
      
      const colors = Array.from(colorMap.entries())
        .map(([colorKey, count]) => {
          const [r, g, b] = colorKey.split(',').map(Number)
          const color = new THREE.Color(r / 255, g / 255, b / 255)
          const hsv = rgbToHsv(r, g, b)
          
          return {
            color,
            count,
            percentage: (count / totalPixels) * 100,
            hsv
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, maxColors)
      
      resolve(colors)
    } catch (error) {
      reject(new Error(`Failed to extract color palette: ${error}`))
    }
  })
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  
  let h = 0
  let s = max === 0 ? 0 : diff / max
  let v = max
  
  if (diff !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / diff + 2) / 6
        break
      case b:
        h = ((r - g) / diff + 4) / 6
        break
    }
  }
  
  return {
    h: h * 360,
    s: s * 100,
    v: v * 100
  }
}

/**
 * Find dominant colors in a material
 */
export async function findDominantColors(material: THREE.Material): Promise<ColorEntry[]> {
  let texture: THREE.Texture | null = null
  
  // Check for texture in standard materials
  if ('map' in material && material.map instanceof THREE.Texture) {
    texture = material.map
  }
  // Check for texture in shader materials
  else if (material instanceof THREE.ShaderMaterial && material.uniforms) {
    console.log('🔍 Checking ShaderMaterial uniforms:', Object.keys(material.uniforms))
    
    // First try common uniform names
    const textureUniforms = ['map', 'diffuse', 'texture', 'baseTexture', 'tDiffuse']
    for (const uniformName of textureUniforms) {
      if (material.uniforms[uniformName]?.value instanceof THREE.Texture) {
        texture = material.uniforms[uniformName].value
        console.log('🎨 Found texture in ShaderMaterial uniform:', uniformName)
        break
      }
    }
    
    // If not found, check ALL uniforms for any Texture values
    if (!texture) {
      for (const [uniformName, uniform] of Object.entries(material.uniforms)) {
        if (uniform?.value instanceof THREE.Texture) {
          texture = uniform.value
          console.log('🎨 Found texture in ShaderMaterial uniform (any name):', uniformName)
          break
        }
      }
    }
  }
  
  // Extract colors from texture if found
  if (texture) {
    console.log('🎨 Extracting colors from texture:', texture)
    return extractColorPalette(texture)
  }
  
  // If no texture, return the base color
  if ('color' in material && material.color instanceof THREE.Color) {
    const color = material.color
    const r = Math.round(color.r * 255)
    const g = Math.round(color.g * 255)
    const b = Math.round(color.b * 255)
    
    console.log('🎨 Using base material color:', color.getHexString())
    return [{
      color: color.clone(),
      count: 1,
      percentage: 100,
      hsv: rgbToHsv(r, g, b)
    }]
  }
  
  console.log('⚠️ No texture or color found in material:', material.type)
  return []
}

/**
 * Log material analysis to console for debugging
 */
export function logMaterialAnalysis(mesh: THREE.Mesh): void {
  const analysis = analyzeMaterials(mesh)
  
  console.group('🎨 Material Analysis')
  analysis.forEach((mat, index) => {
    console.group(`Material ${index + 1}: ${mat.name}`)
    console.log('Type:', mat.type)
    console.log('Color:', `#${mat.color.getHexString()}`)
    console.log('Has Texture:', mat.hasTexture)
    
    if (mat.textureInfo) {
      console.log('Texture:', `${mat.textureInfo.width}x${mat.textureInfo.height}`)
      console.log('Format:', mat.textureInfo.format)
      console.log('Has Alpha:', mat.textureInfo.hasAlpha)
    }
    
    if (Object.keys(mat.properties).length > 0) {
      console.log('Properties:', mat.properties)
    }
    
    // Try to extract dominant colors
    findDominantColors(mesh.material as THREE.Material)
      .then(colors => {
        if (colors.length > 0) {
          console.log('Dominant Colors:')
          colors.slice(0, 5).forEach((entry, i) => {
            console.log(`  ${i + 1}. #${entry.color.getHexString()} (${entry.percentage.toFixed(1)}%)`)
          })
        }
      })
      .catch(err => console.warn('Color extraction failed:', err))
    
    console.groupEnd()
  })
  console.groupEnd()
}