/**
 * Upsert ESTV-shaped tax seeds + normalized brackets from app/db/seeds/tax_rates.json.
 * Run from repository root: npm run db:seed-tax
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { z } from "zod";

import db from "../core/db/drizzle-client.server";
import {
  tax_rate_brackets,
  tax_rate_seeds,
} from "../features/tax/seeds_schema";

const bracketSchema = z.object({
  lowerBoundRappen: z.string().regex(/^\d+$/),
  upperBoundRappen: z.string().regex(/^\d+$/).nullable(),
  marginalRateBps: z.number().int().nonnegative(),
});

const seedEntrySchema = z.object({
  taxYear: z.number().int(),
  canton: z.string().length(2),
  municipalityId: z.string().nullable(),
  payload: z.unknown(),
  brackets: z.array(bracketSchema).min(1),
});

const documentSchema = z.object({
  meta: z
    .object({
      source: z.string().optional(),
      schemaVersion: z.number().optional(),
      note: z.string().optional(),
    })
    .optional(),
  seeds: z.array(seedEntrySchema).min(1),
});

function loadDocument(): z.infer<typeof documentSchema> {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, "seeds", "tax_rates.json"), "utf-8");
  const json: unknown = JSON.parse(raw);
  return documentSchema.parse(json);
}

async function main() {
  const doc = loadDocument();
  for (const seed of doc.seeds) {
    const municipalityId = seed.municipalityId ?? "";
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tax_rate_seeds)
        .values({
          tax_year: seed.taxYear,
          canton: seed.canton.toUpperCase(),
          municipality_id: municipalityId,
          payload: seed.payload,
        })
        .onConflictDoUpdate({
          target: [
            tax_rate_seeds.tax_year,
            tax_rate_seeds.canton,
            tax_rate_seeds.municipality_id,
          ],
          set: {
            payload: seed.payload,
            updated_at: new Date(),
          },
        })
        .returning({ id: tax_rate_seeds.id });

      if (!row) {
        throw new Error("Upsert tax_rate_seeds returned no row");
      }

      await tx
        .delete(tax_rate_brackets)
        .where(eq(tax_rate_brackets.seed_id, row.id));

      if (seed.brackets.length > 0) {
        await tx.insert(tax_rate_brackets).values(
          seed.brackets.map((b) => ({
            seed_id: row.id,
            lower_bound: BigInt(b.lowerBoundRappen),
            upper_bound:
              b.upperBoundRappen === null ? null : BigInt(b.upperBoundRappen),
            marginal_rate_bps: b.marginalRateBps,
          })),
        );
      }
    });
    console.info(
      `Seeded ${seed.canton} ${seed.taxYear} muni='${municipalityId}' (${seed.brackets.length} brackets)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
