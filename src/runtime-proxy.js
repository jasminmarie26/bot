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
const PROXY_WAIT_FOR_READY_MS = normalizePositiveNumber(process.env.HR_PROXY_WAIT_FOR_READY_MS, 50000);
const PROXY_WS_WAIT_FOR_READY_MS = normalizePositiveNumber(process.env.HR_PROXY_WS_WAIT_FOR_READY_MS, 12000);

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

function formatChildPort(port) {
  return port > 0 ? `${CHILD_HOST}:${port}` : "a dynamic local port";
}

function canBindPort(port) {
  if (port === 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const server = net.createServer();

    function finish(result) {
      server.removeAllListeners();
      if (server.listening) {
        server.close(() => resolve(result));
      } else {
        resolve(result);
      }
    }

    server.once("error", () => finish(false));
    server.once("listening", () => finish(true));
    server.listen(port);
  });
}

async function selectChildPort() {
  const candidates = activeTarget
    ? CHILD_PORTS.filter((port) => port !== activeTarget.port)
    : [...CHILD_PORTS];

  for (const port of candidates) {
    if (await canBindPort(port)) {
      return port;
    }

    console.warn(`[runtime-proxy] Child port ${port} is already in use; trying another port.`);
  }

  console.warn("[runtime-proxy] No configured child port is free; asking the OS for a dynamic port.");
  return 0;
}

function isChildAlive(target) {
  return Boolean(target?.child && target.child.exitCode === null && !target.child.killed);
}

function waitForChildReady(child, requestedPort) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Child on ${formatChildPort(requestedPort)} did not become ready in time`));
    }, CHILD_READY_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
      child.off("error", onError);
    }

    function onMessage(message) {
      const readyPort = Number(message?.port);
      if (
        message?.type === "ready" &&
        Number.isInteger(readyPort) &&
        readyPort > 0 &&
        (requestedPort === 0 || readyPort === requestedPort)
      ) {
        cleanup();
        resolve(readyPort);
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

async function launchChild(releaseState, requestedPort) {
  const scriptPath = path.join(releaseState.releaseDir, "src", "index.js");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`App entry not found: ${scriptPath}`);
  }

  const child = fork(scriptPath, [], {
    cwd: releaseState.releaseDir,
    env: {
      ...process.env,
      PORT: String(requestedPort),
      HR_MANAGED_CHILD: "1",
      HR_RELEASE_ID: releaseState.releaseId
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"]
  });

  child.on("exit", (code, signal) => {
    if (activeTarget?.child !== child || shuttingDown) {
      return;
    }

    activeTarget = null;
    lastError = `Active child exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
    scheduleRecovery();
  });

  try {
    const readyPort = await waitForChildReady(child, requestedPort);
    await checkChildHealth(readyPort);
    return {
      child,
      port: readyPort,
      releaseId: releaseState.releaseId,
      releaseDir: releaseState.releaseDir,
      startedAt: new Date().toISOString()
    };
  } catch (error) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGINT");
    }
    throw error;
  }
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
  const nextPort = await selectChildPort();

  try {
    console.log(
      `[runtime-proxy] Starting ${releaseState.releaseId} on ${formatChildPort(nextPort)} (${reason})`
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Holds the client open while the app child starts/restarts instead of answering 503 immediately
 * (reduces flaky Apache proxy + ErrorDocument double errors).
 */
function isClientDisconnected(client) {
  if (!client) {
    return false;
  }

  return Boolean(client.destroyed || client.writableEnded);
}

async function waitUntilChildAlive(client, maxWaitMs) {
  const deadline = Date.now() + maxWaitMs;
  let kickstarted = false;

  while (Date.now() < deadline && !shuttingDown) {
    if (isChildAlive(activeTarget)) {
      return true;
    }
    if (isClientDisconnected(client)) {
      return false;
    }
    if (!kickstarted && !replacementRunning && !activeTarget) {
      kickstarted = true;
      void queueReplacement("on-demand");
    }

    await delay(100);
  }

  return isChildAlive(activeTarget);
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
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:radial-gradient(circle at 12% 12%,rgba(82,216,255,.2),transparent 32%),radial-gradient(circle at 88% 20%,rgba(255,214,123,.14),transparent 34%),#091322;color:#eaf3ff;font-family:Manrope,Arial,sans-serif}
    main{width:min(42rem,100%);padding:clamp(1.15rem,4vw,1.8rem);border:1px solid rgba(166,212,255,.28);border-radius:18px;background:rgba(20,33,51,.68);box-shadow:0 24px 56px -36px rgba(0,0,0,.72);text-align:center}
    .mark{display:inline-grid;min-width:4.25rem;height:4.25rem;margin-bottom:.9rem;place-items:center;border:1px solid rgba(82,216,255,.56);border-radius:999px;background:rgba(6,14,25,.58);color:#c9f3ff;font-family:Georgia,serif;font-size:1.25rem;font-weight:700}
    .kicker{margin:0 0 .35rem;color:#9de7ff;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    h1{font-family:Georgia,serif;font-size:clamp(1.45rem,4vw,2.05rem);margin:0}
    p{line-height:1.5;color:#c7d6e8}
    .overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin-top:1.2rem;text-align:left}
    .item{min-height:5.25rem;padding:.78rem .85rem;border:1px solid rgba(166,212,255,.22);border-radius:14px;background:rgba(6,14,25,.36)}
    .item span,.item strong{display:block}
    .item span{margin-bottom:.28rem;color:#b5c7dd;font-size:.75rem;font-weight:700;text-transform:uppercase}
    .item strong{color:#f9fbff;font-size:.95rem;line-height:1.35}
    @media (max-width:640px){.overview{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">503</div>
    <p class="kicker">Neustart</p>
    <h1>Heldenhafte Reisen startet gerade neu</h1>
    <p>Die Seite l&auml;dt in wenigen Sekunden automatisch erneut.</p>
    <div class="overview" aria-label="Fehler&uuml;bersicht">
      <div class="item">
        <span>Status</span>
        <strong>Die App wird gerade wieder verbunden</strong>
      </div>
      <div class="item">
        <span>N&auml;chster Versuch</span>
        <strong>Automatisch in 5 Sekunden</strong>
      </div>
    </div>
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

  void serveProxiedHttpRequest(req, res);
}

async function serveProxiedHttpRequest(req, res) {
  req.pause();
  let ready = false;

  try {
    ready = await waitUntilChildAlive(res, PROXY_WAIT_FOR_READY_MS);
  } finally {
    req.resume();
  }

  if (!ready) {
    req.destroy();
    if (!res.headersSent && !res.writableEnded) {
      sendTemporaryUnavailable(res);
    }
    return;
  }

  const target = activeTarget;
  if (!isChildAlive(target)) {
    req.destroy();
    if (!res.headersSent && !res.writableEnded) {
      sendTemporaryUnavailable(res);
    }
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
  void attachWebSocketUpstream(req, socket, head);
}

async function attachWebSocketUpstream(req, socket, head) {
  const ready = await waitUntilChildAlive(socket, PROXY_WS_WAIT_FOR_READY_MS);
  if (!ready || !isChildAlive(activeTarget)) {
    try {
      if (!socket.destroyed) {
        socket.end(
          "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 5\r\n\r\n"
        );
      }
    } catch (_error) {
      /* ignore */
    }
    return;
  }

  const target = activeTarget;
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
    try {
      if (!socket.destroyed) {
        socket.end(
          "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 5\r\n\r\n"
        );
      }
    } catch (_error) {
      /* ignore */
    }
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
