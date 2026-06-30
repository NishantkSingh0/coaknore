import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useReveal } from '../HomeHooks/useReveal';
import Navbar from '../HomeComponents/Navbar';
import Footer from '../HomeComponents/Footer';

const galleryCategories = [
  { name: 'Attelier Shorts',        path: 'Attelier',      count: 3  },
  { name: 'The Design Studio',      path: 'Design',        count: 8  },
  { name: 'Metal Finishing Studio', path: 'MetalFinishing', count: 6 },
  { name: 'Metalsmith Studio',      path: 'Metalsmith',    count: 10 },
  { name: 'Packing Studio',         path: 'Packing',       count: 3  },
  { name: 'Painting Studio',        path: 'painting',      count: 9  },
  { name: 'Stone Works Studio',     path: 'StoneWorks',    count: 9  },
  { name: 'The Upholstery Studio',  path: 'upholster',     count: 11 },
  { name: 'Fine Wood Studio',       path: 'wood',          count: 26 },
];

function GalleryCategory({ category }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
            observer.unobserve(section);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const images = Array.from({ length: category.count }, (_, i) => i + 1);

  return (
    <div
      ref={sectionRef}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Category header */}
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-[#131042]">{category.name}</h2>
        <div className="h-1 w-16 rounded-full bg-linear-to-r from-blue-400 to-ore" />
      </div>

      {/* Masonry grid */}
      <div className="gallery-grid">
        {images.map((index, idx) => (
          <GalleryItem
            key={index}
            src={`/${category.path}/${index}.png`}
            alt={`${category.name} ${index}`}
            delay={idx * 40}
          />
        ))}
      </div>
    </div>
  );
}

function GalleryItem({ src, alt, delay }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="gallery-item"
      style={{
        opacity: 0,
        transform: 'translateY(30px)',
        transition: `all 1s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
      }}
    >
      <img src={src} alt={alt} />
      <div className="overlay" />
    </div>
  );
}

export default function Departments() {
  const { pathname } = useLocation();
  useReveal(pathname);

  return (
        <> <Navbar/>
    <main className="pt-20">
      {/* Hero */}
      <section
        id="hero"
        className="bg-cover bg-center text-white"
        style={{ backgroundImage: "url('/images/1.png')" }}
      >
        <div className="bg-slate-200/30">
          <div className="mx-auto max-w-6xl px-6 py-28 sm:px-10 lg:px-16">
            <span className="hero-enter badge-pulse inline-flex rounded-full bg-[#131042] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">
              Work Culture
            </span>
            <h1 className="hero-enter hero-enter-delay-1 mt-6 text-5xl font-black tracking-tight text-[#131042] sm:text-6xl">
              See Oak&amp;Ore furniture in crafted environments.
            </h1>
            <p className="hero-enter hero-enter-delay-2 mt-6 max-w-2xl text-lg leading-8 text-[#131042]">
              A curated selection of furniture, interiors, and artistic compositions.
            </p>
          </div>
        </div>
      </section>

      {/* Gallery categories */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="space-y-24">
          {galleryCategories.map((cat) => (
            <GalleryCategory key={cat.path} category={cat} />
          ))}
        </div>
      </section>
    </main>
    <Footer/>
  </>
  );
}