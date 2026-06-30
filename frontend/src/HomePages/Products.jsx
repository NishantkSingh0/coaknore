import { Link, useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

const products = [
  { img: '/images/30.png', name: 'Lan Mountain Chair',         desc: 'A striking dining collection with warm oak surfaces and sculpted bench seating.',                                          category: 'Dining' },
  { img: '/images/31.png', name: 'Hammered Accent Side Table', desc: 'Sculptural side table featuring a hand-textured metallic base and smooth wooden top for a refined modern look.',          category: 'Lounges' },
  { img: '/images/32.png', name: 'Horizon Luxe Bed',           desc: 'Designed to bring premium comfort and elegant luxury to refined bedroom interiors.',                                       category: 'Bedroom' },
  { img: '/images/33.png', name: 'Aura Bedside Cabinet',       desc: 'Crafted to enhance contemporary bedrooms with elegant storage and refined functionality.',                                 category: 'Storage' },
  { img: '/images/35.png', name: 'Bespoke Bed Frame',          desc: 'Designed for restful bedrooms, with clean lines and durable construction.',                                                category: 'Bedroom' },
  { img: '/images/34.png', name: 'Heritage Writing Desk',      desc: 'Perfect for modern workspaces and reading corners that blend comfort with sophisticated style.',                           category: 'Study' },
  { img: '/images/36.png', name: 'Luna Coffee Table',          desc: 'Modern coffee table crafted with a sleek glass top, soft curves, and functional open storage.',                           category: 'Living spaces' },
  { img: '/images/37.png', name: 'Prestige Display Cabinet',   desc: 'Luxury storage cabinet featuring a transparent top display and spacious compartmentalized drawers.',                      category: 'Living spaces' },
  { img: '/images/38.png', name: 'Haven Lounge Chair',         desc: 'Stylish lounge chair designed with plush upholstery, rounded forms, and premium comfort seating.',                        category: 'Accents' },
  { img: '/images/39.png', name: 'Nova Storage Cabinet',       desc: 'Contemporary storage cabinet designed with clean lines, spacious drawers, and a sleek matte finish.',                     category: 'Storage' },
  { img: '/images/40.png', name: 'Eclipse Dining Table',       desc: 'Luxury dining table featuring a sculptural metallic base and sophisticated marble-inspired tabletop.',                    category: 'Dining' },
  { img: '/images/41.png', name: 'Verona Lounge Sofa',         desc: 'Elegant lounge sofa offering plush cushioning, curved armrests, and exceptional everyday comfort.',                       category: 'Living spaces' },
];

export default function Products() {
  const { pathname } = useLocation();
  useReveal(pathname);

  return (
    <> <Navbar/>
    
    <main className="pt-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="bg-cover bg-center text-white"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1700&q=80')" }}
      >
        <div className="bg-slate-950/85">
          <div className="mx-auto max-w-6xl px-6 py-28 sm:px-10 lg:px-16">
            <span className="hero-enter badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
              Our Collections
            </span>
            <h1 className="hero-enter hero-enter-delay-1 mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Beautiful furniture for every space.
            </h1>
            <p className="hero-enter hero-enter-delay-2 mt-6 max-w-2xl text-base leading-8 text-slate-100/90 sm:text-lg">
              Browse our signature designs built to make living rooms, dining spaces, and studios feel luxurious and functional.
            </p>
          </div>
        </div>
      </section>

      {/* ── Product grid ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="reveal mb-12 text-center" data-reveal="fade">
          <h2 className="text-3xl font-bold text-[#131042]">Our Signature Pieces</h2>
          <p className="mt-3 text-[#1e1873]">Handcrafted for modern living.</p>
        </div>
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3" data-reveal-stagger="70">
          {products.map(({ img, name, desc, category }) => (
            <article
              key={name}
              className="reveal overflow-hidden rounded-4xl bg-white shadow-xl shadow-slate-200/50 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="overflow-hidden">
                <img
                  src={img}
                  alt={name}
                  className="h-72 w-full object-cover transition duration-500 hover:scale-105"
                />
              </div>
              <div className="p-8">
                <h2 className="text-2xl font-semibold text-[#131042]">{name}</h2>
                <p className="mt-4 text-[#1e1873]">{desc}</p>
                <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-[#131042]">{category}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Custom CTA ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="reveal space-y-6" data-reveal="left">
            <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
              Custom Creations
            </span>
            <h2 className="text-4xl font-bold text-[#131042]">
              Custom furniture services for signature spaces.
            </h2>
            <p className="leading-8 text-[#1e1873]">
              Whether you're designing a boutique studio, a hospitality lounge, or a residential retreat, we can build tailored pieces that feel personal and purposeful.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full bg-[#131042] px-7 py-3 text-sm font-semibold text-white transition hover:scale-105"
              >
                Speak with our studio
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-7 py-3 text-sm font-semibold text-[#131042] transition hover:bg-slate-100 hover:scale-105"
              >
                Explore Services
              </Link>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2" data-reveal-stagger="100">
            <div className="reveal rounded-4xl bg-slate-900 p-8 text-slate-100 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
              <h3 className="text-2xl font-semibold">Room-ready sets</h3>
              <p className="mt-4 text-slate-300">Curated pieces that work beautifully together and enhance living spaces.</p>
            </div>
            <div className="reveal rounded-4xl bg-slate-900 p-8 text-slate-100 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
              <h3 className="text-2xl font-semibold">Textural finishes</h3>
              <p className="mt-4 text-slate-300">Leather, oak, walnut, and stone combine to create contrast and depth.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <Footer/>
  </>
  );
}
