# Provider connections: list and action modals

## Goal

Make `/user` a concise list of configured provider connections. Forms must not remain in the page after an action.

## Interaction design

- The page shows the connection list and an **Agregar conexión** button.
- Clicking that button opens a modal with provider, name, model, API key, and save/cancel controls. Opening and closing it reset the create form.
- Existing per-connection actions remain visible: make default, activate/deactivate, probe, rotate, and remove.
- There is no **Editar** action. Provider metadata remains fixed after creation; replacing a secret is explicitly named **Rotar clave**.
- **Rotar clave** opens a modal that accepts only a new API key. The existing key is never returned to the browser or prefilled.
- Mutation success closes the matching modal, clears its sensitive input, and refreshes the list. A failure leaves the modal open so the user can correct the input or retry.

## Boundaries

This is a presentation/state refactor of `src/routes/(private)/user.tsx`. It reuses the existing tRPC mutations and server-side encryption contract; no schema, API, or key-handling behavior changes.

## Verification

- Typecheck/build/tests through `bash health.sh`.
- Confirm no static **Agregar conexión** form is left on the page and that the modal controls bind to the existing `create` and `rotate` mutations.
- Browser verification of an authenticated create/rotate flow remains separate from static health checks.
