import { verifyAllSources } from './verification.js'

const results = await verifyAllSources()
console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), readOnly: true, results }, null, 2))
