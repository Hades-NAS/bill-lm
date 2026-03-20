import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AnalyzeJobData } from '#/schema/collections'

export interface JobStatusItem extends AnalyzeJobData {
  // The AnalyzeJobData already has all needed fields
}

interface JobsStore {
  activeJobs: Array<JobStatusItem>
  addJob: (job: JobStatusItem) => void
  updateJob: (jobId: string, updates: Partial<JobStatusItem>) => void
  removeJob: (jobId: string) => void
  getJobById: (jobId: string) => JobStatusItem | undefined
  hasActiveJobs: () => boolean
  getActiveJobsCount: () => number
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

          // Keep only the 15 most recent jobs (FIFO)
          if (newJobs.length > 15) {
            newJobs = newJobs.slice(-15)
          }

          return {
            activeJobs: newJobs,
          }
        })
      },

      updateJob: (jobId: string, updates: Partial<JobStatusItem>) => {
        set((state) => ({
          activeJobs: state.activeJobs.map((job) =>
            job.jobId === jobId ? { ...job, ...updates } : job
          ),
        }))
      },

      removeJob: (jobId: string) => {
        set((state) => ({
          activeJobs: state.activeJobs.filter((job) => job.jobId !== jobId),
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
      name: 'jobs-storage',
    }
  )
)
