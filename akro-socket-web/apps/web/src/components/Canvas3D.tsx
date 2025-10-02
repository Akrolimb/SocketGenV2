import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useCaseStore } from '../hooks/useCaseStore'

interface Canvas3DProps {
  className?: string
}

/**
 * Main 3D canvas component for displaying limb meshes, markings, and generated sockets.
 * Handles Three.js scene setup, camera controls, lighting, and rendering loop.
 */
export const Canvas3D: React.FC<Canvas3DProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const controlsRef = useRef<OrbitControls>()
  const animationIdRef = useRef<number>()
  
  const [fps, setFps] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  
  // Zustand store
  const limb = useCaseStore(state => state.limb)
  const markings = useCaseStore(state => state.markings)
  // const evidenceScene = useCaseStore(state => state.evidenceScene) // TODO: Use for evidence display

  // Performance monitoring
  const fpsCounter = useRef({ 
    frames: 0, 
    lastTime: performance.now() 
  })

  /**
   * Initialize Three.js scene, renderer, camera, and controls
   */
  const initializeThreeJS = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50, // fov
      rect.width / rect.height, // aspect
      0.1, // near
      10000 // far
    )
    camera.position.set(200, 150, 300)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false
    })
    renderer.setSize(rect.width, rect.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Try different tone mapping - ACES might be desaturating colors
    renderer.toneMapping = THREE.NoToneMapping  // Disable tone mapping temporarily
    renderer.toneMappingExposure = 1.0
    
    // CRITICAL: Set proper color space for GLB files (Three.js r152+)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    
    console.log('🎨 Renderer Configuration:', {
      toneMapping: renderer.toneMapping,
      toneMappingExposure: renderer.toneMappingExposure,
      outputColorSpace: renderer.outputColorSpace,
      shadowsEnabled: renderer.shadowMap.enabled,
      pixelRatio: renderer.getPixelRatio()
    })
    
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = true
    controls.enablePan = true
    controls.enableRotate = true
    // Dynamic limits - will be updated when object is loaded
    controls.maxDistance = 10000
    controls.minDistance = 1
    controlsRef.current = controls

    // Lighting setup (key + fill + rim)
    setupLighting(scene)

    // Grid
    const gridHelper = new THREE.GridHelper(1000, 50, 0x888888, 0xcccccc)
    gridHelper.name = 'grid'
    gridHelper.visible = showGrid
    scene.add(gridHelper)

  }, [showGrid])

  /**
   * Setup professional lighting: key light + fill light + rim light
   */
  const setupLighting = (scene: THREE.Scene) => {
    // Remove existing lights
    const existingLights = scene.children.filter(child => child.type.includes('Light'))
    existingLights.forEach(light => scene.remove(light))

    // Ambient light (soft fill)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)

    // Key light (main directional light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(300, 400, 200)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near = 100
    keyLight.shadow.camera.far = 1000
    keyLight.shadow.camera.left = -500
    keyLight.shadow.camera.right = 500
    keyLight.shadow.camera.top = 500
    keyLight.shadow.camera.bottom = -500
    scene.add(keyLight)

    // Fill light (softer from opposite side)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
    fillLight.position.set(-200, 200, -100)
    scene.add(fillLight)

    // Rim light (backlight for definition)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 100, -300)
    scene.add(rimLight)
  }

  /**
   * Animation loop with FPS monitoring
   */
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return
    }

    // Update controls
    controlsRef.current.update()

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current)

    // FPS calculation
    const now = performance.now()
    fpsCounter.current.frames++
    
    if (now - fpsCounter.current.lastTime >= 1000) {
      setFps(Math.round(fpsCounter.current.frames * 1000 / (now - fpsCounter.current.lastTime)))
      fpsCounter.current.frames = 0
      fpsCounter.current.lastTime = now
    }

    animationIdRef.current = requestAnimationFrame(animate)
  }, [])

  /**
   * Handle window resize
   */
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    
    cameraRef.current.aspect = rect.width / rect.height
    cameraRef.current.updateProjectionMatrix()
    
    rendererRef.current.setSize(rect.width, rect.height)
  }, [])

  /**
   * Fit camera to show object optimally
   */
  const fitCameraToObject = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return

    const box = new THREE.Box3()
    
    // Calculate bounding box of all visible objects (excluding helpers)
    sceneRef.current.traverse((object) => {
      if (object.type === 'Mesh' && object.visible) {
        box.expandByObject(object)
      }
    })

    if (box.isEmpty()) {
      // Default view if no objects
      cameraRef.current.position.set(200, 150, 300)
      controlsRef.current.target.set(0, 0, 0)
      return
    }

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    
    console.log('Fitting camera to object:', {
      boundingBox: { min: box.min.toArray(), max: box.max.toArray() },
      size: size.toArray(),
      center: center.toArray()
    })
    
    // Calculate optimal camera distance for good visibility
    const maxDim = Math.max(size.x, size.y, size.z)
    
    // Simple, reliable camera distance calculation
    // Aim to fill about 60% of the viewport with the object
    const distance = maxDim * 3.5
    
    console.log('Camera positioning:', { 
      objectSize: size.toArray(),
      maxDimension: maxDim,
      cameraDistance: distance,
      center: center.toArray()
    })
    
    // Position camera at an angle that shows the object well
    const direction = new THREE.Vector3(1, 0.75, 1.5).normalize()
    const newPosition = center.clone().add(direction.clone().multiplyScalar(distance))
    cameraRef.current.position.copy(newPosition)
    
    // Update controls with object-appropriate limits
    controlsRef.current.target.copy(center)
    controlsRef.current.minDistance = distance * 0.3  // Allow closer zoom
    controlsRef.current.maxDistance = distance * 5    // Allow further zoom
    controlsRef.current.update()
    
    console.log('Camera setup:', {
      position: cameraRef.current.position.toArray(),
      target: center.toArray(),
      distance: distance,
      minDistance: controlsRef.current.minDistance,
      maxDistance: controlsRef.current.maxDistance
    })
  }, [])

  // Initialize Three.js on mount
  useEffect(() => {
    initializeThreeJS()
    animate()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [initializeThreeJS, animate, handleResize])

  // Update scene when limb changes
  useEffect(() => {
    if (!sceneRef.current) return

    // Remove existing limb mesh
    const existingLimb = sceneRef.current.getObjectByName('limb')
    if (existingLimb) {
      sceneRef.current.remove(existingLimb)
    }

    // Add new limb mesh
    if (limb) {
      const limbClone = limb.clone()
      limbClone.name = 'limb'
      limbClone.castShadow = true
      limbClone.receiveShadow = true
      
      // CRITICAL FIX: Don't override GLB materials! Preserve original materials
      console.log('🎯 PRESERVING GLB MATERIALS: Not overriding with gray material')
      
      // Check if this is a GLB with original materials - support ShaderMaterials
      const hasTexture = (mat: THREE.Material): boolean => {
        // Standard materials
        if ('map' in mat && mat.map instanceof THREE.Texture) {
          return true
        }
        // Shader materials with texture uniforms
        if (mat instanceof THREE.ShaderMaterial && mat.uniforms) {
          // Check common uniform names first
          const textureUniforms = ['map', 'diffuse', 'texture', 'baseTexture', 'tDiffuse']
          const hasCommonTexture = textureUniforms.some(uniformName => 
            mat.uniforms[uniformName]?.value instanceof THREE.Texture
          )
          
          // If not found, check ALL uniforms for any texture
          if (!hasCommonTexture) {
            return Object.values(mat.uniforms).some(uniform => 
              uniform?.value instanceof THREE.Texture
            )
          }
          
          return hasCommonTexture
        }
        return false
      }
      
      const hasOriginalMaterials = limbClone.material && 
        (Array.isArray(limbClone.material) ? 
          limbClone.material.some(hasTexture) : 
          hasTexture(limbClone.material))
      
      console.log('🔍 Material analysis:', {
        material: limbClone.material,
        isArray: Array.isArray(limbClone.material),
        hasOriginalMaterials
      })
      
      // Debug ShaderMaterial uniforms
      if (limbClone.material instanceof THREE.ShaderMaterial) {
        console.log('🔍 ShaderMaterial uniforms:', Object.keys(limbClone.material.uniforms))
        Object.entries(limbClone.material.uniforms).forEach(([name, uniform]) => {
          if ((uniform as any)?.value instanceof THREE.Texture) {
            console.log('  🖼️ Texture uniform found:', name, (uniform as any).value)
          }
        })
      }
      
      if (hasOriginalMaterials) {
        console.log('  ✅ GLB has textures - preserving original materials')
        // Keep the original GLB materials - don't replace them!
      } else {
        console.log('  📄 No textures found - applying default gray material')
        // Only apply gray material if no original materials exist
        const limbMaterial = new THREE.MeshLambertMaterial({
          color: 0x808080,
          transparent: false
        })
        limbClone.material = limbMaterial
      }
      
      sceneRef.current.add(limbClone)
      
      // Fit camera to new object
      setTimeout(fitCameraToObject, 100)
    }
  }, [limb, fitCameraToObject])

  // Update markings visualization
  useEffect(() => {
    if (!sceneRef.current) return

    // Remove existing markings
    const existingMarkings = sceneRef.current.children.filter(child => 
      child.name.startsWith('marking-')
    )
    existingMarkings.forEach(marking => sceneRef.current!.remove(marking))

    // Add new markings
    markings.forEach(marking => {
      const markingObject = createMarkingVisualization(marking)
      if (markingObject) {
        markingObject.name = `marking-${marking.id}`
        sceneRef.current!.add(markingObject)
      }
    })
  }, [markings])

  // Toggle grid visibility
  useEffect(() => {
    if (!sceneRef.current) return
    
    const grid = sceneRef.current.getObjectByName('grid')
    if (grid) {
      grid.visible = showGrid
    }
  }, [showGrid])

  /**
   * Create 3D visualization for a marking
   */
  const createMarkingVisualization = (marking: any): THREE.Object3D | null => {
    const group = new THREE.Group()
    
    // Color mapping for marking classes
    const colorMap = {
      trimline: 0xff0000,     // Red
      relief_tender: 0x00ff00, // Green  
      pad_load: 0x0000ff,     // Blue
      landmark: 0xffff00      // Yellow
    }
    
    const color = colorMap[marking.cls as keyof typeof colorMap] || 0xff00ff
    
    if (marking.geom.kind === 'polyline') {
      // Create line visualization
      const points = marking.geom.points.map((p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]))
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({ 
        color, 
        linewidth: 3,
        transparent: true,
        opacity: 0.8
      })
      const line = new THREE.Line(geometry, material)
      group.add(line)
      
      // Add small spheres at key points
      points.forEach((point: THREE.Vector3, i: number) => {
        if (i % 5 === 0) { // Only every 5th point to avoid clutter
          const sphereGeometry = new THREE.SphereGeometry(2, 8, 6)
          const sphereMaterial = new THREE.MeshBasicMaterial({ color })
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
          sphere.position.copy(point)
          group.add(sphere)
        }
      })
    } else if (marking.geom.kind === 'polygon') {
      // Create polygon visualization (wireframe + semi-transparent fill)
      const points = marking.geom.points.map((p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]))
      
      // Wireframe
      points.push(points[0]) // Close the loop
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color, 
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      })
      const line = new THREE.LineLoop(lineGeometry, lineMaterial)
      group.add(line)
    }
    
    return group
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'r':
          if (!event.ctrlKey && !event.metaKey) {
            fitCameraToObject()
            event.preventDefault()
          }
          break
        case 'g':
          if (!event.ctrlKey && !event.metaKey) {
            setShowGrid(prev => !prev)
            event.preventDefault()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitCameraToObject])

  return (
    <div className={`canvas3d-container ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      
      {/* FPS Counter */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        FPS: {fps}
      </div>

      {/* Grid Toggle */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '4px',
        padding: '4px'
      }}>
        <label style={{ color: 'white', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            style={{ marginRight: '4px' }}
          />
          Grid (G)
        </label>
      </div>

      {/* Instructions overlay when no content */}
      {!limb && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666',
          fontSize: '18px',
          pointerEvents: 'none'
        }}>
          <div>Load a limb mesh to begin</div>
          <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>
            R: Reset view • G: Toggle grid
          </div>
        </div>
      )}
    </div>
  )
}

export default Canvas3D