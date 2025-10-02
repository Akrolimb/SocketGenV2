/**
 * Highlight Shader System
 * 
 * Custom Three.js shaders for non-destructive color highlighting
 * that preserves original materials while overlaying color-based highlights.
 * 
 * Architecture:
 * - Vertex shader handles UV coordinate transformation
 * - Fragment shader performs texture sampling and highlight blending
 * - Supports configurable highlight colors and opacity
 * - Performance optimized for real-time interaction
 */

import * as THREE from 'three'

/**
 * Vertex shader for highlight system
 * Passes through UV coordinates and world position for fragment shader
 */
export const highlightVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Fragment shader for highlight system
 * Blends original texture with highlight overlay based on mask
 */
export const highlightFragmentShader = `
  uniform sampler2D originalTexture;
  uniform sampler2D highlightMask;
  uniform vec3 highlightColor;
  uniform float highlightOpacity;
  uniform float highlightIntensity;
  uniform bool enableHighlight;
  uniform vec3 baseColor;
  uniform float roughness;
  uniform float metalness;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  // Simplified PBR lighting calculation
  vec3 calculateLighting(vec3 albedo, vec3 normal, vec3 lightDir, vec3 viewDir) {
    vec3 halfVector = normalize(lightDir + viewDir);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotH = max(dot(normal, halfVector), 0.0);
    
    // Simple Lambert diffuse
    vec3 diffuse = albedo * NdotL;
    
    // Simple specular reflection
    float specular = pow(NdotH, 32.0) * (1.0 - roughness);
    
    return diffuse + vec3(specular);
  }

  void main() {
    // Sample original texture
    vec4 originalColor = texture2D(originalTexture, vUv);
    vec3 finalColor = originalColor.rgb * baseColor;
    
    if (enableHighlight) {
      // Sample highlight mask
      float maskValue = texture2D(highlightMask, vUv).r;
      
      if (maskValue > 0.5) {
        // Apply highlight effect
        vec3 highlight = highlightColor * highlightIntensity;
        
        // Blend highlight with original color
        finalColor = mix(finalColor, highlight, highlightOpacity * maskValue);
        
        // Add subtle glow effect
        finalColor += highlightColor * 0.1 * maskValue;
      }
    }
    
    // Simple lighting
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    
    finalColor = calculateLighting(finalColor, normal, lightDir, viewDir);
    
    gl_FragColor = vec4(finalColor, originalColor.a);
  }
`

/**
 * Create a highlight material that preserves original appearance
 * while allowing overlay of color-based highlights
 */
export function createHighlightMaterial(
  originalTexture: THREE.Texture,
  options: {
    highlightColor?: THREE.Color
    highlightOpacity?: number
    highlightIntensity?: number
    baseColor?: THREE.Color
    roughness?: number
    metalness?: number
  } = {}
): THREE.ShaderMaterial {
  
  const {
    highlightColor = new THREE.Color(0xff6b6b),
    highlightOpacity = 0.7,
    highlightIntensity = 1.5,
    baseColor = new THREE.Color(0xffffff),
    roughness = 0.5,
    metalness = 0.0
  } = options

  // Create empty highlight mask texture
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = 256
  maskCanvas.height = 256
  const maskContext = maskCanvas.getContext('2d')!
  maskContext.fillStyle = 'black'
  maskContext.fillRect(0, 0, 256, 256)
  
  const maskTexture = new THREE.CanvasTexture(maskCanvas)
  maskTexture.needsUpdate = true

  const material = new THREE.ShaderMaterial({
    vertexShader: highlightVertexShader,
    fragmentShader: highlightFragmentShader,
    uniforms: {
      originalTexture: { value: originalTexture },
      highlightMask: { value: maskTexture },
      highlightColor: { value: highlightColor },
      highlightOpacity: { value: highlightOpacity },
      highlightIntensity: { value: highlightIntensity },
      enableHighlight: { value: false },
      baseColor: { value: baseColor },
      roughness: { value: roughness },
      metalness: { value: metalness }
    },
    transparent: true,
    side: THREE.DoubleSide
  })

  return material
}

/**
 * Update highlight mask texture with new mask data
 */
export function updateHighlightMask(
  material: THREE.ShaderMaterial,
  maskData: Uint8Array,
  width: number,
  height: number
): void {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const context = canvas.getContext('2d')!
  const imageData = context.createImageData(width, height)
  
  // Convert grayscale mask to RGBA
  for (let i = 0; i < maskData.length; i++) {
    const value = maskData[i]
    const idx = i * 4
    imageData.data[idx] = value     // R
    imageData.data[idx + 1] = value // G
    imageData.data[idx + 2] = value // B
    imageData.data[idx + 3] = 255   // A
  }
  
  context.putImageData(imageData, 0, 0)
  
  // Update material texture
  const maskTexture = new THREE.CanvasTexture(canvas)
  maskTexture.needsUpdate = true
  
  material.uniforms.highlightMask.value = maskTexture
  material.uniforms.enableHighlight.value = true
  material.needsUpdate = true
}

/**
 * Clear all highlights from material
 */
export function clearHighlights(material: THREE.ShaderMaterial): void {
  material.uniforms.enableHighlight.value = false
  material.needsUpdate = true
}

/**
 * Update highlight color and properties
 */
export function updateHighlightProperties(
  material: THREE.ShaderMaterial,
  properties: {
    color?: THREE.Color
    opacity?: number
    intensity?: number
  }
): void {
  if (properties.color) {
    material.uniforms.highlightColor.value = properties.color
  }
  if (properties.opacity !== undefined) {
    material.uniforms.highlightOpacity.value = properties.opacity
  }
  if (properties.intensity !== undefined) {
    material.uniforms.highlightIntensity.value = properties.intensity
  }
  material.needsUpdate = true
}