# Community Hero 🦸 — Hyperlocal Problem Solver
## Hackathon: Vibe2Ship (CodingNinjas × Google for Developers)

Community Hero is a full-stack, AI-powered civic reporting and gamified community resolution platform. It empowers citizens to report, track, validate, and resolve local civic issues (such as potholes, water leaks, broken streetlights, or waste dump sites) through community collaboration and advanced vision intelligence.

---

## 🏗️ TECH STACK (100% Free Tier Only)

| Layer | Technology | Cost / Why Free |
|---|---|---|
| **Frontend** | React 19 + Vite | Free |
| **Styling** | Tailwind CSS v4 | Free |
| **Interactive Map** | Leaflet.js + OpenStreetMap | 100% free open-source (no Google Maps API key required) |
| **AI Processing** | Google Gemini 3.5 Flash API | Free tier via Google AI Studio backend proxy with automated fallbacks |
| **Database** | Cloud Firestore | Free Spark tier: 50,000 reads/day, 20,000 writes/day |
| **Authentication** | Firebase Authentication (Google popup) | Free tier: Unlimited Google Sign-In |
| **Icons** | Lucide React | Free open-source vector icon set |
| **Charts & Stats** | Recharts | Free open-source data visualization |

---

## 📋 CORE FEATURES

1. **🤖 AI-Powered Issue Reporting with Adaptive Fallbacks**
   - Instant camera/file image upload.
   - High-efficiency local canvas compression keeping base64 payloads under Firestore document limits.
   - Server-side **Gemini 3.5 Flash** vision proxy mapping the image directly to title, category classification, severity estimation, suggested municipal department, and an AI confidence rating.
   - **Quota & Rate-Limit Resilience**: In the event of Gemini API high demand or server unavailability (e.g., HTTP 503), the backend automatically engages a rule-based keyword analyzer for text inputs and provides placeholder mock vision evaluations to guarantee 100% submission uptime.

2. **🗺️ Interactive Map Dashboard & Robust GPS Handler**
   - High-fidelity map viewport centered automatically on current user coordinates.
   - **Leaflet LatLng Protection**: Implements robust boundary checks for coordinates. If browser Geolocation is blocked, loading, or reports corrupted `NaN` elements, the application gracefully initializes to national default markers (`[20.5937, 78.9629]`) instead of throwing leaflet layout errors.
   - Customized cross-platform emoji markers representing active issue category and resolution severity (`🔴 Critical`, `🟠 High`, `🟡 Medium`, `🟢 Low`, `✅ Resolved`).
   - Dynamic real-time filter chips (Potholes, Water leaks, Streetlights, Garbage, Critical only) updating map pins dynamically.

3. **🤝 Community Verification & Upvoting**
   - **Upvoting & Gamification Loop**: Features an interactive "Me too! (+2 XP)" upvote system on Map pins. Supporting an issue increases its support tally in Firestore, prevents duplicate votes via user UID lists, and instantly rewards the voter with +2 XP.
   - Vertical state-aware timeline tracker: `Reported` ➔ `Verified` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved`.
   - Crowdsourced verification: If 3 local neighbors confirm the issue's existence, the status automatically advances from `Reported` to `Verified`.

4. **🏆 Gamification, Badges & Leaderboards**
   - Citizen engagement reward loop:
     - Report an issue: `+10 XP`
     - Upvote/Support neighbor issue: `+2 XP`
     - Discuss in comments section: `+3 XP`
     - Community verification: `+5 XP`
     - Issue successfully resolved: `+25 XP`
   - Active user leaderboard ranking the top 20 community heroes with gold, silver, and bronze trophies.
   - Interactive milestone awards (First Responder, Community Watch, Problem Solver, Neighborhood Hero) reflecting active accomplishments or locked states.

5. **📊 Municipal Impact Dashboard & Dynamic AI Insights**
   - Comprehensive live data tracking (Total Reported, Total Resolved, Average Resolution times).
   - Recharts visual charts illustrating categories distribution and weekly reporting trends.
   - **Data-Driven Insights Fallback**: A dual-layered Insights engine. If the active Gemini model undergoes high-concurrency demand, the backend dynamically calculates real-time municipal recommendations based on live Firestore statistics (top categories, resolution percentages, and average days latency), assuring continuous analytic availability.

---

## 🔧 SETUP & DEPLOYMENT

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Environment Variables**:
   Create a `.env` file at the root of the project with:
   ```env
   GEMINI_API_KEY="your-google-ai-studio-gemini-key"
   ```

3. **Start the full-stack server**:
   ```bash
   npm run dev
   ```
   The development server will mount Vite middleware inside our Express server and run on port `3000`.

4. **Production Build**:
   ```bash
   npm run build
   ```
   This will build our static assets into `dist/` and bundle our server file cleanly inside `dist/server.cjs` via esbuild.

5. **Start Production**:
   ```bash
   npm run start
   ```

---

*Developed for the Vibe2Ship Hackathon — June 2026*
