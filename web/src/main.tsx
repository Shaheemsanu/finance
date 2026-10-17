import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { WorkspaceApp } from './presentation/app/WorkspaceApp'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WorkspaceApp />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
