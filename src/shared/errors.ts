// Typed error hierarchy for structured error handling across tool handlers

interface ErrorMetadata {
  toolName: string;
  operation: string;
  correlationId: string;
}

export class ToolError extends Error {
  public readonly metadata: ErrorMetadata;

  constructor(message: string, metadata: ErrorMetadata) {
    super(message);
    this.name = 'ToolError';
    this.metadata = metadata;
  }
}

export class ExternalServiceError extends ToolError {
  public readonly statusCode: number | undefined;

  constructor(message: string, metadata: ErrorMetadata, statusCode?: number) {
    super(message, metadata);
    this.name = 'ExternalServiceError';
    this.statusCode = statusCode;
  }
}

export class ValidationError extends ToolError {
  public readonly issues: string[];

  constructor(message: string, metadata: ErrorMetadata, issues: string[]) {
    super(message, metadata);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class ConfigurationError extends ToolError {
  constructor(message: string, metadata: ErrorMetadata) {
    super(message, metadata);
    this.name = 'ConfigurationError';
  }
}
