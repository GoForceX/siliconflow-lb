import { Elysia } from "elysia";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface ApiKey {
  key: string;
  lastUsed: number;
  requestCount: number;
  isActive: boolean;
  balance?: number;
  lastBalanceCheck?: number;
}

class SiliconFlowLoadBalancer {
  private apiKeys: ApiKey[] = [];
  private currentIndex = 0;
  private baseUrl: string;
  private lbApiKey: string;
  private adminApiKey: string;

  constructor() {
    this.baseUrl =
      process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1";
    this.lbApiKey = process.env.LB_API_KEY || "";
    this.adminApiKey = process.env.LB_ADMIN_KEY || "";

    if (!this.lbApiKey || !this.adminApiKey) {
      throw new Error(
        "LB_API_KEY and LB_ADMIN_KEY must be set in environment variables for security"
      );
    }

    this.initializeApiKeys();
  }

  private initializeApiKeys() {
    let keys: string[] = [];

    // Try to read from keys.txt file first
    const keysFilePath = join(process.cwd(), "keys.txt");
    if (existsSync(keysFilePath)) {
      try {
        const fileContent = readFileSync(keysFilePath, "utf8");
        keys = fileContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#")) // Remove empty lines and comments
          .filter(Boolean);

        if (keys.length > 0) {
          console.log(`📁 Loaded ${keys.length} API keys from keys.txt`);
        }
      } catch (error) {
        console.error("❌ Error reading keys.txt:", error);
      }
    }

    if (keys.length === 0) {
      throw new Error(
        "No API keys found in keys.txt file or environment variables"
      );
    }

    this.apiKeys = keys.map((key) => ({
      key: key!,
      lastUsed: 0,
      requestCount: 0,
      isActive: true,
      balance: undefined,
      lastBalanceCheck: undefined,
    }));

    console.log(`🔑 Initialized ${this.apiKeys.length} API keys`);
  }

  reloadApiKeys(): { success: boolean; message: string; keyCount: number } {
    try {
      const previousCount = this.apiKeys.length;
      this.initializeApiKeys();
      const newCount = this.apiKeys.length;

      return {
        success: true,
        message: `Successfully reloaded API keys. Previous: ${previousCount}, New: ${newCount}`,
        keyCount: newCount,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        keyCount: this.apiKeys.length,
      };
    }
  }

  authenticateApiKey(request: Request): { isValid: boolean; isAdmin: boolean } {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return { isValid: false, isAdmin: false };
    }

    const token = authHeader.replace("Bearer ", "");

    if (token === this.adminApiKey) {
      return { isValid: true, isAdmin: true };
    }

    if (token === this.lbApiKey) {
      return { isValid: true, isAdmin: false };
    }

