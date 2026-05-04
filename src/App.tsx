/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Calendar, CheckSquare, Clock, GraduationCap, LayoutDashboard, Library, Plus, RefreshCcw, Settings, Trash2, AlertCircle, ChevronLeft, ChevronRight, Zap, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { format, isSameDay, parseISO, startOfDay, differenceInMinutes, addDays, addMinutes, setHours, setMinutes, isBefore } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, CartesianGrid } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Toaster, toast } from 'sonner';

import { useLocalStorage } from './hooks/useLocalStorage';
import { StudyTask, ProtectedBlock, ResourceLink, Flashcard, ScheduledChunk } from './types';
import { generateSchedule, calculatePriorityScore } from './lib/engine';

// --- Sub-components (could be in separate files in a larger project) ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
      active 
        ? "bg-sidebar-accent text-white" 
        : "text-white/60 hover:bg-white/5 hover:text-white"
    )}
  >
    <Icon className={cn("w-4 h-4 transition-transform duration-200", active ? "text-primary" : "group-hover:scale-110")} />
    <span>{label}</span>
  </button>
);

// --- Main Application ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'schedule' | 'flashcards' | 'resources' | 'settings' | 'timer'>('dashboard');
  
  // Data State
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [blocks, setBlocks] = useState<ProtectedBlock[]>([]);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [schedule, setSchedule] = useState<ScheduledChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // FLASHCARD STATES (Separated for logic purity)
  const [mainCardIndex, setMainCardIndex] = useState(0);
  const [mainCardFlipped, setMainCardFlipped] = useState(false);
  const [dashCardIndex, setDashCardIndex] = useState(0);
  const [dashCardFlipped, setDashCardFlipped] = useState(false);

  // Fetch data
  useEffect(() => {
    async function init() {
      try {
        const [t, b, f, s] = await Promise.all([
          fetch('/api/tasks').then(r => r.json()),
          fetch('/api/blocks').then(r => r.json()),
          fetch('/api/flashcards').then(r => r.json()),
          fetch('/api/schedule').then(r => r.json()),
        ]);
        setTasks(t);
        setBlocks(b);
        setFlashcards(f);
        setSchedule(s);
        
        if (s.length === 0 && t.length > 0) {
          const initialSchedule = generateSchedule(t, b, new Date());
          setSchedule(initialSchedule);
          // Sync it
          fetch('/api/schedule/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialSchedule)
          });
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        toast.error("Systems Offline: Backend connection failed.");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Compute Schedule on demand or via refresh button
  const handleReshuffle = async () => {
    const newSchedule = generateSchedule(tasks, blocks, new Date());
    
    // Sync to backend DB
    try {
      await fetch('/api/schedule/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });
      setSchedule(newSchedule);
      toast.success("Workload reshuffled successfully!");
    } catch (err) {
      toast.error("Failed to sync schedule to database.");
    }
  };

  const handleUpdateTasks = async (newTasks: StudyTask[]) => {
    setTasks(newTasks);
    // Note: In real prod, we'd sync individual diffs, but for this engineering tool 
    // we assume the UI manages the collection and the API handles specific adds/updates 
    // (See individual component implementations for backend sync calls)
  };

  const tasksCompleted = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks]);
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;

  const todayChunks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return schedule.filter(chunk => {
      // Logic matching "where scheduled_date = ?"
      const chunkDate = chunk.startTime.split('T')[0];
      return chunkDate === todayStr;
    });
  }, [schedule]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 flex overflow-hidden">
      <Toaster position="top-right" richColors />
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-sidebar-border flex flex-col p-6 bg-sidebar shrink-0">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
            <GraduationCap className="text-primary w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg text-primary leading-none">STUDY_SMART</h1>
            <p className="text-[10px] opacity-40 font-mono mt-1 uppercase tracking-tighter">v2.4.0 • ENG_STUDENT</p>
          </div>
        </div>

        <nav className="space-y-1 grow">
          <div className="text-[11px] uppercase opacity-30 font-bold mb-4 px-2 tracking-widest">Main Engine</div>
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={CheckSquare} label="Requirements" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
          <SidebarItem icon={Calendar} label="Optimization" active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} />
          <SidebarItem icon={BookOpen} label="Flashcards" active={activeTab === 'flashcards'} onClick={() => setActiveTab('flashcards')} />
          <SidebarItem icon={Library} label="Library" active={activeTab === 'resources'} onClick={() => setActiveTab('resources')} />
          <SidebarItem icon={Clock} label="Pomodoro" active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} />
        </nav>

        <div className="pt-6 border-t border-sidebar-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">
            PP
          </div>
          <div className="grow">
            <div className="text-xs font-bold">Pratik A. Patil</div>
            <div className="text-[10px] opacity-40">B.Tech CSE - Yr 1</div>
          </div>
          <button className="text-zinc-600 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="grow overflow-y-auto relative h-screen">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-10 py-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{format(new Date(), 'EEEE, MMM dd')}</h2>
            <p className="text-zinc-500 text-sm mt-1">No. of task remaining: {tasks.filter(t => t.status !== 'completed').length}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleReshuffle} 
              className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              TASK OVERTIME SHUFFLE
            </Button>
          </div>
        </header>

        <div className="px-10 py-4 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard 
                todayChunks={todayChunks} 
                progress={progressPercent} 
                tasksCompleted={tasksCompleted}
                tasks={tasks}
                flashcards={flashcards}
                setCards={setFlashcards}
                dashCardIndex={dashCardIndex}
                setDashCardIndex={setDashCardIndex}
                dashCardFlipped={dashCardFlipped}
                setDashCardFlipped={setDashCardFlipped}
                onReshuffle={handleReshuffle}
                blocks={blocks}
              />}
              {activeTab === 'tasks' && <TaskInventory tasks={tasks} setTasks={setTasks} />}
              {activeTab === 'schedule' && <ScheduleView tasks={tasks} blocks={blocks} schedule={schedule} setSchedule={setSchedule} />}
              {activeTab === 'timer' && <TimerView />}
              {activeTab === 'flashcards' && <FlashcardsView cards={flashcards} setCards={setFlashcards} />}
              {activeTab === 'resources' && <ResourcesTab resources={resources} setResources={setResources} />}
              {activeTab === 'settings' && <SettingsTab blocks={blocks} setBlocks={setBlocks} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Dashboard View ---
const consistencyData = [
  { day: 'Mon', hours: 4.5 },
  { day: 'Tue', hours: 3.2 },
  { day: 'Wed', hours: 5.0 },
  { day: 'Thu', hours: 2.8 },
  { day: 'Fri', hours: 4.8 },
  { day: 'Sat', hours: 6.2 },
  { day: 'Sun', hours: 3.5 },
];

function classifyTask(task: StudyTask): 'Critical' | 'Standard' | 'Backlog' {
  const diffHours = differenceInMinutes(parseISO(task.deadline), new Date()) / 60;
  
  if (diffHours <= 48 || (task.confidence <= 3 && task.weightage >= 8)) {
    return 'Critical';
  }
  if (diffHours <= 168) {
    return 'Standard';
  }
  return 'Backlog';
}

function Dashboard({ 
  todayChunks, progress, tasksCompleted, tasks, flashcards, setCards,
  dashCardIndex, setDashCardIndex, dashCardFlipped, setDashCardFlipped,
  onReshuffle, blocks
}: { 
  todayChunks: ScheduledChunk[], progress: number, tasksCompleted: number, tasks: StudyTask[], flashcards: Flashcard[], setCards: (cards: Flashcard[]) => void,
  dashCardIndex: number, setDashCardIndex: (i: number) => void, dashCardFlipped: boolean, setDashCardFlipped: (f: boolean) => void,
  onReshuffle: () => void,
  blocks: ProtectedBlock[]
}) {
  const currentWeekTasks = useMemo(() => {
    const now = new Date();
    const weekAgo = addDays(now, -7);
    return tasks.filter(t => parseISO(t.deadline) >= weekAgo);
  }, [tasks]);

  const sortedTodayChunks = useMemo(() => {
    return [...todayChunks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [todayChunks]);

  const prevWeekTasks = useMemo(() => {
    const now = new Date();
    const weekAgo = addDays(now, -7);
    const twoWeeksAgo = addDays(now, -14);
    return tasks.filter(t => {
      const d = parseISO(t.deadline);
      return d >= twoWeeksAgo && d < weekAgo;
    });
  }, [tasks]);

  const calculateEfficiency = (tks: StudyTask[]) => {
    if (tks.length === 0) return 0;
    const completed = tks.filter(t => t.status === 'completed').length;
    return (completed / tks.length) * 100;
  };

  const efficiency = calculateEfficiency(currentWeekTasks);
  const prevEfficiency = calculateEfficiency(prevWeekTasks);
  const delta = efficiency - prevEfficiency;

  const weeklyCategoryData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(now, -6 + i);
      const dayName = days[date.getDay()];
      
      const dayTasks = tasks.filter(t => 
        t.status === 'completed' && 
        t.completedAt && 
        isSameDay(parseISO(t.completedAt), date)
      );

      const data: any = { day: dayName };
      ['Theory', 'Lab', 'Project', 'Revision'].forEach(cat => {
        data[cat] = dayTasks
          .filter(t => t.category === cat)
          .reduce((acc, t) => acc + (t.estimatedMinutes / 60), 0);
      });
      return data;
    });
  }, [tasks]);

  const categorizedTasks = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'completed');
    return {
      Critical: active.filter(t => classifyTask(t) === 'Critical'),
      Standard: active.filter(t => classifyTask(t) === 'Standard'),
      Backlog: active.filter(t => classifyTask(t) === 'Backlog'),
    };
  }, [tasks]);

  // Widget State - Filtered for HARD cards
  const hardCards = useMemo(() => flashcards.filter(c => c.deck_status === 'Hard'), [flashcards]);
  const currentCard = hardCards[dashCardIndex];

  const updateDeckStatus = async (id: string, deck_status: 'Easy' | 'Hard') => {
    await fetch(`/api/flashcards/${id}/deck-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_status })
    });
    
    // Optimistic Update
    const updatedCards = flashcards.map(c => c.id === id ? { ...c, deck_status } : c);
    setCards(updatedCards);
    setDashCardFlipped(false);
    
    // If it was marked Easy, it removed from queue, we might need to adjust index
    if (deck_status === 'Easy') {
      if (dashCardIndex >= hardCards.length - 1 && dashCardIndex > 0) {
        setDashCardIndex(dashCardIndex - 1);
      }
    }
  };

  const handleNext = () => {
    if (dashCardIndex < hardCards.length - 1) {
      setDashCardIndex(dashCardIndex + 1);
      setDashCardFlipped(false);
    }
  };

  const handlePrev = () => {
    if (dashCardIndex > 0) {
      setDashCardIndex(dashCardIndex - 1);
      setDashCardFlipped(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr] gap-6">
      {/* Summary Cards */}
      <div className="space-y-6">
        {/* Tiered Task Priority Sections */}
        <section className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-destructive uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                Very Important
              </h3>
              <div className="space-y-2">
                {categorizedTasks.Critical.length > 0 ? categorizedTasks.Critical.map(t => (
                  <div key={t.id} className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl">
                    <h4 className="font-bold text-sm text-white/90">{t.title}</h4>
                    <p className="text-[10px] font-mono opacity-40 uppercase mt-1">DUE: {format(parseISO(t.deadline), 'MMM dd')} • CRITICALITY HIGH</p>
                  </div>
                )) : <div className="text-[10px] opacity-20 font-mono italic">NO CRITICAL THREATS</div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3">Pending Tasks</h3>
              {categorizedTasks.Standard.map(t => (
                <div key={t.id} className="p-3 bg-card border border-border rounded-lg text-xs">
                  <div className="font-bold text-white/80">{t.title}</div>
                  <div className="text-[9px] opacity-40 font-mono mt-1">DUE {format(parseISO(t.deadline), 'EEE')}</div>
                </div>
              ))}
              {categorizedTasks.Standard.length === 0 && <div className="text-[10px] opacity-20 font-mono uppercase">Queue Clear</div>}
            </div>
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-3">Less Important</h3>
              {categorizedTasks.Backlog.map(t => (
                <div key={t.id} className="p-3 bg-card border border-border rounded-lg text-xs opacity-60">
                   <div className="font-bold text-white/80">{t.title}</div>
                   <div className="text-[9px] opacity-30 font-mono mt-1">DUE {format(parseISO(t.deadline), 'MMM dd')}</div>
                </div>
              ))}
              {categorizedTasks.Backlog.length === 0 && <div className="text-[10px] opacity-20 font-mono uppercase">No Backlog</div>}
            </div>
          </div>
        </section>

        <Card className="flex flex-col p-0 overflow-hidden bg-card border-border shadow-xl">
          <div className="p-4 border-b border-border flex justify-between items-center bg-white/5">
            <h3 className="font-bold text-sm tracking-tight text-white/90 uppercase">Dynamic Daily SCHEDULE</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onReshuffle}
              className="w-8 h-8 rounded-full hover:bg-primary/20 text-primary transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {sortedTodayChunks.length > 0 ? sortedTodayChunks.map((chunk, idx) => (
              <div key={idx} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg flex justify-between items-center group">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{chunk.taskTitle}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(chunk.startTime), 'HH:mm')} - {format(parseISO(chunk.endTime), 'HH:mm')}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold border-zinc-800 text-zinc-500">
                  Scheduled
                </Badge>
              </div>
            )) : (
              <div className="py-12 text-center bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-xl">
                <CheckSquare className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
                <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">No tasks scheduled for today. Enjoy your free time!</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-6 bg-card border-border shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">Consistency Metric</h3>
              <p className="text-[10px] text-zinc-500 uppercase font-mono">Completed vs Scheduled</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white">{Math.round(efficiency)}%</div>
              <div className={cn("text-[9px] font-bold uppercase", delta >= 0 ? "text-emerald-500" : "text-destructive")}>
                {delta >= 0 ? '+' : ''}{Math.round(delta)}% vs Prev Week
              </div>
            </div>
          </div>
          
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} opacity={0.1} />
                <XAxis dataKey="day" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} unit="h" />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#1A1D23', border: '1px solid #2D3139', fontSize: '9px', borderRadius: '8px' }}
                />
                <Bar dataKey="Theory" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Lab" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Project" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Revision" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex gap-4 mt-6 justify-center">
            {['Theory', 'Lab', 'Project', 'Revision'].map((cat, i) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][i] }}></div>
                <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">{cat}</span>
              </div>
            ))}
          </div>
        </Card>

        {hardCards.length > 0 ? (
          <Card className="flex flex-col p-0 overflow-hidden bg-card border-border border-primary/20 shadow-xl shadow-primary/5 min-h-[300px]">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-sm tracking-tight text-white/90 uppercase">Review Due</h3>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-none text-[10px] h-5 rounded px-2 uppercase font-bold tracking-tight">CRITICAL QUEUE</Badge>
                <span className="text-zinc-500 text-[10px] font-mono">{dashCardIndex + 1} / {hardCards.length}</span>
              </div>
            </div>
            
            <div className="p-8 flex flex-col justify-center grow min-h-[200px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCard.id + (dashCardFlipped ? '-back' : '-front')}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <div className="prose prose-invert max-w-full text-balance prose-sm">
                    <Markdown>{dashCardFlipped ? currentCard.answer_markdown : currentCard.question}</Markdown>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="p-4 bg-white/5 border-t border-border space-y-3">
      {!dashCardFlipped ? (
                <Button 
                  onClick={() => setDashCardFlipped(!dashCardFlipped)} 
                  className="w-full bg-primary/20 text-primary hover:bg-primary hover:text-white border-none font-bold uppercase tracking-widest text-[10px] h-10"
                >
                  Show Answer
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button 
                    onClick={() => setDashCardFlipped(!dashCardFlipped)} 
                    className="w-full bg-zinc-800 text-zinc-400 hover:text-white border-none font-bold uppercase tracking-widest text-[10px] h-10"
                  >
                    Show Question
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => updateDeckStatus(currentCard.id, 'Easy')} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 uppercase tracking-widest text-[10px]"
                    >
                      Got it (Easy)
                    </Button>
                    <Button 
                      onClick={handleNext} 
                      className="bg-destructive hover:bg-destructive/90 text-white font-bold h-10 uppercase tracking-widest text-[10px]"
                    >
                      Still struggling (Hard)
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={dashCardIndex === 0} 
                  onClick={handlePrev}
                  className="text-zinc-500 hover:text-white text-[9px] font-bold uppercase tracking-widest"
                >
                  Previous
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={dashCardIndex === hardCards.length - 1} 
                  onClick={handleNext}
                  className="text-zinc-500 hover:text-white text-[9px] font-bold uppercase tracking-widest"
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col p-10 items-center justify-center bg-card border-border/50 border-dashed border-2 text-center min-h-[300px]">
            <CheckSquare className="w-12 h-12 text-emerald-500/20 mb-4" />
            <h3 className="font-bold text-sm text-white/80 uppercase tracking-widest">No critical reviews due!</h3>
            <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-tight">System state optimized. Knowledge retention high.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// --- Task Inventory View ---
function TaskInventory({ tasks, setTasks }: { tasks: StudyTask[], setTasks: (t: StudyTask[]) => void }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'Theory' | 'Lab' | 'Project' | 'Revision'>('Theory');
  const [weight, setWeight] = useState(5);
  const [confidence, setConfidence] = useState(3);
  const [estTime, setEstTime] = useState(60);
  const [deadline, setDeadline] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  const addTask = async () => {
    if (!newTaskTitle) return;
    const task: StudyTask = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      subject,
      category,
      weightage: weight,
      deadline: startOfDay(parseISO(deadline)).toISOString(),
      confidence,
      estimatedMinutes: estTime,
      status: 'pending',
      scheduledChunks: []
    };
    
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });

    setTasks([...tasks, task]);
    setNewTaskTitle('');
    toast.success("Task committed to SQLite registry");
  };

  const removeTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter(t => t.id !== id));
    toast.info("Task purged from database");
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : undefined;

    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completedAt })
    });

    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: newStatus, completedAt };
      }
      return t;
    }));
  };

  return (
    <div className="space-y-10">
      <Card className="bg-card border-border shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white/90">Add New Requirement</CardTitle>
          <CardDescription className="opacity-40">Load task parameters into the optimization engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Task Title</Label>
            <Input className="bg-zinc-900 border-zinc-800" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="e.g., Laplace Transforms Practice" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Subject / Course Code</Label>
            <Input className="bg-zinc-900 border-zinc-800" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., MAT-101" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Importance (1-10)</Label>
            <Select value={weight.toString()} onValueChange={v => setWeight(parseInt(v))}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {[...Array(10)].map((_, i) => (
                  <SelectItem key={i+1} value={(i+1).toString()}>{i+1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Confidence Level (1-10)</Label>
             <Select value={confidence.toString()} onValueChange={v => setConfidence(parseInt(v))}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {[...Array(10)].map((_, i) => (
                  <SelectItem key={i+1} value={(i+1).toString()}>{i+1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Category</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                <SelectItem value="Theory">Theory/Lecture</SelectItem>
                <SelectItem value="Lab">Lab/Practical</SelectItem>
                <SelectItem value="Project">Project/Assignment</SelectItem>
                <SelectItem value="Revision">Revision/Test</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Est. Time (Minutes)</Label>
            <Input className="bg-zinc-900 border-zinc-800" type="number" value={estTime} onChange={e => setEstTime(parseInt(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Deadline</Label>
            <Input className="bg-zinc-900 border-zinc-800" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="bg-white/5 border-t border-border flex justify-end p-4">
          <Button onClick={addTask} className="bg-primary text-white font-bold px-6">
            <Plus className="w-4 h-4 mr-2" /> Commit to Inventory
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold tracking-tight opacity-40 uppercase text-xs">Registry Status ({tasks.filter(t => t.status !== 'completed').length} Pending)</h3>
        <div className="grid grid-cols-1 gap-3">
          {tasks.map(task => (
            <div key={task.id} className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
              task.status === 'completed' ? "bg-white/5 border-border opacity-40" : "bg-card border-border shadow-sm hover:border-primary/50"
            )}>
              <button 
                onClick={() => toggleTask(task.id)}
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors", 
                  task.status === 'completed' ? "bg-primary border-primary" : "border-zinc-700 hover:border-primary")}>
                {task.status === 'completed' && <CheckSquare className="w-3 h-3 text-white" />}
              </button>
              <div className="grow">
                <div className="flex items-center gap-2">
                  <h4 className={cn("font-bold text-sm", task.status === 'completed' && "line-through opacity-40")}>{task.title}</h4>
                  <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0 h-4 border-zinc-800 text-zinc-500">{task.subject}</Badge>
                  <Badge className="text-[8px] uppercase tracking-tighter px-1 h-4 bg-primary/10 text-primary border-none">{task.category}</Badge>
                </div>
                <div className="flex gap-4 mt-1">
                   <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                      {task.estimatedMinutes}m • W:{task.weightage} • CON:{task.confidence}
                   </div>
                   <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                      DUE: {format(parseISO(task.deadline), 'MMM dd')}
                   </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeTask(task.id)} className="text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-full">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- AI Optimization / Schedule Interface ---
interface ScheduleViewProps {
  tasks: StudyTask[];
  blocks: ProtectedBlock[];
  schedule: ScheduledChunk[];
  setSchedule: (s: ScheduledChunk[]) => void;
}

function ScheduleView({ tasks, blocks, schedule, setSchedule }: ScheduleViewProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Group schedule by day for the next 14 days
  const groupedSchedule = useMemo(() => {
    const groups: { [date: string]: ScheduledChunk[] } = {};
    const startDate = startOfDay(new Date());

    // Initialize map for next 14 days
    for (let i = 0; i < 14; i++) {
        const d = addDays(startDate, i);
        groups[format(d, 'yyyy-MM-dd')] = [];
    }

    schedule.forEach(chunk => {
      const dateKey = format(parseISO(chunk.startTime), 'yyyy-MM-dd');
      if (groups[dateKey] !== undefined) {
        groups[dateKey].push(chunk);
      }
    });
    
    return Object.keys(groups)
      .sort()
      .map(date => ({
        date,
        chunks: groups[date].sort((a, b) => a.startTime.localeCompare(b.startTime))
      }))
      .filter(g => g.chunks.length > 0); // Only show days with tasks
  }, [schedule]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    // Mimic processing delay
    setTimeout(async () => {
      const start = new Date();
      const newSchedule = generateSchedule(tasks, blocks, start);
      
      // Update DB
      try {
        await fetch('/api/schedule/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSchedule)
        });
        setSchedule(newSchedule);
        toast.success("Schedule successfully optimized and load-balanced.");
      } catch (err) {
        toast.error("Cloud synchronization failed.");
      }
      setIsOptimizing(false);
    }, 1200);
  };

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto">
      <div className="space-y-4 border-b border-border pb-8">
        <h2 className="text-3xl font-bold text-white">Academic Load Balancer</h2>
        <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl">
          The engine reallocates tasks over the next 3 weeks using a multi-day bin packing algorithm. 
          It respects college hours (10 AM - 5 PM) and enforces a strict 5-hour daily study limit.
        </p>
        
        <Button 
          onClick={handleOptimize} 
          disabled={isOptimizing}
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-bold h-12 px-10 uppercase tracking-widest text-xs rounded-xl"
        >
          {isOptimizing ? (
            <>
              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              Recalculating Bins...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Run AI Optimization Engine
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        {groupedSchedule.length > 0 ? (
          groupedSchedule.map(({ date, chunks }) => {
            const dateObj = parseISO(date);
            const title = format(dateObj, 'EEEE - MMMM dd, yyyy');
            const dailyTotal = chunks.reduce((acc, c) => 
               acc + differenceInMinutes(parseISO(c.endTime), parseISO(c.startTime)), 0
            );

            return (
              <details key={date} className="group border border-border rounded-xl bg-card overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none">
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-bold text-white text-sm uppercase tracking-wider">{title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase font-bold",
                      dailyTotal > 240 ? "text-orange-400 border-orange-400/20" : "text-emerald-400 border-emerald-400/20"
                    )}>
                      {(dailyTotal / 60).toFixed(1)}h Allocated
                    </Badge>
                    <ChevronDown className="w-4 h-4 text-zinc-600 transition-transform group-open:-rotate-180" />
                  </div>
                </summary>
                <div className="p-4 pt-0 space-y-2 border-t border-border/20">
                  {chunks.map(chunk => {
                    const task = tasks.find(t => t.id === chunk.taskId);
                    // Use start of today for priority calculation consistent with engine
                    const priority = task ? calculatePriorityScore(task, startOfDay(new Date())) : 0;
                    
                    return (
                      <div key={chunk.id} className="p-4 bg-zinc-900/40 rounded-lg flex justify-between items-center border border-transparent hover:border-zinc-800 transition-all">
                        <div className="space-y-1">
                          <h4 className="font-bold text-white text-sm">{chunk.taskTitle}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                            <span className="flex items-center gap-1.5 py-0.5 px-2 bg-zinc-900 rounded border border-zinc-800 font-bold text-zinc-400">
                              <Clock className="w-3 h-3 text-primary/60" />
                              {format(parseISO(chunk.startTime), 'HH:mm')} - {format(parseISO(chunk.endTime), 'HH:mm')}
                            </span>
                            <span className="text-primary/70 font-black uppercase tracking-tight">Priority: {priority.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })
        ) : (
          <div className="py-24 text-center border-2 border-dashed border-border rounded-2xl bg-zinc-900/5">
             <Info className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
             <p className="text-zinc-600 font-bold uppercase tracking-[0.2em] text-xs">No Scheduled Workload</p>
             <p className="text-zinc-500 text-[10px] mt-1 italic">Click the engine button above to distribute your task inventory.</p>
          </div>
        )}
      </div>

      <div className="bg-zinc-900/20 p-8 rounded-2xl border border-border text-center space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest text-primary/80">Heuristic Engine Status: Operational</p>
        <p className="text-[11px] text-zinc-400 italic max-w-xl mx-auto leading-relaxed">
          "The multi-day bin packing algorithm ensures that high-priority academic tasks are front-loaded into available gaps 
          while strictly adhering to the 10 AM - 5 PM weekday college constraint. Force-fit logic applies to tasks breaching 
          their immediate deadlines."
        </p>
      </div>
    </div>
  );
}


// --- Flashcards View ---
import Markdown from 'react-markdown';
function FlashcardsView({ cards, setCards }: { cards: Flashcard[], setCards: (cards: Flashcard[]) => void }) {
  const [activeDeck, setActiveDeck] = useState('General');
  
  // State variables for main tab review
  const [mainTabCardIndex, setMainTabCardIndex] = useState(0);
  const [mainTabCardFlipped, setMainTabCardFlipped] = useState(false);

  // Deck selector logic
  const decks = useMemo(() => {
    const list = Array.from(new Set(cards.map(c => c.deck_name || 'General')));
    return list.length > 0 ? list : ['General'];
  }, [cards]);

  const deckCards = useMemo(() => 
    cards.filter(c => (c.deck_name || 'General') === activeDeck),
    [cards, activeDeck]
  );
  
  // Metrics calculation
  const hard_count = useMemo(() => deckCards.filter(c => c.deck_status !== 'Easy').length, [deckCards]);
  const easy_count = useMemo(() => deckCards.filter(c => c.deck_status === 'Easy').length, [deckCards]);

  const activeQuestion = deckCards[mainTabCardIndex]?.question || "End of Deck";
  const activeAnswer = deckCards[mainTabCardIndex]?.answer_markdown || "";

  const updateStatus = async (id: string, status: 'New' | 'Hard' | 'Easy') => {
    await fetch(`/api/flashcards/${id}/deck-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_status: status })
    });
    setCards(cards.map(c => c.id === id ? { ...c, deck_status: status } : c));
    setMainTabCardFlipped(false);
    toast.success(`Card marked as ${status}`);
    
    // Auto-advance if marking as easy/hard during review could be logic here, 
    // but the request asks for manual nav at the bottom.
  };

  const handleNext = () => {
    if (mainTabCardIndex < deckCards.length - 1) {
      setMainTabCardIndex(prev => prev + 1);
      setMainTabCardFlipped(false);
    }
  };

  const handlePrev = () => {
    if (mainTabCardIndex > 0) {
      setMainTabCardIndex(prev => prev - 1);
      setMainTabCardFlipped(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Flashcards</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Active Review */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border p-6 rounded-xl space-y-6">
            <div className="max-w-xs space-y-1.5">
              <Label className="text-xs text-zinc-500 font-medium">Active Deck</Label>
              <Select value={activeDeck} onValueChange={(v) => { setActiveDeck(v); setMainTabCardIndex(0); setMainTabCardFlipped(false); }}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-white">
                  {decks.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-tight mb-1">Needs Review</div>
                <div className="text-2xl font-bold text-white">{hard_count}</div>
              </div>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-tight mb-1">Mastered</div>
                <div className="text-2xl font-bold text-white">{easy_count}</div>
              </div>
            </div>

            <Card className="border-border bg-zinc-900/30">
              <CardContent className="p-10 flex flex-col items-center min-h-[300px] justify-center text-center space-y-10">
                {deckCards.length > 0 ? (
                  <>
                    <h3 className="text-xl md:text-2xl font-medium text-white max-w-lg leading-snug">
                      {mainTabCardFlipped ? "Answer" : activeQuestion}
                    </h3>

                    <div className="w-full space-y-6">
                      <Button 
                        onClick={() => setMainTabCardFlipped(!mainTabCardFlipped)}
                        className="w-full bg-primary text-white font-bold h-12 uppercase tracking-widest text-[11px]"
                      >
                        {mainTabCardFlipped ? "Show Question" : "Toggle Answer"}
                      </Button>

                      {mainTabCardFlipped && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="prose prose-invert prose-sm max-w-none text-left p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
                            <Markdown>{activeAnswer}</Markdown>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <Button 
                               onClick={() => updateStatus(deckCards[mainTabCardIndex].id, 'Hard')}
                               variant="outline"
                               className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white h-10 text-[10px] uppercase font-bold tracking-widest"
                            >
                              Hard
                            </Button>
                            <Button 
                               onClick={() => updateStatus(deckCards[mainTabCardIndex].id, 'Easy')}
                               variant="outline"
                               className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white h-10 text-[10px] uppercase font-bold tracking-widest"
                            >
                              Easy
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-zinc-600 italic">No cards in this deck. Use the form to add some.</div>
                )}
              </CardContent>
              <CardFooter className="bg-black/20 border-t border-border flex justify-between items-center px-6 py-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePrev} 
                  disabled={mainTabCardIndex === 0}
                  className="text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <div className="text-[10px] font-mono text-zinc-600">
                  {deckCards.length > 0 ? `${mainTabCardIndex + 1} / ${deckCards.length}` : "0 / 0"}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNext} 
                  disabled={mainTabCardIndex >= deckCards.length - 1}
                  className="text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest disabled:opacity-20"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Right Column: Create Flashcard */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border p-6 rounded-xl space-y-6 sticky top-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create Flashcard</h3>
            <FlashcardForm 
              cards={cards} 
              setCards={setCards} 
              decks={decks}
              setActiveDeck={setActiveDeck}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashcardForm({ 
  cards, setCards, decks, setActiveDeck 
}: { 
  cards: Flashcard[], setCards: (c: Flashcard[]) => void,
  decks: string[], setActiveDeck: (d: string) => void
}) {
  const [question, setQuestion] = useState('');
  const [answerMarkdown, setAnswerMarkdown] = useState('');
  const [deckName, setDeckName] = useState('General');
  const [isNewDeck, setIsNewDeck] = useState(false);
  const [language, setLanguage] = useState('None');

  const addCard = async () => {
    if (!question || !answerMarkdown) {
      toast.error("Question and Answer are required.");
      return;
    }
    const finalDeckName = isNewDeck ? deckName : (deckName || 'General');
    
    let processedAnswer = answerMarkdown;
    if (language !== 'None') {
      const langMap: { [key: string]: string } = {
        'Python': 'python',
        'C': 'c',
        'C++': 'cpp',
        'Java': 'java'
      };
      const langLower = langMap[language] || language.toLowerCase();
      processedAnswer = `\`\`\`${langLower}\n${answerMarkdown}\n\`\`\``;
    }

    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      deck_name: finalDeckName,
      question: question,
      answer_markdown: processedAnswer,
      deck_status: 'New'
    };
    
    await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCard)
    });

    setCards([...cards, newCard]);
    setQuestion('');
    setAnswerMarkdown('');
    setLanguage('None');
    if (isNewDeck) {
      setActiveDeck(finalDeckName);
      setIsNewDeck(false);
    }
    toast.success("➕ Card Added Successfully");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500 uppercase font-bold">Target Deck</Label>
        <div className="flex gap-2">
          {!isNewDeck ? (
            <Select value={deckName} onValueChange={setDeckName}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 grow h-9">
                <SelectValue placeholder="Select existing deck" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {decks.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              className="bg-zinc-900 border-zinc-800 grow h-9 text-xs" 
              placeholder="Deck name..." 
              value={deckName} 
              onChange={e => setDeckName(e.target.value)} 
            />
          )}
          <Button 
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsNewDeck(!isNewDeck)}
            className="shrink-0 border-zinc-800 text-[9px] uppercase font-bold h-9"
          >
            {isNewDeck ? "Pick" : "New"}
          </Button>
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500 uppercase font-bold">Question</Label>
        <Textarea 
          placeholder="Enter question..." 
          className="bg-zinc-900 border-zinc-800 text-xs min-h-[80px] rounded-lg" 
          value={question} 
          onChange={e => setQuestion(e.target.value)} 
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500 uppercase font-bold">Code Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-white">
            <SelectItem value="None">None</SelectItem>
            <SelectItem value="Python">Python</SelectItem>
            <SelectItem value="C">C</SelectItem>
            <SelectItem value="C++">C++</SelectItem>
            <SelectItem value="Java">Java</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500 uppercase font-bold">Answer (Markdown)</Label>
        <Textarea 
          placeholder="Enter answer..." 
          className="bg-zinc-900 border-zinc-800 font-mono text-xs h-32 rounded-lg" 
          value={answerMarkdown} 
          onChange={e => setAnswerMarkdown(e.target.value)} 
        />
      </div>

      <Button onClick={addCard} className="w-full bg-white text-black hover:bg-zinc-200 font-bold h-10 uppercase text-[10px] tracking-widest mt-2">
        ➕ Add Card
      </Button>
    </div>
  );
}


