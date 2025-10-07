/**
 * Interactive Color Highlighting Controller
 * 
 * Orchestrates the color highlighting system by coordinating between:
 * - Color analysis worker for texture processing
 * - Highlight shader system for visual feedback
 * - User interaction for color selection and tolerance control
 * 
 * Key Features:
 * - Real-time color matching with configurable HSV tolerance
 * - Non-destructive highlighting that preserves original materials
 * - Performance optimized with worker-based texture analysis
 * - Comprehensive error handling and fallback strategies
 */

import * as THREE from 'three'
import type { ColorEntry } from './materials'
import { 
  createHighlightMaterial, 
  updateHighlightMask, 
  clearHighlights, 
  updateHighlightProperties 
} from './highlightShader'

// Worker types (re-export for convenience)
interface ColorHighlightRequest {
  type: 'analyze' | 'highlight' | 'clear'
  imageData?: ImageData
  targetColor?: { h: number, s: number, v: number }
  tolerance?: { h: number, s: number, v: number }
}

interface ColorHighlightResponse {
  type: 'analysis-complete' | 'highlight-ready' | 'error'
  highlightMask?: Uint8Array
  matchingPixels?: number
  coverage?: number
  boundingBox?: { min: [number, number], max: [number, number] }
  error?: string
}

interface HighlightConfig {
  color: THREE.Color
  opacity: number
  intensity: number
  tolerance: {
    h: number  // Hue tolerance (0-180)
    s: number  // Saturation tolerance (0-100)
    v: number  // Value tolerance (0-100)
  }
}

interface HighlightStats {
  matchingPixels: number
  coverage: number
  boundingBox: { min: [number, number], max: [number, number] }
}

// Legacy interface for backward compatibility
export interface ColorHighlightConfig {
  targetColor: THREE.Color
  tolerance: {
    hue: number      // 0-360 degrees
    saturation: number // 0-100 percent  
    value: number    // 0-100 percent
  }
  highlightColor: THREE.Color
  intensity: number // 0-1, how strong the highlight is
}

/**
 * Main controller class for interactive color highlighting
 */
export class ColorHighlightController {
  private worker: Worker | null = null
  private originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map()
  private highlightMaterials: Map<THREE.Mesh, THREE.ShaderMaterial> = new Map()
  private isProcessing = false
  private currentConfig: HighlightConfig
  private onStatsUpdate?: (stats: HighlightStats | null) => void

  constructor(
    config: Partial<HighlightConfig> = {},
    onStatsUpdate?: (stats: HighlightStats | null) => void
  ) {
    this.currentConfig = {
      color: new THREE.Color(0xff6b6b), // Nice red highlighting
      opacity: 0.8, // Strong but not overwhelming
      intensity: 2.0, // Good visibility
      tolerance: { h: 15, s: 20, v: 30 }, // Optimized for prosthetic marking detection
      ...config
    }
    this.onStatsUpdate = onStatsUpdate
    this.initializeWorker()
  }

