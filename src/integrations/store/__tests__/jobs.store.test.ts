import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobsStore  } from '../jobs.store'

import type {JobStatusItem} from '../jobs.store';

vi.mock('#/hooks/invalidate-utils', () => ({
  invalidateQueriesByKeys: vi.fn(),
}))

vi.mock('#/hooks/mutation/collection', () => ({
  UPDATE_COLLECTION_INVALIDATION_KEYS: vi.fn(() => []),
}))

vi.mock('#/integrations/tanstack-query/root-provider', () => ({
  getContext: vi.fn(() => ({ queryClient: {} })),
}))

function job(jobId: string, updatedAt: Date): JobStatusItem {
  return {
    jobId,
    firebaseUid: 'firebase-user-1',
    credentialId: null,
    data: {
      collectionId: 'collection-1',
      collectionName: 'Facturas 2026',
      billIds: [],
      type: 'all' as const,
    },
    percentage: 0,
    status: 'pending' as const,
    createdAt: updatedAt,
    updatedAt,
    totalTokens: 0,
    callCount: 0,
    deletedAt: null,
    read: false,
  }
}

describe('jobs store', () => {
  beforeEach(() => {
    useJobsStore.getState().clearJobs()
  })

  it('replaces stale local notifications with the unread Firestore snapshot', () => {
    useJobsStore.setState({
      activeJobs: [job('already-read-job', new Date('2026-09-06T10:00:00Z'))],
    })

    useJobsStore
      .getState()
      .updateJobs([job('current-job', new Date('2026-09-06T11:00:00Z'))])

    expect(
      useJobsStore.getState().activeJobs.map((item) => item.jobId),
    ).toEqual(['current-job'])
  })

  it('normalizes date strings restored from browser storage', () => {
    const persistedJob = {
      ...job('persisted-job', new Date('2026-09-06T11:00:00Z')),
      createdAt: '2026-09-06T11:00:00Z',
      updatedAt: '2026-09-06T11:00:00Z',
    } as unknown as JobStatusItem

    useJobsStore.getState().addJob(persistedJob)

    const [restoredJob] = useJobsStore.getState().activeJobs

    expect(restoredJob.updatedAt).toBeInstanceOf(Date)
    expect(restoredJob.updatedAt.getTime()).toBe(
      new Date('2026-09-06T11:00:00Z').getTime(),
    )
  })
})
