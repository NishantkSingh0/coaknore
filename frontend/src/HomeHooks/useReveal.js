import { useEffect } from 'react';

/**
 * Attaches an IntersectionObserver to all `.reveal` elements and adds
 * `.reveal-visible` when they scroll into view.
 *
 * Elements with `data-reveal-stagger` on a parent will have their
 * `.reveal` children automatically staggered by `data-reveal-stagger` ms.
 *
 * Re-runs whenever the pathname changes (page navigation).
 */
export function useReveal(pathname) {
  useEffect(() => {
    // Auto-assign stagger delays to children of [data-reveal-stagger]
    document.querySelectorAll('[data-reveal-stagger]').forEach((parent) => {
      const step = Number(parent.dataset.revealStagger) || 80;
      parent.querySelectorAll(':scope > .reveal').forEach((child, i) => {
        if (!child.dataset.revealDelay) {
          child.dataset.revealDelay = i * step;
        }
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target;
            const delay = Number(target.dataset.revealDelay) || 0;
            target.style.transitionDelay = `${delay}ms`;
            target.classList.add('reveal-visible');
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const timer = setTimeout(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        observer.observe(el);
      });
    }, 60);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);
}
