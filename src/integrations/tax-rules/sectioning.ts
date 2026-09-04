import { createHash } from 'node:crypto'

import type {
  DraftTaxRuleSection,
  ReviewedTaxRuleSection,
} from './contracts'

const PAGE_MARKER = /^<!-- page (\d+) of \d+ -->$/m
const ARTICLE_HEADING = /^(Art(?:ículo)?\.?\s*\d+[A-Za-z.-]*\s*(?:[-–—:.]|$).*)$/im
const GUIDE_HEADING = /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9 ,;:()\-/]{7,})$/m

type SplitSource = {
  id: string
  sourceKind: 'law' | 'regulation' | 'guide' | 'form_guide'
  contentHash: string
}

function slugify(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/art(?:iculo)?\.?\s*/g, 'art-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.slice(0, 80) || 'seccion'
}

function pageAt(markdown: string, offset: number) {
  let page = 1
  for (const marker of markdown.matchAll(new RegExp(PAGE_MARKER, 'gm'))) {
    if (marker.index === undefined || marker.index >= offset) break
    page = Number(marker[1])
  }
  return page
}

function pageRange(markdown: string, start: number, end: number) {
  const pages = new Set<number>()
  pages.add(pageAt(markdown, start))
  for (const marker of markdown.matchAll(new RegExp(PAGE_MARKER, 'gm'))) {
    if (marker.index === undefined || marker.index < start || marker.index > end) continue
    pages.add(Number(marker[1]))
  }
  return [...pages].sort((left, right) => left - right)
}

function headingMatches(sourceKind: SplitSource['sourceKind'], markdown: string) {
  const matcher = sourceKind === 'law' || sourceKind === 'regulation'
    ? ARTICLE_HEADING
    : GUIDE_HEADING
  return [...markdown.matchAll(new RegExp(matcher, 'gim'))]
}

export function splitTaxRuleSource(source: SplitSource, markdown: string): DraftTaxRuleSection[] {
  const matches = headingMatches(source.sourceKind, markdown)
  if (!matches.length) {
    return [{
      schemaVersion: '1',
      id: `${source.id}-unresolved-structure`,
      sourceId: source.id,
      articleOrSection: 'Estructura no identificada',
      sourcePages: [1],
      sourceStartOffset: 0,
      sourceEndOffset: markdown.length,
      sourceContentHash: source.contentHash,
      splitterVersion: '1',
      reviewStatus: 'ambiguous',
      markdown,
    }]
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? markdown.length
    const articleOrSection = match[1]?.trim() ?? 'Sección sin título'
    return {
      schemaVersion: '1' as const,
      id: `${source.id}-${slugify(articleOrSection)}`,
      sourceId: source.id,
      articleOrSection,
      sourcePages: pageRange(markdown, start, end),
      sourceStartOffset: start,
      sourceEndOffset: end,
      sourceContentHash: source.contentHash,
      splitterVersion: '1' as const,
      reviewStatus: 'draft' as const,
      markdown: markdown.slice(start, end).trim(),
    }
  })
}

const contentHash = (value: string) =>
  createHash('sha256').update(value.trim()).digest('hex')

export type TaxRuleSectionDiff = {
  added: string[]
  removed: string[]
  modified: string[]
  pageOnlyChanged: string[]
  unchanged: string[]
}

export function diffTaxRuleSections(
  drafts: DraftTaxRuleSection[],
  reviewed: ReviewedTaxRuleSection[],
): TaxRuleSectionDiff {
  const reviewedById = new Map(reviewed.map((section) => [section.id, section]))
  const draftIds = new Set(drafts.map((section) => section.id))
  const diff: TaxRuleSectionDiff = {
    added: [],
    removed: [],
    modified: [],
    pageOnlyChanged: [],
    unchanged: [],
  }

  for (const draft of drafts) {
    const current = reviewedById.get(draft.id)
    if (!current) {
      diff.added.push(draft.id)
      continue
    }
    if (contentHash(draft.markdown) !== contentHash(current.markdown)) {
      diff.modified.push(draft.id)
      continue
    }
    if (draft.sourcePages.join(',') !== current.sourcePages.join(',')) {
      diff.pageOnlyChanged.push(draft.id)
      continue
    }
    diff.unchanged.push(draft.id)
  }

  for (const section of reviewed) {
    if (!draftIds.has(section.id)) diff.removed.push(section.id)
  }
  return diff
}
