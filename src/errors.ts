// Typed error taxonomy for Problem 3.

export class SuccessionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigError extends SuccessionError {}

/** Two roles were given the same identity when they must be distinct (P3-T2/P3-T6). */
export class IdentityCollisionError extends ConfigError {}

/** The configured postage batch is not usable / lacks funds. */
export class BatchUnusableError extends SuccessionError {}

/** The root feed could not be resolved or is missing. */
export class RootUnresolvableError extends SuccessionError {}

/** A transfer was rejected because the incoming publisher equals the current one. */
export class NoOpTransferError extends SuccessionError {}

/** Storage extension could not be applied. */
export class StorageExtensionError extends SuccessionError {}