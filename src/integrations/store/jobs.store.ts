import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { invalidateQueriesByKeys } from '#/hooks/invalidate-utils'
import { UPDATE_COLLECTION_INVALIDATION_KEYS } from '#/hooks/mutation/collection'

import { getContext } from '../tanstack-query/root-provider'

import type { AnalyzeJobData } from '#/schema/collections'

const ACTIVE_JOBS_LIMIT = 20
const COMPLETED_JOB_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface JobStatusItem extends AnalyzeJobData {
  // The AnalyzeJobData already has all needed fields
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

          let newJobs = [...state.activeJobs, job]

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
            job.jobId === jobId ? { ...job, ...updates } : job
          )

          // Clean up old jobs during update
          return {
            activeJobs: updated,
          }
        })
      },

      /**
       * Batch update multiple jobs at once
       * Used by Firestore subscription to update all active jobs in one operation
       */
      updateJobs: (jobs: Array<Partial<JobStatusItem> & { jobId: string }>) => {
        set((state) => {
          // Build a map of job IDs to updates
          const updatesMap = new Map(jobs.map((j) => [j.jobId, j]))

          // Update existing jobs or add new ones
          let updated = state.activeJobs.map((job) => {
            const updates = updatesMap.get(job.jobId)
            return updates ? { ...job, ...updates } : job
          })

          // Add new jobs that don't exist
          for (const jobUpdate of jobs) {
            if (!updated.find((j) => j.jobId === jobUpdate.jobId)) {
              updated.push(jobUpdate as JobStatusItem)
            }
          }

          // Sort by updatedAt descending (most recent first)
          updated = updated.sort(
            (a, b) => (b.updatedAt.getTime()) - (a.updatedAt.getTime())
          )

          // Limit to N most recent jobs
          if (updated.length > ACTIVE_JOBS_LIMIT) {
            updated = updated.slice(0, ACTIVE_JOBS_LIMIT)
          }

          // Invalidate all collections cache on update to ensure consistency
          const completedOrFailedJobs = jobs.filter((j) =>
            j.status === 'completed' || j.status === 'failed'
          )
          if (completedOrFailedJobs.length > 0) {
            const affectedCollectionIds = completedOrFailedJobs
              .map((j) => j.data?.collectionId)
              .filter(Boolean) as Array<string>

            const { queryClient } = getContext();
            invalidateQueriesByKeys(
              queryClient,
              affectedCollectionIds.map((id) => UPDATE_COLLECTION_INVALIDATION_KEYS(id)).flat()
            )
          }

          return { activeJobs: updated }
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
            const updatedTime = job.updatedAt.getTime()
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
      version: 2,
    }
  )
)
