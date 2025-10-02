import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { LimbMesh, Units } from '../types'
import { inferUnitsFromAsset, estimateUnitsFromSize } from './units'

/**
 * Supported file types for mesh loading
 */
export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.obj', '.stl'] as const
export const SUPPORTED_MIME_TYPES = [
  'model/gltf-binary',
  'model/gltf+json', 
  'application/octet-stream',
  'text/plain'
] as const

/**
 * File validation result
 */
export interface FileValidation {
  valid: boolean
  error?: string
  extension?: string
}

/**
 * Mesh loading result
 */
export interface MeshLoadResult {
  mesh: LimbMesh
  originalTriangleCount: number
  units: Units | null
  wasDecimated: boolean
  boundingBox: THREE.Box3
}

/**
 * Validate if file is supported for mesh loading
 */
export function validateMeshFile(file: File): FileValidation {
  const extension = file.name.toLowerCase().split('.').pop()
  
  if (!extension) {
    return { valid: false, error: 'File has no extension' }
  }
  
  const validExtension = SUPPORTED_EXTENSIONS.includes(`.${extension}` as any)
  
  if (!validExtension) {
    return { 
      valid: false, 
      error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}` 
    }
  }
  
  // Check file size (limit to 100MB)
  if (file.size > 100 * 1024 * 1024) {
    return { valid: false, error: 'File too large. Maximum size: 100MB' }
  }
  
  return { valid: true, extension }
}

/**
 * Set up DRACO loader for compressed glTF files
 */
function setupDRACOLoader(): DRACOLoader {
  const dracoLoader = new DRACOLoader()
  // Use CDN for DRACO decoder files
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
  return dracoLoader
}

/**
 * Load GLB/GLTF file
 */
async function loadGLTF(file: File): Promise<{ scene: THREE.Group, gltf: GLTF }> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    
    // Set up DRACO loader for compression support
    const dracoLoader = setupDRACOLoader()
    loader.setDRACOLoader(dracoLoader)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          console.log('🚀 GLTF LOADED - Raw GLTF Analysis:')
          console.log('  📦 GLTF Structure:', {
            hasScene: !!gltf.scene,
            sceneChildren: gltf.scene.children.length,
            hasAnimations: gltf.animations.length > 0,
            hasCameras: gltf.cameras.length > 0,
            hasAsset: !!gltf.asset,
            hasParser: !!gltf.parser,
            hasUserData: !!gltf.userData
          })
          
          // Try to access parser data if available
          if ((gltf as any).parser?.json) {
            const json = (gltf as any).parser.json
            console.log('  📋 GLTF JSON Data:', {
              hasTextures: !!json.textures && json.textures.length > 0,
              hasMaterials: !!json.materials && json.materials.length > 0,
              hasImages: !!json.images && json.images.length > 0,
              textureCount: json.textures?.length || 0,
              materialCount: json.materials?.length || 0,
              imageCount: json.images?.length || 0
            })
            
            if (json.materials) {
              console.log('  💎 GLTF Raw Materials:')
              json.materials.forEach((mat: any, i: number) => {
                console.log(`    Material ${i}:`, {
                  name: mat.name || 'unnamed',
                  pbrMetallicRoughness: !!mat.pbrMetallicRoughness,
                  baseColorTexture: !!mat.pbrMetallicRoughness?.baseColorTexture,
                  baseColorFactor: mat.pbrMetallicRoughness?.baseColorFactor || 'none'
                })
              })
            }
          }
          
          // Check scene hierarchy
          console.log('  🌳 Scene hierarchy:')
          const traverseScene = (obj: THREE.Object3D, depth = 0) => {
            const indent = '  '.repeat(depth + 2)
            console.log(`${indent}${obj.type} "${obj.name}" (children: ${obj.children.length})`)
            if (obj instanceof THREE.Mesh) {
              console.log(`${indent}  └ Geometry: ${obj.geometry.type}, Material: ${Array.isArray(obj.material) ? obj.material.map(m => m.type).join(', ') : obj.material.type}`)
            }
            obj.children.forEach(child => traverseScene(child, depth + 1))
          }
          traverseScene(gltf.scene)
          
          resolve({ scene: gltf.scene, gltf })
        },
        (error) => {
          reject(new Error(`GLTF loading failed: ${error}`))
        }
      )
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Load OBJ file (with optional MTL)
 */
async function loadOBJ(file: File, mtlFile?: File): Promise<{ scene: THREE.Group }> {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader()
    
    // Load MTL file first if provided
    if (mtlFile) {
      const mtlLoader = new MTLLoader()
      const mtlReader = new FileReader()
      
      mtlReader.onload = (e) => {
        const mtlText = e.target?.result as string
        const materials = mtlLoader.parse(mtlText, '')
        materials.preload()
        objLoader.setMaterials(materials)
        loadOBJData()
      }
      
      mtlReader.onerror = () => {
        console.warn('Failed to load MTL file, proceeding without materials')
        loadOBJData()
      }
      
      mtlReader.readAsText(mtlFile)
    } else {
      loadOBJData()
    }
    
    function loadOBJData() {
      const reader = new FileReader()
      reader.onload = (e) => {
        const objText = e.target?.result as string
        
        try {
          const scene = objLoader.parse(objText)
          resolve({ scene })
        } catch (error) {
          reject(new Error(`OBJ loading failed: ${error}`))
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read OBJ file'))
      reader.readAsText(file)
    }
  })
}

/**
 * Load STL file
 */
async function loadSTL(file: File): Promise<{ scene: THREE.Group }> {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      
      try {
        const geometry = loader.parse(arrayBuffer)
        
        // Create a mesh with the loaded geometry
        const material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.8,
          metalness: 0.1
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        
        // Create a scene to hold the mesh
        const scene = new THREE.Group()
        scene.add(mesh)
        
        resolve({ scene })
      } catch (error) {
        reject(new Error(`STL loading failed: ${error}`))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read STL file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract the main mesh from a loaded scene
 */
function extractMeshFromScene(scene: THREE.Group): THREE.Mesh | null {
  let mainMesh: THREE.Mesh | null = null
  let maxTriangles = 0
  
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const triangleCount = child.geometry.index 
        ? child.geometry.index.count / 3
        : child.geometry.attributes.position.count / 3
        
      if (triangleCount > maxTriangles) {
        maxTriangles = triangleCount
        mainMesh = child
      }
    }
  })
  
  return mainMesh
}

/**
 * Decimate mesh if triangle count exceeds threshold
 */
function decimateMesh(mesh: THREE.Mesh, maxTriangles: number = 200000): { 
  mesh: THREE.Mesh, 
  wasDecimated: boolean 
} {
  const geometry = mesh.geometry
  const currentTriangles = geometry.index 
    ? geometry.index.count / 3 
    : geometry.attributes.position.count / 3
    
  if (currentTriangles <= maxTriangles) {
    return { mesh, wasDecimated: false }
  }
  
  // For now, just log that decimation is needed
  // In a production app, you'd implement actual mesh decimation here
  console.warn(`Mesh has ${currentTriangles.toFixed(0)} triangles, should decimate to ${maxTriangles}`)
  
  // TODO: Implement actual mesh decimation using a library like meshoptimizer
  // For MVP, we'll just proceed with the original mesh
  return { mesh, wasDecimated: false }
}

/**
 * Process loaded mesh for prosthetic socket generation
 */
function processMesh(
  mesh: THREE.Mesh, 
  originalTriangleCount: number,
  _gltf?: GLTF // TODO: Use for metadata extraction
): LimbMesh {
  // Ensure geometry is properly set up
  if (!mesh.geometry.attributes.position) {
    throw new Error('Mesh has no position attribute')
  }
  
  // Compute vertex normals if missing
  if (!mesh.geometry.attributes.normal) {
    mesh.geometry.computeVertexNormals()
  }
  
  // Compute bounding box
  mesh.geometry.computeBoundingBox()
  
  // Preserve original materials but apply GLB-specific fixes if needed
  if (!mesh.material) {
    // Only create default material if none exists
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.8,
      metalness: 0.1
    })
    console.log('⚪ Created default material for mesh without materials')
  } else {
    console.log('✅ Applying GLB-specific material fixes...')
    
    // Handle both single and multiple materials
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    
    materials.forEach((mat, i) => {
      if (mat instanceof THREE.MeshStandardMaterial && mat.map) {
        console.log(`🔧 GLB Material ${i} fix:`)
        
        // POTENTIAL FIX 1: Ensure texture is properly configured
        const texture = mat.map
        if (texture.image) {
          // Handle ImageBitmap (GLB) vs HTMLImageElement (regular images)
          const isImageBitmap = texture.image instanceof ImageBitmap
          const isHTMLImage = texture.image instanceof HTMLImageElement
          
          console.log(`  📸 Texture image type: ${isImageBitmap ? 'ImageBitmap' : isHTMLImage ? 'HTMLImageElement' : 'Unknown'}`)
          
          if (isHTMLImage && !texture.image.complete) {
            console.log('  📸 HTML Image not complete, forcing update...')
            texture.needsUpdate = true
          } else if (isImageBitmap) {
            console.log('  📸 ImageBitmap detected - should work immediately')
            texture.needsUpdate = true
          }
        }
        
        // POTENTIAL FIX 2: Ensure material color doesn't interfere with texture
        if (mat.color.getHex() === 0xffffff) {
          console.log('  🎨 Material color is pure white - this should be correct for textured materials')
          // Pure white is actually correct - it means "don't tint the texture"
        }
        
        // CRITICAL FIX: Check if there are vertex colors interfering
        if (mesh.geometry.attributes.color) {
          console.log('  🎨 Mesh has vertex colors - these might override texture colors')
          // In GLB files, vertex colors can override texture colors
          if (mat.vertexColors) {
            console.log('  🔧 Disabling vertex colors to show texture')
            mat.vertexColors = false
            mat.needsUpdate = true
          }
        }
        
        // POTENTIAL FIX 3: Ensure proper color space
        if (texture.colorSpace !== THREE.SRGBColorSpace) {
          console.log(`  🌈 Setting texture color space to sRGB (was: ${texture.colorSpace})`)
          texture.colorSpace = THREE.SRGBColorSpace
          texture.needsUpdate = true
        }
        
        // POTENTIAL FIX 4: Check texture encoding/format issues
        if (texture.format !== THREE.RGBAFormat) {
          console.log(`  📐 Unusual texture format: ${texture.format}, might cause issues`)
        }
        
        // POTENTIAL FIX 5: Force texture and material update
        texture.needsUpdate = true
        mat.needsUpdate = true
        
        // CRITICAL FIX: Reset material color and force proper texture binding
        console.log('  🎯 CRITICAL FIX: Resetting material color to white and forcing texture binding...')
        mat.color.setHex(0xffffff)  // Pure white for proper texture display
        
        // Force texture re-binding with proper GLB settings
        if (texture) {
          // GLB files often need specific texture settings
          texture.flipY = false  // GLB textures are already flipped correctly
          texture.premultiplyAlpha = false
          texture.generateMipmaps = true
          
          // Critical: Force texture to use proper color space for GLB
          texture.colorSpace = THREE.SRGBColorSpace
          
          // Ensure the texture is properly bound to the material
          mat.map = texture
          
          // CRITICAL GLB FIX: Force material to recognize it has a texture
          mat.needsUpdate = true
          texture.needsUpdate = true
          
          // Force a complete material rebuild
          setTimeout(() => {
            mat.needsUpdate = true
            texture.needsUpdate = true
            console.log('  � Delayed material update applied')
          }, 100)
          
          console.log('  �🔧 Texture rebound with GLB-specific settings and delayed update')
        }
        
        // ADDITIONAL FIX: Ensure material transparency settings don't interfere
        if (mat.transparent || mat.opacity < 1.0) {
          console.log('  🔍 Material has transparency - ensuring proper opacity')
          mat.transparent = false
          mat.opacity = 1.0
          mat.needsUpdate = true
        }
        
        // FINAL TEST: Log final material state
        console.log(`  📊 Final material state:`, {
          color: mat.color.getHex(),
          hasMap: !!mat.map,
          transparent: mat.transparent,
          opacity: mat.opacity,
          vertexColors: mat.vertexColors
        })
        
        console.log(`  ✅ Material ${i} fixes applied`)
      }
    })
  }
  
  // DEEP DEBUG: Comprehensive material and texture analysis
  console.log('🔍 DEEP MATERIAL INSPECTION:')
  console.log('🔍 Mesh geometry:', {
    hasUV: !!mesh.geometry.attributes.uv,
    hasNormal: !!mesh.geometry.attributes.normal,
    hasColor: !!mesh.geometry.attributes.color,
    triangles: mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3
  })
  
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((mat, i) => {
    console.log(`🔍 Material ${i} DETAILED:`, {
      type: mat.type,
      name: mat.name || 'unnamed',
      uuid: mat.uuid
    })
    
    if ('color' in mat) {
      const color = (mat as any).color as THREE.Color
      console.log(`  💎 Color: #${color.getHexString()} (R:${color.r.toFixed(3)}, G:${color.g.toFixed(3)}, B:${color.b.toFixed(3)})`)
    }
    
    if ('map' in mat) {
      const map = (mat as any).map as THREE.Texture | null
      if (map) {
        console.log('  🖼️ Texture map:', {
          hasImage: !!map.image,
          imageType: map.image?.constructor.name,
          imageSize: map.image ? `${map.image.width}x${map.image.height}` : 'no-size',
          format: map.format,
          wrapS: map.wrapS,
          wrapT: map.wrapT,
          magFilter: map.magFilter,
          minFilter: map.minFilter,
          needsUpdate: map.needsUpdate,
          flipY: map.flipY
        })
        
        // Check if texture has actual image data
        if (map.image) {
          console.log('  🖼️ Image details:', {
            src: map.image.src?.substring(0, 50) + '...' || 'no-src',
            complete: map.image.complete,
            naturalWidth: map.image.naturalWidth,
            naturalHeight: map.image.naturalHeight
          })
        }
      } else {
        console.log('  🖼️ Texture map: NULL')
      }
    }
    
    // Check other texture types
    const textureTypes = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap']
    textureTypes.forEach(texType => {
      if (texType in mat && (mat as any)[texType]) {
        console.log(`  🎨 ${texType}: EXISTS`)
      }
    })
    
    // Check material properties
    if (mat instanceof THREE.MeshStandardMaterial) {
      console.log('  ⚙️ Standard Material Properties:', {
        roughness: mat.roughness,
        metalness: mat.metalness,
        transparent: mat.transparent,
        opacity: mat.opacity,
        side: mat.side,
        alphaTest: mat.alphaTest,
        visible: mat.visible
      })
    }
  })
  
  // Add metadata
  const limbMesh = mesh as LimbMesh
  limbMesh.userData = {
    originalTriangleCount,
    wasDecimated: false
  }
  
  return limbMesh
}

