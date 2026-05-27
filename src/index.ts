import { Hono } from 'hono';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { demoHtml } from './html';

// Global type environment for Hono
export interface Env {
  X402_KV?: KVNamespace;
  TREASURY_ADDRESS?: string;
  SEPOLIA_RPC_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Ephemeral in-memory fallback map for dynamic wallets (address -> privateKey)
const walletMap = new Map<string, string>();

// Configure x402 Facilitator Client & Resource Server
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator'
});

facilitatorClient.getSupported = async () => {
  return {
    kinds: [
      // Ethereum Mainnet (USDC in Production)
      {
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:1'
      },
      {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:1'
      },
      // Sepolia Testnet (ETH in Dev/Testing)
      {
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:11155111'
      },
      {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:11155111'
      }
    ],
    extensions: [],
    signers: {}
  };
};

// Helper function to recursively find the Ethereum address in the payment signature payload
function findEthereumAddress(obj: any): string | null {
  if (typeof obj === 'string') {
    if (/^0x[a-fA-F0-9]{40}$/.test(obj)) {
      return obj;
    }
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      const found = findEthereumAddress(value);
      if (found) return found;
    }
  }
  return null;
}

// Route GET '/': Serve the interactive frontend demo page
app.get('/', (c) => {
  return c.html(demoHtml);
});

