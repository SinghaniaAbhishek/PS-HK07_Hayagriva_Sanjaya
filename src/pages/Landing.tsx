import { useNavigate } from 'react-router-dom';
import { MapPin, Shield, Bell, Wifi, Battery, Eye, Users, ChevronRight, Activity } from 'lucide-react';
import heroStick from '@/assets/hero-stick.jpg';

const features = [
  { icon: MapPin, title: 'Real-Time Tracking', desc: 'Track your loved one\'s location live on an interactive map with precise GPS coordinates.' },
  { icon: Bell, title: 'Fall Detection', desc: 'Instant alerts when a fall is detected, with vibration pattern analysis for accuracy.' },
  { icon: Shield, title: 'Obstacle Warning', desc: 'Ultrasonic sensors detect obstacles and trigger haptic vibration feedback on the stick.' },
  { icon: Battery, title: 'Battery Monitoring', desc: 'Monitor device battery levels remotely with low-battery alerts sent to guardians.' },
  { icon: Wifi, title: 'IoT Connected', desc: 'Always connected via IoT for seamless real-time data streaming to the dashboard.' },
  { icon: Users, title: 'Multi-Device Support', desc: 'Monitor multiple visually impaired individuals from a single guardian dashboard.' },
];

const howItWorks = [
  { step: '01', title: 'Admin Setup', desc: 'Admin creates guardian accounts and links smart stick devices to them.' },
  { step: '02', title: 'Guardian Login', desc: 'Guardian logs in with provided credentials and sets up user profiles.' },
  { step: '03', title: 'Live Monitoring', desc: 'View real-time location, battery, movement status and receive instant alerts.' },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">Sanjaya</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition hover:text-foreground">How It Works</a>
            <a href="#about" className="text-sm text-muted-foreground transition hover:text-foreground">About</a>
          </div>
          <button onClick={() => navigate('/login')} className="rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            Guardian Login
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.03]" />
        <div className="container mx-auto grid min-h-[85vh] items-center gap-12 px-6 lg:grid-cols-2">
          <div className="relative z-10 animate-slide-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">IoT-Powered Assistive Technology</span>
            </div>
            <h1 className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl xl:text-7xl">
              Seeing Beyond<br /><span className="text-gradient">Sight</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-muted-foreground">
              Sanjaya is an intelligent smart stick system that empowers visually impaired individuals with real-time navigation, fall detection, and obstacle awareness — keeping guardians connected and informed.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate('/login')} className="group flex items-center gap-2 rounded-xl bg-gradient-primary px-7 py-3.5 font-semibold text-primary-foreground transition hover:opacity-90">
                Get Started <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <a href="#features" className="flex items-center gap-2 rounded-xl border border-border px-7 py-3.5 font-semibold text-foreground transition hover:bg-secondary">
                Explore Features
              </a>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="absolute inset-0 rounded-3xl bg-gradient-primary opacity-10 blur-3xl" />
            <img src={heroStick} alt="Sanjaya Smart Stick" className="relative z-10 w-full max-w-lg animate-float rounded-2xl" />
          </div>
        </div>
      </section>

      <section id="features" className="py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl font-bold text-foreground">Powerful Features</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">Everything you need to ensure safety and independence for visually impaired individuals.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-border bg-card p-7 shadow-card transition hover:shadow-elevated">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-secondary/30 py-24">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-4xl font-bold text-foreground">How It Works</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">A simple three-step process to get started with Sanjaya.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {howItWorks.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary font-display text-2xl font-bold text-primary-foreground">{s.step}</div>
                <h3 className="mb-2 font-display text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-24">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 font-display text-4xl font-bold text-foreground">About Sanjaya</h2>
          <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground">
            Named after the divine narrator in the Mahabharata who could see events from afar, Sanjaya empowers guardians with the ability to watch over and protect visually impaired individuals — seeing beyond the limitations of sight through modern IoT technology.
          </p>
          <button onClick={() => navigate('/login')} className="rounded-xl bg-gradient-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90">
            Start Monitoring Today
          </button>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-foreground">Sanjaya</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Sanjaya – Seeing Beyond Sight. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
