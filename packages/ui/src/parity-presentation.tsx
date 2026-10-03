import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import {
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  LoaderCircle,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked'

const statusMeta: Record<ExecutionStatus, { color: string; label: string; icon: ReactNode }> = {
  queued: { color: 'gray', label: 'Pendiente', icon: <Clock3 size={14} /> },
  running: { color: 'blue', label: 'En progreso', icon: <LoaderCircle size={14} /> },
  completed: { color: 'green', label: 'Completado', icon: <Check size={14} /> },
  failed: { color: 'red', label: 'Error', icon: <CircleAlert size={14} /> },
  blocked: { color: 'orange', label: 'Requiere atención', icon: <CircleAlert size={14} /> },
}

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const meta = statusMeta[status]
  return <Badge color={meta.color} leftSection={meta.icon} variant="light">{meta.label}</Badge>
}

export interface RunListItemProps {
  title: string
  status: ExecutionStatus
  detail?: string | null
  timestamp?: string | null
  runType?: string | null
  invoiceCount?: number | null
  provider?: string | null
  model?: string | null
  error?: string | null
  progress?: number | null
  unread?: boolean
  onOpen?: () => void
  onMarkRead?: () => void
}

export function RunListItem({ title, status, detail, timestamp, runType, invoiceCount, provider, model, error, progress, unread, onOpen, onMarkRead }: RunListItemProps) {
  return <Paper withBorder p="sm">
    <Group align="flex-start" justify="space-between" wrap="wrap">
      <Stack gap={4} miw={0}>
        <Text fw={unread ? 700 : 500} lineClamp={1} size="sm">{title}</Text>
        {runType && <Text c="dimmed" size="xs">{runType}</Text>}
        {detail && <Text c="dimmed" lineClamp={2} size="xs">{detail}</Text>}
        {invoiceCount !== null && invoiceCount !== undefined && <Text c="dimmed" size="xs">{invoiceCount} factura{invoiceCount === 1 ? '' : 's'}</Text>}
        {(provider || model) && <Text c="dimmed" lineClamp={1} size="xs">{[provider, model].filter(Boolean).join(' · ')}</Text>}
        {progress !== null && progress !== undefined && <Text c="dimmed" size="xs">Progreso: {Math.round(progress)}%</Text>}
        {error && <Text c={status === 'blocked' ? 'orange' : 'red'} lineClamp={2} size="xs">{status === 'blocked' ? 'Bloqueado: ' : 'Error: '}{error}</Text>}
        {timestamp && <Text c="dimmed" size="xs">{timestamp}</Text>}
      </Stack>
      <Group gap="xs" wrap="nowrap">
        <ExecutionStatusBadge status={status} />
        {onOpen && <Tooltip label={`Abrir ${title}`}><ActionIcon aria-label={`Abrir ${title}`} variant="subtle" onClick={onOpen}><ExternalLink size={16} /></ActionIcon></Tooltip>}
        {unread && onMarkRead && <Tooltip label={`Marcar ${title} como leído`}><ActionIcon aria-label={`Marcar ${title} como leído`} variant="subtle" onClick={onMarkRead}><Check size={16} /></ActionIcon></Tooltip>}
      </Group>
    </Group>
  </Paper>
}

export type ProbeStatus = 'idle' | 'pending' | 'success' | 'error'
export function ConnectionProbeStatus({ status, message }: { status: ProbeStatus; message?: string | null }) {
  const text = status === 'pending' ? 'Probando conexión…' : message ?? (status === 'success' ? 'Conexión validada' : status === 'error' ? 'No se pudo validar la conexión' : '')
  const icon = status === 'success' ? <Check size={14} /> : status === 'error' ? <CircleAlert size={14} /> : status === 'pending' ? <LoaderCircle size={14} /> : null
  return <Tooltip disabled={!text} label={text}><span><Group aria-label={text} c={status === 'error' ? 'red' : status === 'success' ? 'green' : 'dimmed'} justify="center" mih={24} miw={24} role="status"><VisuallyHidden aria-live="polite">{text}</VisuallyHidden>{icon}</Group></span></Tooltip>
}

