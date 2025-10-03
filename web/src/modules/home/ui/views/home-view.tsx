"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AwardIcon,
  TargetIcon,
  ActivityIcon,
  MicIcon,
  VideoIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ZapIcon
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

const MOCK_ACHIEVEMENTS = [
  { id: '1', title: 'Week Warrior', description: '7 day streak', icon: '🔥', earned: true },
  { id: '2', title: 'Sound Master', description: 'Master 10 sounds', icon: '🎯', earned: true },
  { id: '3', title: 'Practice Pro', description: '20 sessions completed', icon: '⭐', earned: true },
  { id: '4', title: 'Marathon Talker', description: '3 hours total practice', icon: '🏆', earned: false },
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {isPending ? (
              <div className="h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded w-64" />
            ) : (
              <h1 className="text-3xl md:text-4xl font-bold">
                Welcome back, {userName}! 👋
              </h1>
            )}
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Here's your learning progress overview
            </p>
          </div>
          <Button 
            size="lg"
            onClick={handleStartPractice}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <MicIcon className="mr-2 h-5 w-5" />
            Start New Session
          </Button>
        </div>

        {/* Key Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Sessions
                </CardTitle>
                <VideoIcon className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_USER_STATS.totalSessions}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                +3 this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Practice Time
                </CardTitle>
                <ClockIcon className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_USER_STATS.totalMinutes}m</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                3 hours 6 minutes total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Sounds Mastered
                </CardTitle>
                <AwardIcon className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_USER_STATS.soundsMastered}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Out of 50 sounds
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Current Streak
                </CardTitle>
                <ZapIcon className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {MOCK_USER_STATS.currentStreak}
                <span className="text-2xl">🔥</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Keep it going!
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Left Column - Weekly Progress & Activity */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Weekly Goal Progress */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Weekly Goal Progress</CardTitle>
                    <CardDescription>
                      {MOCK_USER_STATS.weeklyProgress} of {MOCK_USER_STATS.weeklyGoal} minutes
                    </CardDescription>
                  </div>
                  <TargetIcon className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{Math.round(weeklyProgressPercent)}% Complete</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {MOCK_USER_STATS.weeklyGoal - MOCK_USER_STATS.weeklyProgress} min remaining
                    </span>
                  </div>
                  <Progress value={weeklyProgressPercent} className="h-3" />
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <TrendingUpIcon className="h-4 w-4" />
                  <span>You're ahead of last week by 15 minutes!</span>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>This Week's Activity</CardTitle>
                <CardDescription>Daily practice minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_WEEKLY_ACTIVITY.map((day, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {day.day}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-8 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                day.minutes > 15 
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                                  : day.minutes > 0
                                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                  : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                              style={{ width: `${(day.minutes / maxWeeklyMinutes) * 100}%` }}
                            />
                          </div>
                          <div className="w-16 text-sm font-medium text-right">
                            {day.minutes}m
                          </div>
                        </div>
                      </div>
                      <div className="w-12 text-xs text-slate-500 text-right">
                        {day.sessions} {day.sessions === 1 ? 'session' : 'sessions'}
                      </div>
                    </div>
                  ))}
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
              <CardContent>
                <div className="space-y-4">
                  {MOCK_RECENT_SESSIONS.map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{session.topic}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {session.duration}m
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <ActivityIcon className="h-3 w-3" />
                            {session.accuracy}% accuracy
                          </span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {session.soundsPracticed.map((sound) => (
                            <Badge key={sound} variant="outline" className="text-xs">
                              {sound}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Problem Sounds & Achievements */}
          <div className="space-y-6">
            
            {/* Overall Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
                <CardDescription>Your improvement metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Accuracy Score</span>
                    <span className="text-2xl font-bold">{MOCK_USER_STATS.accuracy}%</span>
                  </div>
                  <Progress value={MOCK_USER_STATS.accuracy} className="h-2" />
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <TrendingUpIcon className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    +{MOCK_USER_STATS.improvement}% improvement this month
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Problem Sounds */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Problem Sounds</CardTitle>
                    <CardDescription>Focus areas for improvement</CardDescription>
                  </div>
                  <Link href="/agents">
                    <Button variant="ghost" size="sm">
                      Details
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_PROBLEM_SOUNDS.map((sound) => (
                    <div key={sound.sound} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{sound.sound}</span>
                          {sound.status === 'mastered' && (
                            <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                          )}
                          {sound.status === 'needs-work' && (
                            <AlertCircleIcon className="h-4 w-4 text-orange-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{sound.accuracy}%</span>
                          {sound.improvement > 0 ? (
                            <span className="flex items-center text-green-600">
                              <TrendingUpIcon className="h-3 w-3" />
                              +{sound.improvement}%
                            </span>
                          ) : (
                            <span className="flex items-center text-red-600">
                              <TrendingDownIcon className="h-3 w-3" />
                              {sound.improvement}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress value={sound.accuracy} className="h-1.5" />
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {sound.attempts} attempts
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card>
              <CardHeader>
                <CardTitle>Achievements</CardTitle>
                <CardDescription>Your milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {MOCK_ACHIEVEMENTS.map((achievement) => (
                    <div 
                      key={achievement.id}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        achievement.earned
                          ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700'
                          : 'border-slate-200 dark:border-slate-800 opacity-50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{achievement.icon}</div>
                      <div className="text-xs font-medium mb-1">{achievement.title}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {achievement.description}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleStartPractice}
                >
                  <MicIcon className="mr-2 h-4 w-4" />
                  Practice Weak Sounds
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/meetings')}
                >
                  <VideoIcon className="mr-2 h-4 w-4" />
                  Join Group Session
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/agents')}
                >
                  <SparklesIcon className="mr-2 h-4 w-4" />
                  View Detailed Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};