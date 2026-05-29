import { CurlEngine, RequestConfig, CurlResult } from './curl-engine';

export interface BatchConfig {
  request?: RequestConfig;
  requests?: RequestConfig[];
  concurrency: number;
  iterations: number;
  delayMs?: number;
  // Lab Options
  testModule?: string;
  jitter?: boolean;
  fuzzing?: boolean;
  retries?: number;
}

export interface ProgressUpdate {
  type: 'progress';
  completed: number;
  total: number;
  lastResult?: CurlResult;
  startTime?: number;
}

export class RequestRunner {
  public static activeCount = 0;

  static async runBatch(
    config: BatchConfig, 
    onProgress?: (update: ProgressUpdate) => void,
    signal?: AbortSignal
  ): Promise<CurlResult[]> {
    const { request, requests, concurrency, iterations, delayMs = 0, testModule, jitter, fuzzing, retries = 0 } = config;
    
    // If requests array is provided, iterations matches its length
    const total = requests ? requests.length : iterations;
    const results: CurlResult[] = [];
    let completed = 0;
    const startTime = Date.now();

    const queue = Array.from({ length: total }, (_, i) => i);
    
    const runId = Math.random().toString(36).substring(7);
    const worker = async () => {
      RequestRunner.activeCount++;
      try {
        while (queue.length > 0 && !signal?.aborted) {
          const index = queue.shift();
          if (index === undefined) break;

          let finalRequest = requests ? { ...requests[index] } : { ...request! };

        // --- Module-Specific Instrumentation ---

        // 1. Race Detector: Extreme jittered clustering
        if (testModule === 'race') {
          // Force a very small random delay (0-20ms) to ensure requests hit the server in tight waves
          await new Promise(r => setTimeout(r, Math.random() * 20));
        }

        // 2. Payload Fuzzer: Sophisticated mutation
        if (testModule === 'fuzzer' && finalRequest.body) {
          try {
            const body = JSON.parse(finalRequest.body);
            const keys = Object.keys(body);
            const strategy = Math.floor(Math.random() * 4);
            
            if (keys.length > 0) {
              const targetKey = keys[Math.floor(Math.random() * keys.length)];
              switch (strategy) {
                case 0: // Key Drop
                  delete body[targetKey];
                  break;
                case 1: // Type Swap
                  body[targetKey] = typeof body[targetKey] === 'number' ? "corrupt_string" : 999999999;
                  break;
                case 2: // Null Inject
                  body[targetKey] = null;
                  break;
                case 3: // Overflow
                  body[targetKey] = "A".repeat(1000);
                  break;
              }
            }
            finalRequest.body = JSON.stringify(body);
          } catch (e) {
            // If not JSON, append junk
            finalRequest.body += "_FUZZ_" + Math.random().toString(36);
          }
        }

        // 3. Replay Guard: Idempotency cloning
        if (testModule === 'replay' && finalRequest.body) {
          try {
            const body = JSON.parse(finalRequest.body);
            // Locate common transaction/id fields and keep them constant for specific groups
            const groupSize = 2; // Every 2 requests share the same ID
            const groupId = Math.floor(index / groupSize);
            const constantId = `REPLAY_TEST_ID_${runId}_${groupId}`;
            
            ['id', 'transaction_id', 'nonce', 'requestId', 'orderId'].forEach(field => {
              if (field in body || index % 5 === 0) body[field] = constantId;
            });
            finalRequest.body = JSON.stringify(body);
          } catch (e) {}
        }

        // 4. Chaos Mode: Network and header corruption
        if (testModule === 'chaos') {
          // Randomly drop headers
          const headerKeys = Object.keys(finalRequest.headers);
          if (headerKeys.length > 0 && Math.random() > 0.7) {
            const target = headerKeys[Math.floor(Math.random() * headerKeys.length)];
            const headers = { ...finalRequest.headers };
            delete headers[target];
            finalRequest.headers = headers;
          }
          // High Jitter
          await new Promise(r => setTimeout(r, Math.random() * 800));
        }

        // 5. Security Audit: Systematic Vulnerability Probes
        if (testModule === 'security_audit') {
          const probeType = index % 6;
          const headers = { ...finalRequest.headers };
          let bodyText = finalRequest.body || '';
          let urlText = finalRequest.url || '';

          // Add metadata helper headers so the engine and UI can audit the security testing
          headers['X-Security-Test-Type'] = ['SQLI', 'XSS', 'NO_AUTH', 'CORS', 'PATH_TRAVERSAL', 'CMD_INJECTION'][probeType];

          if (probeType === 0) { // SQL Injection (SQLi)
            const sqlPayload = "' OR '1'='1' --";
            urlText += (urlText.includes('?') ? '&' : '?') + `q=sqli_test${encodeURIComponent(sqlPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${sqlPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${sqlPayload}`;
              }
            }
          } else if (probeType === 1) { // Cross-Site Scripting (XSS)
            const xssPayload = `"><script>alert("qaxss")</script>`;
            urlText += (urlText.includes('?') ? '&' : '?') + `input=${encodeURIComponent(xssPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${xssPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${xssPayload}`;
              }
            }
          } else if (probeType === 2) { // No Authentication Bypass
            // Strip out credential headers to see if we get a 401/403 (Safe) or 200/500 (Vulnerable!)
            const authHeaders = ['authorization', 'cookie', 'x-api-key', 'token', 'auth', 'x-auth-token'];
            Object.keys(headers).forEach(k => {
              if (authHeaders.includes(k.toLowerCase())) {
                delete headers[k];
              }
            });
          } else if (probeType === 3) { // CORS Wildcard & Origin Reflection
            headers['Origin'] = 'https://evil-attacker.com';
            headers['Referer'] = 'https://evil-attacker.com/exploit-stage';
          } else if (probeType === 4) { // Path Traversal / Local File Inclusion (LFI)
            const traversalPayload = '../../../../etc/passwd';
            urlText += (urlText.includes('?') ? '&' : '?') + `file=${encodeURIComponent(traversalPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] = traversalPayload;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText = traversalPayload;
              }
            }
          } else if (probeType === 5) { // Shell Command Injection
            const cmdPayload = '; cat /etc/passwd || dir';
            urlText += (urlText.includes('?') ? '&' : '?') + `cmd=${encodeURIComponent(cmdPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${cmdPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${cmdPayload}`;
              }
            }
          }

          finalRequest.headers = headers;
          finalRequest.body = bodyText;
          finalRequest.url = urlText;
        }

        // Standard Jitter (Fallback)
        if (jitter && testModule !== 'chaos' && testModule !== 'race') {
          const wait = Math.random() * 500;
          await new Promise(r => setTimeout(r, wait));
        }

        let result: CurlResult;
        let attempt = 0;
        
        const executeWithRetry = async (): Promise<CurlResult> => {
          try {
            const res = await CurlEngine.execute({
              ...finalRequest,
              id: `${finalRequest.id || 'req'}-${runId}-${index}`
            }, signal);
            
            if (res.status >= 400 && attempt < retries) {
              attempt++;
              return executeWithRetry();
            }
            return res;
          } catch (e: any) {
            if (attempt < retries) {
              attempt++;
              return executeWithRetry();
            }
            throw e;
          }
        };

        result = await executeWithRetry();

        results.push(result);
        completed++;

        if (onProgress) {
          onProgress({
            type: 'progress',
            completed,
            total,
            lastResult: result,
            startTime
          });
        }

        if (delayMs > 0 && queue.length > 0 && !signal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      } finally {
        RequestRunner.activeCount--;
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
