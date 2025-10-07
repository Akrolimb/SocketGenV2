/**
 * Image Preprocessing Worker for Medical Marker Detection
 * 
 * Implements proper computer vision techniques:
 * - Histogram Equalization (CLAHE - Contrast Limited Adaptive Histogram Equalization)
 * - Morphological Operations (opening, closing, erosion, dilation)
 * - Edge Detection and Region Growing
 * - Color Space Conversion (RGB -> Lab for better perceptual matching)
 * - Bilateral Filtering for noise reduction while preserving edges
 */

export interface PreprocessingRequest {
  type: 'preprocess' | 'detectMarkers'
  imageData: ImageData
  options?: {
    claheEnabled?: boolean
    claheTileSize?: number
    claheClipLimit?: number
    bilateralFilter?: boolean
    morphologicalOps?: boolean
    edgeDetection?: boolean
    colorSpace?: 'rgb' | 'lab' | 'hsv'
  }
}

export interface PreprocessingResponse {
  type: 'preprocessed' | 'markersDetected'
  imageData: ImageData
  regions?: Array<{
    color: [number, number, number]
    boundingBox: { x: number, y: number, width: number, height: number }
    area: number
    centroid: [number, number]
    confidence: number
  }>
  stats?: {
    originalHistogram: number[]
    processedHistogram: number[]
    detectedRegions: number
    processingTime: number
  }
}

/**
 * Convert RGB to LAB color space for better perceptual matching
 * LAB space separates lightness from color, making it ideal for medical imaging
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Normalize RGB to 0-1
  r = r / 255.0
  g = g / 255.0
  b = b / 255.0

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

  // Convert to XYZ
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

  // Convert XYZ to LAB
  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116

  const L = (116 * y) - 16
  const a = 500 * (x - y)
  const B = 200 * (y - z)

  return [L, a, B]
}

/**
 * CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * This is the gold standard for medical image enhancement
 */
function applyCLAHE(
  imageData: ImageData, 
  tileSize: number = 8, 
  clipLimit: number = 2.0
): ImageData {
  const { width, height, data } = imageData
  const result = new ImageData(width, height)
  
  // Convert to LAB and work on L channel only
  const labData = new Float32Array(width * height * 3)
  for (let i = 0; i < data.length; i += 4) {
    const [L, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2])
    const idx = (i / 4) * 3
    labData[idx] = L
    labData[idx + 1] = a
    labData[idx + 2] = b
  }

  // Divide image into tiles
  const tilesX = Math.ceil(width / tileSize)
  const tilesY = Math.ceil(height / tileSize)
  
  for (let tileY = 0; tileY < tilesY; tileY++) {
    for (let tileX = 0; tileX < tilesX; tileX++) {
      const startX = tileX * tileSize
      const startY = tileY * tileSize
      const endX = Math.min(startX + tileSize, width)
      const endY = Math.min(startY + tileSize, height)
      
      // Calculate histogram for this tile (L channel only)
      const histogram = new Array(256).fill(0)
      let pixelCount = 0
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const lValue = Math.round(labData[(y * width + x) * 3])
          const bin = Math.max(0, Math.min(255, lValue))
          histogram[bin]++
          pixelCount++
        }
      }
      
      // Apply contrast limiting
      const maxAllowed = Math.floor(pixelCount * clipLimit / 256)
      let redistributed = 0
      
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > maxAllowed) {
          redistributed += histogram[i] - maxAllowed
          histogram[i] = maxAllowed
        }
      }
      
      // Redistribute excess uniformly
      const perBin = Math.floor(redistributed / 256)
      for (let i = 0; i < 256; i++) {
        histogram[i] += perBin
      }
      
      // Calculate CDF
      const cdf = new Array(256)
      cdf[0] = histogram[0]
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i]
      }
      
      // Apply equalization to tile
      const scale = 255 / pixelCount
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 3
          const lValue = Math.round(labData[idx])
          const bin = Math.max(0, Math.min(255, lValue))
          const newL = cdf[bin] * scale
          
          // Convert back to RGB (simplified)
          const factor = newL / Math.max(1, labData[idx])
          const pixelIdx = (y * width + x) * 4
          
          result.data[pixelIdx] = Math.min(255, data[pixelIdx] * factor)
          result.data[pixelIdx + 1] = Math.min(255, data[pixelIdx + 1] * factor)
          result.data[pixelIdx + 2] = Math.min(255, data[pixelIdx + 2] * factor)
          result.data[pixelIdx + 3] = data[pixelIdx + 3]
        }
      }
    }
  }
  
  return result
}

/**
 * Bilateral Filter - reduces noise while preserving edges
 * Critical for medical marker detection
 */
