import { setupGoldenEnvironment, describeDemoGoldens, shardDemos } from './goldenSuite';

// shard 4 of 8: the demo goldens are split across files so vitest runs them in parallel
setupGoldenEnvironment();
describeDemoGoldens(shardDemos(3, 8));
