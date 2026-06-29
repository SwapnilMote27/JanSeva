export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  condition: (user: { totalReports: number; resolvedIssues: number; points: number; rank?: number }) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: 'first_reporter',
    name: 'First Reporter',
    icon: '📢',
    description: 'Awarded for reporting your first civic issue',
    condition: (u) => u.totalReports >= 1,
  },
  {
    id: 'community_guardian',
    name: 'Community Guardian',
    icon: '🛡️',
    description: 'Awarded for having 3 or more resolved issues',
    condition: (u) => u.resolvedIssues >= 3,
  },
  {
    id: 'expert_analyst',
    name: 'Expert Analyst',
    icon: '🧠',
    description: 'Awarded for earning 1,000+ points and actively solving issues',
    condition: (u) => u.points >= 1000 && u.resolvedIssues >= 1,
  },
  {
    id: 'community_watch',
    name: 'Community Watch',
    icon: '👁️',
    description: 'Reported 10 or more civic issues',
    condition: (u) => u.totalReports >= 10,
  },
  {
    id: 'problem_solver',
    name: 'Problem Solver',
    icon: '🔧',
    description: 'Has 5 or more resolved issues',
    condition: (u) => u.resolvedIssues >= 5,
  },
  {
    id: 'neighborhood_hero',
    name: 'Neighborhood Hero',
    icon: '🦸',
    description: 'Earned 500 or more points',
    condition: (u) => u.points >= 500,
  },
  {
    id: 'top_reporter',
    name: 'Top Reporter',
    icon: '🏆',
    description: 'Reached Top 3 on the community leaderboard',
    condition: (u) => typeof u.rank === 'number' && u.rank <= 3,
  },
];