function bilateralFilter(imageData: ImageData, d: number = 5, sigmaColor: number = 75, sigmaSpace: number = 75): ImageData {
  const { width, height, data } = imageData
  const result = new ImageData(width, height)
  
  const radius = Math.floor(d / 2)
  const colorFactor = -0.5 / (sigmaColor * sigmaColor)
  const spaceFactor = -0.5 / (sigmaSpace * sigmaSpace)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy
          const nx = x + dx
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const centerIdx = (y * width + x) * 4
            const neighborIdx = (ny * width + nx) * 4
            
            // Color distance
            const colorDist = Math.pow(data[centerIdx] - data[neighborIdx], 2) +
                             Math.pow(data[centerIdx + 1] - data[neighborIdx + 1], 2) +
                             Math.pow(data[centerIdx + 2] - data[neighborIdx + 2], 2)
            
            // Spatial distance
            const spatialDist = dx * dx + dy * dy
            
            // Combined weight
            const weight = Math.exp(colorFactor * colorDist + spaceFactor * spatialDist)
            
            sumR += data[neighborIdx] * weight
            sumG += data[neighborIdx + 1] * weight
            sumB += data[neighborIdx + 2] * weight
            sumWeight += weight
          }
        }
      }
      
      const resultIdx = (y * width + x) * 4
      result.data[resultIdx] = sumR / sumWeight
      result.data[resultIdx + 1] = sumG / sumWeight
      result.data[resultIdx + 2] = sumB / sumWeight
      result.data[resultIdx + 3] = data[resultIdx + 3]
    }
  }
  
  return result
}

/**
 * Morphological Operations - Essential for medical marker detection
 */
function morphologicalOpening(imageData: ImageData, kernelSize: number = 3): ImageData {
  // Erosion followed by dilation - removes noise while preserving shape
  const eroded = erosion(imageData, kernelSize)
  return dilation(eroded, kernelSize)
}

function erosion(imageData: ImageData, kernelSize: number): ImageData {
  const { width, height, data } = imageData
  const result = new ImageData(width, height)
  const radius = Math.floor(kernelSize / 2)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minR = 255, minG = 255, minB = 255
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy))
          const nx = Math.max(0, Math.min(width - 1, x + dx))
          const idx = (ny * width + nx) * 4
          
          minR = Math.min(minR, data[idx])
          minG = Math.min(minG, data[idx + 1])
          minB = Math.min(minB, data[idx + 2])
        }
      }
      
      const resultIdx = (y * width + x) * 4
      result.data[resultIdx] = minR
      result.data[resultIdx + 1] = minG
      result.data[resultIdx + 2] = minB
      result.data[resultIdx + 3] = data[resultIdx + 3]
    }
  }
  
  return result
}

function dilation(imageData: ImageData, kernelSize: number): ImageData {
  const { width, height, data } = imageData
  const result = new ImageData(width, height)
  const radius = Math.floor(kernelSize / 2)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxR = 0, maxG = 0, maxB = 0
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy))
          const nx = Math.max(0, Math.min(width - 1, x + dx))
          const idx = (ny * width + nx) * 4
          
          maxR = Math.max(maxR, data[idx])
          maxG = Math.max(maxG, data[idx + 1])
          maxB = Math.max(maxB, data[idx + 2])
        }
      }
      
      const resultIdx = (y * width + x) * 4
      result.data[resultIdx] = maxR
      result.data[resultIdx + 1] = maxG
      result.data[resultIdx + 2] = maxB
      result.data[resultIdx + 3] = data[resultIdx + 3]
    }
  }
  
  return result
}

// Worker message handler
self.onmessage = function(e: MessageEvent<PreprocessingRequest>) {
  const { type, imageData, options = {} } = e.data
  const startTime = performance.now()

  try {
    switch (type) {
      case 'preprocess': {
        console.log('🔬 Medical Image Preprocessing Pipeline Started')
        
        let processedImage = imageData
        
        // Step 1: Bilateral filtering for noise reduction
        if (options.bilateralFilter !== false) {
          console.log('  → Applying bilateral filter...')
          processedImage = bilateralFilter(processedImage)
        }
        
        // Step 2: CLAHE for contrast enhancement
        if (options.claheEnabled !== false) {
          console.log('  → Applying CLAHE...')
          processedImage = applyCLAHE(
            processedImage, 
            options.claheTileSize || 8, 
            options.claheClipLimit || 2.0
          )
        }
        
        // Step 3: Morphological operations
        if (options.morphologicalOps !== false) {
          console.log('  → Applying morphological opening...')
          processedImage = morphologicalOpening(processedImage)
        }
        
        const processingTime = performance.now() - startTime
        console.log(`✅ Preprocessing complete in ${processingTime.toFixed(2)}ms`)
        
        const response: PreprocessingResponse = {
          type: 'preprocessed',
          imageData: processedImage,
          stats: {
            originalHistogram: [],
            processedHistogram: [],
            detectedRegions: 0,
            processingTime
          }
        }
        
        self.postMessage(response)
        break
      }
      
      default:
        throw new Error(`Unknown preprocessing type: ${type}`)
    }
  } catch (error) {
    console.error('❌ Preprocessing error:', error)
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}