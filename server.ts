import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";

dotenv.config();

// Safe Firebase Initialization in backend
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = null;
let db: any = null;

if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("Backend Firestore connection established successfully.");
  } catch (err) {
    console.error("Failed to initialize Firebase in backend server:", err);
  }
}

// Safe date parsing helper
function parseDate(val: any): Date {
  if (!val) return new Date(0);
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000);
  }
  return new Date(val);
}

// Generate the beautiful HTML progress summary
function generateEmailHtml(displayName: string, issues: any[], appUrl: string = "http://localhost:3000"): string {
  const totalCount = issues.length;
  const pendingCount = issues.filter((i: any) => i.status === 'Reported').length;
  const activeCount = issues.filter((i: any) => ['Verified', 'Assigned', 'In Progress'].includes(i.status)).length;
  const resolvedCount = issues.filter((i: any) => i.status === 'Resolved').length;

  let issuesListHtml = "";
  if (issues.length === 0) {
    issuesListHtml = `
      <div style="text-align: center; padding: 24px; color: #64748b; font-size: 13px; border: 1px dashed #e2e8f0; border-radius: 12px; background-color: #fafafa;">
        You currently have no civic reports on file. Create reports on JanSeva to track their progress!
      </div>
    `;
  } else {
    issues.forEach((issue: any) => {
      const statusBadgeStyles: { [key: string]: string } = {
        'reported': 'background-color: #fef3c7; color: #d97706;',
        'verified': 'background-color: #e0f2fe; color: #0284c7;',
        'assigned': 'background-color: #f3e8ff; color: #7e22ce;',
        'inprogress': 'background-color: #dbeafe; color: #2563eb;',
        'resolved': 'background-color: #d1fae5; color: #059669;'
      };
      const statusClean = (issue.status || 'Reported').toLowerCase().replace(/\s+/g, '');
      const badgeStyle = statusBadgeStyles[statusClean] || statusBadgeStyles['reported'];
      
      const severityStyles: { [key: string]: string } = {
        'critical': 'color: #dc2626; border: 1px solid #fecaca; background-color: #fef2f2;',
        'high': 'color: #ea580c; border: 1px solid #ffedd5; background-color: #fff7ed;',
        'medium': 'color: #ca8a04; border: 1px solid #fef9c3; background-color: #fefce8;',
        'low': 'color: #475569; border: 1px solid #e2e8f0; background-color: #f8fafc;'
      };
      const severityClean = (issue.severity || 'Medium').toLowerCase();
      const sevStyle = severityStyles[severityClean] || severityStyles['medium'];

      let resolvedAtStr = "";
      if (issue.status === 'Resolved') {
        const rDate = parseDate(issue.resolvedAt || issue.reportedAt);
        resolvedAtStr = `<div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 6px; font-family: monospace;">✔️ RESOLVED ON: ${rDate.toLocaleDateString()}</div>`;
      }

      const repDate = parseDate(issue.reportedAt);
      const repDateStr = repDate.toLocaleDateString();

      issuesListHtml += `
        <div style="padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; background-color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">${issue.title || 'Untitled Issue'}</h4>
            <span style="display: inline-block; padding: 3px 8px; font-size: 9px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; font-family: monospace; ${badgeStyle}">${issue.status || 'Reported'}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.5;">${issue.description || 'No description provided.'}</p>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #334155;">Category:</span> ${issue.category || 'General'} &bull; 
            <span style="font-weight: 600; color: #334155;">Severity:</span> <span style="display: inline-block; padding: 1px 5px; font-size: 9px; font-weight: 700; border-radius: 4px; ${sevStyle}">${issue.severity || 'Medium'}</span> &bull; 
            <span style="font-weight: 600; color: #334155;">Reported:</span> ${repDateStr}
          </div>
          ${resolvedAtStr}
          ${issue.suggestedDepartment ? `
            <div style="font-size: 11px; color: #475569; background-color: #f1f5f9; padding: 6px 10px; border-radius: 6px; margin-top: 8px; display: inline-block;">
              🏢 <strong>Civic Department:</strong> ${issue.suggestedDepartment}
            </div>
          ` : ''}
        </div>
      `;
    });
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Progress Summary</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f8fafc; padding: 24px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff;">JanSeva Progress Digest</h1>
        <p style="margin: 0; font-size: 13px; color: #a7f3d0; font-weight: 500;">Weekly Automated Civic Resolution Report</p>
      </div>
      <div style="padding: 32px 24px;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Hello, ${displayName}!</h3>
        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
          Thank you for playing an active role in keeping our community safe, clean, and functioning. Here is a consolidated weekly summary of the status, department assignments, and resolution progress of your reported issues:
        </p>
        
        <div style="display: table; width: 100%; margin-bottom: 28px; border-collapse: separate; border-spacing: 8px 0;">
          <div style="display: table-row;">
            <div style="display: table-cell; width: 25%; background-color: #f1f5f9; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${totalCount}</div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin: 0;">Total</div>
            </div>
            <div style="display: table-cell; width: 25%; background-color: #f1f5f9; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${pendingCount}</div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin: 0;">Pending</div>
            </div>
            <div style="display: table-cell; width: 25%; background-color: #f1f5f9; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
              <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${activeCount}</div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin: 0;">Active</div>
            </div>
            <div style="display: table-cell; width: 25%; background-color: #ecfdf5; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #a7f3d0;">
              <div style="font-size: 20px; font-weight: 800; color: #047857; margin: 0 0 4px 0;">${resolvedCount}</div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #065f46; letter-spacing: 0.05em; margin: 0;">Resolved</div>
            </div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 28px; margin-bottom: 16px;">
          Report Resolution Progress
        </div>
        ${issuesListHtml}

        <div style="background-color: #f0fdf4; border: 1px dashed #bbf7d0; border-radius: 12px; padding: 16px; margin-top: 24px;">
          <h4 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">💡 Civic Contribution Tip</h4>
          <p style="margin: 0; font-size: 12px; color: #14532d; line-height: 1.5;">
            Reports that feature verified community flags, comments, and high upvote counts are pushed directly to municipal administrative priority lists. Share your reports with neighbors to quicken resolutions!
          </p>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        <p style="margin: 4px 0;">You received this automated progress digest because you opted in to receive Weekly Email Summaries for JanSeva.</p>
        <p style="margin: 4px 0;">To customize your notifications or opt out, please visit your <a href="${appUrl}/profile" style="color: #059669; text-decoration: none; font-weight: 600;">User Profile Settings</a>.</p>
        <p style="margin: 4px 0;">&copy; 2026 JanSeva CommunityHero Platform. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// Send email helper
async function sendSummaryEmail(recipientEmail: string, recipientName: string, htmlContent: string) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || '"JanSeva Civic Platform" <noreply@janseva-civic.org>';

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipientEmail,
      subject: "Your Weekly JanSeva Civic Progress Summary 📬",
      html: htmlContent,
    });
    console.log(`Real email successfully sent to ${recipientEmail} via SMTP host ${smtpHost}`);
    return { sent: true, provider: 'smtp' };
  } else {
    console.log("\n=================== AUTOMATED WEEKLY EMAIL SUMMARY ===================");
    console.log(`TO: ${recipientEmail} (${recipientName})`);
    console.log("SUBJECT: Your Weekly JanSeva Civic Progress Summary 📬");
    console.log("STATUS: SMTP not fully configured. Outputting email body preview for validation.");
    console.log("=================== HTML EMAIL BODY PREVIEW ===================");
    console.log(htmlContent);
    console.log("===============================================================\n");
    return { sent: true, provider: 'console-log-preview' };
  }
}

