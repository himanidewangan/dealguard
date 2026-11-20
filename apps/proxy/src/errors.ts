/** Typed error the extension can show. `message` is safe to display and never contains user text. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorBody = (e: ApiError) => ({ error: { code: e.code, message: e.message } });
