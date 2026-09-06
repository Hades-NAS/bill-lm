import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { toDate } from '#/utils/firestore-date'

import { invalidateQueriesByKeys } from '#/hooks/invalidate-utils'
import { UPDATE_COLLECTION_INVALIDATION_KEYS } from '#/hooks/mutation/collection'

import { getContext } from '../tanstack-query/root-provider'

import type { AnalyzeJobNotification } from '#/schema/collections'

const ACTIVE_JOBS_LIMIT = 20
const COMPLETED_JOB_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours

export type JobStatusItem = AnalyzeJobNotification

function normalizeJobDates(job: JobStatusItem): JobStatusItem {
  return {
    ...job,
    createdAt: toDate(job.createdAt),
    updatedAt: toDate(job.updatedAt),
  }
}

interface JobsStore {
  activeJobs: Array<JobStatusItem>
  addJob: (job: JobStatusItem) => void
  updateJob: (jobId: string, updates: Partial<JobStatusItem>) => void
  updateJobs: (jobs: Array<Partial<JobStatusItem> & { jobId: string }>) => void
  removeJob: (jobId: string) => void
  getJobById: (jobId: string) => JobStatusItem | undefined
  hasActiveJobs: () => boolean
  getActiveJobsCount: () => number
  cleanupOldJobs: () => void
  clearJobs: () => void
}

export const useJobsStore = create<JobsStore>()(
  persist(
    (set, get) => ({
      activeJobs: [],

      addJob: (job: JobStatusItem) => {
        set((state) => {
          const exists = state.activeJobs.find((j) => j.jobId === job.jobId)
          if (exists) return state

          let newJobs = [...state.activeJobs, normalizeJobDates(job)]

          // Keep only the N most recent jobs (prepend new)
          if (newJobs.length > ACTIVE_JOBS_LIMIT) {
            newJobs = newJobs.slice(-ACTIVE_JOBS_LIMIT)
          }

          return {
            activeJobs: newJobs,
          }
        })
      },

      clearJobs: () => {
        set(() => ({
          activeJobs: [],
        }))
      },

      updateJob: (jobId: string, updates: Partial<JobStatusItem>) => {
        set((state) => {
          const updated = state.activeJobs.map((job) =>
            job.jobId === jobId ? { ...job, ...updates } : job,
          )

          // Clean up old jobs during update
          return {
            activeJobs: updated,
          }
        })
      },

      /**
       * Reconcile against the complete unread-jobs Firestore snapshot.
       * Jobs absent from that snapshot were deleted or marked as read and must
       * not remain as stale browser notifications.
       */
      updateJobs: (jobs: Array<Partial<JobStatusItem> & { jobId: string }>) => {
        set(() => {
          const updated = jobs
            .map((job) => normalizeJobDates(job as JobStatusItem))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

          // Limit to N most recent jobs
          const limitedJobs = updated.slice(0, ACTIVE_JOBS_LIMIT)

          // Invalidate all collections cache on update to ensure consistency
          const completedOrFailedJobs = jobs.filter(
            (j) => j.status === 'completed' || j.status === 'failed',
          )
          if (completedOrFailedJobs.length > 0) {
            const affectedCollectionIds = completedOrFailedJobs
              .map((j) => j.data?.collectionId)
              .filter(Boolean) as Array<string>

            const { queryClient } = getContext()

            invalidateQueriesByKeys(
              queryClient,
              Array.from(new Set(affectedCollectionIds))
                .map((id) => UPDATE_COLLECTION_INVALIDATION_KEYS(id))
                .flat(),
            )
          }

          return { activeJobs: limitedJobs }
        })
      },

      removeJob: (jobId: string) => {
        set((state) => ({
          activeJobs: state.activeJobs.filter((job) => job.jobId !== jobId),
        }))
      },

      /**
       * Clean up completed/failed jobs older than retention period
       */
      cleanupOldJobs: () => {
        const now = Date.now()
        const cutoff = now - COMPLETED_JOB_RETENTION_MS

        set((state) => ({
          activeJobs: state.activeJobs.filter((job) => {
            // Keep in-progress/pending jobs always
            if (job.status === 'in-progress' || job.status === 'pending') {
              return true
            }

            // Keep completed/failed jobs if recent
            const updatedTime = toDate(job.updatedAt).getTime()
            return updatedTime > cutoff
          }),
        }))
      },

      getJobById: (jobId: string) => {
        const jobs = get().activeJobs
        return jobs.find((j) => j.jobId === jobId)
      },

      hasActiveJobs: () => {
        return get().activeJobs.length > 0
      },

      getActiveJobsCount: () => {
        return get().activeJobs.length
      },
    }),
    {
      name: 'jobs-storage-v2', // Bumped version for schema change
      version: 3,
      merge: (persistedState, currentState) => {
        const persistedJobs = (persistedState as Partial<JobsStore>)?.activeJobs

        return {
          ...currentState,
          activeJobs: Array.isArray(persistedJobs)
            ? persistedJobs.map((job) => normalizeJobDates(job))
            : currentState.activeJobs,
        }
      },
    },
  ),
)
