// src/integrations/services/telemetry.service.ts
import { FieldValue } from 'firebase-admin/firestore'
import { DateTime } from 'luxon'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { getServiceLogger } from '#/integrations/logger.server'

import { FireCollections } from '#/constants/firebase'

import type { AgentTelemetry } from '#/schema/telemetry'

export class TelemetryService {
  private logger = getServiceLogger('TelemetryService')

  async recordAgentCall(data: AgentTelemetry): Promise<void> {
    try {
      this.logger.info('Agent call telemetry', {
        jobId: data.jobId,
        billId: data.billId,
        tokens: data.tokensTotal,
        duration: data.duration,
        status: data.status,
        preset: data.preset,
      })

      await adminDb.collection(FireCollections.TELEMETRY_COLLECTION).add({
        ...data,
        timestamp: DateTime.now().toJSDate(),
      })

      await this.updateAggregations(data)
    } catch (error) {
      console.log('NORMAL ERROR', error)
      this.logger.error('Failed to record telemetry', error)
    }
  }

  private async updateAggregations(data: AgentTelemetry): Promise<void> {
    await adminDb
      .collection(FireCollections.ANALYZE_COLLECTION)
      .doc(data.jobId)
      .update({
        totalTokens: FieldValue.increment(data.tokensTotal),
        callCount: FieldValue.increment(1),
        lastUpdated: DateTime.now().toJSDate(),
        error: data.status === 'success' ? FieldValue.delete() : data.error,
      })
  }
}

export const createTelemetryService = () => new TelemetryService()
