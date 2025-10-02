import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { validateMeshFile, validateMeshFiles } from '../utils/gltf'
import { analyzeMaterials, rgbToHsv } from '../utils/materials'

describe('File Validation', () => {
  it('should validate supported file extensions', () => {
    const glbFile = new File([], 'test.glb', { type: 'model/gltf-binary' })
    const objFile = new File([], 'test.obj', { type: 'text/plain' })
    const stlFile = new File([], 'test.stl', { type: 'application/octet-stream' })
    
    expect(validateMeshFile(glbFile)).toEqual({ valid: true, extension: 'glb' })
    expect(validateMeshFile(objFile)).toEqual({ valid: true, extension: 'obj' })
    expect(validateMeshFile(stlFile)).toEqual({ valid: true, extension: 'stl' })
  })
  
  it('should reject unsupported file extensions', () => {
    const txtFile = new File([], 'test.txt', { type: 'text/plain' })
    const jpgFile = new File([], 'test.jpg', { type: 'image/jpeg' })
    
    expect(validateMeshFile(txtFile).valid).toBe(false)
    expect(validateMeshFile(jpgFile).valid).toBe(false)
  })
  
  it('should reject files without extensions', () => {
    const noExtFile = new File([], 'test', { type: 'application/octet-stream' })
    expect(validateMeshFile(noExtFile).valid).toBe(false)
    expect(validateMeshFile(noExtFile).error).toContain('Unsupported file type')
  })
  
  it('should validate OBJ + MTL combinations', () => {
    const objFile = new File([], 'test.obj', { type: 'text/plain' })
    const mtlFile = new File([], 'test.mtl', { type: 'text/plain' })
    
    expect(validateMeshFiles([objFile, mtlFile]).valid).toBe(true)
    expect(validateMeshFiles([objFile]).valid).toBe(true)
  })
})

describe('Material Analysis', () => {
  it('should analyze basic material properties', () => {
    // Create a simple mesh with a standard material
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.5,
      metalness: 0.2
    })
    const mesh = new THREE.Mesh(geometry, material)
    
    const analysis = analyzeMaterials(mesh)
    
    expect(analysis).toHaveLength(1)
    expect(analysis[0].type).toBe('MeshStandardMaterial')
    expect(analysis[0].color.getHex()).toBe(0xff0000)
    expect(analysis[0].properties.roughness).toBe(0.5)
    expect(analysis[0].properties.metalness).toBe(0.2)
  })
  
  it('should handle multiple materials', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff0000 }),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    ]
    const mesh = new THREE.Mesh(geometry, materials)
    
    const analysis = analyzeMaterials(mesh)
    
    expect(analysis).toHaveLength(2)
    expect(analysis[0].color.getHex()).toBe(0xff0000)
    expect(analysis[1].color.getHex()).toBe(0x00ff00)
  })
  
  it('should detect texture presence', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const texture = new THREE.Texture()
    texture.image = { width: 256, height: 256 }
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture
    })
    const mesh = new THREE.Mesh(geometry, material)
    
    const analysis = analyzeMaterials(mesh)
    
    expect(analysis[0].hasTexture).toBe(true)
    expect(analysis[0].textureInfo?.width).toBe(256)
    expect(analysis[0].textureInfo?.height).toBe(256)
  })
})

describe('Color Utilities', () => {
  it('should convert RGB to HSV correctly', () => {
    // Test pure red
    const red = rgbToHsv(255, 0, 0)
    expect(red.h).toBeCloseTo(0, 1)
    expect(red.s).toBeCloseTo(100, 1)
    expect(red.v).toBeCloseTo(100, 1)
    
    // Test pure green
    const green = rgbToHsv(0, 255, 0)
    expect(green.h).toBeCloseTo(120, 1)
    expect(green.s).toBeCloseTo(100, 1)
    expect(green.v).toBeCloseTo(100, 1)
    
    // Test pure blue
    const blue = rgbToHsv(0, 0, 255)
    expect(blue.h).toBeCloseTo(240, 1)
    expect(blue.s).toBeCloseTo(100, 1)
    expect(blue.v).toBeCloseTo(100, 1)
    
    // Test grayscale
    const gray = rgbToHsv(128, 128, 128)
    expect(gray.s).toBeCloseTo(0, 1)
    expect(gray.v).toBeCloseTo(50.2, 1)
  })
})