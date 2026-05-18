import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';

export interface RequestConfig {
  id?: string;
  name?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
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
    const args = ['-i', '-s', '-X', config.method];

    // Default Headers (if not overridden)
    const finalHeaders = {
      'User-Agent': 'curl/7.68.0',
      'Accept': '*/*',
      ...config.headers
    };

    // Add Headers
    Object.entries(finalHeaders).forEach(([key, value]) => {
      if (key && value !== undefined) {
        args.push('-H', `${key}: ${value}`);
      }
    });

    // Body
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
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
    const [headerPart, ...bodyParts] = raw.split(/\r?\n\r?\n/);
    const body = bodyParts.join('\n\n');
    
    const lines = headerPart.split(/\r?\n/);
    const statusLine = lines[0];
    const statusMatch = statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    const headers: Record<string, string> = {};
    lines.slice(1).forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim().toLowerCase()] = valueParts.join(':').trim();
      }
    });

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
