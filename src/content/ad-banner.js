(() => {
    const BANNER_ID = 'cspricebase-ad-banner';
    const AD_URL = 'https://cspricebase.com';
    const LOGO_PATH = chrome.runtime.getURL('assets/ico/csp.png');

    function injectStyles() {
        if (document.getElementById('cspricebase-ad-styles')) return;
        const style = document.createElement('style');
        style.id = 'cspricebase-ad-styles';
        style.textContent = `
            #${BANNER_ID} {
                align-self: center;
            }
            #${BANNER_ID} .csp-banner-link {
                text-decoration: none !important;
                position: relative;
            }
            #${BANNER_ID} .csp-banner-icon {
                display: block;
                height: 25px;
                width: 25px;
                object-fit: contain;
            }
            #${BANNER_ID} .csp-banner-link {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            #${BANNER_ID} .cw-icon.nav-item-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            #${BANNER_ID} .nav-item-label {
                background: linear-gradient(90deg, #02bb4a, #0084ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-weight: 700;
            }
            #${BANNER_ID} .csp-banner-link:hover .nav-item-label {
                filter: brightness(1.3);
            }
        `;
        document.head.appendChild(style);
    }

    function createBanner() {
        const li = document.createElement('li');
        li.className = 'nav-item hide-text-lt-lg';
        li.id = BANNER_ID;

        const link = document.createElement('a');
        link.href = AD_URL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'nav-link csp-banner-link';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'w-100 text-center';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'cw-icon nav-item-icon';

        const logo = document.createElement('img');
        logo.src = LOGO_PATH;
        logo.alt = 'CSPricebase';
        logo.className = 'csp-banner-icon';

        iconSpan.appendChild(logo);
        iconWrap.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = 'nav-item-label';
        label.textContent = 'CS:PRICEBASE';

        link.appendChild(iconWrap);
        link.appendChild(label);
        li.appendChild(link);
        return li;
    }

    function injectBanner() {
        if (document.getElementById(BANNER_ID)) return true;

        const navItems = document.querySelectorAll('cw-header nav.main-nav .left.left-nav > li.nav-item');
        if (!navItems.length) return false;

        injectStyles();
        const banner = createBanner();
        const lastItem = navItems[navItems.length - 1];
        lastItem.parentNode.insertBefore(banner, lastItem.nextSibling);
        return true;
    }

    if (!injectBanner()) {
        const observer = new MutationObserver(() => {
            if (injectBanner()) observer.disconnect();
        });
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
        });
        setTimeout(() => observer.disconnect(), 30_000);
    }
})();