import { Link, useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

const techniques = [
  {
    id: '01',
    title: 'Fine Wood Joinery',
    subtitle: 'Where timber becomes art',
    desc: 'Our master woodworkers use centuries-old joinery techniques — mortise and tenon, dovetail, and finger joints — combined with modern CNC precision. Every joint is hand-fitted and tested for strength before assembly. We work with sustainably sourced teak, walnut, oak, and sheesham, each selected for grain character and structural integrity.',
    detail: 'The wood is kiln-dried to 8–10% moisture content, ensuring dimensional stability across seasons. Surfaces are hand-planed, sanded through 80–400 grit, and finished with natural oils or lacquers that enhance the grain without masking it.',
    img: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
    tag: 'Wood Studio',
    accent: 'bg-amber-100 text-amber-800',
  },
  {
    id: '02',
    title: 'Metal Fabrication & Finishing',
    subtitle: 'Strength shaped with precision',
    desc: 'Our metalsmith studio handles everything from raw steel cutting and MIG welding to intricate brass inlay work. Structural frames are fabricated from mild steel or stainless steel, then powder-coated, brushed, or hand-patinated to achieve the exact finish specified in the design brief.',
    detail: 'We use plasma cutting and TIG welding for precision joints on visible metalwork. Decorative elements — hairpin legs, geometric frames, and custom hardware — are hand-ground and polished to mirror or satin finishes. Every weld is inspected and ground flush before finishing.',
    img: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80',
    tag: 'Metal Studio',
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    id: '03',
    title: 'Stone & Mineral Inlay',
    subtitle: 'Natural beauty, precisely placed',
    desc: 'From marble tabletops to pietra dura inlay panels, our stone works studio transforms raw mineral slabs into refined surfaces. We source Italian Carrara marble, Indian Makrana white, black granite, and semi-precious stones like malachite and lapis lazuli for bespoke commissions.',
    detail: 'Stone is cut with water-jet and diamond-blade saws to tolerances of ±0.5mm. Inlay work is hand-set using traditional lime-based adhesives for reversibility. Surfaces are honed, polished, or leathered depending on the desired tactile quality and light reflectance.',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
    tag: 'Stone Works',
    accent: 'bg-stone-100 text-stone-700',
  },
  {
    id: '04',
    title: 'Upholstery & Textile',
    subtitle: 'Comfort engineered to last',
    desc: 'Our upholstery studio combines traditional hand-tufting with modern foam engineering. We use 8-way hand-tied spring systems for seating that holds its shape for decades. Fabrics range from performance velvets and bouclé to full-grain leather and hand-woven textiles sourced from artisan mills.',
    detail: 'Foam densities are specified per application — 40D for seat cushions, 28D for back cushions — and wrapped in Dacron for a softer profile. Piping, button tufting, and channel quilting are all executed by hand. Every upholstered piece is inspected for symmetry, tension, and finish before leaving the studio.',
    img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
    tag: 'Upholstery Studio',
    accent: 'bg-rose-100 text-rose-800',
  },
  {
    id: '05',
    title: 'Surface Painting & Lacquering',
    subtitle: 'Colour with depth and durability',
    desc: 'Our painting studio applies everything from raw linseed oil and beeswax finishes to high-gloss automotive lacquers. We use HVLP spray systems for even, drip-free coats and hand-apply specialty finishes like limewash, ceruse, and ebonising for textural depth.',
    detail: 'Multi-coat lacquer systems involve 3–5 layers with inter-coat sanding at 320 grit. Colour matching is done using spectrophotometry to achieve exact RAL or Pantone references. All finishes are low-VOC and tested for scratch, chemical, and UV resistance before sign-off.',
    img: './images/46.png',
    tag: 'Painting Studio',
    accent: 'bg-blue-100 text-blue-800',
  },
  {
    id: '06',
    title: 'Design & Prototyping',
    subtitle: 'From sketch to signed-off sample',
    desc: 'Every Oak&Ore piece begins in our design studio, where architects and furniture designers collaborate on concept drawings, 3D models, and material boards. We build full-scale prototypes before production begins, allowing clients to approve proportions, finishes, and ergonomics in person.',
    detail: 'Our design process uses Rhino 3D and AutoCAD for technical drawings, with physical mock-ups built in MDF or foam for spatial review. Client approval is required at three stages — concept, prototype, and pre-production sample — ensuring zero surprises at delivery.',
    img: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
    tag: 'Design Studio',
    accent: 'bg-indigo-100 text-indigo-800',
  },
];

const stats = [
  { value: '2+',   label: 'Years of manufacturing excellence' },
  { value: '50+', label: 'Bespoke projects delivered' },
  { value: '8',   label: 'Specialist studios under one roof' },
  { value: '100+', label: 'Artisans and craftspeople' },
];

const process = [
  { step: '01', title: 'Brief & Consultation',  desc: 'We begin with a detailed brief — understanding your space, lifestyle, material preferences, and budget. Our designers ask the right questions so nothing is left to assumption.' },
  { step: '02', title: 'Design & Sampling',     desc: 'Concept drawings, 3D renders, and material samples are presented for your review. We iterate until every detail is exactly right before a single piece of timber is cut.' },
  { step: '03', title: 'Crafting in Studio',    desc: 'Your piece moves through our specialist studios — wood, metal, stone, upholstery, and paint — each department adding its layer of expertise under one roof.' },
  { step: '04', title: 'Quality Inspection',    desc: 'Every finished piece is inspected against the original brief. Dimensions, finish quality, structural integrity, and aesthetic details are all signed off before packing.' },
  { step: '05', title: 'White-Glove Delivery',  desc: 'We handle packing, logistics, and installation. Our team places and levels every piece in your space, removing all packaging and leaving nothing but the furniture.' },
];

export default function About() {
  const { pathname } = useLocation();
  useReveal(pathname);

  return (
    <> 
    <Navbar/>
    <main className="pt-16 overflow-x-hidden">

      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden text-white">
        <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
          <source src="/images/about.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-slate-50 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 py-56 sm:px-10 lg:px-16">
          <div className="max-w-3xl space-y-8">
            <span className="hero-enter badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
              Our story
            </span>
            <h1 className="hero-enter hero-enter-delay-1 text-5xl font-black tracking-tight sm:text-7xl leading-[1.05]">
              Where design-led furniture and master craftsmanship meet.
            </h1>
            <p className="hero-enter hero-enter-delay-2 text-xl leading-9 text-slate-100/90 max-w-2xl">
              Oak&amp;Ore is a full-spectrum furniture atelier. From raw material to finished installation, every step happens under our roof, by our hands.
            </p>
            <div className="hero-enter hero-enter-delay-3 flex flex-wrap gap-4 pt-2">
              <Link to="/products" className="rounded-full bg-white text-[#131042] px-8 py-3 text-sm font-semibold tracking-wide transition hover:bg-slate-100 hover:scale-105">
                Explore Collection
              </Link>
              <Link to="/contact" className="rounded-full border border-white/40 bg-white/10 backdrop-blur px-8 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-white/20 hover:scale-105">
                Start a Project
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-[#090725] text-white">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4" data-reveal-stagger="80">
            {stats.map(({ value, label }) => (
              <div key={value} className="reveal text-center" data-reveal="up">
                <p className="text-4xl font-black text-ore sm:text-5xl">{value}</p>
                <p className="mt-2 text-sm text-slate-300 leading-6">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STORY */}
      <section className="mx-auto px-6 py-24 sm:px-10 lg:px-16 bg-[#e4e4e4]">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div className="reveal space-y-7" data-reveal="left">
            <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-800">
              Who we are
            </span>
            <h2 className="text-5xl font-black text-[#131042] leading-tight">
              A manufacturing atelier built for the modern age.
            </h2>
            <p className="text-lg leading-9 text-slate-600">
              Founded with a singular obsession — to make furniture that outlasts trends and outlives generations — Oak&amp;Ore operates ten specialist studios under one roof in Greater Noida. We do not outsource. We do not compromise. Every piece that leaves our facility has been touched by dozens of skilled hands, each contributing a layer of expertise that mass production simply cannot replicate.
            </p>
            <p className="text-lg leading-9 text-slate-600">
              Our clients include interior architects, hospitality brands, and discerning homeowners who understand that the difference between good furniture and great furniture is the process behind it. We invite you to understand ours.
            </p>
          </div>
          <div className="reveal grid grid-cols-2 gap-4" data-reveal="right">
            <img src="https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80" alt="Woodworking" className="rounded-3xl object-cover h-64 w-full transition duration-500 hover:scale-105 shadow-xl" />
            <img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80" alt="Metal fabrication" className="rounded-3xl object-cover h-64 w-full mt-8 transition duration-500 hover:scale-105 shadow-xl" />
            <img src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80" alt="Upholstery" className="rounded-3xl object-cover h-64 w-full transition duration-500 hover:scale-105 shadow-xl" />
            <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80" alt="Stone work" className="rounded-3xl object-cover h-64 w-full mt-8 transition duration-500 hover:scale-105 shadow-xl" />
          </div>
        </div>
      </section>

      {/* MANUFACTURING TECHNIQUES HEADER */}
      <section className="bg-slate-950 py-8">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-8 sm:px-10 lg:px-16">
          <div className="reveal text-center space-y-4 mb-4" data-reveal="fade">
            <span className="badge-pulse inline-flex rounded-full bg-blue-500/20 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-300">
              Manufacturing Excellence
            </span>
            <h2 className="text-5xl font-black text-white leading-tight">
              Six studios. One standard of excellence.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400 leading-8">
              Every technique we employ has been refined over years of practice. Here is a look inside the processes that make Oak&amp;Ore furniture unlike anything else on the market.
            </p>
          </div>
        </div>
      </section>

      {/* TECHNIQUE SECTIONS */}
      {techniques.map(({ id, title, subtitle, desc, detail, img, tag, accent }, i) => (
        <section key={id} className={i % 2 === 0 ? 'bg-slate-950 text-white' : 'bg-slate-900 text-white'}>
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
            <div className={`grid gap-14 lg:grid-cols-2 lg:items-center ${i % 2 !== 0 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div className="reveal space-y-6" data-reveal={i % 2 === 0 ? 'left' : 'right'}>
                <div className="flex items-center gap-4">
                  <span className="text-6xl font-black text-white/70 leading-none">{id}</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${accent}`}>{tag}</span>
                </div>
                <h3 className="text-4xl font-black leading-tight">{title}</h3>
                <p className="text-ore font-semibold tracking-wide text-sm uppercase">{subtitle}</p>
                <p className="text-lg leading-9 text-slate-300">{desc}</p>
                <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-6">
                  <p className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-3">Technical detail</p>
                  <p className="text-slate-300 leading-7 text-sm">{detail}</p>
                </div>
              </div>
              <div className="reveal overflow-hidden rounded-3xl shadow-2xl shadow-slate-950/60" data-reveal={i % 2 === 0 ? 'right' : 'left'}>
                <img src={img} alt={title} className="h-120 w-full object-cover transition duration-700 hover:scale-105" />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* PROCESS TIMELINE */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
          <div className="reveal text-center space-y-4 mb-20" data-reveal="fade">
            <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-800">
              Our Process
            </span>
            <h2 className="text-5xl font-black text-[#131042] leading-tight">
              From brief to beautiful.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-500 leading-8">
              A transparent, collaborative process that keeps you informed and in control at every stage.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 hidden lg:block" />
            <div className="space-y-12" data-reveal-stagger="100">
              {process.map(({ step, title, desc }) => (
                <div key={step} className="reveal grid gap-6 lg:grid-cols-[80px_1fr] lg:items-start" data-reveal="left">
                  <div className="hidden lg:flex h-16 w-16 items-center justify-center rounded-full bg-[#131042] text-white font-black text-lg shadow-xl shadow-[#131042]/30 relative z-10">
                    {step}
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:bg-white">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#131042] text-white font-black text-sm">{step}</span>
                      <h3 className="text-2xl font-bold text-[#131042]">{title}</h3>
                    </div>
                    <p className="text-slate-600 leading-8">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FULL-WIDTH WORKSHOP IMAGE */}
      <section className="reveal overflow-hidden" data-reveal="fade">
        <div className="relative h-[60vh] min-h-100">
          <img src="https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=2000&q=80" alt="Oak and Ore workshop" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
            <div className="text-center text-white space-y-4 px-6">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-ore">Greater Noida, India</p>
              <h2 className="text-4xl sm:text-6xl font-black leading-tight">10 studios.<br />One obsession.</h2>
              <p className="text-xl text-slate-300 max-w-xl mx-auto leading-8">
                Every square foot of our facility is dedicated to making furniture that earns its place in your home.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10 lg:px-16">
          <div className="reveal text-center mb-16" data-reveal="fade">
            <h2 className="text-4xl font-black">What we stand for</h2>
            <p className="mt-4 text-slate-400 text-lg">The principles that guide every decision we make.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger="90">
            {[
              {title: 'Sustainability',      body: 'Responsibly sourced timber, low-VOC finishes, and zero-waste manufacturing practices. We believe beautiful furniture should not cost the earth.' },
              {title: 'Craftsmanship',       body: 'Every joint, every weld, every stitch is executed by a specialist. We do not cut corners — we cut timber, metal, and stone with precision.' },
              {title: 'Design Integrity',    body: 'We never compromise the design to reduce cost. If a detail matters to the piece, it stays — regardless of the complexity it adds to production.' },
              {title: 'Collaboration',       body: 'We work with you, not for you. Your input shapes the outcome at every stage, from the first sketch to the final installation.' },
              {title: 'Longevity',           body: 'We build furniture to last 50 years, not 5. The materials we choose, the joinery we use, and the finishes we apply are all selected for durability.' },
              {title: 'Attention to Detail', body: 'The details that most people never notice are the ones we obsess over. Because the people who live with our furniture will notice them every day.' },
            ].map(({ icon, title, body }) => (
              <div key={title} className="reveal rounded-3xl bg-slate-900 p-8 transition duration-300 hover:-translate-y-2 hover:bg-slate-800" data-reveal="up">
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-4 text-slate-400 leading-7">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESIGN PHILOSOPHY */}
      <section className="mx-auto max-w-7xl px-6 py-24 sm:px-10 lg:px-16">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="reveal space-y-8" data-reveal="left">
            <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-800">
              Design Philosophy
            </span>
            <h2 className="text-5xl font-black text-[#131042] leading-tight">
              Design that feels curated and intentional.
            </h2>
            <p className="text-lg leading-9 text-slate-600">
              Since 2024, Oak&amp;Ore has been designing striking furniture for premium interiors and hospitality spaces. Our products blend minimalism, natural timber, and a rich sense of tactility. We believe that the best furniture disappears into a room — it does not demand attention, it rewards it.
            </p>
            <div className="grid gap-6 sm:grid-cols-2" data-reveal-stagger="80">
              <div className="reveal rounded-3xl border border-slate-200 bg-white p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl" data-reveal="up">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-900">Artisan craft</p>
                <p className="mt-4 text-slate-600 leading-7">Every piece is finished by hand and inspected for exceptional quality before it leaves our studio.</p>
              </div>
              <div className="reveal rounded-3xl border border-slate-200 bg-white p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl" data-reveal="up">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-900">Material intelligence</p>
                <p className="mt-4 text-slate-600 leading-7">We combine robust hardwoods, leather, and natural stone to create furniture built for everyday life.</p>
              </div>
            </div>
          </div>
          <div className="reveal space-y-4" data-reveal="right">
            <img src="https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80" alt="Design studio" className="rounded-3xl object-cover h-72 w-full shadow-xl transition duration-500 hover:scale-[1.02]" />
            <div className="grid grid-cols-2 gap-4">
              <img src="https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80" alt="Interior design" className="rounded-3xl object-cover h-48 w-full shadow-lg transition duration-500 hover:scale-[1.02]" />
              <img src="https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80" alt="Furniture detail" className="rounded-3xl object-cover h-48 w-full shadow-lg transition duration-500 hover:scale-[1.02]" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="reveal rounded-4xl overflow-hidden" data-reveal="scale">
          <div className="relative">
            <img src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=2000&q=80" alt="Luxury interior" className="h-125 w-full object-cover" />
            <div className="absolute inset-0 bg-[#131042]/85 flex items-center">
              <div className="mx-auto max-w-4xl px-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center w-full">
                <div className="text-white space-y-5">
                  <span className="badge-pulse inline-flex rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
                    Get started
                  </span>
                  <h2 className="text-4xl font-black leading-tight">
                    Let us design your next signature space.
                  </h2>
                  <p className="text-lg leading-8 text-slate-300">
                    From furniture collections to full interior consultation, our team will help bring your vision to life with stunning materials and craftsmanship.
                  </p>
                </div>
                <div className="flex flex-col gap-4 shrink-0">
                  <Link to="/services" className="inline-flex items-center justify-center rounded-full bg-white text-[#131042] px-8 py-4 text-sm font-bold transition hover:bg-slate-100 hover:scale-105 whitespace-nowrap">
                    View Services
                  </Link>
                  <Link to="/contact" className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 py-4 text-sm font-bold text-white transition hover:bg-white/20 hover:scale-105 whitespace-nowrap">
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
    <Footer/>
  </>
  );
}
