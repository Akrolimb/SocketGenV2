import React, { useState } from 'react'
import Canvas3D from '../components/Canvas3D'
import WizardTabs from '../components/WizardTabs'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AnnotationProvider } from '../contexts/AnnotationContext'
import { useCaseStore } from '../hooks/useCaseStore'
import './App.css'

const App: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false)
  
  const meta = useCaseStore(state => state.meta)
  const markings = useCaseStore(state => state.markings)

  const formatBoundingBox = (bbox: { min: number[], max: number[] }, units: string) => {
    const size = [
      bbox.max[0] - bbox.min[0],
      bbox.max[1] - bbox.min[1], 
      bbox.max[2] - bbox.min[2]
    ]
    return `${size[0].toFixed(1)} × ${size[1].toFixed(1)} × ${size[2].toFixed(1)} ${units}`
  }

  return (
    <AnnotationProvider>
      <div className="app">
        <header className="app-header">
          <h1>Akro Socket Generator</h1>
          <button 
            className="help-button"
            onClick={() => setShowHelp(true)}
          >
            Help
          </button>
        </header>
      
      <div className="app-layout">
        <aside className="left-panel">
          <WizardTabs />
        </aside>
        
        <main className="canvas-container">
          <Canvas3D className="three-canvas" />
        </main>
        
        <aside className="right-panel">
          <div className="info-section">
            <h3>Model Info</h3>
            <div className="info-grid">
              <div>Triangles: <span>{meta?.triCount.toLocaleString() || '-'}</span></div>
              <div>Units: <span>{meta?.units || '-'}</span></div>
              <div>Size: <span>{meta ? formatBoundingBox(meta.bbox, meta.units) : '-'}</span></div>
              <div>Markings: <span>{markings.length}</span></div>
            </div>
          </div>
          
          <AnnotationPanel />
          
          <div className="controls-section">
            <h3>View Controls</h3>
            <button>Reset View (R)</button>
            <button>Fit to Object</button>
            <div className="control-note">
              <small>Use mouse to orbit, zoom, and pan the 3D view</small>
            </div>
          </div>

          <div className="shortcuts-section">
            <h3>Shortcuts</h3>
            <div className="shortcut-list">
              <div><kbd>R</kbd> Reset view</div>
              <div><kbd>G</kbd> Toggle grid</div>
              <div><kbd>Ctrl+O</kbd> Open file</div>
            </div>
          </div>
        </aside>
      </div>
      
      <footer className="status-bar">
        <span>{meta ? `${meta.name} loaded` : 'Ready'}</span>
        <span>|</span>
        <span>Step: {getCurrentStepName()}</span>
        <span>|</span>
        <span>Markings: {markings.length}</span>
      </footer>

      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quick Help</h2>
              <button className="modal-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="modal-body">
              <h3>Socket Generation Process</h3>
              <ol>
                <li><strong>Import:</strong> Load your limb mesh (GLB, GLTF, or OBJ)</li>
                <li><strong>Detect:</strong> Automatically find markings from texture colors</li>
                <li><strong>Edit:</strong> Manually add or adjust markings with drawing tools</li>
                <li><strong>Generate:</strong> Create the socket using your markings and parameters</li>
                <li><strong>Export:</strong> Download the final socket file for 3D printing</li>
              </ol>
              
              <h3>Tips</h3>
              <ul>
                <li>Ensure your mesh has proper scale and units</li>
                <li>At minimum, add a trimline marking to define the socket boundary</li>
                <li>Use relief markings for tender areas that need extra space</li>
                <li>Check quality control results before printing</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      </div>
    </AnnotationProvider>
  )

  function getCurrentStepName(): string {
    if (!meta) return 'Import'
    if (markings.length === 0) return 'Detect/Edit'
    if (!useCaseStore.getState().qc) return 'Generate'
    return 'Export'
  }
}

export default App