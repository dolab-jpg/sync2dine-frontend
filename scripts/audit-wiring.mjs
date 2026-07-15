import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const tools = [
  'priceSmallJob', 'submitForApproval', 'approveQuote', 'rejectQuote',
  'generatePaymentSchedule', 'saveContract', 'sendContract',
];

// Server modules live in the canonical tradepro-backend sibling checkout.
const backendServer = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tradepro-backend/server',
);
if (!fs.existsSync(backendServer)) {
  console.error(
    'tradepro-backend checkout not found at ../tradepro-backend.\n' +
    'Clone it as a sibling of this repo: git clone <tradepro-backend> ../tradepro-backend',
  );
  process.exit(1);
}

const rp = fs.readFileSync(path.join(backendServer, 'role-permissions.ts'), 'utf8');
const oh = fs.readFileSync(path.join(backendServer, 'orchestrator-handler.ts'), 'utf8');
const ql = fs.readFileSync('src/app/components/QuotesList.tsx', 'utf8');
const app = fs.readFileSync('src/app/App.tsx', 'utf8');
const os = fs.readFileSync('src/app/engine/ai/orchestratorService.ts', 'utf8');
const rpClient = fs.readFileSync('src/app/engine/ai/rolePermissions.ts', 'utf8');

const data = {};
for (const t of tools) {
  data[t] = {
    serverRolePerms: rp.includes(`'${t}'`),
    orchestratorToolDef: oh.includes(`name: '${t}'`),
    clientStaffActions: os.includes(`'${t}'`),
    clientRolePerms: rpClient.includes(`'${t}'`),
    clientAutoActions: os.includes(`'${t}'`),
  };
}

data.saveQuoteStatusEnum = /enum: \['indicative', 'draft', 'sent'\]/.test(oh);
data.saveQuoteHasAwaitingApproval = oh.includes('awaiting_approval');
data.quotesListAwaitingFilter = ql.includes('awaiting_approval');
data.quotesListApprovedFilter = ql.includes("value=\"approved\"");
data.migrateQuotesForcesTradeId = /tradeName === 'Small Jobs'/.test(app);

const entry = {
  sessionId: '75bc70',
  timestamp: Date.now(),
  location: 'scripts/audit-wiring.mjs',
  message: 'static wiring audit',
  hypothesisId: 'A-E',
  data,
};

fs.appendFileSync('debug-75bc70.log', JSON.stringify(entry) + '\n');
console.log(JSON.stringify(data, null, 2));