  /**
   * Initialize the color analysis worker - SIMPLIFIED VERSION
   */
  private initializeWorker(): void {
    try {
      // Create color analysis worker only - no preprocessing
      this.worker = new Worker(
        new URL('../workers/colorHighlight.worker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.onmessage = (e: MessageEvent<ColorHighlightResponse>) => {
        this.handleWorkerResponse(e.data)
      }

      this.worker.onerror = (error) => {
        console.error('❌ Color highlight worker error:', error)
        this.isProcessing = false
      }

      console.log('✅ Color highlight worker initialized (simple version)')
    } catch (error) {
      console.error('❌ Failed to initialize worker:', error)
      this.worker = null
    }
  }

  /**
   * Handle responses from the color analysis worker
   */
  private handleWorkerResponse(response: ColorHighlightResponse): void {
    this.isProcessing = false

    switch (response.type) {
      case 'analysis-complete':
        if (response.highlightMask && response.matchingPixels !== undefined) {
          this.applyHighlightMask(response.highlightMask, response.matchingPixels)
          
          if (this.onStatsUpdate) {
            this.onStatsUpdate({
              matchingPixels: response.matchingPixels,
              coverage: response.coverage || 0,
              boundingBox: response.boundingBox || { min: [0, 0], max: [0, 0] }
            })
          }
        }
        break

      case 'error':
        console.error('❌ Worker analysis error:', response.error)
        if (this.onStatsUpdate) {
          this.onStatsUpdate(null)
        }
        break
    }
  }



  /**
   * Set up highlighting for a mesh with textured materials
   */
  setupMeshHighlighting(mesh: THREE.Mesh): boolean {
    console.log('🎯 setupMeshHighlighting called for mesh:', mesh.name || 'unnamed')
    console.log('🔍 Mesh object debug:', {
      uuid: mesh.uuid,
      name: mesh.name,
      type: mesh.type,
      parent: mesh.parent?.type,
      parentName: mesh.parent?.name,
      isInScene: mesh.parent !== null,
      geometry: mesh.geometry?.type,
      vertexCount: mesh.geometry?.attributes?.position?.count
    })
    
    // CRITICAL FIX: Canvas3D clones the mesh, so we need to find the actual rendered mesh
    let targetMesh = mesh
    
    // If this mesh is not in a scene, try to find the clone that is being rendered
    if (!mesh.parent) {
      console.log('🔍 Mesh not in scene - looking for clone with name "limb"')
      // We need to traverse all scenes to find the clone
      // For now, let's store the original mesh but we'll need to apply materials to the clone
      console.warn('⚠️ WARNING: Mesh is not in scene - this might be the original that gets cloned')
    }
    
    console.log('🔍 Using target mesh:', targetMesh.name, 'UUID:', targetMesh.uuid)
    
    if (!mesh.material) {
      console.warn('⚠️ Mesh has no material, cannot setup highlighting')
      return false
    }

    console.log('🔍 Mesh material debug:', {
      type: Array.isArray(mesh.material) ? 'array' : (mesh.material as any).type,
      isArray: Array.isArray(mesh.material),
      hasUniforms: !Array.isArray(mesh.material) && 'uniforms' in mesh.material,
      materialUuid: Array.isArray(mesh.material) ? 'array' : mesh.material.uuid
    })

    // Store original material
    this.originalMaterials.set(mesh, mesh.material)

    // Check if mesh has a texture - need to handle ShaderMaterial case
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    let texture: THREE.Texture | null = null
    
    // Check for standard material texture
    if ('map' in material && material.map instanceof THREE.Texture) {
      texture = material.map
      console.log('📍 Found texture in standard material.map')
    }
    // Check for ShaderMaterial uniforms
    else if ('uniforms' in material && material.uniforms) {
      const uniforms = material.uniforms as any
      console.log('🔍 Checking ShaderMaterial uniforms:', Object.keys(uniforms))
      
      // Look for originalTexture uniform (from our highlighting setup)
      if (uniforms.originalTexture?.value instanceof THREE.Texture) {
        texture = uniforms.originalTexture.value
        console.log('📍 Found texture in ShaderMaterial.uniforms.originalTexture')
      }
      // Look for other common texture uniform names
      else {
        for (const key of Object.keys(uniforms)) {
          if (uniforms[key]?.value instanceof THREE.Texture) {
            texture = uniforms[key].value
            console.log(`📍 Found texture in ShaderMaterial.uniforms.${key}`)
            break
          }
        }
      }
    }

    if (!texture) {
      console.warn('⚠️ Mesh has no texture, cannot setup highlighting')
      return false
    }

    console.log('🎨 Setting up highlighting for textured mesh with texture:', `${texture.image?.width}x${texture.image?.height}`)

    // CRITICAL FIX: Don't preprocess texture - work with original rendering
    // This prevents the "black model after 15 seconds" issue
    console.log('🎯 Using original texture without preprocessing to maintain visual integrity')

    // Create highlight material with original texture (no preprocessing)
    const highlightMaterial = createHighlightMaterial(texture, {
      highlightColor: this.currentConfig.color,
      highlightOpacity: this.currentConfig.opacity,
      highlightIntensity: this.currentConfig.intensity
    })

    this.highlightMaterials.set(mesh, highlightMaterial)
    mesh.material = highlightMaterial

    console.log('✅ Mesh highlighting setup complete - ready for color-based highlighting')
    console.log('🔍 Applied material to mesh:', mesh.name, 'Material type:', mesh.material.type)
    
    return true
  }

  /**
   * Highlight regions matching a specific color using enhanced marking detection
   */
  highlightColor(targetColor: { h: number, s: number, v: number }): void {
    console.log('🎯 highlightColor called with:', targetColor)
    
    if (this.isProcessing || !this.worker) {
      console.warn('⚠️ Color analysis already in progress or worker not available:', {
        isProcessing: this.isProcessing,
        hasWorker: !!this.worker
      })
      return
    }

    console.log('🔍 Available highlight materials:', this.highlightMaterials.size)
    this.isProcessing = true

    // Find textured meshes 
    const meshWithTexture = Array.from(this.highlightMaterials.keys())[0]
    if (!meshWithTexture) {
      console.warn('⚠️ No textured mesh available for highlighting')
      this.isProcessing = false
      return
    }

    console.log('🎨 Found mesh for highlighting:', meshWithTexture.name || 'unnamed')
    
    // SIMPLE APPROACH: Basic texture analysis without any preprocessing
    console.log('🎯 Using simple texture analysis - no preprocessing')
    
    const highlightMaterial = this.highlightMaterials.get(meshWithTexture)!
    const texture = highlightMaterial.uniforms.originalTexture.value as THREE.Texture
    
    // Extract texture data as-is - no modifications
    this.extractTextureImageData(texture)
      .then(imageData => {
        console.log('✅ Successfully extracted texture ImageData:', `${imageData.width}x${imageData.height}`)
        if (!this.worker) throw new Error('Worker not available')

        const request: ColorHighlightRequest = {
          type: 'analyze',
          imageData,
          targetColor,
          tolerance: this.currentConfig.tolerance
        }

        console.log('📨 Sending request to worker:', { targetColor, tolerance: this.currentConfig.tolerance })
        this.worker.postMessage(request)
      })
      .catch(error => {
        console.error('❌ Failed to extract texture data:', error)
        this.isProcessing = false
        if (this.onStatsUpdate) {
          this.onStatsUpdate(null)
        }
      })
  }

  /**
   * Extract ImageData from a Three.js texture
   */
  private async extractTextureImageData(texture: THREE.Texture): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Could not create canvas context'))
        return
      }

