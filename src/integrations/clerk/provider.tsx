import { ClerkProvider } from '@clerk/clerk-react'

import { env } from '#/env'

const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error(
    'Error on Clerk Provider: Add your Clerk Publishable Key to the .env.local file',
  )
}

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      afterSignUpUrl="/collections"
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/collections"
      signInUrl="/collections"
      signUpFallbackRedirectUrl="/collections"
      signUpUrl="/collections"
    >
      {children}
    </ClerkProvider>
  )
}

// afterSignUpUrl="/collections"
