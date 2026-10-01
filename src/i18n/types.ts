/**
 * NewMark Platform Ultra: Enterprise Internationalization (i18n) & Localization (l10n)
 * Type Definitions & Translation Keys Schema
 * Covers Navigation, Dashboard Metrics, Agent Orchestration, DataGrid, and RFC 7807 Domain Errors.
 */

export type SupportedLocale = 'en-US' | 'vi-VN';

export interface NavigationTranslations {
  supervisorAgent: string;
  supervisorAgentBadge: string;
  inventoryFefo: string;
  inventoryFefoBadge: string;
  dynamicObjects: string;
  dynamicObjectsBadge: string;
  kafkaEventMesh: string;
  kafkaEventMeshBadge: string;
  architectureSpec: string;
  tenantLabel: string;
  clusterNodeActive: string;
  roleLabel: string;
  redlockMutexReady: string;
  superAdminRole: string;
  enterpriseArchitectRole: string;
  opsManagerRole: string;
  financeControllerRole: string;
  platformSubtitle: string;
}

export interface DashboardTranslations {
  oltpPersistence: string;
  oltpSubtext: string;
  distributedCache: string;
  cacheSubtext: string;
  eventBroker: string;
  brokerSubtext: string;
  agentRuntime: string;
  runtimeSubtext: string;
  systemHealthNominal: string;
  totalValuation: string;
  activeBatches: string;
  safetyThreshold: string;
  concurrencyLockActive: string;
  clusterLatency: string;
  throughputEventsPerSec: string;
}

export interface AgentTranslations {
  workspaceTitle: string;
  workspaceSubtitle: string;
  wsActiveStatus: string;
  httpPollingStatus: string;
  awaitingDirective: string;
  activeStatusPrefix: string;
  operatorBadge: string;
  supervisorBadge: string;
  systemTraceBadge: string;
  executionStepsTitle: string;
  inspectData: string;
  collapseData: string;
  inputParameters: string;
  databaseOutput: string;
  quickDirectivesTitle: string;
  directiveInputPlaceholder: string;
  dispatchButton: string;
  supervisorOrchestrating: string;
  awaitingSignOffBadge: string;
  authorizeSignPoButton: string;
  rejectOrderButton: string;
  emitRestockOrderButton: string;
  disburseFundsButton: string;
  actionExecutedSuccess: string;
  interactiveActionsTitle: string;
  quickDirective1: string;
  quickDirective2: string;
  quickDirective3: string;
  quickDirective4: string;
}

export interface DataGridTranslations {
  searchPlaceholder: string;
  customizeColumns: string;
  visibleColumns: string;
  refreshTooltip: string;
  exportCsv: string;
  exportJson: string;
  noMatchingRecords: string;
  syncingDataset: string;
  rowsPerPage: string;
  showingRecords: string;
  prevPage: string;
  nextPage: string;
  pageOf: string;
  actionsHeader: string;
  createdAtHeader: string;
  statusHeader: string;
  editCellTooltip: string;
}

export interface InventoryTranslations {
  title: string;
  subtitle: string;
  receiveBatchButton: string;
  allocateStockTitle: string;
  allocateStockSubtitle: string;
  selectedSku: string;
  unitsLabel: string;
  allocateButton: string;
  batchesTableTitle: string;
  batchesTableSubtitle: string;
  purchaseOrdersTitle: string;
  purchaseOrdersSubtitle: string;
  pendingApprovalSummary: string;
  approvePoButton: string;
  disbursePaymentButton: string;
  reconciledBadge: string;
  daysRemaining: string;
  expiredBadge: string;
  safeBadge: string;
  breachBadge: string;
}

export interface SchemaTranslations {
  title: string;
  subtitle: string;
  defineNewSchemaButton: string;
  insertRecordButton: string;
  auditTrailTitle: string;
  fieldsCount: string;
  mandatoryIndicator: string;
}

export interface ErrorTranslations {
  unauthorized: string;
  forbidden: string;
  tokenExpired: string;
  tenantBoundaryViolation: string;
  insufficientStock: string;
  concurrencyLockFailed: string;
  resourceNotFound: string;
  validationError: string;
  internalServerError: string;
  invalidStateTransition: string;
  disbursementPrerequisiteFailed: string;
}

export interface TranslationDictionary {
  locale: SupportedLocale;
  localeName: string;
  navigation: NavigationTranslations;
  dashboard: DashboardTranslations;
  agents: AgentTranslations;
  datagrid: DataGridTranslations;
  inventory: InventoryTranslations;
  schemas: SchemaTranslations;
  errors: ErrorTranslations;
}
