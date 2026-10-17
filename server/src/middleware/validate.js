import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and coerces request input with zod schemas.
 * Usage: validate({ body: schema, query: schema, params: schema })
 * Parsed (clean, typed, stripped of unknown keys) values replace the originals.
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = [];
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ field: issue.path.join('.') || part, message: issue.message });
      }
    } else if (part === 'query') {
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true, enumerable: true });
    } else {
      req[part] = result.data;
    }
  }
  if (errors.length) {
    return next(ApiError.badRequest('Please check the highlighted fields.', errors, 'VALIDATION_ERROR'));
  }
  next();
};
