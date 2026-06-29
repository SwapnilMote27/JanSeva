import React, { useEffect, useState } from 'react';
import { useIssues } from '@/src/hooks/useIssues';
import { useAuth } from '@/src/hooks/useAuth';
import { jsPDF } from 'jspdf';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  AlertTriangle,
  Download
} from 'lucide-react';

interface AIInsight {
  insight: string;
  recommendation: string;
  priority: 'High' | 'Medium' | 'Low';
}

const PIE_COLORS = ['#1B5E20', '#FF6F00', '#C62828', '#1565C0', '#6A1B9A', '#00695C', '#E65100', '#78909C'];

export const ImpactDashboard: React.FC = () => {
  const { user } = useAuth();
  const { issues, loading: issuesLoading } = useIssues();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Stats Calculations
  const totalCount = issues.length;
  const resolvedIssues = issues.filter((i) => i.status === 'Resolved');
  const resolvedCount = resolvedIssues.length;
  const openCount = totalCount - resolvedCount;

  const avgResolutionDays = React.useMemo(() => {
    if (resolvedCount === 0) return 0;
    let totalDiffMs = 0;
    resolvedIssues.forEach((issue) => {
      if (!issue.reportedAt || !issue.resolvedAt) return;
      const start = issue.reportedAt.toDate ? issue.reportedAt.toDate().getTime() : new Date(issue.reportedAt).getTime();
      const end = issue.resolvedAt.toDate ? issue.resolvedAt.toDate().getTime() : new Date(issue.resolvedAt).getTime();
      totalDiffMs += (end - start);
    });
    // Convert ms to days
    const days = totalDiffMs / (1000 * 60 * 60 * 24);
    return parseFloat((days / resolvedCount).toFixed(1));
  }, [resolvedIssues, resolvedCount]);

  const handleDownloadReport = () => {
    try {
      setDownloading(true);
      const doc = new jsPDF();
      let y = 20;

      // Helper to add a new page if needed
      const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          doc.addPage();
          y = 20;
          // Add small header on subsequent pages
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139); // Slate-500
          doc.text('COMMUNITY HERO - IMPACT & CONTRIBUTIONS REPORT', 20, 12);
          doc.setDrawColor(226, 232, 240); // border
          doc.line(20, 14, 190, 14);
          y = 22;
        }
      };

      // Header block / Title
      doc.setFillColor(27, 94, 32); // Forest Green (#1B5E20)
      doc.rect(20, y, 170, 15, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('COMMUNITY HERO: CIVIC IMPACT REPORT', 25, y + 10);
      y += 23;

      // Sub-header with Meta details
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      const timestamp = new Date().toLocaleString();
      doc.text(`Report Generated: ${timestamp}`, 20, y);
      
      const reporterEmail = user ? user.email || 'Registered Citizen' : 'Guest Citizen';
      doc.text(`User Identity: ${user ? user.displayName : 'Guest User'} (${reporterEmail})`, 20, y + 5);
      y += 12;

      // Draw horizontal line
      doc.setDrawColor(226, 232, 240);
      doc.line(20, y, 190, y);
      y += 8;

      // Section 1: Citizen Profile (if logged in)
      if (user) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(27, 94, 32);
        doc.text('CITIZEN CONTRIBUTOR PROFILE', 20, y);
        y += 7;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85); // Slate-700
        
        // Count user-specific stats
        const myIssues = issues.filter((issue) => issue.reportedBy === user.uid);
        const myResolved = myIssues.filter((issue) => issue.status === 'Resolved').length;

        doc.text(`• Display Name: ${user.displayName}`, 25, y);
        doc.text(`• Community Reputation Points: ${user.points || 0} XP`, 25, y + 6);
        doc.text(`• Total Issues Reported: ${myIssues.length}`, 25, y + 12);
        doc.text(`• Total Issues Resolved: ${myResolved}`, 25, y + 18);
        y += 26;

        // Draw horizontal line
        doc.line(20, y, 190, y);
        y += 8;

        // Section 2: User Contributions List
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(27, 94, 32);
        doc.text('YOUR CIVIC CONTRIBUTIONS', 20, y);
        y += 7;

        if (myIssues.length === 0) {
          doc.setFont('Helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(148, 163, 184); // Slate-400
          doc.text('No reports filed yet. Use the "Report Issue" page to start contributing!', 25, y);
          y += 10;
        } else {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          // Table Headers
          doc.text('Title', 22, y);
          doc.text('Category', 80, y);
          doc.text('Severity', 125, y);
          doc.text('Status', 155, y);
          
          doc.line(20, y + 2, 190, y + 2);
          y += 7;

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);

          myIssues.slice(0, 15).forEach((issue) => {
            checkPageOverflow(8);
            
            // Truncate title if too long
            let title = issue.title || 'Untitled';
            if (title.length > 30) {
              title = title.substring(0, 28) + '...';
            }

            doc.text(title, 22, y);
            doc.text(issue.category || 'Other', 80, y);
            doc.text(issue.severity || 'Medium', 125, y);
            
            // Color status differently if resolved
            if (issue.status === 'Resolved') {
              doc.setTextColor(16, 185, 129); // Emerald-500
              doc.text(issue.status, 155, y);
              doc.setTextColor(51, 65, 85);
            } else {
              doc.text(issue.status || 'Reported', 155, y);
            }

            y += 6;
          });

          if (myIssues.length > 15) {
            y += 2;
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`... and ${myIssues.length - 15} more contributions listed in your online profile.`, 25, y);
            y += 6;
          }
          y += 4;
        }

        // Draw horizontal line
        checkPageOverflow(8);
        doc.line(20, y, 190, y);
        y += 8;
      }

      // Section 3: Community Impact Overview
      checkPageOverflow(30);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(27, 94, 32);
      doc.text('COMMUNITY-WIDE IMPACT STATISTICS', 20, y);
      y += 7;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      doc.text(`• Global Community Active Issues: ${totalCount}`, 25, y);
      doc.text(`• Global Community Resolved Issues: ${resolvedCount}`, 25, y + 6);
      doc.text(`• Global Community Pending Resolution: ${openCount}`, 25, y + 12);
      doc.text(`• Average Time to Resolution: ${resolvedCount > 0 ? `${avgResolutionDays} days` : 'N/A'}`, 25, y + 18);
      y += 26;

      // Draw horizontal line
      checkPageOverflow(8);
      doc.line(20, y, 190, y);
      y += 8;

      // Section 4: AI Insights
      if (insights && insights.length > 0) {
        checkPageOverflow(40);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(27, 94, 32);
        doc.text('GEMINI AI PLATFORM INSIGHTS', 20, y);
        y += 7;

        insights.forEach((ins, index) => {
          checkPageOverflow(20);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42); // Slate-900
          doc.text(`[${ins.priority} Priority] ${ins.insight}`, 22, y);
          y += 5;

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105); // Slate-600
          
          // Split recommendation string into wrapped lines
          const wrappedRecommendation = doc.splitTextToSize(`Recommendation: ${ins.recommendation}`, 160);
          wrappedRecommendation.forEach((line: string) => {
            checkPageOverflow(5);
            doc.text(line, 25, y);
            y += 4.5;
          });
          y += 3;
        });
      }

      // Footer disclaimer / Thank you
      checkPageOverflow(15);
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(27, 94, 32);
      doc.text('Thank you for being a Community Hero and improving our neighborhood! 🌟', 20, y);

      // Save document
      doc.save(`CommunityHero_ImpactReport_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Group by category for Pie Chart
  const categoryData = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    issues.forEach((issue) => {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    });
    return Object.keys(counts).map((cat) => ({
      name: cat,
      value: counts[cat]
    }));
  }, [issues]);

  // Group by week for Bar Chart (last 8 weeks)
  const weeklyData = React.useMemo(() => {
    const data = [];
    const now = new Date();

    // Initialize 8 weeks
    for (let i = 7; i >= 0; i--) {
      const dateStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const label = `Wk -${i}`;
      data.push({
        label,
        count: 0,
        startMs: dateStart.getTime()
      });
    }

    // Populate counts
    issues.forEach((issue) => {
      if (!issue.reportedAt) return;
      const reportedTime = issue.reportedAt.toDate ? issue.reportedAt.toDate().getTime() : new Date(issue.reportedAt).getTime();
      
      // Find matching week
      for (let j = 0; j < 8; j++) {
        const nextStart = j < 7 ? data[j + 1].startMs : now.getTime() + 100000;
        if (reportedTime >= data[j].startMs && reportedTime < nextStart) {
          data[j].count += 1;
          break;
        }
      }
    });

    return data.map((d) => ({ name: d.label, Issues: d.count }));
  }, [issues]);

  // Call Gemini proxy for AI Insights
  useEffect(() => {
    if (issuesLoading || totalCount === 0) return;

    const fetchInsights = async () => {
      setInsightsLoading(true);
      setInsightsError(null);

      // Aggregate simplified data for Gemini summary
      const categorySummary: { [key: string]: number } = {};
      issues.forEach((issue) => {
        categorySummary[issue.category] = (categorySummary[issue.category] || 0) + 1;
      });

      const topCategories = Object.keys(categorySummary)
        .map((cat) => ({ category: cat, count: categorySummary[cat] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const summaryPayload = {
        total: totalCount,
        resolved: resolvedCount,
        openCount,
        averageResolutionDays: avgResolutionDays,
        topCategories
      };

      try {
        const response = await fetch('/api/gemini/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: summaryPayload }),
        });

        if (!response.ok) {
          throw new Error('Could not fetch AI analytics.');
        }

        const data = await response.json();
        setInsights(data);
      } catch (err: any) {
        console.error(err);
        setInsightsError('Gemini is currently optimizing database indexes. Refresh in a moment!');
      } finally {
        setInsightsLoading(false);
      }
    };

    fetchInsights();
  }, [issuesLoading, totalCount, resolvedCount, openCount, avgResolutionDays]);

  if (issuesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-sans">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium mt-3">Loading impact analytics dashboard...</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm font-sans">
        <span className="text-4xl">📊</span>
        <h2 className="text-xl font-bold text-gray-900 mt-2">No Impact Data Available</h2>
        <p className="text-sm text-gray-500 mt-1">Be the first to report an issue in your community to bootstrap the impact dashboard!</p>
      </div>
    );
  }

  return (
    <div id="impact-dashboard-container" className="space-y-8 font-sans">
      
      {/* Header section with Download report button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-6">
        <div className="text-left">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Civic Impact Dashboard
          </h1>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
            Real-time insights, user contributions, and verification metrics of community improvement.
          </p>
        </div>
        <button
          id="download-report-btn"
          onClick={handleDownloadReport}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer active:scale-95 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Generating PDF...' : 'Download Report'}</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        
        {/* Total reported */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase font-mono tracking-wider text-gray-400">Total Issues</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{totalCount}</p>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase font-mono tracking-wider text-gray-400">Resolved</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono">{resolvedCount}</p>
          </div>
        </div>

        {/* Open */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase font-mono tracking-wider text-gray-400">Open Reports</p>
            <p className="text-2xl font-bold text-amber-600 font-mono">{openCount}</p>
          </div>
        </div>

        {/* Avg resolution */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase font-mono tracking-wider text-gray-400">Resolution Speed</p>
            <p className="text-2xl font-bold text-blue-800 font-mono">
              {resolvedCount > 0 ? `${avgResolutionDays}d` : 'N/A'}
            </p>
          </div>
        </div>

      </div>

      {/* Visual Analytics / Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
        
        {/* Category breakdown (Pie) */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Issues by Category</h3>
            <p className="text-xs text-gray-400 mt-0.5">Distribution of reported municipal hazards.</p>
          </div>
          <div className="h-[280px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#FFF', border: '1px solid #F1F5F9', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend iconSize={10} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px', color: '#64748B' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Temporal reports (Bar) */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Weekly Report Volume</h3>
            <p className="text-xs text-gray-400 mt-0.5">Trend analysis over the last 8 weeks.</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #F1F5F9', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="Issues" fill="#1B5E20" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* AI Insights Card Powered by Gemini */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-left space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Gemini Data Insights</h3>
              <p className="text-[11px] text-gray-400">Automated municipal audit analyzed by Google Gemini AI.</p>
            </div>
          </div>
          <span className="text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-800 px-2 py-1 rounded-sm tracking-wide">
            1.5 Flash Model
          </span>
        </div>

        {/* AI response content */}
        {insightsLoading ? (
          <div className="space-y-4 py-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded-md w-1/3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-50 rounded-md w-full"></div>
              <div className="h-3 bg-gray-50 rounded-md w-5/6"></div>
            </div>
            <div className="h-20 bg-gray-50 rounded-xl w-full flex items-center justify-center text-xs text-gray-400 font-medium">
              🤖 Analyzing civic category distributions & calculating resolution times...
            </div>
          </div>
        ) : insightsError ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{insightsError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((ins, index) => {
              let priorityColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
              if (ins.priority === 'High') {
                priorityColor = 'bg-red-50 text-red-800 border-red-100';
              } else if (ins.priority === 'Medium') {
                priorityColor = 'bg-orange-50 text-orange-800 border-orange-100';
              }

              return (
                <div key={index} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-gray-400">Insight #{index + 1}</span>
                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${priorityColor}`}>
                      {ins.priority} Priority
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 leading-snug">{ins.insight}</h4>
                  <div className="border-t border-dashed border-gray-200/60 pt-2 text-xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Recommendation</p>
                    <p className="text-gray-600 leading-relaxed font-medium">{ins.recommendation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
