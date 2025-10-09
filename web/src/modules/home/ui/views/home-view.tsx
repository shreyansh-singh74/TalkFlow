"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CalendarIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TargetIcon,
  ActivityIcon,
  MicIcon,
  VideoIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ZapIcon,
  UsersIcon,
  BarChart3Icon,
  SettingsIcon,
  PlayIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Mock data - Replace with real API calls from tRPC
const MOCK_USER_STATS = {
  totalSessions: 24,
  totalMinutes: 186,
  soundsMastered: 12,
  currentStreak: 7,
  weeklyGoal: 150, // minutes
  weeklyProgress: 94, // minutes
  accuracy: 78,
  improvement: 15, // percentage
  previousWeekSessions: 21,
  previousWeekMinutes: 142,
  previousWeekAccuracy: 73,
  monthlyGoal: 600,
  monthlyProgress: 486,
};

const MOCK_RECENT_SESSIONS = [
  {
    id: '1',
    date: '2025-09-30',
    topic: 'Food & Dining',
    duration: 8,
    accuracy: 82,
    soundsPracticed: ['th', 'r', 'v'],
    status: 'completed'
  },
  {
    id: '2',
    date: '2025-09-29',
    topic: 'Work & Career',
    duration: 12,
    accuracy: 76,
    soundsPracticed: ['w', 'l'],
    status: 'completed'
  },
  {
    id: '3',
    date: '2025-09-28',
    topic: 'Travel',
    duration: 6,
    accuracy: 88,
    soundsPracticed: ['th', 'sh'],
    status: 'completed'
  },
];

const MOCK_PROBLEM_SOUNDS = [
  { sound: 'th', attempts: 45, accuracy: 62, improvement: -5, status: 'needs-work' },
  { sound: 'r', attempts: 38, accuracy: 71, improvement: 12, status: 'improving' },
  { sound: 'v', attempts: 32, accuracy: 85, improvement: 18, status: 'mastered' },
  { sound: 'w', attempts: 28, accuracy: 68, improvement: 8, status: 'improving' },
];

const MOCK_WEEKLY_ACTIVITY = [
  { day: 'Mon', minutes: 15, sessions: 2 },
  { day: 'Tue', minutes: 22, sessions: 3 },
  { day: 'Wed', minutes: 18, sessions: 2 },
  { day: 'Thu', minutes: 12, sessions: 1 },
  { day: 'Fri', minutes: 20, sessions: 2 },
  { day: 'Sat', minutes: 7, sessions: 1 },
  { day: 'Sun', minutes: 0, sessions: 0 },
];

const MOCK_FOCUS_AREAS = [
  { sound: 'th', attempts: 45, accuracy: 62, improvement: -5, status: 'high-priority', category: 'Consonants' },
  { sound: 'r', attempts: 38, accuracy: 71, improvement: 12, status: 'improving', category: 'Consonants' },
  { sound: 'v', attempts: 32, accuracy: 85, improvement: 18, status: 'mastered', category: 'Consonants' },
  { sound: 'w', attempts: 28, accuracy: 68, improvement: 8, status: 'improving', category: 'Consonants' },
  { sound: 'l', attempts: 25, accuracy: 82, improvement: 5, status: 'improving', category: 'Consonants' },
];

