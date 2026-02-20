export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<Record<string, unknown>>;
  tool_call_id?: string;
};

export type OpenRouterTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterToolCall = {
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: OpenRouterToolCall[];
    };
  }>;
};

type LlmProvider = 'openrouter' | 'glm';

function getProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === 'glm' || explicit === 'zai') return 'glm';
  if (explicit === 'openrouter') return 'openrouter';
  if (process.env.GLM_API_KEY && !process.env.OPENROUTER_API_KEY) return 'glm';
  return 'openrouter';
}

function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Missing OPENROUTER_API_KEY');
  return key;
}

function getGlmKey(): string {
  const key = process.env.GLM_API_KEY;
  if (!key) throw new Error('Missing GLM_API_KEY');
  return key;
}

function getGlmBaseUrl(): string {
  return process.env.GLM_BASE_URL || 'https://api.z.ai/api/coding/paas/v4/chat/completions';
}

function getGlmModel(): string {
  return process.env.GLM_MODEL || 'glm-5';
}

export function getFreeModel(envVar: string | undefined, fallback: string): string {
  const model = envVar || fallback;
  if (getProvider() !== 'openrouter') return model;
  if (model !== 'openrouter/free' && !model.endsWith(':free')) {
    throw new Error(`Model must be free-only (openrouter/free or :free). Got: ${model}`);
  }
  return model;
}

async function openRouterChatImpl(input: {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none';
}): Promise<OpenRouterChatResponse> {
  const apiKey = getOpenRouterKey();

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost',
      'X-Title': 'platform-openrouter',
    },
    body: JSON.stringify(input),
  });

  const text = await resp.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // no-op
  }

  if (!resp.ok) {
    throw new Error(`OpenRouter error ${resp.status}: ${text}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('OpenRouter returned non-object response');
  }

  return json as OpenRouterChatResponse;
}

async function glmChatImpl(input: {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none';
}): Promise<OpenRouterChatResponse> {
  const apiKey = getGlmKey();
  const resp = await fetch(getGlmBaseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      model: getGlmModel(),
    }),
  });

  const text = await resp.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // no-op
  }

  if (!resp.ok) {
    throw new Error(`GLM error ${resp.status}: ${text}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('GLM returned non-object response');
  }

  return json as OpenRouterChatResponse;
}

export async function openRouterChat(input: {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none';
}): Promise<OpenRouterChatResponse> {
  return getProvider() === 'glm'
    ? glmChatImpl(input)
    : openRouterChatImpl(input);
}

export function extractOpenRouterText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const withText = part as { text?: unknown };
      return typeof withText.text === 'string' ? withText.text : '';
    })
    .join('\n')
    .trim();
}
