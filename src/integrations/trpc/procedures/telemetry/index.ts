import { DateTime } from 'luxon'
import z from 'zod'

import { adminDb } from '#/integrations/firebase/firebase.server'
// import { getServiceLogger } from '#/integrations/logger.server'

import { toDate } from '#/utils/firestore-date'
import { roundToDecimals } from '#/utils/math'

import { FireCollections } from '#/constants/firebase'

import { privateProcedure } from '../../init'

import type { AnalyzeJobData } from '#/schema/collections'
import type { AgentTelemetry } from '#/schema/telemetry'

// const logger = getServiceLogger('TelemetryRouter')

const PRETTY_REDUCTION_FACTOR = 1

export const telemetryRouter = {
  getJobStats: privateProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const jobDoc = await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(input.jobId)
        .get()

      if (!jobDoc.exists) {
        return null
      }

      const data = jobDoc.data() as AnalyzeJobData

      if (data.userId !== ctx.principal.userId) {
        return null
      }

      return {
        totalTokens: (data.totalTokens || 0) * PRETTY_REDUCTION_FACTOR,
        callCount: data.callCount || 0,
        updatedAt: toDate(data.updatedAt),
      }
    }),

  getAgentCalls: privateProcedure
    .input(z.object({ jobId: z.string(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const jobDoc = await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(input.jobId)
        .get()

      if (!jobDoc.exists || jobDoc.data()?.userId !== ctx.principal.userId) {
        return { calls: [], avgDuration: 0 }
      }

      const calls = await adminDb
        .collection(FireCollections.TELEMETRY_COLLECTION)
        .where('jobId', '==', input.jobId)
        .orderBy('timestamp', 'desc')
        .limit(input.limit)
        .get()

      const callsArray = calls.docs.map((doc) => {
        const rawData = doc.data()
        return {
          ...rawData,
          duration: rawData.duration * PRETTY_REDUCTION_FACTOR,
          timestamp: toDate(rawData.timestamp),
        } as AgentTelemetry
      })

      const avgDuration = roundToDecimals(
        callsArray.reduce((sum, call) => sum + call.duration, 0) /
        callsArray.length,
      )

      return {
        calls: callsArray,
        avgDuration,
      }
    }),

  getUserMetrics: privateProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      // Últimos 7 días
      const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toJSDate()

      const calls = await adminDb
        .collection(FireCollections.TELEMETRY_COLLECTION)
        .where('userId', '==', ctx.principal.userId)
        .where('timestamp', '>', sevenDaysAgo)
        .get()

      const totalTokens = calls.docs.reduce((sum, doc) => {
        return sum + (doc.data().tokensTotal ?? 0)
      }, 0)

      const avgDuration =
        calls.docs.reduce((sum, doc) => {
          return sum + (doc.data().duration ?? 0)
        }, 0) / calls.docs.length

      return {
        totalCalls: calls.docs.length,
        totalTokens,
        avgDuration: Math.round(avgDuration),
        successRate:
          (calls.docs.filter((d) => d.data().status === 'success').length /
            calls.docs.length) *
          100,
      }
    }),

  getUserJobs: privateProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const jobs = await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .where('userId', '==', ctx.principal.userId)
        .orderBy('updatedAt', 'desc')
        .limit(input.limit)
        .get()

      return jobs.docs.map((doc) => {
        const rawData = doc.data() as AnalyzeJobData
        return {
          ...rawData,
          createdAt: toDate(rawData.createdAt),
          updatedAt: toDate(rawData.updatedAt),
        } as AnalyzeJobData
      })
    }),
}
