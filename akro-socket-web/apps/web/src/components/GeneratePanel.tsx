import React, { useState } from 'react'
import { useCaseStore } from '../hooks/useCaseStore'

interface GeneratePanelProps {
  onNext: () => void
  onPrevious: () => void
}

/**
 * Generate Socket panel for socket generation parameters and execution
 */
export const GeneratePanel: React.FC<GeneratePanelProps> = ({ onNext, onPrevious }) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string[]>([])
  const [previewOptions, setPreviewOptions] = useState({
    showLimb: true,
    showSocket: true,
    clipPlane: 0.5
  })

  const socketParams = useCaseStore(state => state.socketParams)
  const setSocketParams = useCaseStore(state => state.setSocketParams)
  const qc = useCaseStore(state => state.qc)

  const steps = [
    'Axis/PCA computation',
    'Slicing mesh',
    'Applying relief patterns',
    'Offsetting contours',
    'Lofting socket surface',
    'Trimming and capping',
    'Surface smoothing',
    'Quality control checks'
  ]

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerationProgress([])

    try {
      // Simulate generation process
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setGenerationProgress(prev => [...prev, steps[i]])
      }

      // TODO: Actual socket generation logic
      console.log('Socket generation completed')
      
    } catch (error) {
      console.error('Socket generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="generate-panel">
      <h3>Generate Socket</h3>
      
      <div className="panel-content">
        {/* Parameters */}
        <div className="parameters-section">
          <h4>Socket Parameters</h4>
          
          <div className="parameter-grid">
            <div className="parameter-group">
              <label>
                Wall Thickness (mm)
                <input
                  type="number"
                  value={socketParams.thicknessMM}
                  onChange={(e) => setSocketParams({ thicknessMM: parseFloat(e.target.value) || 4.0 })}
                  min="2"
                  max="10"
                  step="0.5"
                />
              </label>
              <div className="parameter-help">
                Standard prosthetic socket wall thickness
              </div>
            </div>

            <div className="parameter-group">
              <label>
                Slice Step (mm)
                <input
                  type="number"
                  value={socketParams.sliceStepMM}
                  onChange={(e) => setSocketParams({ sliceStepMM: parseFloat(e.target.value) || 5.0 })}
                  min="1"
                  max="20"
                  step="1"
                />
              </label>
              <div className="parameter-help">
                Distance between cross-sectional slices
              </div>
            </div>

            <div className="parameter-group">
              <label>
                Smoothing (mm)
                <input
                  type="number"
                  value={socketParams.smoothingMM}
                  onChange={(e) => setSocketParams({ smoothingMM: parseFloat(e.target.value) || 2.0 })}
                  min="0"
                  max="10"
                  step="0.5"
                />
              </label>
              <div className="parameter-help">
                Surface smoothing radius
              </div>
            </div>
          </div>
        </div>

        {/* Relief Depths */}
        <div className="relief-section">
          <h4>Relief Depths (% of wall thickness)</h4>
          
          <div className="relief-grid">
            <div className="relief-item">
              <label>
                <span className="relief-color" style={{ backgroundColor: '#ff0000' }}></span>
                Trimline
                <input
                  type="number"
                  value={socketParams.reliefPct.trimline}
                  onChange={(e) => setSocketParams({ 
                    reliefPct: { ...socketParams.reliefPct, trimline: parseFloat(e.target.value) || 0 }
                  })}
                  min="0"
                  max="200"
                  step="5"
                />
                %
              </label>
            </div>

            <div className="relief-item">
              <label>
                <span className="relief-color" style={{ backgroundColor: '#00ff00' }}></span>
                Tender Areas
                <input
                  type="number"
                  value={socketParams.reliefPct.relief_tender}
                  onChange={(e) => setSocketParams({ 
                    reliefPct: { ...socketParams.reliefPct, relief_tender: parseFloat(e.target.value) || 120 }
                  })}
                  min="0"
                  max="200"
                  step="5"
                />
                %
              </label>
            </div>

            <div className="relief-item">
              <label>
                <span className="relief-color" style={{ backgroundColor: '#0000ff' }}></span>
                Load Areas
                <input
                  type="number"
                  value={socketParams.reliefPct.pad_load}
                  onChange={(e) => setSocketParams({ 
                    reliefPct: { ...socketParams.reliefPct, pad_load: parseFloat(e.target.value) || 60 }
                  })}
                  min="0"
                  max="200"
                  step="5"
                />
                %
              </label>
            </div>

            <div className="relief-item">
              <label>
                <span className="relief-color" style={{ backgroundColor: '#ffff00' }}></span>
                Landmarks
                <input
                  type="number"
                  value={socketParams.reliefPct.landmark}
                  onChange={(e) => setSocketParams({ 
                    reliefPct: { ...socketParams.reliefPct, landmark: parseFloat(e.target.value) || 0 }
                  })}
                  min="0"
                  max="200"
                  step="5"
                />
                %
              </label>
            </div>
          </div>
        </div>

        {/* Generation */}
        <div className="generation-section">
          <button 
            className="generate-button"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '⏳ Generating...' : '🚀 Generate Socket'}
          </button>

          {/* Progress */}
          {isGenerating && (
            <div className="progress-section">
              <h4>Generation Progress</h4>
              <div className="progress-list">
                {steps.map((step, index) => (
                  <div 
                    key={index}
                    className={`progress-step ${
                      generationProgress.includes(step) ? 'completed' : 
                      index === generationProgress.length ? 'active' : 'pending'
                    }`}
                  >
                    <div className="step-icon">
                      {generationProgress.includes(step) ? '✓' : 
                       index === generationProgress.length ? '⏳' : '○'}
                    </div>
                    <div className="step-text">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QC Results */}
          {qc && (
            <div className="qc-section">
              <h4>Quality Control Results</h4>
              <div className="qc-grid">
                <div className={`qc-item ${qc.manifold ? 'pass' : 'fail'}`}>
                  <div className="qc-icon">{qc.manifold ? '✓' : '✗'}</div>
                  <div className="qc-text">Manifold</div>
                </div>
                
                <div className={`qc-item ${qc.minWallOK ? 'pass' : 'fail'}`}>
                  <div className="qc-icon">{qc.minWallOK ? '✓' : '✗'}</div>
                  <div className="qc-text">Min Wall ({qc.minWallMM.toFixed(1)}mm)</div>
                </div>
                
                <div className={`qc-item ${qc.selfIntersections === 0 ? 'pass' : 'fail'}`}>
                  <div className="qc-icon">{qc.selfIntersections === 0 ? '✓' : '✗'}</div>
                  <div className="qc-text">Self-intersections ({qc.selfIntersections})</div>
                </div>
              </div>
              
              {qc.notes.length > 0 && (
                <div className="qc-notes">
                  <h5>Notes:</h5>
                  <ul>
                    {qc.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Controls */}
        <div className="preview-section">
          <h4>Preview Options</h4>
          
          <div className="preview-controls">
            <label>
              <input
                type="checkbox"
                checked={previewOptions.showLimb}
                onChange={(e) => setPreviewOptions(prev => ({ ...prev, showLimb: e.target.checked }))}
              />
              Show Limb
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={previewOptions.showSocket}
                onChange={(e) => setPreviewOptions(prev => ({ ...prev, showSocket: e.target.checked }))}
              />
              Show Socket
            </label>
            
            <div className="clip-plane-control">
              <label>
                Clip Plane: {(previewOptions.clipPlane * 100).toFixed(0)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={previewOptions.clipPlane}
                  onChange={(e) => setPreviewOptions(prev => ({ ...prev, clipPlane: parseFloat(e.target.value) }))}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="panel-actions">
        <button className="secondary-button" onClick={onPrevious}>
          ← Back: Edit Markings
        </button>
        <button 
          className="primary-button" 
          onClick={onNext}
          disabled={!qc || isGenerating}
        >
          Next: Export & QC →
        </button>
      </div>
    </div>
  )
}

export default GeneratePanel