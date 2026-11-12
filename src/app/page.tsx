import Link from "next/link";
import {
  BarChart3,
  Brain,
  TrendingUp,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  GitFork,
} from "lucide-react";

// ─── PaySight Logo (reusable on landing page) ────────────────────────────────

function LandingLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm bg-white text-[#0A0F1E] select-none"
        aria-hidden="true"
      >
        P
      </div>
      <span className="font-bold text-lg tracking-tight text-white">
        PaySight
      </span>
      <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E2D40] text-[#60A5FA] border border-[#1E3A5F]">
        v2.0
      </span>
    </div>
  );
}

// ─── Navigation Header ───────────────────────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#0A0F1E]/90 backdrop-blur-md border-b border-[#1E2D40]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <LandingLogo />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#8B9AB5]">
          <a
            href="#features"
            className="hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors"
          >
            How It Works
          </a>
          <a href="#about" className="hover:text-white transition-colors">
            About
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-[#8B9AB5] hover:text-white hover:bg-[#1E2D40] transition-all"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-900/30"
          >
            Get Started
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 px-4 sm:px-6">
      {/* Background gradient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E2D40] border border-[#1E3A5F] text-xs font-medium text-[#60A5FA] mb-6">
          <Zap className="w-3.5 h-3.5" />
          AI-Powered PayPal Merchant Analytics
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
          Smarter Payments.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #60A5FA 0%, #34D399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Better Business
          </span>{" "}
          Decisions.
        </h1>

        <p className="text-lg sm:text-xl text-[#8B9AB5] max-w-2xl mx-auto mb-10 leading-relaxed">
          Turn your PayPal transactions into actionable financial intelligence.
          Understand your revenue, monitor spending, compare market prices, and
          make smarter business decisions with AI.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-base transition-all shadow-xl shadow-blue-900/40 hover:shadow-blue-900/60 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#111827] hover:bg-[#1E2D40] text-[#8B9AB5] hover:text-white font-semibold text-base border border-[#1E2D40] transition-all"
          >
            Explore PaySight
          </a>
        </div>
      </div>

      {/* Dashboard mockup illustration */}
      <div className="mt-16 max-w-5xl mx-auto relative">
        <div
          className="relative rounded-2xl border border-[#1E2D40] overflow-hidden shadow-2xl shadow-black/50"
          style={{
            background:
              "linear-gradient(180deg, #111827 0%, #0D1626 100%)",
          }}
        >
          {/* Fake browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2D40] bg-[#0A0F1E]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#1E2D40]" />
              <div className="w-3 h-3 rounded-full bg-[#1E2D40]" />
              <div className="w-3 h-3 rounded-full bg-[#1E2D40]" />
            </div>
            <div className="flex-1 mx-4 bg-[#1E2D40] rounded-md px-3 py-1 text-xs text-[#4A5568] font-mono">
              app.paysight.io/dashboard
            </div>
          </div>

          {/* Mockup content */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#1E2D40]">
            {[
              { label: "Net Revenue", value: "$12,840", change: "+8.4%", positive: true },
              { label: "Transactions", value: "284", change: "+12.1%", positive: true },
              { label: "PayPal Fees", value: "$371", change: "-2.3%", positive: false },
              { label: "Avg. Order", value: "$45.21", change: "+3.7%", positive: true },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-[#0A0F1E] border border-[#1E2D40] rounded-xl p-4"
              >
                <p className="text-xs text-[#4A5568] mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p
                  className={`text-xs font-medium mt-1 ${
                    kpi.positive ? "text-[#34D399]" : "text-[#F87171]"
                  }`}
                >
                  {kpi.change} vs last period
                </p>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-[#4A5568] italic">
              ✦ Illustrative demo data — not real merchant figures
            </p>
            <span className="text-xs font-mono px-2 py-1 rounded bg-[#0A0F1E] border border-[#1E2D40] text-[#34D399]">
              ● Live Preview
            </span>
          </div>
        </div>

        {/* Gradient fade at bottom */}
        <div
          className="absolute -bottom-1 left-0 right-0 h-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent, #0A0F1E)",
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────

const features = [
  {
    icon: BarChart3,
    title: "Payment Analytics",
    description:
      "Understand your business performance through PayPal transaction analytics, revenue trends, fees, refunds, and financial KPIs — all in one unified view.",
    color: "text-[#60A5FA]",
    bg: "bg-[#1E2D40]",
  },
  {
    icon: Brain,
    title: "AI Merchant Copilot",
    description:
      "Ask questions about your business and receive insights grounded in your available merchant data. Powered by Gemini AI with full transaction context.",
    color: "text-[#A78BFA]",
    bg: "bg-[#1E1830]",
  },
  {
    icon: TrendingUp,
    title: "Market Intelligence",
    description:
      "Compare product prices and understand market opportunities using Channel3 real-time market intelligence. Stay competitive with live pricing benchmarks.",
    color: "text-[#34D399]",
    bg: "bg-[#0D2420]",
  },
  {
    icon: Wallet,
    title: "Budget Intelligence",
    description:
      "Track monthly targets, operating expenses, budget variances, and estimated operating cash flow. Plan confidently with live budget-vs-actuals dashboards.",
    color: "text-[#FBBF24]",
    bg: "bg-[#1E1A0A]",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Everything your merchant business needs
          </h2>
          <p className="text-[#8B9AB5] text-lg max-w-2xl mx-auto">
            PaySight brings together payments, AI, market data, and budgeting
            into a single intelligent command center.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group bg-[#111827] border border-[#1E2D40] hover:border-[#2D4A6B] rounded-2xl p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}
                >
                  <Icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5">
                  {feature.title}
                </h3>
                <p className="text-[#8B9AB5] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const steps = [
  {
    step: "01",
    title: "Connect Your Merchant Account",
    description:
      "Connect your PayPal Sandbox or supported merchant integration. Configure your credentials and PaySight securely fetches your transaction data.",
  },
  {
    step: "02",
    title: "Analyze Business Performance",
    description:
      "Explore your transactions, revenue trends, invoices, and disputes through real-time dashboards built from your actual merchant data.",
  },
  {
    step: "03",
    title: "Act on AI-Powered Insights",
    description:
      "Use the AI Copilot, budgeting tools, and Channel3 market intelligence to understand opportunities and make informed business decisions.",
  },
];

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-4 sm:px-6 border-t border-[#1E2D40]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            How PaySight works
          </h2>
          <p className="text-[#8B9AB5] text-lg max-w-2xl mx-auto">
            Get from raw transactions to actionable intelligence in three
            straightforward steps.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div
            className="hidden sm:block absolute top-8 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-[#1E3A5F] to-transparent"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div key={step.step} className="relative text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1E2D40] border border-[#2D4A6B] mb-5 relative z-10">
                <span className="text-2xl font-black text-[#60A5FA] font-mono">
                  {index + 1}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-2.5">
                {step.title}
              </h3>
              <p className="text-[#8B9AB5] text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Benefits Section ──────────────────────────────────────────────────────────

const benefits = [
  "Real PayPal Sandbox transaction data — no fabricated numbers",
  "AI insights grounded in your actual merchant data",
  "Live Channel3 competitor pricing benchmarks",
  "Budget vs. actuals with operating cash flow estimates",
  "PayPal invoice creation and status tracking",
  "Chargeback and dispute monitoring",
  "Sandbox checkout and payment capture testing",
  "Open-source — full codebase on GitHub",
];

function BenefitsSection() {
  return (
    <section
      id="about"
      className="py-20 px-4 sm:px-6 border-t border-[#1E2D40]"
    >
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-5">
            Built for{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #60A5FA 0%, #34D399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              merchant transparency
            </span>
          </h2>
          <p className="text-[#8B9AB5] text-base leading-relaxed mb-8">
            PaySight is built on a strict no-fabrication policy. Every metric,
            transaction, and insight shown in the dashboard is sourced from real
            API data or clearly labeled as a demo. No fake KPIs. No invented
            dispute records.
          </p>

          <ul className="space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-[#34D399] flex-shrink-0 mt-0.5" />
                <span className="text-[#C4D1E1]">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            {
              icon: Shield,
              label: "No fabricated data",
              sub: "Fails closed rather than showing fake metrics",
              color: "text-[#34D399]",
              bg: "bg-[#0D2420]",
            },
            {
              icon: Zap,
              label: "Real-time sync",
              sub: "Live PayPal Sandbox transaction fetching",
              color: "text-[#60A5FA]",
              bg: "bg-[#1E2D40]",
            },
            {
              icon: Globe,
              label: "Multi-currency",
              sub: "USD, EUR, GBP, CAD and more",
              color: "text-[#FBBF24]",
              bg: "bg-[#1E1A0A]",
            },
            {
              icon: Brain,
              label: "Gemini AI",
              sub: "Merchant-aware AI copilot built-in",
              color: "text-[#A78BFA]",
              bg: "bg-[#1E1830]",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="bg-[#111827] border border-[#1E2D40] rounded-xl p-5"
              >
                <div
                  className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}
                >
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-sm font-semibold text-white mb-1">
                  {item.label}
                </p>
                <p className="text-xs text-[#8B9AB5]">{item.sub}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ──────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 border-t border-[#1E2D40]">
      <div className="max-w-2xl mx-auto text-center">
        <div
          className="relative rounded-3xl border border-[#1E3A5F] overflow-hidden p-10"
          style={{
            background:
              "linear-gradient(135deg, #0D1A30 0%, #111827 50%, #0A1628 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 70%)",
            }}
          />

          <h2 className="text-3xl font-extrabold text-white mb-4 relative">
            Ready to see your merchant data clearly?
          </h2>
          <p className="text-[#8B9AB5] text-base mb-8 relative">
            Create a free PaySight account and connect your PayPal Sandbox to
            start exploring your merchant analytics.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-base transition-all shadow-xl shadow-blue-900/40"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-transparent hover:bg-[#1E2D40] text-[#8B9AB5] hover:text-white font-semibold text-base border border-[#1E2D40] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[#1E2D40] py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-black text-xs bg-white text-[#0A0F1E] select-none"
            aria-hidden="true"
          >
            P
          </div>
          <div>
            <span className="font-bold text-sm text-white">PaySight</span>
            <p className="text-[10px] text-[#4A5568]">
              © {new Date().getFullYear()} PaySight. Hackathon project.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm text-[#8B9AB5]">
          <a
            href="https://github.com/yugomania/Paysight"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <GitFork className="w-4 h-4" />
            GitHub
          </a>
          <span className="text-[#1E2D40]">|</span>
          <span className="text-[#4A5568] text-xs">
            All financial data shown is PayPal Sandbox or demo only.
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <Header />
      <main>
        <Hero />
        <FeaturesSection />
        <HowItWorksSection />
        <BenefitsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
