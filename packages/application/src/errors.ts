export type ApplicationError =
  | { readonly code: 'resource.not_found' }
  | { readonly code: 'activity_revision.invalid' }
  | { readonly code: 'activity_revision.duplicate' }
  | { readonly code: 'collection_context_reference.invalid' }
  | { readonly code: 'repository.failure' }

export const resourceNotFound = (): ApplicationError => ({
  code: 'resource.not_found',
})

export const invalidActivityRevision = (): ApplicationError => ({
  code: 'activity_revision.invalid',
})

export const duplicateActivityRevision = (): ApplicationError => ({
  code: 'activity_revision.duplicate',
})

export const invalidCollectionContextReference = (): ApplicationError => ({
  code: 'collection_context_reference.invalid',
})

export const repositoryFailure = (): ApplicationError => ({
  code: 'repository.failure',
})
