import type { AuthRepository } from '../../domain/finance/workspaceRepository'
import { supabase } from './client'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export class SupabaseAuthRepository implements AuthRepository {
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await requireClient().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await requireClient().auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } })
    if (error) throw new Error(error.message)
  }

  async signOut(): Promise<void> {
    const { error } = await requireClient().auth.signOut()
    if (error) throw new Error(error.message)
  }

  async getUserEmail(): Promise<string | null> {
    const { data, error } = await requireClient().auth.getUser()
    if (error) throw new Error(error.message)
    return data.user?.email ?? null
  }

  onAuthChange(callback: (email: string | null) => void): () => void {
    const { data } = requireClient().auth.onAuthStateChange((_event, session) => callback(session?.user.email ?? null))
    return () => data.subscription.unsubscribe()
  }
}
