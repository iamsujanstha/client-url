import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';

export interface RequestConfig {
  id?: string;
  name?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'GRAPHQL';
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface CurlResult {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  responseTime: number;
  rawOutput: string;
  error?: string;
  curlCommand: string;
}

export class CurlEngine {
  static buildCommand(config: RequestConfig): string[] {
    const isGraphql = config.method === 'GRAPHQL';
    const method = isGraphql ? 'POST' : config.method;
    const args = ['-i', '-s', '-L', '-X', method];

    // Default Headers (if not overridden)
    const finalHeaders: Record<string, string> = {
      'User-Agent': 'curl/7.68.0',
      'Accept': 'application/json, text/plain, */*',
      ...(isGraphql ? { 'Content-Type': 'application/json' } : {}),
      ...config.headers
    };

    // Auto-detect JSON body if Content-Type is missing
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method) && !finalHeaders['Content-Type']) {
      try {
        JSON.parse(config.body);
        finalHeaders['Content-Type'] = 'application/json';
      } catch (e) {
        // Not JSON, skip
      }
    }

    // Add Headers
    Object.entries(finalHeaders).forEach(([key, value]) => {
      if (key && value !== undefined) {
        args.push('-H', `${key}: ${value}`);
      }
    });

    // Body
    if (config.body && (['POST', 'PUT', 'PATCH'].includes(config.method) || config.method === 'GRAPHQL')) {
      args.push('-d', config.body);
    }

    // URL
    args.push(config.url);

    return args;
  }

  static async execute(config: RequestConfig, signal?: AbortSignal): Promise<CurlResult> {
    const id = config.id || uuidv4();
    const args = this.buildCommand(config);
    
    // Better command preview formatting
    const curlCommand = `curl ${args.map(arg => {
      if (arg.includes(' ') || arg.includes('"') || arg.includes('$') || arg.includes("'")) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }).join(' ')}`;
    
    const startTime = Date.now();

    if (signal?.aborted) {
      return {
        id, status: 0, headers: {}, body: '', responseTime: 0,
        rawOutput: 'Aborted', error: 'Aborted', curlCommand
      };
    }

    return new Promise((resolve) => {
      const process = spawn('curl', args);
      let stdout = '';
      let stderr = '';

      const onAbort = () => {
        process.kill();
        resolve({
          id,
          status: 0,
          headers: {},
          body: '',
          responseTime: Date.now() - startTime,
          rawOutput: 'Request aborted by user',
          error: 'Aborted',
          curlCommand
        });
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        
        if (signal?.aborted) return;

        const responseTime = Date.now() - startTime;
        
        if (code !== 0 && code !== null) { // code is null when killed
          resolve({
            id,
            status: 0,
            headers: {},
            body: '',
            responseTime,
            rawOutput: stderr || `Process exited with code ${code}`,
            error: stderr || `Exit code ${code}`,
            curlCommand
          });
          return;
        }

        if (code === null) return; // Should have been handled by onAbort

        const result = this.parseOutput(stdout, id, responseTime, curlCommand);
        resolve(result);
      });
    });
  }

  private static parseOutput(raw: string, id: string, responseTime: number, curlCommand: string): CurlResult {
    const parts = raw.split(/\r?\n\r?\n/);
    
    let status = 0;
    const headers: Record<string, string> = {};
    let bodyIndex = 0;
    
    // Scan parts to parse HTTP headers.
    // A part is a header block if its first line starts with HTTP/ or if the block looks like headers.
    while (bodyIndex < parts.length) {
      const part = parts[bodyIndex];
      const lines = part.split(/\r?\n/);
      if (lines[0] && /^HTTP\/\d/i.test(lines[0].trim())) {
        // This is a header block! Parse status and headers from it.
        const statusLine = lines[0];
        const statusMatch = statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/i);
        if (statusMatch) {
          status = parseInt(statusMatch[1], 10);
        }
        
        // Parse headers - clear headers of previous hops to only keep the final response headers
        Object.keys(headers).forEach(key => delete headers[key]);
        lines.slice(1).forEach(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim().toLowerCase();
            const value = line.substring(colonIdx + 1).trim();
            headers[key] = value;
          }
        });
        
        bodyIndex++;
      } else {
        // Found the start of the body block!
        break;
      }
    }
    
    const body = parts.slice(bodyIndex).join('\n\n');

    return {
      id,
      status,
      headers,
      body,
      responseTime,
      rawOutput: raw,
      curlCommand
    };
  }
}
