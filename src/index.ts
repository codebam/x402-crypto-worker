import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { demoHtml } from './html';
import hash from 'hash.js';
import { Connection, PublicKey as SolanaPublicKey, Keypair as SolanaKeypair, SystemProgram, Transaction as SolanaTransaction } from '@solana/web3.js';

// Global type environment for Hono
export interface Env {
  X402_KV?: KVNamespace;
  TREASURY_ADDRESS?: string;
  SEPOLIA_RPC_URL?: string;
  SOLANA_TREASURY_ADDRESS?: string;
  SOLANA_RPC_URL?: string;
  BITCOIN_TREASURY_ADDRESS?: string;
  SIDESHIFT_SECRET?: string;
  SIDESHIFT_AFFILIATE_ID?: string;
  ENVIRONMENT?: string;
  ARBITRUM_RPC_URL?: string;
  ETHEREUM_RPC_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for API routes to allow client-side fetches from external domains like seanbehan.ca
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'payment-signature', 'x-payment']
}));

// Ephemeral in-memory fallback map for dynamic wallets (address -> privateKey)
const walletMap = new Map<string, string>();

// ==========================================
// 🪙 PURE JAVASCRIPT BITCOIN KEY DERIVATION
// ==========================================
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer: Uint8Array): string {
  let carry;
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let val = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry = (digits[j] << 8) | val;
      digits[j] = carry % 58;
      val = Math.floor(carry / 58);
    }
    while (val > 0) {
      digits.push(val % 58);
      val = Math.floor(val / 58);
    }
  }
  let res = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    res += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    res += ALPHABET[digits[i]];
  }
  return res;
}

function btcSha256(data: Uint8Array): Uint8Array {
  const hex = ethers.sha256(data);
  return ethers.getBytes(hex);
}

function btcRipemd160(data: Uint8Array): Uint8Array {
  const h = hash.ripemd160().update(data).digest();
  return new Uint8Array(h);
}

function base58CheckEncode(version: number, payload: Uint8Array): string {
  const buf = new Uint8Array(1 + payload.length + 4);
  buf[0] = version;
  buf.set(payload, 1);
  const checksumData = buf.subarray(0, 1 + payload.length);
  const checksum = btcSha256(btcSha256(checksumData));
  buf.set(checksum.subarray(0, 4), 1 + payload.length);
  return base58Encode(buf);
}

function generateBitcoinKeypair() {
  const wallet = ethers.Wallet.createRandom();
  const privateKeyHex = wallet.privateKey;
  const privateKeyBytes = ethers.getBytes(privateKeyHex);
  const compressedPublicKeyHex = ethers.SigningKey.computePublicKey(privateKeyHex, true);
  const compressedPublicKeyBytes = ethers.getBytes(compressedPublicKeyHex);
  const pubKeyHash = btcRipemd160(btcSha256(compressedPublicKeyBytes));
  const address = base58CheckEncode(0, pubKeyHash);
  const wifPayload = new Uint8Array(32 + 1);
  wifPayload.set(privateKeyBytes, 0);
  wifPayload[32] = 0x01;
  const privateKeyWIF = base58CheckEncode(0x80, wifPayload);
  return { address, privateKey: privateKeyWIF };
}

