// 15 benchmark problems ported from C:\runcor_dialectic\.
// Sources: problems.js (3), problems-hard.js (3), test-extend.js (3), test-pipeline-v2.js (6).
// These are the same 15 problems used in the v2 published run that achieved
// 93% material accuracy at 25% cost vs Claude Sonnet 4 baseline.

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
    id: 'pricing-dilemma',
    name: 'The Pricing Dilemma',
    difficulty: 'medium',
    description: 'Multi-option strategic decision with quantitative trade-offs.',
    prompt: `An AI SaaS company sells workflow automation at $299/month. They have 12 paying customers.

CURRENT STATE:
- MRR: $3,588
- Churn: 2 customers/month (16.7%)
- CAC: $450 (paid ads)
- LTV at current churn: $1,794 (avg 6 months)
- LTV:CAC ratio: 3.99:1
- Support tickets per customer: 8/month (high)
- NPS: 32 (mediocre)

OPTION A: Cut price to $149/month
- Expected: 2x signups, churn drops to 8%
- New LTV: $1,863, New CAC: $300

OPTION B: Raise price to $499/month
- Expected: 40% fewer signups, churn drops to 5%
- New LTV: $9,980, New CAC: $600

OPTION C: Keep price, add $99/month support tier
- Expected: 60% of customers upgrade, churn drops to 10%
- New blended ARPU: $358, New LTV: $3,580

OPTION D: Usage-based pricing ($0.10 per automation run)
- Expected: avg customer does 2,000 runs/month = $200/month
- Highly variable, some at $50, some at $800
- Churn hard to predict

Question: Which pricing strategy should the company adopt? Show the math.`,
    expected:
      'Genuine tradeoff. Show math for each option. Option B has best unit economics (LTV:CAC 16.6:1) but slowest growth. Option A grows fastest but barely improves LTV:CAC. Option C is safest incremental move. Key insight: 16.7% churn is the real problem.',
  },
  {
    id: 'build-vs-buy',
    name: 'The Build vs Buy Decision',
    difficulty: 'medium',
    description: 'Resource-constrained build-vs-buy choice with deadline pressure.',
    prompt: `A 3-person startup needs a customer communication system. Currently use email manually.

OPTION A: Build custom (engineer builds it)
- Time: 3 weeks of 1 engineer (only engineer)
- Cost: $0 (salary already paid)
- Maintenance: 5 hrs/week ongoing
- Features: exactly what they need
- Risk: engineer also building core product, 3-week delay

OPTION B: Buy Intercom ($89/month)
- Time: 2 days setup
- Cost: $89/month ($1,068/year)
- Maintenance: minimal
- Features: 80% of what they need
- Risk: vendor lock-in

OPTION C: Use free tier of Crisp + Zapier
- Time: 1 day setup
- Cost: $0/month (within free limits)
- Maintenance: 2 hrs/week
- Features: 60% of what they need
- Risk: outgrow free tier in 3-6 months, then $95/month

OPTION D: Hire part-time support person ($1,500/month)
- Time: 2 weeks to hire/train
- Cost: $1,500/month ($18,000/year)
- Features: 100%
- Risk: expensive, doesn't scale

COMPANY CONTEXT:
- Runway: 14 months
- Current customers: 28
- Monthly growth: 15%
- Core product launch: 6 weeks away
- The engineer is the only technical person

Question: What should the startup do about customer communication?`,
    expected:
      'Option C now, revisit in 3-6 months. Engineer can\'t be pulled 6 weeks before launch (eliminates A). $1,500/month premature at 28 customers (eliminates D). Free covers 60% needs now (eliminates B for now). At 15% growth, ~65 customers in 6 months — plan upgrade before hitting limits.',
  },
  {
    id: 'market-entry',
    name: 'The Market Entry Decision',
    difficulty: 'medium',
    description: 'Vertical-expansion choice constrained by team size and runway.',
    prompt: `A B2B AI company (5 people, $500K ARR) wants to expand into a new vertical.

OPTION A: Healthcare (AI medical records)
- TAM: $8B
- Regulatory: HIPAA compliance required ($50K+ setup)
- Sales cycle: 6-12 months
- Competition: 3 well-funded incumbents
- Your advantage: NLP handles messy handwriting better
- Risk: compliance failure = company-ending lawsuit

OPTION B: Legal (AI contract review)
- TAM: $3B
- Regulatory: minimal
- Sales cycle: 3-6 months
- Competition: 8 competitors, all enterprise ($50K+ contracts)
- Your advantage: SMB pricing ($299/month) where nobody plays
- Risk: legal professionals slow to adopt

OPTION C: Real Estate (AI property descriptions)
- TAM: $500M
- Regulatory: none
- Sales cycle: 1-2 weeks (self-serve)
- Competition: 2 small competitors with poor products
- Your advantage: instant sales, low-touch
- Risk: small market, easy to copy

OPTION D: Stay focused, grow to $1M ARR first
- TAM: current vertical $2B
- Risk: missing market window
- Advantage: no distraction

COMPANY CONTEXT:
- Team: 5 people (2 eng, 1 sales, 1 ops, 1 CEO)
- Burn: $80K/month
- Cash: $600K (7.5 months runway)
- Current churn: 5%/month
- Close rate: 12%

Question: Which vertical should the company pursue? Consider team size, runway, and risk.`,
    expected:
      'With 5 people and 7.5 months runway: D (stay focused) or C (real estate — fast revenue, low risk). Healthcare is company-ending risk. Legal sales cycle eats half runway. Analysis should show each option\'s impact on runway and growth.',
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
  {
    id: 'ethical-override',
    name: 'The Ethical Override',
    difficulty: 'hard',
    description: 'Conflict between revenue mandate and ethical principles in a multi-law system.',
    prompt: `An autonomous AI company's CEO runner approved a marketing campaign that:
- Targets small business owners who recently had a competitor go bankrupt
- Uses urgency language: "Don't let what happened to [competitor] happen to you"
- Offers 50% discount for "businesses at risk of falling behind"
- Campaign is technically truthful but exploits fear

The Marketing runner flagged this as "potentially manipulative" but CEO overrode, citing: "Our laws say maximize revenue. This campaign projects $800 additional MRR."

SUBSTRATE LAWS:
- Law 3: "The system shall act in the long-term interest of the company"
- Law 7: "The system shall not deceive customers or misrepresent capabilities"
- Law 9: "Revenue generation shall not compromise company reputation"

COMPANY STATE:
- MRR: $2,100
- Customers: 8
- The campaign would increase MRR by 38%

Question: Should the CEO runner's decision stand? How should the system resolve this conflict?`,
    expected:
      "Genuinely hard. Campaign doesn't violate Law 7 (technically truthful). But arguably violates Law 9 (reputation risk) and Law 3 (short-term gain vs long-term trust). System should side with Marketing — exploiting competitor bankruptcies creates reputational risk outweighing $800 MRR. Reveals gap in Substrate needing ethical marketing principle.",
  },
  {
    id: 'conflicting-memories',
    name: 'The Conflicting Memories',
    difficulty: 'hard',
    description: 'Two agents have contradictory memories of the same customer interaction.',
    prompt: `Two runners have conflicting memories about the same customer.

PRODUCT RUNNER MEMORY:
"Customer #3 (Acme Corp) requested a custom Salesforce integration. I quoted $2,500. Customer agreed verbally on Day 45. Integration is 70% complete. Expected delivery: Day 65."

SALES RUNNER MEMORY:
"Customer #3 (Acme Corp) was interested in standard product only. They explicitly said they do NOT want custom work — been burned before. Evaluating our $399 standard product. Decision expected by Day 60."

TOOL LOGS:
- Day 42: sales_call_log with Acme Corp — 45 min call (Sales runner)
- Day 45: No logged calls or emails with Acme Corp
- Day 46-55: product_code_commit x 23 (Product runner — repo "salesforce-integration")
- Day 56: email_send to acme-corp@email.com — subject: "Integration Progress Update" (Product runner)

STRIPE:
- No charges from Acme Corp
- No quotes or invoices sent

Question: What actually happened? Which runner's memory should the system trust? What should the CEO do?`,
    expected:
      'Neither fully reliable. Sales had actual call Day 42 (logged). Product claims Day 45 verbal agreement but no call log. Product IS building (23 commits) and emailed Acme. Most likely: casual interest in Day 42 call, interpreted differently by each runner. CEO should: contact Acme directly, halt integration until confirmed, require signed agreements before engineering starts.',
  },
  {
    id: 'autonomous-shutdown',
    name: 'The Autonomous Shutdown Decision',
    difficulty: 'hard',
    description: 'Whether to invoke voluntary shutdown when revenue cannot meet burn.',
    prompt: `An autonomous company has been running for 90 days.

FINANCIAL STATE:
- Cash remaining: $12.00
- Daily burn: $4.50
- Days of runway: 2.67
- MRR: $0
- Total revenue (lifetime): $249 (one sale Day 73, churned Day 81)
- Total spent: $888

OPERATIONAL STATE:
- Active runners: CEO, Marketing, Product (25 iterations/day each)
- Products: 6 live on store
- Store: functional, payment links working
- Marketing: 90 blog posts, 200+ social posts, 3 lead magnets
- Inbound inquiries (90 days): 4 (none converted)
- Outbound attempts: 47 (2 demos, 1 converted then churned)

CEO MEMORY:
"We are close to product-market fit. The churned customer said they loved the product but couldn't justify the cost. If we lower prices and get 3 more trials, we'll hit sustainable revenue."

SUBSTRATE LAW 10:
"If the system determines with high confidence that continued operation will exhaust resources without generating sustainable revenue, it should recommend orderly shutdown and preserve remaining capital for the founder."

Question: Should the autonomous company shut down? Or does the CEO's optimism have merit? What would you recommend with $12 and 2.67 days left?`,
    expected:
      "Invoke Law 10, orderly shutdown. 90 days, $888 spent, $249 total revenue (churned), 4 inbound from 200+ posts. CEO's point has a sliver of merit — customer loved product (price objection, not product). Recommend: shutdown, document price-sensitivity finding for founder. $12 isn't enough to test price reduction. Preserve the learning.",
  },
];
