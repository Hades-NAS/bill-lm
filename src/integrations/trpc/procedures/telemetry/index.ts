// src/integrations/trpc/routers/telemetry.router.ts (nuevo)

import { DateTime } from "luxon"
import z from "zod"

import { WithAuthSchema } from "#/schema/auth"

import { adminDb } from "#/integrations/firebase/firebase.server"
import { getServiceLogger } from "#/integrations/logger.server"

import { toDate } from "#/utils/firestore-date"
import { roundToDecimals } from "#/utils/math"

import { FireCollections } from "#/constants/firebase"

import { privateProcedure } from "../../init"

import type { AnalyzeJobData } from "#/schema/collections"
import type { AgentTelemetry } from "#/schema/telemetry"

const logger = getServiceLogger('TelemetryRouter')

const PRETTY_REDUCTION_FACTOR = 1

export const telemetryRouter = {
  getJobStats: privateProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const jobDoc = await adminDb
          .collection(FireCollections.ANALYZE_COLLECTION)
          .doc(input.jobId)
          .get()

        if (!jobDoc.exists) {
          return null
        }

        const data = jobDoc.data() as AnalyzeJobData

        return {
          totalTokens: (data.totalTokens || 0) * PRETTY_REDUCTION_FACTOR,
          callCount: data.callCount || 0,
          updatedAt: toDate(data.updatedAt),
        }
      } catch (error) {
        logger.error('Error fetching job stats for jobId ' + input.jobId, error)
        throw error
      }
    }),

  getAgentCalls: privateProcedure
    .input(z.object({ jobId: z.string(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      try {
        const calls = await adminDb
          .collection(FireCollections.TELEMETRY_COLLECTION)
          .where('jobId', '==', input.jobId)
          .orderBy('timestamp', 'desc')
          .limit(input.limit)
          .get()

        const callsArray = calls.docs.map(doc => {
          const rawData = doc.data()
          return {
            ...rawData,
            duration: rawData.duration * PRETTY_REDUCTION_FACTOR,
            timestamp: toDate(rawData.timestamp),
          } as AgentTelemetry
        })

        const avgDuration = roundToDecimals(callsArray.reduce((sum, call) => sum + (call.duration), 0) / callsArray.length,
        )

        return {
          calls: callsArray,
          avgDuration,
        }
      } catch (error) {
        logger.error('Error fetching agent calls for jobId ' + input.jobId, error)
        throw error
      }
    }),

  getUserMetrics: privateProcedure
    .input(WithAuthSchema(z.object({})))
    .query(async ({ input }) => {
      // Últimos 7 días
      try {
        const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toJSDate()

        const calls = await adminDb
          .collection(FireCollections.TELEMETRY_COLLECTION)
          .where('userId', '==', input.auth.userId)
          .where('timestamp', '>', sevenDaysAgo)
          .get()

        const totalTokens = calls.docs.reduce((sum, doc) => {
          return sum + (doc.data().tokensTotal ?? 0)
        }, 0)

        const avgDuration = calls.docs.reduce((sum, doc) => {
          return sum + (doc.data().duration ?? 0)
        }, 0) / calls.docs.length

        return {
          totalCalls: calls.docs.length,
          totalTokens,
          avgDuration: Math.round(avgDuration),
          successRate: (calls.docs.filter(d => d.data().status === 'success').length / calls.docs.length) * 100,
        }
      } catch (error) {
        logger.error('Error fetching user metrics:', error)
        throw error
      }
    }),

  getUserJobs: privateProcedure
    .input(WithAuthSchema(z.object({ limit: z.number().default(50) })))
    .query(async ({ input }) => {
      try {
        const jobs = await adminDb
          .collection(FireCollections.ANALYZE_COLLECTION)
          .where('userId', '==', input.auth.userId)
          .orderBy('updatedAt', 'desc')
          .limit(input.data.limit)
          .get()

        return jobs.docs.map(doc => {
          const rawData = doc.data() as AnalyzeJobData
          return {
            ...rawData,
            createdAt: toDate(rawData.createdAt),
            updatedAt: toDate(rawData.updatedAt),
          } as AnalyzeJobData
        })
      } catch (error) {
        logger.error('Error fetching user jobs:', error)
        throw error
      }
    }),
}
