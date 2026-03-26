import z from 'zod'

export const ModelResponseSchema = z.object({
  type: z.string(),
  key: z.string(),
  display_name: z.string(),
  description: z.string(),
  loaded_instances: z.array(
    z.object({
      id: z.string(),
      config: z.object({
        context_length: z.number(),
        eval_batch_size: z.number(),
        flash_attention: z.boolean(),
        num_experts: z.number(),
        offload_kv_cache_to_gpu: z.boolean(),
      }),
    }),
  ),
  capabilities: z.object({
    vision: z.boolean(),
    trained_for_tool_use: z.boolean(),
  }),
})

export type ModelResponse = z.infer<typeof ModelResponseSchema>

// Load model request
export const LoadModelRequestSchema = z.object({
  model: z.string(),
  context_length: z.number().optional(),
  eval_batch_size: z.number().optional(),
  flash_attention: z.boolean().optional(),
  num_experts: z.number().optional(),
})

export type LoadModelRequest = z.infer<typeof LoadModelRequestSchema>

export const LoadModelResponseSchema = z.object({
  instance_id: z.string(),
  load_time_seconds: z.number(),
  status: z.string(),
})

export type LoadModelResponse = z.infer<typeof LoadModelResponseSchema>

// Unload model request
export const UnloadModelRequestSchema = z.object({ instance_id: z.string() })

export type UnloadModelRequest = z.infer<typeof UnloadModelRequestSchema>

export const UnloadModelResponseSchema = z.object({ instance_id: z.string() })

export type UnloadModelResponse = z.infer<typeof UnloadModelResponseSchema>

export const GpuStatus = z.object({
  gpuUtilization: z.number(),
  memoryUsedMB: z.number(),
  memoryTotalMB: z.number(),
})

export type GpuStatusType = z.infer<typeof GpuStatus>
