import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import * as THREE from 'three'
import type { 
  CaseState, 
  CaseMeta, 
  Marking, 
  SocketParams, 
  QCReport,
  LimbMesh
  // SocketMesh // TODO: Use when implementing socket storage
} from '../types'

interface CaseStore extends CaseState {
  // Actions
  setMeta: (meta: CaseMeta) => void
  setLimb: (limb: LimbMesh | null) => void
  addMarking: (marking: Marking) => void
  updateMarking: (id: string, updates: Partial<Marking>) => void
  removeMarking: (id: string) => void
  setSocketParams: (params: Partial<SocketParams>) => void
  setQC: (qc: QCReport | null) => void
  setEvidenceScene: (scene: THREE.Scene | null) => void
  reset: () => void
  
  // Computed getters
  getTrimlineMarking: () => Marking | null
  getMarkingsByClass: (cls: string) => Marking[]
  canGenerate: () => boolean
}

const initialState: CaseState = {
  meta: null,
  limb: null,
  markings: [],
  socketParams: {
    thicknessMM: 4.0,
    sliceStepMM: 5.0,
    smoothingMM: 2.0,
    reliefPct: {
      trimline: 0,
      relief_tender: 120,
      pad_load: 60,
      landmark: 0
    },
    trimlineId: null
  },
  qc: null,
  evidenceScene: null
}

export const useCaseStore = create<CaseStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        setMeta: (meta) => set((state) => {
          state.meta = meta
        }),

        setLimb: (limb) => set((state) => {
          state.limb = limb
        }),

        addMarking: (marking) => set((state) => {
          state.markings.push(marking)
        }),

        updateMarking: (id, updates) => set((state) => {
          const index = state.markings.findIndex(m => m.id === id)
          if (index !== -1) {
            Object.assign(state.markings[index], updates)
          }
        }),

        removeMarking: (id) => set((state) => {
          state.markings = state.markings.filter(m => m.id !== id)
        }),

        setSocketParams: (params) => set((state) => {
          Object.assign(state.socketParams, params)
        }),

        setQC: (qc) => set((state) => {
          state.qc = qc
        }),

        setEvidenceScene: (scene) => set((state) => {
          state.evidenceScene = scene
        }),

        reset: () => set(() => ({ ...initialState })),

        // Computed getters
        getTrimlineMarking: () => {
          const state = get()
          return state.markings.find(m => m.cls === 'trimline') || null
        },

        getMarkingsByClass: (cls) => {
          const state = get()
          return state.markings.filter(m => m.cls === cls)
        },

        canGenerate: () => {
          const state = get()
          return state.limb !== null && (
            state.markings.some(m => m.cls === 'trimline') || 
            state.socketParams.trimlineId === null // auto-trimline mode
          )
        }
      })),
      {
        name: 'akro-case-storage',
        // Only persist socket parameters to localStorage
        partialize: (state) => ({ 
          socketParams: state.socketParams 
        })
      }
    ),
    { name: 'AkroSocketStore' }
  )
)