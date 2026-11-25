import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Converts a Zod schema to the JSON Schema Swagger expects, so response docs
 * come from the same schemas as the code (request bodies are converted by Nest).
 */
export function jsonSchema(schema: z.ZodType): ApiResponseSchemaHost['schema'] {
  return z.toJSONSchema(schema, {
    io: 'output',
    target: 'openapi-3.0',
  }) as ApiResponseSchemaHost['schema'];
}
