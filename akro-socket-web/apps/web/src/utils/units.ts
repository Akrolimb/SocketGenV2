import { z } from 'zod'
import type { Units } from '../types'

/**
 * Attempts to infer units from a glTF asset or mesh bounding box
 * @param asset GLTFLoader result or THREE.Mesh
 * @returns inferred units or null if cannot determine
 */
export function inferUnitsFromAsset(asset: any): Units | null {
  // Check for glTF asset extras with unit information
  if (asset?.parser?.json?.asset?.extras?.metersPerUnit) {
    const metersPerUnit = asset.parser.json.asset.extras.metersPerUnit
    if (metersPerUnit === 0.001) return 'mm'
    if (metersPerUnit === 0.01) return 'cm'  
    if (metersPerUnit === 1.0) return 'm'
  }

  // Check common glTF unit patterns
  if (asset?.parser?.json?.asset?.generator?.includes('mm')) return 'mm'
  if (asset?.parser?.json?.asset?.generator?.includes('cm')) return 'cm'
  if (asset?.parser?.json?.asset?.generator?.includes('meter')) return 'm'

  return null
}

/**
 * Estimates units based on bounding box size
 * Prosthetic limbs are typically 30-80cm long
 * @param bbox Bounding box dimensions [width, height, depth]
 * @returns estimated units
 */
export function estimateUnitsFromSize(bbox: [number, number, number]): Units {
  const maxDimension = Math.max(...bbox)
  const minDimension = Math.min(...bbox)
  
  console.log('Estimating units from size:', { 
    bbox, 
    maxDimension, 
    minDimension,
    width: bbox[0],
    height: bbox[1], 
    depth: bbox[2]
  })
  
  // Prosthetic limbs are typically:
  // - 300-800mm tall (0.3-0.8m) 
  // - 50-150mm diameter (0.05-0.15m)
  
  // If max dimension is 300-800, likely mm (typical prosthetic height)
  if (maxDimension >= 300 && maxDimension <= 800) {
    console.log('Detected units: mm (prosthetic limb size range)')
    return 'mm'
  }
  
  // If max dimension is 30-80, likely cm (scaled down prosthetic)
  if (maxDimension >= 30 && maxDimension <= 80) {
    console.log('Detected units: cm (scaled prosthetic limb)')
    return 'cm'
  }
  
  // If max dimension is 0.3-0.8, likely meters (real-world scale)
  if (maxDimension >= 0.3 && maxDimension <= 0.8) {
    console.log('Detected units: m (real-world prosthetic scale)')
    return 'm'
  }
  
  // For very small objects, they're probably incorrectly scaled
  if (maxDimension < 0.3) {
    console.log('Very small dimension detected - likely scaling issue')
    
    // Check aspect ratio - prosthetics are typically tall and narrow
    const sortedDims = [...bbox].sort((a, b) => b - a) // largest to smallest
    const aspectRatio = sortedDims[0] / (sortedDims[1] || 0.001) // height/width ratio
    
    console.log('Aspect ratio (largest/second):', aspectRatio, 'sorted dims:', sortedDims)
    
    if (aspectRatio > 3) {
      console.log('High aspect ratio suggests tall/narrow object - assuming meters')
      return 'm'
    } else {
      console.log('Low aspect ratio - probably incorrectly scaled - defaulting to mm')
      return 'mm'
    }
  }
  
  // Default fallback based on scale
  console.log('Using fallback unit detection for dimension:', maxDimension)
  if (maxDimension > 100) {
    console.log('Large dimension > 100, assuming mm')
    return 'mm'
  }
  if (maxDimension > 1) {
    console.log('Medium dimension > 1, assuming cm') 
    return 'cm'
  }
  console.log('Small dimension <= 1, assuming meters')
  return 'm'
}

/**
 * Converts units to a common base (mm) for calculations
 */
export function unitsToMillimeters(value: number, units: Units): number {
  switch (units) {
    case 'mm': return value
    case 'cm': return value * 10
    case 'm': return value * 1000
    default: return value
  }
}

/**
 * Converts millimeters to specified units
 */
export function millimetersToUnits(value: number, units: Units): number {
  switch (units) {
    case 'mm': return value
    case 'cm': return value / 10
    case 'm': return value / 1000
    default: return value
  }
}

/**
 * Scale factor between units
 */
export function getScaleFactor(fromUnits: Units, toUnits: Units): number {
  const fromMM = unitsToMillimeters(1, fromUnits)
  return millimetersToUnits(fromMM, toUnits)
}

/**
 * Format dimension for display
 */
export function formatDimension(value: number, units: Units, precision = 1): string {
  return `${value.toFixed(precision)}${units}`
}

/**
 * Validation schema for units
 */
export const UnitsValidation = z.enum(['mm', 'cm', 'm'])

/**
 * Parse and validate units from string
 */
export function parseUnits(unitsStr: string): Units {
  const parsed = UnitsValidation.safeParse(unitsStr.toLowerCase())
  return parsed.success ? parsed.data : 'mm'
}