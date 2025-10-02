import * as THREE from 'three'

/**
 * Generate a synthetic texture with colored markings for testing
 */
export function generateTestTexture(width: number = 256, height: number = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')
  
  // Create a gradient base to simulate skin color variation
  const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2)
  gradient.addColorStop(0, '#e8c4a0')  // Lighter center
  gradient.addColorStop(0.7, '#d4a574') // Medium skin tone
  gradient.addColorStop(1, '#c19356')   // Darker edges
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  
  // Add realistic skin texture variation
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width
    const y = Math.floor((i / 4) / width)
    
    // Add subtle noise that varies by position
    const noiseScale = 0.02
    const noise1 = Math.sin(x * noiseScale) * Math.cos(y * noiseScale) * 15
    const noise2 = (Math.random() - 0.5) * 20
    const totalNoise = noise1 + noise2
    
    data[i] = Math.max(0, Math.min(255, data[i] + totalNoise))     // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + totalNoise * 0.8)) // G (less variation)
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + totalNoise * 0.6)) // B (even less variation)
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  // Add realistic colored markings for prosthetic socket design
  
  // Red tender area markings (pressure sensitive zones)
  ctx.fillStyle = '#e74c3c'
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.ellipse(width * 0.25, height * 0.15, 25, 18, Math.PI * 0.1, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.beginPath()
  ctx.ellipse(width * 0.8, height * 0.3, 20, 15, -Math.PI * 0.15, 0, Math.PI * 2)
  ctx.fill()
  
  // Blue load bearing areas (can handle pressure)
  ctx.fillStyle = '#3498db'
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.ellipse(width * 0.6, height * 0.5, 35, 25, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.beginPath()
  ctx.ellipse(width * 0.2, height * 0.6, 30, 22, Math.PI * 0.2, 0, Math.PI * 2)
  ctx.fill()
  
  // Green anatomical landmarks
  ctx.fillStyle = '#27ae60'
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.rect(width * 0.05, height * 0.8, 15, 25)
  ctx.fill()
  
  ctx.beginPath()
  ctx.rect(width * 0.9, height * 0.7, 12, 20)
  ctx.fill()
  
  // Purple trimline (socket boundary)
  ctx.strokeStyle = '#8e44ad'
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, height * 0.85)
  for (let x = 0; x < width; x += 3) {
    const y = height * 0.85 + Math.sin(x * 0.015) * 8 + Math.cos(x * 0.03) * 4
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  
  // Orange/yellow marking spots (additional landmarks)
  const markingColors = ['#f39c12', '#e67e22', '#f1c40f', '#d35400']
  ctx.globalAlpha = 0.7
  
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = markingColors[Math.floor(Math.random() * markingColors.length)]
    const x = Math.random() * width
    const y = Math.random() * height
    const size = 6 + Math.random() * 8
    
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // Reset alpha
  ctx.globalAlpha = 1.0
  
  return canvas
}

/**
 * Create a synthetic limb texture and add it to the scene
 */
export function createSyntheticTexture(): THREE.Texture {
  const canvas = generateTestTexture(512, 512)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  
  return texture
}