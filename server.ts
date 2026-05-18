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
  const PORT = 3000;

  app.use(express.json());

  // Mock Race Condition Demo State
  let globalBalance = 1000;
  let transactionLogs: any[] = [];

  // Race Demo Routes
  app.post("/race-demo/reset", (req, res) => {
    globalBalance = 1000;
    transactionLogs = [];
    res.json({ 
      status: "system_reset", 
      balance: globalBalance,
      message: "Race demo state has been restored to defaults." 
    });
  });

  app.get("/race-demo/balance", (req, res) => {
    res.json({ balance: globalBalance });
  });

  app.post("/orders/broken/place", async (req, res) => {
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

  app.post("/orders/fixed/place", async (req, res) => {
    // Atomic-like update (JS is single threaded, so simple assignment is atomic,
    // but in a real DB we'd use a transaction. Here we just don't capture the balance early).
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

  // API Routes
  app.get("/api/history", async (req, res) => {
    const history = await Store.getHistory();
    res.json(history);
  });

  app.get("/api/collections", async (req, res) => {
    const collections = await Store.getCollections();
    res.json(collections);
  });

  app.post("/api/collections", async (req, res) => {
    await Store.saveCollection(req.body);
    res.json({ success: true });
  });

  app.post("/api/execute", async (req, res) => {
    const config: RequestConfig = req.body;
    
    try {
      const result = await CurlEngine.execute(config);
      await Store.addToHistory({ request: config, result });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket for real-time batch execution
  const activeBatches = new Map<WebSocket, AbortController>();

  wss.on("connection", (ws) => {
    console.log("New WS connection");

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
        
        if (data.type === "run-batch") {
          const config: BatchConfig = data.payload;
          const controller = new AbortController();
          activeBatches.set(ws, controller);
          
          RequestRunner.runBatch(config, (progress) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "progress", ...progress }));
            }
          }, controller.signal).then(async (results) => {
            activeBatches.delete(ws);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "complete", results }));
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HyperCurl server running on http://localhost:${PORT}`);
  });
}

startServer();
