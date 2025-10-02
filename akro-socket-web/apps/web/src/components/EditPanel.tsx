import React, { useState } from 'react'
import { useCaseStore } from '../hooks/useCaseStore'
import type { MarkClass } from '../types'

interface EditPanelProps {
  onNext: () => void
  onPrevious: () => void
}

/**
 * Edit Markings panel for interactive marking tools
 */
export const EditPanel: React.FC<EditPanelProps> = ({ onNext, onPrevious }) => {
  const [selectedTool, setSelectedTool] = useState<string>('select')
  const [selectedClass, setSelectedClass] = useState<MarkClass>('trimline')
  const [strength, setStrength] = useState(0.5)
  const [snapToSurface, setSnapToSurface] = useState(true)
  
  const markings = useCaseStore(state => state.markings)
  const canGenerate = useCaseStore(state => state.canGenerate())

  const tools = [
    { id: 'select', name: 'Select', icon: '👆', shortcut: 'V' },
    { id: 'draw', name: 'Draw', icon: '✏️', shortcut: 'D' },
    { id: 'paint', name: 'Paint Area', icon: '🎨', shortcut: 'P' },
    { id: 'erase', name: 'Erase', icon: '🧹', shortcut: 'E' },
    { id: 'smooth', name: 'Smooth', icon: '〰️', shortcut: 'S' },
    { id: 'split', name: 'Split/Join', icon: '✂️', shortcut: 'X' }
  ]

  const markingClasses = [
    { id: 'trimline', name: 'Trimline', color: '#ff0000', description: 'Socket trim boundary' },
    { id: 'relief_tender', name: 'Relief (Tender)', color: '#00ff00', description: 'Areas needing extra relief' },
    { id: 'pad_load', name: 'Pad (Load)', color: '#0000ff', description: 'Load-bearing areas' },
    { id: 'landmark', name: 'Landmark', color: '#ffff00', description: 'Anatomical reference points' }
  ]

  const presets = ['PTB', 'TSB']

  return (
    <div className="edit-panel">
      <h3>Edit Markings</h3>
      
      <div className="panel-content">
        {/* Tools */}
        <div className="tools-section">
          <h4>Tools</h4>
          <div className="tool-grid">
            {tools.map(tool => (
              <button
                key={tool.id}
                className={`tool-button ${selectedTool === tool.id ? 'active' : ''}`}
                onClick={() => setSelectedTool(tool.id)}
                title={`${tool.name} (${tool.shortcut})`}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-name">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="settings-section">
          <div className="setting-group">
            <label>
              <input
                type="checkbox"
                checked={snapToSurface}
                onChange={(e) => setSnapToSurface(e.target.checked)}
              />
              Snap to surface
            </label>
          </div>
        </div>

        {/* Marking Classes */}
        <div className="classes-section">
          <h4>Marking Type</h4>
          <div className="class-list">
            {markingClasses.map(cls => (
              <label key={cls.id} className="class-option">
                <input
                  type="radio"
                  name="markingClass"
                  value={cls.id}
                  checked={selectedClass === cls.id}
                  onChange={(e) => setSelectedClass(e.target.value as MarkClass)}
                />
                <div 
                  className="class-color" 
                  style={{ backgroundColor: cls.color }}
                />
                <div className="class-info">
                  <div className="class-name">{cls.name}</div>
                  <div className="class-desc">{cls.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Strength */}
        <div className="strength-section">
          <h4>Relief Strength</h4>
          <div className="strength-slider">
            <label>
              Strength: {strength.toFixed(1)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
              />
            </label>
            <div className="strength-labels">
              <span>Light</span>
              <span>Strong</span>
            </div>
          </div>
        </div>

        {/* Label */}
        <div className="label-section">
          <label>
            Label:
            <input 
              type="text" 
              placeholder="Enter marking label..."
              list="common-labels"
            />
          </label>
          <datalist id="common-labels">
            <option value="Medial Trimline" />
            <option value="Lateral Trimline" />
            <option value="Patellar Tendon" />
            <option value="Tibial Crest" />
            <option value="Fibular Head" />
            <option value="Popliteal Area" />
          </datalist>
        </div>

        {/* Presets */}
        <div className="presets-section">
          <h4>Presets</h4>
          <div className="preset-buttons">
            {presets.map(preset => (
              <button key={preset} className="preset-button">
                Apply {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Current Markings */}
        <div className="markings-list-section">
          <h4>Current Markings ({markings.length})</h4>
          <div className="markings-list">
            {markings.length === 0 ? (
              <div className="empty-state">
                No markings created yet. Use the tools above to add markings to your limb.
              </div>
            ) : (
              markings.map(marking => (
                <div key={marking.id} className="marking-item">
                  <div 
                    className="marking-color"
                    style={{ backgroundColor: marking.color }}
                  />
                  <div className="marking-info">
                    <div className="marking-label">{marking.label || `${marking.cls} ${marking.id.slice(0, 6)}`}</div>
                    <div className="marking-details">
                      {marking.cls} · {marking.geom.kind} · {marking.geom.points.length} points
                    </div>
                  </div>
                  <div className="marking-actions">
                    <button className="icon-button" title="Edit">✏️</button>
                    <button className="icon-button" title="Delete">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Undo/Redo */}
        <div className="history-section">
          <div className="history-buttons">
            <button className="history-button" disabled title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button className="history-button" disabled title="Redo (Ctrl+Shift+Z)">
              ↷ Redo
            </button>
          </div>
        </div>
      </div>
      
      <div className="panel-actions">
        <button className="secondary-button" onClick={onPrevious}>
          ← Back: Detect
        </button>
        <button 
          className="primary-button" 
          onClick={onNext}
          disabled={!canGenerate}
        >
          Next: Generate Socket →
        </button>
        {!canGenerate && (
          <div className="validation-message">
            Add a trimline marking or enable auto-trimline to continue
          </div>
        )}
      </div>

      <div className="shortcuts-info">
        <details>
          <summary>Keyboard Shortcuts</summary>
          <div className="shortcuts-grid">
            <div>V - Select tool</div>
            <div>D - Draw tool</div>
            <div>P - Paint tool</div>
            <div>E - Erase tool</div>
            <div>S - Smooth tool</div>
            <div>X - Split/Join tool</div>
            <div>Ctrl+Z - Undo</div>
            <div>Ctrl+Shift+Z - Redo</div>
          </div>
        </details>
      </div>
    </div>
  )
}

export default EditPanel