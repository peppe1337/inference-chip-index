import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { identity } from '@lucid-agents/identity';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';
import {
  DATASET_MANIFEST,
  SLICES,
  ROWS,
  ACCELERATORS,
  getSlice,
  rowsForSlice,
  rankSlice,
} from '../data/dataset';

export type PaymentsConfig = ReturnType<typeof paymentsFromEnv>;

// ── Shared Zod schemas ──────────────────────────────────────────────────────

const SourceRefSchema = z.object({
  repository: z.string(),
  commit: z.string(),
  path: z.string(),
  url: z.string(),
  sha256: z.string(),
});

const PreviewRowSchema = z.object({
  acceleratorSlug: z.string(),
  acceleratorName: z.string(),
  vendor: z.string(),
  submitter: z.string(),
  systemId: z.string(),
  value: z.number(),
  unit: z.string(),
  acceleratorCount: z.number().nullable(),
  logSource: SourceRefSchema,
});

const RankedEntrySchema = z.object({
  rank: z.number(),
  acceleratorSlug: z.string(),
  acceleratorName: z.string(),
  vendor: z.string(),
  submitter: z.string(),
  systemId: z.string(),
  value: z.number(),
  unit: z.string(),
  acceleratorCount: z.number().nullable(),
  derivedPerAccelerator: z.number().nullable(),
  scenarioMismatch: z.boolean(),
  logSource: SourceRefSchema,
});

const SliceMetaSchema = z.object({
  sliceId: z.string(),
  workload: z.string(),
  scenario: z.string(),
  metricId: z.string(),
  unit: z.string(),
  direction: z.literal('higher-is-better'),
  resultCount: z.number(),
  vendorCount: z.number(),
  familyCount: z.number(),
  comparable: z.boolean(),
});

const GroupBestEntrySchema = z.object({
  group: z.string(),
  rank: z.number(),
  acceleratorSlug: z.string(),
  acceleratorName: z.string(),
  vendor: z.string(),
  submitter: z.string(),
  systemId: z.string(),
  value: z.number(),
  unit: z.string(),
  acceleratorCount: z.number().nullable(),
  derivedPerAccelerator: z.number().nullable(),
});

/**
 * Creates the inference-chips agent runtime.
 *
 * This is the single source of truth for all entrypoint definitions.
 * Tests call this factory directly so they always exercise the real code.
 *
 * @param opts.paymentsConfig - x402 payment configuration. When omitted the
 *   runtime boots without a payment rail and paid entrypoints fail closed.
 */
