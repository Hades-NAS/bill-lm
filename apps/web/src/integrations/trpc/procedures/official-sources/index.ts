import { prisma } from '#/integrations/prisma'

import { privateProcedure } from '../../init'

export const officialSourcesRouter = {
  list: privateProcedure.query(async () =>
    prisma.taxRuleSource.findMany({
      where: { reviewStatus: { in: ['reviewed', 'active'] } },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        issuer: true,
        officialUrl: true,
        jurisdiction: true,
        contentHash: true,
        reviewStatus: true,
        reviewedAt: true,
        fragments: {
          select: {
            id: true,
            articleOrSection: true,
            purposes: true,
            taxRegimes: true,
            effectiveFrom: true,
            effectiveTo: true,
            contentMarkdown: true,
            ruleSets: {
              select: {
                ruleSet: {
                  select: { id: true, version: true, reviewStatus: true },
                },
              },
            },
          },
        },
      },
    }),
  ),
}