/**
 * Validate multiple files for mesh loading (supporting OBJ+MTL combinations)
 */
export function validateMeshFiles(files: File[]): { valid: boolean, error?: string } {
  if (files.length === 0) {
    return { valid: false, error: 'No files provided' }
  }

  // Single file case
  if (files.length === 1) {
    return validateMeshFile(files[0])
  }

  // Multiple files - check for OBJ + MTL combination
  const objFiles = files.filter(f => f.name.toLowerCase().endsWith('.obj'))
  const mtlFiles = files.filter(f => f.name.toLowerCase().endsWith('.mtl'))

  if (objFiles.length === 1 && mtlFiles.length <= 1) {
    const objValidation = validateMeshFile(objFiles[0])
    if (!objValidation.valid) return objValidation

    if (mtlFiles.length === 1) {
      // Basic MTL validation
      if (mtlFiles[0].size > 10 * 1024 * 1024) {
        return { valid: false, error: 'MTL file too large. Maximum size: 10MB' }
      }
    }

    return { valid: true }
  }

  return { valid: false, error: 'Invalid file combination. Provide single GLB/GLTF or OBJ with optional MTL.' }
}

/**
 * Load mesh from multiple files (supporting OBJ+MTL)
 */
export async function loadMeshFromFiles(
  files: File[], 
  options: { downsample?: number, scale?: number } = {}
): Promise<MeshLoadResult> {
  const validation = validateMeshFiles(files)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  let mainFile: File
  let mtlFile: File | undefined

  if (files.length === 1) {
    mainFile = files[0]
  } else {
    // OBJ + MTL case
    mainFile = files.find(f => f.name.toLowerCase().endsWith('.obj'))!
    mtlFile = files.find(f => f.name.toLowerCase().endsWith('.mtl'))
  }

  // Load the mesh
  const result = await loadMeshFile(mainFile, mtlFile)

  // Apply scale if provided
  if (options.scale && options.scale !== 1.0) {
    result.mesh.scale.setScalar(options.scale)
    result.mesh.updateMatrixWorld(true)
    
    // Update bounding box after scaling
    result.boundingBox.setFromObject(result.mesh)
  }

  // Apply decimation if requested
  if (options.downsample && options.downsample > 0) {
    const currentTriangles = result.mesh.geometry.index 
      ? result.mesh.geometry.index.count / 3
      : result.mesh.geometry.attributes.position.count / 3

    if (currentTriangles > options.downsample) {
      // For now, just mark as should be decimated
      console.warn(`Mesh has ${currentTriangles} triangles, should decimate to ${options.downsample}`)
      // TODO: Implement actual decimation
    }
  }

  return result
}

