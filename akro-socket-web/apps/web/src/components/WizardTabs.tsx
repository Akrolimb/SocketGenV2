import React, { useState } from 'react'
import ImportPanel from './ImportPanel'
import DetectPanel from './DetectPanel'
import EditPanel from './EditPanel'
import GeneratePanel from './GeneratePanel'
import ExportPanel from './ExportPanel'
import { useCaseStore } from '../hooks/useCaseStore'

/**
 * Main wizard component managing the 5-step socket generation process
 */
export const WizardTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  
  const limb = useCaseStore(state => state.limb)
  const markings = useCaseStore(state => state.markings)
  const qc = useCaseStore(state => state.qc)
  const reset = useCaseStore(state => state.reset)

  const tabs = [
    { 
      id: 'import', 
      name: 'Import & Scale', 
      icon: '📁',
      completed: !!limb,
      disabled: false
    },
    { 
      id: 'detect', 
      name: 'Auto-Detect Markings', 
      icon: '🔍',
      completed: markings.length > 0,
      disabled: !limb
    },
    { 
      id: 'edit', 
      name: 'Edit Markings', 
      icon: '✏️', 
      completed: markings.some(m => m.cls === 'trimline'),
      disabled: !limb
    },
    { 
      id: 'generate', 
      name: 'Generate Socket', 
      icon: '🚀',
      completed: !!qc,
      disabled: !limb || (!markings.some(m => m.cls === 'trimline'))
    },
    { 
      id: 'export', 
      name: 'Export & QC', 
      icon: '💾',
      completed: false,
      disabled: !qc
    }
  ]

  const handleTabClick = (index: number) => {
    const tab = tabs[index]
    if (!tab.disabled) {
      setActiveTab(index)
    }
  }

  const handleNext = () => {
    const nextIndex = activeTab + 1
    if (nextIndex < tabs.length && !tabs[nextIndex].disabled) {
      setActiveTab(nextIndex)
    }
  }

  const handlePrevious = () => {
    const prevIndex = activeTab - 1
    if (prevIndex >= 0) {
      setActiveTab(prevIndex)
    }
  }

  const handleNewCase = () => {
    reset()
    setActiveTab(0)
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 0:
        return <ImportPanel onNext={handleNext} />
      case 1:
        return <DetectPanel onNext={handleNext} onPrevious={handlePrevious} />
      case 2:
        return <EditPanel onNext={handleNext} onPrevious={handlePrevious} />
      case 3:
        return <GeneratePanel onNext={handleNext} onPrevious={handlePrevious} />
      case 4:
        return <ExportPanel onPrevious={handlePrevious} onNewCase={handleNewCase} />
      default:
        return <ImportPanel onNext={handleNext} />
    }
  }

  return (
    <div className="wizard-container">
      {/* Tab Headers */}
      <div className="wizard-tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            className={`wizard-tab ${
              index === activeTab ? 'active' : ''
            } ${
              tab.completed ? 'completed' : ''
            } ${
              tab.disabled ? 'disabled' : ''
            }`}
            onClick={() => handleTabClick(index)}
            disabled={tab.disabled}
            title={tab.disabled ? 'Complete previous steps first' : ''}
          >
            <div className="tab-icon">{tab.icon}</div>
            <div className="tab-content">
              <div className="tab-name">{tab.name}</div>
              <div className="tab-number">{index + 1}</div>
            </div>
            <div className="tab-status">
              {tab.completed && <div className="completion-indicator">✓</div>}
            </div>
          </button>
        ))}
      </div>

      {/* Progress Indicator */}
      <div className="wizard-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((activeTab + 1) / tabs.length) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          Step {activeTab + 1} of {tabs.length}: {tabs[activeTab].name}
        </div>
      </div>

      {/* Active Panel */}
      <div className="wizard-panel">
        {renderPanel()}
      </div>
    </div>
  )
}

export default WizardTabs