import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Home',        to: '/' },
  { label: 'About',       to: '/about' },
  { label: 'Collections', to: '/products' },
  { label: 'Services',    to: '/services' },
  { label: 'Departments',     to: '/departments' },
  { label: 'Contact',     to: '/contact' },
  { label: 'Login',     to: '/login' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled]  = useState(false);
  const [hidden, setHidden] = useState(false);
  const prevScrollY = useRef(0);
  const { pathname } = useLocation();

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const isScrollingDown = currentY > prevScrollY.current;

      if (currentY <= 20) {
        setHidden(false);
      } else if (Math.abs(currentY - prevScrollY.current) > 10) {
        setHidden(isScrollingDown);
      }

      setScrolled(currentY > 20);
      prevScrollY.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/45 backdrop-blur transition-all duration-300 ${
          scrolled ? 'shadow-[0_20px_80px_rgba(15,23,42,0.08)]' : ''
        } ${hidden && !menuOpen ? '-translate-y-full' : 'translate-y-0'}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 text-xl font-semibold text-oak relative z-60">
            <img src={"./images/logo3.png"} alt="logo" className="h-10 w-10 rounded-3xl" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition hover:text-blue-500 ${
                  pathname === to ? 'text-blue-500' : 'text-[#131042]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile toggle — sits above the overlay */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="relative z-60 inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-full border border-slate-200 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#131042] transition-all duration-300 origin-center ${
                menuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#131042] transition-all duration-300 ${
                menuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#131042] transition-all duration-300 origin-center ${
                menuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>
      </header>

      {/* Full-screen mobile overlay */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-white md:hidden transition-all duration-500 ease-in-out ${
          menuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-6 pointer-events-none'
        }`}
        aria-hidden={!menuOpen}
      >
        {/* Centered nav links */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-8 pb-16 pt-24">
          {navLinks.map(({ label, to }, i) => (
            <Link
              key={to}
              to={to}
              style={{
                transitionDelay: menuOpen ? `${i * 55 + 80}ms` : '0ms',
              }}
              className={`w-full max-w-xs rounded-2xl px-6 py-4 text-center text-2xl font-semibold transition-all duration-300 ${
                menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              } ${
                pathname === to
                  ? 'bg-blue-50 text-blue-500'
                  : 'text-[#131042] hover:bg-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Footer hint */}
        <p className="pb-10 text-center text-xs text-slate-400 tracking-widest uppercase">
          Crafted Oak &amp; Ore
        </p>
      </div>
    </>
  );
}