      // Handle different texture sources
      if (texture.image instanceof HTMLImageElement) {
        canvas.width = texture.image.naturalWidth
        canvas.height = texture.image.naturalHeight
        context.drawImage(texture.image, 0, 0)
        resolve(context.getImageData(0, 0, canvas.width, canvas.height))
      } else if (texture.image instanceof ImageBitmap) {
        canvas.width = texture.image.width
        canvas.height = texture.image.height
        context.drawImage(texture.image, 0, 0)
        resolve(context.getImageData(0, 0, canvas.width, canvas.height))
      } else if (texture.image instanceof HTMLCanvasElement) {
        canvas.width = texture.image.width
        canvas.height = texture.image.height
        context.drawImage(texture.image, 0, 0)
        resolve(context.getImageData(0, 0, canvas.width, canvas.height))
      } else {
        reject(new Error('Unsupported texture image type'))
      }
    })
  }

  /**
   * Update highlighting configuration
   */
  updateConfig(newConfig: Partial<HighlightConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...newConfig }

    // Update all active highlight materials
    this.highlightMaterials.forEach((material) => {
      updateHighlightProperties(material, {
        color: this.currentConfig.color,
        opacity: this.currentConfig.opacity,
        intensity: this.currentConfig.intensity
      })
    })
  }

  /**
   * Get current highlighting statistics
   */
  get isHighlighting(): boolean {
    return this.highlightMaterials.size > 0
  }

  get processingStatus(): boolean {
    return this.isProcessing
  }

  get config(): HighlightConfig {
    return { ...this.currentConfig }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    console.log('🗑️ Disposing color highlight controller')

    this.restoreOriginalMaterials()
    
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.originalMaterials.clear()
    this.highlightMaterials.clear()
  }

  /**
   * Cleanup alias for dispose (for consistency with React patterns)
   */
  cleanup(): void {
    this.dispose()
  }

  /**
   * Restore original materials and cleanup
   */
  restoreOriginalMaterials(): void {
    console.log('🔄 Restoring original materials')

    this.originalMaterials.forEach((originalMaterial, mesh) => {
      mesh.material = originalMaterial
    })

    this.clearHighlights()
    this.highlightMaterials.clear()
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    console.log('🧹 Clearing all highlights')

    this.highlightMaterials.forEach((material) => {
      clearHighlights(material)
    })

    if (this.onStatsUpdate) {
      this.onStatsUpdate(null)
    }
  }

  /**
   * Apply highlight mask to all configured meshes
   */
  private applyHighlightMask(maskData: Uint8Array, matchingPixels: number): void {
    console.log(`🎨 Applying highlight mask: ${matchingPixels} matching pixels`)

    // Determine mask dimensions (assume square for now, can be improved)
    const size = Math.sqrt(maskData.length)
    if (size !== Math.floor(size)) {
      console.error('❌ Invalid mask data: not square dimensions')
      return
    }

    this.highlightMaterials.forEach((material) => {
      console.log(`🎨 Applying highlight: ${this.currentConfig.color.getHexString()} (${matchingPixels} pixels, ${size}x${size} mask)`)
      
      updateHighlightMask(material, maskData, size, size)
      updateHighlightProperties(material, {
        color: this.currentConfig.color,
        opacity: this.currentConfig.opacity,
        intensity: this.currentConfig.intensity
      })
      
      // Force material update to ensure shader recompilation
      material.needsUpdate = true
      material.uniformsNeedUpdate = true
    })
  }
}

