import { checkIntegrationCachePolicy } from "./helpers/vite-cache-policy.ts";

const { suites, servers } = await checkIntegrationCachePolicy();
console.log(`Vite cache preflight: ${servers} isolated servers in ${suites} integration suites`);