// --- Pomodoro Timer View ---
function TimerView() {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  // Audio Beep using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context failed to start (interaction required):", e);
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playBeep();
      const nextModeIsBreak = !isBreak;
      setIsBreak(nextModeIsBreak);
      setTimeLeft(nextModeIsBreak ? breakMinutes * 60 : workMinutes * 60);
      toast.success(nextModeIsBreak ? "Work Session Complete! Time for a break." : "Break Over! Back to focus.");
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isBreak, workMinutes, breakMinutes]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(workMinutes * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-xl mx-auto space-y-12 py-10">
      <div className="text-center space-y-4">
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Temporal Focus Engine</h3>
        <div className="text-9xl font-black tracking-tighter text-white tabular-nums drop-shadow-2xl">
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="flex justify-center gap-2">
           <Badge className={cn("px-6 py-1 rounded-full border-none font-bold uppercase tracking-widest text-[10px]", isBreak ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/20 text-primary")}>
             {isBreak ? "Rest Phase" : "Focus Mission"}
           </Badge>
        </div>
      </div>

      <Card className="bg-card border-border p-8 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Clock className="w-24 h-24" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Focus Interval (m)</Label>
            <Input 
              type="number" 
              className="bg-zinc-900 border-zinc-800 h-12 text-lg font-bold" 
              value={workMinutes} 
              onChange={(e) => setWorkMinutes(parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Rest Interval (m)</Label>
            <Input 
              type="number" 
              className="bg-zinc-900 border-zinc-800 h-12 text-lg font-bold" 
              value={breakMinutes} 
              onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)} 
            />
          </div>
        </div>

        <div className="space-y-3 relative z-10">
          <Button 
            onClick={toggleTimer} 
            className={cn(
              "w-full font-bold h-16 uppercase tracking-[0.3em] text-sm rounded-2xl transition-all duration-300", 
              isActive ? "bg-white text-black hover:bg-white/90 scale-95" : "bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20 hover:scale-[1.02]"
            )}
          >
            {isActive ? "ABORT SEQUENCE" : "INITIATE COUNTDOWN"}
          </Button>
          <Button variant="ghost" onClick={resetTimer} className="w-full text-zinc-600 text-[10px] font-bold uppercase tracking-widest hover:text-white">
            Reset Tactical Clock
          </Button>
        </div>
      </Card>

      <div className="p-6 bg-white/[0.02] border border-border/50 rounded-3xl backdrop-blur-sm">
        <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6 border-b border-border pb-2 inline-block">Neural Protocol Constraints</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-[0_0_8px_#3b82f6]"></div>
            <p className="text-[11px] text-zinc-500 leading-relaxed uppercase tracking-tight">Maintain absolute cognitive isolation during top-tier study units.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shadow-[0_0_8px_#10b981]"></div>
            <p className="text-[11px] text-zinc-500 leading-relaxed uppercase tracking-tight">Regulate somatic recovery during rest phases to normalize cortisol.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Resources Tab ---
function ResourcesTab({ resources, setResources }: { resources: ResourceLink[], setResources: any }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<ResourceLink['type']>('pdf');

  const addResource = () => {
    if (!title || !url) return;
    const res: ResourceLink = {
       id: crypto.randomUUID(),
       title,
       url,
       category,
       type,
       addedAt: new Date().toISOString()
    };
    setResources([...resources, res]);
    setTitle(''); setUrl(''); setCategory('');
    toast.success("Resource archived");
  };

  return (
    <div className="space-y-8 text-white/90">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-6 rounded-2xl border border-border shadow-xl">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Title</Label>
          <Input className="bg-zinc-900 border-zinc-800" placeholder="Study Guide v2" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">URL / Link</Label>
          <Input className="bg-zinc-900 border-zinc-800" placeholder="https://github.com/..." value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Category</Label>
          <Input className="bg-zinc-900 border-zinc-800" placeholder="Coursework" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <Button onClick={addResource} className="bg-primary text-white font-bold h-10">Add Asset</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {resources.map(res => (
          <Card key={res.id} className="group hover:border-primary transition-colors bg-card border-border overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm font-bold text-white/90">{res.title}</CardTitle>
                <Badge variant="secondary" className="text-[9px] uppercase font-mono bg-primary/10 text-primary border-none">{res.type}</Badge>
              </div>
              <CardDescription className="text-[10px] uppercase tracking-widest opacity-40 font-mono">{res.category || 'GENERAL'}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center bg-white/5 p-4 py-3">
              <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold tracking-widest text-primary hover:text-primary/80 transition-colors uppercase">
                 OPEN SOURCE →
              </a>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-red-500" onClick={() => setResources(resources.filter(r => r.id !== res.id))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Settings/Config Tab ---
function SettingsTab({ blocks, setBlocks }: { blocks: ProtectedBlock[], setBlocks: any }) {
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');

  const addBlock = async () => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const block: ProtectedBlock = {
      id: crypto.randomUUID(),
      label,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em
    };

    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    setBlocks([...blocks, block]);
    setLabel('');
    toast.success("Core constraint locked in DB");
  };

  const removeBlock = async (id: string) => {
    await fetch(`/api/blocks/${id}`, { method: 'DELETE' });
    setBlocks(blocks.filter(b => b.id !== id));
    toast.info("Constraint purged");
  };

  return (
    <div className="space-y-12 text-white/90">
      <div className="max-w-2xl bg-card p-8 rounded-3xl border border-border shadow-2xl">
        <h3 className="text-xl font-bold mb-2 tracking-tight">Protected Time Logic</h3>
        <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
          The optimization engine strictly bypasses these blocks. Essential for maintaining rest/work balance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-10">
           <div className="space-y-2">
             <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Activity</Label>
             <Input className="bg-zinc-900 border-zinc-800" placeholder="e.g. Gym Session" value={label} onChange={e => setLabel(e.target.value)} />
           </div>
           <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Start</Label>
                 <Input className="bg-zinc-900 border-zinc-800" type="time" value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase tracking-widest opacity-40 font-bold">End</Label>
                 <Input className="bg-zinc-900 border-zinc-800" type="time" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
           </div>
           <Button onClick={addBlock} className="bg-primary hover:bg-primary/90 text-white font-bold h-10">Lock Time</Button>
        </div>

        <div className="space-y-3">
           {blocks.map(block => (
              <div key={block.id} className="flex items-center justify-between p-4 bg-white/5 border border-border rounded-xl group hover:border-destructive/40 transition-colors">
                 <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-destructive rounded-full"></div>
                    <div>
                       <h4 className="font-bold text-sm text-white/90">{block.label}</h4>
                       <p className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">{block.startHour}:{block.startMinute.toString().padStart(2,'0')} - {block.endHour}:{block.endMinute.toString().padStart(2,'0')}</p>
                    </div>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="text-zinc-600 hover:text-destructive group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                 </Button>
              </div>
           ))}
        </div>
      </div>
      
      <div className="max-w-2xl">
         <h3 className="text-sm font-bold mb-4 tracking-widest uppercase opacity-30">System Diagnostics</h3>
         <div className="p-6 bg-zinc-900 border border-border rounded-2xl font-mono text-[10px] text-zinc-500 space-y-2">
            <div className="flex justify-between"><span>ENGINE_CORE</span> <span className="text-primary">v1.2.0-STABLE_DARK</span></div>
            <div className="flex justify-between"><span>PRIORITY_MAP</span> <span>ACTIVE_HEURISTIC</span></div>
            <div className="flex justify-between"><span>STORAGE_LAYER</span> <span>LOCAL_PERSISTENT</span></div>
            <div className="flex justify-between"><span>STATUS</span> <span className="text-emerald-500">FULLY_OPTIMIZED</span></div>
         </div>
      </div>
    </div>
  );
}
