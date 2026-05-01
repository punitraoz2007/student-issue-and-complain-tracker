import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Search, 
  HelpCircle, 
  PhoneCall, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  Send,
  Sparkles,
  User,
  GraduationCap,
  LayoutGrid,
  Shield,
  Loader2,
  ExternalLink,
  MessageCircle,
  Activity,
  Calendar
} from "lucide-react";
import { draftComplaintDescription, generateProfessorReportSummary, chatWithProfessor } from "./services/geminiService";

// ── Types ───────────────────────────────────────────────────────────────────
interface TimelineItem {
  date: string;
  event: string;
  type: string;
}

interface Complaint {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_review" | "resolved" | "closed";
  date: string;
  updated: string;
  description: string;
  timeline: TimelineItem[];
  smartSummary?: string | null;
  smartTip?: string | null;
  smartEta?: string | null;
  smartNext?: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────
const STUDENT = { 
  name: "Maya Patel", 
  id: "UP2024-3847", 
  program: "B.Sc. Computer Science", 
  year: "Year 3", 
  avatar: "MP" 
};

const CATEGORIES = [
  { id: "academic",  icon: "🎓", label: "Academic",       desc: "Grades, exams, coursework" },
  { id: "faculty",   icon: "👨‍🏫", label: "Faculty",        desc: "Teaching quality, conduct" },
  { id: "admin",     icon: "🏛️",  label: "Administration", desc: "Registration, records" },
  { id: "facility",  icon: "🏢", label: "Facilities",     desc: "Buildings, labs, library" },
  { id: "tech",      icon: "💻", label: "Technology",     desc: "Wi-Fi, portals, software" },
  { id: "financial", icon: "💰", label: "Financial",      desc: "Fees, scholarships" },
  { id: "welfare",   icon: "❤️",  label: "Welfare",        desc: "Wellbeing, accommodation" },
  { id: "other",     icon: "📋", label: "Other",          desc: "Miscellaneous concerns" },
];

const PRIORITIES = [
  { id: "low",    label: "Low",    color: "#16A34A", bg: "#F0FDF4", desc: "General feedback" },
  { id: "medium", label: "Medium", color: "#E8A020", bg: "#FFF8EC", desc: "Needs attention" },
  { id: "high",   label: "High",   color: "#DC2626", bg: "#FEF2F2", desc: "Urgent issue" },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any; step: number }> = {
  open:      { label: "Open",       color: "#E8A020", bg: "#FFF8EC", icon: Clock,   step: 0 },
  in_review: { label: "In Review",  color: "#2563EB", bg: "#EFF6FF", icon: Search,  step: 1 },
  resolved:  { label: "Resolved",   color: "#16A34A", bg: "#F0FDF4", icon: CheckCircle2, step: 3 },
  closed:    { label: "Closed",     color: "#6B7280", bg: "#F9FAFB", icon: Shield,  step: 3 },
};

const PROGRESS_STEPS = ["Submitted", "Assigned", "Under Review", "Resolved"];

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<"home" | "new" | "detail" | "advisor">("home");
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selected, setSelected] = useState<Complaint | null>(null);
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ 
    category: "", 
    title: "", 
    description: "", 
    priority: "medium" as const, 
    anonymous: false 
  });

  const [advisorChat, setAdvisorChat] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  
  // ── Campus Pulse States ──
  const [campusWeather, setCampusWeather] = useState<{ temp: number; text: string } | null>(null);
  const [dailyQuote, setDailyQuote] = useState<{ text: string; author: string } | null>(null);
  const [campusEvents, setCampusEvents] = useState<{ id: string; title: string; time: string }[]>([]);

  const [suggestedDraft, setSuggestedDraft] = useState<string | null>(null);
  const [showProfChat, setShowProfChat] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  
  const chatRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchComplaints();
    
    // Mock Campus News Fetching Logic
    const mockFetchEvents = () => {
      setTimeout(() => {
        setCampusEvents([
          { id: "1", title: "Tech-Fest 2024 Registration", time: "Starts 10:00 AM" },
          { id: "2", title: "Dean's Town Hall Meeting", time: "Friday, Audi-2" },
          { id: "3", title: "Cultural Night Auditions", time: "Open Now" }
        ]);
      }, 800);
    };
    mockFetchEvents();

    // Fetch Campus Weather
    fetch("https://api.open-meteo.com/v1/forecast?latitude=28.3670&longitude=77.0670&current_weather=true")
      .then(res => res.json())
      .then(data => {
        if (data?.current_weather) {
          const code = data.current_weather.weathercode;
          let text = "Clear";
          if (code >= 1 && code <= 3) text = "Partly Cloudy";
          else if (code >= 45 && code <= 48) text = "Foggy";
          else if (code >= 51 && code <= 67) text = "Rainy";
          else if (code >= 71 && code <= 77) text = "Snowy";
          else if (code >= 95) text = "Stormy";
          
          setCampusWeather({ temp: Math.round(data.current_weather.temperature), text });
        }
      }).catch(e => console.error("Weather Error:", e));

    // Fetch Daily Quote
    fetch("https://zenquotes.io/api/today", { mode: 'cors' })
      .then(res => res.json())
      .then(data => {
        if (data && data[0]) {
          setDailyQuote({ text: data[0].q, author: data[0].a });
        }
      }).catch(() => {
        setDailyQuote({ 
          text: "The beautiful thing about learning is that no one can take it away from you.", 
          author: "B.B. King" 
        });
      });
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [advisorChat]);

  const fetchComplaints = async () => {
    try {
      const res = await fetch("/api/complaints");
      const data = await res.json();
      setComplaints(data);
    } catch {
      showToast("Failed to fetch complaints", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAnalyse = async (c: Complaint) => {
    setAnalysing(true);
    try {
      const data = await generateProfessorReportSummary(c);
      const res = await fetch(`/api/complaints/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smartSummary: data.summary,
          smartTip: data.tip,
          smartEta: data.eta,
          smartNext: data.status_note
        })
      });
      const updated = await res.json();
      setComplaints(prev => prev.map(x => x.id === c.id ? updated : x));
      setSelected(updated);
      showToast("Professor's assessment complete!");
    } catch {
      showToast("Consultation failed", "error");
    } finally {
      setAnalysing(false);
    }
  };

  const handleDraft = async () => {
    if (!form.category || !form.title) {
      showToast("Please pick a category and enter a title first", "error");
      return;
    }
    setDraftLoading(true);
    try {
      const draft = await draftComplaintDescription(form.category, form.title, form.description);
      setSuggestedDraft(draft);
    } catch {
      showToast("Failed to generate automated draft", "error");
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendChat = async (isReporting: boolean = false) => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput };
    const history = [...advisorChat, userMsg];
    setAdvisorChat(history);
    setChatInput("");
    setChatLoading(true);
    try {
      const advisorResponse = await chatWithProfessor(isReporting ? null : selected, history, isReporting);
      setAdvisorChat([...history, { role: "assistant", content: advisorResponse || "I seem to be lost in thought, my dear student. Could you repeat that?" }]);
    } catch {
      setAdvisorChat([...history, { role: "assistant", content: "Forgive me, the digital archives are a bit slow today. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.category || !form.title || !form.description) {
      showToast("All fields are required", "error");
      return;
    }
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const newC = await res.json();
      setComplaints([newC, ...complaints]);
      setView("home");
      setStep(1);
      setForm({ category: "", title: "", description: "", priority: "medium", anonymous: false });
      showToast(`Complaint submitted: ${newC.id}`);
    } catch {
      showToast("Submission failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#1B2B5E] mx-auto mb-4" />
          <p className="text-[#1B2B5E] font-medium">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#1A1830] font-sans selection:bg-[#E8A020]/20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 border ${
              toast.type === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-green-50 border-green-200 text-green-600"
            }`}
          >
            {toast.type === "error" ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-medium">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40">
        <div className="bg-[#1B2B5E] px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-[#E8A020] w-9 h-9 rounded-lg flex items-center justify-center font-serif text-xl font-bold text-[#1B2B5E]"
            >
              K
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="font-serif text-white font-semibold text-lg leading-tight">K.R. Mangalam</h1>
              <p className="text-white/40 text-[10px] uppercase tracking-widest text-[#E8A020]">University Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{STUDENT.name}</p>
              <p className="text-white/40 text-[11px]">{STUDENT.id}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#E8A020] flex items-center justify-center font-bold text-[#1B2B5E] text-sm">
              {STUDENT.avatar}
            </div>
          </div>
        </div>
        
        {/* Sub-nav */}
        <div className="bg-white border-b border-[#E5DDD0] px-8">
          <div className="max-w-6xl mx-auto flex gap-8">
            {[
              { id: "home", label: "Dashboard", icon: LayoutGrid },
              { id: "new", label: "Report Issue", icon: Plus },
              { id: "advisor", label: "Consult Advisor", icon: MessageCircle }
            ].map(nav => (
              <button 
                key={nav.id}
                onClick={() => { setView(nav.id as any); setStep(1); }}
                className={`flex items-center gap-2 py-4 text-sm font-medium transition-all relative ${
                  view === nav.id || (view === "detail" && nav.id === "home") ? "text-[#1B2B5E]" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <nav.icon size={16} />
                {nav.label}
                {(view === nav.id || (view === "detail" && nav.id === "home")) && (
                  <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B2B5E] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-10">
        <AnimatePresence mode="wait">
          {/* Dashboard View */}
          {view === "home" && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Hero Banner */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#1B2B5E] via-[#2A3F7E] to-[#1B4A8A] rounded-[32px] p-10 text-white shadow-2xl">
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#E8A020]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <p className="text-white/50 text-sm font-medium tracking-wide mb-2">Academic Year 2024/25</p>
                  <h2 className="font-serif text-4xl mb-2">Hello, {STUDENT.name.split(" ")[0]}</h2>
                  <p className="text-white/60 text-lg mb-8 max-w-xl">
                    Every voice shapes our community. Use this portal to report issues, track progress, and help us improve your university experience.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setView("new")}
                      className="bg-[#E8A020] text-[#1B2B5E] px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#D4911A] transition-all transform hover:-translate-y-0.5 active:scale-95"
                    >
                      <Plus size={20} />
                      Report New Issue
                    </button>
                    <button className="bg-white/10 border border-white/20 px-8 py-3 rounded-2xl font-semibold hover:bg-white/20 transition-all">
                      Browse FAQs
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats & Complaints */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Complaints */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-2xl text-[#1B2B5E]">My Reports</h3>
                    <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Live tracking active
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {complaints.map((c) => (
                      <motion.div
                        key={c.id}
                        layoutId={c.id}
                        onClick={() => { setSelected(c); setView("detail"); }}
                        className="bg-white border border-[#E5DDD0] rounded-3xl p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#F0F3FB] flex items-center justify-center text-2xl group-hover:bg-[#E8A020]/20 transition-colors">
                              {CATEGORIES.find(cat => cat.id === c.category)?.icon || "📋"}
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-bold mb-1">{c.id}</p>
                              <h4 className="text-lg font-semibold text-[#1A1830] leading-tight group-hover:text-[#2563EB] transition-colors">{c.title}</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              (STATUS_MAP[c.status] || STATUS_MAP.open).bg} ${(STATUS_MAP[c.status] || STATUS_MAP.open).color} border border-current/10`
                            }>
                              {(STATUS_MAP[c.status] || STATUS_MAP.open).label}
                            </div>
                          </div>
                        </div>
 
                        <div className="flex items-center gap-6 mt-6">
                          <div className="flex -space-x-1.5 flex-1 max-w-[200px]">
                            {[0, 1, 2, 3].map((stepIdx) => (
                              <div 
                                key={stepIdx}
                                className={`h-1.5 rounded-full flex-1 mx-0.5 ${
                                  stepIdx <= (STATUS_MAP[c.status] || STATUS_MAP.open).step ? "bg-[#1B2B5E]" : "bg-gray-100"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-xs font-medium text-[#6B7280]">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} />
                              {c.date}
                            </div>
                            <div className={`flex items-center gap-1.5 ${c.priority === 'high' ? 'text-red-500' : ''}`}>
                              <AlertCircle size={14} />
                              {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)} Priority
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Support */}
                <div className="space-y-6">
                  <div className="bg-white border border-[#E5DDD0] rounded-[32px] p-8">
                    <h3 className="font-serif text-xl text-[#1B2B5E] mb-6">Need Instant Help?</h3>
                    <div className="space-y-4">
                      {[
                        { title: "Helpline", value: "800-UNI-SUPPORT", icon: PhoneCall, color: "#2563EB" },
                        { title: "Student Office", value: "Admin Hall, Rm 204", icon: GraduationCap, color: "#1B2B5E" },
                        { title: "Advisor Chat", value: "Quick guidance", icon: MessageCircle, color: "#E8A020" }
                      ].map(item => (
                        <button key={item.title} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-[#F0F3FB] transition-all group border border-transparent hover:border-[#E5DDD0]">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-[#E5DDD0] shadow-sm group-hover:shadow-none">
                            <item.icon size={20} style={{ color: item.color }} />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{item.title}</p>
                            <p className="font-semibold text-sm text-[#1B2B5E]">{item.value}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1B2B5E] rounded-[32px] p-8 text-white">
                    <div className="bg-[#E8A020] w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                      <Sparkles size={24} className="text-[#1B2B5E]" />
                    </div>
                    <h4 className="text-xl font-serif mb-3">Advisor Support</h4>
                    <p className="text-white/60 text-sm leading-relaxed mb-6">
                      K.R. Mangalam University's smart logic helps prioritize critical reports and summarizes issues for immediate faculty action.
                    </p>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "65%" }}
                        className="h-full bg-[#E8A020]"
                      />
                    </div>
                    <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-[#E8A020]">System Accuracy: 98%</p>
                  </div>

                  {/* Campus Pulse API Card */}
                  <div className="bg-white border border-[#E5DDD0] rounded-[32px] overflow-hidden">
                    <div className="p-8 border-b border-[#E5DDD0] bg-[#FAF8F4]">
                      <h3 className="font-serif text-xl text-[#1B2B5E] flex items-center gap-2">
                        <Activity size={20} className="text-[#E8A020]" />
                        Campus Pulse
                      </h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">Live University Insights</p>
                    </div>

                    <div className="p-8 space-y-8">
                       {/* Weather */}
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-[#F0F3FB] flex items-center justify-center text-2xl">
                                {campusWeather?.text.includes("Rain") ? "🌧️" : campusWeather?.text.includes("Cloud") ? "⛅" : "☀️"}
                             </div>
                             <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Gurgaon Weather</p>
                                <p className="text-lg font-bold text-[#1B2B5E]">{campusWeather ? `${campusWeather.temp}°C · ${campusWeather.text}` : "Loading..."}</p>
                             </div>
                          </div>
                       </div>

                       {/* Campus Events (Mock API Data) */}
                       <div className="space-y-4">
                         <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020]">Upcoming Events (Live Data)</p>
                         <div className="space-y-3">
                            {campusEvents.length > 0 ? campusEvents.map(ev => (
                              <div key={ev.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-[#1B2B5E]/20 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  <span className="text-xs font-semibold text-[#1B2B5E]">{ev.title}</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{ev.time}</span>
                              </div>
                            )) : (
                              <div className="flex items-center gap-3 animate-pulse">
                                <div className="w-8 h-8 rounded-lg bg-gray-100" />
                                <div className="h-2 w-32 bg-gray-100 rounded" />
                              </div>
                            )}
                         </div>
                       </div>

                       {/* Quote */}
                       <div className="space-y-4">
                          <div className="relative">
                             <div className="absolute -top-3 -left-2 text-4xl text-[#E8A020]/20 font-serif">"</div>
                             <p className="relative z-10 text-sm italic text-gray-600 leading-relaxed font-serif pl-2">
                                {dailyQuote?.text || "Knowledge is power. Information is liberating. Education is the premise of progress."}
                             </p>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="h-px flex-1 bg-gray-100" />
                             <p className="text-[10px] font-bold uppercase tracking-widest text-[#E8A020]">
                                — {dailyQuote?.author || "Kofi Annan"}
                             </p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* New Complaint View */}
          {view === "new" && (
            <motion.div 
              key="new"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white border border-[#E5DDD0] rounded-[32px] p-10 shadow-xl space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="font-serif text-3xl text-[#1B2B5E]">Report an Issue</h2>
                  <p className="text-gray-500">Provide details below to start the resolution process.</p>
                </div>

                {/* Progress Indicators */}
                <div className="flex justify-center gap-4 mb-8">
                  {[1, 2, 3].map(s => (
                    <div 
                      key={s} 
                      className={`h-1.5 w-16 rounded-full transition-all duration-500 ${
                        step >= s ? "bg-[#1B2B5E]" : "bg-gray-100"
                      }`}
                    />
                  ))}
                </div>

                {/* Multi-step Form */}
                <div className="min-h-[400px]">
                  <AnimatePresence mode="wait">
                    {step === 1 && (
                      <motion.div 
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <h3 className="font-semibold text-lg text-[#1B2B5E]">What is the nature of your concern?</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 group ${
                                form.category === cat.id 
                                ? "border-[#1B2B5E] bg-[#F0F3FB]" 
                                : "border-gray-100 hover:border-gray-200"
                              }`}
                            >
                              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">{cat.icon}</span>
                              <span className="text-xs font-bold leading-tight uppercase tracking-wide">{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div 
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">Subject / Title</label>
                            <input 
                              type="text" 
                              value={form.title}
                              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                              placeholder="e.g., Missing library credentials"
                              className="w-full bg-[#FAF8F4] border-2 border-gray-100 rounded-2xl px-6 py-4 focus:border-[#1B2B5E] focus:outline-none transition-all font-medium"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Description of Issue</label>
                              <button 
                                onClick={handleDraft}
                                disabled={draftLoading}
                                className="flex items-center gap-1.5 text-[#2563EB] text-xs font-bold hover:underline disabled:opacity-50"
                              >
                                {draftLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Auto-draft
                              </button>
                              <button 
                                onClick={() => { setAdvisorChat([]); setStep(2); setShowProfChat(true); }}
                                className="flex items-center gap-1.5 text-[#E8A020] text-xs font-bold hover:underline"
                              >
                                <MessageCircle size={12} />
                                Consult Professor
                              </button>
                            </div>
                            
                            {suggestedDraft && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl"
                              >
                                <p className="text-sm text-blue-900 leading-relaxed mb-3">"{suggestedDraft}"</p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => { setForm(f => ({ ...f, description: suggestedDraft })); setSuggestedDraft(null); }}
                                    className="bg-[#2563EB] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"
                                  >
                                    Use this draft
                                  </button>
                                  <button 
                                    onClick={() => setSuggestedDraft(null)}
                                    className="text-gray-500 text-[11px] font-bold px-3 py-1.5"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            <textarea 
                              value={form.description}
                              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="Explain the problem in detail..."
                              className="w-full bg-[#FAF8F4] border-2 border-gray-100 rounded-2xl px-6 py-4 focus:border-[#1B2B5E] focus:outline-none transition-all font-medium min-h-[160px] leading-relaxed"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div 
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                         <h3 className="font-semibold text-lg text-[#1B2B5E]">Finalize & Submit</h3>
                         <div className="space-y-6">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Priority Level</p>
                              <div className="flex flex-col gap-2">
                                {PRIORITIES.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => setForm(f => ({ ...f, priority: p.id as any }))}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                                      form.priority === p.id ? "border-[#1B2B5E] bg-[#F0F3FB]" : "border-gray-50 bg-gray-50/50 hover:border-gray-100"
                                    }`}
                                  >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                    <div className="text-left">
                                      <p className="text-sm font-bold text-[#1B2B5E]">{p.label}</p>
                                      <p className="text-xs text-gray-500">{p.desc}</p>
                                    </div>
                                    {form.priority === p.id && <CheckCircle2 size={18} className="ml-auto text-[#1B2B5E]" />}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <label className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={form.anonymous}
                                onChange={e => setForm(f => ({ ...f, anonymous: e.target.checked }))}
                                className="w-5 h-5 rounded-lg border-2 border-gray-300 text-[#1B2B5E] focus:ring-[#1B2B5E]"
                              />
                              <div className="text-left">
                                <p className="text-sm font-bold text-[#1B2B5E]">Self-Identify</p>
                                <p className="text-xs text-gray-500">Enable to remain anonymous to faculty</p>
                              </div>
                            </label>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-3 pt-6">
                  {step > 1 && (
                    <button 
                      onClick={() => setStep(step - 1)}
                      className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-500 hover:border-gray-200 transition-all"
                    >
                      Back
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (step === 3) handleSubmit();
                      else {
                        if (step === 1 && !form.category) { showToast("Category required", "error"); return; }
                        if (step === 2 && (!form.title || !form.description)) { showToast("All fields required", "error"); return; }
                        setStep(step + 1);
                      }
                    }}
                    className="flex-[2] py-4 bg-[#1B2B5E] text-white rounded-2xl font-bold shadow-lg hover:bg-[#2A3F7E] transition-all"
                  >
                    {step === 3 ? "Submit Report" : "Continue"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Detail View */}
          {view === "detail" && selected && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Details (8 cols) */}
              <div className="lg:col-span-12 space-y-6">
                <button 
                  onClick={() => setView("home")}
                  className="group flex items-center gap-2 text-sm font-bold text-[#1B2B5E] hover:gap-3 transition-all"
                >
                  <ChevronLeft size={20} />
                  Back to Dashboard
                </button>

                <div className="bg-white border border-[#E5DDD0] rounded-[32px] p-8 sm:p-10 shadow-sm space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400">{selected.id}</span>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          (STATUS_MAP[selected.status] || STATUS_MAP.open).bg} ${(STATUS_MAP[selected.status] || STATUS_MAP.open).color}`}>
                          {(STATUS_MAP[selected.status] || STATUS_MAP.open).label}
                        </div>
                        {selected.priority === "high" && (
                          <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest">High Priority</span>
                        )}
                      </div>
                      <h2 className="font-serif text-3xl text-[#1B2B5E] leading-tight">{selected.title}</h2>
                    </div>
                    <div className="bg-[#F0F3FB] p-4 rounded-2xl flex items-center gap-3">
                      <div className="text-2xl">{CATEGORIES.find(cat => cat.id === selected.category)?.icon}</div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</p>
                        <p className="text-sm font-bold text-[#1B2B5E]">{CATEGORIES.find(cat => cat.id === selected.category)?.label}</p>
                      </div>
                    </div>
                  </div>

                  {/* Progressive Timeline Display */}
                  <div className="grid grid-cols-4 gap-2 py-8 border-y border-gray-50">
                    {PROGRESS_STEPS.map((stepLabel, idx) => {
                      const stepIndex = (STATUS_MAP[selected.status] || STATUS_MAP.open).step;
                      const isComplete = idx <= stepIndex;
                      const isActive = idx === stepIndex;
                      return (
                        <div key={stepLabel} className="text-center group">
                          <div className={`h-1.5 rounded-full mb-3 transition-all duration-700 ${
                            isComplete ? "bg-[#1B2B5E]" : "bg-gray-100"
                          } ${isActive ? "relative shadow-[0_0_8px_#1B2B5E]" : ""}`} />
                          <p className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            isComplete ? "text-[#1B2B5E]" : "text-gray-300"
                          }`}>
                            {stepLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Original Submission</h4>
                      <p className="text-[#1A1830] leading-relaxed text-lg italic">
                        "{selected.description}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#FAF8F4] p-6 rounded-[24px]">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#E8A020] mb-4">
                          <Clock size={12} />
                          Report Cycle
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Filed Date</span>
                            <span className="font-semibold">{selected.date}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Status Changed</span>
                            <span className="font-semibold">{selected.updated}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#1B2B5E] text-white p-6 rounded-[24px]">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#E8A020] mb-4">
                          <Sparkles size={12} />
                          Smart ETA
                        </h4>
                        <p className="text-lg font-serif mb-1">
                          {selected.smartEta || "--"}
                        </p>
                        <p className="text-white/40 text-[10px] tracking-wide">BASED ON CURRENT LOAD</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expert Assessment Card */}
                <div className="bg-white border border-[#E5DDD0] rounded-[32px] p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600">
                        <Sparkles size={20} />
                      </div>
                      <h3 className="font-serif text-xl text-[#1B2B5E]">Faculty Assessment</h3>
                    </div>
                    {!selected.smartSummary && (
                      <button 
                        onClick={() => handleAnalyse(selected)}
                        disabled={analysing}
                        className="bg-[#1B2B5E] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#2A3F7E] disabled:opacity-50"
                      >
                        {analysing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Run Diagnostic
                      </button>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {selected.smartSummary ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-between">
                          <p className="text-[#1B2B5E]/60 text-[10px] font-bold uppercase tracking-widest mb-3">Resolution Tip</p>
                          <p className="text-sm font-medium text-[#1B2B5E] leading-relaxed mb-4">"{selected.smartTip}"</p>
                          <div className="h-px bg-blue-100 my-4" />
                          <div>
                            <p className="text-[#1B2B5E]/60 text-[10px] font-bold uppercase tracking-widest mb-1">Status Note</p>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{selected.smartNext}</p>
                          </div>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4">Executive Summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed font-medium">
                            {selected.smartSummary}
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="text-center py-10 space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-3xl grayscale opacity-50">🤖</div>
                        <div className="space-y-1">
                          <p className="font-bold text-[#1B2B5E]">Assessment Pending</p>
                          <p className="text-xs text-gray-400">Run a diagnostic to get prioritized insights and resolution tips.</p>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="flex justify-center pt-8">
                    <button 
                        onClick={() => { setAdvisorChat([]); setView("advisor"); }}
                        className="bg-[#E8A020] text-[#1B2B5E] px-10 py-4 rounded-2xl font-bold flex items-center gap-3 hover:scale-105 transition-all shadow-lg"
                    >
                        <MessageCircle size={22} />
                        Discuss Case with Prof. Aethelgard
                    </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Advisor View (Dedicated Chat Area) */}
          {view === "advisor" && (
            <motion.div 
               key="advisor"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="max-w-4xl mx-auto h-[calc(100vh-280px)] min-h-[600px] flex flex-col"
            >
                <div className="bg-white border border-[#E5DDD0] rounded-[40px] shadow-2xl flex-1 flex flex-col overflow-hidden">
                    {/* Advisor Header */}
                    <div className="bg-[#1B2B5E] p-8 text-white flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-[#E8A020] rounded-3xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform">
                                <User size={40} className="text-[#1B2B5E]" />
                            </div>
                            <div>
                                <h2 className="font-serif text-3xl leading-tight">Prof. Aethelgard</h2>
                                <p className="text-[#E8A020] text-xs font-bold uppercase tracking-[0.2em] mt-1">Senior Faculty Mentor</p>
                            </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Current Status</span>
                            <div className="flex items-center gap-2 text-green-400">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs font-bold">Available in Office</span>
                            </div>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div ref={chatRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#FAF8F4] scroll-smooth">
                        {advisorChat.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-lg mx-auto">
                                <div className="text-4xl bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-sm">🕯️</div>
                                <div className="space-y-4">
                                    <h3 className="font-serif text-2xl text-[#1B2B5E]">"Greetings, student."</h3>
                                    <p className="text-gray-600 leading-relaxed italic">
                                        "I understand navigating the university's administrative landscape can be... challenging. I am here to help you articulate your concerns with the precision they deserve."
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-3 pt-4">
                                    {[
                                        "How do I file a proper grade appeal?",
                                        "What are the attendance policies?",
                                        "I have an issue with a lecturer.",
                                        "Missing scholarship funds."
                                    ].map(hint => (
                                        <button 
                                            key={hint}
                                            onClick={() => setChatInput(hint)}
                                            className="px-5 py-2.5 bg-white border border-[#E5DDD0] rounded-2xl text-xs font-bold text-[#1B2B5E] hover:border-[#1B2B5E] transition-all shadow-sm"
                                        >
                                            {hint}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {advisorChat.map((msg, i) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={i} 
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] px-6 py-4 rounded-[28px] text-sm leading-relaxed shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-[#1B2B5E] text-white rounded-tr-none font-medium' 
                                    : 'bg-white text-gray-800 border border-[#E5DDD0] rounded-tl-none font-serif italic text-base px-8'
                                }`}>
                                    {msg.content}
                                </div>
                            </motion.div>
                        ))}

                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white px-6 py-3 rounded-full flex gap-2 border border-gray-100 italic text-gray-400 text-sm">
                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    Professor is thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Input Area */}
                    <div className="p-8 bg-white border-t border-[#E5DDD0]">
                        <div className="flex gap-4 max-w-3xl mx-auto">
                            <div className="flex-1 bg-[#FAF8F4] border-2 border-gray-100 rounded-3xl p-2 flex items-center transition-all focus-within:border-[#1B2B5E] focus-within:shadow-lg">
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendChat(false)}
                                    placeholder="Consult with the Professor..."
                                    className="flex-1 bg-transparent px-6 py-3 text-sm focus:outline-none font-medium"
                                />
                            </div>
                            <button 
                                onClick={() => handleSendChat(false)}
                                disabled={chatLoading}
                                className="bg-[#1B2B5E] text-white w-16 h-16 rounded-[24px] flex items-center justify-center shadow-xl hover:bg-[#2A3F7E] transition-all disabled:opacity-50 group"
                            >
                                <Send size={24} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        <p className="text-center text-[10px] text-gray-400 mt-4 font-bold uppercase tracking-widest">
                            Official Consultation — Recorded for Quality Assurance
                        </p>
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Professor Chat Overlay */}
      <AnimatePresence>
        {showProfChat && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#E5DDD0]"
          >
            <div className="bg-[#1B2B5E] p-6 text-white shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-[#E8A020] flex items-center justify-center text-[#1B2B5E]">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-serif text-lg leading-tight">Prof. Aethelgard</h4>
                  <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Reporting Advisor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowProfChat(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAF8F4] scroll-smooth">
              {advisorChat.length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-2xl">🎓</div>
                  <p className="text-sm text-gray-700 px-8 font-medium italic">
                    "My student, I'm here to help you articulate your concerns. What seems to be the trouble?"
                  </p>
                </div>
              )}
              {advisorChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-[#1B2B5E] text-white rounded-tr-none' 
                    : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none font-medium'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white px-5 py-3 rounded-2xl flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <div className="flex gap-2 bg-[#FAF8F4] border border-gray-100 rounded-2xl p-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat(true)}
                  placeholder="Tell the Professor..."
                  className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none font-medium"
                />
                <button 
                  onClick={() => handleSendChat(true)}
                  disabled={chatLoading}
                  className="bg-[#1B2B5E] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#2A3F7E] transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <footer className="max-w-6xl mx-auto px-8 py-12 border-t border-[#E5DDD0]/50 mt-20 opacity-40">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="bg-[#1B2B5E] text-white p-1 rounded font-serif text-[10px] font-bold">KM</div>
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1B2B5E]">K.R. Mangalam University Student Portal</p>
          </div>
          <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-500">
             <a href="#" className="hover:text-[#1B2B5E]">Policies</a>
             <a href="#" className="hover:text-[#1B2B5E]">Privacy</a>
             <a href="#" className="hover:text-[#1B2B5E]">Feedback</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Missing Lucide Icons


