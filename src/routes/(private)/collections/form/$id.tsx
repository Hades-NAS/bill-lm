import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(private)/collections/form/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(private)/collections/form/$id"!</div>
}
