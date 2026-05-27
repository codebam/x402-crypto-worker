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
      {
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:84532'
      },
      {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:84532'
      }
    ],
    extensions: [],
    signers: {}
  };
};

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register('eip155:84532', new ExactEvmScheme());

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

  // 4. Construct RoutesConfig dynamically with the designated payeeAddress
  const path = c.req.path;
  const routeKey = `${method} ${path}`;

  const dynamicConfig = {
    [routeKey]: {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.10',
          network: 'eip155:84532', // Base Sepolia
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
      network: 'eip155:84532',
      payTo: payeeAddress,
      scheme: 'exact'
    };
    paymentRequiredHeader = btoa(JSON.stringify(challengePayload));
  }

  return c.json(
    {
      payee_address: payeeAddress,
      qr_code_uri: qrCodeUri,
      payment_required_header: paymentRequiredHeader
    },
    402,
    {
      'PAYMENT-REQUIRED': paymentRequiredHeader
    }
  );

});

export default app;
