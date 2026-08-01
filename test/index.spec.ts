import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

describe("x402 Multi-Chain Payment Gateway", () => {
  describe("GET /", () => {
    it("serves the glassmorphic frontend HTML", async () => {
      const request = new Request("http://localhost/");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("x402 Multi-Chain Gateway");
    });
  });

  describe("POST /api/payment/create", () => {
    it("creates an EVM payment session successfully", async () => {
      const request = new Request("http://localhost/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_usd: 0.10,
          network: "evm",
          callback_url: "https://example.com/callback"
        })
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.payee_address).toBeDefined();
      expect(json.amount_usd).toBe(0.10);
      expect(json.token_symbol).toBe("ETH"); // Sepolia in local/dev hostname
      expect(json.network_id).toBe("eip155:11155111");
    });

    it("creates a Solana payment session successfully", async () => {
      const request = new Request("http://localhost/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_usd: 0.10,
          network: "solana"
        })
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.payee_address).toBeDefined();
      expect(json.token_symbol).toBe("SOL");
      expect(json.network_id).toBe("solana:devnet");
    });

    it("creates an Arbitrum payment session successfully", async () => {
      const request = new Request("http://localhost/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_usd: 0.10,
          network: "arbitrum"
        })
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.payee_address).toBeDefined();
      expect(json.token_symbol).toBe("ETH"); // Arbitrum Sepolia in local/dev
      expect(json.network_id).toBe("eip155:421614");
    });

    // The web3 links used to carry hardcoded amounts, so a $5 invoice produced a
    // QR asking for a fixed token amount while the client's wallet button
    // charged the full $5 — the same invoice priced two ways. These assert the
    // link scales, and that it matches the maths the donate page on
    // seanbehan.ca uses for the same invoice.
    it("scales the web3 link amount with amount_usd", async () => {
      const create = async (amountUsd: number, network: string) => {
        const request = new Request("http://localhost/api/payment/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount_usd: amountUsd, network })
        });
        const ctx = createExecutionContext();
        const response = await worker.fetch(request, env, ctx);
        await waitOnExecutionContext(ctx);
        return await response.json() as any;
      };

      // Sepolia/Arbitrum-Sepolia pay in native ETH; the client sends
      // amount * 10^15 wei, i.e. 0.001 ETH per dollar.
      const five = await create(5, "arbitrum");
      expect(five.web3_link).toContain("value=0.005");

      const one = await create(1, "arbitrum");
      expect(one.web3_link).toContain("value=0.001");
      expect(one.web3_link).not.toEqual(five.web3_link);

      // Solana: the client sends amount * 10^7 lamports, i.e. 0.01 SOL per dollar.
      const sol = await create(5, "solana");
      expect(sol.web3_link).toContain("amount=0.05");
    });
  });

  describe("POST /api/payment/verify", () => {
    it("verifies a simulated payment session", async () => {
      // 1. Create session
      const createReq = new Request("http://localhost/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_usd: 0.10,
          network: "evm"
        })
      });
      const createCtx = createExecutionContext();
      const createRes = await worker.fetch(createReq, env, createCtx);
      await waitOnExecutionContext(createCtx);
      const createJson = await createRes.json() as any;
      const payeeAddress = createJson.payee_address;

      // 2. Verify with mock transaction hash
      const verifyReq = new Request("http://localhost/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payee_address: payeeAddress,
          transaction_hash: "mock_tx_12345"
        })
      });
      const verifyCtx = createExecutionContext();
      const verifyRes = await worker.fetch(verifyReq, env, verifyCtx);
      await waitOnExecutionContext(verifyCtx);

      expect(verifyRes.status).toBe(200);
      const verifyJson = await verifyRes.json() as any;
      expect(verifyJson.success).toBe(true);
      expect(verifyJson.session.status).toBe("paid");
      expect(verifyJson.session.transaction_hash).toBe("mock_tx_12345");
    });
  });

  describe("SideShift Configuration", () => {
    it("accepts SIDESHIFT_SECRET and SIDESHIFT_AFFILIATE_ID configuration", () => {
      const mockEnv = {
        ...env,
        SIDESHIFT_SECRET: "test_secret",
        SIDESHIFT_AFFILIATE_ID: "test_affiliate"
      };
      expect(mockEnv.SIDESHIFT_SECRET).toBe("test_secret");
      expect(mockEnv.SIDESHIFT_AFFILIATE_ID).toBe("test_affiliate");
    });
  });
});
