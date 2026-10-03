import {
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { useState } from 'react'
import { SourceFragment } from '@bill-lm/ui'

import { useTRPC } from '#/integrations/trpc/react'

const reviewStatusLabel: Record<string, string> = { active: 'Activa', draft: 'Borrador', archived: 'Archivada', pending_review: 'Pendiente de revisión' }
const displayReviewStatus = (value: string) => reviewStatusLabel[value] ?? 'Sin estado publicado'

export const Route = createFileRoute('/(private)/official-sources')({
  component: OfficialSourcesPage,
})

function OfficialSourcesPage() {
  const trpc = useTRPC()
  const sources = useQuery(trpc.officialSources.list.queryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (sources.isLoading)
    return (
      <Container py="xl">
        <Loader aria-label="Cargando fuentes oficiales" />
      </Container>
    )
  const selected =
    sources.data?.find((source) => source.id === selectedId) ?? null
  return (
    <Container py="xl" size="lg">
      <Stack gap="lg">
        <div>
          <Title order={1}>Fuentes oficiales</Title>
          <Text c="dimmed">
            Material publicado para rulesets. No incluye borradores ni PDFs de
            trabajo.
          </Text>
        </div>
        {sources.data?.length === 0 && (
          <Text c="dimmed">Aún no hay fuentes oficiales publicadas.</Text>
        )}
        {sources.data?.map((source) => (
          <Card withBorder key={source.id}>
            <Group align="flex-start" justify="space-between">
              <Stack gap={4}>
                <Text fw={700}>{source.title}</Text>
                <Text c="dimmed" size="sm">
                  {source.issuer} · {source.jurisdiction}
                </Text>
                <Badge
                  color={source.reviewStatus === 'active' ? 'green' : 'violet'}
                  w="fit-content"
                >
                  {displayReviewStatus(source.reviewStatus)}
                </Badge>
              </Stack>
              <Button
                leftSection={<BookOpen size={16} />}
                variant="light"
                onClick={() => setSelectedId(source.id)}
              >
                Ver secciones
              </Button>
            </Group>
          </Card>
        ))}
        <Drawer
          closeButtonProps={{ 'aria-label': 'Cerrar fuente oficial' }}
          opened={Boolean(selected)}
          position="right"
          scrollAreaComponent={ScrollArea.Autosize}
          size="lg"
          title={selected?.title}
          onClose={() => setSelectedId(null)}
        >
          <Stack>
            {selected && (
              <>
                <Text c="dimmed" size="sm">
                  {selected.issuer} · {selected.jurisdiction}
                </Text>
                <Anchor
                  href={selected.officialUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir fuente oficial
                </Anchor>
                <Text c="dimmed" size="xs">
                  Hash: {selected.contentHash}
                </Text>
                <Title order={3}>Secciones publicadas</Title>
                {selected.fragments.map((fragment) => <SourceFragment
                  content={fragment.contentMarkdown}
                  effectiveLabel={`${fragment.effectiveFrom.toLocaleDateString()}${fragment.effectiveTo ? ` — ${fragment.effectiveTo.toLocaleDateString()}` : ''}`}
                  key={fragment.id}
                  purposes={fragment.purposes}
                  rulesets={fragment.ruleSets.map((item) => `v${item.ruleSet.version} (${displayReviewStatus(item.ruleSet.reviewStatus)})`).join(', ') || 'Sin asignar'}
                  title={fragment.articleOrSection}
                />)}
              </>
            )}
          </Stack>
        </Drawer>
      </Stack>
    </Container>
  )
}