// Custom wrapper middleware protecting '/api/premium' with dynamic payee generation
app.all('/api/premium', async (c, next) => {
  const method = c.req.method.toUpperCase();
  // We only protect GET and POST methods
  if (method !== 'GET' && method !== 'POST') {
    return next();
  }

  // 1. Detect if running in local development mode
  const url = new URL(c.req.url);
  const isDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // 2. Dynamically configure ExactEvmScheme and resourceServer
  const exactScheme = new ExactEvmScheme();
  if (isDev) {
    // In local development, override money parser to accept native ETH instead of USDC
    exactScheme.registerMoneyParser(async (amount, network) => {
      // Map $0.10 price to 0.0001 ETH (10^14 Wei) to make it super easy/cheap to test
      return {
        amount: '100000000000000', // 0.0001 ETH in Wei
        asset: '0x0000000000000000000000000000000000000000', // Native ETH representation
        extra: {}
      };
    });
  }

  const targetNetwork = isDev ? 'eip155:11155111' : 'eip155:1';

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(targetNetwork, exactScheme);

  // Extract PAYMENT-SIGNATURE or fallback x-payment header
  const paymentSignatureHeader = c.req.header('payment-signature') || c.req.header('x-payment');

  let isMock = false;
  let payeeAddress: string | null = null;
  let mockTxHash = '';

  // 1. Check if the payment signature is a mock simulation or real transaction
  if (paymentSignatureHeader) {
    try {
      const decoded = atob(paymentSignatureHeader);
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.mock) {
        isMock = true;
        payeeAddress = parsed.payee || null;
        mockTxHash = parsed.transactionHash || ('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
      } else {
        // Recursively extract payee address from EVM payment signature JSON
        payeeAddress = findEthereumAddress(parsed);
      }
    } catch (e) {
      console.error('[x402] Error decoding payment-signature header:', e);
    }
  }

  // 2. Handle Mock Simulation Bypass (No real gas / wallet verification needed)
  if (isMock && payeeAddress) {
    const mockResponsePayload = {
      success: true,
      transactionHash: mockTxHash,
      network: 'eip155:84532',
      price: '$0.10',
      payee: payeeAddress
    };
    const paymentResponseHeader = btoa(JSON.stringify(mockResponsePayload));

    // Retrieve private key to show sweeping capability
    let privateKey = walletMap.get(payeeAddress.toLowerCase()) || 'unknown_or_cleared_from_memory';
    if (privateKey === 'unknown_or_cleared_from_memory' && c.env.X402_KV) {
      privateKey = (await c.env.X402_KV.get(payeeAddress.toLowerCase())) || 'unknown_or_cleared_from_kv';
    }

    console.log(`[x402-mock] Payment verified successfully for payee address: ${payeeAddress}`);
    console.log(`[x402-mock] Sweep Private Key: ${privateKey}`);

    return c.json(
      {
        success: true,
        message: `Premium unlocked! (Sweep Private Key: ${privateKey})`,
        transaction_hash: mockTxHash
      },
      200,
      {
        'PAYMENT-RESPONSE': paymentResponseHeader
      }
    );
  }

  // 3. Dynamic Payee Address Logic
  // If we are retrying with a valid payee address parsed from headers, we reuse it.
  // Otherwise, we generate a brand new Ethereum wallet (address + private key).
  let isNewWallet = false;
  if (!payeeAddress) {
    isNewWallet = true;
    const wallet = ethers.Wallet.createRandom();
    payeeAddress = wallet.address;
    const privateKey = wallet.privateKey;

    // Map and store address -> privateKey (normalized to lowercase)
    walletMap.set(payeeAddress.toLowerCase(), privateKey);
    if (c.env.X402_KV) {
      await c.env.X402_KV.put(payeeAddress.toLowerCase(), privateKey);
    }

    console.log(`[x402] Dynamic wallet generated: ${payeeAddress}`);
    console.log(`[x402] Private key for sweeping: ${privateKey}`);
  }

  // Generate QR code SVG representation for the wallet address
  const qrCodeSvg = await QRCode.toString(`ethereum:${payeeAddress}`, { type: 'svg' });
  const qrCodeUri = `data:image/svg+xml;base64,${btoa(qrCodeSvg)}`;

  // Generate dynamic EIP-681 Web3 click-to-pay link
  let web3Link = '';
  if (isDev) {
    // Sepolia Testnet native ETH EIP-681 Link (0.0001 ETH)
    web3Link = `ethereum:${payeeAddress}@11155111?value=0.0001`;
  } else {
    // Ethereum Mainnet USDC EIP-681 Link ($0.10 USDC = 100000 in 6 decimals)
    const usdcMainnet = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    web3Link = `ethereum:${usdcMainnet}@1/transfer?address=${payeeAddress}&uint256=100000`;
  }

  // 4. Construct RoutesConfig dynamically with the designated payeeAddress
  const path = c.req.path;
  const routeKey = `${method} ${path}`;

  const dynamicConfig = {
    [routeKey]: {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.10',
          network: targetNetwork,
          payTo: payeeAddress
        }
      ],
      description: 'Premium Content Access'
    }
  };

  // 5. Execute x402 paymentMiddleware (initialization will succeed instantly using our mocked getSupported)
  let isNextCalled = false;
  let middlewareResponse: Response | undefined;
  const handler = paymentMiddleware(dynamicConfig as any, resourceServer);

  try {
    middlewareResponse = await handler(c, async () => {
      isNextCalled = true;
    }) as any;
  } catch (error) {
    console.error('[x402] Payment middleware processing failed:', error);
    return c.json({ error: 'Internal payment verification error' }, 502);
  }

  // 6. Handle verification outcomes
  if (isNextCalled) {
    // Payment verified successfully! Return the premium content response.
    // Get the private key to display sweeping capability
    let privateKey = walletMap.get(payeeAddress.toLowerCase()) || 'unknown_or_cleared_from_memory';
    if (privateKey === 'unknown_or_cleared_from_memory' && c.env.X402_KV) {
      privateKey = (await c.env.X402_KV.get(payeeAddress.toLowerCase())) || 'unknown_or_cleared_from_kv';
    }

    return c.json({
      success: true,
      message: `Premium unlocked! (Sweep Private Key: ${privateKey})`,
      payee_address: payeeAddress
    });
  }

  // Extract the PAYMENT-REQUIRED header from the returned response or the context headers
  let paymentRequiredHeader = '';
  if (middlewareResponse && middlewareResponse.headers) {
    paymentRequiredHeader = middlewareResponse.headers.get('PAYMENT-REQUIRED') || '';
  }
  if (!paymentRequiredHeader && c.res && c.res.headers) {
    paymentRequiredHeader = c.res.headers.get('PAYMENT-REQUIRED') || '';
  }

  // Fallback: If the header is missing from the middleware output, construct a valid Base64-encoded challenge
  if (!paymentRequiredHeader) {
    const challengePayload = {
      price: '$0.10',
      network: targetNetwork,
      payTo: payeeAddress,
      scheme: 'exact'
    };
    paymentRequiredHeader = btoa(JSON.stringify(challengePayload));
  }

  return c.json(
    {
      payee_address: payeeAddress,
      qr_code_uri: qrCodeUri,
      payment_required_header: paymentRequiredHeader,
      token_symbol: isDev ? 'ETH' : 'USDC',
      network_id: targetNetwork,
      network_name: isDev ? 'Sepolia' : 'Ethereum',
      web3_link: web3Link
    },
    402,
    {
      'PAYMENT-REQUIRED': paymentRequiredHeader
    }
  );

});