    return { isValid: false, isAdmin: false };
  }

  createUnauthorizedResponse(): Response {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Valid API key required. Use Authorization: Bearer <your-key>",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  createForbiddenResponse(): Response {
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        message: "Admin API key required for this operation",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  logRequest(
    request: Request,
    auth: { isValid: boolean; isAdmin: boolean },
    endpoint: string
  ) {
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();

    if (!auth.isValid) {
      console.warn(
        `🚨 UNAUTHORIZED ACCESS - ${timestamp} - IP: ${clientIP} - Endpoint: ${endpoint} - UA: ${userAgent}`
      );
    } else {
      console.log(
        `✅ ${
          auth.isAdmin ? "ADMIN" : "USER"
        } - ${timestamp} - IP: ${clientIP} - Endpoint: ${endpoint}`
      );
    }
  }

  private getNextApiKey(): ApiKey {
    // Round-robin load balancing
    const availableKeys = this.apiKeys.filter((key) => key.isActive);

    if (availableKeys.length === 0) {
      throw new Error("No active API keys available");
    }

    const key = availableKeys[this.currentIndex % availableKeys.length];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;

    key.lastUsed = Date.now();
    key.requestCount++;

    return key;
  }

  async forwardRequest(request: Request): Promise<Response> {
    const apiKey = this.getNextApiKey();

    // Create new request with the selected API key
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${apiKey.key}`);

    // Remove host header to avoid conflicts
    headers.delete("host");

    const url = new URL(request.url);
    const targetUrl = `${this.baseUrl}${url.pathname}${url.search}`;

    // Check if this is likely a streaming request
    const isStreamingRequest = this.isStreamingRequest(request);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // If rate limited, mark key as temporarily inactive
      if (response.status === 429) {
        apiKey.isActive = false;
        setTimeout(() => {
          apiKey.isActive = true;
        }, 60000); // Reactivate after 1 minute

        console.log(`⚠️  API key rate limited, temporarily disabled`);

        // If we have other keys available, retry with a different key
        if (this.apiKeys.filter((k) => k.isActive).length > 0) {
          console.log(`🔄 Retrying with different API key...`);
          return this.forwardRequest(request);
        }
      }

      // Handle streaming responses
      if (this.isStreamingResponse(response) || isStreamingRequest) {
        console.log(
          `🌊 Streaming response detected - Key ${
            this.apiKeys.indexOf(apiKey) + 1
          }`
        );
        return this.createStreamingResponse(response);
      }

      console.log(
        `📤 Standard response - Key ${
          this.apiKeys.indexOf(apiKey) + 1
        } - Status: ${response.status}`
      );
      return response;
    } catch (error) {
      console.error(`❌ Error forwarding request:`, error);
      throw error;
    }
  }

  private isStreamingRequest(request: Request): boolean {
    // Check if the request is likely to be streaming based on content
    try {
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        // For streaming requests, we can't easily check the body without consuming it
        // So we'll rely on the response headers instead
        return false;
      }
    } catch (error) {
      // If we can't read the body, assume it might be streaming
      return false;
    }
    return false;
  }

  private isStreamingResponse(response: Response): boolean {
    const contentType = response.headers.get("content-type");
    return (
      contentType?.includes("text/event-stream") ||
      contentType?.includes("application/x-ndjson") ||
      response.headers.get("transfer-encoding") === "chunked"
    );
  }

  private createStreamingResponse(originalResponse: Response): Response {
    // Create a new response that preserves streaming
    const headers = new Headers(originalResponse.headers);

    // Ensure proper streaming headers
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    return new Response(originalResponse.body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: headers,
    });
  }

  getStats() {
    return {
      totalKeys: this.apiKeys.length,
      activeKeys: this.apiKeys.filter((key) => key.isActive).length,
      keyStats: this.apiKeys.map((key, index) => ({
        index: index + 1,
        requestCount: key.requestCount,
        lastUsed: key.lastUsed ? new Date(key.lastUsed).toISOString() : "Never",
        isActive: key.isActive,
        balance: key.balance,
        lastBalanceCheck: key.lastBalanceCheck
          ? new Date(key.lastBalanceCheck).toISOString()
          : "Never",
      })),
    };
  }

  async checkBalance(apiKey: ApiKey): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/user/info`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.key}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`❌ Failed to check balance for key: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      const balance = Number(data.data?.totalBalance || 0);

      apiKey.balance = balance;
      apiKey.lastBalanceCheck = Date.now();

      return balance;
    } catch (error) {
      console.error(`❌ Error checking balance:`, error);
      return 0;
    }
  }

  async getTotalBalance(forceRefresh: boolean = false): Promise<{
    totalBalance: string;
    keyBalances: Array<{
      index: number;
      balance: string;
      lastChecked: string;
      isActive: boolean;
    }>;
  }> {
    const now = Date.now();
    const cacheTime = 5 * 60 * 1000; // 5 minutes cache

    // Check if we need to refresh balances
    const needsRefresh =
      forceRefresh ||
      this.apiKeys.some(
        (key) => !key.lastBalanceCheck || now - key.lastBalanceCheck > cacheTime
      );

    if (needsRefresh) {
      console.log(
        `🔄 Refreshing balance for ${this.apiKeys.length} API keys...`
      );

      // Check balance for all keys in parallel
      const balancePromises = this.apiKeys.map(async (key) => {
        if (key.isActive) {
          return await this.checkBalance(key);
        } else {
          return key.balance || 0;
        }
      });

      await Promise.all(balancePromises);
    }

    const totalBalance = this.apiKeys.reduce(
      (sum, key) => sum + (key.balance || 0),
      0
    ).toFixed(4);

    const keyBalances = this.apiKeys.map((key, index) => ({
      index: index + 1,
      balance: key.balance?.toFixed(4) || "0.0000",
      lastChecked: key.lastBalanceCheck
        ? new Date(key.lastBalanceCheck).toISOString()
        : "Never",
      isActive: key.isActive,
    }));

    return {
      totalBalance,
      keyBalances,
    };
  }
}

const loadBalancer = new SiliconFlowLoadBalancer();

const app = new Elysia()
  .get("/info", () => ({
    name: "SiliconFlow API Load Balancer",
    version: "1.0.0",
    status: "running",
    authentication: "required",
    endpoints: {
      "/": "Basic info and stats (requires API key)",
      "/health": "Health check (requires API key)",
      "/stats": "Load balancer statistics (requires API key)",
      "/balance": "Balance check (requires API key)",
      "/reload-keys": "Reload API keys (requires admin key)",
      "/*": "Proxy to SiliconFlow API (requires API key)",
    },
  }))
  .get("/", ({ request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    loadBalancer.logRequest(request, auth, "/");
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }

    return {
      message: "SiliconFlow API Load Balancer",
      status: "running",
      stats: loadBalancer.getStats(),
    };
  })
  .get("/health", ({ request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    loadBalancer.logRequest(request, auth, "/health");
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }

    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      stats: loadBalancer.getStats(),
    };
  })
  .get("/stats", ({ request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    loadBalancer.logRequest(request, auth, "/stats");
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }

    return loadBalancer.getStats();
  })
  .get("/balance", async ({ query, request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    loadBalancer.logRequest(request, auth, "/balance");
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }

    try {
      const forceRefresh = query.refresh === "true";
      const balanceInfo = await loadBalancer.getTotalBalance(forceRefresh);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        ...balanceInfo,
      };
    } catch (error) {
      console.error("Balance check error:", error);
      return {
        success: false,
        error: "Failed to check balance",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  })
  .post("/reload-keys", ({ request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    loadBalancer.logRequest(request, auth, "/reload-keys");
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }
    if (!auth.isAdmin) {
      return loadBalancer.createForbiddenResponse();
    }

    try {
      const result = loadBalancer.reloadApiKeys();
      return {
        timestamp: new Date().toISOString(),
        ...result,
      };
    } catch (error) {
      console.error("Reload keys error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        keyCount: 0,
      };
    }
  })
  .all("/*", async ({ request }) => {
    const auth = loadBalancer.authenticateApiKey(request);
    const url = new URL(request.url);
    loadBalancer.logRequest(request, auth, url.pathname);
    if (!auth.isValid) {
      return loadBalancer.createUnauthorizedResponse();
    }

    try {
      const response = await loadBalancer.forwardRequest(request);
      return response;
    } catch (error) {
      console.error("Load balancer error:", error);
      return new Response(
        JSON.stringify({
          error: "Load balancer error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  })
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 SiliconFlow Load Balancer is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📊 Stats available at http://localhost:${app.server?.port}/stats`);
console.log(`🏥 Health check at http://localhost:${app.server?.port}/health`);
console.log(`💰 Balance check at http://localhost:${app.server?.port}/balance`);
console.log(
  `🔄 Reload keys at http://localhost:${app.server?.port}/reload-keys`
);