export interface ConnectionRowProps {
  label: string; provider: string; model: string; hostMetadata?: string; isDefault: boolean; isActive?: boolean
  probeStatus: ProbeStatus; probeMessage?: string | null; probeDisabled?: boolean
  onProbe: () => void; actions?: ReactNode
}
export function ConnectionRow({ label, provider, model, hostMetadata, isDefault, isActive, probeStatus, probeMessage, probeDisabled, onProbe, actions }: ConnectionRowProps) {
  return <Paper withBorder p="sm"><Stack gap="xs"><Group justify="space-between" wrap="nowrap"><Stack gap={2} miw={0}><Group gap="xs"><Text fw={600} lineClamp={1}>{label}</Text>{isDefault && <Badge size="xs">Predeterminada</Badge>}</Group><Text c="dimmed" lineClamp={1} size="sm">{provider} · {model}</Text>{hostMetadata && <Text c="dimmed" lineClamp={1} size="xs">{hostMetadata}</Text>}</Stack>{isActive !== undefined && <Badge color={isActive ? 'green' : 'gray'}>{isActive ? 'Activa' : 'Inactiva'}</Badge>}</Group><Group align="center" justify="space-between" wrap="wrap"><Group gap="xs" miw={0} wrap="nowrap"><ConnectionProbeStatus message={probeMessage} status={probeStatus} /><Button aria-label={`Probar ${label}`} disabled={probeDisabled} leftSection={<FileText size={16} />} loading={probeStatus === 'pending'} size="compact-sm" variant="light" onClick={onProbe}>Probar</Button></Group>{actions}</Group></Stack></Paper>
}

export function RevisionRow({ title, revision, description, action }: { title: string; revision: number; description?: string | null; action?: ReactNode }) {
  return <Paper withBorder p="lg"><Group align="flex-start" justify="space-between"><Stack gap={4} miw={0}><Group gap="xs"><Text fw={700}>{title}</Text><Badge variant="light">Rev. {revision}</Badge></Group>{description && <Text c="dimmed" lineClamp={2} size="sm">{description}</Text>}</Stack>{action}</Group></Paper>
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <Group align="flex-start" justify="space-between"><Stack gap={2}><Title order={2}>{title}</Title>{description && <Text c="dimmed" size="sm">{description}</Text>}</Stack>{action}</Group>
}
export function SectionDivider() { return <Divider my="xs" /> }

export interface CollectionCardPresentationProps { name: string; year: number | string; invoiceCount: number; description?: string | null; onOpen: () => void; onArchive?: () => void; archiveDisabled?: boolean }
export function CollectionCardPresentation({ name, year, invoiceCount, description, onOpen, onArchive, archiveDisabled }: CollectionCardPresentationProps) {
  return <Card withBorder padding={0} radius="md" shadow="sm"><Stack gap={12}><Group justify="space-between" px="md" pt="md" wrap="nowrap"><Title order={3} size="h4">{name}</Title><Group gap="xs"><ActionIcon aria-label={`Abrir colección ${name}`} color="violet" variant="light" onClick={onOpen}><ExternalLink size={16} /></ActionIcon>{onArchive && <ActionIcon aria-label={`Archivar colección ${name}`} color="red" disabled={archiveDisabled} variant="light" onClick={onArchive}><Trash2 size={16} /></ActionIcon>}</Group></Group><Divider /><Stack gap={4} px="md" pb="md">{description && <Text c="dimmed" lineClamp={2} size="sm">{description}</Text>}<Text c="dimmed" size="sm">{year}</Text><Text c="dimmed" size="sm">{invoiceCount ? `${invoiceCount} factura${invoiceCount === 1 ? '' : 's'}` : 'Sin facturas'}</Text></Stack></Stack></Card>
}

export function SourceFragment({ title, effectiveLabel, purposes, content, rulesets }: { title: string; effectiveLabel?: string; purposes: string[]; content: string; rulesets?: string }) {
  return <Card withBorder><Stack gap="xs"><Text fw={600}>{title}</Text>{effectiveLabel && <Text c="dimmed" size="xs">{effectiveLabel}</Text>}<Group gap="xs">{purposes.map((purpose) => <Badge key={purpose} variant="light">{purpose}</Badge>)}</Group><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{formatSafeSourceText(content)}</Text>{rulesets && <Text c="dimmed" size="xs">Rulesets: {rulesets}</Text>}</Stack></Card>
}

/** Safe text-only formatting for source snapshots. It deliberately does not parse or render HTML. */
export function formatSafeSourceText(value: string) { return value.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim() }

