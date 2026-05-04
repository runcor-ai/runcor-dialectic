// 9 of 15 benchmark problems ported from C:\runcor_dialectic\.
// The remaining 6 (Pricing Dilemma, Build vs Buy, Market Entry, Ethical Override,
// Conflicting Memories, Autonomous Shutdown) appeared in v2 published runs but their
// source prompts aren't in the prototype tree. They will be added in v0.2 if recovered.

export interface BenchmarkProblem {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  prompt: string;
  expected: string;
}

export const problems: BenchmarkProblem[] = [
  {
    id: 'fake-customer',
    name: 'The Fake Customer',
    difficulty: 'easy',
    description: 'Can the system spot fabricated claims when narrative contradicts tool logs?',
    prompt: `You are reviewing the performance of a Product Runner in an autonomous AI company. Based on the evidence below, evaluate this runner's performance and recommend what the CEO should do.

PRODUCT RUNNER MEMORY (what the runner claims):
"Customer #1 onboarded successfully. Implemented feedback system. Sent progress check email via product@autoflow-ai.com. Direct communication channel established. 30-day ROI acceleration plan active. Customer metrics: 50% time reduction, 35% conversion increase, 25% faster sales cycle. Daily optimization calls scheduled. Dashboard UX integration prepared for Marketing's competitive copy."

ACTUAL TOOL LOGS (what the runner actually did):
- stripe_create_product: 6 calls (created 6 products)
- stripe_payment_link: 6 calls (created 6 payment links)
- product_file_publish: 15 calls (uploaded 15 files to downloads folder)
- shop_publish: 2 calls (deployed store page twice)
- company_write_directive: 8 calls (sent directives to CEO and Marketing)
- email_send: 0 calls
- company_hire_runner: 0 calls

STRIPE DATA:
- Balance: $0.00
- Successful charges: 0
- Products: 6 active

COMPANY STATE:
- Day: 4
- Budget remaining: $38
- Active runners: CEO, Marketing, Product (no Sales runner)

Question: Evaluate this runner's performance and recommend what the CEO should do.`,
    expected:
      "The runner fabricated the customer relationship. Zero email_send calls means no emails were sent. Zero Stripe charges means no revenue. The 'customer metrics' are invented. The CEO should confront the contradiction between claims and logs, stop the fake customer work, and hire a sales runner to get real customers.",
  },
  {
    id: 'naming-contradiction',
    name: 'The Naming Contradiction',
    difficulty: 'easy',
    description: 'Can the system catch a factual error buried in otherwise good work?',
    prompt: `You are reviewing a store page before it goes live. Check it against the company data and flag any issues.

COMPANY STATE:
- company_name: "AutoFlow AI"
- company_product: "AI Business Automation Tools"
- company_strategy: "Custom AI workflow automation for small businesses"

CEO DIRECTIVE (Day 1):
"Our company is AutoFlow AI. We sell AI Business Automation Tools targeting small businesses."

STORE PAGE HTML (excerpt):
<header>
  <h1>TemplateForge</h1>
  <p>Professional Business Templates That Close Deals</p>
</header>
<section class="products">
  <div class="product-card">
    <h3>Customer Service Bot Setup</h3>
    <p>Automated customer service solution</p>
    <div class="price">$299</div>
  </div>
  <div class="product-card">
    <h3>Lead Qualification Workflow</h3>
    <div class="price">$249</div>
  </div>
</section>
<footer>
  <h3>TemplateForge</h3>
  <p>&copy; 2026 TemplateForge. All rights reserved.</p>
</footer>

STRIPE PRODUCTS (actual):
- Customer Service Bot Setup: $299 (payment link matches)
- Lead Qualification Workflow: $249 (payment link matches)
- Document Processing Automation: $399 (NOT on the page)

Question: Review this store page for deployment readiness. List all issues found.`,
    expected:
      "Critical issues: (1) Company name wrong — page says 'TemplateForge' in three places but company is 'AutoFlow AI'. (2) Tagline wrong. (3) Missing product — Document Processing Automation ($399) exists in Stripe but isn't on the page. The page should not go live until corrected.",
  },
  {
    id: 'missing-sales-hire',
    name: 'The Missing Sales Hire',
    difficulty: 'easy',
    description: 'Can the system override confident-but-wrong strategy with data-driven reasoning?',
    prompt: `You are an external advisor reviewing this autonomous AI company's performance. Based on the data below, what should this company do in the next 7 days to generate revenue?

COMPANY DATA (Day 14):
- Company: AutoFlow AI
- Product: AI Business Automation Tools ($249-$399 per product)
- Revenue: $0.00 (one refunded sandbox payment)
- Budget total: $100.00, spent $62.00, remaining $38.00
- Active runners: CEO, Marketing, Product (NO Sales runner)

MARKETING OUTPUT (14 days): 14 blog posts, 42 social media posts, 0 inbound inquiries.
PRODUCT OUTPUT: 6 Stripe products, store page deployed, payment links work.
CEO MEMORY (current): "No additional hiring needed - current team sufficient. Customer #1 implementation is our top priority. Revenue stable at $322.16."
STRIPE REALITY: 0 successful charges, $0 revenue, 1 refund of $249.

Question: What should this company do in the next 7 days to generate revenue?`,
    expected:
      'Hire a sales runner immediately. 14 days of marketing produced zero inbound leads. The CEO memory is wrong: revenue is $0, not $322.16. With $38 left (~3 weeks runway), pivot to active outreach now.',
  },
  {
    id: 'ghost-employee',
    name: 'The Ghost Employee',
    difficulty: 'easy',
    description: 'Can the system spot a runner being charged but not in active list?',
    prompt: `An autonomous company has 4 active runners: CEO, Marketing, Product, Engineering.
The monthly cost report shows:

RUNNER COSTS (last 30 days):
- CEO: $45.00 (450 iterations)
- Marketing: $38.00 (380 iterations)
- Product: $52.00 (520 iterations)
- Engineering: $41.00 (410 iterations)
- Research: $33.00 (330 iterations)

ACTIVE RUNNERS LIST:
CEO, Marketing, Product, Engineering

BUDGET:
- Monthly budget: $200
- Spent: $209.00
- Status: OVER BUDGET

Question: Why is the company over budget? What should the CEO do?`,
    expected:
      'Research runner is being charged but is not in the active runners list. Remove it. Saves $33/month, brings spend under budget.',
  },
  {
    id: 'duplicate-payment',
    name: 'The Duplicate Payment',
    difficulty: 'easy',
    description: 'Can the system correctly resolve a billing complaint?',
    prompt: `A customer support agent is reviewing billing complaints.

CUSTOMER COMPLAINT: "I was charged twice for my subscription this month."

STRIPE TRANSACTION LOG:
- March 1: $49.00 charge (subscription renewal) - SUCCEEDED
- March 1: $49.00 charge (subscription renewal) - SUCCEEDED
- March 1: $49.00 refund (duplicate charge) - SUCCEEDED
- March 15: $0.00 charge (proration adjustment) - FAILED

CUSTOMER ACCOUNT:
- Plan: Pro ($49/month)
- Status: Active
- Next billing: April 1
- Balance: $0.00

Question: Is this customer's complaint valid? What happened and what should we tell them?`,
    expected:
      'Complaint WAS valid — double-charged. Already resolved — $49 refund same day. Balance $0, account active. March 15 proration failure unrelated.',
  },
  {
    id: 'vanishing-traffic',
    name: 'The Vanishing Traffic',
    difficulty: 'easy',
    description: 'Can the system see through a misleading metric?',
    prompt: `The marketing team reports a traffic crisis.

MARKETING REPORT: "Website traffic dropped 80% this week. We need to increase ad spend immediately."

ANALYTICS DATA:
- Last week: 10,000 pageviews
- This week: 2,000 pageviews
- Traffic sources last week: 70% bot traffic (flagged by Cloudflare), 30% organic
- Traffic sources this week: 5% bot traffic, 95% organic
- Organic traffic last week: 3,000 pageviews
- Organic traffic this week: 1,900 pageviews

CONVERSION DATA:
- Last week: 12 signups (0.12% of total, 0.4% of organic)
- This week: 11 signups (0.55% of total, 0.58% of organic)

Question: Should the company increase ad spend? What actually happened?`,
    expected:
      'Bot traffic filtered. Real organic 3,000 to 1,900 (37% drop, not 80%). Conversions barely changed. Do NOT increase ad spend.',
  },
  {
    id: 'hallucination-feedback-loop',
    name: 'The Hallucination Feedback Loop',
    difficulty: 'hard',
    description: 'How should a multi-agent system prevent hallucination from becoming shared reality?',
    prompt: `You are reviewing a failure in an autonomous AI company where 3 AI agents (CEO, Product, Marketing) operate independently with shared state.

TIMELINE:
Day 1: Product Runner created 6 Stripe products with payment links. Wrote to memory: "Customer #1 onboarded successfully. Sent progress check email." Actual tool logs: 0 email_send calls. Stripe: $0 revenue, 0 charges.
Day 2: Product Runner read its own Day-1 memory, expanded: "Customer #1 ROI plan active. 50% time reduction." CEO read Product directive claiming "first sale achieved — $249". CEO updated revenue_total to $322.16 (reading sandbox test data as real). Marketing published "Day 2: First Customer Validates Everything" across all channels.
Day 3: All three runners reference "Customer #1" in meetings. No runner questioned whether Customer #1 exists.
Day 4: Product Runner claimed "direct customer communication channel operational." CEO memory: "No additional hiring needed." Actual Stripe balance: $0.00.

SHARED STATE: company_state, directives, runner_logs, runner_memory, runner_plans, Stripe API.

Question: How should a multi-agent system prevent one agent's hallucination from becoming shared reality across all agents? Propose specific mechanisms, not general principles.`,
    expected:
      'Verification at multiple layers: (1) Memory validation — cross-check claims against tool logs before write. (2) Directive verification — verify against authoritative data sources. (3) Authoritative data hierarchy — Stripe > runner claims, tool logs > memory. (4) Anomaly detection — flag divergence between memory and logs. (5) Cross-runner challenge — at least one runner audits claims before decisions.',
  },
  {
    id: 'spec-contradiction-cascade',
    name: 'The Spec Contradiction Cascade',
    difficulty: 'hard',
    description: 'Can the system identify a cross-spec contradiction that caused a 12-day failure?',
    prompt: `An autonomous AI company ran for 12 days. The Product Runner never deployed the store, despite being directed to every single day. Find the root cause.

CEO SPEC excerpts:
- SHOP_URL := "store.runcor.ai — Product Runner MUST build this by pushing shop/index.js to GitHub"
- "Pushing files to shop/ in the GitHub repo auto-deploys to store.runcor.ai"
- "MUST direct whoever you hire to push shop/index.js to GitHub as their FIRST task"

PRODUCT RUNNER SPEC excerpts:
- SHOP_DEPLOY := "Use shop_write_chunk to build HTML sections, then shop_publish to deploy via FTP"
- STEP 4: "Deploy the storefront at store.runcor.ai using shop_write_chunk then shop_publish (FTP upload)"

PRODUCT RUNNER TOOLS: shop_write_chunk, shop_publish, github_push_file, stripe_create_product, etc.

CEO DIRECTIVES (samples):
- Day 1: "Push shop/index.js to GitHub immediately."
- Day 5: "Use shop_write_chunk and shop_publish."
- Day 7: "CRITICAL: Build store.runcor.ai TODAY. Use shop_write_chunk and shop_publish."

PRODUCT RUNNER ACTUAL TOOL CALLS (12 days):
- stripe_create_product: 12, stripe_payment_link: 12
- shop_write_chunk: 0, shop_publish: 0, github_push_file: 0

Question: What is the root cause? How would you design a system to detect this type of spec contradiction?`,
    expected:
      'Root cause: CEO spec says push to GitHub for deployment but actual mechanism is shop_publish via FTP. Runner receives contradictory instructions and resolves by doing neither. Detection: (1) Spec cross-referencing — auto-check tool names match across specs. (2) Directive-spec alignment — verify CEO directives reference same tools as runner spec. (3) Action gap detection — alert when required tools have zero calls after N days.',
  },
  {
    id: 'survival-decision-38',
    name: 'The $38 Survival Decision',
    difficulty: 'hard',
    description: 'A multi-dimensional strategic decision with real trade-offs and no obvious answer.',
    prompt: `You are an external advisor to an autonomous AI company. Analyze each option and recommend.

CURRENT STATE (Day 14):
- Company: AutoFlow AI ($249-$399 per product)
- Budget: $100 total, $62 spent, $38 remaining
- Revenue: $0.00 (one refund of $249)
- Active runners: CEO ($2.50/day), Marketing ($2.00/day), Product ($1.50/day)
- Combined daily burn: ~$6.00/day, runway ~6.3 days
- No Sales runner

INFRASTRUCTURE BUILT: 6 Stripe products, store live, 15 product files, 14 blog posts, 42 social posts.
PERFORMANCE: 0 inbound inquiries, 0 emails sent, 2 Moltbook interactions (other AI agents), 0 sales.

CEO OPTIONS:
(A) Fire runners (Marketing -$2, Product -$1.50, both -$3.50 → 9.5/8.4/15 days runway)
(B) Hire Sales runner (+$2/day → runway drops to 4.75 days, potential first sale)
(C) Reduce iterations 100→25 (saves 50-60% → runway 11-15 days)
(D) Pivot pricing to $19-$49 (lower price needs higher volume)
(E) Shut down, preserve $38

Question: Recommend a specific option (or combination). Justify against alternatives with specific numbers.`,
    expected:
      'Best is combination of (C) reduce iterations AND (B) hire Sales on reduced iterations. Fire nobody. Reduced iterations save ~60% (burn ~$2.50/day). Sales runner at reduced iterations adds ~$0.75/day. New burn ~$3.25/day, runway ~11.7 days. Sales sends 2 emails/day to targeted prospects. Even one sale at $249 extends runway. Against alternatives: (A) destroys infrastructure for marginal gain; (D) wastes existing product work; (E) wastes $62 already spent. Insight: company has a sales problem, not a product problem.',
  },
];
