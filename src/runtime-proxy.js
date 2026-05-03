"use strict";

const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { fork } = require("child_process");

const PUBLIC_HOST = String(process.env.HR_PROXY_HOST || "").trim();
const PUBLIC_PORT = normalizePort(process.env.PORT, 3000);
const CHILD_HOST = "127.0.0.1";
const CHILD_PORTS = String(process.env.HR_CHILD_PORTS || "3001,3002")
  .split(",")
  .map((value) => normalizePort(value, 0))
  .filter((port) => port > 0);
const LIVE_DIR = path.resolve(process.env.HR_LIVE_DIR || path.join(__dirname, ".."));
const RELEASE_STATE_PATH = path.resolve(
  process.env.HR_RELEASE_STATE_PATH || path.join(LIVE_DIR, ".runtime-release.json")
);
const CHILD_READY_TIMEOUT_MS = normalizePositiveNumber(process.env.HR_CHILD_READY_TIMEOUT_MS, 45000);
const CHILD_SHUTDOWN_TIMEOUT_MS = normalizePositiveNumber(
  process.env.HR_CHILD_SHUTDOWN_TIMEOUT_MS,
  10000
);
const PROXY_REQUEST_TIMEOUT_MS = normalizePositiveNumber(
  process.env.HR_PROXY_REQUEST_TIMEOUT_MS,
  120000
);

if (CHILD_PORTS.length < 2) {
  throw new Error("HR_CHILD_PORTS must contain at least two ports");
}

let activeTarget = null;
let pendingReplacement = Promise.resolve();
let replacementRunning = false;
let shuttingDown = false;
let restartTimer = null;
let lastError = "";

function normalizePort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readReleaseState() {
  try {
    const payload = JSON.parse(fs.readFileSync(RELEASE_STATE_PATH, "utf8"));
    const releaseDir = path.resolve(String(payload.releaseDir || LIVE_DIR));
    const releaseId = String(payload.releaseId || process.env.HR_RELEASE_ID || "local").trim();
    return {
      releaseDir,
      releaseId: releaseId || "local"
    };
  } catch (_error) {
    return {
      releaseDir: LIVE_DIR,
      releaseId: String(process.env.HR_RELEASE_ID || "local").trim() || "local"
    };
  }
}

function selectChildPort() {
  if (!activeTarget) {
    return CHILD_PORTS[0];
  }

  return CHILD_PORTS.find((port) => port !== activeTarget.port) || CHILD_PORTS[0];
}

function isChildAlive(target) {
  return Boolean(target?.child && target.child.exitCode === null && !target.child.killed);
}

function waitForChildReady(child, port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Child on port ${port} did not become ready in time`));
    }, CHILD_READY_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
      child.off("error", onError);
    }

    function onMessage(message) {
      if (message?.type === "ready" && Number(message.port) === port) {
        cleanup();
        resolve();
      }
    }

    function onExit(code, signal) {
      cleanup();
      reject(new Error(`Child exited before ready (code=${code ?? "null"}, signal=${signal ?? "null"})`));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    child.on("message", onMessage);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

function checkChildHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: CHILD_HOST,
        port,
        path: "/healthz",
        timeout: 5000
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Child health returned ${response.statusCode}`));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Child health timed out"));
    });
    request.on("error", reject);
  });
}

