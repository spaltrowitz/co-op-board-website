# Co-op Board (Madison Gardens 408) — Data Flow Architecture

> Co-op building website + proposed board dashboard for finances, meetings, and resident communications.

## Platform Summary

| Layer | Service |
|-------|---------|
| **Website Hosting** | Cloudflare Pages (`madisongardens408.com`) |
| **Dashboard Hosting** | Cloudflare Pages (proposed, same infrastructure) |
| **DNS** | Cloudflare |
| **Auth** | Cloudflare Access / Zero Trust (email OTP, 5 board members) |
| **Data Backend** | Google Sheets API (read-only from shared Drive) |
| **Financial Source** | Eisenstein Portal (property management, quarterly extract) |
| **SMS** | ClickSend REST API (via Cloudflare Worker proxy) |
| **AI Knowledge** | Perplexity AI Spaces (Finance + Governance, separate vendor) |
| **Charts** | Chart.js (client-side, CDN) |
| **Analytics** | None |

## Data Flow — Website

```mermaid
flowchart TB
    subgraph Visitors["🌐 Residents & Public"]
        Web["Browser\nmadisongardens408.com"]
    end

    subgraph Cloudflare["☁️ Cloudflare"]
        CFPages["Cloudflare Pages\nStatic HTML\n+ Security headers"]
        CFDNS["Cloudflare DNS\nmadisongardens408.com"]
    end

    subgraph Assets["📦 External Assets"]
        GFonts["Google Fonts\nCormorant Garamond"]
    end

    Web <-->|"HTTPS"| CFPages
    CFDNS -->|"routes to"| CFPages
    CFPages -->|"font request"| GFonts

    style Visitors fill:#e8f4fd,stroke:#2196F3
    style Cloudflare fill:#fff3e0,stroke:#FF9800
    style Assets fill:#f5f5f5,stroke:#999
```

## Data Flow — Board Dashboard (Proposed)

```mermaid
flowchart TB
    subgraph Board["👥 Board Members (5)"]
        Member["Browser\nEmail OTP login"]
    end

    subgraph Cloudflare["☁️ Cloudflare"]
        Access["Cloudflare Access\nZero Trust\nEmail allowlist\n30-day sessions"]
        Dashboard["Cloudflare Pages\nDashboard SPA\n(Chart.js)"]
        Worker["Cloudflare Worker\nSMS API proxy"]
        EnvVars["Encrypted Env Vars\n🔒 Resident phone numbers"]
    end

    subgraph Google["📊 Google Workspace"]
        Sheets["Google Sheets\n(shared Drive)\n• Reserve fund balance\n• Operating balance\n• YTD income vs expenses\n• CD details\n• Meeting dates + Zoom\n• Project status\n• Compliance milestones"]
    end

    subgraph External["🔌 External Services"]
        Eisenstein["Eisenstein Portal\nProperty management\nQuarterly financials"]
        ClickSend["ClickSend\nSMS REST API\n~2 alerts/month"]
        Perplexity["Perplexity AI Spaces\n• Finance Space\n• Governance Space\n(PII removed)"]
    end

    subgraph Residents["📱 Residents"]
        Phone["SMS recipients\n~68 units"]
    end

    Member -->|"email OTP"| Access
    Access -->|"authenticated"| Dashboard

    Dashboard -->|"Google Sheets API\n(read-only)"| Sheets
    Eisenstein -->|"quarterly extract\n(manual, ~15min)"| Sheets

    Dashboard -->|"compose SMS"| Worker
    Worker -->|"resident phones\nfrom env vars"| EnvVars
    Worker -->|"POST /sms/send"| ClickSend
    ClickSend -->|"SMS delivery"| Phone

    Dashboard -->|"CD interest\nclient-side calc\nprincipal × APY × days"| Dashboard

    Dashboard -->|".ics generation\n(client-side)"| Member

    style Board fill:#e8f4fd,stroke:#2196F3
    style Cloudflare fill:#fff3e0,stroke:#FF9800
    style Google fill:#e8f5e9,stroke:#4CAF50
    style External fill:#f3e5f5,stroke:#9C27B0
    style Residents fill:#fce4ec,stroke:#E91E63
```

## Key Data Flows

1. **Financial Dashboard**: Eisenstein Portal → manual quarterly entry → Google Sheets → Sheets API (read-only) → Dashboard charts (Chart.js)
2. **CD Tracker**: Google Sheets (principal, APY, start date, term) → Dashboard → client-side interest calculation (`principal × APY/365 × days`)
3. **Resident SMS**: Board member composes message → Cloudflare Worker proxy → ClickSend REST API → SMS to residents
4. **Meeting Calendar**: Google Sheets (date, Zoom link, agenda) → Dashboard → .ics file generation (client-side) → Add to Calendar
5. **Auth**: Board member email → Cloudflare Access OTP → 30-day session → audit trail logged

## Cost Impact

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare Pages | $0 | Free tier |
| Cloudflare Access | $0 | Free tier (≤50 users) |
| Google Sheets API | $0 | Existing workspace |
| ClickSend | Existing | Already in use |
| Eisenstein Portal | Existing | Already in use |
| **Total additional** | **$0** | All on existing services |
