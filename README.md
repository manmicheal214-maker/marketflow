# MarketFlow — Email Marketing Automation & CRM Platform

> Email Marketing Automation Made Simple

MarketFlow is a portfolio-focused email marketing automation and CRM platform designed to demonstrate practical digital marketing concepts alongside full-stack development. It includes contact management, audience segmentation, campaign creation, email templates, marketing automation workflows, A/B testing, lead scoring, analytics dashboards, and an AI marketing assistant.

## Problem Statement

Small businesses and marketers need affordable tools to manage email campaigns, segment audiences, automate follow-ups, and analyze results — all in one place. MarketFlow demonstrates how these capabilities work together in a modern SaaS application, without requiring paid email infrastructure to get started.

## Features

### CRM & Contacts
- Contact management with add, edit, delete, search, filter, and sort
- Contact status tracking (Lead, Interested, Customer, Inactive, Unsubscribed)
- Tagging system with multiple tags per contact
- CSV import/export
- Contact detail view with activity history and score breakdown
- Engagement scoring with tier classification (Cold, Warm, Hot, Sales Ready)
- Duplicate email prevention

### Segmentation
- Dynamic segments with AND/OR rule logic
- Pre-built segment templates (Highly Engaged, Inactive, VIP Customers, etc.)
- Real-time contact count per segment
- Rule conditions: status, tags, engagement score, recency

### Campaign Management
- Create, edit, duplicate, and delete campaigns
- Draft, schedule, and send (demo mode)
- Campaign statuses: Draft, Scheduled, Sending, Sent, Cancelled
- Target audience/segment selection
- Budget, revenue, and conversion tracking
- ROI, ROAS, CPA calculations

### Email Templates
- Reusable templates: Welcome, Promotional, Newsletter, Product Announcement, Abandoned Cart, Re-engagement
- HTML email editor
- Template preview
- Category organization

### Email Testing
- Provider-agnostic email abstraction (`sendEmail()`)
- Mailpit integration ready for local SMTP testing
- No paid email infrastructure required

### Email Event Tracking
- Events: sent, delivered, opened, clicked, bounced, unsubscribed
- Event-based analytics and contact activity history
- Simulated events for demo mode

### Automation Builder
- Visual workflow editor with trigger → action → condition flow
- Triggers: contact added, enters segment, tag added, campaign clicked/opened
- Actions: send email, add/remove tag, update status, wait, condition
- Active/paused automation states
- Enrollment tracking

### Lead Scoring
- Configurable scoring rules (email open +2, click +5, form submit +10, etc.)
- Score tiers: Cold (0-10), Warm (11-25), Hot (26-50), Sales Ready (50+)
- Score distribution visualization
- Top leads leaderboard
- Score event history per contact

### A/B Testing
- Subject line and content experiments
- Variant comparison with open rate, click rate, unsubscribe rate
- Winning metric selection (open rate or click rate)
- Winner declaration with trophy indicator

### Analytics Dashboard
- KPI cards: total contacts, emails sent, open rate, click rate, unsubscribe rate
- Contact growth chart (12-month time series)
- Email engagement over time (opens, clicks, unsubscribes)
- Campaign performance table
- Marketing funnel visualization (Visitors → Leads → Engaged → Qualified → Customers)
- Engagement by segment breakdown
- Campaign ROI metrics (ROI, ROAS, budget, revenue)

### Marketing Insights
- AI-driven actionable insights based on campaign performance
- Best/worst performing campaign identification
- Data-backed recommendations

### AI Marketing Assistant
- Subject line generation (input: product, discount, audience)
- Email copy generation (subject, preview, body, CTA)
- Campaign idea generation (input: product, audience, goal, budget, channel)
- Campaign performance analysis (possible causes, supporting metrics, recommended actions)
- Demo mode with deterministic responses when no AI API is configured

## Technology Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Express.js, Node.js |
| Database | SQLite (Drizzle ORM) — demo mode |
| Database (Production) | PostgreSQL via Supabase |
| Auth (Production) | Supabase Authentication |
| Email (Dev) | Mailpit |
| Email (Prod) | Provider-agnostic abstraction (SMTP ready) |
| Routing | wouter (hash-based) |
| State | TanStack React Query |
| Build | Vite, esbuild |

## Architecture

