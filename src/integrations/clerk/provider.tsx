import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env.local file')
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
      publishableKey={PUBLISHABLE_KEY!}
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