export interface InvoiceDetailsData {
  fileName: string; typeLabel: string; issueDate?: string | null; importedAt?: string | null; buyer: { name: string; identifierLabel: string; identifier: string }; seller: { name: string; identifier: string; tradeName?: string | null; address?: string | null }; totals: { subtotal: number | null; discount?: number | null; taxes: number | null; total: number | null; currency?: string | null }; taxes?: Array<{ id: string; code?: string | null; rate?: string | null; taxableBase?: number | null; amount?: number | null }>; items: Array<{ id: string; description: string; unitPrice: number | null; quantity: number | null; discount?: number | null; total?: number | null }>
}
function displayMoney(value: number | null, currency?: string | null) {
  if (value === null || !currency) return 'No disponible'
  const normalizedCurrency = ({ DOLAR: 'USD', DOLARES: 'USD', EURO: 'EUR' } as Record<string, string>)[currency.toUpperCase()] ?? currency
  try {
    const formatted = new Intl.NumberFormat('es-EC', { style: 'currency', currency: normalizedCurrency }).format(value)
    return normalizedCurrency === 'EUR' ? formatted.replace('EUR', '€') : formatted
  } catch { return `${value} ${currency}` }
}
export function InvoiceDetails({ invoice, analysis }: { invoice: InvoiceDetailsData; analysis: ReactNode }) {
  const hasDiscount = invoice.totals.discount !== null && invoice.totals.discount !== undefined
  return <Stack gap="sm"><Group justify="space-between"><Stack gap={2}><Text fw={600}>{invoice.fileName}</Text>{invoice.issueDate && <Text c="dimmed" size="xs">Fecha de emisión: {invoice.issueDate}</Text>}{invoice.importedAt && <Text c="dimmed" size="xs">Fecha de importación: {invoice.importedAt}</Text>}</Stack><Badge>{invoice.typeLabel}</Badge></Group><SimpleGrid cols={{ base: 1, sm: 2 }}><Paper withBorder p="sm"><Text fw={600} size="sm">Comprador</Text><Text size="sm">{invoice.buyer.name}</Text><Text c="dimmed" size="xs">{invoice.buyer.identifierLabel}: {invoice.buyer.identifier}</Text></Paper><Paper withBorder p="sm"><Text fw={600} size="sm">Emisor</Text><Text size="sm">{invoice.seller.name}</Text><Text c="dimmed" size="xs">RUC: {invoice.seller.identifier}</Text>{invoice.seller.tradeName && <Text c="dimmed" size="xs">{invoice.seller.tradeName}</Text>}{invoice.seller.address && <Text c="dimmed" size="xs">{invoice.seller.address}</Text>}</Paper></SimpleGrid><Table.ScrollContainer minWidth={400}><Table><Table.Thead><Table.Tr><Table.Th>Subtotal</Table.Th>{hasDiscount && <Table.Th>Descuento</Table.Th>}<Table.Th>Impuestos</Table.Th><Table.Th>Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody><Table.Tr><Table.Td>{displayMoney(invoice.totals.subtotal, invoice.totals.currency)}</Table.Td>{hasDiscount && <Table.Td>{displayMoney(invoice.totals.discount ?? null, invoice.totals.currency)}</Table.Td>}<Table.Td>{displayMoney(invoice.totals.taxes, invoice.totals.currency)}</Table.Td><Table.Td>{displayMoney(invoice.totals.total, invoice.totals.currency)}</Table.Td></Table.Tr></Table.Tbody></Table></Table.ScrollContainer>{invoice.taxes && invoice.taxes.length > 0 && <Table.ScrollContainer minWidth={460}><Table><Table.Thead><Table.Tr><Table.Th>Impuesto</Table.Th><Table.Th>Base imponible</Table.Th><Table.Th>Valor</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{invoice.taxes.map((tax) => <Table.Tr key={tax.id}><Table.Td>{[tax.code, tax.rate].filter(Boolean).join(' · ') || 'No disponible'}</Table.Td><Table.Td>{displayMoney(tax.taxableBase ?? null, invoice.totals.currency)}</Table.Td><Table.Td>{displayMoney(tax.amount ?? null, invoice.totals.currency)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}<Tabs defaultValue="analysis"><Tabs.List><Tabs.Tab value="analysis">Análisis</Tabs.Tab><Tabs.Tab value="details">Datos</Tabs.Tab></Tabs.List><Tabs.Panel pt="md" value="analysis">{analysis}</Tabs.Panel><Tabs.Panel pt="md" value="details"><Table.ScrollContainer minWidth={560}><Table><Table.Thead><Table.Tr><Table.Th>Nombre</Table.Th><Table.Th>Precio unitario</Table.Th><Table.Th>Cantidad</Table.Th>{invoice.items.some((item) => item.discount !== null && item.discount !== undefined) && <Table.Th>Descuento</Table.Th>}{invoice.items.some((item) => item.total !== null && item.total !== undefined) && <Table.Th>Total</Table.Th>}</Table.Tr></Table.Thead><Table.Tbody>{invoice.items.map((item) => <Table.Tr key={item.id}><Table.Td>{item.description}</Table.Td><Table.Td>{displayMoney(item.unitPrice, invoice.totals.currency)}</Table.Td><Table.Td>{item.quantity ?? 'No disponible'}</Table.Td>{invoice.items.some((candidate) => candidate.discount !== null && candidate.discount !== undefined) && <Table.Td>{displayMoney(item.discount ?? null, invoice.totals.currency)}</Table.Td>}{invoice.items.some((candidate) => candidate.total !== null && candidate.total !== undefined) && <Table.Td>{displayMoney(item.total ?? null, invoice.totals.currency)}</Table.Td>}</Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Tabs.Panel></Tabs></Stack>
}
