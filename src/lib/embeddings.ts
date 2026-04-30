import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Explicitly set the execution provider to CPU to avoid hardware probing issues
// during the Next.js build process. This is a more robust way to prevent the
// GLib-GObject errors than the 'device' passthrough option.
env.backends.onnx.executionProviders = ['cpu'];
// Allow caching of models locally on the server. This is much more efficient
// than re-downloading on every cold start. The default is true.
env.allowLocalModels = true;
// This is for browser environments and has no effect on the server.
env.useBrowserCache = false;

type ProgressCallback = (data: {
  status: string;
  file: string;
  progress: number;
  loaded: number;
  total: number;
}) => void;

class PipelineSingleton {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback
      });
    }
    return this.instance;
  }
}

const embeddingCache = new Map<string, { vector: number[]; expiry: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours for embeddings

export async function getLocalEmbedding(text: string): Promise<number[]> {
  try {
    const cacheKey = text.toLowerCase().trim();
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.vector;
    }

    const extractor = await PipelineSingleton.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data) as number[];

    embeddingCache.set(cacheKey, {
      vector,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return vector;
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error;
  }
}