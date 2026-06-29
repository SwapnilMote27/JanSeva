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
| **AI Processing** | Google Gemini 3.5 Flash API | Free tier via Google AI Studio backend proxy |
| **Database** | Cloud Firestore | Free Spark tier: 50,000 reads/day, 20,000 writes/day |
| **Authentication** | Firebase Authentication (Google popup) | Free tier: Unlimited Google Sign-In |
| **Icons** | Lucide React | Free open-source vector icon set |
| **Charts & Stats** | Recharts | Free open-source data visualization |

---

## 📋 CORE FEATURES

1. **🤖 AI-Powered Issue Reporting**
   - Instant camera/file image upload.
   - High-efficiency local canvas compression keeping base64 payloads under Firestore document limits.
   - Server-side **Gemini 3.5 Flash** vision proxy mapping the image directly to title, category classification, severity estimation, suggested municipal department, and an AI confidence rating.
   - Fully automated device GPS acquisition utilizing `navigator.geolocation`.

2. **🗺️ Interactive Map Dashboard**
   - High-fidelity map viewport centered automatically on current user coordinates.
   - Customized cross-platform emoji markers representing active issue category and resolution severity (`🔴 Critical`, `🟠 High`, `🟡 Medium`, `🟢 Low`, `✅ Resolved`).
   - Dynamic real-time filter chips (Potholes, Water leaks, Streetlights, Garbage, Critical only) updating map pins dynamically.

3. **🤝 Community Verification & Timeline Tracking**
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

5. **📊 Municipal Impact Dashboard & AI Insights**
   - Comprehensive live data tracking (Total Reported, Total Resolved, Average Resolution times).
   - Recharts visual charts illustrating categories distribution and weekly reporting trends.
   - AI Insights Panel sending aggregate dataset summaries to Google Gemini to retrieve actionable municipal recommendations and priority levels.

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
   npm run start
   ```
   This will build our static assets into `dist/` and bundle our server file cleanly inside `dist/server.cjs` via esbuild.

---

*Developed for the Vibe2Ship Hackathon — June 2026*
