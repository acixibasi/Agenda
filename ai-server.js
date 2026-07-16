"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

loadEnvFile(".env");

const PORT = Number(process.env.AI_SERVER_PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/ai-advies") {
    await handleAiAdvice(request, response);
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  sendJson(response, 405, { error: "Methode niet ondersteund." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Roostercoach lokaal beschikbaar op http://127.0.0.1:${PORT}/`);
  console.log("AI endpoint actief op /api/ai-advies");
});

async function handleAiAdvice(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY ontbreekt in .env." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const context = String(body.context || "").trim();
    if (!context) {
      sendJson(response, 400, { error: "AI-context ontbreekt." });
      return;
    }

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: context,
        max_output_tokens: 1200
      })
    });

    const data = await aiResponse.json();
    if (!aiResponse.ok) {
      sendJson(response, aiResponse.status, { error: data.error?.message || "OpenAI API gaf een fout terug." });
      return;
    }

    sendJson(response, 200, { text: extractResponseText(data), model: OPENAI_MODEL });
  } catch (error) {
    const detail = error.cause?.message || error.message || "AI-aanvraag mislukt.";
    sendJson(response, 500, { error: detail });
  }
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.text) parts.push(content.text);
    });
  });
  return parts.join("\n").trim() || "Geen tekst ontvangen van AI.";
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Verboden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Niet gevonden");
      return;
    }
    response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 300000) {
        reject(new Error("AI-context is te groot."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Ongeldige JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function loadEnvFile(fileName) {
  const envPath = path.join(ROOT, fileName);
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  });
}
