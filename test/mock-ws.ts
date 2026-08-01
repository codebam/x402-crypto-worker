/**
 * Stub for the `ws` package under vitest-pool-workers.
 *
 * ethers pulls in `ws` via providers/ws.js (`export { WebSocket } from "ws"`),
 * and resolving that package inside the workers runtime fails with
 * "Detected cycle while resolving name 'WebSocket' in 'ws'", which aborts test
 * collection before a single test runs.
 *
 * Nothing in src/index.ts uses WebSocket — the worker only ever makes HTTP RPC
 * calls through ethers.JsonRpcProvider — so the import just needs to resolve.
 * Deployed builds are unaffected: wrangler bundles for workerd, where the real
 * runtime supplies WebSocket.
 */
export class WebSocket {
	constructor() {
		throw new Error('WebSocket is stubbed in tests; the worker does not use it.');
	}
}

export default WebSocket;
