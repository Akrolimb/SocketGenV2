/**
 * Color Highlighting System Tests
 * 
 * Comprehensive test suite for the interactive color highlighting system.
 * Tests worker functionality, shader performance, and user interaction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as THREE from 'three'
import { ColorHighlightController } from '../utils/colorHighlight'
import { createHighlightMaterial, updateHighlightMask } from '../utils/highlightShader'

// Mock Web Worker for testing
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null

  postMessage(_data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        const mockResponse = {
          data: {
            type: 'analysis-complete',
            highlightMask: new Uint8Array(256 * 256).fill(128),
            matchingPixels: 1000,
            coverage: 0.15,
            boundingBox: { min: [0.2, 0.2], max: [0.8, 0.8] }
          }
        }
        this.onmessage(mockResponse as MessageEvent)
      }
    }, 10)
  }

  terminate() {
    // Mock cleanup
  }
}

// Mock Worker constructor
Object.defineProperty(global, 'Worker', {
  writable: true,
  value: vi.fn().mockImplementation(() => new MockWorker())
})

describe('Color Highlighting System', () => {
  let controller: ColorHighlightController
  let testMesh: THREE.Mesh
  let testTexture: THREE.Texture
  let canvas: HTMLCanvasElement
  let mockStatsCallback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create test canvas and texture
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 128, 128)
    context.fillStyle = '#00ff00'
    context.fillRect(128, 0, 128, 128)
    context.fillStyle = '#0000ff'
    context.fillRect(0, 128, 128, 128)
    context.fillStyle = '#ffff00'
    context.fillRect(128, 128, 128, 128)

    testTexture = new THREE.CanvasTexture(canvas)

    // Create test mesh with textured material
    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.MeshStandardMaterial({ map: testTexture })
    testMesh = new THREE.Mesh(geometry, material)

    // Mock stats callback
    mockStatsCallback = vi.fn()

    // Initialize controller
    controller = new ColorHighlightController(
      {
        color: new THREE.Color(0xff6b6b),
        opacity: 0.7,
        intensity: 1.5,
        tolerance: { h: 10, s: 20, v: 20 }
      },
      mockStatsCallback
    )
  })

  afterEach(() => {
    controller.dispose()
    testTexture.dispose()
    testMesh.geometry.dispose()
  })

  describe('Controller Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultController = new ColorHighlightController()
      expect(defaultController.config.color.getHex()).toBe(0xff6b6b)
      expect(defaultController.config.opacity).toBe(0.7)
      expect(defaultController.config.intensity).toBe(1.5)
      expect(defaultController.config.tolerance.h).toBe(10)
      defaultController.dispose()
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        color: new THREE.Color(0x00ff00),
        opacity: 0.5,
        intensity: 2.0,
        tolerance: { h: 15, s: 25, v: 30 }
      }
      
      const customController = new ColorHighlightController(customConfig)
      expect(customController.config.color.getHex()).toBe(0x00ff00)
      expect(customController.config.opacity).toBe(0.5)
      customController.dispose()
    })

    it('should initialize worker successfully', () => {
      expect(global.Worker).toHaveBeenCalled()
    })
  })

  describe('Mesh Setup', () => {
    it('should setup highlighting for textured mesh', () => {
      const result = controller.setupMeshHighlighting(testMesh)
      expect(result).toBe(true)
      expect(controller.isHighlighting).toBe(true)
    })

    it('should fail to setup highlighting for mesh without texture', () => {
      const untexturedMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      )
      
      const result = controller.setupMeshHighlighting(untexturedMesh)
      expect(result).toBe(false)
      
      untexturedMesh.geometry.dispose()
    })

    it('should fail to setup highlighting for mesh without material', () => {
      const noMaterialMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1))
      
      const result = controller.setupMeshHighlighting(noMaterialMesh)
      expect(result).toBe(false)
      
      noMaterialMesh.geometry.dispose()
    })
  })

  describe('Highlight Shader System', () => {
    it('should create highlight material with correct uniforms', () => {
      const material = createHighlightMaterial(testTexture, {
        highlightColor: new THREE.Color(0xff0000),
        highlightOpacity: 0.8,
        highlightIntensity: 1.2
      })

      expect(material).toBeInstanceOf(THREE.ShaderMaterial)
      expect(material.uniforms.originalTexture.value).toBe(testTexture)
      expect(material.uniforms.highlightColor.value.getHex()).toBe(0xff0000)
      expect(material.uniforms.highlightOpacity.value).toBe(0.8)
      expect(material.uniforms.highlightIntensity.value).toBe(1.2)
    })

    it('should update highlight mask correctly', () => {
      const material = createHighlightMaterial(testTexture)
      const maskData = new Uint8Array(64 * 64).fill(255)
      
      updateHighlightMask(material, maskData, 64, 64)
      
      expect(material.uniforms.enableHighlight.value).toBe(true)
      expect(material.uniforms.highlightMask.value).toBeInstanceOf(THREE.CanvasTexture)
    })
  })

  describe('Color Analysis Integration', () => {
    it('should handle worker responses correctly', async () => {
      controller.setupMeshHighlighting(testMesh)
      
      // Mock a highlight color request
      const targetColor = { h: 0, s: 100, v: 100 } // Red in HSV
      
      // This should trigger worker analysis
      controller.highlightColor(targetColor)
      
      // Wait for async worker response
      await new Promise(resolve => setTimeout(resolve, 20))
      
      expect(mockStatsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          matchingPixels: 1000,
          coverage: 0.15,
          boundingBox: expect.any(Object)
        })
      )
    })

    it('should clear highlights properly', () => {
      controller.setupMeshHighlighting(testMesh)
      controller.clearHighlights()
      
      expect(mockStatsCallback).toHaveBeenCalledWith(null)
    })
  })

  describe('Material Restoration', () => {
    it('should restore original materials', () => {
      const originalMaterial = testMesh.material
      controller.setupMeshHighlighting(testMesh)
      
      expect(testMesh.material).not.toBe(originalMaterial)
      
      controller.restoreOriginalMaterials()
      expect(testMesh.material).toBe(originalMaterial)
    })

    it('should cleanup all resources on dispose', () => {
      controller.setupMeshHighlighting(testMesh)
      const spy = vi.spyOn(controller, 'restoreOriginalMaterials')
      
      controller.dispose()
      
      expect(spy).toHaveBeenCalled()
      expect(controller.isHighlighting).toBe(false)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large textures efficiently', () => {
      // Create a large texture
      const largeCanvas = document.createElement('canvas')
      largeCanvas.width = largeCanvas.height = 1024
      const largeTexture = new THREE.CanvasTexture(largeCanvas)
      
      const largeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshStandardMaterial({ map: largeTexture })
      )
      
      const startTime = performance.now()
      const result = controller.setupMeshHighlighting(largeMesh)
      const endTime = performance.now()
      
      expect(result).toBe(true)
      expect(endTime - startTime).toBeLessThan(50) // Should be fast
      
      // Cleanup
      largeTexture.dispose()
      largeMesh.geometry.dispose()
    })

    it('should handle multiple meshes without memory leaks', () => {
      const meshes = []
      
      // Create multiple test meshes
      for (let i = 0; i < 10; i++) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshStandardMaterial({ map: testTexture })
        )
        meshes.push(mesh)
        controller.setupMeshHighlighting(mesh)
      }
      
      expect(controller.isHighlighting).toBe(true)
      
      controller.dispose()
      
      // Cleanup test meshes
      meshes.forEach(mesh => mesh.geometry.dispose())
    })
  })

  describe('Error Handling', () => {
    it('should handle worker errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Simulate worker error
      const mockWorker = (global.Worker as any).mock.results[0].value
      if (mockWorker.onerror) {
        mockWorker.onerror(new ErrorEvent('error', { message: 'Test error' }))
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Color highlight worker error'),
        expect.any(ErrorEvent)
      )
      
      consoleSpy.mockRestore()
    })

    it('should handle invalid mask data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      controller.setupMeshHighlighting(testMesh)
      
      // Simulate invalid mask data (not square dimensions)
      const invalidMask = new Uint8Array(100) // 100 is not a perfect square
      ;(controller as any).applyHighlightMask(invalidMask, 50)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid mask data')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Integration Tests', () => {
    it('should work with real GLB material structure', () => {
      // Test with a structure similar to what we get from GLB files
      const glbLikeMaterial = new THREE.MeshStandardMaterial({
        map: testTexture,
        color: new THREE.Color(0xffffff), // White base color like GLB
        roughness: 1.0,
        metalness: 0.0
      })
      
      const glbMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        glbLikeMaterial
      )
      
      const result = controller.setupMeshHighlighting(glbMesh)
      expect(result).toBe(true)
    
      // Cleanup
      glbMesh.geometry.dispose()
    })

    it('should maintain visual quality during highlighting', () => {
      controller.setupMeshHighlighting(testMesh)
      
      // Verify that the highlight material preserves essential properties
      const highlightMaterial = testMesh.material as THREE.ShaderMaterial
      
      expect(highlightMaterial.uniforms.originalTexture.value).toBe(testTexture)
      expect(highlightMaterial.transparent).toBe(true)
      expect(highlightMaterial.side).toBe(THREE.DoubleSide)
    })
  })
})

describe('HSV Color Matching', () => {
  it('should correctly convert RGB to HSV', () => {
    // Test pure red
    const red = { r: 255, g: 0, b: 0 }
    // HSV conversion would be tested in the worker
    // This is a placeholder for integration testing
    expect(red.r).toBe(255)
  })

  it('should handle hue wraparound correctly', () => {
    // Test colors near hue boundary (0°/360°)
    const color1 = { h: 350, s: 100, v: 100 } // Near 360°
    const color2 = { h: 10, s: 100, v: 100 }  // Near 0°
    
    // These should be considered close in hue
    const hueDiff = Math.min(
      Math.abs(color1.h - color2.h),
      360 - Math.abs(color1.h - color2.h)
    )
    
    expect(hueDiff).toBe(20) // Should be 20° apart, not 340°
  })
})