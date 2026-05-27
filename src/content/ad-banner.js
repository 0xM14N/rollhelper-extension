(() => {
    const BANNER_ID = 'cspricebase-sell-banner';
    const SELL_URL = 'https://cspricebase.com/sell-cs2-skins';
    const LOGO_PATH = chrome.runtime.getURL('assets/ico/csp.png');

    const ROW_SELECTORS = [
        'header [class~="@4xl:gap-10"]',
        '[class~="@4xl:gap-10"]',
        '[data-ag-uid="a138c761-d550-4ef2-928d-2b7eed87cc1f"]',
    ];

    function findNavRow() {
        for (const sel of ROW_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function injectStyles() {
        if (document.getElementById('cspricebase-sell-styles')) return;
        const style = document.createElement('style');
        style.id = 'cspricebase-sell-styles';
        style.textContent = `
            #${BANNER_ID} {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                align-self: center;
                flex: 0 0 auto;
                padding: 5px 11px;
                border-radius: 9px;
                text-decoration: none !important;
                white-space: nowrap;
                cursor: pointer;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: linear-gradient(135deg, rgba(20,40,25,0.85), rgba(8,18,12,0.9));
                border: 1px solid #2bff88;
                box-shadow: 0 0 8px rgba(43,255,136,0.45), inset 0 0 7px rgba(43,255,136,0.12);
                animation: csp-sell-glow 2.2s ease-in-out infinite;
                transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
            }
            #${BANNER_ID}:hover {
                transform: translateY(-1px);
                background: linear-gradient(135deg, rgba(28,55,35,0.95), rgba(12,26,17,0.95));
                box-shadow: 0 0 14px rgba(43,255,136,0.7), inset 0 0 9px rgba(43,255,136,0.2);
            }
            #${BANNER_ID} .csp-sell-logo {
                width: 22px;
                height: 22px;
                border-radius: 5px;
                display: block;
                flex-shrink: 0;
            }
            #${BANNER_ID} .csp-sell-text {
                display: flex;
                flex-direction: column;
                line-height: 1.05;
            }
            #${BANNER_ID} .csp-sell-title {
                font-weight: 800;
                font-size: 12.5px;
                letter-spacing: .6px;
                color: #3bff88;
                text-shadow: 0 0 5px rgba(43,255,136,0.55);
            }
            #${BANNER_ID} .csp-sell-sub {
                font-size: 9px;
                font-weight: 600;
                letter-spacing: .2px;
                color: #b9ffd5;
            }
            @keyframes csp-sell-glow {
                0%, 100% { box-shadow: 0 0 7px rgba(43,255,136,0.4), inset 0 0 6px rgba(43,255,136,0.1); }
                50%      { box-shadow: 0 0 13px rgba(43,255,136,0.65), inset 0 0 9px rgba(43,255,136,0.18); }
            }
            @media (max-width: 640px) {
                #${BANNER_ID} { padding: 5px 9px; }
                #${BANNER_ID} .csp-sell-sub { display: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function createBanner() {
        const link = document.createElement('a');
        link.id = BANNER_ID;
        link.href = SELL_URL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'Sell your CS2 skins on CSPricebase — up to 96% Buff payouts';

        const logo = document.createElement('img');
        logo.className = 'csp-sell-logo';
        logo.src = LOGO_PATH;
        logo.alt = 'CSPricebase';

        const text = document.createElement('span');
        text.className = 'csp-sell-text';

        const title = document.createElement('span');
        title.className = 'csp-sell-title';
        title.textContent = 'SELL';

        const sub = document.createElement('span');
        sub.className = 'csp-sell-sub';
        sub.textContent = 'up to 96% Buff';

        text.append(title, sub);
        link.append(logo, text);
        return link;
    }

    function ensureBanner() {
        const existing = document.getElementById(BANNER_ID);
        const row = findNavRow();
        if (!row) return;

        if (existing && existing.isConnected && existing.parentElement === row) return;
        if (existing) existing.remove();

        injectStyles();
        row.insertBefore(createBanner(), row.firstChild);
    }

    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            ensureBanner();
        });
    }

    ensureBanner();
    new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
})();