export async function createInferenceChipsRuntime(opts?: {
  paymentsConfig?: PaymentsConfig;
}) {
  const paymentsConfig = opts?.paymentsConfig ?? paymentsFromEnv();

  const runtime = await createAgent({
    name: 'inference-chips-agent',
    version: '1.0.0',
    description: 'Benchmark and comparison data for AI inference accelerators.',
  })
    .use(payments({ config: paymentsConfig }))
    .use(
      identity({
        config: {
          registration: {
            oasf: {
              authors: [],
              skills: [],
              domains: ['ai-inference', 'benchmarks'],
              modules: [],
              locators: [],
            },
          },
        },
      })
    )
    .use(http({ basePath: '/api/agent', servicePage: false }))
    // 1. get-dataset-status — FREE
    .addEntrypoint({
      key: 'get-dataset-status',
      description:
        'Returns manifest, freshness, source commit, counts, source links, and all available exact comparison slice IDs.',
      output: z.object({
        manifest: z.object({
          name: z.string(),
          description: z.string(),
          schemaVersion: z.string(),
          release: z.string(),
          division: z.string(),
          sourceRepository: z.string(),
          sourceCommit: z.string(),
          recordsHash: z.string(),
          counts: z.object({
            resultsTotal: z.number(),
            resultsReleased: z.number(),
            resultsQuarantined: z.number(),
            scenarioMismatches: z.number(),
            rows: z.number(),
            accelerators: z.number(),
            slices: z.number(),
            comparableSlices: z.number(),
          }),
        }),
        slices: z.array(SliceMetaSchema),
      }),
      handler: async () => ({
        output: {
          manifest: DATASET_MANIFEST,
          slices: SLICES.map((s) => ({
            sliceId: s.sliceId,
            workload: s.workload,
            scenario: s.scenario,
            metricId: s.metricId,
            unit: s.unit,
            direction: s.direction,
            resultCount: s.resultCount,
            vendorCount: s.vendorCount,
            familyCount: s.familyCount,
            comparable: s.comparable,
          })),
        },
      }),
    })
    // 2. preview-inference-chips — FREE
    .addEntrypoint({
      key: 'preview-inference-chips',
      description:
        'Returns up to five rows from real MLPerf v6.0 data. Optionally filtered by slice ID.',
      input: z.object({ sliceId: z.string().optional() }),
      output: z.object({
        rows: z.array(PreviewRowSchema),
        reason: z.string().optional(),
      }),
      handler: async ({ input }) => {
        if (input.sliceId !== undefined) {
          const slice = getSlice(input.sliceId);
          if (!slice) {
            return {
              output: {
                rows: [],
                reason: `Unknown slice ID "${input.sliceId}". Call get-dataset-status to list available slices.`,
              },
            };
          }
          const rows = rowsForSlice(input.sliceId).slice(0, 5);
          return {
            output: {
              rows: rows.map((r) => ({
                acceleratorSlug: r.acceleratorSlug,
                acceleratorName: r.acceleratorName,
                vendor: r.vendor,
                submitter: r.submitter,
                systemId: r.systemId,
                value: r.value,
                unit: r.unit,
                acceleratorCount: r.acceleratorCount,
                logSource: r.logSource,
              })),
            },
          };
        }
        // No slice filter — return first 5 rows from the full dataset
        const rows = ROWS.slice(0, 5);
        return {
          output: {
            rows: rows.map((r) => ({
              acceleratorSlug: r.acceleratorSlug,
              acceleratorName: r.acceleratorName,
              vendor: r.vendor,
              submitter: r.submitter,
              systemId: r.systemId,
              value: r.value,
              unit: r.unit,
              acceleratorCount: r.acceleratorCount,
              logSource: r.logSource,
            })),
          },
        };
      },
    })
    // 3. rank-inference-chips — PAID $0.02
    .addEntrypoint({
      key: 'rank-inference-chips',
      description:
        'Returns ranked accelerator results for an exact slice ID. Supports vendor filter, official/derived views, and pagination.',
      price: '0.02',
      input: z.object({
        sliceId: z.string().min(1),
        vendors: z.array(z.string()).optional(),
        view: z.enum(['official', 'derived']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        groupBy: z.enum(['vendor', 'family']).optional(),
      }),
      output: z.object({
        sliceId: z.string(),
        slice: SliceMetaSchema.optional(),
        totalCount: z.number(),
        limit: z.number(),
        offset: z.number(),
        ranked: z.array(RankedEntrySchema),
        groupBest: z.array(GroupBestEntrySchema).optional(),
        error: z.string().optional(),
      }),
      handler: async ({ input }) => {
        const slice = getSlice(input.sliceId);
        if (!slice) {
          return {
            output: {
              sliceId: input.sliceId,
              totalCount: 0,
              limit: input.limit ?? 20,
              offset: input.offset ?? 0,
              ranked: [],
              error: `Unknown slice ID "${input.sliceId}". Call get-dataset-status to list available slices.`,
            },
          };
        }

        const limit = input.limit ?? 20;
        const offset = input.offset ?? 0;

        if (limit > 100) {
          return {
            output: {
              sliceId: input.sliceId,
              totalCount: 0,
              limit,
              offset,
              ranked: [],
              error: `limit must not exceed 100 (got ${limit}).`,
            },
          };
        }

        const allRanked = rankSlice(input.sliceId, {
          vendors: input.vendors,
          view: input.view,
        });

        const page = allRanked.slice(offset, offset + limit);

        const ranked = page.map((r) => ({
          rank: r.rank,
          acceleratorSlug: r.acceleratorSlug,
          acceleratorName: r.acceleratorName,
          vendor: r.vendor,
          submitter: r.submitter,
          systemId: r.systemId,
          value: r.value,
          unit: r.unit,
          acceleratorCount: r.acceleratorCount,
          derivedPerAccelerator: r.derivedPerAccelerator,
          scenarioMismatch: r.scenarioMismatch,
          logSource: r.logSource,
        }));

        const sliceMeta = {
          sliceId: slice.sliceId,
          workload: slice.workload,
          scenario: slice.scenario,
          metricId: slice.metricId,
          unit: slice.unit,
          direction: slice.direction,
          resultCount: slice.resultCount,
          vendorCount: slice.vendorCount,
          familyCount: slice.familyCount,
          comparable: slice.comparable,
        };

        // groupBy support
        let groupBest: z.infer<typeof GroupBestEntrySchema>[] | undefined;
        if (input.groupBy) {
          const field = input.groupBy === 'vendor' ? 'vendor' : 'family';
          const seen = new Map<string, z.infer<typeof GroupBestEntrySchema>>();
          // allRanked is already sorted best-first
          for (const r of allRanked) {
            const key = r[field];
            if (!seen.has(key)) {
              seen.set(key, {
                group: key,
                rank: r.rank,
                acceleratorSlug: r.acceleratorSlug,
                acceleratorName: r.acceleratorName,
                vendor: r.vendor,
                submitter: r.submitter,
                systemId: r.systemId,
                value: r.value,
                unit: r.unit,
                acceleratorCount: r.acceleratorCount,
                derivedPerAccelerator: r.derivedPerAccelerator,
              });
            }
          }
          groupBest = [...seen.values()];
        }

        return {
          output: {
            sliceId: input.sliceId,
            slice: sliceMeta,
            totalCount: allRanked.length,
            limit,
            offset,
            ranked,
            ...(groupBest !== undefined ? { groupBest } : {}),
          },
        };
      },
    })
    // 4. compare-inference-chips — PAID $0.03
    .addEntrypoint({
      key: 'compare-inference-chips',
      description:
        'Compares 2–8 accelerator slugs within an exact slice ID. Returns found rows, missing evidence, and optional deltas.',
      price: '0.03',
      input: z.object({
        sliceId: z.string().min(1),
        acceleratorSlugs: z.array(z.string().min(1)).min(2).max(8),
        baselineSlug: z.string().optional(),
      }),
      output: z.object({
        sliceId: z.string(),
        slice: SliceMetaSchema.optional(),
        rows: z.array(
          z.object({
            acceleratorSlug: z.string(),
            acceleratorName: z.string(),
            vendor: z.string(),
            submitter: z.string(),
            systemId: z.string(),
            value: z.number(),
            unit: z.string(),
            acceleratorCount: z.number().nullable(),
            derivedPerAccelerator: z.number().nullable(),
            scenarioMismatch: z.boolean(),
            logSource: SourceRefSchema,
          })
        ),
        missingEvidence: z.array(
          z.object({
            acceleratorSlug: z.string(),
            reason: z.string(),
          })
        ),
        deltas: z
          .array(
            z.object({
              acceleratorSlug: z.string(),
              baselineSlug: z.string(),
              deltaAbsolute: z.number().nullable(),
              deltaPercent: z.number().nullable(),
              unit: z.string(),
            })
          )
          .nullable(),
        deltaReason: z.string().optional(),
        error: z.string().optional(),
      }),
      handler: async ({ input }) => {
        const slice = getSlice(input.sliceId);
        if (!slice) {
          return {
            output: {
              sliceId: input.sliceId,
              rows: [],
              missingEvidence: input.acceleratorSlugs.map((slug) => ({
                acceleratorSlug: slug,
                reason: `Unknown slice ID "${input.sliceId}". Call get-dataset-status to list available slices.`,
              })),
              deltas: null,
              deltaReason: `Unknown slice ID "${input.sliceId}".`,
              error: `Unknown slice ID "${input.sliceId}". Call get-dataset-status to list available slices.`,
            },
          };
        }

        const sliceRows = rowsForSlice(input.sliceId);
        const requestedSlugs = new Set(input.acceleratorSlugs);

        // Find best row per requested slug (highest value)
        const foundBySlugs = new Map<string, (typeof sliceRows)[0]>();
        for (const row of sliceRows) {
          if (!requestedSlugs.has(row.acceleratorSlug)) continue;
          const existing = foundBySlugs.get(row.acceleratorSlug);
          if (!existing || row.value > existing.value) {
            foundBySlugs.set(row.acceleratorSlug, row);
          }
        }

        const missingEvidence: Array<{ acceleratorSlug: string; reason: string }> = [];
        for (const slug of input.acceleratorSlugs) {
          if (!foundBySlugs.has(slug)) {
            missingEvidence.push({
              acceleratorSlug: slug,
              reason: `No valid v6.0 closed-division result for "${slug}" in slice "${input.sliceId}".`,
            });
          }
        }

        const rows = [...foundBySlugs.values()].map((r) => ({
          acceleratorSlug: r.acceleratorSlug,
          acceleratorName: r.acceleratorName,
          vendor: r.vendor,
          submitter: r.submitter,
          systemId: r.systemId,
          value: r.value,
          unit: r.unit,
          acceleratorCount: r.acceleratorCount,
          derivedPerAccelerator: r.derivedPerAccelerator,
          scenarioMismatch: r.scenarioMismatch,
          logSource: r.logSource,
        }));

        const sliceMeta = {
          sliceId: slice.sliceId,
          workload: slice.workload,
          scenario: slice.scenario,
          metricId: slice.metricId,
          unit: slice.unit,
          direction: slice.direction,
          resultCount: slice.resultCount,
          vendorCount: slice.vendorCount,
          familyCount: slice.familyCount,
          comparable: slice.comparable,
        };

        // Deltas — only when baselineSlug is provided, exists, and units match
        let deltas: Array<{
          acceleratorSlug: string;
          baselineSlug: string;
          deltaAbsolute: number | null;
          deltaPercent: number | null;
          unit: string;
        }> | null = null;
        let deltaReason: string | undefined;

        if (input.baselineSlug !== undefined) {
          const baselineRow = foundBySlugs.get(input.baselineSlug);
          if (!baselineRow) {
            deltas = null;
            deltaReason = `Baseline slug "${input.baselineSlug}" has no result in slice "${input.sliceId}" — deltas cannot be computed.`;
          } else {
            deltas = [];
            for (const [slug, row] of foundBySlugs) {
              if (slug === input.baselineSlug) continue;
              if (row.unit !== baselineRow.unit || row.sliceId !== baselineRow.sliceId) {
                deltas.push({
                  acceleratorSlug: slug,
                  baselineSlug: input.baselineSlug,
                  deltaAbsolute: null,
                  deltaPercent: null,
                  unit: baselineRow.unit,
                });
              } else {
                const deltaAbsolute = row.value - baselineRow.value;
                const deltaPercent =
                  baselineRow.value !== 0
                    ? (deltaAbsolute / baselineRow.value) * 100
                    : null;
                deltas.push({
                  acceleratorSlug: slug,
                  baselineSlug: input.baselineSlug,
                  deltaAbsolute,
                  deltaPercent,
                  unit: row.unit,
                });
              }
            }
          }
        } else {
          deltaReason =
            'No baselineSlug supplied — deltas are not available. Provide a baselineSlug that exists in this slice to enable deltas.';
        }

        return {
          output: {
            sliceId: input.sliceId,
            slice: sliceMeta,
            rows,
            missingEvidence,
            deltas,
            ...(deltaReason !== undefined ? { deltaReason } : {}),
          },
        };
      },
    })
    .build();

  return runtime;
}

// Singleton for the Next.js route — built once per process, not per request.
export const runtimePromise = createInferenceChipsRuntime();

// Expose accelerator list for tests.
export { ACCELERATORS };
