import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen grid-bg relative overflow-hidden">
      <div className="orb orb-1 pulse-animation"></div>
      <div className="orb orb-2 pulse-animation" style={{ animationDelay: '1s' }}></div>
      
      <nav className="relative z-10 border-b border-slate-700/50 backdrop-blur-md bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <span className="text-xl font-bold gradient-text">TicketHub</span>
            </div>
            <div className="flex items-center">
              <Link
                href="/auth/login"
                className="btn-primary px-5 py-2 rounded-lg text-sm font-medium text-white shadow-lg"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 flex-grow flex items-center justify-center py-20 px-4">
        <div className="text-center max-w-5xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-sm text-sky-300 code-font">System Online</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold mb-6">
            <span className="text-white">Modern </span>
            <span className="gradient-text glow-text">IT Ticket</span>
            <br />
            <span className="text-white">Management</span>
          </h1>
          
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Streamline your IT operations with a powerful ticket management system.
            Track incidents, manage requests, and resolve issues efficiently.
          </p>

          <div className="mt-10 grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="card p-6 rounded-xl glow-border">
              <div className="w-12 h-12 rounded-lg bg-sky-500/20 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Lightning Fast</h3>
              <p className="text-sm text-slate-400">Quick ticket creation and real-time updates</p>
            </div>
            
            <div className="card p-6 rounded-xl glow-border">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Secure</h3>
              <p className="text-sm text-slate-400">Enterprise-grade security and access control</p>
            </div>
            
            <div className="card p-6 rounded-xl glow-border">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Analytics</h3>
              <p className="text-sm text-slate-400">Track performance with detailed metrics</p>
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href="/auth/login"
              className="btn-primary px-8 py-4 rounded-xl text-base font-semibold text-white shadow-xl inline-flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign In
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto border-t border-slate-700/50 pt-8">
            <div>
              <div className="text-3xl font-bold gradient-text">10K+</div>
              <div className="text-sm text-slate-400 mt-1">Tickets Resolved</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">99.9%</div>
              <div className="text-sm text-slate-400 mt-1">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">&lt;5m</div>
              <div className="text-sm text-slate-400 mt-1">Avg Response</div>
            </div>
            <div>
              <div className="text-3xl font-bold gradient-text">24/7</div>
              <div className="text-sm text-slate-400 mt-1">Support</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-700/50 backdrop-blur-md bg-slate-900/30">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2026 TicketHub. Built for modern IT teams.
            </p>
            <div className="flex gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-sky-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-sky-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-sky-400 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
