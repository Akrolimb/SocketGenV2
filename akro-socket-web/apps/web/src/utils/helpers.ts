import * as THREE from 'three'

/**
 * Generate a unique ID for objects
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Map a value from one range to another
 */
export function mapRange(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const fromRange = fromMax - fromMin
  const toRange = toMax - toMin
  const scaledValue = (value - fromMin) / fromRange
  return toMin + scaledValue * toRange
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * Math.PI / 180
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * 180 / Math.PI
}

/**
 * Calculate the distance between two 3D points
 */
export function distance3D(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.distanceTo(b)
}

/**
 * Calculate the centroid of an array of 3D points
 */
export function centroid3D(points: THREE.Vector3[]): THREE.Vector3 {
  const centroid = new THREE.Vector3()
  for (const point of points) {
    centroid.add(point)
  }
  centroid.divideScalar(points.length)
  return centroid
}

/**
 * Create a bounding box from an array of points
 */
export function boundingBoxFromPoints(points: THREE.Vector3[]): THREE.Box3 {
  const box = new THREE.Box3()
  for (const point of points) {
    box.expandByPoint(point)
  }
  return box
}

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Deep clone an object (simple implementation)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const copy = {} as T
    Object.keys(obj).forEach(key => {
      (copy as any)[key] = deepClone((obj as any)[key])
    })
    return copy
  }
  return obj
}

/**
 * Check if a point is inside a polygon (2D)
 */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const x = point[0]
  const y = point[1]
  let inside = false
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  
  return inside
}

/**
 * Calculate the area of a polygon (2D)
 */
export function polygonArea(polygon: [number, number][]): number {
  let area = 0
  const n = polygon.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i][0] * polygon[j][1]
    area -= polygon[j][0] * polygon[i][1]
  }
  
  return Math.abs(area) / 2
}

/**
 * Smooth an array of numbers using a simple moving average
 */
export function smoothArray(values: number[], windowSize: number): number[] {
  if (windowSize <= 1) return values
  
  const smoothed: number[] = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0
    let count = 0
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(values.length - 1, i + halfWindow); j++) {
      sum += values[j]
      count++
    }
    
    smoothed.push(sum / count)
  }
  
  return smoothed
}

/**
 * Calculate performance timing
 */
export class Timer {
  private startTime: number = 0
  
  start(): void {
    this.startTime = performance.now()
  }
  
  end(): number {
    return performance.now() - this.startTime
  }
  
  endAndLog(label: string): number {
    const duration = this.end()
    console.log(`${label}: ${duration.toFixed(2)}ms`)
    return duration
  }
}

/**
 * Create a simple performance timer
 */
export function createTimer(): Timer {
  return new Timer()
}

/**
 * Log function with timestamp
 */
export function log(message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, ...args)
}

/**
 * Error logging with context
 */
export function logError(error: Error, context?: string): void {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` [${context}]` : ''
  console.error(`[${timestamp}]${contextStr} Error:`, error.message, error)
}