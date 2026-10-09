// When a server function fails (V2-13, #23): the owner can't read Vercel's logs from the app, so a
// failure answers with a plain 500 whose X-PipHall-Stage header names the step that broke (fonts,
// layout, png, data), and logs the error for Vercel's function log. Never the details in the body.

export type Stage = 'fonts' | 'layout' | 'png' | 'data';

export class StageError extends Error {
  constructor(
    readonly stage: Stage,
    cause: unknown,
  ) {
    super(`${stage}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = 'StageError';
  }
}

/** Runs `step`, tagging anything it throws with its stage. */
export async function inStage<T>(stage: Stage, step: () => T | Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (e) {
    throw e instanceof StageError ? e : new StageError(stage, e);
  }
}

export function guard(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (e) {
      const stage = e instanceof StageError ? e.stage : 'unknown';
      console.error(`[pip-hall] ${new URL(request.url).pathname} failed at ${stage}:`, e);
      return new Response('This could not be made right now.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-PipHall-Stage': stage },
      });
    }
  };
}
