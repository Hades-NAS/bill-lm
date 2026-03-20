import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useRef } from 'react'

import { db } from '#/integrations/firebase/firebase.client'
import { useJobsStore } from '#/integrations/jobs/jobs.store'

import { FireCollections } from '#/constants/firebase'

/**
 * Global subscription manager hook
 * Lives at root level (__root.tsx) to maintain subscriptions across route navigation
 *
 * Automatically:
 * - Creates Firestore subscriptions for new jobs
 * - Updates the store when job data changes
 * - Cleans up subscriptions when jobs complete/error
 * - Prevents memory leaks via useRef to track subscriptions
 */
export function useJobsSubscriptionManager() {
  const activeJobs = useJobsStore((state) => state.activeJobs)
  const updateJob = useJobsStore((state) => state.updateJob)
  const removeJob = useJobsStore((state) => state.removeJob)

  // useRef persists subscriptions across re-renders
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map())
  const jobIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Get current job IDs
    const currentJobIds = new Set(activeJobs.map((j) => j.jobId))

    // Create subscriptions for NEW jobs only
    for (const jobId of currentJobIds) {
      // Already subscribed? Skip
      if (subscriptionsRef.current.has(jobId)) continue

      // Find the job to get its data
      const job = activeJobs.find((j) => j.jobId === jobId)
      if (!job) continue

      // Create subscription to this job document
      const jobDocRef = doc(db, FireCollections.ANALYZE_COLLECTION, jobId)

      const unsubscribe = onSnapshot(
        jobDocRef,
        (docSnap) => {
          if (!docSnap.exists()) return

          const data = docSnap.data()

          // Ensure all required fields exist
          const updates: any = {
            percentage: data.percentage ?? 0,
            status: data.status,
            error: data.error,
            jobId: data.jobId,
            data: data.data,
          }

          // Handle date conversion
          if (data.createdAt) {
            updates.createdAt = data.createdAt?.toDate?.() ?? new Date(data.createdAt)
          }
          if (data.updatedAt) {
            updates.updatedAt = data.updatedAt?.toDate?.() ?? new Date(data.updatedAt)
          }

          updateJob(jobId, updates)

          // Log for debugging
          console.debug(`[Jobs] Updated job ${jobId}:`, { status: data.status, percentage: data.percentage })
        },
        (error) => {
          console.error(`Error subscribing to job ${jobId}:`, error)
          removeJob(jobId)
          subscriptionsRef.current.delete(jobId)
        }
      )

      // Store unsubscribe function
      subscriptionsRef.current.set(jobId, unsubscribe)
    }

    // Clean up subscriptions for jobs that no longer exist in store
    subscriptionsRef.current.forEach((unsubscribe, jobId) => {
      if (!currentJobIds.has(jobId)) {
        console.debug(`[Jobs] Unsubscribing from job ${jobId}`)
        unsubscribe()
        subscriptionsRef.current.delete(jobId)
      }
    })

    // Update the ref to track current jobs
    jobIdsRef.current = currentJobIds

    // Cleanup on unmount only (not on every update)
    return () => {
      subscriptionsRef.current.forEach((unsubscribe) => {
        unsubscribe()
      })
      subscriptionsRef.current.clear()
    }
  }, [activeJobs.map((j) => j.jobId).join(',')]) // Only depend on jobId list, not full objects
}
