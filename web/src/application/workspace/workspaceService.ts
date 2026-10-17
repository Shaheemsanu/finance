import type { CreateBusinessInput, CreateSiteInput, CreateTransactionInput, SiteId } from '../../domain/finance/models'
import type { SiteScope, WorkspaceRepository } from '../../domain/finance/workspaceRepository'
import { getDashboardSummary } from '../dashboard/getDashboardSummary'

export class WorkspaceService {
  private readonly repository: WorkspaceRepository

  constructor(repository: WorkspaceRepository) {
    this.repository = repository
  }

  load(scope: SiteScope = 'all') {
    return this.repository.loadSnapshot(scope)
  }

  async dashboard(siteId: SiteId | 'all') {
    return getDashboardSummary(await this.load(siteId), siteId)
  }

  createBusiness(input: CreateBusinessInput) {
    return this.repository.createBusiness(input)
  }

  createSite(input: CreateSiteInput) {
    return this.repository.createSite(input)
  }

  createTransaction(input: CreateTransactionInput) {
    return this.repository.createTransaction(input)
  }
}
