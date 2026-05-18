import { CurlEngine, RequestConfig, CurlResult } from './curl-engine';

export interface BatchConfig {
  request: RequestConfig;
  concurrency: number;
  iterations: number;
  delayMs?: number;
}

export interface ProgressUpdate {
  type: 'progress';
  completed: number;
  total: number;
  lastResult?: CurlResult;
}

export class RequestRunner {
  static async runBatch(
    config: BatchConfig, 
    onProgress?: (update: ProgressUpdate) => void,
    signal?: AbortSignal
  ): Promise<CurlResult[]> {
    const { request, concurrency, iterations, delayMs = 0 } = config;
    const total = iterations;
    const results: CurlResult[] = [];
    let completed = 0;

    const queue = Array.from({ length: iterations }, (_, i) => i);
    
    const runId = Math.random().toString(36).substring(7);
    const worker = async () => {
      while (queue.length > 0 && !signal?.aborted) {
        const index = queue.shift();
        if (index === undefined) break;
        
        const result = await CurlEngine.execute({
          ...request,
          id: `${request.id || 'req'}-${runId}-${index}`
        }, signal);

        results.push(result);
        completed++;

        if (onProgress) {
          onProgress({
            type: 'progress',
            completed,
            total,
            lastResult: result
          });
        }

        if (delayMs > 0 && queue.length > 0 && !signal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    };

    // Spawn workers based on concurrency
    const workers = Array.from(
      { length: Math.min(concurrency, iterations) }, 
      () => worker()
    );

    await Promise.all(workers);
    return results;
  }
}
