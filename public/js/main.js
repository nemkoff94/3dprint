document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.querySelectorAll('.header-nav a, .header-right .button');
  const worksTrack = document.querySelector('[data-works-slider-track]');
  const worksPrevButton = document.querySelector('[data-works-slider-prev]');
  const worksNextButton = document.querySelector('[data-works-slider-next]');

  if (header && menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isOpen = header.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        header.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (worksTrack && worksPrevButton && worksNextButton) {
    const getSlideStep = () => {
      const firstCard = worksTrack.querySelector('.work-item');

      if (!firstCard) {
        return worksTrack.clientWidth;
      }

      const cardWidth = firstCard.getBoundingClientRect().width;
      const trackStyles = window.getComputedStyle(worksTrack);
      const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0') || 0;

      return cardWidth + gap;
    };

    const syncArrowState = () => {
      const maxScrollLeft = worksTrack.scrollWidth - worksTrack.clientWidth - 1;
      worksPrevButton.disabled = worksTrack.scrollLeft <= 1;
      worksNextButton.disabled = worksTrack.scrollLeft >= maxScrollLeft;
    };

    const slideBy = (direction) => {
      worksTrack.scrollBy({
        left: getSlideStep() * direction,
        behavior: 'smooth'
      });
    };

    worksPrevButton.addEventListener('click', () => slideBy(-1));
    worksNextButton.addEventListener('click', () => slideBy(1));

    worksTrack.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        slideBy(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        slideBy(1);
      }
    });

    worksTrack.addEventListener('scroll', syncArrowState, { passive: true });
    window.addEventListener('resize', syncArrowState);
    syncArrowState();
  }
});
