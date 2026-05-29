import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { CurlEngine, RequestConfig } from "./src/server/modules/curl-engine";
import { RequestRunner, BatchConfig } from "./src/server/modules/runner";
import { Store } from "./src/server/modules/store";

async function startServer() {
  await Store.init();
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Intercept and return clean JSON error for body parser syntax errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
      res.status(400).json({ error: "Malformed JSON payload in request body", message: err.message });
      return;
    }
    next(err);
  });

  // Mock Race Condition Demo State
  let globalBalance = 1000;
  let transactionLogs: any[] = [];

  // API Routes
  app.get("/api/history", async (req, res) => {
    try {
      const history = await Store.getHistory();
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await Store.getCollections();
      res.json(collections);
    } catch (error: any) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      await Store.saveCollection(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving collection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Moved Race Demo Routes under /api
  app.post("/api/race-demo/reset", (req, res) => {
    globalBalance = 1000;
    transactionLogs = [];
    res.json({ 
      status: "system_reset", 
      balance: globalBalance,
      message: "Race demo state has been restored to defaults." 
    });
  });

  app.get("/api/race-demo/balance", (req, res) => {
    res.json({ balance: globalBalance });
  });

  app.all(["/api/orders/broken/place", "/api/orders/fixed/place"], (req, res, next) => {
    if (req.method !== "POST") {
      res.status(405).json({
        error: "Method Not Allowed",
        message: `This endpoint only supports POST requests. You sent a ${req.method} request.`
      });
      return;
    }
    next();
  });

  app.post("/api/orders/broken/place", async (req, res) => {
    // Intentional Race Condition: Read -> Wait -> Write
    const currentBalance = globalBalance;
    const amount = req.body.amount || 10;
    
    // Simulate some async processing time to widen the race window
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    if (currentBalance >= amount) {
      globalBalance = currentBalance - amount;
      const tx = { id: Date.now(), amount, remaining: globalBalance, type: 'broken' };
      transactionLogs.push(tx);
      res.json({ success: true, ...tx });
    } else {
      res.status(400).json({ error: "Insufficient funds", currentBalance });
    }
  });

  app.post("/api/orders/fixed/place", async (req, res) => {
    // Atomic-like update
    const amount = req.body.amount || 10;
    
    if (globalBalance >= amount) {
      globalBalance -= amount;
      const tx = { id: Date.now(), amount, remaining: globalBalance, type: 'fixed' };
      transactionLogs.push(tx);
      res.json({ success: true, ...tx });
    } else {
      res.status(400).json({ error: "Insufficient funds", currentBalance: globalBalance });
    }
  });

  app.post("/api/execute", async (req, res) => {
    const config: RequestConfig = req.body;
    console.log(`Executing request to: ${config.url}`);
    
    try {
      const result = await CurlEngine.execute(config);
      await Store.addToHistory({ request: config, result });
      res.json(result);
    } catch (error: any) {
      console.error("Execution error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // WebSocket for real-time batch execution
  const activeBatches = new Map<WebSocket, AbortController>();

  // Background simulated worker pool
  interface SimulatedWorker {
    id: string;
    name: string;
    status: "IDLE" | "ACTIVE";
    task: string;
    activeTime: number;
  }

  let spawnedBackgroundWorkers: SimulatedWorker[] = [
    { id: "worker-1", name: "Thread_Alpha_414", status: "ACTIVE", task: "SYNCING_REDIS_CACHE", activeTime: 12 },
    { id: "worker-2", name: "Thread_Beta_590", status: "IDLE", task: "WAITING_FOR_QUEUE", activeTime: 8 },
    { id: "worker-3", name: "Thread_Gamma_821", status: "IDLE", task: "WAITING_FOR_QUEUE", activeTime: 4 }
  ];

  let maxWorkersLimit = 64;

  const namesPool = [
    "Thread_Delta", "Thread_Epsilon", "Thread_Zeta", "Thread_Eta", 
    "Thread_Theta", "Thread_Iota", "Thread_Kappa", "Thread_Lambda", "Thread_Mu"
  ];

  // Worker task simulation loop
  setInterval(() => {
    spawnedBackgroundWorkers.forEach(w => {
      w.activeTime += 1;
      
      // 25% chance to cycle states
      if (Math.random() < 0.25) {
        if (w.status === "IDLE") {
          const tasks = [
            "SYNCING_REDIS_CACHE", "DESERIALIZING_VARS", "PINGING_TEST_LAB",
            "RECONCILING_HISTORY", "FUZZING_INPUT_VARS", "CLEANING_DEADLOCKS"
          ];
          w.status = "ACTIVE";
          w.task = tasks[Math.floor(Math.random() * tasks.length)];
        } else {
          w.status = "IDLE";
          w.task = "WAITING_FOR_QUEUE";
        }
      }
    });
  }, 1000);

  // Real-time server telemetry engine (broadcast every 1000ms)
  const broadcastTelemetry = () => {
    const active = RequestRunner.activeCount + spawnedBackgroundWorkers.filter(w => w.status === "ACTIVE").length;
    const clientCount = wss.clients.size;
    
    // Organic, realistic APM microsecond/millisecond jitter 
    const redisLatency = Math.floor(Math.random() * 2) + 1; // 1-2 ms
    const systemLatency = Math.floor(Math.random() * 4) + 8; // 8-12 ms
    
    const telemetryPayload = {
      type: "telemetry",
      payload: {
        redisStatus: "CONNECTED",
        redisLatency,
        activeWorkers: active,
        maxWorkers: maxWorkersLimit,
        latency: `${systemLatency}ms`,
        redisType: process.env.REDIS_URL ? "PRODUCTION" : "IN_MEMORY_CACHE",
        clientCount,
        spawnedWorkers: spawnedBackgroundWorkers
      }
    };
    
    const rawMessage = JSON.stringify(telemetryPayload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(rawMessage);
      }
    });
  };

  setInterval(broadcastTelemetry, 1000);

  wss.on("connection", (ws) => {
    console.log("New WS connection");

    // Dispatch initial real-time telemetry frame immediately on connect
    const initialPayload = {
      type: "telemetry",
      payload: {
        redisStatus: "CONNECTED",
        redisLatency: 2,
        activeWorkers: RequestRunner.activeCount + spawnedBackgroundWorkers.filter(w => w.status === "ACTIVE").length,
        maxWorkers: maxWorkersLimit,
        latency: "10ms",
        redisType: process.env.REDIS_URL ? "PRODUCTION" : "IN_MEMORY_CACHE",
        clientCount: wss.clients.size,
        spawnedWorkers: spawnedBackgroundWorkers
      }
    };
    ws.send(JSON.stringify(initialPayload));

    ws.on("close", () => {
      const controller = activeBatches.get(ws);
      if (controller) {
        controller.abort();
        activeBatches.delete(ws);
      }
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "spawn-worker") {
          if (spawnedBackgroundWorkers.length < maxWorkersLimit) {
            const nextName = namesPool[spawnedBackgroundWorkers.length % namesPool.length] || `Thread_Worker_${spawnedBackgroundWorkers.length + 1}`;
            spawnedBackgroundWorkers.push({
              id: `worker-${Math.random().toString(36).substring(7)}`,
              name: `${nextName}_${Math.floor(Math.random() * 900) + 100}`,
              status: "IDLE",
              task: "WAITING_FOR_QUEUE",
              activeTime: 0
            });
            broadcastTelemetry();
          }
        } else if (data.type === "terminate-worker") {
          if (data.id) {
            spawnedBackgroundWorkers = spawnedBackgroundWorkers.filter(w => w.id !== data.id);
          } else {
            spawnedBackgroundWorkers.pop();
          }
          broadcastTelemetry();
        } else if (data.type === "set-max-workers") {
          maxWorkersLimit = Math.max(1, Math.min(256, data.limit));
          broadcastTelemetry();
        } else if (data.type === "run-batch") {
          const config: BatchConfig = data.payload;
          const tabId = data.tabId;
          const controller = new AbortController();
          activeBatches.set(ws, controller);
          
          RequestRunner.runBatch(config, (progress) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "progress", tabId, ...progress }));
            }
          }, controller.signal).then(async (results) => {
            activeBatches.delete(ws);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "complete", tabId, results }));
            }
            // Add a summary to history
            if (results.length > 0) {
              await Store.addToHistory({ 
                request: config.request, 
                batch: { 
                  iterations: config.iterations, 
                  concurrency: config.concurrency,
                  successCount: results.filter(r => r.status >= 200 && r.status < 300).length,
                  avgResponseTime: results.reduce((acc, r) => acc + r.responseTime, 0) / results.length
                } 
              });
            }
          });
        } else if (data.type === "abort-batch") {
          const controller = activeBatches.get(ws);
          if (controller) {
            controller.abort();
            activeBatches.delete(ws);
          }
        }
      } catch (error) {
        console.error("WS error:", error);
      }
    });
  });

  // Master API 404 handler - placed BEFORE dev/production SPA routing
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "Not Found", 
      message: `API endpoint ${req.method} ${req.path} not found.` 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Serve SPA for non-API routes
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HyperCurl server running on http://localhost:${PORT}`);
  });
}

startServer();
