export class GitDriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitDriveError";
  }
}

export function handleError(err: unknown): void {
  if (err instanceof GitDriveError) {
    console.error(`error: ${err.message}`);
  } else if (err instanceof Error) {
    const msg = err.message;
    // execSync errors include stderr in the message
    const stderrMatch = msg.match(/stderr:\s*([\s\S]*)/);
    if (stderrMatch) {
      console.error(`error: ${stderrMatch[1].trim()}`);
    } else {
      console.error(`error: ${msg}`);
    }
  } else {
    console.error("An unexpected error occurred.");
  }
}
