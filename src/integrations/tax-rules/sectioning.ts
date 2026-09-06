import { createHash } from 'node:crypto'

import type { DraftTaxRuleSection, ReviewedTaxRuleSection } from './contracts'

const PAGE_MARKER = /^<!-- page (\d+) of \d+ -->$/m
// Sources published by the SRI use both conventional headings ("Art. 10.- …")
// and a Lexis export layout where the article number appears after the title
// in a tab-separated column (".- …\tArt. 10").
const ARTICLE_HEADING =
  /^(?:(Art(?:ículo)?\.?\s*\d+[A-Za-z.-]*\s*(?:[-–—:.]|$).*)|(.+?)\tArt\.\s*(\d+(?:\.\d+)?[A-Za-z.-]*)\s*)$/im

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
    if (
      marker.index === undefined ||
      marker.index < start ||
      marker.index > end
    )
      continue
    pages.add(Number(marker[1]))
  }
  return [...pages].sort((left, right) => left - right)
}

function headingMatches(
  sourceKind: SplitSource['sourceKind'],
  markdown: string,
) {
  const matcher =
    sourceKind === 'law' || sourceKind === 'regulation' ? ARTICLE_HEADING : /$^/
  return [...markdown.matchAll(new RegExp(matcher, 'gim'))]
}

function articleHeading(match: RegExpMatchArray) {
  if (match[1]) return match[1].trim()

  const title = match[2]?.trim().replace(/^[-–—:.\s]+/, '')
  const article = match[3]?.trim()
  return title && article ? `Art. ${article}.- ${title}` : 'Sección sin título'
}

function ambiguousSection(
  source: SplitSource,
  markdown: string,
  reason: string,
): DraftTaxRuleSection {
  return {
    schemaVersion: '1',
    id: `${source.id}-unresolved-structure`,
    sourceId: source.id,
    articleOrSection: reason,
    sourcePages: [1],
    sourceStartOffset: 0,
    sourceEndOffset: markdown.length,
    sourceContentHash: source.contentHash,
    splitterVersion: '1',
    reviewStatus: 'ambiguous',
    markdown,
  }
}

export function splitTaxRuleSource(
  source: SplitSource,
  markdown: string,
): Array<DraftTaxRuleSection> {
  if (source.sourceKind === 'guide' || source.sourceKind === 'form_guide')
    return [
      ambiguousSection(
        source,
        markdown,
        'La guía requiere una estrategia de división específica',
      ),
    ]
  const matches = headingMatches(source.sourceKind, markdown)
  if (!matches.length)
    return [ambiguousSection(source, markdown, 'Estructura no identificada')]

  const sections = matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? markdown.length
    const articleOrSection = articleHeading(match)
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
  const seen = new Map<string, number>()
  return sections.map((section) => {
    const occurrence = (seen.get(section.id) ?? 0) + 1
    seen.set(section.id, occurrence)
    if (occurrence === 1) return section
    return {
      ...section,
      id: `${section.id}-part-${occurrence}`,
      reviewStatus: 'ambiguous' as const,
      articleOrSection: `${section.articleOrSection} (repetido; revisar límites)`,
    }
  })
}

const contentHash = (value: string) =>
  createHash('sha256').update(value.trim()).digest('hex')

export type TaxRuleSectionDiff = {
  added: Array<string>
  removed: Array<string>
  modified: Array<string>
  pageOnlyChanged: Array<string>
  unchanged: Array<string>
}

export function diffTaxRuleSections(
  drafts: Array<DraftTaxRuleSection>,
  reviewed: Array<ReviewedTaxRuleSection>,
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