/**
 * Main function to load a mesh file
 */
export async function loadMeshFile(
  file: File, 
  mtlFile?: File
): Promise<MeshLoadResult> {
  // Validate file
  const validation = validateMeshFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }
  
  let scene: THREE.Group
  let gltf: GLTF | undefined
  let inferredUnits: Units | null = null
  
  // Load based on file extension
  const extension = validation.extension!
  
  try {
    if (extension === 'glb' || extension === 'gltf') {
      const result = await loadGLTF(file)
      scene = result.scene
      gltf = result.gltf
      inferredUnits = inferUnitsFromAsset(gltf)
    } else if (extension === 'obj') {
      const result = await loadOBJ(file, mtlFile)
      scene = result.scene
    } else if (extension === 'stl') {
      const result = await loadSTL(file)
      scene = result.scene
    } else {
      throw new Error(`Unsupported extension: ${extension}`)
    }
  } catch (error) {
    throw new Error(`Failed to load ${extension.toUpperCase()} file: ${error}`)
  }
  
  // Extract main mesh
  const rawMesh = extractMeshFromScene(scene)
  if (!rawMesh) {
    throw new Error('No mesh found in the loaded file')
  }
  
  // Get original triangle count
  const originalTriangleCount = rawMesh.geometry.index 
    ? rawMesh.geometry.index.count / 3
    : rawMesh.geometry.attributes.position.count / 3
    
  // Decimate if necessary
  const { mesh: decimatedMesh, wasDecimated } = decimateMesh(rawMesh)
  
  // For GLB files, preserve materials but fix the critical baseColorFactor issue
  console.log('🎯 GLB MATERIAL FIX: Handling baseColorFactor="none" issue')
  
  const limbMesh = decimatedMesh
  limbMesh.userData.wasDecimated = wasDecimated
  limbMesh.userData.originalTriangleCount = originalTriangleCount
  
  // Fix the specific issue: GLB with baseColorFactor="none" needs default white color
  if (limbMesh.material) {
    const materials = Array.isArray(limbMesh.material) ? limbMesh.material : [limbMesh.material]
    materials.forEach((mat, i) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        // Critical fix: If material has texture but color is black (0,0,0), set to white
        const currentColor = mat.color.getHex()
        const hasTexture = !!mat.map
        
        console.log(`  � Material ${i} analysis:`, {
          type: mat.type,
          name: mat.name || 'unnamed',
          hasTexture: hasTexture,
          currentColor: `#${currentColor.toString(16).padStart(6, '0')}`,
          isBlack: currentColor === 0x000000
        })
        
        // Fix: If material is black but has texture, set to white for proper texture display
        if (currentColor === 0x000000 && hasTexture) {
          console.log(`  🎨 CRITICAL FIX: Setting material color to white for texture display`)
          mat.color.setHex(0xffffff)
          mat.needsUpdate = true
        }
      }
    })
  }
  
  // Compute bounding box
  const boundingBox = new THREE.Box3()
  boundingBox.setFromObject(limbMesh)
  const size = boundingBox.getSize(new THREE.Vector3())
  
  // Estimate units if not inferred from asset
  if (!inferredUnits) {
    inferredUnits = estimateUnitsFromSize([size.x, size.y, size.z])
  }
  
  return {
    mesh: limbMesh,
    originalTriangleCount,
    units: inferredUnits,
    wasDecimated,
    boundingBox
  }
}