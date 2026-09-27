export class DomainError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.details = details;
  }
}
