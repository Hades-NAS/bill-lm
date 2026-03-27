import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useRef } from 'react'

import { db } from '#/integrations/firebase/firebase.client'
import { useJobsStore } from '#/integrations/store/jobs.store'

import { toDate } from '#/utils/firestore-date'

import { FireCollections } from '#/constants/firebase'

import { useUserAuth } from './auth'

/**
 * Global subscription manager hook (Optimized)
 * Lives at root level (__root.tsx) to maintain subscriptions across route navigation
 *
 * Optimization: Uses a single collection query instead of N individual doc subscriptions
 * This reduces Firestore read costs and improves performance.
 *
 * Automatically:
 * - Creates ONE subscription for active jobs (pending + in-progress)
 * - Updates the store when job data changes
 * - Automatically cleans up when jobs complete/error
 * - Prevents memory leaks via useRef to track subscription
 */
export function useJobsSubscriptionManager() {
  const auth = useUserAuth()
  const updateJobs = useJobsStore((state) => state.updateJobs)

  // useRef persists subscription across re-renders
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!auth.userId) {
      return
    }

    const jobsCollectionQuery = query(
      collection(db, FireCollections.ANALYZE_COLLECTION),
      where('userId', '==', auth.userId),
      where('status', 'in', ['pending', 'in-progress', 'completed', 'failed']),
      where('read', '==', false),
    )

    // ONE subscription for all active jobs
    const unsubscribe = onSnapshot(
      jobsCollectionQuery,
      (querySnapshot) => {
        // Get all jobs from query
        const jobs = querySnapshot.docs
          .map((doc) => {
            const data = doc.data()
            return {
              jobId: data.jobId,
              percentage: data.percentage ?? 0,
              status: data.status,
              error: data.error,
              data: data.data,
              userId: data.userId,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            }
          })
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

        // Batch update store with all jobs at once
        updateJobs(jobs)
      },
      (error) => {
        console.error('[Jobs] Error subscribing to jobs collection:', error)
        // Subscription error, but we'll try again on next mount
      },
    )

    // Store unsubscribe function
    unsubscribeRef.current = unsubscribe

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [auth.userId]) // Only depend on userId
}
