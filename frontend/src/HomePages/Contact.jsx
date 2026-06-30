import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

export default function Contact() {
  const { pathname } = useLocation();
  useReveal(pathname);

  const [form, setForm] = useState({
    name: '',
    email: '',
    project: 'Custom furniture',
    message: '',
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, email, project, message } = form;
    if (!name || !email || !message) return;

    const recipients = 'design@oaknore.in,purchase@oaknore.in,info@oaknore.in';
    const subject = encodeURIComponent(`New Oak&Ore contact message from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nProject type: ${project}\n\nMessage:\n${message}`
    );
    window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
  };

  const inputClass =
    'mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  return (
        <> <Navbar/>
    <main className="pt-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="bg-cover bg-center text-white"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1700&q=80')" }}
      >
        <div className="bg-slate-950/85">
          <div className="mx-auto max-w-6xl px-6 py-28 sm:px-10 lg:px-16">
            <span className="hero-enter badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
              Contact
            </span>
            <h1 className="hero-enter hero-enter-delay-1 mt-6 text-5xl font-black tracking-tight sm:text-6xl">
              Start a furniture project with Oak&amp;Ore.
            </h1>
            <p className="hero-enter hero-enter-delay-2 mt-6 max-w-2xl text-lg leading-8 text-slate-100/90">
              Whether you need custom pieces, interior collaboration, or a full build, we're ready to create something exceptional.
            </p>
          </div>
        </div>
      </section>

      {/* ── Contact grid ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          {/* Left — info */}
          <div className="reveal space-y-8" data-reveal="left">
            <div className="rounded-4xl bg-white p-10 shadow-xl shadow-slate-200/50">
              <h2 className="text-4xl font-bold text-[#131042]">
                Let's design your next statement piece.
              </h2>
              <p className="mt-5 leading-8 text-[#1e1873]">
                Our studio is based in the heart of the design district. We collaborate with individuals, architects, and brands to create bespoke furniture and finished interiors.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2" data-reveal-stagger="100">
              <div className="reveal rounded-4xl bg-slate-900 p-8 text-slate-100 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
                <h3 className="text-2xl font-semibold">Visit our studio</h3>
                <p className="mt-4 text-slate-300">
                  B5, Sector Ecotech-VI, Greater Noida, Gautam Buddha Nagar, UTTARPRADESH (201310)
                </p>
              </div>
              <div className="reveal rounded-4xl bg-slate-900 p-8 text-slate-100 shadow-2xl shadow-slate-950/40 transition duration-300 hover:-translate-y-1" data-reveal="up">
                <h3 className="text-2xl font-semibold">Email us</h3>
                <p className="mt-4 text-slate-300">
                  <a href="mailto:design@oaknore.in" className="text-blue-400 hover:underline">design@oaknore.in</a>
                </p>
                <p className="mt-2 text-slate-300">
                  <a href="mailto:purchase@oaknore.in" className="text-blue-400 hover:underline">purchase@oaknore.in</a>
                </p>
                <p className="mt-2 text-slate-300">
                  <a href="mailto:info@oaknore.in" className="text-blue-400 hover:underline">info@oaknore.in</a>
                </p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="reveal rounded-4xl bg-white p-10 shadow-xl shadow-slate-200/50" data-reveal="right">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#131042]">Name</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Your name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#131042]">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="hello@example.com"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#131042]">Project type</label>
                <select
                  name="project"
                  value={form.project}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option>Custom furniture</option>
                  <option>Interior design</option>
                  <option>Commercial build</option>
                  <option>Collaborative project</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#131042]">Message</label>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="Tell us about your project"
                  required
                  value={form.message}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#131042] px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-blue-400/20 transition hover:bg-slate-800 hover:scale-[1.02]"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Find us — Map section ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-20 sm:px-10 lg:px-16">
        <div className="reveal" data-reveal="up">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="badge-pulse inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-800">
                Find us
              </span>
              <h2 className="mt-4 text-3xl font-bold text-[#131042]">Visit our studio</h2>
              <p className="mt-2 text-slate-500 leading-7">
                B5, Sector Ecotech-VI, Greater Noida,<br />
                Gautam Buddha Nagar, UP — 201310
              </p>
            </div>
            <a
              href="https://maps.google.com/?q=Crafted+Oak+%26+Ore+pvt+ltd"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#131042] px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Get Directions
            </a>
          </div>

          {/* Map card */}
          <div className="overflow-hidden rounded-4xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14033.711018513504!2d77.55047730000001!3d28.436519099999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390cc1001c977fe3%3A0x4a6faddfbd8df50f!2sCrafted%20Oak%20%26%20Ore%20pvt%20ltd!5e0!3m2!1sen!2sin!4v1780402080535!5m2!1sen!2sin"
              width="100%"
              height="480"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Crafted Oak & Ore — Studio Location"
            />
          </div>
        </div>
      </section>

      {/* ── Collaborate dark section ─────────────────────────────────────── */}
      <section className="text-[#131042]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="reveal space-y-6" data-reveal="left">
              <span className="badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
                collaborate
              </span>
              <h2 className="text-4xl font-bold">Create furniture that feels personal.</h2>
              <p className="leading-8 text-[#1e1873]">
                Get in touch for custom builds, consultation, and refined furniture design that reflects your home or brand.
              </p>
            </div>
            <div className="reveal rounded-4xl bg-[#131042] p-10 shadow-2xl shadow-slate-950/40" data-reveal="right">
              <p className="text-slate-300">
                Prefer a call? We'll respond within one business day and schedule a studio visit or virtual consultation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
        <Footer/>
  </>
  );
}
