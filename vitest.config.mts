import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
		deps: {
			optimizer: {
				ssr: {
					// ethers is otherwise left external, so the `ws` alias below never
					// gets applied to it. Bundling it lets the stub take effect.
					enabled: true,
					include: ['ethers'],
				},
			},
		},
	},
	resolve: {
		alias: {
			'@solana/web3.js': path.resolve(__dirname, './test/mock-solana.ts'),
			// ethers re-exports WebSocket from `ws`, which the workers runtime cannot
			// resolve ("Detected cycle while resolving name 'WebSocket' in 'ws'") and
			// which aborts collection before any test runs. See test/mock-ws.ts.
			ws: path.resolve(__dirname, './test/mock-ws.ts'),
		},
	},
});
