import { Worker } from "bullmq"
import { DateTime } from "luxon"

import { buildUserPrompt } from "#/utils/bill"
import { roundToDecimals } from "#/utils/math"

import { FireCollections } from "#/constants/firebase"

import { AgentEngine } from "../agents"
import { adminDb } from "../firebase/firebase.server"
import { LMStudio } from "../lm-studio"
import { getServiceLogger } from "../logger.server"
import { StorageHelper } from "../minio/helper"
import { prisma } from "../prisma"
import { redisConnection } from "../redis"
import { parseAndValidateInvoiceXML } from "../xml"

import type { XmlBillContent } from "#/schema/bill"
import type { AnalyzeJobData, UpdateAnalyzeJobData } from "#/schema/collections"
import type { AnalyzeBillOutput } from "../agents/outputs"
import type { Job } from "bullmq";

import { env } from "#/env"

const logger = getServiceLogger("AnalyzeWorker")

logger.info(`Starting Analyze Worker connecting to Redis at ${redisConnection.host}:${redisConnection.port}`)

export const jobHandler = async (job: Job<AnalyzeJobData>) => {
  try {
    logger.info(`Received job id: ${job.id}`)

    const { data, jobId } = job.data

    const { billIds } = data

    const hasModelLoaded = await LMStudio.hasModelLoaded(LMStudio.MODEL_KEY)

    logger.debug(`Model ${LMStudio.MODEL_KEY} loaded in LM Studio: ${hasModelLoaded}`)

    const billsResults: Array<{ billId: string, result: AnalyzeBillOutput }> = []

    if (!hasModelLoaded) {
      const response = await LMStudio.loadModel({
        model: LMStudio.MODEL_KEY,
        context_length: 8192,
        flash_attention: true,
      })

      logger.debug(`Load model response from LM Studio for model ${LMStudio.MODEL_KEY}`, { response })

      if (!response) {
        logger.error(`Failed to load model ${LMStudio.MODEL_KEY} in LM Studio`)
        return null
      }
    }

    const billsToAnalyze = await prisma.billHeader.findMany({
      where: {
        id: {
          in: billIds,
        },
      },
      select: {
        id: true,
        billType: true,
        storagePath: true,
      }
    })

    logger.info(`Fetched ${billsToAnalyze.length} bills to analyze for job id: ${job.id}`)

    const billsXmlContents = await Promise.all(
      billsToAnalyze.map(async (bill) => {
        const content = await StorageHelper.getObject(bill.storagePath)

        const result = parseAndValidateInvoiceXML(content)

        return {
          billId: bill.id,
          billType: bill.billType,
          xml: result.success ? result.data : null,
        }
      })
    )

    logger.info(`Fetched and parsed XML content for bills in job id: ${job.id}`)

    if (!billsXmlContents || billsXmlContents.length === 0 || billsXmlContents.some(bill => !bill.xml)) {
      logger.error(`Failed to fetch or parse XML content for bills in job id: ${job.id}`)
      return null
    }

    const billsXmlMap = billsXmlContents.reduce((acc, bill) => {
      acc[bill.billId] = bill.xml
      return acc
    }, {} as Record<string, XmlBillContent | null>)

    for (const bill of billsToAnalyze) {

      const xmlContent = billsXmlMap[bill.id]

      if (!xmlContent) {
        logger.error(`Missing XML content for bill id: ${bill.id} in job id: ${job.id}`)
        continue
      }

      const prompt = buildUserPrompt(job.data, bill.billType, xmlContent)

      const output = await AgentEngine.process(prompt)

      if (!output) {
        logger.error(`AgentEngine failed to process job id: ${job.id}`)
        continue
      }

      logger.info(`Bill id: ${bill.id} analyzed with percentage: ${output.percentage}% for job id: ${job.id}`)

      billsResults.push({
        billId: bill.id,
        result: output,
      })

      const dataJob: UpdateAnalyzeJobData = {
        jobId,
        percentage: roundToDecimals((billsResults.length / billIds.length) * 100),
        status: billsResults.length === billIds.length ? 'completed' : 'in-progress',
        updatedAt: DateTime.now().toJSDate(),
      }

      logger.info(`Updating job id: ${job.id} with percentage: ${dataJob.percentage}% and status: ${dataJob.status}`)

      await adminDb.collection(FireCollections.ANALYZE_COLLECTION).doc(jobId).update(dataJob)
    }

    const updatedAt = DateTime.now().toJSDate()

    await prisma.$transaction(
      billsResults.map(({ billId, result }) =>
        prisma.billHeader.update({
          where: { id: billId },
          data: {
            percentage: roundToDecimals(result.percentage, 0),
            reason: result.reason,
            updatedAt,
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
}, 3_000)

logger.info("Analyze Worker started and listening for jobs...")
