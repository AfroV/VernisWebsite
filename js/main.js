/**
 * VERNIS - Premium NFT Preservation
 * Main JavaScript
 */

(function() {
    'use strict';

    // ---------------------------------------------
    // DOM Elements
    // ---------------------------------------------
    const nav = document.querySelector('.nav');
    const mobileMenuBtn = document.querySelector('.nav__mobile-btn');
    const mobileMenu = document.querySelector('.nav__mobile-menu');
    const faqItems = document.querySelectorAll('.faq__item');
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');

    // ---------------------------------------------
    // Navigation - Scroll Effect
    // ---------------------------------------------
    function handleNavScroll() {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll);

    // ---------------------------------------------
    // Mobile Menu Toggle
    // ---------------------------------------------
    function toggleMobileMenu() {
        mobileMenuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu when clicking a link
    if (mobileMenu) {
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                toggleMobileMenu();
            });
        });
    }

    // ---------------------------------------------
    // Smooth Scrolling
    // ---------------------------------------------
    smoothScrollLinks.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Only handle internal anchor links
            if (href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);

                if (target) {
                    const navHeight = nav.offsetHeight;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ---------------------------------------------
    // FAQ Accordion
    // ---------------------------------------------
    faqItems.forEach(item => {
        const question = item.querySelector('.faq__question');

        question.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });

    // ---------------------------------------------
    // Intersection Observer for Animations
    // ---------------------------------------------
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const fadeInElements = document.querySelectorAll('.product-card, .problem__card, .step');

    const fadeInObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                fadeInObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeInElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        fadeInObserver.observe(el);
    });

    // ---------------------------------------------
    // Terms Checkbox & Mint Button
    // ---------------------------------------------
    const termsCheckbox = document.getElementById('terms-accept');
    const mintBtn = document.getElementById('mint-btn');

    if (termsCheckbox && mintBtn) {
        // Disable mint button initially
        mintBtn.setAttribute('disabled', 'true');

        termsCheckbox.addEventListener('change', () => {
            const termsLabel = termsCheckbox.closest('.terms-checkbox');
            if (termsCheckbox.checked) {
                mintBtn.removeAttribute('disabled');
                termsLabel.classList.remove('error');
            } else {
                mintBtn.setAttribute('disabled', 'true');
            }
        });

        mintBtn.addEventListener('click', (e) => {
            e.preventDefault();

            if (!termsCheckbox.checked) {
                const termsLabel = termsCheckbox.closest('.terms-checkbox');
                termsLabel.classList.add('error');
                return;
            }

            // Open Transient Labs mint page
            window.open('https://www.transient.xyz/mint/vernis2', '_blank', 'noopener');
        });
    }

    // ---------------------------------------------
    // Waitlist Form Handler (if exists)
    // ---------------------------------------------
    const waitlistForm = document.querySelector('.waitlist-form');

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = waitlistForm.querySelector('input[type="email"]').value;

            // Placeholder - Replace with actual form submission
            console.log(`Waitlist signup: ${email}`);
            alert('Thanks for joining the waitlist! We\'ll notify you when minting goes live.');
            waitlistForm.reset();
        });
    }

    // ---------------------------------------------
    // Console Easter Egg
    // ---------------------------------------------
    console.log('%c VERNIS ', 'background: #c9a54e; color: #0a0a0a; font-size: 24px; font-weight: bold; padding: 10px 20px;');
    console.log('%c Preserving Digital Art History ', 'color: #999; font-size: 12px;');
    console.log('%c Interested in how we built this? We\'re hiring! hello@vernis.art ', 'color: #c9a54e; font-size: 11px;');

})();
