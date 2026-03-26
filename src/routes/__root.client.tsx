import { useJobsSubscriptionManager } from '#/hooks/use-jobs-subscription-manager.client'

/**
 * Initialize global job subscriptions
 * This component ensures the subscription manager hook runs at root level
 *
 * Marked as .client.tsx so it only runs on the client
 */
export function JobsSubscriptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useJobsSubscriptionManager()
  return <>{children}</>
}
