export const demoHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>x402 Agentic Multi-Chain Payment Gateway</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Solana Web3.js Browser Library CDN -->
  <script src="https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js"></script>
  <!-- Inter & Outfit Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Outfit', 'sans-serif'],
            mono: ['Fira Code', 'monospace'],
          },
        },
      },
    }
  </script>
  <style>
    body {
      background: radial-gradient(circle at 50% 0%, #111424 0%, #08090f 100%);
    }
    .glass-panel {
      background: rgba(18, 20, 38, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .glass-input {
      background: rgba(10, 11, 20, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .glow-cyan {
      box-shadow: 0 0 40px rgba(6, 182, 212, 0.15);
    }
    .glow-purple {
      box-shadow: 0 0 40px rgba(168, 85, 247, 0.15);
    }
    @keyframes pulse-slow {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
    .animate-pulse-slow {
      animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  </style>
</head>
<body class="text-slate-100 font-sans min-h-screen relative overflow-x-hidden py-12 px-4 flex flex-col items-center justify-center">
  <!-- Glowing Background Orbs -->
  <div class="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[150px] animate-pulse-slow pointer-events-none"></div>
  <div class="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/10 blur-[150px] animate-pulse-slow pointer-events-none"></div>

  <div class="w-full max-w-5xl z-10 space-y-8">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6">
      <div class="space-y-1">
        <h1 class="text-4xl font-extrabold font-display tracking-tight bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 bg-clip-text text-transparent">
          x402 Multi-Chain Gateway
        </h1>
        <p class="text-slate-400 text-sm">
          Dynamic Production Cryptocurrency Payments (EVM, Solana, & Bitcoin)
        </p>
      </div>
      <div class="mt-4 md:mt-0 flex items-center gap-3">
        <span class="px-3 py-1 text-xs rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Gateway: Active
        </span>
        <span id="active-network-pill" class="px-3 py-1 text-xs rounded-full font-medium bg-cyan-950/40 text-cyan-400 border border-cyan-800/60 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          Sepolia (EVM)
        </span>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <!-- Left Side: Interactive Controls -->
      <div class="lg:col-span-7 space-y-6">
        <div class="glass-panel p-6 rounded-2xl glow-cyan space-y-6">
          <h2 class="text-xl font-semibold font-display flex items-center gap-2 text-cyan-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
            </svg>
            Gateway Dashboard
          </h2>

          <div class="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              Configure and test your payment parameters. Pick your desired network below to dynamically create an ephemeral payee address and WIF/secret key.
            </p>
          </div>

          <!-- Network Selection Dropdown -->
          <div class="space-y-2">
            <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Blockchain Network</label>
            <select id="select-network" class="w-full font-sans text-xs text-slate-300 glass-input px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500/50 transition">
              <option value="evm">EVM (Ethereum / Sepolia)</option>
              <option value="solana">Solana (SOL Devnet / Mainnet)</option>
              <option value="bitcoin">Bitcoin (BTC Testnet / Mainnet)</option>
            </select>
          </div>

          <!-- Callback URL configuration -->
          <div class="space-y-2">
            <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Callback Webhook URL (Production webhook)</label>
            <input id="input-callback-url" type="text" placeholder="https://example.com/webhook" class="w-full font-mono text-xs text-slate-300 glass-input px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500/50 transition">
            <p class="text-[9px] text-slate-500 italic">Optional. Enter your webhook endpoint to receive transaction verification events.</p>
          </div>

          <div class="pt-4 flex flex-wrap gap-4">
            <button id="btn-fetch" class="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 active:scale-[0.98] transition text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
              Request Invoice
            </button>
            
            <button id="btn-simulate" disabled class="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-[0.98] transition text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
              Simulate & Verify Webhook
            </button>
          </div>
        </div>

        <!-- Terminal Log Console -->
        <div class="glass-panel rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="font-display font-semibold text-slate-300 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
              Real-time Gateway Console
            </h3>
            <button id="btn-clear" class="text-xs text-slate-500 hover:text-slate-300 transition">Clear Console</button>
          </div>
          
          <div id="console-output" class="h-64 overflow-y-auto glass-input p-4 rounded-xl font-mono text-xs space-y-3 leading-relaxed border border-slate-800">
            <div class="text-slate-500">// Gateway ready. Select your network and click "Request Invoice" to begin.</div>
          </div>
        </div>
      </div>

      <!-- Right Side: Paywall Display -->
      <div class="lg:col-span-5 space-y-6">
        <div class="glass-panel p-6 rounded-2xl glow-purple flex flex-col items-center justify-center text-center space-y-6 min-h-[450px] relative overflow-hidden">
          
          <div id="paywall-empty" class="space-y-4 py-8">
            <div class="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div class="space-y-1">
              <h3 class="text-lg font-semibold font-display text-slate-200">Terminal Idle</h3>
              <p class="text-xs text-slate-500 max-w-[250px] mx-auto">
                Invoice generation is locked. Request an invoice to populate Web3 signing fields.
              </p>
            </div>
          </div>

          <div id="paywall-challenge" class="hidden w-full space-y-6">
            <div class="space-y-1">
              <span class="px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded bg-rose-950/50 text-rose-400 border border-rose-800/40">
                Invoice Unpaid
              </span>
              <h3 class="text-xl font-bold font-display text-white mt-2">Dynamic Multi-Chain Invoice</h3>
            </div>

            <!-- QR Code Container -->
            <div class="w-48 h-48 bg-white p-3 rounded-2xl mx-auto shadow-2xl relative group overflow-hidden">
              <img id="qr-image" src="" alt="Payment QR Code" class="w-full h-full transition duration-300">
            </div>

            <!-- Web3 Wallet Click-to-Pay Button -->
            <a id="btn-web3-pay" href="#" class="w-48 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 active:scale-[0.98] transition text-slate-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
              </svg>
              <span id="btn-web3-text">Pay with Web3 Wallet</span>
            </a>

            <!-- Payee Address Detail -->
            <div class="space-y-1.5 text-left w-full">
              <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Temporary Payee Address</label>
              <div class="flex items-center gap-2 glass-input px-3 py-2.5 rounded-xl border border-slate-800">
                <span id="payee-addr" class="font-mono text-xs text-slate-300 truncate flex-1">0x0000000000000000000000000000000000000000</span>
                <button id="btn-copy" class="text-cyan-400 hover:text-cyan-300 text-xs shrink-0 active:scale-95 transition">Copy</button>
              </div>
            </div>

            <!-- Invoice details -->
            <div class="grid grid-cols-2 gap-4 text-left w-full text-xs">
              <div class="glass-input p-3 rounded-xl border border-slate-800">
                <span class="block text-slate-500 text-[9px] uppercase font-bold tracking-wider">Amount</span>
                <span class="font-bold text-slate-200 text-sm">$0.10 USD</span>
              </div>
              <div class="glass-input p-3 rounded-xl border border-slate-800">
                <span class="block text-slate-500 text-[9px] uppercase font-bold tracking-wider">Token</span>
                <span id="invoice-token" class="font-bold text-slate-200 text-sm">USDC (EVM)</span>
              </div>
            </div>
          </div>

          <div id="paywall-success" class="hidden w-full space-y-6 py-4">
            <div class="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div class="space-y-1">
              <span class="px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                200 OK Succeeded
              </span>
              <h3 class="text-2xl font-bold font-display text-white mt-2">Invoice Cleared!</h3>
            </div>

            <div class="glass-input p-4 rounded-2xl border border-slate-800 space-y-3 text-left">
              <div class="text-xs">
                <span class="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-1">On-Chain Tx Receipt Hash</span>
                <span id="success-tx-hash" class="font-mono text-emerald-400 break-all select-all">0x000000...</span>
              </div>
              <div class="text-xs">
                <span class="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-1">Asynchronous Webhook Callback Status</span>
                <span id="success-callback" class="text-purple-400 font-mono break-all font-semibold">none</span>
              </div>
              <div class="text-xs">
                <span class="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-1">Server Gateway Message</span>
                <span id="success-msg" class="text-slate-300">Premium payload unlocked successfully.</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>

  <footer class="mt-16 text-slate-600 text-xs text-center border-t border-slate-900 pt-6 w-full max-w-5xl">
    x402 Agentic Multi-Chain Gateway &bull; Reusable Production REST Webhooks
  </footer>

  <script>
    // Elements
    const btnFetch = document.getElementById('btn-fetch');
    const btnSimulate = document.getElementById('btn-simulate');
    const btnClear = document.getElementById('btn-clear');
    const btnCopy = document.getElementById('btn-copy');
    const btnWeb3Pay = document.getElementById('btn-web3-pay');
    const btnWeb3Text = document.getElementById('btn-web3-text');
    const consoleOutput = document.getElementById('console-output');
    const selectNetwork = document.getElementById('select-network');
    
    const paywallEmpty = document.getElementById('paywall-empty');
    const paywallChallenge = document.getElementById('paywall-challenge');
    const paywallSuccess = document.getElementById('paywall-success');
    
    const qrImage = document.getElementById('qr-image');
    const payeeAddr = document.getElementById('payee-addr');
    const successTxHash = document.getElementById('success-tx-hash');
    const successMsg = document.getElementById('success-msg');

    let currentPayeeAddress = '';
    let currentRequiredHeader = '';
    let currentNetworkId = 'eip155:11155111';
    let currentWeb3Link = '';
    let chosenNetwork = 'evm'; // 'evm', 'solana', 'bitcoin'

    // Console Logging
    function log(message, type = 'info') {
      const time = new Date().toLocaleTimeString();
      const div = document.createElement('div');
      
      let typeStyle = 'text-slate-400';
      if (type === 'request') typeStyle = 'text-cyan-400 border-l-2 border-cyan-500 pl-2';
      if (type === 'response-402') typeStyle = 'text-rose-400 border-l-2 border-rose-500 pl-2';
      if (type === 'response-200') typeStyle = 'text-emerald-400 border-l-2 border-emerald-500 pl-2';
      if (type === 'error') typeStyle = 'text-red-400 bg-red-950/20 px-2 py-1 rounded border border-red-900/30';
      if (type === 'system') typeStyle = 'text-slate-500 italic';
      
      div.className = \`space-y-1 \${typeStyle}\`;
      div.innerHTML = \`<span class="text-slate-600 text-[10px] font-mono">[\${time}]</span> \${message}\`;
      
      consoleOutput.appendChild(div);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    let announcedProviders = [];
    window.addEventListener("eip6963:announceProvider", (event) => {
      if (!announcedProviders.some(p => p.info.uuid === event.detail.info.uuid)) {
        announcedProviders.push(event.detail);
        log(\`Discovered EVM Web3 Wallet: \${event.detail.info.name}\`, 'system');
      }
    });

    function requestProviders() {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    }

    requestProviders();
    window.addEventListener('load', requestProviders);
    document.addEventListener('DOMContentLoaded', requestProviders);
    for (let delay of [100, 250, 500, 1000, 2000]) {
      setTimeout(requestProviders, delay);
    }

    function getWeb3Provider() {
      if (announcedProviders.length > 0) {
        const uniswap = announcedProviders.find(p => p.info.name.toLowerCase().includes('uniswap'));
        if (uniswap) {
          log(\`Resolved EIP-6963 provider: \${uniswap.info.name}\`, 'system');
          return uniswap.provider;
        }
        log(\`Resolved EIP-6963 provider: \${announcedProviders[0].info.name}\`, 'system');
        return announcedProviders[0].provider;
      }
      if (window.ethereum) {
        log('Resolved standard window.ethereum provider', 'system');
        return window.ethereum;
      }
      return null;
    }

    btnClear.addEventListener('click', () => {
      consoleOutput.innerHTML = '<div class="text-slate-500">// Console cleared.</div>';
    });

    btnCopy.addEventListener('click', () => {
      if (currentPayeeAddress) {
        navigator.clipboard.writeText(currentPayeeAddress);
        btnCopy.textContent = 'Copied!';
        setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
      }
    });

    // API Interactions
    btnFetch.addEventListener('click', async () => {
      btnFetch.disabled = true;
      chosenNetwork = selectNetwork.value;
      const callbackUrl = document.getElementById('input-callback-url').value;
      log(\`POST /api/payment/create - Requesting invoice on \${chosenNetwork.toUpperCase()}...\`, 'request');
      
      try {
        const response = await fetch('/api/payment/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount_usd: 0.10,
            callback_url: callbackUrl,
            network: chosenNetwork
          })
        });

        log(\`HTTP Status: \${response.status} \${response.statusText}\`, 'system');

        if (response.status === 200) {
          const data = await response.json();
          currentPayeeAddress = data.payee_address;
          currentRequiredHeader = 'created';
          
          log(\`Web3 Invoice Created! payee_address: \${currentPayeeAddress}\`, 'response-402');
          
          // Render Challenge on screen
          qrImage.src = data.qr_code_uri;
          payeeAddr.textContent = currentPayeeAddress;
          
          if (data.web3_link) {
            currentWeb3Link = data.web3_link;
          }
          
          if (data.token_symbol) {
            document.getElementById('invoice-token').textContent = data.token_symbol + ' (' + chosenNetwork.toUpperCase() + ')';
          }
          if (data.network_name) {
            document.getElementById('active-network-pill').innerHTML = '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> ' + data.network_name;
          }
          if (data.network_id) {
            currentNetworkId = data.network_id;
          }

          // Dynamically adjust button appearance
          if (chosenNetwork === 'solana') {
            btnWeb3Text.textContent = 'Pay with Phantom (Solana)';
            btnWeb3Pay.style.display = 'flex';
          } else if (chosenNetwork === 'bitcoin') {
            btnWeb3Text.textContent = 'Self-Pay Legacy Address';
            btnWeb3Pay.style.display = 'none'; // Bitcoin relies on standard QR scanning
          } else {
            btnWeb3Text.textContent = 'Pay with Web3 Wallet';
            btnWeb3Pay.style.display = 'flex';
          }
          
          paywallEmpty.classList.add('hidden');
          paywallSuccess.classList.add('hidden');
          paywallChallenge.classList.remove('hidden');
          
          // Enable Simulation
          btnSimulate.disabled = false;
        } else {
          const txt = await response.text();
          log(\`Invoice creation failed: \${txt}\`, 'error');
        }
      } catch (err) {
        log(\`Connection failure: \${err.message}\`, 'error');
      } finally {
        btnFetch.disabled = false;
      }
    });

    btnSimulate.addEventListener('click', async () => {
      if (!currentPayeeAddress) {
        log('No active invoice to pay.', 'error');
        return;
      }

      btnSimulate.disabled = true;
      log('Simulating on-chain payment settlement...', 'system');

      // Create a mock transaction hash
      const mockTxHash = 'mock_' + Array.from({length: 60}, () => Math.floor(Math.random()*16).toString(16)).join('');
      log(\`Generated Mock Transaction Hash: \${mockTxHash}\`, 'system');
      
      log('POST /api/payment/verify - Verifying transaction hash...', 'request');

      try {
        const response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payee_address: currentPayeeAddress,
            transaction_hash: mockTxHash
          })
        });

        log(\`HTTP Status: \${response.status} \${response.statusText}\`, 'system');

        if (response.status === 200) {
          const data = await response.json();
          log('HTTP 200 OK: Payment Verified Successfully!', 'response-200');
          renderSuccess(data);
        } else {
          const data = await response.json();
          log(\`Payment verification failed: \${data.error || JSON.stringify(data)}\`, 'error');
        }
      } catch (err) {
        log(\`Retry failed: \${err.message}\`, 'error');
      } finally {
        btnSimulate.disabled = false;
      }
    });

    btnWeb3Pay.addEventListener('click', async (e) => {
      e.preventDefault();
      
      if (chosenNetwork === 'solana') {
        // Phantom / Solana Wallet Integration
        if (!window.solana || !window.solana.isPhantom) {
          log('Solana Wallet extension not detected! Please install Phantom.', 'error');
          alert('Phantom wallet extension not detected. Please install Phantom Wallet to sign Solana payments.');
          return;
        }

        btnWeb3Pay.classList.add('animate-pulse', 'pointer-events-none');
        btnWeb3Pay.textContent = 'Connecting Phantom...';

        try {
          log('Connecting Phantom Solana wallet...', 'system');
          const resp = await window.solana.connect();
          const userAddress = resp.publicKey.toString();
          log(\`Solana connected: \${userAddress}\`, 'system');

          btnWeb3Pay.textContent = 'Signing SOL Transaction...';
          log('Preparing Solana transfer transaction...', 'system');

          // Establish devnet connection
          const connection = new solanaWeb3.Connection("https://api.devnet.solana.com", "confirmed");
          
          // Transfer 1,000,000 lamports = 0.001 Devnet SOL
          const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
              fromPubkey: new solanaWeb3.PublicKey(userAddress),
              toPubkey: new solanaWeb3.PublicKey(currentPayeeAddress),
              lamports: 1000000,
            })
          );

          transaction.feePayer = new solanaWeb3.PublicKey(userAddress);
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;

          log('Prompting Phantom transaction signature approval...', 'system');
          const { signature } = await window.solana.signAndSendTransaction(transaction);
          log(\`SOL transaction submitted! Signature: \${signature}\`, 'system');

          btnWeb3Pay.textContent = 'Verifying SOL Payment...';
          log('POST /api/payment/verify - Verifying Solana signature...', 'request');

          const response = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              payee_address: currentPayeeAddress,
              transaction_hash: signature
            })
          });

          log(\`HTTP Status: \${response.status} \${response.statusText}\`, 'system');

          if (response.status === 200) {
            const data = await response.json();
            log('HTTP 200 OK: Solana Payment Verified!', 'response-200');
            renderSuccess(data);
          } else {
            const data = await response.json();
            log(\`Payment verification failed: \${data.error || JSON.stringify(data)}\`, 'error');
          }
        } catch (err) {
          log(\`Solana payment signing failed: \${err.message || err}\`, 'error');
        } finally {
          btnWeb3Pay.classList.remove('animate-pulse', 'pointer-events-none');
          btnWeb3Pay.textContent = 'Pay with Phantom (Solana)';
        }
        return;
      }

      // EVM wallet signing (Metamask / Uniswap Wallet)
      const provider = getWeb3Provider();
      if (!provider) {
        log('Starting Web3 environment diagnostics...', 'system');
        const walletKeys = Object.keys(window).filter(k => 
          /ethereum|wallet|uniswap|web3|provider|ethers|web3/i.test(k)
        );
        log(\`Discovered window properties: \${walletKeys.length > 0 ? walletKeys.join(', ') : 'none'}\`, 'system');
        log(\`window.ethereum type: \${typeof window.ethereum}\`, 'system');
        log('⚠️ Web3 Troubleshooting Checklist:', 'error');
        log('1. WALLET IS LOCKED? Locked wallets hide themselves to protect your privacy. Please open your Uniswap Wallet extension and UNLOCK it.', 'error');
        log('2. USING BRAVE? Brave Shields can block injections. Open brave://settings/web3 and set default provider to "Brave Wallet (Prefer Extension)" or disable Shields.', 'error');
        log('3. MULTIPLE WALLETS? Disable competing extensions to avoid namespace conflicts.', 'error');
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && currentWeb3Link) {
          log('Redirecting to Web3 wallet deep-link...', 'system');
          window.location.href = currentWeb3Link;
        } else {
          log('Web3 Wallet not detected! Please ensure your wallet is unlocked.', 'error');
          alert('No Web3 wallet extension detected in your browser.\\n\\nCommon fixes:\\n1. Make sure your Uniswap Wallet is UNLOCKED (logged in) and active.\\n2. If using Brave, check brave://settings/web3 settings.\\n3. Disable competing extensions.');
        }
        return;
      }

      btnWeb3Pay.classList.add('animate-pulse', 'pointer-events-none');
      btnWeb3Pay.textContent = 'Connecting Wallet...';

      try {
        log('Connecting Web3 wallet...', 'system');
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];
        log(\`Wallet connected: \${userAddress}\`, 'system');

        const targetHex = currentNetworkId === 'eip155:11155111' ? '0xaa36a7' : '0x1';
        const targetName = currentNetworkId === 'eip155:11155111' ? 'Sepolia' : 'Ethereum Mainnet';
        
        btnWeb3Pay.textContent = 'Switching Network...';
        log(\`Switching wallet network to \${targetName}...\`, 'system');
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetHex }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            log(\`Adding network \${targetName} to wallet...\`, 'system');
            if (currentNetworkId === 'eip155:11155111') {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xaa36a7',
                  chainName: 'Sepolia Testnet',
                  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://rpc.sepolia.org'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
              });
            }
          } else {
            throw switchError;
          }
        }

        btnWeb3Pay.textContent = 'Signing Payment...';
        log('Preparing transaction payload...', 'system');
        let txParams = {};

        if (currentNetworkId === 'eip155:11155111') {
          txParams = {
            from: userAddress,
            to: currentPayeeAddress,
            value: '0x5af3107a4000',
          };
        } else {
          const usdcContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
          const cleanAddress = currentPayeeAddress.toLowerCase().replace('0x', '');
          const paddedAddress = cleanAddress.padStart(64, '0');
          const paddedValue = '186a0'.padStart(64, '0');
          const txData = '0xa9059cbb' + paddedAddress + paddedValue;

          txParams = {
            from: userAddress,
            to: usdcContract,
            data: txData,
            value: '0x0'
          };
        }

        log('Requesting transaction signature from Web3 Wallet...', 'system');
        const txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        });

        log(\`Payment transaction submitted! Hash: \${txHash}\`, 'system');
        btnWeb3Pay.textContent = 'Verifying Payment...';
        
        log('POST /api/payment/verify - Verifying transaction hash...', 'request');
        const response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payee_address: currentPayeeAddress,
            transaction_hash: txHash
          })
        });

        log(\`HTTP Status: \${response.status} \${response.statusText}\`, 'system');

        if (response.status === 200) {
          const data = await response.json();
          log('HTTP 200 OK: Payment Verified Successfully!', 'response-200');
          renderSuccess(data);
        } else {
          const data = await response.json();
          log(\`Payment verification failed: \${data.error || JSON.stringify(data)}\`, 'error');
        }

      } catch (err) {
        log(\`Payment failed: \${err.message || err}\`, 'error');
      } finally {
        btnWeb3Pay.classList.remove('animate-pulse', 'pointer-events-none');
        btnWeb3Pay.textContent = 'Pay with Web3 Wallet';
      }
    });

    function renderSuccess(apiResponse) {
      const txHash = apiResponse.session.transaction_hash || 'N/A';
      const callbackStatus = apiResponse.session.callback_status || 'none';
      const callbackUrl = apiResponse.session.callback_url || 'none';

      successTxHash.textContent = txHash;
      successMsg.textContent = apiResponse.message || JSON.stringify(apiResponse);
      
      const callbackElement = document.getElementById('success-callback');
      if (callbackElement) {
        callbackElement.textContent = \`\${callbackStatus} (Target: \${callbackUrl})\`;
      }

      paywallEmpty.classList.add('hidden');
      paywallChallenge.classList.add('hidden');
      paywallSuccess.classList.remove('hidden');
    }
  </script>
</body>
</html>
`;
