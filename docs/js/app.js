/**
 * Git-Drive Documentation - Main Application
 * Single Page Application with navigation, theme toggle, and copy functionality
 */

(function() {
    'use strict';

    // ============================================
    // State & Config
    // ============================================
    
    const state = {
        currentPage: 'home',
        theme: 'dark',
        mobileMenuOpen: false
    };

    // ============================================
    // DOM Elements
    // ============================================
    
    const elements = {
        html: document.documentElement,
        pages: document.querySelectorAll('.page'),
        navLinks: document.querySelectorAll('.nav-link'),
        navToggle: document.querySelector('.nav-toggle'),
        navMenu: document.querySelector('.nav-menu'),
        themeToggle: document.querySelector('.theme-toggle'),
        copyButtons: document.querySelectorAll('.copy-btn'),
        tabs: document.querySelectorAll('.tab'),
        tabPanels: document.querySelectorAll('.tab-panel'),
        links: document.querySelectorAll('a[data-page]')
    };

    // ============================================
    // Navigation
    // ============================================
    
    function navigateTo(pageId) {
        // Update state
        state.currentPage = pageId;
        
        // Update URL hash
        window.location.hash = pageId;
        
        // Update pages
        elements.pages.forEach(page => {
            page.classList.toggle('active', page.id === pageId);
        });
        
        // Update nav links
        elements.navLinks.forEach(link => {
            const isActive = link.dataset.page === pageId;
            link.classList.toggle('active', isActive);
        });
        
        // Close mobile menu
        closeMobileMenu();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleNavigation(event) {
        const link = event.target.closest('[data-page]');
        if (!link) return;
        
        event.preventDefault();
        const pageId = link.dataset.page;
        navigateTo(pageId);
    }

    function handleHashChange() {
        const hash = window.location.hash.slice(1) || 'home';
        const validPage = document.getElementById(hash);
        if (validPage && validPage.classList.contains('page')) {
            navigateTo(hash);
        } else {
            navigateTo('home');
        }
    }

    // ============================================
    // Mobile Menu
    // ============================================
    
    function toggleMobileMenu() {
        state.mobileMenuOpen = !state.mobileMenuOpen;
        elements.navMenu.classList.toggle('open', state.mobileMenuOpen);
        elements.navToggle.setAttribute('aria-expanded', state.mobileMenuOpen);
    }

    function closeMobileMenu() {
        state.mobileMenuOpen = false;
        elements.navMenu.classList.remove('open');
        elements.navToggle.setAttribute('aria-expanded', 'false');
    }

    // ============================================
    // Theme Toggle
    // ============================================
    
    function initTheme() {
        // Check for saved theme preference or system preference
        const savedTheme = localStorage.getItem('git-drive-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        state.theme = savedTheme || (prefersDark ? 'dark' : 'light');
        applyTheme();
    }

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('git-drive-theme', state.theme);
        applyTheme();
    }

    function applyTheme() {
        elements.html.dataset.theme = state.theme;
    }

    // ============================================
    // Tabs
    // ============================================
    
    function initTabs() {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab));
        });
    }

    function switchTab(activeTab) {
        const tabId = activeTab.dataset.tab;
        const tabList = activeTab.closest('.tab-list');
        const tabPanels = activeTab.closest('.tabs').querySelectorAll('.tab-panel');
        
        // Update tab buttons
        tabList.querySelectorAll('.tab').forEach(tab => {
            const isActive = tab === activeTab;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });
        
        // Update tab panels
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === tabId);
        });
    }

    // ============================================
    // Copy to Clipboard
    // ============================================
    
    function initCopyButtons() {
        elements.copyButtons.forEach(btn => {
            btn.addEventListener('click', handleCopy);
        });
    }

    async function handleCopy(event) {
        const button = event.currentTarget;
        const codeBlock = button.closest('.code-block');
        
        // Get code text
        let code;
        if (codeBlock.querySelector('pre')) {
            code = codeBlock.querySelector('pre').textContent;
        } else if (codeBlock.querySelector('code')) {
            code = codeBlock.querySelector('code').textContent;
        } else {
            code = codeBlock.querySelector('code, pre')?.textContent || '';
        }
        
        try {
            await navigator.clipboard.writeText(code);
            
            // Visual feedback
            button.classList.add('copied');
            const originalTitle = button.getAttribute('aria-label');
            button.setAttribute('aria-label', 'Copied!');
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.setAttribute('aria-label', originalTitle);
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    // ============================================
    // Keyboard Navigation
    // ============================================
    
    function handleKeydown(event) {
        // Close mobile menu on Escape
        if (event.key === 'Escape' && state.mobileMenuOpen) {
            closeMobileMenu();
        }
    }

    // ============================================
    // Click Outside
    // ============================================
    
    function handleClickOutside(event) {
        // Close mobile menu when clicking outside
        if (state.mobileMenuOpen) {
            const isNavClick = event.target.closest('.nav-menu, .nav-toggle');
            if (!isNavClick) {
                closeMobileMenu();
            }
        }
    }

    // ============================================
    // Terminal Animation
    // ============================================
    
    function initTerminalAnimation() {
        const terminalOutputs = document.querySelectorAll('.terminal-output');
        
        // Stagger the terminal output animations
        terminalOutputs.forEach((output, index) => {
            output.style.animationDelay = `${(index + 1) * 0.5}s`;
        });
    }

    // ============================================
    // Scroll Reveal
    // ============================================
    
    function initScrollReveal() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe feature cards
        document.querySelectorAll('.feature-card, .command-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(el);
        });
    }

    // Add CSS for revealed state
    function addRevealStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .feature-card.revealed,
            .command-card.revealed {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // Initialize
    // ============================================
    
    function init() {
        // Initialize theme
        initTheme();
        
        // Initialize hash-based navigation
        handleHashChange();
        
        // Initialize tabs
        initTabs();
        
        // Initialize copy buttons
        initCopyButtons();
        
        // Initialize terminal animation
        initTerminalAnimation();
        
        // Add reveal styles and init scroll reveal
        addRevealStyles();
        initScrollReveal();
        
        // Event listeners
        document.addEventListener('click', handleNavigation);
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeydown);
        
        if (elements.navToggle) {
            elements.navToggle.addEventListener('click', toggleMobileMenu);
        }
        
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }
        
        window.addEventListener('hashchange', handleHashChange);
        
        // Handle navigation with data-page links
        elements.links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                navigateTo(pageId);
            });
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();