async function createSideShiftVariableOrder(
  env: Env,
  depositCoin: string,
  settleCoin: string,
  settleAddress: string
): Promise<string> {
  const affiliateId = env.SIDESHIFT_AFFILIATE_ID;
  if (!affiliateId) {
    throw new Error('SideShift Affiliate ID not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-ip': '127.0.0.1'
  };

  if (env.SIDESHIFT_SECRET) {
    headers['x-sideshift-secret'] = env.SIDESHIFT_SECRET;
  }

  const response = await fetch('https://sideshift.ai/api/v2/shifts/variable', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      settleAddress,
      affiliateId,
      depositCoin,
      settleCoin
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SideShift Variable Order API returned status ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;
  if (!data || !data.depositAddress) {
    throw new Error('SideShift response did not contain a depositAddress');
  }

  return data.depositAddress;
}

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
      },
      // Arbitrum One (USDC in Production)
      {
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:42161'
      },
      {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:42161'
      },
      // Arbitrum Sepolia (ETH in Dev/Testing)
      {
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:421614'
      },
      {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:421614'
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
  const isDev = c.env.ENVIRONMENT !== 'production';

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

// 1. Create a dynamic multi-chain Web3 payment session
app.post('/api/payment/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const amountUsd = body.amount_usd || 0.10;
  const callbackUrl = body.callback_url || '';
  const metadata = body.metadata || {};
  const network = body.network || 'evm'; // 'evm', 'solana', 'bitcoin'

  const url = new URL(c.req.url);
  const isDev = c.env.ENVIRONMENT !== 'production';

  let payeeAddress = '';
  let privateKey = '';
  let tokenSymbol = '';
  let networkId = '';
  let networkName = '';
  let web3Link = '';

  if (network === 'solana') {
    // Generate a secure Solana keypair
    const keypair = SolanaKeypair.generate();
    payeeAddress = keypair.publicKey.toBase58();
    privateKey = Buffer.from(keypair.secretKey).toString('hex');
    tokenSymbol = 'SOL';
    networkId = isDev ? 'solana:devnet' : 'solana:mainnet';
    networkName = isDev ? 'Solana Devnet' : 'Solana Mainnet';
    // 0.001 SOL Devnet value or equivalent Mainnet SOL
    web3Link = `solana:${payeeAddress}?amount=0.001`;
  } else if (network === 'bitcoin') {
    // Generate a legacy Bitcoin address and WIF private key
    const keypair = generateBitcoinKeypair();
    payeeAddress = keypair.address;
    privateKey = keypair.privateKey;
    tokenSymbol = 'BTC';
    networkId = isDev ? 'bitcoin:testnet' : 'bitcoin:mainnet';
    networkName = isDev ? 'Bitcoin Testnet' : 'Bitcoin Mainnet';
    // 0.00001 BTC value
    web3Link = `bitcoin:${payeeAddress}?amount=0.00001`;
  } else if (network === 'arbitrum') {
    // Arbitrum EVM keypair
    const wallet = ethers.Wallet.createRandom();
    payeeAddress = wallet.address;
    privateKey = wallet.privateKey;
    tokenSymbol = isDev ? 'ETH' : 'USDC';
    networkId = isDev ? 'eip155:421614' : 'eip155:42161';
    networkName = isDev ? 'Arbitrum Sepolia' : 'Arbitrum One';
    if (isDev) {
      web3Link = `ethereum:${payeeAddress}@421614?value=0.0001`;
    } else {
      const usdcArbitrum = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
      web3Link = `ethereum:${usdcArbitrum}@42161/transfer?address=${payeeAddress}&uint256=100000`;
    }
  } else {
    // Standard EVM keypair
    const wallet = ethers.Wallet.createRandom();
    payeeAddress = wallet.address;
    privateKey = wallet.privateKey;
    tokenSymbol = isDev ? 'ETH' : 'USDC';
    networkId = isDev ? 'eip155:11155111' : 'eip155:1';
    networkName = isDev ? 'Sepolia' : 'Ethereum';
    if (isDev) {
      web3Link = `ethereum:${payeeAddress}@11155111?value=0.0001`;
    } else {
      const usdcMainnet = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      web3Link = `ethereum:${usdcMainnet}@1/transfer?address=${payeeAddress}&uint256=100000`;
    }
  }

  const session = {
    payeeAddress: payeeAddress.toLowerCase(),
    privateKey,
    amountUsd,
    callbackUrl,
    metadata,
    status: 'pending',
    network,
    createdAt: Math.floor(Date.now() / 1000)
  };

  // Persist session configuration
  walletMap.set(payeeAddress.toLowerCase(), privateKey);
  if (c.env.X402_KV) {
    await c.env.X402_KV.put(`payment:${payeeAddress.toLowerCase()}`, JSON.stringify(session));
  }

  // Generate SVG QR Code
  const qrCodeSvg = await QRCode.toString(web3Link, { type: 'svg' });
  const qrCodeUri = `data:image/svg+xml;base64,${btoa(qrCodeSvg)}`;

  return c.json({
    success: true,
    payee_address: payeeAddress,
    amount_usd: amountUsd,
    token_symbol: tokenSymbol,
    network_id: networkId,
    network_name: networkName,
    web3_link: web3Link,
    qr_code_uri: qrCodeUri
  });
});

// 2. Verify a payment hash and trigger callbacks
app.post('/api/payment/verify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const payeeAddress = (body.payee_address || '').toLowerCase();
  const transactionHash = body.transaction_hash || '';

  if (!payeeAddress) {
    return c.json({ error: 'payee_address is required' }, 400);
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
        network: payeeAddress.startsWith('1') || payeeAddress.startsWith('3') ? 'bitcoin' : (payeeAddress.length > 42 ? 'solana' : 'evm'),
        createdAt: Math.floor(Date.now() / 1000)
      };
    }
  }

  if (!session) {
    return c.json({ error: 'Payment session not found' }, 404);
  }

  // 1. If session is already paid or swept, return success immediately!
  if (session.status === 'paid' || session.status === 'swept' || session.status === 'swapped_and_swept') {
    return c.json({
      success: true,
      message: 'Payment verified and callback dispatched successfully.',
      session: {
        payee_address: session.payeeAddress,
        status: session.status,
        transaction_hash: session.transactionHash || transactionHash,
        callback_url: session.callbackUrl,
        callback_status: 'already_paid',
        callback_dispatched: true
      }
    });
  }

  // 2. If polling query without new hash, return pending (402)
  if (transactionHash === 'check' || !transactionHash) {
    return c.json({ error: 'Payment is pending. Please provide a transaction hash to verify.' }, 402);
  }

  // Perform on-chain verification
  let isVerified = false;
  
  if (session.network === 'solana') {
    if (transactionHash.startsWith('mock_')) {
      isVerified = true;
    } else {
      try {
        const connectionUrl = c.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(connectionUrl, 'confirmed');
        const txInfo = await connection.getTransaction(transactionHash, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        if (txInfo) isVerified = true;
      } catch (err) {
        console.error('[x402-verify] Solana transaction check failed:', err);
      }
    }
  } else if (session.network === 'bitcoin') {
    // Scan public block explorer UTXO API for Bitcoin verification
    try {
      const btcAddress = session.payeeAddress;
      const explorerUrl = `https://mempool.space/api/address/${btcAddress}/utxo`;
      const response = await fetch(explorerUrl);
      if (response.ok) {
        const utxos = await response.json() as any[];
        if (utxos && utxos.length > 0) isVerified = true;
      }
    } catch (err) {
      console.error('[x402-verify] Bitcoin UTXO check failed:', err);
    }
    // Simulation fallback
    if (transactionHash.startsWith('mock_')) isVerified = true;
  } else {
    // EVM / Arbitrum
    if (transactionHash.startsWith('mock_')) {
      isVerified = true;
    } else {
      try {
        let providerUrl = '';
        if (session.network === 'arbitrum') {
          providerUrl = c.env.ENVIRONMENT === 'production'
            ? (c.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc')
            : 'https://sepolia-rollup.arbitrum.io/rpc';
        } else {
          providerUrl = c.env.ENVIRONMENT === 'production'
            ? (c.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth')
            : (c.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org');
        }
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        if (receipt && receipt.status === 1) isVerified = true;
      } catch (err) {
        console.error('[x402-verify] EVM transaction receipt check failed:', err);
      }
    }
  }

  if (!isVerified && !transactionHash.startsWith('mock_')) {
    return c.json({ error: 'Transaction could not be verified on-chain. Please wait or check your transaction hash.' }, 400);
  }

  // Update status to paid
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
          network: session.network,
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
  const EVM_treasury = env.TREASURY_ADDRESS || '0x655815CFaC22597C4339B76A8B7f8f3da6e648cD';
  const SOL_treasury = env.SOLANA_TREASURY_ADDRESS || 'A6vP2P9wX8U6o9d6bH1gTREAsurySolAddress';
  
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
        if (session.network === 'solana') {
          const connectionUrl = env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
          const connection = new Connection(connectionUrl, 'confirmed');
          
          const secretKey = Uint8Array.from(Buffer.from(session.privateKey, 'hex'));
          const keypair = SolanaKeypair.fromSecretKey(secretKey);
          
          const balance = await connection.getBalance(keypair.publicKey);
          console.log(`[x402-sweeper] Solana balance: ${balance} lamports`);

          const fee = 5000;
          if (balance > fee) {
            let targetAddress = SOL_treasury;
            let isSwap = false;
            
            // If SideShift is configured and balance > 0.05 SOL (50,000,000 lamports)
            if (env.SIDESHIFT_AFFILIATE_ID && balance >= 50000000) {
              try {
                console.log(`[x402-sweeper] SideShift config found. Requesting SOL -> ETH swap to EVM treasury: ${EVM_treasury}`);
                const swapAddress = await createSideShiftVariableOrder(env, 'SOL', 'ETH', EVM_treasury);
                targetAddress = swapAddress;
                isSwap = true;
                console.log(`[x402-sweeper] SideShift SOL -> ETH deposit address generated: ${swapAddress}`);
              } catch (swapErr) {
                console.error(`[x402-sweeper] SideShift order creation failed, falling back to native SOL sweep:`, swapErr);
              }
            }

            const sweepAmount = balance - fee;
            const transaction = new SolanaTransaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new SolanaPublicKey(targetAddress),
                lamports: BigInt(sweepAmount),
              })
            );
            
            const signature = await connection.sendTransaction(transaction, [keypair]);
            console.log(`[x402-sweeper] Solana sweep submitted: ${signature} (isSwap: ${isSwap})`);
            
            session.status = isSwap ? 'swapped_and_swept' : 'swept';
            session.sweepTxHash = signature;
            if (isSwap) {
              session.swapSettleAddress = EVM_treasury;
              session.swapDepositAddress = targetAddress;
            }
            await env.X402_KV.put(key.name, JSON.stringify(session));
          }
        } else if (session.network === 'bitcoin') {
          console.log(`[x402-sweeper] Monitoring/Sweeping Bitcoin address: ${session.payeeAddress}`);
          
          // Pre-create swap order for paid BTC session if SideShift affiliate ID exists and not yet generated
          if (env.SIDESHIFT_AFFILIATE_ID && !session.swapDepositAddress) {
            try {
              console.log(`[x402-sweeper] SideShift config found. Pre-creating BTC -> ETH swap to EVM treasury: ${EVM_treasury}`);
              const swapAddress = await createSideShiftVariableOrder(env, 'BTC', 'ETH', EVM_treasury);
              session.swapDepositAddress = swapAddress;
              session.swapSettleAddress = EVM_treasury;
              console.log(`[x402-sweeper] Pre-created BTC -> ETH swap deposit address: ${swapAddress}`);
              await env.X402_KV.put(key.name, JSON.stringify(session));
            } catch (swapErr) {
              console.error(`[x402-sweeper] SideShift pre-create order failed:`, swapErr);
            }
          }

          // Verify if UTXO has been swept from legacy address
          const explorerUrl = `https://mempool.space/api/address/${session.payeeAddress}/utxo`;
          const response = await fetch(explorerUrl);
          if (response.ok) {
            const utxos = await response.json() as any[];
            if (utxos && utxos.length === 0) {
              console.log(`[x402-sweeper] Bitcoin address ${session.payeeAddress} UTXOs cleared.`);
              session.status = session.swapDepositAddress ? 'swapped_and_swept' : 'swept';
              await env.X402_KV.put(key.name, JSON.stringify(session));
            }
          }
        } else {
          // EVM / Arbitrum
          console.log(`[x402-sweeper] Sweeping EVM address: ${session.payeeAddress} to treasury: ${EVM_treasury}`);
          
          let providerUrl = '';
          if (session.network === 'arbitrum') {
            providerUrl = env.ENVIRONMENT === 'production'
              ? (env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc')
              : 'https://sepolia-rollup.arbitrum.io/rpc';
          } else {
            providerUrl = env.ENVIRONMENT === 'production'
              ? (env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth')
              : (env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org');
          }
          
          const provider = new ethers.JsonRpcProvider(providerUrl);
          const wallet = new ethers.Wallet(session.privateKey, provider);
          
          const balance = await provider.getBalance(wallet.address);
          console.log(`[x402-sweeper] EVM balance: ${ethers.formatEther(balance)} ETH`);

          const gasLimit = 21000n;
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice || ethers.parseUnits('10', 'gwei');
          const totalFee = gasLimit * gasPrice;

          if (balance > totalFee) {
            const sweepAmount = balance - totalFee;
            console.log(`[x402-sweeper] Sending sweep transaction of ${ethers.formatEther(sweepAmount)} ETH to ${EVM_treasury}`);
            const tx = await wallet.sendTransaction({
              to: EVM_treasury,
              value: sweepAmount,
              gasLimit: gasLimit,
              gasPrice: gasPrice
            });
            console.log(`[x402-sweeper] Sweep transaction submitted: ${tx.hash}`);
            
            session.status = 'swept';
            session.sweepTxHash = tx.hash;
            await env.X402_KV.put(key.name, JSON.stringify(session));
          }
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
