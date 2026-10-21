/**
 * Error with an HTTP status. Routes throw it (`throw notFound('Movie not found')`) and
 * `errorHandler` turns it into an ErrorResponse, so no route builds error JSON by hand.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  /** What the user sees in `ErrorResponse.message`. */
  readonly userMessage: string | string[];
  readonly details?: unknown;

  constructor(statusCode: number, message: string | string[], details?: unknown) {
    super(Array.isArray(message) ? message.join('; ') : message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.userMessage = message;
    this.details = details;
  }
}

export const badRequest   = (message: string | string[], details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
export const forbidden    = (message = 'Forbidden') => new HttpError(403, message);
export const notFound     = (message = 'Not found') => new HttpError(404, message);
export const conflict     = (message: string) => new HttpError(409, message);
