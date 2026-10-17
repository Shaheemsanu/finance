import type { CreateBusinessInput, CreateSiteInput, CreateTransactionInput, SiteId, WorkspaceSnapshot } from './models'

export type SiteScope = SiteId | 'all'

export interface WorkspaceRepository {
  loadSnapshot(scope?: SiteScope): Promise<WorkspaceSnapshot>
  createBusiness(input: CreateBusinessInput): Promise<string>
  createSite(input: CreateSiteInput): Promise<void>
  createTransaction(input: CreateTransactionInput): Promise<void>
}

export interface AuthRepository {
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  getUserEmail(): Promise<string | null>
  onAuthChange(callback: (email: string | null) => void): () => void
}