async function launchChild(releaseState, port) {
  const scriptPath = path.join(releaseState.releaseDir, "src", "index.js");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`App entry not found: ${scriptPath}`);
  }

  const child = fork(scriptPath, [], {
    cwd: releaseState.releaseDir,
    env: {
      ...process.env,
      PORT: String(port),
      HR_MANAGED_CHILD: "1",
      HR_RELEASE_ID: releaseState.releaseId
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"]
  });

  const target = {
    child,
    port,
    releaseId: releaseState.releaseId,
    releaseDir: releaseState.releaseDir,
    startedAt: new Date().toISOString()
  };

  child.on("exit", (code, signal) => {
    if (activeTarget?.child !== child || shuttingDown) {
      return;
    }

    activeTarget = null;
    lastError = `Active child exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
    scheduleRecovery();
  });

  await waitForChildReady(child, port);
  await checkChildHealth(port);
  return target;
}

function stopChild(target) {
  if (!isChildAlive(target)) {
    return;
  }

  target.child.kill("SIGINT");
  const timer = setTimeout(() => {
    if (isChildAlive(target)) {
      target.child.kill("SIGKILL");
    }
  }, CHILD_SHUTDOWN_TIMEOUT_MS);
  timer.unref();
}

async function replaceActiveChild(reason) {
  if (shuttingDown) {
    return;
  }

  const releaseState = readReleaseState();
  if (
    activeTarget &&
    activeTarget.releaseId === releaseState.releaseId &&
    path.resolve(activeTarget.releaseDir) === path.resolve(releaseState.releaseDir) &&
    isChildAlive(activeTarget)
  ) {
    return;
  }

  replacementRunning = true;
  const previousTarget = activeTarget;
  const nextPort = selectChildPort();

  try {
    console.log(
      `[runtime-proxy] Starting ${releaseState.releaseId} on ${CHILD_HOST}:${nextPort} (${reason})`
    );
    const nextTarget = await launchChild(releaseState, nextPort);
    activeTarget = nextTarget;
    lastError = "";
    console.log(
      `[runtime-proxy] Active release is ${nextTarget.releaseId} on ${CHILD_HOST}:${nextTarget.port}`
    );
    if (previousTarget && previousTarget.child !== nextTarget.child) {
      stopChild(previousTarget);
    }
  } catch (error) {
    lastError = error?.stack || error?.message || String(error);
    console.error("[runtime-proxy] Could not start replacement child:", error);
    if (!activeTarget) {
      scheduleRecovery();
    }
    throw error;
  } finally {
    replacementRunning = false;
  }
}

function queueReplacement(reason) {
  pendingReplacement = pendingReplacement
    .catch(() => {})
    .then(() => replaceActiveChild(reason))
    .catch(() => {});
  return pendingReplacement;
}

function scheduleRecovery() {
  if (shuttingDown || restartTimer) {
    return;
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    void queueReplacement("recovery");
  }, 2000);
  restartTimer.unref();
}

function sendRuntimeHealth(res) {
  const ok = Boolean(activeTarget && isChildAlive(activeTarget));
  const body = JSON.stringify(
    {
      ok,
      replacing: replacementRunning,
      active: activeTarget
        ? {
            pid: activeTarget.child.pid,
            port: activeTarget.port,
            releaseId: activeTarget.releaseId,
            releaseDir: activeTarget.releaseDir,
            startedAt: activeTarget.startedAt
          }
        : null,
      lastError
    },
    null,
    2
  );

  res.writeHead(ok ? 200 : 503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendTemporaryUnavailable(res) {
  const body = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="5">
  <title>Heldenhafte Reisen startet neu</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:#f9fafb;font-family:Arial,sans-serif}
    main{max-width:34rem;padding:2rem;text-align:center}
    h1{font-size:1.6rem;margin:0 0 .75rem}
    p{line-height:1.5;color:#d1d5db}
  </style>
</head>
<body>
  <main>
    <h1>Heldenhafte Reisen startet gerade neu</h1>
    <p>Die Seite lädt in wenigen Sekunden automatisch erneut.</p>
  </main>
</body>
</html>`;

  res.writeHead(503, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Retry-After": "5"
  });
  res.end(body);
}

function proxyHttpRequest(req, res) {
  if (req.url === "/_runtime/health") {
    sendRuntimeHealth(res);
    return;
  }

  const target = activeTarget;
  if (!isChildAlive(target)) {
    sendTemporaryUnavailable(res);
    return;
  }

  const proxyRequest = http.request(
    {
      hostname: CHILD_HOST,
      port: target.port,
      method: req.method,
      path: req.url,
      headers: req.headers,
      timeout: PROXY_REQUEST_TIMEOUT_MS
    },
    (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    }
  );

  proxyRequest.on("timeout", () => {
    proxyRequest.destroy(new Error("Proxy request timed out"));
  });
  proxyRequest.on("error", (error) => {
    lastError = error?.message || String(error);
    if (!res.headersSent) {
      sendTemporaryUnavailable(res);
    } else {
      res.destroy(error);
    }
  });

  req.pipe(proxyRequest);
}

function proxyUpgradeRequest(req, socket, head) {
  const target = activeTarget;
  if (!isChildAlive(target)) {
    socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 5\r\n\r\n");
    return;
  }

  const upstream = net.connect(target.port, CHILD_HOST, () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let index = 0; index < req.rawHeaders.length; index += 2) {
      upstream.write(`${req.rawHeaders[index]}: ${req.rawHeaders[index + 1]}\r\n`);
    }
    upstream.write("\r\n");
    if (head?.length) {
      upstream.write(head);
    }
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", (error) => {
    lastError = error?.message || String(error);
    socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 5\r\n\r\n");
  });
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[runtime-proxy] ${signal} received, shutting down`);
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  stopChild(activeTarget);
  proxyServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), CHILD_SHUTDOWN_TIMEOUT_MS + 1000).unref();
}

const proxyServer = http.createServer(proxyHttpRequest);
proxyServer.on("upgrade", proxyUpgradeRequest);

function onProxyListening() {
  console.log(`[runtime-proxy] Listening on port ${PUBLIC_PORT}`);
  if (typeof process.send === "function") {
    process.send("ready");
  }
  void queueReplacement("startup");
}

if (PUBLIC_HOST) {
  proxyServer.listen(PUBLIC_PORT, PUBLIC_HOST, onProxyListening);
} else {
  proxyServer.listen(PUBLIC_PORT, onProxyListening);
}

process.on("SIGUSR2", () => {
  void queueReplacement("signal");
});
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("message", (message) => {
  if (message === "shutdown") {
    shutdown("shutdown message");
  }
});
