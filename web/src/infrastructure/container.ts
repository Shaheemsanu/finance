import { WorkspaceService } from '../application/workspace/workspaceService'
import { DemoWorkspaceRepository } from './demo/DemoWorkspaceRepository'
import { isSupabaseConfigured } from './supabase/client'
import { SupabaseAuthRepository } from './supabase/SupabaseAuthRepository'
import { SupabaseWorkspaceRepository } from './supabase/SupabaseWorkspaceRepository'

export const workspaceRepository = isSupabaseConfigured ? new SupabaseWorkspaceRepository() : new DemoWorkspaceRepository()
export const workspaceService = new WorkspaceService(workspaceRepository)
export const authRepository = isSupabaseConfigured ? new SupabaseAuthRepository() : null
