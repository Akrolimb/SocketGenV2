/**
 * Color Highlighting Worker
 * 
 * Performs GPU-accelerated texture analysis and color segmentation
 * for real-time mesh highlighting based on HSV color matching.
 * 
 * Architecture:
 * - Canvas-based texture processing for pixel-level analysis
 * - HSV color space conversion for robust color matching
 * - Efficient UV coordinate mapping for mesh highlighting
 * - Configurable tolerance and threshold parameters
 */

import * as THREE from 'three'

// Types for worker communication
interface ColorHighlightRequest {
  type: 'analyze' | 'highlight' | 'clear'
  imageData?: ImageData
  texture?: THREE.Texture
  targetColor?: { h: number, s: number, v: number }
  tolerance?: { h: number, s: number, v: number }
  uvCoordinates?: Float32Array
}

interface ColorHighlightResponse {
  type: 'analysis-complete' | 'highlight-ready' | 'error'
  highlightMask?: Uint8Array
  matchingPixels?: number
  coverage?: number
  error?: string
}

/**
 * Convert RGB to HSV color space for robust color matching
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  let s = max === 0 ? 0 : delta / max
  let v = max

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h /= 6
  }

  if (h < 0) h += 1

  return [h * 360, s * 100, v * 100]
}

/**
 * Check if two HSV colors match within tolerance with improved logic
 */
function colorMatches(
  hsv1: [number, number, number], 
  hsv2: [number, number, number], 
  tolerance: { h: number, s: number, v: number }
): boolean {
  const [h1, s1, v1] = hsv1
  const [h2, s2, v2] = hsv2

  // Handle hue wraparound (0° = 360°)
  let hDiff = Math.abs(h1 - h2)
  if (hDiff > 180) {
    hDiff = 360 - hDiff
  }

  // SIMPLE COLOR MATCHING - no complex logic
  const hueMatch = hDiff <= tolerance.h
  const satMatch = Math.abs(s1 - s2) <= tolerance.s
  const valMatch = Math.abs(v1 - v2) <= tolerance.v

  return hueMatch && satMatch && valMatch
}

function analyzeTexture(
  imageData: ImageData, 
  targetColor: { h: number, s: number, v: number }
): { mask: Uint8Array, stats: { matchingPixels: number, coverage: number } } {
  
  const { width, height, data } = imageData
  const mask = new Uint8Array(width * height)
  const targetHSV: [number, number, number] = [targetColor.h, targetColor.s, targetColor.v]
  
  // Simple fixed tolerance
  const tolerance = { h: 15, s: 25, v: 30 }
  
  let matchingPixels = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      // Skip transparent pixels
      if (a < 128) continue

      const pixelHSV = rgbToHsv(r, g, b)
      
      if (colorMatches(pixelHSV, targetHSV, tolerance)) {
        mask[y * width + x] = 255
        matchingPixels++
      }
    }
  }

  const coverage = matchingPixels / (width * height)

  return {
    mask,
    stats: { matchingPixels, coverage }
  }
}

// Worker message handler
self.onmessage = function(e: MessageEvent<ColorHighlightRequest>) {
  const { type, imageData, targetColor } = e.data

  try {
    switch (type) {
      case 'analyze':
        if (!imageData || !targetColor) {
          throw new Error('Missing required parameters for analysis')
        }

        console.log('🎨 Worker: Analyzing texture for color matching...')
        
        const result = analyzeTexture(imageData, targetColor)
        
        console.log('🎯 Color matching results:', {
          matchingPixels: result.stats.matchingPixels,
          coverage: `${(result.stats.coverage * 100).toFixed(2)}%`
        })
        
        const response: ColorHighlightResponse = {
          type: 'analysis-complete',
          highlightMask: result.mask,
          matchingPixels: result.stats.matchingPixels,
          coverage: result.stats.coverage
        }

        self.postMessage(response)
        break

      case 'clear':
        const clearResponse: ColorHighlightResponse = {
          type: 'highlight-ready',
          highlightMask: new Uint8Array(0)
        }
        self.postMessage(clearResponse)
        break

      default:
        throw new Error(`Unknown request type: ${type}`)
    }
  } catch (error) {
    const errorResponse: ColorHighlightResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    self.postMessage(errorResponse)
  }
}

export type { ColorHighlightRequest, ColorHighlightResponse }