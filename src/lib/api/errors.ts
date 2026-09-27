export interface NormalizedUIError {
  code: string;
  title: string;
  message: string;
  actionText?: string;
  actionType?: 'retry' | 'settings' | 'login' | 'dismiss';
  retryable: boolean;
  provider?: string;
}

export function normalizeAPIError(error: any): NormalizedUIError {
  const code = error?.code || error?.error?.code || 'UNKNOWN_ERROR';
  const rawMessage = error?.message || error?.error?.message || String(error);

  switch (code) {
    case 'PROVIDER_RATE_LIMITED':
      return {
        code,
        title: 'AI Provider Temporarily Busy',
        message: 'The AI provider is experiencing high traffic or reached its rate limit. VELORA automatically attempts fallback providers.',
        actionText: 'Retry Request',
        actionType: 'retry',
        retryable: true,
      };

    case 'NO_PROVIDER_AVAILABLE':
      return {
        code,
        title: 'No AI Provider Available',
        message: 'All configured AI providers are temporarily busy or unconfigured. Please configure OpenAI API key or launch a local Ollama model.',
        actionText: 'Provider Settings',
        actionType: 'settings',
        retryable: true,
      };

    case 'PROVIDER_AUTH_ERROR':
      return {
        code,
        title: 'Provider Authentication Required',
        message: 'The AI provider credentials (API Key) are invalid or not configured on the server environment.',
        actionText: 'Configure Settings',
        actionType: 'settings',
        retryable: false,
      };

    case 'PROVIDER_UNAVAILABLE':
      return {
        code,
        title: 'AI Service Unreachable',
        message: 'The requested AI model server is currently unreachable or timed out.',
        actionText: 'Retry',
        actionType: 'retry',
        retryable: true,
      };

    case 'IMAGE_PROVIDER_RATE_LIMITED':
      return {
        code,
        title: 'Image Generation Queue Busy',
        message: 'Image synthesis provider is at capacity. Please try again in 30 seconds.',
        actionText: 'Retry Generation',
        actionType: 'retry',
        retryable: true,
      };

    case 'VIDEO_PROVIDER_RATE_LIMITED':
      return {
        code,
        title: 'Video Generation Limit Reached',
        message: 'Veo video synthesis quota reached. Please allow time for active jobs to complete.',
        actionText: 'Retry',
        actionType: 'retry',
        retryable: true,
      };

    case 'MODEL_CAPABILITY_UNSUPPORTED':
      return {
        code,
        title: 'Unsupported Model Capability',
        message: rawMessage || 'This operation is not supported by the selected model.',
        actionText: 'Change Model',
        actionType: 'settings',
        retryable: false,
      };

    case 'UNAUTHORIZED':
      return {
        code,
        title: 'Authentication Required',
        message: 'Please log in to your VELORA account to access this project.',
        actionText: 'Sign In',
        actionType: 'login',
        retryable: false,
      };

    case 'APPLICATION_RATE_LIMITED':
      return {
        code,
        title: 'Too Many Requests',
        message: 'You have issued requests too quickly. Please pause briefly.',
        actionText: 'Retry',
        actionType: 'retry',
        retryable: true,
      };

    default:
      // If message includes 429 or resource exhausted
      if (rawMessage.toLowerCase().includes('429') || rawMessage.toLowerCase().includes('resource_exhausted')) {
        return {
          code: 'PROVIDER_RATE_LIMITED',
          title: 'AI Provider Limit Reached',
          message: 'The AI model quota is temporarily exhausted. Configure OpenAI or launch Ollama as a fallback.',
          actionText: 'Provider Settings',
          actionType: 'settings',
          retryable: true,
        };
      }

      return {
        code,
        title: 'Generation Notice',
        message: rawMessage || 'An unexpected condition occurred while processing.',
        actionText: 'Retry',
        actionType: 'retry',
        retryable: true,
      };
  }
}
