import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColorAnalysisPanel } from '../components/ColorAnalysisPanel'

describe('ColorAnalysisPanel', () => {
  it('should render empty state when no mesh is loaded', () => {
    render(<ColorAnalysisPanel />)
    
    expect(screen.getByText('Load a mesh file to analyze materials and colors')).toBeInTheDocument()
  })
  
  it('should render with proper className prop', () => {
    render(<ColorAnalysisPanel className="test-class" />)
    
    // Component should accept className prop without errors
    expect(screen.getByText('Load a mesh file to analyze materials and colors')).toBeInTheDocument()
  })
  
  it('should show loading message when no mesh is available', () => {
    render(<ColorAnalysisPanel />)
    
    // The empty state message should be displayed
    expect(screen.getByText('Load a mesh file to analyze materials and colors')).toBeInTheDocument()
  })
})