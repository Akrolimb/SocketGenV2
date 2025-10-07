/**
 * Region Filling Debug Tests
 * 
 * Simple test to verify region filling functionality works
 */

import * as THREE from 'three'
import { createSimpleFilledRegion } from '../utils/regionFilling'

// Test function to create a simple square loop
export function testRegionFilling() {
  console.log('🧪 Testing region filling...')
  
  // Create a simple square of points
  const testPoints = [
    new THREE.Vector3(0, 0, 0),    // Start
    new THREE.Vector3(1, 0, 0),    // Right
    new THREE.Vector3(1, 1, 0),    // Top-right  
    new THREE.Vector3(0, 1, 0),    // Top-left
    new THREE.Vector3(0.1, 0.1, 0) // Close to start (simulating user input)
  ]
  
  console.log('Test points:', testPoints)
  
  // Test distance calculation
  const startPoint = testPoints[0]
  const endPoint = testPoints[testPoints.length - 1]
  const distance = startPoint.distanceTo(endPoint)
  const tolerance = 0.5
  
  console.log('Distance test:', {
    startPoint,
    endPoint,
    distance,
    tolerance,
    isClose: distance <= tolerance
  })
  
  // Test geometry creation
  try {
    const geometry = createSimpleFilledRegion(testPoints, '#ff0000', 0.5)
    console.log('✅ Geometry created successfully:', {
      vertexCount: geometry.attributes.position.count,
      hasIndex: !!geometry.index,
      indexCount: geometry.index?.count
    })
    
    return geometry
  } catch (error) {
    console.error('❌ Geometry creation failed:', error)
    return null
  }
}

// Call this from console to test: testRegionFilling()
if (typeof window !== 'undefined') {
  (window as any).testRegionFilling = testRegionFilling
}