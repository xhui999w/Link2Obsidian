import type { AiEnhancer } from "./types.js";

export class DisabledAiEnhancer implements AiEnhancer {
  readonly enabled = false;

  async enhance(): Promise<undefined> {
    return undefined;
  }
}

