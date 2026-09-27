/**
 * VELORA AI — Capability Router & Intelligent Fallback Planner
 * 
 * Filters candidate models by task requirements, verifies configured credentials,
 * checks live quota health, and plans ordered fallback chains.
 */

import { TaskType, ModelCapabilityDefinition, KNOWN_MODELS } from './modelCapabilityRegistry';
import { quotaManager } from './quotaManager';

export interface RouteSelectionResult {
  selectedModel: ModelCapabilityDefinition;
  isFallback: boolean;
  attemptedModels: string[];
  fallbackReason?: string;
  alternatives: ModelCapabilityDefinition[];
}

export class CapabilityRouter {
  /**
   * Classify a raw user creative directive or chat prompt into a specific TaskType
   */
  classifyTask(prompt: string, explicitType?: string, hasImageInput: boolean = false): TaskType {
    if (explicitType) {
      if (explicitType === 'IMAGE' || explicitType === 'TEXT_TO_IMAGE') {
        return hasImageInput ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
      }
      if (explicitType === 'VIDEO' || explicitType === 'TEXT_TO_VIDEO' || explicitType === 'IMAGE_TO_VIDEO') {
        return hasImageInput ? 'IMAGE_TO_VIDEO' : 'TEXT_TO_VIDEO';
      }
      if (explicitType === 'TEXT_TO_MUSIC') return 'TEXT_TO_MUSIC';
      if (explicitType === 'AUDIO_TRANSCRIPTION') return 'AUDIO_TRANSCRIPTION';
    }

    const lower = prompt.toLowerCase();

    // Video generation indicators
    if (lower.startsWith('create a video') || lower.startsWith('generate a video') || lower.includes('animate this') || lower.includes('video of')) {
      return hasImageInput ? 'IMAGE_TO_VIDEO' : 'TEXT_TO_VIDEO';
    }

    // Image generation indicators
    if (lower.startsWith('create an image') || lower.startsWith('generate an image') || lower.startsWith('paint ') || lower.startsWith('draw ') || lower.includes('photo of') || lower.includes('illustration of')) {
      return hasImageInput ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE';
    }

    // Coding & Reasoning indicators
    if (lower.includes('write code') || lower.includes('function') || lower.includes('python') || lower.includes('typescript') || lower.includes('bug')) {
      return 'CODING';
    }
    if (lower.includes('step by step') || lower.includes('reason') || lower.includes('deduce') || lower.includes('solve this proof')) {
      return 'REASONING';
    }

    // Live search indicators
    if (lower.includes('latest news') || lower.includes('current weather') || lower.includes('who won today') || lower.includes('search for')) {
      return 'RESEARCH';
    }

    return hasImageInput ? 'VISION_ANALYSIS' : 'CHAT';
  }

  /**
   * Find all models matching a required task and configured credentials
   */
  async getCandidateModels(task: TaskType): Promise<ModelCapabilityDefinition[]> {
    const matching = KNOWN_MODELS.filter((m) => {
      // Must support the task
      if (!m.taskTypes.includes(task)) return false;
      // Must have credentials configured
      if (!m.isConfigured()) return false;
      return true;
    });

    // Check live health state for each
    const candidatesWithHealth: { model: ModelCapabilityDefinition; available: boolean }[] = [];
    for (const m of matching) {
      const isAvail = await quotaManager.isAvailable(m.provider, m.id);
      candidatesWithHealth.push({ model: m, available: isAvail });
    }

    // Sort: available first, then by priority class
    candidatesWithHealth.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return 0;
    });

    return candidatesWithHealth.map((c) => c.model);
  }

  /**
   * Select primary model and prepare fallback chain
   */
  async planRoute(
    task: TaskType,
    preferredModelId?: string,
    excludedModelIds: string[] = []
  ): Promise<{
    primaryModel: ModelCapabilityDefinition | null;
    fallbackChain: ModelCapabilityDefinition[];
    reason: string;
  }> {
    const candidates = await this.getCandidateModels(task);
    const available = candidates.filter((m) => !excludedModelIds.includes(m.id));

    if (available.length === 0) {
      return {
        primaryModel: null,
        fallbackChain: [],
        reason: 'No configured provider with active quota is currently available for this task.',
      };
    }

    // If preferred model is specified, check if it's in available list
    if (preferredModelId && preferredModelId !== 'auto') {
      const preferred = available.find((m) => m.id === preferredModelId);
      if (preferred) {
        const fallbacks = available.filter((m) => m.id !== preferredModelId);
        return {
          primaryModel: preferred,
          fallbackChain: fallbacks,
          reason: `Selected preferred model "${preferred.name}".`,
        };
      }
    }

    // AUTO selection: Pick first available model
    const primary = available[0];
    const fallbacks = available.slice(1);

    return {
      primaryModel: primary,
      fallbackChain: fallbacks,
      reason: `Recommended for this task: ${primary.name} (${primary.providerName}).`,
    };
  }
}

export const capabilityRouter = new CapabilityRouter();
