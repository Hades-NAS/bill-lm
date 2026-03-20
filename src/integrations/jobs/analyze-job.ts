import { Worker } from "bullmq"
import { DateTime } from "luxon"

import { roundToDecimals } from "#/utils/math"

import { FireCollections } from "#/constants/firebase"

import { AgentEngine } from "../agents"
import { adminDb } from "../firebase/firebase.server"
import { LMStudio } from "../lm-studio"
import { getServiceLogger } from "../logger.server"
import { prisma } from "../prisma"
import { redisConnection } from "../redis"


import type { AnalyzeJobData, UpdateAnalyzeJobData } from "#/schema/collections"
import type { AnalyzeBillOutput } from "../agents/outputs"
import type { Job } from "bullmq";

import { env } from "#/env"

const logger = getServiceLogger("AnalyzeWorker")

logger.info(`Starting Analyze Worker connecting to Redis at ${redisConnection.host}:${redisConnection.port}`)

export const jobHandler = async (job: Job<AnalyzeJobData>) => {
  try {
    logger.info(`Received job id: ${job.id} with email subject: ${job.data.jobId}`)

    const { data, jobId } = job.data


    const { billIds } = data

    const hasModelLoaded = await LMStudio.hasModelLoaded(LMStudio.MODEL_KEY)

    const billsResults: Array<{ billId: string, result: AnalyzeBillOutput }> = []

    if (!hasModelLoaded) {
      const response = await LMStudio.loadModel({
        model: LMStudio.MODEL_KEY,
        context_length: 8192,
        flash_attention: true,
      })

      if (!response) {
        logger.error(`Failed to load model ${LMStudio.MODEL_KEY} in LM Studio`)
        return null
      }
    }

    for (const billId of billIds) {

      const dataMessage = {
        jobId,
        billId,
      }

      const { output } = await AgentEngine.process(JSON.stringify(dataMessage))

      if (!output) {
        logger.error(`AgentEngine failed to process job id: ${job.id}`)
        continue
      }

      logger.info(`Job id: ${job.id} processed successfully with output`, { output })

      billsResults.push({
        billId,
        result: output,
      })

      const dataJob: UpdateAnalyzeJobData = {
        jobId,
        percentage: roundToDecimals((billsResults.length / billIds.length) * 100),
        status: billsResults.length === billIds.length ? 'completed' : 'in-progress',
      }

      logger.info(`Updating job id: ${job.id} with percentage: ${dataJob.percentage}% and status: ${dataJob.status}`)

      await adminDb.collection(FireCollections.ANALYZE_COLLECTION).doc(jobId).update(dataJob)
    }

    await prisma.$transaction(
      billsResults.map(({ billId, result }) =>
        prisma.bill.update({
          where: { id: billId },
          data: {
            percentage: roundToDecimals(result.percentage),
            reason: result.reason,
            updatedAt: DateTime.now().toJSDate(),
          }
        })
      )
    )

    logger.info(`Job id: ${job.id} completed successfully. Updated ${billsResults.length} bills in the database.`)

    return true
  } catch (error) {
    logger.error(`Failed to process job id: ${job.id}`, { error: String(error) })
    return null
  }
}

const worker = new Worker<AnalyzeJobData>(
  env.ANALYZE_QUEUE_NAME,
  jobHandler,
  { connection: redisConnection }
)

async function controlLoop() {
  const gpuOk = await AgentEngine.isEngineHealthy()

  if (gpuOk) {
    worker.resume()
  } else {
    logger.debug("GPU is not healthy, pausing worker")
    await worker.pause()
  }
  return
}

setInterval(() => {
  void controlLoop()
}, 24_000)

logger.info("Analyze Worker started and listening for jobs...")