export const HomeView = () => {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  const handleStartPractice = () => {
    router.push('/meetings');
  };

  const weeklyProgressPercent = (MOCK_USER_STATS.weeklyProgress / MOCK_USER_STATS.weeklyGoal) * 100;
  const maxWeeklyMinutes = Math.max(...MOCK_WEEKLY_ACTIVITY.map(d => d.minutes));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            {isPending ? (
              <div className="h-8 bg-muted animate-pulse rounded w-64" />
            ) : (
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                Welcome back, {userName}
              </h1>
            )}
            <p className="text-muted-foreground mt-1 text-sm">
              Here's your learning progress overview
            </p>
          </div>
          <Button 
            size="lg"
            onClick={handleStartPractice}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <MicIcon className="mr-2 h-4 w-4" />
            Start New Session
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <VideoIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Total Sessions</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUpIcon className="h-3 w-3" />
                  <span className="text-xs">+{MOCK_USER_STATS.totalSessions - MOCK_USER_STATS.previousWeekSessions}</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-foreground">{MOCK_USER_STATS.totalSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {MOCK_USER_STATS.totalSessions - MOCK_USER_STATS.previousWeekSessions} this week
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Practice Time</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUpIcon className="h-3 w-3" />
                  <span className="text-xs">+{MOCK_USER_STATS.totalMinutes - MOCK_USER_STATS.previousWeekMinutes}m</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-foreground">{MOCK_USER_STATS.totalMinutes}m</div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.floor(MOCK_USER_STATS.totalMinutes / 60)}h {MOCK_USER_STATS.totalMinutes % 60}m total
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Sounds Mastered</span>
                </div>
                <div className="flex items-center gap-1 text-blue-600">
                  <BarChart3Icon className="h-3 w-3" />
                  <span className="text-xs">24%</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-foreground">{MOCK_USER_STATS.soundsMastered}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Out of 50 total sounds
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ZapIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Current Streak</span>
                </div>
                <div className="flex items-center gap-1 text-orange-600">
                  <ActivityIcon className="h-3 w-3" />
                  <span className="text-xs">Active</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-foreground">{MOCK_USER_STATS.currentStreak}</div>
              <p className="text-xs text-muted-foreground mt-1">
                days in a row
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column - Performance Analytics */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Performance Overview</CardTitle>
                    <CardDescription>Your accuracy and improvement metrics</CardDescription>
                  </div>
                  <BarChart3Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Main Accuracy Circle */}
                  <div className="md:col-span-1 flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-4">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-muted/20"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - MOCK_USER_STATS.accuracy / 100)}`}
                          className="text-primary transition-all duration-300"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-semibold text-foreground">{MOCK_USER_STATS.accuracy}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-foreground">Overall Accuracy</div>
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                        <TrendingUpIcon className="h-3 w-3" />
                        <span>+{MOCK_USER_STATS.improvement}% vs last month</span>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Goal Progress */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Weekly Goal</span>
                        <span className="text-sm text-muted-foreground">
                          {MOCK_USER_STATS.weeklyProgress} / {MOCK_USER_STATS.weeklyGoal} min
                        </span>
                      </div>
                      <Progress value={weeklyProgressPercent} className="h-2" />
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{Math.round(weeklyProgressPercent)}% complete</span>
                        <span>{MOCK_USER_STATS.weeklyGoal - MOCK_USER_STATS.weeklyProgress} min remaining</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Monthly Goal</span>
                        <span className="text-sm text-muted-foreground">
                          {MOCK_USER_STATS.monthlyProgress} / {MOCK_USER_STATS.monthlyGoal} min
                        </span>
                      </div>
                      <Progress value={(MOCK_USER_STATS.monthlyProgress / MOCK_USER_STATS.monthlyGoal) * 100} className="h-2" />
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{Math.round((MOCK_USER_STATS.monthlyProgress / MOCK_USER_STATS.monthlyGoal) * 100)}% complete</span>
                        <span>{MOCK_USER_STATS.monthlyGoal - MOCK_USER_STATS.monthlyProgress} min remaining</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Daily practice activity this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_WEEKLY_ACTIVITY.map((day, index) => (
                    <div key={index} className="group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-sm font-medium text-muted-foreground">
                          {day.day}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 group-hover:h-4 ${
                                  day.minutes > 15 
                                    ? 'bg-primary' 
                                    : day.minutes > 0
                                    ? 'bg-primary/70'
                                    : 'bg-muted'
                                }`}
                                style={{ width: `${Math.max(day.minutes > 0 ? (day.minutes / maxWeeklyMinutes) * 100 : 5, day.minutes === 0 ? 0 : 8)}%` }}
                              />
                            </div>
                            <div className="w-12 text-sm font-medium text-foreground text-right">
                              {day.minutes}m
                            </div>
                            <div className="w-16 text-xs text-muted-foreground text-right">
                              {day.sessions} {day.sessions === 1 ? 'session' : 'sessions'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Total: {MOCK_WEEKLY_ACTIVITY.reduce((sum, day) => sum + day.minutes, 0)}m</span>
                    <span>{MOCK_WEEKLY_ACTIVITY.reduce((sum, day) => sum + day.sessions, 0)} sessions</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Sessions</CardTitle>
                    <CardDescription>Your latest practice sessions</CardDescription>
                  </div>
                  <Link href="/meetings">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {MOCK_RECENT_SESSIONS.map((session) => (
                    <div 
                      key={session.id}
                      className="p-6 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-foreground">{session.topic}</h4>
                            <Badge variant="outline" className="text-xs">
                              {session.duration}m
                            </Badge>
                            <Badge 
                              variant={session.accuracy >= 80 ? "default" : session.accuracy >= 60 ? "secondary" : "destructive"} 
                              className="text-xs"
                            >
                              {session.accuracy}% accuracy
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <ActivityIcon className="h-3 w-3" />
                              {session.soundsPracticed.length} sounds practiced
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {session.soundsPracticed.map((sound) => (
                              <Badge key={sound} variant="outline" className="text-xs">
                                {sound}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                          <Button variant="ghost" size="sm">
                            <ArrowRightIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Insights & Actions */}
          <div className="space-y-8">
            
            {/* Focus Areas */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Focus Areas</CardTitle>
                    <CardDescription>Priority sounds for improvement</CardDescription>
                  </div>
                  <Link href="/agents">
                    <Button variant="ghost" size="sm">
                      Details
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {MOCK_FOCUS_AREAS.map((sound) => (
                  <div key={sound.sound} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-semibold text-foreground">{sound.sound}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{sound.sound} sound</div>
                          <div className="text-xs text-muted-foreground">{sound.category}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{sound.accuracy}%</span>
                        {sound.improvement > 0 ? (
                          <div className="flex items-center text-green-600">
                            <TrendingUpIcon className="h-3 w-3" />
                            <span className="text-xs ml-1">+{sound.improvement}%</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <TrendingDownIcon className="h-3 w-3" />
                            <span className="text-xs ml-1">{sound.improvement}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{sound.attempts} attempts</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sound.status === 'mastered' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : sound.status === 'high-priority'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          {sound.status === 'mastered' ? 'Mastered' : sound.status === 'high-priority' ? 'High Priority' : 'Improving'}
                        </span>
                      </div>
                      <Progress value={sound.accuracy} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Start practicing or manage your learning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start"
                  onClick={handleStartPractice}
                >
                  <MicIcon className="mr-3 h-4 w-4" />
                  Start Practice Session
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/meetings')}
                >
                  <VideoIcon className="mr-3 h-4 w-4" />
                  View All Meetings
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/agents')}
                >
                  <SettingsIcon className="mr-3 h-4 w-4" />
                  Manage AI Tutors
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/agents')}
                >
                  <BarChart3Icon className="mr-3 h-4 w-4" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};