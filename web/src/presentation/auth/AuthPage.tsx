import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowUpRight, LockKeyhole, Mail, TrendingUp } from 'lucide-react'
import { authRepository } from '../../infrastructure/container'

const schema = z.object({ email: z.email('Enter a valid email address'), password: z.string().min(8, 'Use at least 8 characters') })
type Values = z.infer<typeof schema>

export function AuthPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [message, setMessage] = useState('')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const submit = form.handleSubmit(async ({ email, password }) => {
    setMessage('')
    try {
      if (!authRepository) throw new Error('Authentication is not configured')
      if (mode === 'sign-up') await authRepository.signUp(email, password)
      else await authRepository.signIn(email, password)
      setMessage(mode === 'sign-up' ? 'Check your inbox to confirm your account, then sign in.' : '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to authenticate')
    }
  })
  return <main className="auth-layout">
    <section className="auth-story"><a className="brand auth-brand" href="/"><span className="brand-symbol"><TrendingUp size={18} /></span>ledgerline</a><div className="story-copy"><p className="eyebrow">A clearer view of your business</p><h1>Every site.<br /><em>One steady view.</em></h1><p>Track what comes in, what goes out, and what each part of your business is really earning.</p></div><div className="story-foot"><span>FINANCES, IN GOOD ORDER</span><span>01 — 03</span></div><div className="story-art" aria-hidden="true"><div className="art-lines" /><div className="art-axis"><span>₹8L</span><span>₹4L</span><span>₹0</span></div><div className="art-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></section>
    <section className="auth-panel"><div className="auth-form-wrap"><p className="eyebrow">WORKSPACE ACCESS</p><h2>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h2><p className="auth-subtitle">{mode === 'sign-in' ? 'Sign in to your financial workspace.' : 'Start with your email and a secure password.'}</p><form onSubmit={submit} className="auth-form" noValidate><label className="form-label">Email address<div className="input-icon"><Mail size={16} /><input type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} /></div>{form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}</label><label className="form-label">Password<div className="input-icon"><LockKeyhole size={16} /><input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" {...form.register('password')} /></div>{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}</label>{message && <div className="form-message" role="status">{message}</div>}<button className="button primary auth-submit" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}<ArrowUpRight size={16} /></button></form><p className="auth-toggle">{mode === 'sign-in' ? 'New to Ledgerline?' : 'Already registered?'} <button type="button" onClick={() => { setMessage(''); setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in') }}>{mode === 'sign-in' ? 'Create an account' : 'Sign in'}</button></p><p className="auth-privacy">Your workspace is protected by your organization’s access policies.</p></div></section>
  </main>
}