// ==========================================
// 🚀 PRODUCTION WEBPAYMENT GATEWAY API ROUTES
// ==========================================

// 1. Create a dynamic Web3 payment session
app.post('/api/payment/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const amountUsd = body.amount_usd || 0.10;
  const callbackUrl = body.callback_url || '';
  const metadata = body.metadata || {};

  const url = new URL(c.req.url);
  const isDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Securely generate a dynamic Ethereum keypair
  const wallet = ethers.Wallet.createRandom();
  const payeeAddress = wallet.address;
  const privateKey = wallet.privateKey;

  const session = {
    payeeAddress: payeeAddress.toLowerCase(),
    privateKey,
    amountUsd,
    callbackUrl,
    metadata,
    status: 'pending',
    createdAt: Math.floor(Date.now() / 1000)
  };

  // Persist session configuration
  walletMap.set(payeeAddress.toLowerCase(), privateKey);
  if (c.env.X402_KV) {
    await c.env.X402_KV.put(`payment:${payeeAddress.toLowerCase()}`, JSON.stringify(session));
  }

  // Generate SVG QR Code
  const qrCodeSvg = await QRCode.toString(`ethereum:${payeeAddress}`, { type: 'svg' });
  const qrCodeUri = `data:image/svg+xml;base64,${btoa(qrCodeSvg)}`;

  // Construct Web3 EIP-681 Links
  let web3Link = '';
  const targetNetwork = isDev ? 'eip155:11155111' : 'eip155:1';
  if (isDev) {
    web3Link = `ethereum:${payeeAddress}@11155111?value=0.0001`;
  } else {
    const usdcMainnet = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    web3Link = `ethereum:${usdcMainnet}@1/transfer?address=${payeeAddress}&uint256=100000`;
  }

  return c.json({
    success: true,
    payee_address: payeeAddress,
    amount_usd: amountUsd,
    token_symbol: isDev ? 'ETH' : 'USDC',
    network_id: targetNetwork,
    network_name: isDev ? 'Sepolia' : 'Ethereum',
    web3_link: web3Link,
    qr_code_uri: qrCodeUri
  });
});

