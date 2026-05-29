import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Shield, Repeat, Target, Flame, AlertTriangle, Cpu, Activity, 
  Play, Info, Settings2, BarChart4, Terminal, X, RefreshCw, Layout, 
  Beaker, ChevronDown, Copy, Code2, Globe, Server, Hash, Clock, Plus, Trash2, List, ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';
import { RequestConfig, CurlResult } from '../server/modules/curl-engine';
import { ProgressUpdate } from '../server/modules/runner';

export type TestModuleId = 'blast' | 'race' | 'replay' | 'load' | 'chaos' | 'rate' | 'fuzzer' | 'scenario' | 'security_audit';

interface TestModule {
  id: TestModuleId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  strategy: string;
  settingsTitle: string;
  primaryMetric: string;
  theory: string;
}

const TEST_MODULES: TestModule[] = [
  {
    id: 'blast',
    name: 'CONCURRENT_BLAST',
    description: 'High-density concurrent execution to verify endpoint saturation limit.',
    icon: <Zap size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40',
    strategy: 'PARALLEL_STORM',
    settingsTitle: 'STRESS_LEVEL',
    primaryMetric: 'THROUGHPUT',
    theory: 'Saturation testing identifies peak capacity. Saturating the CPU and I/O request queues monitors the exact Point of Failure (PoF) where latency degrades exponentially.'
  },
  {
    id: 'race',
    name: 'RACE_DETECTOR',
    description: 'Injects overlapping micro-delays to trigger state collisions.',
    icon: <Shield size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/40',
    strategy: 'ATOMIC_INTEGRITY',
    settingsTitle: 'COLLISION_WINDOW',
    primaryMetric: 'STATE_DRIFT',
    theory: 'Race conditions happen when backend outcomes depend on request timing. Inundating a cluster simultaneously targets race scenarios in read-modify-write fields.'
  },
  {
    id: 'replay',
    name: 'REPLAY_GUARD',
    description: 'Replays payload and telemetry signatures to verify idempotency guards.',
    icon: <Repeat size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    strategy: 'IDEMPOTENCY_PROBE',
    settingsTitle: 'DEDUPLICATOR',
    primaryMetric: 'DEDUPE_RATIO',
    theory: 'Deduplication guarantees that processing multiple identical payloads has the same system impact as a single transaction—essential for payment streams.'
  },
  {
    id: 'load',
    name: 'LOAD_CANNON',
    description: 'Sustained throughput testing with worker queue orchestration.',
    icon: <Target size={16} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/40',
    strategy: 'SUSTAINED_PRESSURE',
    settingsTitle: 'QUEUE_DEPTH',
    primaryMetric: 'LATENCY_P99',
    theory: 'Sustained profiles monitor reliability against performance contracts (SLA logs). It analyzes latency over time under nominal target expectations.'
  },
  {
    id: 'chaos',
    name: 'CHAOS_MODE',
    description: 'Simulates connection drops, packet limits, & structural network decay.',
    icon: <Flame size={16} />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    strategy: 'ENTROPY_ENGINE',
    settingsTitle: 'ENTROPY_RATIO',
    primaryMetric: 'ERROR_RATE',
    theory: 'Entropy engineering validates fallback resiliency. Simulating physical outages forces your API endpoints to handle structural exceptions elegantly.'
  },
  {
    id: 'rate',
    name: 'RATE_BREAKER',
    description: 'Frequency staging scans to map API endpoint throttling limitations.',
    icon: <AlertTriangle size={16} />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/40',
    strategy: 'LIMITS_DISCOVERY',
    settingsTitle: 'BURST_PEAK',
    primaryMetric: 'LIMIT_HIT_TIME',
    theory: 'Rate limits protect computational cycles. This suite triggers consecutive micro-bursts of API packets until status 429 Too Many Requests triggers.'
  },
  {
    id: 'fuzzer',
    name: 'PAYLOAD_FUZZER',
    description: 'Mutates variable inputs & fields to detect type vulnerabilities.',
    icon: <Cpu size={16} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/40',
    strategy: 'MUTATION_STRESS',
    settingsTitle: 'MUTATION_DEPTH',
    primaryMetric: 'VULN_DISCOVERY',
    theory: 'Fuzzing supplies arbitrary structures to the parsing logic. This exposes bad exception handlers, unquoted fields, or implicit casting crashes.'
  },
  {
    id: 'scenario',
    name: 'SCENARIO_RUNNER',
    description: 'Sequential request pipelines with dynamic schema dependencies.',
    icon: <Activity size={16} />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/40',
    strategy: 'PIPELINE_FLOW',
    settingsTitle: 'PIPELINE_STAGES',
    primaryMetric: 'CHAIN_SUCCESS',
    theory: 'Active clients don\'t run endpoints in isolation. Scenario testing orchestrates stateful changes to confirm transactional integrity across paths.'
  },
  {
    id: 'security_audit',
    name: 'SECURITY_AUDITOR',
    description: 'Probes for SQLi, XSS, local file disclosure, and audits HTTP response headers and CORS hygiene.',
    icon: <ShieldAlert size={16} />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    strategy: 'VULNERABILITY_PROBE',
    settingsTitle: 'PROBE_DEPTH',
    primaryMetric: 'VULN_ALERTS',
    theory: 'Automated vulnerability checkers scan for unescaped field projections. Mutating inputs with active exploits (SQLi, XSS, Directory Traversal) highlights vulnerable status codes and content reflections.'
  }
];

