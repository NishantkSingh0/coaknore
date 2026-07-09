export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-slate-800 bg-[#06051d]">
      
      {/* Background Glow */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-orange-500 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-amber-400 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-16">

        {/* Top Section */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">

          {/* Brand */}
          <div className="max-w-md">
            <h2 className="text-3xl font-bold tracking-wide text-white">
              Crafted Oak & Ore
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Premium handcrafted furniture and interior pieces designed
              with timeless elegance, modern craftsmanship, and natural
              materials that elevate every living space.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-slate-400">
                Crafted Oak & Ore Private Limited
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white">
                Company
              </h3>

              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  <a href="/" className="transition hover:text-white">
                    Home
                  </a>
                </li>

                <li>
                  <a href="/about" className="transition hover:text-white">
                    About
                  </a>
                </li>

                <li>
                  <a href="/products" className="transition hover:text-white">
                    Collections
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white">
                Support
              </h3>

              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  <a href="/contact" className="transition hover:text-white">
                    Contact
                  </a>
                </li>

                <li>
                  <a href="/services" className="transition hover:text-white">
                    Services
                  </a>
                </li>

                <li>
                  <a href="/departments" className="transition hover:text-white">
                    Departments
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white">
                Connect
              </h3>

              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  <a href="#" className="transition hover:text-white">
                    Instagram
                  </a>
                </li>

                <li>
                  <a href="#" className="transition hover:text-white">
                    LinkedIn
                  </a>
                </li>

                <li>
                  <a href="#" className="transition hover:text-white">
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-slate-800 pt-6">
          <div className="flex flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">

            <p>
              © {new Date().getFullYear()} Crafted Oak & Ore Private Limited.
              All rights reserved.
            </p>

            <p className="text-slate-500">
              Designed with precision & modern craftsmanship.
            </p>

          </div>
        </div>
      </div>
    </footer>
  );
}