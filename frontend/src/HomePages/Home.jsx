import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

export default function Home() {
  const { pathname } = useLocation();
  useReveal(pathname);

  return (
        <> <Navbar/>
    <main className="pt-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative h-[calc(100vh-80px)] overflow-hidden bg-white lg:bg-[url('/images/42.png')] lg:bg-cover lg:bg-center">
        <div className="absolute inset-0 hidden bg-black/10 lg:block" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-6 text-center sm:px-10 lg:items-start lg:justify-end lg:px-20 lg:pb-16 lg:text-left">
          {/* Mobile branding — entrance animations */}
          <div className="block lg:hidden">
            <h1 className="hero-enter text-5xl font-mono tracking-[0.22em] text-black sm:text-6xl">
              Crafted
            </h1>
            <h1 className="hero-enter hero-enter-delay-1 mt-5 text-5xl font-light tracking-[0.22em] text-black sm:text-6xl">
              Oak &amp; Ore
            </h1>
            <p className="hero-enter hero-enter-delay-2 mt-5 text-xs uppercase tracking-[0.45em] text-neutral-500 sm:text-sm">
              A Luxury Goods Atelier
            </p>
          </div>
          {/* Buttons */}
          <div className="hero-enter hero-enter-delay-3 mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <Link
              to="/products"
              className="rounded-full bg-[#131042] px-8 py-3 text-sm font-medium tracking-wide text-white transition duration-300 hover:bg-neutral-800 hover:scale-105"
            >
              Explore Collection
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-black/20 bg-black/5 px-8 py-3 text-sm font-medium tracking-wide text-black backdrop-blur-sm transition duration-300 hover:bg-black/10 hover:scale-105"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="reveal mb-12 text-center" data-reveal="fade">
          <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-800">
            Why Oak &amp; Ore
          </span>
        </div>
        <div className="grid gap-8 lg:grid-cols-3" data-reveal-stagger="100">
          {[
            { num: '01', title: 'Design Studio Excellence', desc: 'From concept to production, our team delivers bespoke furniture with sculptural forms and premium joinery.' },
            { num: '02', title: 'Sustainable Materials',    desc: 'We source responsibly harvested oak, walnut, and artisanal finishes to create furniture built to last generations.' },
            { num: '03', title: 'Interior Partnerships',    desc: 'We bring furniture collections, space planning, and craftsman-led detail to residential and commercial builds.' },
          ].map(({ num, title, desc }) => (
            <article
              key={num}
              className="reveal rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-900/5 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-100 text-[#131042] font-semibold">
                {num}
              </div>
              <h2 className="text-2xl font-semibold text-[#131042]">{title}</h2>
              <p className="mt-4 text-[#131042]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Craft & Story dark section ───────────────────────────────────── */}
      <section className="bg-gray-950 text-slate-100">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 sm:px-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-16">
          <div className="reveal space-y-6" data-reveal="left">
            <span className="badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-200">
              Craft &amp; story
            </span>
            <h2 className="text-4xl font-bold tracking-tight">
              Furniture with form, function, and soulful detail.
            </h2>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Oak&amp;Ore combines contemporary minimalism with handcrafted textures to deliver pieces that feel at home in elegant interiors and modern studios.
            </p>
            <div className="grid gap-4 sm:grid-cols-2" data-reveal-stagger="80">
              <div className="reveal rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6">
                <p className="text-sm uppercase tracking-[0.22em] text-blue-500">Timeless build</p>
                <p className="mt-3 text-slate-300">Engineered joinery, solid hardwood frames, and finishes that deepen beautifully over time.</p>
              </div>
              <div className="reveal rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6">
                <p className="text-sm uppercase tracking-[0.22em] text-blue-500">Creative process</p>
                <p className="mt-3 text-slate-300">A collaborative design approach where your vision meets artisan furniture makers.</p>
              </div>
            </div>
          </div>
          <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/50" data-reveal="right">
            <img
              src="https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80"
              alt="Oak furniture"
              className="h-full w-full rounded-4xl object-cover transition duration-700 hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-slate-950/95 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Featured Collection ──────────────────────────────────────────── */}
      <section className="mx-auto px-6 py-20 sm:px-10 lg:px-16 bg-[#e4e4e4]">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="reveal space-y-6" data-reveal="left">
            <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-900">
              Featured Collection
            </span>
            <h2 className="text-4xl font-bold text-[#131042]">
              Signature furniture made for modern living.
            </h2>
            <p className="max-w-xl text-slate-500">
              Explore chairs, dining sets, cabinets, and studio furniture designed with natural curves and practical storage to elevate your space.
            </p>
            <div className="flex flex-wrap gap-4 ">
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-full bg-[#131042] px-7 py-3 text-sm font-semibold text-white transition hover:scale-105"
              >
                View Products
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full border border-slate-600 px-7 py-3 text-sm font-semibold text-slate-500 transition hover:bg-gray-100 bg-amber-20 hover:scale-105"
              >
                Talk with us
              </Link>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2" data-reveal-stagger="120">
            <article className="bg-[#06051d] reveal rounded-4xl p-6 shadow-lg shadow-slate-200/60 transition duration-300 hover:-translate-y-2 hover:shadow-xl">
              <img src="/images/27.png" alt="Wood chair" className="mb-6 h-64 w-full rounded-3xl object-cover transition duration-500 hover:scale-105" />
              <h3 className="text-xl font-semibold text-white">Oak Lounge Chair</h3>
              <p className="mt-3 text-slate-300">A sculptural lounge chair finished in warm oak with curved nylon legs for a light, airy look.</p>
            </article>
            <article className="reveal rounded-4xl bg-[#06051d] p-6 shadow-lg shadow-slate-200/60 transition duration-300 hover:-translate-y-2 hover:shadow-xl" data-reveal="up">
              <img src="/images/33.png" alt="Minimal table" className="mb-6 h-64 w-full rounded-3xl object-cover transition duration-500 hover:scale-105" />
              <h3 className="text-xl font-semibold text-white">Aura Bedside Cabinet</h3>
              <p className="mt-3 text-slate-300">Crafted to enhance contemporary bedrooms with elegant storage and refined functionality.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
        <Footer/>
        </>
  );
}
