import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SiteScope } from '../../domain/finance/workspaceRepository'

interface WorkspaceUiState {
  siteScope: SiteScope
  setSiteScope: (siteScope: SiteScope) => void
}

export const useWorkspaceStore = create<WorkspaceUiState>()(persist((set) => ({
  siteScope: 'all',
  setSiteScope: (siteScope) => set({ siteScope }),
}), { name: 'ledgerline.ui.v1', partialize: (state) => ({ siteScope: state.siteScope }) }))
