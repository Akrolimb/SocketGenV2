import React, { useState } from 'react'
import { useCaseStore } from '../hooks/useCaseStore'

interface ExportPanelProps {
  onPrevious: () => void
  onNewCase: () => void
}

/**
 * Export & QC panel for final quality control and file export
 */
export const ExportPanel: React.FC<ExportPanelProps> = ({ onPrevious, onNewCase }) => {
  const [exportFormat, setExportFormat] = useState<'glb' | 'obj'>('glb')
  const [includeCompression, setIncludeCompression] = useState(false)
  const [exportProgress, setExportProgress] = useState<string | null>(null)

  const qc = useCaseStore(state => state.qc)
  const meta = useCaseStore(state => state.meta)
  const socketParams = useCaseStore(state => state.socketParams)

  const handleExport = async (type: 'socket' | 'report' | 'evidence') => {
    setExportProgress(`Exporting ${type}...`)
    
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // TODO: Implement actual export logic
      console.log(`Exporting ${type}`)
      
      // Create and download file
      const filename = type === 'socket' ? 'socket.glb' : 
                     type === 'report' ? 'report.json' : 
                     'evidence.glb'
      
      // For demo, just log the action
      console.log(`Downloaded: ${filename}`)
      
    } catch (error) {
      console.error(`Export failed:`, error)
    } finally {
      setExportProgress(null)
    }
  }

  // const formatParams = (params: any) => {
  //   return Object.entries(params).map(([key, value]) => (
  //     <div key={key} className="param-item">
  //       <span className="param-key">{key}:</span>
  //       <span className="param-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
  //     </div>
  //   ))
  // }

  return (
    <div className="export-panel">
      <h3>Export & Quality Control</h3>
      
      <div className="panel-content">
        {/* QC Summary */}
        <div className="qc-summary">
          <h4>Quality Control Summary</h4>
          
          {qc ? (
            <div className="qc-badges">
              <div className={`qc-badge ${qc.manifold ? 'pass' : 'fail'}`}>
                <div className="badge-icon">{qc.manifold ? '✓' : '✗'}</div>
                <div className="badge-text">
                  <div className="badge-title">Manifold</div>
                  <div className="badge-desc">{qc.manifold ? 'Valid topology' : 'Topology errors detected'}</div>
                </div>
              </div>

              <div className={`qc-badge ${qc.minWallOK ? 'pass' : 'fail'}`}>
                <div className="badge-icon">{qc.minWallOK ? '✓' : '✗'}</div>
                <div className="badge-text">
                  <div className="badge-title">Minimum Wall</div>
                  <div className="badge-desc">{qc.minWallMM.toFixed(1)}mm {qc.minWallOK ? 'adequate' : 'too thin'}</div>
                </div>
              </div>

              <div className={`qc-badge ${qc.selfIntersections === 0 ? 'pass' : 'fail'}`}>
                <div className="badge-icon">{qc.selfIntersections === 0 ? '✓' : '✗'}</div>
                <div className="badge-text">
                  <div className="badge-title">Self-Intersections</div>
                  <div className="badge-desc">
                    {qc.selfIntersections === 0 ? 'None detected' : `${qc.selfIntersections} faces involved`}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="qc-pending">
              Generate a socket to see quality control results
            </div>
          )}
        </div>

        {/* Socket Parameters Summary */}
        {meta && (
          <div className="summary-section">
            <h4>Socket Summary</h4>
            
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-label">Case Name</div>
                <div className="summary-value">{meta.name}</div>
              </div>
              
              <div className="summary-item">
                <div className="summary-label">Units</div>
                <div className="summary-value">{meta.units}</div>
              </div>
              
              <div className="summary-item">
                <div className="summary-label">Input Triangles</div>
                <div className="summary-value">{meta.triCount.toLocaleString()}</div>
              </div>
              
              <div className="summary-item">
                <div className="summary-label">Wall Thickness</div>
                <div className="summary-value">{socketParams.thicknessMM}mm</div>
              </div>
              
              <div className="summary-item">
                <div className="summary-label">Slice Step</div>
                <div className="summary-value">{socketParams.sliceStepMM}mm</div>
              </div>
              
              <div className="summary-item">
                <div className="summary-label">Smoothing</div>
                <div className="summary-value">{socketParams.smoothingMM}mm</div>
              </div>
            </div>
          </div>
        )}

        {/* Export Options */}
        <div className="export-options">
          <h4>Export Options</h4>
          
          <div className="format-selection">
            <label>
              <input
                type="radio"
                name="format"
                value="glb"
                checked={exportFormat === 'glb'}
                onChange={(e) => setExportFormat(e.target.value as 'glb')}
              />
              GLB (Binary, Compact)
            </label>
            
            <label>
              <input
                type="radio"
                name="format"
                value="obj"
                checked={exportFormat === 'obj'}
                onChange={(e) => setExportFormat(e.target.value as 'obj')}
              />
              OBJ (Text, Universal)
            </label>
          </div>

          {exportFormat === 'glb' && (
            <div className="compression-option">
              <label>
                <input
                  type="checkbox"
                  checked={includeCompression}
                  onChange={(e) => setIncludeCompression(e.target.checked)}
                />
                Enable DRACO compression (smaller file size)
              </label>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="export-buttons">
          <h4>Download Files</h4>
          
          <div className="export-grid">
            <button 
              className="export-button primary"
              onClick={() => handleExport('socket')}
              disabled={!qc || !!exportProgress}
            >
              <div className="export-icon">💾</div>
              <div className="export-text">
                <div className="export-title">Socket File</div>
                <div className="export-desc">Main 3D printable socket</div>
              </div>
            </button>

            <button 
              className="export-button secondary"
              onClick={() => handleExport('report')}
              disabled={!qc || !!exportProgress}
            >
              <div className="export-icon">📊</div>
              <div className="export-text">
                <div className="export-title">Report JSON</div>
                <div className="export-desc">Parameters and QC data</div>
              </div>
            </button>

            <button 
              className="export-button tertiary"
              onClick={() => handleExport('evidence')}
              disabled={!qc || !!exportProgress}
            >
              <div className="export-icon">🔍</div>
              <div className="export-text">
                <div className="export-title">Evidence File</div>
                <div className="export-desc">Limb + markings + surfaces</div>
              </div>
            </button>
          </div>

          {exportProgress && (
            <div className="export-progress">
              <div className="progress-icon">⏳</div>
              <div className="progress-text">{exportProgress}</div>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="file-info">
          <h4>File Information</h4>
          
          <div className="info-list">
            <div className="info-item">
              <strong>socket.{exportFormat}</strong> - The main socket geometry ready for 3D printing
            </div>
            <div className="info-item">
              <strong>report.json</strong> - Complete generation parameters and quality metrics
            </div>
            <div className="info-item">
              <strong>evidence.{exportFormat}</strong> - Original limb with markings for documentation
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="final-actions">
          <h4>What's Next?</h4>
          
          <div className="action-grid">
            <div className="action-card">
              <div className="action-icon">🖨️</div>
              <div className="action-content">
                <h5>3D Print</h5>
                <p>Import the socket file into your 3D printing software and prepare for printing</p>
              </div>
            </div>
            
            <div className="action-card">
              <div className="action-icon">✏️</div>
              <div className="action-content">
                <h5>CAD Refinement</h5>
                <p>Import into CAD software for additional modifications if needed</p>
              </div>
            </div>
            
            <div className="action-card">
              <div className="action-icon">📋</div>
              <div className="action-content">
                <h5>Documentation</h5>
                <p>Use the report.json for clinical records and quality assurance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="panel-actions">
        <button className="secondary-button" onClick={onPrevious}>
          ← Back: Generate
        </button>
        <button className="primary-button new-case" onClick={onNewCase}>
          🆕 New Case
        </button>
      </div>
    </div>
  )
}

export default ExportPanel