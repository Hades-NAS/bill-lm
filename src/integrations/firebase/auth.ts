import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

import { getFirebaseAuth } from './firebase'

import type {
  EmailPasswordCredentials,
  PasswordResetRequest,
} from '#/schema/firebase-auth'
import type { User } from 'firebase/auth'

export function observeFirebaseAuth(
  listener: (user: User | null) => void,
  onError: (error: Error) => void,
) {
  return onIdTokenChanged(getFirebaseAuth(), listener, onError)
}

export function signInWithEmail(credentials: EmailPasswordCredentials) {
  return signInWithEmailAndPassword(
    getFirebaseAuth(),
    credentials.email,
    credentials.password,
  )
}

export async function signUpWithEmail(credentials: EmailPasswordCredentials) {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    credentials.email,
    credentials.password,
  )
  await sendEmailVerification(credential.user)
  await signOut(getFirebaseAuth())
}

export function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
}

export function requestPasswordReset(value: PasswordResetRequest) {
  return sendPasswordResetEmail(getFirebaseAuth(), value.email)
}

export async function resendEmailVerification() {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('No hay una sesión activa para verificar')
  }
  await sendEmailVerification(user)
}

export function signOutFromFirebase() {
  return signOut(getFirebaseAuth())
}