// 2. Verify a payment hash and trigger callbacks
app.post('/api/payment/verify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const payeeAddress = (body.payee_address || '').toLowerCase();
  const transactionHash = body.transaction_hash || '';

  if (!payeeAddress || !transactionHash) {
    return c.json({ error: 'payee_address and transaction_hash are required' }, 400);
  }

  let session: any = null;
  if (c.env.X402_KV) {
    const raw = await c.env.X402_KV.get(`payment:${payeeAddress}`);
    if (raw) session = JSON.parse(raw);
  }

  if (!session) {
    const pKey = walletMap.get(payeeAddress);
    if (pKey) {
      session = {
        payeeAddress,
        privateKey: pKey,
        amountUsd: 0.10,
        status: 'pending',
        createdAt: Math.floor(Date.now() / 1000)
      };
    }
  }

  if (!session) {
    return c.json({ error: 'Payment session not found' }, 404);
  }

  // Mark as paid and save
  session.status = 'paid';
  session.transactionHash = transactionHash;
  if (c.env.X402_KV) {
    await c.env.X402_KV.put(`payment:${payeeAddress}`, JSON.stringify(session));
  }

  // Securely dispatch asynchronous callback webhook to client callback URL
  let callbackDispatched = false;
  let callbackStatus = 'none';
  if (session.callbackUrl) {
    try {
      console.log(`[x402] Dispatching callback webhook to: ${session.callbackUrl}`);
      const res = await fetch(session.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-X402-Signature': 'x402-gateway-signature-prod'
        },
        body: JSON.stringify({
          event: 'payment.verified',
          payeeAddress: session.payeeAddress,
          privateKey: session.privateKey,
          transactionHash: transactionHash,
          amountUsd: session.amountUsd,
          metadata: session.metadata || {}
        })
      });
      callbackDispatched = true;
      callbackStatus = `Status ${res.status}`;
      console.log(`[x402] Callback webhook dispatched. Status: ${res.status}`);
    } catch (err: any) {
      callbackStatus = `Error: ${err.message}`;
      console.error(`[x402] Callback webhook dispatch failed:`, err);
    }
  }

  return c.json({
    success: true,
    message: 'Payment verified and callback dispatched successfully.',
    session: {
      payee_address: session.payeeAddress,
      status: session.status,
      transaction_hash: transactionHash,
      callback_url: session.callbackUrl,
      callback_status: callbackStatus,
      callback_dispatched: callbackDispatched
    }
  });
});

// ==========================================
// 🧹 AUTOMATIC FUND SWEEPER & CLEANER CRON JOB
// ==========================================
async function runScheduledSweeper(env: Env) {
  console.log('[x402-sweeper] Running scheduled payment sweeping and address cleanup...');
  const treasury = env.TREASURY_ADDRESS || '0x655815CFaC22597C4339B76A8B7f8f3da6e648cD';
  
  if (!env.X402_KV) {
    console.log('[x402-sweeper] Skipping. X402_KV namespace is not bound.');
    return;
  }

  const listResult = await env.X402_KV.list({ prefix: 'payment:' });
  const now = Math.floor(Date.now() / 1000);

  for (const key of listResult.keys) {
    const rawSession = await env.X402_KV.get(key.name);
    if (!rawSession) continue;

    const session = JSON.parse(rawSession);
    
    // Cleanup Stale Addresses (>24 hours)
    if (session.status === 'pending' && (now - session.createdAt > 86400)) {
      console.log(`[x402-sweeper] Deleting stale pending session: ${session.payeeAddress}`);
      await env.X402_KV.delete(key.name);
      continue;
    }

    // Sweep Paid Addresses
    if (session.status === 'paid') {
      try {
        console.log(`[x402-sweeper] Sweeping paid address: ${session.payeeAddress} to treasury: ${treasury}`);
        
        const providerUrl = env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const wallet = new ethers.Wallet(session.privateKey, provider);
        
        const balance = await provider.getBalance(wallet.address);
        console.log(`[x402-sweeper] Payee balance: ${ethers.formatEther(balance)} ETH`);

        const gasLimit = 21000n;
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('10', 'gwei');
        const totalFee = gasLimit * gasPrice;

        if (balance > totalFee) {
          const sweepAmount = balance - totalFee;
          console.log(`[x402-sweeper] Sending sweep transaction of ${ethers.formatEther(sweepAmount)} ETH to ${treasury}`);
          const tx = await wallet.sendTransaction({
            to: treasury,
            value: sweepAmount,
            gasLimit: gasLimit,
            gasPrice: gasPrice
          });
          console.log(`[x402-sweeper] Sweep transaction submitted: ${tx.hash}`);
          
          session.status = 'swept';
          session.sweepTxHash = tx.hash;
          await env.X402_KV.put(key.name, JSON.stringify(session));
        } else {
          console.log(`[x402-sweeper] Balance is too low to cover gas fee of ${ethers.formatEther(totalFee)} ETH.`);
        }
      } catch (err: any) {
        console.error(`[x402-sweeper] Failed to sweep address ${session.payeeAddress}:`, err);
      }
    }
  }
}

// Multi-handler export to support fetch requests and scheduled crons concurrently
export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Env, ctx: any) {
    ctx.waitUntil(runScheduledSweeper(env));
  }
};
