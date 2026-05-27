import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
	resolve: {
		alias: {
			'@solana/web3.js': path.resolve(__dirname, './test/mock-solana.ts'),
		},
	},
});
