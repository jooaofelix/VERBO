import type { ZodType } from "zod";

export class SchemaRepairError extends Error {
  constructor(message: string, public readonly lastErrors: string) {
    super(message);
    this.name = "SchemaRepairError";
  }
}

/**
 * Validates `raw` against `schema`. If it fails, calls `repair` with the raw
 * payload and a human-readable list of validation errors, hoping to get a
 * corrected payload back, and retries up to `maxAttempts` times total.
 * Never returns unvalidated data — either a schema-valid object comes back,
 * or a SchemaRepairError is thrown so the caller can show a simple message
 * instead of rendering a broken/partial UI.
 */
export async function parseWithRepair<T>(
  schema: ZodType<T, any, any>,
  raw: unknown,
  repair: (raw: unknown, errors: string) => Promise<unknown>,
  maxAttempts = 2
): Promise<T> {
  let current = raw;
  let lastErrors = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = schema.safeParse(current);
    if (result.success) {
      return result.data;
    }
    lastErrors = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("; ");

    if (attempt < maxAttempts - 1) {
      current = await repair(current, lastErrors);
    }
  }

  throw new SchemaRepairError(
    "A resposta da IA não pôde ser validada mesmo após tentativa de correção.",
    lastErrors
  );
}