```
marketflow/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # shadcn/ui primitives
│   │   │   ├── layout.tsx  # Sidebar, header, app shell
│   │   │   └── shared.tsx  # KPI cards, states, badges
│   │   ├── pages/          # Page components
│   │   │   ├── dashboard.tsx
│   │   │   ├── contacts.tsx
│   │   │   ├── segments.tsx
│   │   │   ├── campaigns.tsx
│   │   │   ├── templates.tsx
│   │   │   ├── automations.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── ab-testing.tsx
│   │   │   ├── lead-scoring.tsx
│   │   │   ├── ai-assistant.tsx
│   │   │   ├── settings.tsx
│   │   │   └── login.tsx
│   │   ├── lib/            # Utilities, query client, formatters
│   │   └── hooks/          # Custom hooks
│   └── index.html
├── server/                 # Backend (Express)
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes (CRUD + analytics + AI)
│   ├── storage.ts          # Database storage layer (IStorage pattern)
│   ├── db.ts               # SQLite/Drizzle connection
│   ├── seed.ts             # Demo data generation
│   ├── analytics.ts        # Analytics computation
│   └── email.ts            # Email provider abstraction
├── shared/
│   └── schema.ts            # Data model (Drizzle schema + Zod validation)
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql  # PostgreSQL + RLS migration
├── .env.local.example
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── README.md
```

## Database Design

### Demo Mode (SQLite)
The app uses SQLite via Drizzle ORM for local development. Tables mirror the production schema with JSON text columns for complex fields (tags, rules, steps, variants).

### Production (PostgreSQL via Supabase)
The `supabase/migrations/0001_initial_schema.sql` file contains the complete PostgreSQL schema with:
- 12 normalized tables (profiles, contacts, segments, campaigns, email_templates, email_events, automations, automation_steps, automation_enrollments, ab_tests, ab_test_variants, lead_score_events)
- Row Level Security (RLS) on every table — users can only access their own data
- Appropriate indexes on user_id, email, campaign_id, contact_id, event_type, created_at
- Auto-profile creation trigger on user signup
- Foreign key constraints with cascade deletes

Every user-owned table includes a `user_id` column referencing `auth.users(id)`.

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Local Development

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/marketflow.git
   cd marketflow
   npm install
   ```

2. **Set up the database:**
   ```bash
   npx drizzle-kit push
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app runs on `http://localhost:5000`

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure as needed. The app runs in demo mode without any environment variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL (production) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anon key (production) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (server only) |
| `SMTP_HOST` | No | SMTP host (default: localhost) |
| `SMTP_PORT` | No | SMTP port (default: 1025 for Mailpit) |
| `EMAIL_FROM` | No | From email address |
| `OPENAI_API_KEY` | No | AI assistant API key (optional) |

### Mailpit Setup (Email Testing)

1. Install Mailpit: https://github.com/axllent/mailpit
2. Run: `mailpit`
3. SMTP runs on `localhost:1025`
4. Web UI available at `http://localhost:8025`

## Demo Mode

MarketFlow runs in demo mode by default with pre-loaded realistic data:

- **1,284 contacts** with diverse statuses, tags, and engagement scores
- **17 sent campaigns** + 1 draft with realistic open/click rates
- **7 segments** with computed contact counts
- **6 email templates** across all categories
- **4 automation workflows** (welcome, VIP, re-engagement, post-purchase)
- **3 A/B tests** with variant comparison and winners
- **800 email events** for activity tracking
- **Lead score events** distributed across contacts

All demo metrics are clearly labeled with a "Demo Mode — Simulated Data" badge. Reset demo data anytime from Settings → Demo Data → Reset.

## Security

- Row Level Security (RLS) on all database tables
- Service role keys never exposed to the client
- Environment variables loaded server-side only
- Email input validation on all forms (Zod schemas)
- HTML email content handled safely
- No hardcoded secrets in source code
- `.env.local` excluded from version control

## Future Improvements

- Full visual automation step builder (drag-and-drop)
- Real-time email event webhooks from production providers
- Custom segment rule builder UI
- Multi-user collaboration with role-based access
- Email template visual editor
- Webhook integrations (Shopify, Zapier, etc.)
- SMS marketing integration
- Advanced AI features with real LLM integration
- Advanced A/B testing with statistical significance

## Resume Positioning

### Digital Marketing Skills Demonstrated
- Email marketing campaign management
- Audience segmentation and targeting
- Lead nurturing workflows
- Marketing automation
- A/B testing and conversion optimization
- Campaign analytics and reporting
- Lead scoring and qualification
- CRM and contact management
- Marketing funnel optimization
- ROI analysis

### Technical Skills Demonstrated
- React + TypeScript full-stack development
- REST API design with Express.js
- Database design (SQLite/PostgreSQL)
- ORM usage (Drizzle)
- Row Level Security (RLS)
- Data visualization (Recharts)
- State management (TanStack Query)
- Component-driven UI (shadcn/ui, Tailwind CSS)
- Email service abstraction
- AI integration patterns
- Git/GitHub workflow

## License

MIT — This is a portfolio project. Feel free to use it as a reference for your own work.
