import React from 'react'

interface DetectPanelProps {
  onNext: () => void
  onPrevious: () => void
}

/**
 * Auto-Detect Markings panel for HSV texture segmentation
 */
export const DetectPanel: React.FC<DetectPanelProps> = ({ onNext, onPrevious }) => {
  return (
    <div className="detect-panel">
      <h3>Auto-Detect Markings</h3>
      
      <div className="panel-content">
        <p>Automatically detect markings from texture colors on your limb mesh.</p>
        
        <div className="controls">
          <button className="primary-button" disabled>
            🔍 Detect from Texture
          </button>
          
          <div className="color-presets">
            <h4>Color Detection Ranges</h4>
            
            <div className="color-preset">
              <label>Red Markings</label>
              <div className="hsv-controls">
                <label>Hue: <input type="range" min="0" max="360" defaultValue="0" /></label>
                <label>Saturation: <input type="range" min="0" max="100" defaultValue="80" /></label>
                <label>Value: <input type="range" min="0" max="100" defaultValue="60" /></label>
              </div>
            </div>
            
            <div className="color-preset">
              <label>Blue Markings</label>
              <div className="hsv-controls">
                <label>Hue: <input type="range" min="0" max="360" defaultValue="240" /></label>
                <label>Saturation: <input type="range" min="0" max="100" defaultValue="80" /></label>
                <label>Value: <input type="range" min="0" max="100" defaultValue="60" /></label>
              </div>
            </div>
            
            <div className="color-preset">
              <label>Green Markings</label>
              <div className="hsv-controls">
                <label>Hue: <input type="range" min="0" max="360" defaultValue="120" /></label>
                <label>Saturation: <input type="range" min="0" max="100" defaultValue="80" /></label>
                <label>Value: <input type="range" min="0" max="100" defaultValue="60" /></label>
              </div>
            </div>
          </div>
          
          <div className="result-layers">
            <h4>Detected Layers</h4>
            <div className="layer-list">
              <div className="layer-item disabled">
                <label>
                  <input type="checkbox" disabled />
                  Trimlines <span className="count">(0)</span>
                </label>
              </div>
              <div className="layer-item disabled">
                <label>
                  <input type="checkbox" disabled />
                  Relief Areas <span className="count">(0)</span>
                </label>
              </div>
              <div className="layer-item disabled">
                <label>
                  <input type="checkbox" disabled />
                  Landmarks <span className="count">(0)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="info-box">
          <h4>💡 Tips</h4>
          <ul>
            <li>Ensure your mesh has texture with colored markings</li>
            <li>Adjust HSV ranges to match your marking colors</li>
            <li>Detection works best with high contrast markings</li>
            <li>You can manually add markings in the next step</li>
          </ul>
        </div>
      </div>
      
      <div className="panel-actions">
        <button className="secondary-button" onClick={onPrevious}>
          ← Back: Import
        </button>
        <button className="primary-button" onClick={onNext}>
          Next: Edit Markings →
        </button>
        <button className="tertiary-button">
          Skip Auto-Detection
        </button>
      </div>
    </div>
  )
}

export default DetectPanel