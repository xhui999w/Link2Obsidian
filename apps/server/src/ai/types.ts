export interface AiEnhancement {
  summary: string;
  keywords: string[];
  category?: string;
  tags: string[];
}

export interface AiEnhancer {
  readonly enabled: boolean;
  enhance(input: {
    title: string;
    source: string;
    text: string;
    suggestedCategory: string;
    suggestedTags: string[];
    allowedCategories: readonly string[];
  }): Promise<AiEnhancement | undefined>;
}

export interface AiChatProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