const THEORETICAL_FRAMEWORKS: Record<TestModuleId, {
  problem: string;
  solution: string;
  realLifeExample: string;
  staffEngineeringDepth: string;
}> = {
  blast: {
    problem: "When user traffic spikes suddenly (e.g., ticket sales or viral media surges), thousands of concurrent TCP sockets connect simultaneously. If the database connection pool is under-provisioned, or if blockages creep into the event loop, thread starvation sets in. The system spends more CPU cycles switching execution contexts than completing productive work (CPU Thrashing), escalating latencies exponentially until the service timeouts or crashes (504 Gateway Timeouts).",
    solution: "CONCURRENT_BLAST testing floods the target with high-density parallel requests to identify thread pool bounds and database connection limits. By tracking API throughput (RPS) against scaling concurrency levels, we pinpoint the exact 'saturation inflection point' where throughput plateaus or drops while latencies rise sharply.",
    realLifeExample: "A ticket vendor opens sales for a stadium show. Within 500ms of open-time, 50,000 requests hit the /checkout endpoint. The database connection pool is configured to a maximum of 20 connections; Postgres immediately queue-blocks connections. Node's event loop waits, Redis queries time out, and the entire API cluster fails under cascade backlog.",
    staffEngineeringDepth: "To prevent thread starvation, decouple slow databases using event queues, increase database connection pools using multiplexers (e.g., PgBouncer), and integrate active load shedding (e.g., serving fast 503 errors when request queues exceed 200ms) to shelter the system from collapse."
  },
  race: {
    problem: "Non-atomic update logic (Read-Modify-Write) allows 'dirty writes' when overlapping requests read identical state before changes write back. For example, if two payment requests query a $100 balance simultaneously, both see $100 and approve the spend. Both write back a remaining $50, resulting in $100 spent but a $50 final balance.",
    solution: "RACE_DETECTOR injects tight concurrent payload mutations in a sub-millisecond window targeting the exact same record, trying to force state write collisions and highlighting missing row-level serialization or distributed locks.",
    realLifeExample: "A flash sale occurs for a limited-stock console. Shoppers hit the 'Buy' trigger at the exact same millisecond. Multiple threads check 'stock_count = 1', validate, and decrement inventory. Both purchases succeed, resulting in double-allocation and overselling.",
    staffEngineeringDepth: "Mitigate race conditions using Pessimistic Locking (SELECT FOR UPDATE) to lock database rows down during a read, Optimistic Locking (WHERE version = X) to fail operations if the record has moved, or distributed lock managers like Redis Redlock across dynamic cluster nodes."
  },
  replay: {
    problem: "Noisy or malicious clients can intercept and resubmit identical request headers, signatures, or payloads. If transaction mutations lack deduplication checks, they process again, causing duplicate billing, duplicate item creation, or broken state integrity.",
    solution: "REPLAY_GUARD clones authorization headers, payload structures, and telemetry markers, resending identical signatures sequentially to verify that the backend implements transaction-uniqueness constraints (Idempotency Guards) and safely logs duplicates.",
    realLifeExample: "An unstable mobile connection causes a user's delivery request to hang. The app automatically retries. The web gateway processes each retry as a brand new command, generating three separate delivery orders and triple-charging the credit card.",
    staffEngineeringDepth: "Enforce strict idempotency using unique Idempotency-Key headers on all mutative requests (POST/PATCH). Store these transaction keys in Redis with a short TTL (e.g., 24h). If a key state is 'Processing', return a transient lock-wait; if 'Completed', immediately serve the cached response without running downstream controllers."
  },
  load: {
    problem: "Longer execution runs surface bugs that quick spikes miss. Gradual degradation (Performance Rot) from memory leaks, file descriptor starvation, index fragmentation, or un-garbage-collected heaps slowly pushes latency baselines up and crashes servers after hours of flawless usage.",
    solution: "LOAD_CANNON runs extended, continuous request queues to test garbage collection efficiency, heap allocation trends, socket exhaustion under heavy load, and database slow-query regressions.",
    realLifeExample: "An IoT telemetry engine receives data packets every minute. A tiny memory leak in an incoming string parser retains characters on the V8 heap. The microservice operates perfectly for 6 hours, then silently heaps out and crashes.",
    staffEngineeringDepth: "Monitor Heap Allocation graphs during sustained load. Add strict timeouts to downstream connections to prevent file descriptor leaks, index critical query predicates, and set up alert limits at 80% RAM utilization to trigger controlled canary rolling restarts."
  },
  chaos: {
    problem: "In microservice topologies, external networks, caches, or third-party gateways will eventually fail or run slow. If dependencies act synchronously without protection, a failure in a minor metadata service cascadingly starves threads across the entire ecosystem.",
    solution: "CHAOS_MODE simulates network packet drops, connection closures, and high latency targets. This assesses whether circuit breakers, graceful degradation states, and timeout policies successfully guard primary customer flows.",
    realLifeExample: "A shop's main product page tries to load item details, stock count, and personal recommendations. The recommendation service suffers a network timeout. Since the main route calls the service synchronously without key protection, the entire product page hangs and errors out with a 500 error instead of simply hiding recommendations.",
    staffEngineeringDepth: "Wrap third-party and non-essential queries in resilient Circuit Breakers (such as Cockatiel or Hystrix), configure aggressive 500-1000ms socket timeouts, and return static fallbacks or cached models when downstream services fail."
  },
  rate: {
    problem: "Unrestricted public APIs are highly vulnerable to scraping, brute-force hacking, credit card testing, and general Denial of Service (DoS) sweeps. If endpoints don't restrict repetitive queries, they consume high database resources, elevate operating costs, and block legitimate traffic.",
    solution: "RATE_BREAKER initiates fast, iterative bursts of identical target requests to detect rate limits, monitoring if HTTP 429 (Too Many Requests) boundaries trigger and verifying back-off response headers (e.g., Retry-After).",
    realLifeExample: "An authentication route /api/login lacks rate limits. An attacker runs a dictionary attack, executing 100 requests per second using distinct password lists, overwhelming CPU-heavy bcrypt hashing blocks and locking up the server database.",
    staffEngineeringDepth: "Deploy sliding-window or token-bucket rate limit algorithms on edge gateways (e.g., Cloudflare, Nginx, API Gateway) rather than application code. Leverage Redis to aggregate key-hits mapped to user IDs or Client IPs with short sliding windows (e.g., 60 seconds)."
  },
  fuzzer: {
    problem: "API modules parse untrusted payloads assuming structures are correct. Lacking strict schema isolation, unescaped field entries, type casting errors, or unexpected keys can trigger backend interpreter crashes, unhandled database queries, or server crashes.",
    solution: "PAYLOAD_FUZZER alters payload variables, deletes keys, swaps types, and introduces giant buffers, proving that parser systems reject invalid input formats cleanly without leaking deep runtime traces or crashing the event loop.",
    realLifeExample: "A search endpoint parses a filters query: {\"price\": 100}. An attacker injects MongoDB operators: {\"price\": {\"$gt\": 0}}. The database runs the query literally, exposing the entire product database rather than raising an invalid query exception.",
    staffEngineeringDepth: "Integrate schema validation engines (such as Zod, AJV, or Joi) at the controller gateway. Adhere to a 'Parse, Don't Validate' design philosophy: strictly convert incoming payloads into sanitized, strongly typed model objects before forwarding data to internal service modules."
  },
  scenario: {
    problem: "An individual endpoint can pass validation perfectly, yet state transitions across multiple endpoints (e.g., Register -> Order -> Refund) create edge cases like orphaned payments, inconsistent inventory allocations, or invalid transition logic.",
    solution: "SCENARIO_RUNNER executes stateful chains of API operations to test end-to-end user journeys, ensuring state changes propagate cleanly across sequential microservices and audit logs.",
    realLifeExample: "A flight checkout process charges a customer's card, reserves a seat, and sends a booking code. If reservation is broken, the money is captured, but the seat remains unallocated and the system leaves the order state 'broken' without issuing a rollback.",
    staffEngineeringDepth: "Implement Saga Orchestration or Process Managers for distributed sagas. Leverage transactional outbox patterns to make sure actions commit together, and store state changes as persistent event records to facilitate point-in-time failure recovery."
  },
  security_audit: {
    problem: "Applications with inputs directly bound to query strings, SQL statements, or HTML renders are prone to injection vectors: SQLi, XSS, Path Traversal, or missing Sandbox headers. Attackers exploit these gaps to steal databases, read root files, or hijack active browser sessions.",
    solution: "SECURITY_AUDITOR tests fields by injecting malicious patterns (e.g., ' OR 1=1 --, <script>, and traversals) to inspect if error paths reflect raw backends, checking if response headers correctly sanitize client-side contexts.",
    realLifeExample: "An endpoint loads files via /api/view?file=item.pdf. An attacker accesses /api/view?file=../../../../etc/passwd, bypassing authorization to read the host operating system's user credentials directly.",
    staffEngineeringDepth: "Maintain defence-in-depth: decouple user parameters using Prepared / Parameterized Queries, purify HTML output using DOMPurify, lock file lookups to strict static folders, and configure strict security headers (CSP, HSTS, XSS-Protection, X-Frame-Options)."
  }
};



interface TestLabProps {
  config: RequestConfig;
  headersList: { id: string, key: string, value: string }[];
  ws: WebSocket | null;
  activeTabId: string;
  loading: boolean;
  progress: ProgressUpdate | null;
  results: CurlResult[];
  onStart: (moduleId: TestModuleId, settings: any) => void;
  onAbort: () => void;
  onChangeConfig?: (updates: Partial<RequestConfig>) => void;
  onClearLogs?: () => void;
}

