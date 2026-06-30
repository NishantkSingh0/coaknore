import { Link, useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

export default function Services() {
  const { pathname } = useLocation();
  useReveal(pathname);

  return (
    <> 
    <Navbar/>
    <main className="pt-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="bg-cover bg-center text-white"
        style={{ backgroundImage: "url('/images/44.png')" }}
      >
        <div className="bg-slate-950/85">
          <div className="mx-auto max-w-6xl px-6 py-28 sm:px-10 lg:px-16">
            <span className="hero-enter badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
              Our Services
            </span>
            <h1 className="hero-enter hero-enter-delay-1 mt-6 text-5xl font-black tracking-tight sm:text-6xl">
              Full furniture, design, and build services.
            </h1>
            <p className="hero-enter hero-enter-delay-2 mt-6 max-w-2xl text-lg leading-8 text-slate-100/90">
              From custom manufacturing to interior collaboration, Oak&amp;Ore supports every step of your project.
            </p>
          </div>
        </div>
      </section>

      {/* ── Service cards ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="reveal mb-12 text-center" data-reveal="fade">
          <h2 className="text-3xl font-bold text-[#131042]">What we offer</h2>
          <p className="mt-3 text-[#1e1873]">End-to-end services for every kind of project.</p>
        </div>
        <div className="grid gap-10 lg:grid-cols-3" data-reveal-stagger="110">
          {[
            { num: '01', title: 'Custom Furniture',      desc: 'Bespoke tables, seating, storage, and cabinetry created to match your exact scale, material, and finish preferences.' },
            { num: '02', title: 'Interior Design',       desc: 'We develop design concepts, space planning, and furniture layouts for residential and hospitality interiors.' },
            { num: '03', title: 'Production & Delivery', desc: 'Full-scale manufacturing, quality control, and white-glove delivery for projects of any size.' },
          ].map(({ num, title, desc }) => (
            <article
              key={num}
              className="reveal rounded-4xl bg-white p-10 shadow-xl shadow-slate-200/50 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
                {num}
              </span>
              <h2 className="mt-6 text-3xl font-semibold text-[#131042]">{title}</h2>
              <p className="mt-4 leading-7 text-[#1e1873]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Project approach dark section ────────────────────────────────── */}
      <section className="bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="reveal space-y-6" data-reveal="left">
              <span className="badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
                Project approach
              </span>
              <h2 className="text-4xl font-bold">From first sketch to finished installation.</h2>
              <p className="leading-8 text-slate-300">
                We partner with architects and homeowners to translate interiors into furniture that elevates every detail.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2" data-reveal-stagger="100">
              <div className="reveal rounded-4xl bg-slate-900 p-8 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
                <h3 className="text-2xl font-semibold">Design consultation</h3>
                <p className="mt-4 text-slate-300">Collaborative concept development, finish selection, and material sourcing.</p>
              </div>
              <div className="reveal rounded-4xl bg-slate-900 p-8 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
                <h3 className="text-2xl font-semibold">Project management</h3>
                <p className="mt-4 text-slate-300">A dedicated team ensures timelines, installations, and quality are seamless.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="reveal rounded-4xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5" data-reveal="scale">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#131042]">
                Bring your most ambitious interiors to life.
              </h2>
              <p className="mt-6 leading-8 text-slate-600">
                We can help you design furniture sequences, select finishes, and craft spaces that feel refined and comfortable.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full bg-[#131042] px-7 py-3 text-sm font-semibold text-white transition hover:scale-105"
              >
                Start your project
              </Link>
              <Link
                to="/departments"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-7 py-3 text-sm font-semibold text-[#131042] transition hover:bg-slate-100 hover:scale-105"
              >
                View Departments
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
    <Footer/>
  </>
  );
}