// Automated cron run trigger
async function triggerWeeklySummaries() {
  if (!db) {
    console.error("Firestore DB not initialized. Cannot run weekly summaries.");
    return;
  }
  console.log("Triggering scheduled weekly automated email summary run...");
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    let sentCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const weeklyEmailSummaryEnabled = userData.weeklyEmailSummaryEnabled ?? true;
      const email = userData.email;
      const displayName = userData.displayName || "Citizen";

      if (!weeklyEmailSummaryEnabled || !email) {
        continue;
      }

      // Fetch issues reported by this user
      const issuesRef = collection(db, 'issues');
      const q = query(issuesRef, where('reportedBy', '==', userId));
      const issuesSnap = await getDocs(q);
      
      if (issuesSnap.empty) {
        continue; // No issues reported, avoid sending empty email
      }

      const issues: any[] = [];
      issuesSnap.forEach((docSnap) => {
        issues.push({ id: docSnap.id, ...docSnap.data() });
      });

      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const htmlContent = generateEmailHtml(displayName, issues, appUrl);
      
      await sendSummaryEmail(email, displayName, htmlContent);
      sentCount++;
    }
    console.log(`Weekly automated summary process completed. Sent ${sentCount} summary emails.`);
  } catch (error) {
    console.error("Error running automated weekly email summaries:", error);
  }
}