export function TestLab({ config, headersList, ws, activeTabId, loading, progress, results, onStart, onAbort, onChangeConfig, onClearLogs }: TestLabProps) {
  const [selectedModule, setSelectedModule] = useState<TestModuleId>('blast');
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);
  const [iterationsPerUser, setIterationsPerUser] = useState(10);
  const [concurrency, setConcurrency] = useState(10);
  const [retries, setRetries] = useState(0);
  const [labTab, setLabTab] = useState<'logs' | 'curl' | 'theory'>('logs');
  const [showLabCurl, setShowLabCurl] = useState(false);
  const [assertions, setAssertions] = useState<{ id: string, type: string, value: string }[]>([
    { id: '1', type: 'STATUS_CODE', value: '200' }
  ]);
  const [fuzzerChecks, setFuzzerChecks] = useState({ keyDeletions: true, typeMutations: true, bufferOverflow: false });
  const [securityChecks, setSecurityChecks] = useState({ sqli: true, xss: true, pathTraversal: true, headersAuditor: true });
  const [chaosAmplitude, setChaosAmplitude] = useState(60);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const activeModule = useMemo(() => {
    return TEST_MODULES.find(m => m.id === selectedModule) || TEST_MODULES[0];
  }, [selectedModule]);

  const totalIterations = iterationsPerUser * concurrency;

  // Generate strategy scripts
  const curlStrategy = useMemo(() => {
    const headersConfig = config.headers || {};
    const headers = Object.entries(headersConfig).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
    const body = config.body ? `-d '${config.body}'` : '';
    const baseCurl = `curl -X ${config.method} "${config.url || 'http://localhost:3000/api/endpoint'}" ${headers} ${body}`;

    switch (selectedModule) {
      case 'blast':
        return `seq ${totalIterations} | xargs -P ${concurrency} -I {} ${baseCurl}`;
      case 'race':
        return `# Overlapping Collision Script\nfor i in {1..${concurrency}}; do\n  ${baseCurl} &\ndone\nwait`;
      case 'fuzzer':
        return `# Mutation Fuzzer Input Script\nfor i in {1..20}; do\n  # Injected field mutation logic\n  ${baseCurl}\ndone`;
      default:
        return baseCurl;
    }
  }, [selectedModule, config, totalIterations, concurrency]);

  // Compute Latency categories dynamically
  const latencyCategories = useMemo(() => {
    let fast = 0;       // < 150ms
    let acceptable = 0; // 150 - 450ms
    let slow = 0;       // 450 - 1000ms
    let lagging = 0;    // > 1000ms

    results.forEach(r => {
      if (r.responseTime < 150) fast++;
      else if (r.responseTime < 450) acceptable++;
      else if (r.responseTime < 1000) slow++;
      else lagging++;
    });

    const total = results.length || 1;
    return {
      fast: { count: fast, pct: Math.round((fast / total) * 100) },
      acceptable: { count: acceptable, pct: Math.round((acceptable / total) * 100) },
      slow: { count: slow, pct: Math.round((slow / total) * 100) },
      lagging: { count: lagging, pct: Math.round((lagging / total) * 100) },
    };
  }, [results]);

  // Calculate precise percentiles
  const percentiles = useMemo(() => {
    if (results.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };
    const sorted = [...results].map(r => r.responseTime).sort((a, b) => a - b);
    const getP = (p: number) => {
      const idx = Math.floor(sorted.length * p);
      return sorted[Math.min(idx, sorted.length - 1)] || 0;
    };
    return {
      p50: getP(0.50),
      p90: getP(0.90),
      p95: getP(0.95),
      p99: getP(0.99)
    };
  }, [results]);

  // Assertion evaluator
  const checkAssertion = (res: CurlResult, assertion: { type: string, value: string }) => {
    if (assertion.type === 'STATUS_CODE') {
      return res.status.toString() === assertion.value;
    }
    if (assertion.type === 'LATENCY_LESS_THAN') {
      const limit = parseInt(assertion.value) || 1000;
      return res.responseTime < limit;
    }
    if (assertion.type === 'CONTAINS_TEXT') {
      return !!(res.body && res.body.toLowerCase().includes(assertion.value.toLowerCase()));
    }
    return true;
  };

  const getFailedAssertionsCount = (res: CurlResult) => {
    let failCount = 0;
    assertions.forEach(a => {
      if (!checkAssertion(res, a)) failCount++;
    });
    return failCount;
  };

  const startTest = () => {
    onStart(selectedModule, {
      iterations: totalIterations,
      concurrency,
      retries,
      assertions: assertions.map(a => ({ type: a.type, value: a.value })),
      fuzzerChecks,
      securityChecks
    });
  };

  const handleClearLogs = () => {
    setSelectedResult(null);
    if (onClearLogs) {
      onClearLogs();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const addAssertion = () => {
    setAssertions([...assertions, { id: Date.now().toString(), type: 'STATUS_CODE', value: '200' }]);
  };

  const removeAssertion = (id: string) => {
    if (assertions.length > 1) {
      setAssertions(assertions.filter(a => a.id !== id));
    }
  };

  const updateAssertion = (id: string, updates: Partial<{ type: string, value: string }>) => {
    setAssertions(assertions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const securityAudit = useMemo(() => {
    if (selectedModule !== 'security_audit' || results.length === 0) return null;

    let totalAlerts = 0;
    const items: { name: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS'; status: string; detail: string; recommendation: string }[] = [];

    let sqliVulnerable = false;
    let xssVulnerable = false;
    let authBypassed = false;
    let corsInsecure = false;
    let pathTraversalLeak = false;

    results.forEach(r => {
      const curlLower = r.curlCommand.toLowerCase();
      const resBody = r.body || '';
      const resStatus = r.status;
      const resHeaders = r.headers || {};

      // 1. SQLi Probe detection
      if (curlLower.includes('sqli_test') || curlLower.includes("' or '1'='1'")) {
        const hasSqlError = /sql|mysql|sqlite|postgresql|mariadb|syntax error/i.test(resBody);
        const badStatus = resStatus === 500;
        if (hasSqlError || (badStatus && resBody.toLowerCase().includes('database'))) {
          sqliVulnerable = true;
        }
      }

      // 2. XSS reflect check
      if (curlLower.includes('qaxss') || curlLower.includes('<script>')) {
        if (resBody.includes('qaxss') && resBody.includes('<script>')) {
          xssVulnerable = true;
        }
      }

      // 3. Auth Strip check
      const isNoAuthProbe = curlLower.includes('x-security-test-type: no_auth');
      if (isNoAuthProbe && resStatus < 300) {
        authBypassed = true;
      }

      // 4. CORS check
      const lowerResHeaders = Object.keys(resHeaders).reduce((acc, k) => {
        acc[k.toLowerCase()] = String(resHeaders[k]).toLowerCase();
        return acc;
      }, {} as Record<string, string>);

      if (lowerResHeaders['access-control-allow-origin'] === '*' || lowerResHeaders['access-control-allow-origin'] === 'https://evil-attacker.com') {
        if (lowerResHeaders['access-control-allow-credentials'] === 'true') {
          corsInsecure = true;
        }
      }

      // 5. Path traversal leak check
      if (curlLower.includes('passwd') || curlLower.includes('etc/passwd')) {
        if (/root:x:0/i.test(resBody) || /\[boot loader\]/i.test(resBody)) {
          pathTraversalLeak = true;
        }
      }
    });

    const firstResult = results[0];
    const firstHeaders = firstResult ? Object.keys(firstResult.headers).reduce((acc, k) => {
      acc[k.toLowerCase()] = String(firstResult.headers[k]);
      return acc;
    }, {} as Record<string, string>) : {};

    const missingCsp = !firstHeaders['content-security-policy'];
    const missingXFrame = !firstHeaders['x-frame-options'];
    const missingXContentType = !firstHeaders['x-content-type-options'];

    if (securityChecks.sqli) {
      if (sqliVulnerable) {
        totalAlerts++;
        items.push({
          name: 'SQL Injection Vulnerability',
          severity: 'HIGH',
          status: 'VULNERABLE',
          detail: 'Database engine leaked syntax or internal query logs in raw response stream.',
          recommendation: 'Use parameterized query builders, escape inputs, and disable detailed backend exception displays in production.'
        });
      } else {
        items.push({
          name: 'SQL Injection Shield',
          severity: 'PASS',
          status: 'SECURE',
          detail: 'System handled dynamic escape patterns safely without raw database exception reflections.',
          recommendation: 'Maintain current ORM and input query serialization practices.'
        });
      }
    }

    if (securityChecks.xss) {
      if (xssVulnerable) {
        totalAlerts++;
        items.push({
          name: 'Reflective Cross-Site Scripting (XSS)',
          severity: 'HIGH',
          status: 'VULNERABLE',
          detail: 'Injected HTML elements reflected literally inside reply stream. High execution hijack potential.',
          recommendation: 'Sanitize script tags, use safe text binding helpers, and mandate content validation frameworks.'
        });
      } else {
        items.push({
          name: 'XSS Escape Filtering',
          severity: 'PASS',
          status: 'SECURE',
          detail: 'No unescaped tags or reflective DOM execution patterns were detected.',
          recommendation: 'Continue context-aware HTML entity encoding on user entries.'
        });
      }
    }

    if (securityChecks.pathTraversal) {
      if (pathTraversalLeak) {
        totalAlerts++;
        items.push({
          name: 'Local Directory Path Traversal',
          severity: 'CRITICAL',
          status: 'VULNERABLE',
          detail: 'Privileged file identifiers returned. Confirmed access bypass.',
          recommendation: 'Sanitise file path separators and avoid dynamic filename lookups against system streams.'
        });
      } else {
        items.push({
          name: 'Directory Escaping Protection',
          severity: 'PASS',
          status: 'SECURE',
          detail: 'Path traversals rejected or sanitised. System configurations kept secure.',
          recommendation: 'Keep file assets under bounded static lookup catalogs.'
        });
      }
    }

    if (authBypassed) {
      totalAlerts++;
      items.push({
        name: 'Authentication Bypass Risk',
        severity: 'MEDIUM',
        status: 'WARNING',
        detail: 'Request still resolved successfully after credentials headers were stripped to probe Auth coverage.',
        recommendation: 'Ensure all transactional endpoints require JWT token or active authorization cookies explicitly.'
      });
    }

    if (corsInsecure) {
      totalAlerts++;
      items.push({
        name: 'Insecure CORS Policy',
        severity: 'MEDIUM',
        status: 'VULNERABLE',
        detail: 'Wildcard or dynamic origin reflection detected with credentials allowed. Third-party read execution exploit vector.',
        recommendation: 'Avoid echoing Origin back inside Access-Control-Allow-Origin when Credentials mode is enabled.'
      });
    }

    if (securityChecks.headersAuditor) {
      if (missingCsp || missingXFrame || missingXContentType) {
        let missing = [];
        if (missingCsp) missing.push('CSP');
        if (missingXFrame) missing.push('X-Frame-Options');
        if (missingXContentType) missing.push('X-Content-Type-Options');
        totalAlerts++;
        items.push({
          name: 'HTTP Security Headers Hygiene',
          severity: 'LOW',
          status: 'WARN',
          detail: `Missing critical security headers: ${missing.join(', ')}. Safe client protection is decreased.`,
          recommendation: 'Configure middleware like helmet.js to inject CSP policies, X-Frame-Options values, and X-Content-Type-Options.'
        });
      } else {
        items.push({
          name: 'HTTP Security Headers Audit',
          severity: 'PASS',
          status: 'SECURE',
          detail: 'All vital sandbox safety headers (CSP, X-Frame, X-Content-Type) were correctly present.',
          recommendation: 'Regularly audit policy scopes to avoid relaxed origins over time.'
        });
      }
    }

    return { totalAlerts, items };
  }, [results, selectedModule, securityChecks]);

  return (
    <div className="flex flex-col h-full bg-[#0B0D11] overflow-hidden text-slate-200">
      {/* HUD Header */}
      <div className="p-4 border-b border-[#1E293B] bg-[#0F1115] shrink-0 flex flex-col md:flex-row md:items-center justify-start gap-4">
        {/* Dynamic Interactive Endpoint Changer - Direct Access */}
        <div className="flex-1 max-w-2xl bg-black/50 border border-slate-800 rounded-xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-755 rounded-lg px-2.5 shrink-0 h-10">
            <span className="text-xs font-mono text-slate-400 uppercase font-black tracking-wider select-none whitespace-nowrap">METHOD:</span>
            <select
              value={config.method || 'GET'}
              onChange={(e) => onChangeConfig?.({ method: e.target.value as any })}
              className={cn(
                "bg-transparent text-sm font-black font-mono cursor-pointer outline-none border-none py-1 focus:ring-0",
                config.method === 'GET' ? "text-emerald-400" :
                config.method === 'POST' ? "text-blue-400" :
                config.method === 'DELETE' ? "text-rose-400" : "text-amber-400"
              )}
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'GRAPHQL'].map(m => (
                <option key={m} value={m} className="bg-[#0B0D11] text-white font-mono font-bold text-xs">{m}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex items-center gap-2.5 bg-slate-900 border border-slate-755 rounded-lg px-3.5 h-10">
            <span className="text-xs font-mono text-slate-400 uppercase font-black tracking-wider select-none">URL:</span>
            <input
              type="text"
              value={config.url || ''}
              onChange={(e) => onChangeConfig?.({ url: e.target.value })}
              placeholder="Enter endpoint target URL..."
              className="flex-grow bg-transparent text-xs sm:text-sm font-mono text-emerald-400 outline-none placeholder-slate-500 min-w-0"
            />
          </div>
        </div>
      </div>

      {/* Main Multi-Pane Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL 1: Left Roster Navigation */}
        <div className="w-[300px] bg-[#0A0C10] border-r border-slate-800 flex flex-col overflow-y-auto no-scrollbar shrink-0">
          <div className="p-4 bg-black/50 border-b border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Select attack profile</span>
          </div>
          <div className="p-3 space-y-2">
            {TEST_MODULES.map((module) => {
              const isActive = selectedModule === module.id;
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setSelectedModule(module.id);
                    setSelectedResult(null); 
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all flex items-start gap-3.5 group relative overflow-hidden select-none cursor-pointer",
                    isActive 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white shadow-md shadow-emerald-950/15" 
                      : "bg-transparent border-transparent text-slate-300 hover:bg-slate-900/60 hover:text-white"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded border shrink-0 transition-all",
                    isActive 
                      ? "bg-emerald-500/20 border-emerald-500/50 " + module.color
                      : "bg-black/50 border-slate-850 " + module.color
                  )}>
                    {module.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono tracking-wide truncate">{module.name}</span>
                      {isActive && <div className="w-2 h-4 bg-emerald-500 rounded-sm"></div>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans">
                      {module.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL 2: Middle Config & Execution Controls */}
        <div className="w-[380px] bg-[#0F1115] border-r border-slate-800 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
          <div className="p-4 bg-black/50 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Properties & Controls</span>
            <span className={cn("text-[9px] font-mono font-extrabold px-2 py-0.5 rounded border uppercase flex items-center gap-1", activeModule.bgColor, activeModule.color, activeModule.borderColor)}>
              {activeModule.strategy}
            </span>
          </div>

          <div className="p-5 space-y-6 flex-grow">
            
            {/* Simulation presets removed */}

            {/* Thread controls */}
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block border-b border-slate-800 pb-1.5">Concurrency Engine</span>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-extrabold flex items-center gap-1.5">
                    <Zap size={12} className="text-amber-400" /> Workers
                  </label>
                  <input 
                    type="number" 
                    value={concurrency}
                    onChange={(e) => {
                      setConcurrency(Math.max(1, parseInt(e.target.value) || 1));
                      setSelectedPresetId('');
                    }}
                    disabled={loading}
                    className="w-full bg-black border border-slate-705 hover:border-slate-500 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 font-bold outline-none transition-all shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 uppercase font-extrabold flex items-center gap-1.5">
                    <Repeat size={12} className="text-blue-400" /> Iterations
                  </label>
                  <input 
                    type="number" 
                    value={iterationsPerUser}
                    onChange={(e) => {
                      setIterationsPerUser(Math.max(1, parseInt(e.target.value) || 1));
                      setSelectedPresetId('');
                    }}
                    disabled={loading}
                    className="w-full bg-black border border-slate-705 hover:border-slate-500 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 font-bold outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between bg-black/40 p-3 border border-slate-800 rounded-lg text-xs font-mono">
                <span className="text-slate-350 font-bold">Cumulative Load:</span>
                <span className="text-emerald-400 font-black text-sm">{totalIterations} requests total</span>
              </div>
            </div>

            {/* Error Mitigation */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Settings2 size={12} className="text-violet-400" /> Error tolerance
              </label>
              <select 
                value={retries}
                onChange={(e) => {
                  setRetries(parseInt(e.target.value));
                  setSelectedPresetId('');
                }}
                disabled={loading}
                className="w-full bg-black border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 outline-none cursor-pointer appearance-none hover:border-slate-700"
              >
                <option value={0} className="bg-slate-900 text-white">NO RETRY (FAIL_FAST)</option>
                <option value={1} className="bg-slate-900 text-white">1X RETRY (RAPID_REATTEMPT)</option>
                <option value={2} className="bg-slate-900 text-white">2X RETRY (LINEAR_BACKOFF)</option>
              </select>
            </div>

            {/* Custom inputs based on module */}
            {selectedModule === 'fuzzer' && (
              <div className="p-4 bg-cyan-950/30 rounded-lg border border-cyan-500/30 space-y-3">
                <div className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Cpu size={14} /> Mutation engine parameters
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'keyDeletions', label: 'STRIP JSON PAIRS' },
                    { key: 'typeMutations', label: 'TYPE MUTATION PROBE' },
                    { key: 'bufferOverflow', label: 'INJECT STR BUFFER EXPAND' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3.5 text-xs font-mono text-slate-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={(fuzzerChecks as any)[item.key]} 
                        onChange={(e) => setFuzzerChecks({ ...fuzzerChecks, [item.key]: e.target.checked })}
                        className="w-4 h-4 accent-cyan-500 bg-black border-slate-700 rounded transition-all" 
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedModule === 'chaos' && (
              <div className="p-4 bg-rose-950/30 rounded-lg border border-rose-500/30 space-y-4">
                <div className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <Flame size={14} /> Chaos engine entropy amplitude
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span>CONNECTION LOSS JITTER</span>
                    <span className="text-rose-400 font-extrabold">{chaosAmplitude}ms</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="1500" 
                    value={chaosAmplitude}
                    onChange={(e) => setChaosAmplitude(parseInt(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer bg-black rounded-lg h-1.5"
                  />
                </div>
              </div>
            )}

            {selectedModule === 'security_audit' && (
              <div className="p-4 bg-rose-950/30 rounded-lg border border-rose-550/30 space-y-3">
                <div className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert size={14} /> Security auditor parameters
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'sqli', label: 'PROBE SQL INJECTIONS (SQLI)' },
                    { key: 'xss', label: 'PROBE CROSS-SITE SCRIPTING (XSS)' },
                    { key: 'pathTraversal', label: 'LOCAL PATH TRAVERSAL PROBE' },
                    { key: 'headersAuditor', label: 'AUDIT RESPONSE HEADERS HYGIENE' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3.5 text-xs font-mono text-slate-350 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={(securityChecks as any)[item.key]} 
                        onChange={(e) => setSecurityChecks({ ...securityChecks, [item.key]: e.target.checked })}
                        className="w-4 h-4 accent-rose-500 bg-black border-slate-700 rounded transition-all" 
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Assertions Roster */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Verification Criteria</span>
                <button
                  type="button"
                  onClick={addAssertion}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs font-mono text-emerald-450 hover:text-white flex items-center gap-1.5 border border-slate-700 bg-black hover:border-emerald-500 transition-all rounded-lg font-bold"
                >
                  <Plus size={12} /> ADD_RULE
                </button>
              </div>
              <div className="space-y-2">
                {assertions.map(item => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <select
                      value={item.type}
                      onChange={(e) => {
                        updateAssertion(item.id, { type: e.target.value });
                        setSelectedPresetId('');
                      }}
                      disabled={loading}
                      className="bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300"
                    >
                      <option value="STATUS_CODE" className="text-white bg-slate-900">STATUS ===</option>
                      <option value="LATENCY_LESS_THAN" className="text-white bg-slate-900">LATENCY &lt;</option>
                      <option value="CONTAINS_TEXT" className="text-white bg-slate-900">CONTAINS</option>
                    </select>
                    <input
                      value={item.value}
                      onChange={(e) => {
                        updateAssertion(item.id, { value: e.target.value });
                        setSelectedPresetId('');
                      }}
                      type="text"
                      disabled={loading}
                      placeholder="e.g. 200"
                      className="flex-1 min-w-0 bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-450 font-black focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        removeAssertion(item.id);
                        setSelectedPresetId('');
                      }}
                      disabled={loading || assertions.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-rose-450 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transmission previews */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Target curl strategy</span>
                <button 
                  onClick={() => setShowLabCurl(!showLabCurl)}
                  className={cn(
                    "text-xs font-mono flex items-center gap-1.5 uppercase transition-all px-2.5 py-1 rounded-lg border",
                    showLabCurl ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Terminal size={12} /> {showLabCurl ? 'HIDE CODE' : 'SHOW SHELL'}
                </button>
              </div>
              <AnimatePresence>
                {showLabCurl && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3.5 bg-black border border-slate-800 rounded-lg font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre-wrap break-all shadow-inner select-all">
                       {curlStrategy}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-4 bg-black/55 border-t border-slate-800 space-y-3 shrink-0">
            <button
              onClick={loading ? onAbort : startTest}
              disabled={!config.url}
              className={cn(
                "w-full py-4 rounded-xl text-xs sm:text-sm font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 active:scale-95 shadow-lg select-none cursor-pointer",
                loading 
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40 animate-pulse font-black" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 disabled:opacity-25 border border-emerald-500/40 font-black h-12"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> ABORT ACTIVE RUNNER
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" /> INITIATE STRESS SEQUENCE
                </>
              )}
            </button>
          </div>
        </div>

        {/* PANEL 3: Right Live Telemetry Screen */}
        <div className="flex-1 bg-[#07080A] flex flex-col overflow-hidden">
          {/* Telemetry values with clean typography and robust accessibility sizing */}
          <div className="p-5 border-b border-slate-800 bg-black/60 grid grid-cols-2 md:grid-cols-4 gap-6 select-none shadow-[inset_0_-2px_10px_rgba(0,0,0,0.5)] shrink-0">
             <div className="space-y-1.5 border-r border-slate-900 pr-4">
                <div className="text-[10px] font-black text-slate-405 uppercase tracking-wider flex items-center gap-1.5">
                   <Activity size={12} className="text-emerald-400" /> Current RPS
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono leading-none">
                   {progress ? ((progress.completed / ((Date.now() - (progress as any).startTime || 1) / 1000)).toFixed(1)) : '0.0'}
                   <span className="text-xs text-slate-500 ml-1">/sec</span>
                </div>
             </div>
             <div className="space-y-1.5 border-r border-slate-900 pr-4">
                <div className="text-[10px] font-black text-slate-405 uppercase tracking-wider flex items-center gap-1.5">
                   <Clock size={12} className="text-blue-400" /> P95 Latency
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono leading-none">
                   {results.length > 0 ? results[Math.floor(results.length * 0.95)]?.responseTime || '0' : '0'}
                   <span className="text-xs text-slate-500 ml-1">ms</span>
                </div>
             </div>
             <div className="space-y-1.5 border-r border-slate-900 pr-4">
                <div className="text-[10px] font-black text-slate-405 uppercase tracking-wider flex items-center gap-1.5">
                   <Server size={12} className="text-amber-400" /> Success Rate
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono leading-none">
                   {results.length > 0 ? Math.round((results.filter(r => r.status < 400).length / results.length) * 100) : '0'}
                   <span className="text-xs text-slate-500 ml-1">%</span>
                </div>
             </div>
             <div className="space-y-1.5">
                <div className="text-[10px] font-black text-rose-450 uppercase tracking-wider flex items-center gap-1.5">
                   <ShieldAlert size={12} className="text-rose-455" /> Errors
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-455 font-mono leading-none">
                   {results.filter(r => r.status >= 400).length}
                </div>
             </div>
          </div>

          {/* Navigation headers */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B0D11]/95 px-4 shrink-0 shadow">
             <div className="flex">
                {[
                  { id: 'logs', label: 'TELEMETRY LIVE LOGS' },
                  { id: 'curl', label: 'CURL ORCHESTRATION' },
                  { id: 'theory', label: 'THEORETICAL FRAMEWORK' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => {
                      setLabTab(tab.id as any);
                    }}
                    className={cn(
                      "px-4.5 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 font-mono outline-none focus:ring-0 select-none cursor-pointer",
                      labTab === tab.id ? "border-emerald-500 text-white font-black" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
             </div>
             {labTab === 'logs' && results.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 rounded-md hover:bg-slate-850 border border-slate-800 text-[10px] text-rose-455 font-mono font-black uppercase tracking-wider flex items-center gap-1.5 transition-all select-none cursor-pointer"
                >
                  <Trash2 size={12} className="text-rose-455 animate-pulse" /> Clear Telemetry logs
                </button>
             )}
          </div>

          {/* Active Tab Screen Area */}
          <div className="flex-1 overflow-hidden relative flex">
             <AnimatePresence mode="wait">
                {labTab === 'logs' && (
                  <div className="flex-1 flex overflow-hidden relative">
                    {/* Log list with proper text sizes for great legibility */}
                    <div className={cn("flex-grow overflow-y-auto p-5 custom-scrollbar space-y-2 bg-[#050608]/50", selectedResult ? "hidden xl:block" : "block")}>
                       
                       {/* Assessment Diagnostics complete summary panel once test is completed */}
                       {!loading && results.length > 0 && (
                         <div className="bg-gradient-to-r from-emerald-950/20 via-slate-900/40 to-slate-950/60 border border-emerald-500/30 p-5 rounded-xl mb-4 space-y-4 shadow-xl select-text">
                           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                             <div className="flex items-center gap-3">
                               <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-455 rounded-lg flex items-center justify-center">
                                 <ShieldAlert size={18} />
                               </div>
                               <div>
                                 <h3 className="text-xs font-black text-white font-mono tracking-wider uppercase leading-none">Diagnostic Completed</h3>
                                 <p className="text-[10px] text-slate-450 mt-1 uppercase font-mono font-bold">Analysis Profile for real life verification</p>
                               </div>
                             </div>
                             
                             {/* Grade rating calculation */}
                             {(() => {
                               const successPct = Math.round((results.filter(r => r.status < 400).length / results.length) * 100);
                               const avgLat = results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;
                               const failedAss = results.filter(r => getFailedAssertionsCount(r) > 0).length;
                               
                               let grade = "A+";
                               let gradeColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/5";

                               if (successPct < 80 || failedAss > results.length * 0.4) {
                                 grade = "F";
                                 gradeColor = "text-rose-450 border-rose-500/30 bg-rose-500/10 h shadow-rose-500/5";
                               } else if (avgLat > 600) {
                                 grade = "D";
                                 gradeColor = "text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/5";
                               } else if (avgLat > 300) {
                                 grade = "C";
                                 gradeColor = "text-amber-300 border-amber-500/20 bg-amber-500/5";
                               } else if (successPct < 100) {
                                 grade = "B";
                                 gradeColor = "text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-blue-500/5";
                               }
                               
                               return (
                                 <div className="flex items-center gap-4">
                                   <div className={cn("px-4 py-2 border rounded-xl text-center shadow-md font-sans", gradeColor)}>
                                     <div className="text-[9px] font-mono font-black text-slate-400 uppercase leading-none mb-0.5 whitespace-nowrap">HEALTH SCORE</div>
                                     <span className="text-xl font-black font-mono tracking-tighter leading-none">{grade}</span>
                                   </div>
                                 </div>
                               );
                             })()}
                           </div>
                           
                           {/* Quick stats grid inside report */}
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                             <div className="bg-black/40 p-2.5 border border-slate-850 rounded-lg">
                               <span className="text-[10px] font-mono text-slate-400 font-bold block mb-0.5 uppercase">AVERAGE LATENCY</span>
                               <span className="text-sm font-black font-mono text-white">
                                 {(results.reduce((acc, r) => acc + r.responseTime, 0) / results.length || 0).toFixed(0)}ms
                               </span>
                             </div>
                             <div className="bg-black/40 p-2.5 border border-slate-850 rounded-lg">
                               <span className="text-[10px] font-mono text-slate-400 font-bold block mb-0.5 uppercase">VERIFICATION PASSED</span>
                               <span className={cn("text-xs font-black font-mono", results.every(r => getFailedAssertionsCount(r) === 0) ? "text-emerald-400" : "text-amber-400")}>
                                 {results.filter(r => getFailedAssertionsCount(r) === 0).length} / {results.length} PASSED
                               </span>
                             </div>
                             <div className="bg-black/40 p-2.5 border border-slate-850 rounded-lg">
                               <span className="text-[10px] font-mono text-slate-400 font-bold block mb-0.5 uppercase">90TH PERCENTILE</span>
                               <span className="text-sm font-black font-mono text-white">{percentiles.p90}ms</span>
                             </div>
                             <div className="bg-black/40 p-2.5 border border-slate-850 rounded-lg">
                               <span className="text-[10px] font-mono text-slate-400 font-bold block mb-0.5 uppercase">99TH PERCENTILE</span>
                               <span className="text-sm font-black font-mono text-white">{percentiles.p99}ms</span>
                             </div>
                           </div>


                         </div>
                       )}

                       {/* Custom QA Security Audit Report Panel */}
                       {!loading && securityAudit && (
                         <div className="bg-slate-900/80 border border-rose-500/20 p-5 rounded-xl mb-4 space-y-4 shadow-xl select-text">
                           <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                             <div className="flex items-center gap-3">
                               <div className={cn(
                                 "p-2 rounded-lg flex items-center justify-center font-black text-[10px] border font-mono select-none leading-none",
                                 securityAudit.totalAlerts > 0 
                                   ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
                                   : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                )}>
                                 {securityAudit.totalAlerts > 0 ? "VULNERABLE" : "SECURE PASS"}
                               </div>
                               <div>
                                 <h3 className="text-xs font-black text-white font-mono tracking-wider uppercase leading-none">Vulnerability Compliance Report</h3>
                                 <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono font-bold leading-none">API Security assessment diagnostic</p>
                               </div>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-mono text-slate-500 font-bold uppercase leading-none">ALERTS FOUND:</span>
                               <span className={cn(
                                 "px-2 py-0.5 rounded font-mono font-black border text-xs leading-none",
                                 securityAudit.totalAlerts > 0 ? "bg-rose-500/10 border-rose-500/30 text-rose-455" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                )}>
                                 {securityAudit.totalAlerts}
                                </span>
                             </div>
                           </div>

                           <div className="space-y-3">
                             {securityAudit.items.map((item, idx) => {
                               const isPass = item.severity === 'PASS';
                               return (
                                 <div key={idx} className={cn(
                                   "p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors",
                                   isPass 
                                     ? "bg-[#090D14]/40 border-slate-850" 
                                     : item.severity === 'CRITICAL' 
                                       ? "bg-rose-950/20 border-rose-500/20" 
                                       : item.severity === 'HIGH'
                                         ? "bg-rose-950/15 border-rose-500/15"
                                         : "bg-amber-950/10 border-amber-500/15"
                                 )}>
                                   <div className="space-y-1.5 flex-1 select-text">
                                     <div className="flex items-center gap-2.5 h-4">
                                       <span className={cn(
                                         "text-[8px] font-extrabold font-mono px-1.5 py-0.5 rounded uppercase leading-none tracking-wider",
                                         isPass 
                                           ? "bg-emerald-500/10 text-emerald-550 border border-emerald-500/20" 
                                           : item.severity === 'CRITICAL' 
                                             ? "bg-rose-550 text-black leading-none py-0.5" 
                                             : item.severity === 'HIGH'
                                               ? "bg-rose-500/15 text-rose-550 border border-rose-500/25 leading-none"
                                               : "bg-amber-500/10 text-amber-550 border border-amber-500/25 leading-none"
                                       )}>
                                         {item.severity}
                                       </span>
                                       <span className="text-xs font-black text-slate-200 font-mono tracking-wide leading-none">{item.name}</span>
                                     </div>
                                     <p className="text-xs text-slate-350 leading-relaxed font-sans mt-1">{item.detail}</p>
                                     {!isPass && (
                                       <div className="text-[11px] text-slate-400 font-sans border-t border-slate-800/80 pt-1.5 mt-1.5 flex items-start gap-1 font-bold">
                                         <span className="font-mono font-black text-rose-455 uppercase tracking-tighter shrink-0 text-[10px] [word-spacing:-3px] leading-none">REMEDIATION :</span>
                                         <span className="leading-relaxed -mt-0.5">{item.recommendation}</span>
                                       </div>
                                     )}
                                   </div>
                                   <div className={cn(
                                     "text-[10px] font-mono font-black tracking-wider uppercase px-2.5 py-1 rounded-md shrink-0 border select-none self-start sm:self-auto text-center font-bold",
                                     isPass 
                                       ? "bg-emerald-950/10 border-emerald-500/15 text-emerald-500" 
                                       : "bg-rose-950/20 border-rose-500/25 text-rose-400"
                                   )}>
                                     {item.status}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       )}

                       {/* Latency Distribution Graph always available above logs */}
                       {results.length > 0 && (
                         <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl mb-4 space-y-4">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <BarChart4 size={14} className="text-emerald-400" />
                               <span className="text-xs font-black tracking-wider text-slate-300 font-mono uppercase">Telemetry Response Latency Distribution</span>
                             </div>
                             <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">In-Transit Allocation</span>
                           </div>

                           <div className="grid grid-cols-4 gap-2 text-center select-none">
                             {[
                               { label: 'FAST', limit: '<150ms', color: 'bg-emerald-500 shadow-emerald-550/15', ...latencyCategories.fast },
                               { label: 'NOMINAL', limit: '150-450ms', color: 'bg-blue-500 shadow-blue-550/15', ...latencyCategories.acceptable },
                               { label: 'SLOW', limit: '450-1000ms', color: 'bg-amber-500 shadow-amber-550/15', ...latencyCategories.slow },
                               { label: 'LAGGING', limit: '>1000ms', color: 'bg-rose-500 shadow-rose-550/15', ...latencyCategories.lagging }
                             ].map((cat) => (
                               <div key={cat.label} className="bg-black/50 p-2 border border-slate-850/80 rounded-lg flex flex-col justify-between">
                                 <div>
                                   <div className="text-[10px] font-mono text-slate-300 uppercase font-black">{cat.label}</div>
                                   <div className="text-[9px] font-mono text-slate-500 font-semibold">{cat.limit}</div>
                                 </div>
                                 <div className="my-2.5 flex items-end justify-center h-12 bg-slate-950/40 rounded-md p-1 border border-slate-900/50">
                                   <div 
                                     style={{ height: `${Math.max(4, cat.pct)}%` }}
                                     className={cn("w-full max-w-[16px] rounded-sm transition-all duration-300 shadow", cat.color)}
                                   />
                                 </div>
                                 <div>
                                   <div className="text-sm font-black font-mono text-white">{cat.count}</div>
                                   <div className="text-[10px] font-mono text-slate-400 font-extrabold bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 mt-1">{cat.pct}%</div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       {results.length === 0 && !loading && (
                         <div className="h-full flex flex-col items-center justify-center p-20 opacity-40 text-center space-y-4">
                           <div className="w-16 h-16 border border-slate-700 border-dashed rounded-full flex items-center justify-center animate-spin-slow">
                              <Activity size={24} className="text-emerald-400" />
                           </div>
                           <div className="uppercase tracking-widest font-mono text-xs text-white font-black">Standby Stream Init</div>
                           <p className="text-xs text-slate-350 max-w-sm leading-relaxed font-sans">
                             Press <span className="font-bold text-emerald-400">"INITIATE STRESS SEQUENCE"</span> or click on a Preset to dispatch mock concurrent workflows and verify endpoints.
                           </p>
                         </div>
                       )}

                       {[...results].reverse().map((res, i) => {
                         const currentIdx = (progress?.completed ?? results.length) - i;
                         const isSelected = selectedResult?.id === res.id;
                         const fails = getFailedAssertionsCount(res);
                         const passedAll = fails === 0;
                         return (
                           <div 
                             key={res.id} 
                             onClick={() => setSelectedResult(res)}
                             className={cn(
                               "group flex border-l-4 py-3 pl-4 pr-3.5 rounded-lg transition-all cursor-pointer items-center min-h-[44px] select-none text-xs font-mono mb-1.5",
                               isSelected 
                                 ? "bg-slate-800 text-white border-emerald-500 shadow-md" 
                                 : passedAll 
                                   ? "border-slate-850 hover:border-emerald-500/70 hover:bg-[#10b981]/10 bg-black/20"
                                   : "border-rose-950 hover:border-rose-500/70 hover:bg-rose-500/5 bg-rose-950/10"
                             )}
                           >
                             <span className="text-slate-400 w-20 shrink-0 font-bold group-hover:text-amber-400 transition-colors">➔ {res.responseTime}ms</span>
                             <span className={cn("w-14 font-black", res.status < 300 ? "text-emerald-400" : "text-rose-400")}>
                               [{res.status}]
                             </span>
                             <span className="text-slate-200 flex-1 truncate uppercase tracking-tight group-hover:text-white transition-colors">
                               <span className="text-slate-500 opacity-90 mr-2 font-bold">#{currentIdx}</span>
                               {selectedModule === 'fuzzer' && <span className="text-cyan-400 font-extrabold mr-1.5">[MUTATED]</span>}
                               {selectedModule === 'replay' && <span className="text-blue-400 font-extrabold mr-1.5">[CLONED]</span>}
                               {selectedModule === 'chaos' && <span className="text-rose-455 font-extrabold mr-1.5">[CORRUPTED]</span>}
                               {activeModule.name}
                             </span>
                             <div className="flex items-center shrink-0 ml-2">
                               {passedAll ? (
                                 <span className="text-[10px] font-black text-emerald-400 uppercase font-mono bg-emerald-500/15 px-2.5 py-0.5 rounded border border-emerald-500/30">
                                   ✓ PASS
                                 </span>
                               ) : (
                                 <span className="text-[10px] font-black text-rose-400 uppercase font-mono bg-rose-500/15 px-2.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                                   ✗ FAIL ({fails})
                                 </span>
                               )}
                             </div>
                           </div>
                         );
                       })}
                    </div>

                    {/* Side-by-Side inline description details */}
                    {selectedResult && (
                      <div className="w-full xl:w-[420px] border-l border-slate-800 bg-[#0F1115] flex flex-col overflow-hidden shrink-0 shadow-2xl relative z-10 animate-in fade-in slide-in-from-right-5 duration-150">
                        <div className="p-4 bg-black flex items-center justify-between border-b border-slate-800">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-mono font-black px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">LOG DETAIL</span>
                             <span className="text-xs font-mono text-slate-400">#{selectedResult.id.slice(0, 8)}</span>
                          </div>
                          <button 
                            onClick={() => setSelectedResult(null)}
                            className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 font-mono text-xs text-slate-200 space-y-5">
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                                <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1 font-bold">Status Code</div>
                                <div className={cn("text-lg font-black", selectedResult.status < 300 ? "text-emerald-400" : "text-rose-400")}>
                                  {selectedResult.status}
                                </div>
                             </div>
                             <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                                <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1 font-bold">Latency</div>
                                <div className="text-lg font-black text-blue-400">{selectedResult.responseTime}ms</div>
                             </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-slate-350 text-xs uppercase tracking-wider font-extrabold block border-b border-slate-800 pb-1.5">Verification Asserts</span>
                            <div className="bg-black/45 p-3 rounded-lg border border-slate-800 space-y-2">
                              {assertions.map(a => {
                                const ok = checkAssertion(selectedResult, a);
                                return (
                                  <div key={a.id} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">{a.type} ({a.value})</span>
                                    {ok ? (
                                      <span className="text-emerald-400 font-black flex items-center gap-1">✓ PASSED</span>
                                    ) : (
                                      <span className="text-rose-450 font-black flex items-center gap-1">✗ FAILED</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-slate-350 text-xs uppercase tracking-wider font-extrabold block border-b border-slate-800 pb-1.5">Response Headers</span>
                            <div className="bg-black p-3.5 rounded-lg border border-slate-800 space-y-2 h-40 overflow-y-auto text-xs text-slate-300 custom-scrollbar select-text">
                              {Object.entries(selectedResult.headers).map(([k, v]) => (
                                <div key={k} className="flex flex-col gap-0.5 border-b border-slate-900 pb-1.5">
                                  <span className="text-blue-400 font-extrabold uppercase text-[10px]">{k}:</span>
                                  <span className="text-slate-200 break-all pl-1 select-all">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 flex-grow">
                            <span className="text-slate-350 text-xs uppercase tracking-wider font-extrabold block border-b border-slate-800 pb-1.5">Response Payload</span>
                            <pre className="bg-black p-3.5 rounded-lg border border-slate-800 text-xs text-emerald-450/90 whitespace-pre-wrap overflow-x-hidden min-h-[140px] max-h-72 overflow-y-auto custom-scrollbar select-all">
                              {selectedResult.body || 'Empty Payload.'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {labTab === 'curl' && (
                  <motion.div 
                    key="curlTab"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar bg-black"
                  >
                     <div className="max-w-2xl space-y-6">
                        <div className="space-y-2 select-text">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <Globe size={15} className="text-blue-400" /> Endpoint HTTP curl snippet
                              </span>
                              <button 
                                onClick={() => copyToClipboard(`curl -X ${config.method} "${config.url || 'http://localhost:3000/api'}"`)}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                              >
                                <Copy size={15} />
                              </button>
                           </div>
                           <pre className="bg-[#0F1115] p-3.5 rounded-lg border border-slate-800 text-xs font-mono text-blue-350 break-all whitespace-pre-wrap leading-relaxed select-all">
                              {`curl -X ${config.method} "${config.url || 'http://localhost:3000/api'}" \\\n  ${Object.entries(config.headers || {}).map(([k, v]) => `-H "${k}: ${v}"`).join(' \\\n  ')}${config.body ? ` \\\n  -d '${config.body}'` : ''}`}
                           </pre>
                        </div>

                        <div className="space-y-2 select-text">
                           <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <Code2 size={15} className="text-emerald-400" /> Orchestrated bash script template
                              </span>
                              <button 
                                onClick={() => copyToClipboard(curlStrategy)}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                              >
                                <Copy size={15} />
                              </button>
                           </div>
                           <pre className="bg-[#0F1115] p-4 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto custom-scrollbar leading-relaxed">
                              {curlStrategy}
                           </pre>
                           <p className="text-xs text-slate-400 font-mono uppercase italic leading-normal">
                              Note: This script initializes concurrent worker nodes to match the backend runner sequence.
                           </p>
                        </div>
                     </div>
                  </motion.div>
                )}

                {labTab === 'theory' && (() => {
                  const framework = THEORETICAL_FRAMEWORKS[activeModule.id] || {
                    problem: "System components must withstand unexpected volumes or structural requests. Under high pressure, system boundary limits leak raw thread failures or state corruption.",
                    solution: "Systematically stress endpoints under isolated test protocols to measure threshold boundaries prior to production exposure.",
                    realLifeExample: "Normal production spikes triggering unexpected service failures due to lack of pre-production validation.",
                    staffEngineeringDepth: "Implement strict timeout margins, secure error handling routines, and dynamic query bounds on all mutable actions."
                  };

                  return (
                    <motion.div 
                      key="theoryTab"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute inset-0 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-[#07090C] select-text"
                    >
                       <div className="max-w-4xl mx-auto space-y-6">
                          
                          {/* Section Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border",
                                activeModule.id === 'security_audit' || activeModule.id === 'chaos'
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-455"
                                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-450"
                              )}>
                                {activeModule.icon}
                              </div>
                              <div>
                                <h2 className="text-sm font-black text-white font-mono tracking-wider uppercase leading-none">{activeModule.name}</h2>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono font-bold leading-none">Theoretical Attack & Safety Framework</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-black border border-slate-800 px-2 py-1 bg-black rounded text-slate-400 uppercase tracking-widest">
                                {activeModule.strategy}
                              </span>
                            </div>
                          </div>

                          {/* Quick Summary Banner */}
                          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-850/60 leading-relaxed font-sans text-xs md:text-sm text-slate-300">
                            <span className="font-mono text-emerald-400 font-black mr-2 uppercase tracking-wide">CORE PARADIGM:</span>
                            {activeModule.theory}
                          </div>

                          {/* 2x2 Grid for Problem/Solution and Real-World Examples */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            
                            {/* Card 1: The Problem (Vulnerability) */}
                            <div className="bg-[#090D14] border border-rose-950/35 rounded-xl p-5 hover:border-rose-900/30 transition-colors flex flex-col justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-rose-400">
                                  <AlertTriangle size={15} />
                                  <span className="text-xs font-black font-mono uppercase tracking-widest">The Production Underworld (The Problem)</span>
                                </div>
                                <p className="text-xs text-slate-350 leading-relaxed font-sans select-text">
                                  {framework.problem}
                                </p>
                              </div>
                              <div className="mt-4 pt-3 border-t border-slate-900/50 flex justify-between items-center text-[10px] text-rose-500/80 font-mono font-bold">
                                <span>THREAT SIGNATURE: CRITICAL EXCESS</span>
                                <span>STATUS: DANGER</span>
                              </div>
                            </div>

                            {/* Card 2: The Solution (Mitigation) */}
                            <div className="bg-[#090D14] border border-emerald-950/35 rounded-xl p-5 hover:border-emerald-900/30 transition-colors flex flex-col justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-emerald-400">
                                  <Beaker size={15} />
                                  <span className="text-xs font-black font-mono uppercase tracking-widest">Engineering Mitigation (The Solution)</span>
                                </div>
                                <p className="text-xs text-slate-350 leading-relaxed font-sans select-text">
                                  {framework.solution}
                                </p>
                              </div>
                              <div className="mt-4 pt-3 border-t border-slate-900/50 flex justify-between items-center text-[10px] text-emerald-500/80 font-mono font-bold">
                                <span>MITIGATION SEQUENCE: SHIELD-INIT</span>
                                <span>STATUS: DEPLOYED</span>
                              </div>
                            </div>

                          </div>

                          {/* Real World Production Incident Case Study */}
                          <div className="bg-[#0F1217]/50 border border-slate-850/80 rounded-xl p-5 space-y-3 select-text">
                            <div className="flex items-center gap-2 text-blue-400 border-b border-slate-800/50 pb-2">
                              <Terminal size={14} />
                              <span className="text-xs font-black font-mono uppercase tracking-widest">Real-World Incident Analysis</span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-white leading-relaxed font-sans font-bold">
                                Production Impact Scenario:
                              </p>
                              <p className="text-xs text-slate-350 leading-relaxed font-sans italic border-l-2 border-slate-700 pl-3">
                                "{framework.realLifeExample}"
                              </p>
                            </div>
                          </div>

                          {/* Staff-Level Architecture Guide */}
                          <div className="bg-gradient-to-r from-emerald-990/10 to-transparent border border-emerald-500/20 rounded-xl p-5 space-y-3.5 shadow-lg select-text">
                            <div className="flex items-center gap-2.5 text-emerald-400">
                              <Layout size={15} />
                              <span className="text-xs font-black font-mono uppercase tracking-widest">Architectural Guardrails (Staff Engineering Depth)</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans font-bold">
                              How to scale protection cleanly:
                            </p>
                            <p className="text-xs text-slate-350 leading-relaxed font-sans font-medium">
                              {framework.staffEngineeringDepth}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-500/10 text-[10px] font-mono text-slate-400">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span>Zero-Trust validation checkpoints</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span>Auto-remediation telemetry patterns</span>
                              </div>
                            </div>
                          </div>

                       </div>
                    </motion.div>
                  );
                })()}
             </AnimatePresence>
          </div>

          {/* Progress gauge area */}
          {progress && (
            <div className="bg-[#0F1115] border-t border-slate-800 p-5 space-y-3 shrink-0 select-none">
               <div className="flex justify-between text-xs font-black uppercase font-mono tracking-wider relative">
                  <span className="text-emerald-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    STRESS RUNNING ACTIVE_PROBE
                  </span>
                  <span className="text-white">
                     {progress.completed} <span className="text-slate-500">/</span> {progress.total} Completed
                  </span>
               </div>
               <div className="h-2 bg-slate-950 rounded-full overflow-hidden p-[1px] border border-slate-800">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    transition={{ type: 'spring', damping: 25, stiffness: 45 }}
                  />
               </div>
               <div className="flex gap-4 text-xs font-mono font-bold">
                 <div className="flex-1 bg-black/50 rounded-lg p-2.5 border border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-450 uppercase tracking-wider mb-1 font-bold">RPS RATE</span>
                    <span className="text-emerald-400 text-sm font-black">{((progress.completed / ((Date.now() - (progress as any).startTime || 1) / 1000)).toFixed(1))}</span>
                 </div>
                 <div className="flex-1 bg-black/50 rounded-lg p-2.5 border border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-450 uppercase tracking-wider mb-1 font-bold">EST TIME DUE</span>
                    <span className="text-blue-400 text-sm font-black">~{Math.max(0, Math.round((progress.total - progress.completed) / ( (progress.completed || 1) / ((Date.now() - (progress as any).startTime || 1) / 1000) )))}s</span>
                 </div>
                 <div className="flex-1 bg-black/50 rounded-lg p-2.5 border border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-450 uppercase tracking-wider mb-1 font-bold">P95 LATENCY</span>
                    <span className="text-amber-400 text-sm font-black">{results.length > 0 ? results[Math.floor(results.length * 0.95)]?.responseTime || '0' : '0'}ms</span>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