// Legacy function for backward compatibility
export function createColorHighlightMaterial(
  originalMaterial: THREE.Material,
  config: ColorHighlightConfig
): THREE.ShaderMaterial {
  // Get the original texture if it exists
  let originalTexture: THREE.Texture | null = null
  if ('map' in originalMaterial && originalMaterial.map instanceof THREE.Texture) {
    originalTexture = originalMaterial.map
  }

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform sampler2D map;
    uniform bool hasTexture;
    uniform vec3 baseColor;
    uniform vec3 targetColor;
    uniform vec3 tolerance;
    uniform vec3 highlightColor;
    uniform float intensity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    // Convert RGB to HSV
    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    
    // Check if color is within HSV tolerance range
    bool isColorMatch(vec3 pixelHSV, vec3 targetHSV, vec3 tol) {
      float hueDiff = abs(pixelHSV.x - targetHSV.x);
      // Handle hue wraparound (e.g., 350° vs 10°)
      if (hueDiff > 0.5) hueDiff = 1.0 - hueDiff;
      
      return (hueDiff * 360.0 <= tol.x) &&
             (abs(pixelHSV.y - targetHSV.y) * 100.0 <= tol.y) &&
             (abs(pixelHSV.z - targetHSV.z) * 100.0 <= tol.z);
    }
    
    void main() {
      vec3 color;
      
      if (hasTexture) {
        color = texture2D(map, vUv).rgb;
      } else {
        color = baseColor;
      }
      
      // Convert to HSV for comparison
      vec3 pixelHSV = rgb2hsv(color);
      vec3 targetHSV = rgb2hsv(targetColor);
      
      // Check if this pixel matches the target color
      bool matches = isColorMatch(pixelHSV, targetHSV, tolerance / vec3(360.0, 100.0, 100.0));
      
      if (matches) {
        // Highlight matching pixels
        color = mix(color, highlightColor, intensity);
      } else {
        // Dim non-matching pixels
        color = mix(color, vec3(0.3), 0.7);
      }
      
      // Basic lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float lambertian = max(dot(vNormal, lightDir), 0.0);
      color *= (0.3 + 0.7 * lambertian);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `

  // Convert target color to RGB
  const targetRGB = new THREE.Vector3(
    config.targetColor.r,
    config.targetColor.g,
    config.targetColor.b
  )

  // Get base color from original material
  let baseColor = new THREE.Vector3(0.7, 0.7, 0.7)
  if ('color' in originalMaterial && originalMaterial.color instanceof THREE.Color) {
    baseColor = new THREE.Vector3(
      originalMaterial.color.r,
      originalMaterial.color.g,
      originalMaterial.color.b
    )
  }

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      map: { value: originalTexture },
      hasTexture: { value: originalTexture !== null },
      baseColor: { value: baseColor },
      targetColor: { value: targetRGB },
      tolerance: { value: new THREE.Vector3(config.tolerance.hue, config.tolerance.saturation, config.tolerance.value) },
      highlightColor: { value: new THREE.Vector3(config.highlightColor.r, config.highlightColor.g, config.highlightColor.b) },
      intensity: { value: config.intensity }
    },
    transparent: false,
    side: THREE.DoubleSide
  })

  return material
}

/**
 * Apply color highlighting to a mesh
 */
export function applyColorHighlight(
  mesh: THREE.Mesh,
  config: ColorHighlightConfig
): THREE.Material {
  const originalMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const highlightMaterial = createColorHighlightMaterial(originalMaterial, config)
  
  // Store original material for restoration
  if (!mesh.userData.originalMaterial) {
    mesh.userData.originalMaterial = mesh.material
  }
  
  mesh.material = highlightMaterial
  return highlightMaterial
}

/**
 * Remove color highlighting and restore original material
 */
export function removeColorHighlight(mesh: THREE.Mesh): void {
  if (mesh.userData.originalMaterial) {
    mesh.material = mesh.userData.originalMaterial
  }
}

/**
 * Create default highlight configuration for a color
 */
export function createHighlightConfig(
  colorEntry: ColorEntry,
  highlightColor: THREE.Color = new THREE.Color(0xff00ff),
  intensity: number = 0.8
): ColorHighlightConfig {
  return {
    targetColor: colorEntry.color.clone(),
    tolerance: {
      hue: 15,        // ±15 degrees
      saturation: 20, // ±20%
      value: 20       // ±20%
    },
    highlightColor,
    intensity
  }
}

/**
 * Generate a bright highlight color for good visibility
 */
export function getHighlightColor(index: number): THREE.Color {
  const colors = [
    0xff00ff, // Magenta
    0x00ffff, // Cyan  
    0xff0000, // Red
    0x00ff00, // Green
    0x0000ff, // Blue
    0xffff00, // Yellow
    0xff8000, // Orange
    0x8000ff  // Purple
  ]
  
  return new THREE.Color(colors[index % colors.length])
}

// Export types
export type { HighlightConfig, HighlightStats, ColorHighlightRequest, ColorHighlightResponse }