// Setup a persistent check task (checks every hour; executes on Sunday mornings at 8:00 AM)
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 8) {
    console.log("Running scheduled Sunday automated email run...");
    triggerWeeklySummaries();
  }
}, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON requests up to 10mb for base64 image uploads
  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini SDK with telemetry User-Agent header
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Endpoint 1: Analyze civic issue image
  app.post("/api/gemini/analyze", async (req: express.Request, res: express.Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      const prompt = `Analyze this civic issue image. Return ONLY a JSON object:
      {
        "category": "Pothole" | "Broken Streetlight" | "Water Leakage" | "Waste/Garbage" | "Damaged Road" | "Sewage Issue" | "Public Property Damage" | "Other",
        "severity": "Low" | "Medium" | "High" | "Critical",
        "title": "A short descriptive title (5-8 words)",
        "description": "A descriptive 2-3 sentence summary of the issue.",
        "suggested_department": "Name of relevant civic department (e.g. Roads & Highways, Public Works, Water Sanitation)",
        "confidence": 0.0 to 1.0
      }
      Do NOT include any markdown backticks or formatting. Return strictly the raw JSON structure.`;

      let result;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64
              }
            },
            { text: prompt }
          ],
        });

        const text = response.text || "";
        const cleanedText = text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanedText);
      } catch (geminiErr: any) {
        console.warn("Gemini Live API unavailable, using fallback image analyzer:", geminiErr);
        // Clean fallback response
        result = {
          category: "Other",
          severity: "Medium",
          title: "Reported Community Issue",
          description: "A community issue has been uploaded and registered with the local municipal authority for inspection.",
          suggested_department: "Public Works & Infrastructure",
          confidence: 0.65
        };
      }
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Image Analysis Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze image with Gemini." });
    }
  });

  // API Endpoint 1.5: Categorize text-based civic issue description
  app.post("/api/gemini/categorize-text", async (req: express.Request, res: express.Response) => {
    try {
      const { title, description } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Missing description in request body." });
      }

      const prompt = `You are an AI civic assistant. Analyze the following civic issue reported by a citizen:
      ${title ? `Title: "${title}"` : ""}
      Description: "${description}"

      Based on this description, classify the issue.
      Return ONLY a JSON object with this exact structure:
      {
        "category": "Pothole" | "Broken Streetlight" | "Water Leakage" | "Waste/Garbage" | "Damaged Road" | "Sewage Issue" | "Public Property Damage" | "Other",
        "severity": "Low" | "Medium" | "High" | "Critical",
        "suggested_department": "Name of relevant civic department (e.g. Roads & Highways, Public Works, Water Sanitation)",
        "confidence": 0.0 to 1.0
      }
      Do NOT include any markdown backticks or formatting. Return strictly the raw JSON.`;

      let result;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });

        const text = response.text || "";
        const cleanedText = text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanedText);
      } catch (geminiErr: any) {
        console.warn("Gemini Text Categorizer unavailable, using rule-based fallback:", geminiErr);
        
        // Simple keyword fallback
        const descLower = (description + " " + (title || "")).toLowerCase();
        let category: "Pothole" | "Broken Streetlight" | "Water Leakage" | "Waste/Garbage" | "Damaged Road" | "Sewage Issue" | "Public Property Damage" | "Other" = "Other";
        let dept = "Public Works Department";
        let severity: "Low" | "Medium" | "High" | "Critical" = "Medium";

        if (descLower.includes("light") || descLower.includes("lamp") || descLower.includes("bulb") || descLower.includes("dark")) {
          category = "Broken Streetlight";
          dept = "Public Lighting & Electrical Division";
        } else if (descLower.includes("hole") || descLower.includes("pavement") || descLower.includes("cracks") || descLower.includes("pothole")) {
          category = "Pothole";
          dept = "Roads & Highways Department";
        } else if (descLower.includes("water") || descLower.includes("leak") || descLower.includes("pipe") || descLower.includes("burst")) {
          category = "Water Leakage";
          dept = "Water & Sanitation Division";
        } else if (descLower.includes("sewage") || descLower.includes("smell") || descLower.includes("drain") || descLower.includes("gutter")) {
          category = "Sewage Issue";
          dept = "Sanitation & Sewerage Department";
        } else if (descLower.includes("garbage") || descLower.includes("trash") || descLower.includes("waste") || descLower.includes("litter") || descLower.includes("dump")) {
          category = "Waste/Garbage";
          dept = "Waste Management & Sanitation Services";
        } else if (descLower.includes("road") || descLower.includes("asphalt") || descLower.includes("construction")) {
          category = "Damaged Road";
          dept = "Roads & Highways Department";
        } else if (descLower.includes("bench") || descLower.includes("sign") || descLower.includes("park") || descLower.includes("vandalism") || descLower.includes("fence")) {
          category = "Public Property Damage";
          dept = "Parks, Recreation & Public Lands";
        }

        if (descLower.includes("danger") || descLower.includes("accident") || descLower.includes("risk") || descLower.includes("critical") || descLower.includes("injury")) {
          severity = "Critical";
        } else if (descLower.includes("bad") || descLower.includes("broken") || descLower.includes("high")) {
          severity = "High";
        }

        result = {
          category,
          severity,
          suggested_department: dept,
          confidence: 0.7
        };
      }
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Categorize Text Error:", err);
      res.status(500).json({ error: err.message || "Failed to categorize text with Gemini." });
    }
  });

  // API Endpoint 2: Generate AI Insights from issues overview
  app.post("/api/gemini/insights", async (req: express.Request, res: express.Response) => {
    try {
      const { summary } = req.body;
      if (!summary) {
        return res.status(400).json({ error: "Missing summary data in request body." });
      }

      const prompt = `You are a professional civic data analyst. Based on this community issues summary data:
      ${JSON.stringify(summary, null, 2)}
      
      Generate exactly 3 actionable, highly valuable insights and recommendations for the local municipality.
      Return ONLY a JSON array of exactly 3 objects:
      [
        {
          "insight": "Observation on patterns, categories, or resolution bottlenecks.",
          "recommendation": "Concrete actionable solution for the local department.",
          "priority": "High" | "Medium" | "Low"
        }
      ]
      Do NOT include any markdown formatting or backticks. Return strictly the raw JSON array.`;

      let result;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });

        const text = response.text || "";
        const cleanedText = text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanedText);
      } catch (geminiErr: any) {
        console.warn("Gemini Insights API unavailable or rate-limited, using fallback calculations:", geminiErr);
        
        // Dynamically compute beautiful fallback insights from summary data!
        const total = summary.total || 0;
        const resolved = summary.resolved || 0;
        const open = summary.openCount || 0;
        const avgDays = summary.averageResolutionDays || 0;
        const topCatList = summary.topCategories || [];
        const topCat = topCatList[0]?.category || "Pothole";
        const topCatCount = topCatList[0]?.count || 0;
        
        const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        result = [
          {
            insight: `${topCat} is the highest volume civic category, with ${topCatCount} reports logged by community members.`,
            recommendation: `Establish a routine bi-weekly diagnostic run with the regional maintenance crew for ${topCat} hot-spots.`,
            priority: "High"
          },
          {
            insight: `The community has registered ${total} total issues, successfully resolving ${resolved} of them (${resolvedRate}% overall resolution speed).`,
            recommendation: `Launch a monthly spotlight campaign thanking local civic heroes to maintain strong citizen engagement and trust.`,
            priority: "Medium"
          },
          {
            insight: `Average resolution time stands at ${avgDays || 'N/A'} days, showing active progress in local department response latency.`,
            recommendation: `Automate ticket routing to nearby field supervisors based on GPS proximity tags in reported issues.`,
            priority: "Medium"
          }
        ];
      }
      res.json(result);
    } catch (err: any) {
      console.error("Gemini Insights Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI insights." });
    }
  });

  // API Endpoint 3: Manual on-demand weekly email summary trigger
  app.post("/api/issues/send-weekly-summary", async (req: express.Request, res: express.Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing userId in request body." });
      }

      if (!db) {
        return res.status(500).json({ error: "Firestore DB connection not initialized." });
      }

      // Fetch user profile from Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ error: "User profile not found in database." });
      }

      const userData = userSnap.data();
      const email = userData.email;
      const displayName = userData.displayName || "Citizen";

      if (!email) {
        return res.status(400).json({ error: "User profile does not contain a valid email address." });
      }

      // Fetch issues reported by this user
      const issuesRef = collection(db, 'issues');
      const q = query(issuesRef, where('reportedBy', '==', userId));
      const issuesSnap = await getDocs(q);

      const issues: any[] = [];
      issuesSnap.forEach((docSnap) => {
        issues.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Construct application absolute link
      const protocol = req.secure ? 'https' : 'http';
      const hostUrl = `${protocol}://${req.get('host')}`;

      // Build HTML content
      const htmlContent = generateEmailHtml(displayName, issues, hostUrl);

      // Send email
      const delivery = await sendSummaryEmail(email, displayName, htmlContent);

      return res.json({
        success: true,
        message: delivery.provider === 'smtp' 
          ? `Progress report summary successfully emailed to ${email}!` 
          : `Progress report successfully generated & logged to backend terminal! (Simulated summary email sent to ${email})`,
        provider: delivery.provider,
        recipient: email,
        previewHtml: htmlContent
      });
    } catch (err: any) {
      console.error("Manual Weekly Summary Trigger Error:", err);
      res.status(500).json({ error: err.message || "Failed to process weekly summary trigger." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
