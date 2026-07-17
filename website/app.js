// app.js - ASMR & SAMR Fragrances - Application Engine

// ==========================================
// BRAND & MERCHANT CONFIGURATION
// ==========================================
const CONFIG = {
  WHATSAPP_NUMBER: '966500000000', // Target WhatsApp phone number (with country code, no +)
  INSTAGRAM_URL: 'https://instagram.com/asmr.samr.perfumes', // Instagram profile link
  SITE_DOMAIN: 'https://asmrsamr.com', // Production site domain (without trailing slash)
  FOUNDER_NAME: 'Artisan Perfumer & Founder', // Brand founder name
  PRODUCTION_CITY_EN: 'Riyadh', // Production city in English
  PRODUCTION_CITY_AR: 'الرياض', // Production city in Arabic
  RESERVED_COUNT: 42 // Number of bottles reserved from B.077 (used in Stage 2)
};

// Pre-launch checks to handle placeholder numbers gracefully
const IS_WHATSAPP_PLACEHOLDER = (CONFIG.WHATSAPP_NUMBER === '966500000000');

// Configuration Aliases to preserve existing references without massive refactoring
const WHATSAPP_NUMBER = CONFIG.WHATSAPP_NUMBER;
const INSTAGRAM_URL = CONFIG.INSTAGRAM_URL;

// Batch motif variables
const BATCH_MOTIF_EN = `Batch No. 077 / ${CONFIG.PRODUCTION_CITY_EN} Maceration / 28% Extrait`;
const BATCH_MOTIF_AR = `دفعة رقم ٠٧٧ / تعتيق ${CONFIG.PRODUCTION_CITY_AR} / ٢٨٪ تركيز عالي`;

// Global State
const state = {
  lang: localStorage.getItem('asmr_samr_lang') || 'en',
  cart: JSON.parse(localStorage.getItem('asmr_samr_cart')) || [],
  currentRoute: window.location.hash || '#/',
  selectedSize: {} // Stores size selections for detail pages: { productId: sizeString }
};

let previousActiveElement = null;

// ==========================================
// SHARED HELPERS: escaping, toast, rewards
// ==========================================
// Escape user-controlled text before injecting into HTML (prevents attribute/markup injection)
function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// On-theme, non-blocking toast — replaces blocking native browser dialogs
function showToast(message) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

// Loyalty is REAL: points are earned from actually-logged orders (1 point per SAR).
// Tiers: Classic (<2000) · Select (2000–4999) · Reserve (>=5000).
function getRewards(orders) {
  const list = orders || getOrders();
  const points = list.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  let tier = 'classic', tierEn = 'CLASSIC', tierAr = 'كلاسيك';
  if (points >= 5000) { tier = 'reserve'; tierEn = 'RESERVE'; tierAr = 'احتياطي'; }
  else if (points >= 2000) { tier = 'select'; tierEn = 'SELECT'; tierAr = 'مختار'; }
  const nextThreshold = points >= 5000 ? null : (points >= 2000 ? 5000 : 2000);
  const pointsLeft = nextThreshold ? nextThreshold - points : 0;
  let memberSince = null;
  if (list.length) {
    const earliest = list.reduce((min, o) => (o.ts && o.ts < min ? o.ts : min), list[0].ts);
    if (earliest) memberSince = new Date(earliest);
  }
  return { points, tier, tierEn, tierAr, nextThreshold, pointsLeft, memberSince, hasHistory: list.length > 0 };
}

// Dynamic SEO & Metadata Synchronization
function syncSEOAndMetadata() {
  // Update document title
  document.title = `ASMR & SAMR | Luxury Artisan Fragrance House ${CONFIG.PRODUCTION_CITY_EN}`;

  // Update meta elements
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `ASMR & SAMR | Luxury Artisan Fragrance House ${CONFIG.PRODUCTION_CITY_EN}`);
  
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', `ASMR & SAMR | Luxury Artisan Fragrance House ${CONFIG.PRODUCTION_CITY_EN}`);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', `Handcrafted in ${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia, ASMR & SAMR is an intimate his-and-hers perfume house. We produce true Extrait de Parfum (28% concentration), body sprays, and body creams in small numbered batches. Discover SAMR for her and ASMR for him.`);
  }

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    ogDesc.setAttribute('content', `Handcrafted in ${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia, ASMR & SAMR is an intimate his-and-hers perfume house. We produce true Extrait de Parfum (28% concentration), body sprays, and body creams in small numbered batches. Discover SAMR for her and ASMR for him.`);
  }

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    ogImage.setAttribute('content', `${CONFIG.SITE_DOMAIN}/assets/hero/landing-duo-photo.png`);
  }

  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage) {
    twitterImage.setAttribute('content', `${CONFIG.SITE_DOMAIN}/assets/hero/landing-duo-photo.png`);
  }

  // Update JSON-LD Script
  const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
  if (ldJsonScript) {
    try {
      const schema = JSON.parse(ldJsonScript.textContent);
      schema.url = CONFIG.SITE_DOMAIN;
      schema.founder.name = CONFIG.FOUNDER_NAME;
      schema.address.addressLocality = CONFIG.PRODUCTION_CITY_EN;
      schema.telephone = `+${CONFIG.WHATSAPP_NUMBER}`;
      ldJsonScript.textContent = JSON.stringify(schema, null, 2);
    } catch (e) {
      console.error('Failed to sync JSON-LD:', e);
    }
  }
}

// Preload critical hero images dynamically
function preloadHeroImage(url) {
  if (!url) return;
  const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  document.head.appendChild(link);
}

// Premium High-Fidelity SVG Visual Templates (Glass Refraction, Base Thickness, Ground Shadow)
const svgTemplates = {
  samrExtrait: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <!-- Background Ambient Glow -->
      <radialGradient id="samr-glow" cx="50%" cy="65%" r="50%">
        <stop offset="0%" stop-color="#C98A6A" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#2C2825" stop-opacity="0"/>
      </radialGradient>
      <!-- Bottle Glass Refraction -->
      <linearGradient id="samr-glass" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E7C9B5" stop-opacity="0.4"/>
        <stop offset="10%" stop-color="#FBF8F1" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="#C98A6A" stop-opacity="0.25"/>
        <stop offset="90%" stop-color="#E7C9B5" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#3B3531" stop-opacity="0.6"/>
      </linearGradient>
      <!-- Metallic Rose Gold / Brass -->
      <linearGradient id="gold-foil" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="30%" stop-color="#EBDFC6"/>
        <stop offset="70%" stop-color="#9C7B3C"/>
        <stop offset="100%" stop-color="#C4A566"/>
      </linearGradient>
      <!-- Liquid Contents -->
      <linearGradient id="samr-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#E7C9B5" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#C98A6A" stop-opacity="0.95"/>
      </linearGradient>
      <!-- Cap Texture -->
      <linearGradient id="cap-metallic" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#2C2825"/>
        <stop offset="40%" stop-color="#4E4641"/>
        <stop offset="50%" stop-color="#FBF8F1" stop-opacity="0.3"/>
        <stop offset="60%" stop-color="#4E4641"/>
        <stop offset="100%" stop-color="#2C2825"/>
      </linearGradient>
    </defs>
    
    <!-- Ambient Flare & Soft Grounding Shadow -->
    <rect width="200" height="240" fill="url(#samr-glow)" rx="4"/>
    <ellipse cx="100" cy="210" rx="48" ry="8" fill="#181513" opacity="0.6"/>
    <ellipse cx="100" cy="210" rx="35" ry="4" fill="#000" opacity="0.8"/>
    
    <!-- Outer Glass Bottle Shape (Thick Heavy Base) -->
    <rect x="62" y="85" width="76" height="110" rx="8" fill="url(#samr-glass)" stroke="url(#gold-foil)" stroke-width="1"/>
    
    <!-- Liquid Chamber (Starts 20px above bottle bottom for luxury heavy base look) -->
    <rect x="68" y="93" width="64" height="82" rx="4" fill="url(#samr-liquid)"/>
    
    <!-- Heavy Cap Assembly (Detailed Ridges & Gold Accent Ring) -->
    <rect x="88" y="75" width="24" height="10" fill="url(#gold-foil)"/>
    <rect x="76" y="45" width="48" height="30" rx="2" fill="url(#cap-metallic)" stroke="url(#gold-foil)" stroke-width="0.8"/>
    <!-- Fine Ridges on Cap -->
    <line x1="84" y1="45" x2="84" y2="75" stroke="#181513" stroke-width="0.5"/>
    <line x1="92" y1="45" x2="92" y2="75" stroke="#181513" stroke-width="0.5"/>
    <line x1="100" y1="45" x2="100" y2="75" stroke="#181513" stroke-width="0.5"/>
    <line x1="108" y1="45" x2="108" y2="75" stroke="#181513" stroke-width="0.5"/>
    <line x1="116" y1="45" x2="116" y2="75" stroke="#181513" stroke-width="0.5"/>
    
    <!-- Embossed Label with Motif -->
    <rect x="74" y="115" width="52" height="42" fill="#2C2825" stroke="url(#gold-foil)" stroke-width="0.8"/>
    <text x="100" y="131" fill="#EBDFC6" font-family="Instrument Serif" font-size="8" font-weight="500" text-anchor="middle" letter-spacing="1.5">SAMR</text>
    <text x="100" y="141" fill="#8A8072" font-family="Plus Jakarta Sans" font-size="4.2" text-anchor="middle" letter-spacing="0.5">EXTRAIT DE PARFUM</text>
    <text x="100" y="148" fill="#C4A566" font-family="Plus Jakarta Sans" font-size="3.8" text-anchor="middle" letter-spacing="0.2">B.077 / 28%</text>
    
    <!-- Glass Reflections & Light Passes -->
    <rect x="66" y="90" width="3" height="98" rx="1" fill="#FFF" opacity="0.25"/>
    <rect x="71" y="90" width="1" height="98" fill="#FFF" opacity="0.12"/>
    <rect x="129" y="90" width="3" height="98" rx="1" fill="#FFF" opacity="0.1"/>
  </svg>`,

  asmrExtrait: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <!-- Background Ambient Glow (Woody Gold) -->
      <radialGradient id="asmr-glow" cx="50%" cy="65%" r="50%">
        <stop offset="0%" stop-color="#C4A566" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#2C2825" stop-opacity="0"/>
      </radialGradient>
      <!-- Smoke Charcoal Glass -->
      <linearGradient id="asmr-glass" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4E4641" stop-opacity="0.6"/>
        <stop offset="20%" stop-color="#7A7067" stop-opacity="0.4"/>
        <stop offset="50%" stop-color="#2C2825" stop-opacity="0.8"/>
        <stop offset="80%" stop-color="#3B3531" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#181513" stop-opacity="0.9"/>
      </linearGradient>
      <linearGradient id="gold-foil-asmr" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="30%" stop-color="#EBDFC6"/>
        <stop offset="70%" stop-color="#9C7B3C"/>
        <stop offset="100%" stop-color="#C4A566"/>
      </linearGradient>
      <!-- Dark Amber Liquid -->
      <linearGradient id="asmr-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#9C7B3C" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#C4A566" stop-opacity="0.15"/>
      </linearGradient>
      <!-- Cap Texture -->
      <linearGradient id="cap-gold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#9C7B3C"/>
        <stop offset="40%" stop-color="#C4A566"/>
        <stop offset="50%" stop-color="#EBDFC6"/>
        <stop offset="60%" stop-color="#C4A566"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
    </defs>
    
    <!-- Ambient Flare & Soft Grounding Shadow -->
    <rect width="200" height="240" fill="url(#asmr-glow)" rx="4"/>
    <ellipse cx="100" cy="210" rx="48" ry="8" fill="#181513" opacity="0.7"/>
    <ellipse cx="100" cy="210" rx="35" ry="4" fill="#000" opacity="0.9"/>
    
    <!-- Outer Glass Bottle Shape (Thick Heavy Base) -->
    <rect x="62" y="85" width="76" height="110" rx="8" fill="url(#asmr-glass)" stroke="url(#gold-foil-asmr)" stroke-width="1"/>
    
    <!-- Liquid Chamber (Thick Base Look) -->
    <rect x="68" y="93" width="64" height="82" rx="4" fill="url(#asmr-liquid)"/>
    
    <!-- Heavy Cap Assembly (Detailed Ridges & Gold Accent Ring) -->
    <rect x="88" y="75" width="24" height="10" fill="url(#cap-gold)"/>
    <rect x="76" y="45" width="48" height="30" rx="2" fill="url(#cap-gold)" stroke="#181513" stroke-width="0.5"/>
    <!-- Fine Ridges on Cap -->
    <line x1="84" y1="45" x2="84" y2="75" stroke="#9C7B3C" stroke-width="0.5"/>
    <line x1="92" y1="45" x2="92" y2="75" stroke="#9C7B3C" stroke-width="0.5"/>
    <line x1="100" y1="45" x2="100" y2="75" stroke="#9C7B3C" stroke-width="0.5"/>
    <line x1="108" y1="45" x2="108" y2="75" stroke="#9C7B3C" stroke-width="0.5"/>
    <line x1="116" y1="45" x2="116" y2="75" stroke="#9C7B3C" stroke-width="0.5"/>
    
    <!-- Embossed Label with Motif -->
    <rect x="74" y="115" width="52" height="42" fill="#2C2825" stroke="url(#gold-foil-asmr)" stroke-width="0.8"/>
    <text x="100" y="131" fill="#EBDFC6" font-family="Instrument Serif" font-size="8" font-weight="500" text-anchor="middle" letter-spacing="1.5">ASMR</text>
    <text x="100" y="141" fill="#8A8072" font-family="Plus Jakarta Sans" font-size="4.2" text-anchor="middle" letter-spacing="0.5">EXTRAIT DE PARFUM</text>
    <text x="100" y="148" fill="#C4A566" font-family="Plus Jakarta Sans" font-size="3.8" text-anchor="middle" letter-spacing="0.2">B.077 / 28%</text>
    
    <!-- Glass Reflections & Light Passes -->
    <rect x="66" y="90" width="3" height="98" rx="1" fill="#FFF" opacity="0.18"/>
    <rect x="71" y="90" width="1" height="98" fill="#FFF" opacity="0.08"/>
    <rect x="129" y="90" width="3" height="98" rx="1" fill="#FFF" opacity="0.05"/>
  </svg>`,

  bodySpray: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <linearGradient id="spray-metallic" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#181513"/>
        <stop offset="40%" stop-color="#4E4641"/>
        <stop offset="50%" stop-color="#7A7067" stop-opacity="0.5"/>
        <stop offset="70%" stop-color="#3B3531"/>
        <stop offset="100%" stop-color="#181513"/>
      </linearGradient>
      <linearGradient id="spray-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" fill="#2C2825" rx="4"/>
    <ellipse cx="100" cy="212" rx="42" ry="7" fill="#000" opacity="0.6"/>
    
    <!-- Canister Body -->
    <rect x="74" y="68" width="52" height="138" rx="6" fill="url(#spray-metallic)" stroke="url(#spray-gold)" stroke-width="0.8"/>
    
    <!-- Metallic Atomizer Collar -->
    <rect x="88" y="55" width="24" height="13" fill="url(#spray-gold)"/>
    <rect x="92" y="47" width="16" height="8" rx="1" fill="#181513"/>
    <circle cx="100" cy="51" r="1" fill="url(#spray-gold)"/>
    
    <!-- Label -->
    <rect x="78" y="110" width="44" height="48" fill="#2C2825" stroke="url(#spray-gold)" stroke-width="0.6"/>
    <text x="100" y="128" fill="#EBDFC6" font-family="Instrument Serif" font-size="8" text-anchor="middle" letter-spacing="1">BODY SPRAY</text>
    <text x="100" y="138" fill="#8A8072" font-family="Plus Jakarta Sans" font-size="4.2" text-anchor="middle" letter-spacing="0.5">B.077 · 100ML</text>
    <text x="100" y="145" fill="#C4A566" font-family="Plus Jakarta Sans" font-size="3.5" text-anchor="middle" letter-spacing="0.5">RIYADH EDITION</text>
    
    <!-- Reflections -->
    <rect x="78" y="72" width="2" height="130" fill="#FFF" opacity="0.12"/>
  </svg>`,

  bodyCream: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <linearGradient id="cream-jar-glass" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E7C9B5" stop-opacity="0.3"/>
        <stop offset="30%" stop-color="#FBF8F1" stop-opacity="0.4"/>
        <stop offset="60%" stop-color="#C98A6A" stop-opacity="0.2"/>
        <stop offset="90%" stop-color="#E7C9B5" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#2C2825" stop-opacity="0.6"/>
      </linearGradient>
      <linearGradient id="cream-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="50%" stop-color="#EBDFC6"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
      <linearGradient id="cream-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#F7F3EA" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#E7C9B5" stop-opacity="0.75"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" fill="#2C2825" rx="4"/>
    <ellipse cx="100" cy="198" rx="62" ry="10" fill="#000" opacity="0.5"/>
    
    <!-- Jar Body (Squat Luxury Glass with heavy base) -->
    <rect x="42" y="112" width="116" height="76" rx="8" fill="url(#cream-jar-glass)" stroke="url(#cream-gold)" stroke-width="1"/>
    <!-- Cream Contents Layer (Starts 18px from bottom) -->
    <rect x="48" y="122" width="104" height="52" rx="4" fill="url(#cream-liquid)"/>
    
    <!-- Premium Metallic Cap -->
    <rect x="38" y="90" width="124" height="22" rx="3" fill="url(#cream-gold)" stroke="#181513" stroke-width="0.5"/>
    <line x1="38" y1="96" x2="162" y2="96" stroke="#9C7B3C" stroke-width="0.5"/>
    <line x1="38" y1="102" x2="162" y2="102" stroke="#9C7B3C" stroke-width="0.5"/>
    
    <!-- Tiny Label -->
    <rect x="65" y="134" width="70" height="28" fill="#2C2825" stroke="url(#cream-gold)" stroke-width="0.5"/>
    <text x="100" y="148" fill="#EBDFC6" font-family="Instrument Serif" font-size="8" text-anchor="middle" letter-spacing="1">BODY CREAM</text>
    <text x="100" y="156" fill="#C4A566" font-family="Plus Jakarta Sans" font-size="4" text-anchor="middle" letter-spacing="0.5">B.077 · 100G</text>
    
    <!-- Highlights -->
    <rect x="48" y="116" width="3" height="66" fill="#FFF" opacity="0.15"/>
  </svg>`,

  discoverySet: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <linearGradient id="vial-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" fill="#2C2825" rx="4"/>
    <ellipse cx="68" cy="208" rx="22" ry="5" fill="#000" opacity="0.4"/>
    <ellipse cx="132" cy="208" rx="22" ry="5" fill="#000" opacity="0.4"/>
    
    <!-- SAMR Vial (Left) -->
    <rect x="54" y="65" width="28" height="135" rx="4" fill="#F7F3EA" fill-opacity="0.12" stroke="url(#vial-gold)" stroke-width="0.7"/>
    <rect x="58" y="85" width="20" height="105" rx="2" fill="#C98A6A" opacity="0.35"/>
    <rect x="52" y="47" width="32" height="18" rx="1" fill="url(#vial-gold)" stroke="#181513" stroke-width="0.5"/>
    <!-- Label -->
    <rect x="58" y="110" width="20" height="45" fill="#2C2825" stroke="url(#vial-gold)" stroke-width="0.5"/>
    <text x="68" y="133" fill="#EBDFC6" font-family="Instrument Serif" font-size="6.5" font-weight="500" text-anchor="middle" transform="rotate(-90 68 133)">SAMR</text>
    
    <!-- ASMR Vial (Right) -->
    <rect x="118" y="65" width="28" height="135" rx="4" fill="#F7F3EA" fill-opacity="0.12" stroke="url(#vial-gold)" stroke-width="0.7"/>
    <rect x="122" y="85" width="20" height="105" rx="2" fill="#C4A566" opacity="0.18"/>
    <rect x="116" y="47" width="32" height="18" rx="1" fill="url(#vial-gold)" stroke="#181513" stroke-width="0.5"/>
    <!-- Label -->
    <rect x="122" y="110" width="20" height="45" fill="#2C2825" stroke="url(#vial-gold)" stroke-width="0.5"/>
    <text x="132" y="133" fill="#EBDFC6" font-family="Instrument Serif" font-size="6.5" font-weight="500" text-anchor="middle" transform="rotate(-90 132 133)">ASMR</text>
  </svg>`,

  duoBox: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <linearGradient id="duo-box-card" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3B3531"/>
        <stop offset="50%" stop-color="#2C2825"/>
        <stop offset="100%" stop-color="#181513"/>
      </linearGradient>
      <linearGradient id="duo-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="50%" stop-color="#EBDFC6"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" fill="#2C2825" rx="4"/>
    <ellipse cx="100" cy="208" rx="78" ry="14" fill="#000" opacity="0.6"/>
    
    <!-- Open Luxury Coffret Outer Shell -->
    <rect x="30" y="55" width="140" height="135" rx="4" fill="url(#duo-box-card)" stroke="url(#duo-gold)" stroke-width="1.2"/>
    <line x1="100" y1="55" x2="100" y2="190" stroke="url(#duo-gold)" stroke-width="0.5" opacity="0.4"/>
    
    <!-- Mold cutouts representing nested bottles -->
    <rect x="44" y="75" width="42" height="95" rx="3" fill="#181513" stroke="url(#duo-gold)" stroke-width="0.5" stroke-dasharray="2,2"/>
    <rect x="114" y="75" width="42" height="95" rx="3" fill="#181513" stroke="url(#duo-gold)" stroke-width="0.5" stroke-dasharray="2,2"/>
    
    <!-- Coffret Seal Logo -->
    <circle cx="100" cy="122" r="24" fill="#2C2825" stroke="url(#duo-gold)" stroke-width="0.8"/>
    <text x="100" y="119" fill="#EBDFC6" font-family="Instrument Serif" font-size="7.5" font-weight="500" text-anchor="middle" letter-spacing="1">RIYADH</text>
    <text x="100" y="129" fill="#C4A566" font-family="Plus Jakarta Sans" font-size="4.2" text-anchor="middle" letter-spacing="0.5">B.077 DUO</text>
  </svg>`,

  trioSet: `<svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg-visual" aria-hidden="true">
    <defs>
      <linearGradient id="trio-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A566"/>
        <stop offset="100%" stop-color="#9C7B3C"/>
      </linearGradient>
    </defs>
    <rect width="200" height="240" fill="#2C2825" rx="4"/>
    <ellipse cx="100" cy="210" rx="80" ry="12" fill="#000" opacity="0.6"/>
    
    <!-- Body Spray (Back Left) -->
    <rect x="36" y="75" width="34" height="110" rx="4" fill="#3B3531" stroke="url(#trio-gold)" stroke-width="0.6"/>
    <rect x="46" y="65" width="14" height="10" fill="url(#trio-gold)"/>
    
    <!-- Body Cream (Back Right) -->
    <rect x="118" y="130" width="52" height="55" rx="4" fill="#4E4641" stroke="url(#trio-gold)" stroke-width="0.6"/>
    <rect x="114" y="118" width="60" height="12" fill="url(#trio-gold)"/>
    
    <!-- Perfume Bottle (Front Center) -->
    <rect x="66" y="95" width="58" height="92" rx="4" fill="#2C2825" stroke="url(#trio-gold)" stroke-width="1.2"/>
    <rect x="71" y="112" width="48" height="64" fill="#C98A6A" opacity="0.25"/>
    <rect x="75" y="122" width="40" height="30" fill="#3B3531" stroke="url(#trio-gold)" stroke-width="0.5"/>
    <rect x="86" y="87" width="18" height="8" fill="url(#trio-gold)"/>
    <rect x="76" y="67" width="38" height="20" rx="1" fill="#181513" stroke="url(#trio-gold)" stroke-width="0.6"/>
  </svg>`
};

// Product Database
const products = [
  {
    id: 'samr-extrait',
    brand: 'SAMR',
    type: 'extrait',
    nameEn: 'SAMR Extrait de Parfum',
    nameAr: 'مستخلص عطر سَمَر',
    familyEn: 'Gourmand Amber Floral, Extrait de Parfum 28%',
    familyAr: 'عنبر زهري حلو، مستخلص عطر ٢٨٪',
    descEn: 'The scent he cannot forget. Sun-warmed fruit gives way to white flowers at body heat, then a drydown of double vanilla, tonka and skin musks that stays close for hours.',
    descAr: 'الرائحة التي لا يستطيع نسيانها. الفواكه الدافئة المشمسة تفسح المجال للزهور البيضاء مع حرارة الجسد، ثم تستقر في قاعدة من الفانيليا المزدوجة، التونكا والمسك الجلدي التي تدوم لساعات.',
    sizes: ['10 ml', '30 ml', '50 ml', '70 ml', '100 ml'],
    prices: {
      '10 ml': 70,
      '30 ml': 190,
      '50 ml': 270,
      '70 ml': 360,
      '100 ml': 460
    },
    heroSize: '50 ml',
    pyramid: {
      topEn: 'Bergamot · Pink Pepper · Peach · Raspberry',
      topAr: 'البرغموت · الفلفل الوردي · الخوخ · التوت الأحمر',
      heartEn: 'Jasmine Absolute · Tuberose · Radiant Jasmine (Hedione) · Violet-Iris · Solar Balsam',
      heartAr: 'مستخلص الياسمين · مسك الروم · الياسمين المشرق · البنفسج والسوسن · البلسم الشمسي',
      baseEn: 'Double Vanilla · Tonka & Caramel · Heliotrope · Coconut Cream · Ambergris · Sandalwood · Velvet Woods · Skin Musks',
      baseAr: 'الفانيليا المزدوجة · التونكا والكراميل · رقيب الشمس · كريمة جوز الهند · العنبر · خشب الصندل · الأخشاب المخملية · مسك البشرة'
    },
    wearEn: 'Apply low and close — wrists, throat, behind the ears, one spray in the hair. Best at conversation distance.',
    wearAr: 'يُوضع بشكل خفيف وقريب - على المعصمين، الحلق، خلف الأذنين، ورشة واحدة على الشعر. يكون أفضل في مسافة المحادثة المقربة.',
    badgeEn: 'Batch B.077 · Extrait 28%',
    badgeAr: '\u062F\u0641\u0639\u0629 \u0660\u0667\u0667 \u00B7 \u0645\u0633\u062A\u062E\u0644\u0635 \u0662\u0668\u066A',
    visualSvg: svgTemplates.samrExtrait,
    amberGlow: true
  },
  {
    id: 'asmr-extrait',
    brand: 'ASMR',
    type: 'extrait',
    nameEn: 'ASMR Extrait de Parfum',
    nameAr: 'مستخلص عطر أسمر',
    familyEn: 'Woody Amber skin scent, Extrait de Parfum 28%',
    familyAr: 'عطر خشبي عنبري جلدي فاخر، مستخلص عطر ٢٨٪',
    descEn: 'Presence that stays. A radiant citrus opening over a jasmine-lit heart, settling into amber, sandalwood and a five-musk trail that reads like second skin.',
    descAr: 'حضورٌ يبقى. افتتاحية من الحمضيات المتألقة تتبعها نبضات من الياسمين المشرق، تستقر في نهاية المطاف في العنبر، خشب الصندل، وأثر مميز من خمسة أنواع مسك تبدو كطبقة ثانية للجلد.',
    sizes: ['10 ml', '30 ml', '50 ml', '70 ml', '100 ml'],
    prices: {
      '10 ml': 90,
      '30 ml': 250,
      '50 ml': 380,
      '70 ml': 510,
      '100 ml': 680
    },
    heroSize: '50 ml',
    pyramid: {
      topEn: 'Bergamot · Petitgrain · Neroli · Pink Pepper',
      topAr: 'البرغموت · البتيغرين · الينرولي · الفلفل الوردي',
      heartEn: 'Radiant Jasmine (Hedione) · Orange Blossom · Orris-Violet',
      heartAr: 'الياسمين المشرق · زهر البرتقال · السوسن والبنفسج',
      baseEn: 'Ambergris Amber (Ambroxan) · Sandalwood · Cedar · Velvet Woods (Iso E Super) · Five-Musk Accord · Saffron-Leather',
      baseAr: 'العنبر والمسك · خشب الصندل · خشب الأرز · الأخشاب المخملية · نغمة خماسية المسك · الزعفران والجلود'
    },
    wearEn: 'A scent that hums close to the skin and lasts 8–12 hours.',
    wearAr: 'رائحة تلتصق بالبشرة وتدوم من ٨ إلى ١٢ ساعة.',
    badgeEn: 'Batch B.077 · Extrait 28%',
    badgeAr: '\u062F\u0641\u0639\u0629 \u0660\u0667\u0667 \u00B7 \u0645\u0633\u062A\u062E\u0644\u0635 \u0662\u0668\u066A',
    visualSvg: svgTemplates.asmrExtrait,
    amberGlow: false
  },
  {
    id: 'samr-spray',
    brand: 'SAMR',
    type: 'spray',
    nameEn: 'SAMR Body Spray',
    nameAr: 'بخاخ الجسم سَمَر',
    familyEn: 'Scented Body Spray',
    familyAr: 'بخاخ عطري للجسم',
    descEn: 'A lighter, full-body rendition of the warm, nocturnal Gourmand Amber Floral signature. Perfect for a refreshing mist after bathing.',
    descAr: 'نسخة أخف لكامل الجسم من توقيع عطر سَمَر العنبري الزهري. مثالي لرذاذ منعش بعد الاستحمام.',
    sizes: ['100 ml'],
    prices: { '100 ml': 79 },
    heroSize: '100 ml',
    pyramid: {
      topEn: 'Bergamot · Peach · Pink Pepper',
      topAr: 'البرغموت · الخوخ · الفلفل الوردي',
      heartEn: 'Jasmine Absolute · Tuberose · Solar Balsam',
      heartAr: 'مستخلص الياسمين · مسك الروم · البلسم الشمسي',
      baseEn: 'Double Vanilla · Tonka · Skin Musks',
      baseAr: 'الفانيليا المزدوجة · التونكا · مسك البشرة'
    },
    wearEn: 'Spray generously all over the body. Layer with SAMR Extrait de Parfum for heightened projection.',
    wearAr: 'رشّه بسخاء على جميع أنحاء الجسم. ضعه كطبقة أساسية مع عطر سَمَر المركز لزيادة ثبات العطر.',
    badgeEn: 'Artisanal Batch B.077',
    badgeAr: 'دفعة يدوية ٠٧٧',
    visualSvg: svgTemplates.bodySpray,
    amberGlow: true
  },
  {
    id: 'asmr-spray',
    brand: 'ASMR',
    type: 'spray',
    nameEn: 'ASMR Body Spray',
    nameAr: 'بخاخ الجسم أسمر',
    familyEn: 'Scented Body Spray',
    familyAr: 'بخاخ عطري للجسم',
    descEn: 'A crisp, full-body mist carrying the cedarwood, amber, and five-musk skin trace of ASMR.',
    descAr: 'رذاذ منعش للجسم بالكامل يحمل لمسات خشب الأرز والعنبر وتوقيع المسك الخماسي من عطر أسمر.',
    sizes: ['100 ml'],
    prices: { '100 ml': 99 },
    heroSize: '100 ml',
    pyramid: {
      topEn: 'Bergamot · Petitgrain · Pink Pepper',
      topAr: 'البرغموت · البتيغرين · الفلفل الوردي',
      heartEn: 'Radiant Jasmine · Orange Blossom',
      heartAr: 'الياسمين المشرق · زهر البرتقال',
      baseEn: 'Sandalwood · Velvet Woods · Five-Musk Accord',
      baseAr: 'خشب الصندل · الأخشاب المخملية · نغمة خماسية المسك'
    },
    wearEn: 'Spray all over the body, especially on chest and shoulders, after showering.',
    wearAr: 'يرش على كافة أنحاء الجسد، خاصة الصدر والأكتاف بعد الاستحمام.',
    badgeEn: 'Artisanal Batch B.077',
    badgeAr: 'دفعة يدوية ٠٧٧',
    visualSvg: svgTemplates.bodySpray,
    amberGlow: false
  },
  {
    id: 'samr-cream',
    brand: 'SAMR',
    type: 'cream',
    nameEn: 'SAMR Body Cream',
    nameAr: 'كريم الجسم سَمَر',
    familyEn: 'Luxury Body Cream',
    familyAr: 'كريم فاخر للجسم',
    descEn: 'A rich, skin-softening cream infused with the double vanilla, tonka, and velvet wood notes of SAMR. Intimately moisturizing.',
    descAr: 'كريم غني ومنعم للبشرة غني بالفانيليا المزدوجة والتونكا والأخشاب المخملية من عطر سَمَر. ترطيب حميمي.',
    sizes: ['100 g'],
    prices: { '100 g': 69 },
    heroSize: '100 g',
    pyramid: {
      topEn: 'Bergamot · Peach',
      topAr: 'البرغموت · الخوخ',
      heartEn: 'Jasmine Absolute · Violet-Iris',
      heartAr: 'مستخلص الياسمين · البنفسج والسوسن',
      baseEn: 'Double Vanilla · Tonka · Skin Musks',
      baseAr: 'الفانيليا المزدوجة · التونكا · مسك البشرة'
    },
    wearEn: 'Massage gently into warm skin after bathing, focusing on wrists, neck, and shoulders.',
    wearAr: 'يدلك بلطف على البشرة الدافئة بعد الاستحمام، مع التركيز على المعصمين والرقبة والأكتاف.',
    badgeEn: 'Formula Weigh 28%',
    badgeAr: 'تركيبة يدوية ٢٨٪',
    visualSvg: svgTemplates.bodyCream,
    amberGlow: true
  },
  {
    id: 'asmr-cream',
    brand: 'ASMR',
    type: 'cream',
    nameEn: 'ASMR Body Cream',
    nameAr: 'كريم الجسم أسمر',
    familyEn: 'Luxury Body Cream',
    familyAr: 'كريم فاخر للجسم',
    descEn: 'A deeply nourishing and soothing cream carrying the warm sandalwood, ambergris, and soft leather tones of ASMR.',
    descAr: 'كريم مغذي ومهدئ بعمق يحمل لمسات خشب الصندل الدافئ والعنبر والجلود الناعمة من عطر أسمر.',
    sizes: ['100 g'],
    prices: { '100 g': 79 },
    heroSize: '100 g',
    pyramid: {
      topEn: 'Neroli · Pink Pepper',
      topAr: 'الينرولي · الفلفل الوردي',
      heartEn: 'Radiant Jasmine',
      heartAr: 'الياسمين المشرق',
      baseEn: 'Sandalwood · Cedar · Five-Musk Accord',
      baseAr: 'خشب الصندل · خشب الأرز · نغمة خماسية المسك'
    },
    wearEn: 'Massage into hands, arms, and chest to create a soft, hydrating base for your fragrance.',
    wearAr: 'يدلك على اليدين والذراعين والصدر لخلق قاعدة ناعمة ومرطبة لعطرك.',
    badgeEn: 'Formula Weigh 28%',
    badgeAr: 'تركيبة يدوية ٢٨٪',
    visualSvg: svgTemplates.bodyCream,
    amberGlow: false
  },
  {
    id: 'discovery-set',
    brand: 'ASMR & SAMR',
    type: 'sets',
    nameEn: 'Discovery Set',
    nameAr: 'مجموعة الاكتشاف',
    familyEn: 'Sensory Discovery Set',
    familyAr: 'مجموعة الاكتشاف الحسية',
    descEn: 'Explore the dual concepts of closeness and lingering presence. Contains 2 ml glass vials of both SAMR and ASMR Extraits. Redeemable against a full bottle.',
    descAr: 'اكتشف المعنى المزدوج للقرب والحضور الدائم. تحتوي على عينتين زجاجيتين بحجم ٢ مل من مستخلص عطر سَمَر وأسمر. القيمة مستردة عند شراء زجاجة كاملة.',
    sizes: ['2x 2 ml'],
    prices: { '2x 2 ml': 60 },
    heroSize: '2x 2 ml',
    pyramid: {
      topEn: 'Peach · Bergamot · Neroli · Pepper',
      topAr: 'الخوخ · البرغموت · الينرولي · الفلفل',
      heartEn: 'Jasmine Absolute · Radiant Jasmine · Violet-Iris',
      heartAr: 'مستخلص الياسمين · الياسمين المشرق · البنفسج والسوسن',
      baseEn: 'Double Vanilla · Ambergris · Five-Musks · Sandalwood',
      baseAr: 'الفانيليا المزدوجة · العنبر · المسك الخماسي · خشب الصندل'
    },
    wearEn: 'Test both scents on clean skin. Observe SAMR responding to body heat, and ASMR settling as a skin trace.',
    wearAr: 'اختبر كلا العطرين على بشرة نظيفة. راقب تفاعل عطر سَمَر مع حرارة الجسم، واستقرار عطر أسمر كأثر للبشرة.',
    badgeEn: 'Fully Redeemable',
    badgeAr: 'قيمة مستردة بالكامل',
    visualSvg: svgTemplates.discoverySet,
    amberGlow: null
  },
  {
    id: 'duo-box',
    brand: 'ASMR & SAMR',
    type: 'sets',
    nameEn: 'His & Hers Duo Box',
    nameAr: 'صندوق الثنائي له ولها',
    familyEn: 'Luxury Coffret Duo',
    familyAr: 'علبة ثنائية فاخرة',
    descEn: 'The ultimate expression of the house. A handcrafted coffret containing the complete pair: ASMR 50 ml and SAMR 50 ml Extraits. (A saving of 51 SAR compared to separate purchases).',
    descAr: 'التعبير الأسمى لدار العطور. صندوق مصنوع يدوياً يحتوي على الثنائي الكامل: مستخلص عطر أسمر ٥٠ مل وسَمَر ٥٠ مل. (توفير ٥١ ريال مقارنة بالشراء الفردي).',
    sizes: ['Duo Box (2x 50 ml)'],
    prices: { 'Duo Box (2x 50 ml)': 599 },
    heroSize: 'Duo Box (2x 50 ml)',
    pyramid: {
      topEn: 'Combined Citrus, Pink Pepper & Fruits',
      topAr: 'مزيج الحمضيات، الفلفل الوردي والفواكه الدافئة',
      heartEn: 'Jasmine Absolute · Radiant Jasmine (Hedione)',
      heartAr: 'مستخلص الياسمين · الياسمين المشرق',
      baseEn: 'Double Vanilla · Sandalwood · Ambergris · Five-Musk Accord',
      baseAr: 'الفانيليا المزدوجة · خشب الصندل · العنبر · نغمة خماسية المسك'
    },
    wearEn: 'Wear individually as your signature scents, or layer them together for a rich, shared nocturnal aura.',
    wearAr: 'يُرتدى كل عطر بشكل منفصل كتوقيع شخصي، أو كلاهما معاً للحصول على هالة مشتركة دافئة.',
    badgeEn: 'Batch B.077 Duo Set',
    badgeAr: 'علبة ثنائية دفعة ٠٧٧',
    visualSvg: svgTemplates.duoBox,
    amberGlow: null
  },
  {
    id: 'samr-trio',
    brand: 'SAMR',
    type: 'sets',
    nameEn: 'SAMR Trio Set',
    nameAr: 'مجموعة ثلاثية سَمَر',
    familyEn: 'Sensory Layering Ritual',
    familyAr: 'طقوس الطبقات الحسية',
    descEn: 'The complete three-step layering ritual for her. Contains SAMR Extrait de Parfum 50ml, Body Spray 100ml, and Body Cream 100g.',
    descAr: 'طقوس الطبقات الكاملة المكونة من ثلاث خطوات لها. تحتوي على عطر سَمَر ٥٠ مل، وبخاخ الجسم ١٠٠ مل، وكريم الجسم ١٠٠ غرام.',
    sizes: ['Trio Set'],
    prices: { 'Trio Set': 379 },
    heroSize: 'Trio Set',
    pyramid: {
      topEn: 'Bergamot · Pink Pepper · Peach · Raspberry',
      topAr: 'البرغموت · الفلفل الوردي · الخوخ · التوت',
      heartEn: 'Jasmine Absolute · Tuberose · Radiant Jasmine',
      heartAr: 'مستخلص الياسمين · مسك الروم · الياسمين المشرق',
      baseEn: 'Double Vanilla · Tonka · Coconut Cream · Skin Musks',
      baseAr: 'الفانيليا المزدوجة · التونكا · كريمة جوز الهند · مسك البشرة'
    },
    wearEn: 'Apply body cream first to hydrate, mist with body spray, and lock in the scent with Extrait de Parfum on pulse points.',
    wearAr: 'ضعي كريم الجسم أولاً لترطيب البشرة، ثم رشي رذاذ الجسم، وثبّتي الرائحة بمستخلص العطر المركز على مناطق النبض.',
    badgeEn: 'Ritual Box B.077',
    badgeAr: 'مجموعة طقوس ٠٧٧',
    visualSvg: svgTemplates.trioSet,
    amberGlow: true
  },
  {
    id: 'asmr-trio',
    brand: 'ASMR',
    type: 'sets',
    nameEn: 'ASMR Trio Set',
    nameAr: 'مجموعة ثلاثية أسمر',
    familyEn: 'Sensory Layering Ritual',
    familyAr: 'طقوس الطبقات الحسية',
    descEn: 'The complete three-step layering ritual for him. Contains ASMR Extrait de Parfum 50ml, Body Spray 100ml, and Body Cream 100g.',
    descAr: 'طقوس الطبقات الكاملة المكونة من ثلاث خطوات له. تحتوي على عطر أسمر ٥٠ مل، وبخاخ الجسم ١٠٠ مل، وكريم الجسم ١٠٠ غرام.',
    sizes: ['Trio Set'],
    prices: { 'Trio Set': 499 },
    heroSize: 'Trio Set',
    pyramid: {
      topEn: 'Bergamot · Petitgrain · Neroli · Pepper',
      topAr: 'البرغموت · البتيغرين · الينرولي · الفلفل',
      heartEn: 'Radiant Jasmine · Orange Blossom · Orris',
      heartAr: 'الياسمين المشرق · زهر البرتقال · السوسن',
      baseEn: 'Ambergris · Sandalwood · Cedar · Five-Musk Accord',
      baseAr: 'العنبر · خشب الصندل · خشب الأرز · نغمة خماسية المسك'
    },
    wearEn: 'Prep the skin with the body cream, spray the body mist all over, and finish with a spray of Extrait de Parfum.',
    wearAr: 'جهّز البشرة بكريم الجسم، ورش رذاذ الجسم بالكامل، ثم توّجها برشة من مستخلص العطر أسمر.',
    badgeEn: 'Ritual Box B.077',
    badgeAr: 'مجموعة طقوس ٠٧٧',
    visualSvg: svgTemplates.trioSet,
    amberGlow: false
  }
];

const PRODUCT_IMAGE_BASE = 'assets/products/consistent-catalog-20260712';
const PRODUCT_IMAGE_VERSION = 'shop-upgrade-20260712';
const productImageFiles = {
  'samr-extrait': 'samr-extrait',
  'asmr-extrait': 'asmr-extrait',
  'samr-spray': 'samr-spray',
  'asmr-spray': 'asmr-spray',
  'samr-cream': 'samr-cream',
  'asmr-cream': 'asmr-cream',
  'discovery-set': 'discovery-set',
  'duo-box': 'duo-box',
  'samr-trio': 'samr-trio',
  'asmr-trio': 'asmr-trio'
};

const productImages = Object.fromEntries(
  Object.entries(productImageFiles).map(([productId, fileName]) => [
    productId,
    {
      webp: `${PRODUCT_IMAGE_BASE}/${fileName}.webp?v=${PRODUCT_IMAGE_VERSION}`,
      png: `${PRODUCT_IMAGE_BASE}/${fileName}.png?v=${PRODUCT_IMAGE_VERSION}`
    }
  ])
);

let storefrontContent = [];

const heroImages = {
  landing: 'assets/hero/landing-reference-bottles.png?v=landing-reference-20260712',
  samr: 'assets/hero/samr-campaign-wide.png?v=campaign-wide-20260712',
  asmr: 'assets/hero/asmr-campaign-wide.png?v=campaign-wide-20260712'
};

function isProductPublic(product) {
  return product && product.admin?.isActive !== false;
}

function getPublicProducts() {
  return products
    .filter(isProductPublic)
    .slice()
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.admin?.sortOrder)) ? Number(a.admin.sortOrder) : products.indexOf(a);
      const bOrder = Number.isFinite(Number(b.admin?.sortOrder)) ? Number(b.admin.sortOrder) : products.indexOf(b);
      return aOrder - bOrder;
    });
}

function getFeaturedProducts() {
  const featured = getPublicProducts().filter(product => product.admin?.featuredOnHome);
  if (featured.length) return featured;
  return getPublicProducts().filter(product => product.id === 'samr-extrait' || product.id === 'asmr-extrait');
}

function getProductById(productId, options = {}) {
  const product = products.find(item => item.id === productId);
  if (!product) return undefined;
  if (!options.includeInactive && !isProductPublic(product)) return undefined;
  return product;
}

function getPublicSupabaseConfig() {
  const config = window.ASMR_SAMR_CONFIG || window.ASMR_SAMR_SUPABASE || {};
  return {
    url: String(config.supabaseUrl || config.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: config.supabaseAnonKey || config.SUPABASE_ANON_KEY || config.anonKey || ''
  };
}

async function publicSupabaseRequest(path, options = {}) {
  const config = getPublicSupabaseConfig();
  if (!config.url || !config.key) throw new Error('Storefront database configuration is unavailable.');
  const response = await fetch(`${config.url}/rest/v1/${path.replace(/^\/+/, '')}`, {
    method: options.method || 'GET',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch (_) { payload = raw; }
  if (!response.ok) throw new Error((payload && (payload.message || payload.error)) || `Storefront request failed (${response.status}).`);
  return payload;
}

function storefrontImageUrl(value) {
  const url = String(value || '').trim();
  if (!url || /^(javascript|data):/i.test(url)) return '';
  return url;
}

async function loadPublicCatalogFromSupabase() {
  document.documentElement.dataset.catalogSource = 'loading';
  delete document.documentElement.dataset.catalogError;
  const config = getPublicSupabaseConfig();
  if (!config.url || !config.key) {
    document.documentElement.dataset.catalogSource = 'fallback';
    document.documentElement.dataset.catalogError = 'configuration-unavailable';
    return false;
  }
  try {
    const [catalog, contentRows] = await Promise.all([
      publicSupabaseRequest('rpc/get_storefront_catalog', { method: 'POST', body: {} }),
      publicSupabaseRequest(
        'website_content?select=content_type,slug,title_en,title_ar,body_en,body_ar,metadata,sort_order,published_at&status=eq.published&order=sort_order.asc',
        { method: 'GET' }
      )
    ]);
    storefrontContent = Array.isArray(contentRows) ? contentRows : [];
    const rows = catalog?.products;
    const noteRows = catalog?.fragrance_notes;
    const relationRows = catalog?.related_products;
    if (!Array.isArray(rows) || !rows.length) {
      document.documentElement.dataset.catalogSource = 'fallback';
      return false;
    }

    const fallbackById = new Map(products.map((product) => [product.id, product]));
    const notesByProduct = new Map();
    (noteRows || []).forEach((row) => {
      if (!notesByProduct.has(row.product_id)) notesByProduct.set(row.product_id, { top: [], heart: [], base: [], profile: [] });
      const note = row.fragrance_notes || {};
      const phase = notesByProduct.get(row.product_id)[row.phase] || notesByProduct.get(row.product_id).profile;
      phase.push({ en: note.name_en || '', ar: note.name_ar || note.name_en || '' });
    });
    const relatedByProduct = new Map();
    (relationRows || []).forEach((row) => {
      if (!relatedByProduct.has(row.product_id)) relatedByProduct.set(row.product_id, []);
      relatedByProduct.get(row.product_id).push(row.related_product_id);
    });

    const dynamicProducts = rows.map((row) => {
      const fallback = fallbackById.get(row.id) || {};
      const prices = Object.fromEntries((row.product_prices || []).map((price) => [price.size, Number(price.price) || 0]));
      const sizes = Object.keys(prices).sort((left, right) => {
        const numericDifference = Number.parseFloat(left) - Number.parseFloat(right);
        return Number.isFinite(numericDifference) && numericDifference !== 0
          ? numericDifference
          : left.localeCompare(right);
      });
      const notes = notesByProduct.get(row.id) || { top: [], heart: [], base: [], profile: [] };
      const images = (row.product_images || []).slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      const primary = images.find((image) => image.is_primary) || images[0];
      const primaryUrl = storefrontImageUrl(primary && (primary.public_url || primary.fallback_url));
      if (primaryUrl) {
        const fallbackPng = storefrontImageUrl(primary.fallback_url) || primaryUrl;
        productImages[row.id] = {
          webp: primary.mime_type === 'image/webp' ? primaryUrl : (productImages[row.id]?.webp || primaryUrl),
          png: fallbackPng
        };
      }
      const badges = [
        row.gender_identity === 'for_her' ? 'For Her' : row.gender_identity === 'for_him' ? 'For Him' : row.gender_identity === 'duo' ? 'Duo Box' : row.brand,
        row.type === 'extrait' ? 'Extrait 28%' : row.type === 'spray' || row.type === 'mist' ? 'Body Spray' : row.type === 'cream' ? 'Body Cream' : row.type === 'set' || row.type === 'sets' ? 'Gift Set' : titleCaseForCatalog(row.type),
        row.featured_on_home ? 'Best Seller' : ''
      ].filter(Boolean);
      const giftMessage = row.gift_ready_message || '';
      productMerchandising[row.id] = {
        ...(productMerchandising[row.id] || {}),
        badges,
        profile: row.scent_profile || row.desc_en || '',
        who: row.who_it_is_for || '',
        how: row.how_to_wear || '',
        pairIds: relatedByProduct.get(row.id) || [],
        ...(giftMessage ? { gift: { title: 'Gift-ready presentation', copy: giftMessage, bullets: ['Prepared with care', 'Luxury presentation', 'Concierge ordering'] } } : {})
      };
      return {
        ...fallback,
        id: row.id,
        brand: row.brand,
        type: row.type === 'set' ? 'sets' : row.type,
        nameEn: row.name_en,
        nameAr: row.name_ar || row.name_en,
        familyEn: row.family_en || row.concentration || '',
        familyAr: row.family_ar || row.family_en || row.concentration || '',
        descEn: row.desc_en || '',
        descAr: row.desc_ar || row.desc_en || '',
        sizes: sizes.length ? sizes : (fallback.sizes || []),
        prices: sizes.length ? prices : (fallback.prices || {}),
        heroSize: sizes.includes(row.hero_size) ? row.hero_size : (sizes[0] || fallback.heroSize),
        pyramid: {
          topEn: notes.top.map((note) => note.en).join(' · ') || fallback.pyramid?.topEn || '',
          topAr: notes.top.map((note) => note.ar).join(' · ') || fallback.pyramid?.topAr || '',
          heartEn: notes.heart.map((note) => note.en).join(' · ') || fallback.pyramid?.heartEn || '',
          heartAr: notes.heart.map((note) => note.ar).join(' · ') || fallback.pyramid?.heartAr || '',
          baseEn: notes.base.map((note) => note.en).join(' · ') || fallback.pyramid?.baseEn || '',
          baseAr: notes.base.map((note) => note.ar).join(' · ') || fallback.pyramid?.baseAr || ''
        },
        wearEn: row.how_to_wear || fallback.wearEn || '',
        wearAr: fallback.wearAr || row.how_to_wear || '',
        badgeEn: row.badge_en || fallback.badgeEn || '',
        badgeAr: row.badge_ar || row.badge_en || fallback.badgeAr || '',
        admin: { isActive: true, featuredOnHome: Boolean(row.featured_on_home), sortOrder: Number(row.sort_order) || 0 }
      };
    }).filter((product) => product.sizes.length && Object.keys(product.prices).length);

    if (!dynamicProducts.length) {
      document.documentElement.dataset.catalogSource = 'fallback';
      return false;
    }
    products.splice(0, products.length, ...dynamicProducts);
    syncCartWithCatalog();
    document.documentElement.dataset.catalogSource = 'supabase';
    return true;
  } catch (error) {
    document.documentElement.dataset.catalogSource = 'fallback';
    document.documentElement.dataset.catalogError = String(error?.message || 'request-failed').slice(0, 160);
    return false;
  }
}

function titleCaseForCatalog(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderProductPhoto(productOrId, options = {}) {
  const product = typeof productOrId === 'string' ? getProductById(productOrId) : productOrId;
  if (!product) return '';

  const sources = productImages[product.id];
  if (!sources) return product.visualSvg || '';

  const name = state.lang === 'ar' ? product.nameAr : product.nameEn;
  const loading = options.eager ? 'eager' : 'lazy';
  const fetchPriority = options.eager ? ' fetchpriority="high"' : '';
  const className = options.wide ? 'product-photo product-photo-wide' : 'product-photo';

  return `
    <picture class="product-photo-frame">
      <source srcset="${sources.webp}" type="image/webp">
      <img class="${className}" src="${sources.png}" alt="${name}" width="1200" height="1200" loading="${loading}" decoding="async"${fetchPriority}>
    </picture>
  `;
}

const productMerchandising = {
  'samr-extrait': {
    badges: ['For Her', 'Best Seller', 'Extrait 28%'],
    profile: 'A gourmand amber floral built around warm fruit, white flowers, double vanilla, tonka, and soft skin musks.',
    who: 'For evening presence, intimate gifting, and anyone who wants softness to feel unforgettable.',
    how: 'Apply one to three sprays on pulse points. For a longer, softer trail, prepare the skin with SAMR Body Cream first.',
    pairIds: ['samr-cream', 'samr-spray']
  },
  'asmr-extrait': {
    badges: ['For Him', 'Best Seller', 'Extrait 28%'],
    profile: 'A woody amber skin scent with citrus lift, radiant jasmine, sandalwood, cedar, ambergris, and a five-musk trail.',
    who: 'For quiet confidence, tailored nights, and a polished signature that stays close without shouting.',
    how: 'Spray once on the chest and once at the neck. Add one wrist spray when you want more projection.',
    pairIds: ['asmr-cream', 'asmr-spray']
  },
  'samr-spray': {
    badges: ['For Her', 'Body Spray', 'Layering'],
    profile: 'A lighter full-body mist that carries the peach, jasmine, vanilla, and tonka mood of SAMR.',
    who: 'For daily refresh, after-shower softness, and warm weather moments where extrait feels too formal.',
    how: 'Mist generously over body and clothes, then add SAMR Extrait on pulse points for a complete trail.',
    pairIds: ['samr-extrait', 'samr-cream']
  },
  'asmr-spray': {
    badges: ['For Him', 'Body Spray', 'Layering'],
    profile: 'A crisp body mist shaped around citrus, cedarwood, sandalwood, amber, and clean musk.',
    who: 'For everyday use, gym bag refresh, and layering under the darker ASMR extrait.',
    how: 'Spray across chest, shoulders, and shirt after showering. Finish with ASMR Extrait for depth.',
    pairIds: ['asmr-extrait', 'asmr-cream']
  },
  'samr-cream': {
    badges: ['For Her', 'Body Cream', 'Layering'],
    profile: 'A rich cream scented with SAMR facets of double vanilla, tonka, jasmine, and soft woods.',
    who: 'For hydrated skin, softer projection, and a closer fragrance aura before the extrait.',
    how: 'Massage into warm skin after bathing, especially wrists, neck, shoulders, and arms.',
    pairIds: ['samr-extrait', 'samr-spray']
  },
  'asmr-cream': {
    badges: ['For Him', 'Body Cream', 'Layering'],
    profile: 'A nourishing cream with the ASMR mood of sandalwood, amber, cedar, soft leather, and musk.',
    who: 'For a smooth base layer before fragrance and a subtle skin scent on quieter days.',
    how: 'Apply to chest, hands, arms, and neck before ASMR Body Spray or Extrait.',
    pairIds: ['asmr-extrait', 'asmr-spray']
  },
  'discovery-set': {
    badges: ['Discovery', 'Gift Set', 'First Purchase'],
    profile: 'A low-friction way to compare both house signatures before choosing a full bottle.',
    who: 'For first-time buyers, couples comparing both scents, and gift shoppers who want certainty.',
    how: 'Test each vial on clean skin on separate days. Let the drydown settle before deciding.',
    pairIds: ['samr-extrait', 'asmr-extrait'],
    gift: {
      title: 'A refined first encounter',
      copy: 'The discovery set makes the purchase feel personal before committing to a full bottle or coffret.',
      bullets: ['Two extrait samples', 'Ideal first order', 'Easy to gift or compare']
    }
  },
  'duo-box': {
    badges: ['Gift Set', 'Duo Box', 'Best Gift'],
    profile: 'The complete house pairing: ASMR and SAMR in one premium coffret for a shared signature story.',
    who: 'For couples, weddings, anniversaries, Eid gifting, and anyone buying the house concept as a complete set.',
    how: 'Wear each scent individually, or layer one spray of each for a warmer shared evening aura.',
    pairIds: ['samr-trio', 'asmr-trio'],
    gift: {
      title: 'Premium gift-ready coffret',
      copy: 'The hero gifting product: two complementary extrait bottles presented as one polished luxury gesture.',
      bullets: ['Two 50 ml extrait bottles', 'Premium presentation box', 'Concierge WhatsApp ordering']
    }
  },
  'samr-trio': {
    badges: ['For Her', 'Ritual Set', 'Gift Set'],
    profile: 'A complete SAMR layering ritual: cream for softness, spray for freshness, extrait for lasting presence.',
    who: 'For her full fragrance routine, bridal gifting, and buyers who want the scent to feel complete.',
    how: 'Start with cream, mist with body spray, then finish with extrait on pulse points.',
    pairIds: ['samr-extrait', 'duo-box'],
    gift: {
      title: 'A complete ritual for her',
      copy: 'The trio turns one perfume into a full-body ritual with a more polished, longer-lasting impression.',
      bullets: ['Cream, spray, and extrait', 'Layered SAMR signature', 'Ready for premium gifting']
    }
  },
  'asmr-trio': {
    badges: ['For Him', 'Ritual Set', 'Gift Set'],
    profile: 'A complete ASMR layering ritual: cream for the base, spray for coverage, extrait for quiet confidence.',
    who: 'For his full routine, refined gifting, and buyers who want the darker ASMR signature to last longer.',
    how: 'Apply cream first, spray across the body, then finish with extrait at the neck and chest.',
    pairIds: ['asmr-extrait', 'duo-box'],
    gift: {
      title: 'A complete ritual for him',
      copy: 'The trio builds ASMR from skin to scent trail, making it stronger as a daily routine or gift.',
      bullets: ['Cream, spray, and extrait', 'Layered ASMR signature', 'Ready for premium gifting']
    }
  }
};

const shopUiCopy = {
  en: {
    shopIntro: 'Two energies. One signature. Choose a single scent, build a ritual, or gift the complete house pairing.',
    summaryRange: 'Extrait, body, and ritual sets',
    summaryGift: 'Gift-ready packaging',
    details: 'Details',
    from: 'From ',
    backToCollection: 'Back to Collection',
    conciergeOrder: 'Concierge order',
    reserveCopy: 'Reserve this selection by cart or send the exact product and size directly on WhatsApp.',
    productProfile: 'Product profile',
    skinTitle: 'How it lives on skin',
    scentProfile: 'Scent profile',
    whoFor: 'Who it is for',
    notesProfile: 'Notes profile',
    notesTitle: 'Top, heart, and base',
    bestPaired: 'Best paired with',
    fullRitual: 'Build the full ritual',
    giftReady: 'Gift-ready'
  },
  ar: {
    shopIntro: 'طاقتان متكاملتان. توقيع واحد. اختر عطراً منفرداً، أو ابنِ طقساً كاملاً، أو قدّم ثنائية الدار كهدية فاخرة.',
    summaryRange: 'مستخلصات، منتجات جسم، ومجموعات طقوس',
    summaryGift: 'تغليف جاهز للإهداء',
    details: 'التفاصيل',
    from: 'ابتداءً من ',
    backToCollection: 'العودة إلى المجموعة',
    conciergeOrder: 'طلب مباشر',
    reserveCopy: 'احجز هذا الاختيار عبر السلة أو أرسل المنتج والحجم مباشرة على واتساب.',
    productProfile: 'ملف المنتج',
    skinTitle: 'كيف يعيش على البشرة',
    scentProfile: 'الملف العطري',
    whoFor: 'لمن يناسب',
    notesProfile: 'النغمات العطرية',
    notesTitle: 'المقدمة والقلب والقاعدة',
    bestPaired: 'ينسجم مع',
    fullRitual: 'ابنِ الطقس الكامل',
    giftReady: 'جاهز للإهداء'
  }
};

const badgeTranslationsAr = {
  'For Her': 'لها',
  'For Him': 'له',
  'Best Seller': 'الأكثر طلباً',
  'Extrait 28%': 'مستخلص ٢٨٪',
  'Body Spray': 'بخاخ الجسم',
  'Body Cream': 'كريم الجسم',
  'Layering': 'للطبقات',
  'Discovery': 'اكتشاف',
  'Gift Set': 'هدية',
  'First Purchase': 'أول تجربة',
  'Duo Box': 'صندوق ثنائي',
  'Best Gift': 'أفضل هدية',
  'Ritual Set': 'طقس كامل'
};

function uiText(key) {
  const lang = state.lang === 'ar' ? 'ar' : 'en';
  return shopUiCopy[lang][key] || shopUiCopy.en[key] || key;
}

function translateBadgeLabel(label) {
  return state.lang === 'ar' ? (badgeTranslationsAr[label] || label) : label;
}

function getProductMerchandising(product) {
  return productMerchandising[product.id] || {
    badges: [product.brand, product.type],
    profile: state.lang === 'ar' ? product.descAr : product.descEn,
    who: 'For customers who want a refined daily scent with a polished small-batch feel.',
    how: state.lang === 'ar' ? product.wearAr : product.wearEn,
    pairIds: []
  };
}

function getMerchCopy(product, key) {
  const merchandising = getProductMerchandising(product);
  if (state.lang !== 'ar') return merchandising[key];
  if (key === 'profile') return product.descAr;
  if (key === 'how') return product.wearAr;
  if (key === 'who') {
    if (product.id === 'duo-box') return 'للأزواج، والمناسبات، والهدايا التي تحتاج إلى حضور فاخر ومتكامل.';
    if (product.id === 'discovery-set') return 'لمن يريد تجربة التوقيعين قبل اختيار الزجاجة الكاملة.';
    if (product.id.includes('trio')) return 'لمن يريد طقساً عطرياً كاملاً يدوم من البشرة إلى الأثر الأخير.';
    if (product.brand === 'SAMR') return 'لها، للحضور الناعم الذي يبقى قريباً ولا يُنسى.';
    if (product.brand === 'ASMR') return 'له، لحضور هادئ وواثق يترك أثراً نظيفاً على البشرة.';
  }
  return merchandising[key];
}

function getProductFacts(product) {
  if (state.lang === 'ar') {
    if (product.type === 'extrait') {
      return ['تركيز مستخلص ٢٨٪', 'تعبئة يدوية بالوزن', 'تعتيق ٤-٨ أسابيع', 'دفعات صغيرة مرقمة'];
    }
    if (product.type === 'spray') {
      return ['بخاخ جسم ١٠٠ مل', 'انتعاش يومي', 'مصمم للطبقات', 'دفعة صغيرة'];
    }
    if (product.type === 'cream') {
      return ['كريم جسم ١٠٠ غ', 'قاعدة مرطبة للعطر', 'يستخدم قبل العطر', 'لمسة بشرة ناعمة'];
    }
    if (product.id === 'duo-box') {
      return ['زجاجتان ٥٠ مل', 'صندوق فاخر', 'له ولها', 'جاهز للإهداء'];
    }
    if (product.id.includes('trio')) {
      return ['طقس من ثلاث خطوات', 'كريم وبخاخ ومستخلص', 'ثبات بطبقات', 'مجموعة إهداء'];
    }
    return ['عينتان من المستخلص', 'مناسب لأول تجربة', 'مقارنة سهلة', 'جاهز للإهداء'];
  }

  if (product.type === 'extrait') {
    return ['28% extrait concentration', 'Hand-filled by weight', 'Macerated 4-8 weeks', 'Numbered small batch'];
  }
  if (product.type === 'spray') {
    return ['100 ml body mist', 'Daily refresh layer', 'Designed for layering', 'Small-batch finish'];
  }
  if (product.type === 'cream') {
    return ['100 g body cream', 'Hydrating scent base', 'Layer before fragrance', 'Soft skin finish'];
  }
  if (product.id === 'duo-box') {
    return ['Two 50 ml extraits', 'Premium coffret', 'His and hers pairing', 'Gift-ready order'];
  }
  if (product.id.includes('trio')) {
    return ['Three-step ritual', 'Cream, spray, extrait', 'Layered longevity', 'Gift-ready set'];
  }
  return ['Two extrait samples', 'First-purchase friendly', 'Easy scent comparison', 'Gift-ready discovery'];
}

function getProductStartSize(product) {
  return product.heroSize || product.sizes[0];
}

function getProductStartPrice(product) {
  return product.prices[getProductStartSize(product)];
}

function getProductFamily(product) {
  return state.lang === 'ar' ? product.familyAr : product.familyEn;
}

function getBrandAccentClass(product) {
  if (product.brand === 'SAMR') return 'badge-samr';
  if (product.brand === 'ASMR') return 'badge-asmr';
  return 'badge-duo';
}

function renderLuxuryBadges(product, className = '') {
  const merchandising = getProductMerchandising(product);
  const accent = getBrandAccentClass(product);
  return `
    <div class="luxury-badge-row ${className}">
      ${merchandising.badges.map(badge => `<span class="luxury-badge ${accent}">${translateBadgeLabel(badge)}</span>`).join('')}
    </div>
  `;
}

function renderShopProductCard(product) {
  const name = state.lang === 'ar' ? product.nameAr : product.nameEn;
  const facts = getProductFacts(product).slice(0, 2);
  const startSize = getProductStartSize(product);
  const startPrice = getProductStartPrice(product);
  const priceLead = product.sizes.length > 1 ? uiText('from') : '';

  return `
    <article class="product-card shop-product-card">
      ${renderLuxuryBadges(product, 'shop-card-badges')}
      <a href="#/product/${product.id}" class="product-card-main" aria-label="${name} - ${state.lang === 'ar' ? 'View product details' : 'View product details'}">
        <div class="product-card-visual shop-card-visual">
          ${renderProductPhoto(product)}
        </div>
        <div class="product-card-copy">
          <span class="brand-tag">${product.brand} / ${getProductFamily(product)}</span>
          <h3 class="product-name">${name}</h3>
          <p class="product-desc">${getMerchCopy(product, 'profile')}</p>
          <div class="shop-card-facts">
            ${facts.map(fact => `<span>${fact}</span>`).join('')}
          </div>
        </div>
      </a>
      <div class="card-action-row shop-card-action-row">
        <div class="product-price">
          ${priceLead}${startPrice} ${t('sar')}
          <small>/ ${startSize}</small>
        </div>
        <div class="shop-card-buttons">
          <button type="button" class="card-cart-btn" onclick="addToCart('${product.id}', '${startSize}', ${startPrice})">${t('add_to_cart')}</button>
          <a href="#/product/${product.id}" class="card-detail-link">${uiText('details')}</a>
        </div>
      </div>
    </article>
  `;
}

function renderPairingSection(product) {
  const merchandising = getProductMerchandising(product);
  const pairedProducts = (merchandising.pairIds || [])
    .map(productId => getProductById(productId))
    .filter(Boolean);

  if (!pairedProducts.length) return '';

  return `
    <section class="detail-section pairing-section" aria-label="Best paired with">
      <div class="detail-section-heading">
        <span class="editorial-sub">${uiText('bestPaired')}</span>
        <h2 class="serif-display">${uiText('fullRitual')}</h2>
      </div>
      <div class="pairing-grid">
        ${pairedProducts.map(pair => {
          const pairName = state.lang === 'ar' ? pair.nameAr : pair.nameEn;
          return `
            <a href="#/product/${pair.id}" class="pairing-card" aria-label="View ${pairName}">
              <div class="pairing-visual">${renderProductPhoto(pair)}</div>
              <div>
                ${renderLuxuryBadges(pair, 'pairing-badges')}
                <h3 class="serif-display">${pairName}</h3>
                <p>${getMerchCopy(pair, 'profile')}</p>
                <span class="pairing-price">${getProductStartPrice(pair)} ${t('sar')}</span>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderGiftReadySection(product) {
  let gift = getProductMerchandising(product).gift;
  if (!gift) return '';
  if (state.lang === 'ar') {
    if (product.id === 'duo-box') {
      gift = {
        title: 'صندوق فاخر جاهز للإهداء',
        copy: 'المنتج الأهم للإهداء: زجاجتان متكاملتان في صندوق واحد يقدم فكرة الدار كاملة.',
        bullets: ['زجاجتان مستخلص عطر ٥٠ مل', 'تقديم فاخر', 'طلب مباشر عبر واتساب']
      };
    } else if (product.id.includes('trio')) {
      gift = {
        title: product.brand === 'SAMR' ? 'طقس كامل لها' : 'طقس كامل له',
        copy: 'تجمع المجموعة بين الكريم والبخاخ والمستخلص لتجربة عطرية أطول وأكثر اكتمالاً.',
        bullets: ['كريم وبخاخ ومستخلص', 'توقيع عطري بطبقات', 'مناسبة للإهداء الفاخر']
      };
    } else {
      gift = {
        title: 'تجربة أولى راقية',
        copy: 'طريقة سهلة لاكتشاف توقيعي الدار قبل اختيار الزجاجة الكاملة أو صندوق الإهداء.',
        bullets: ['عينتان من المستخلص', 'مناسب لأول طلب', 'سهل التجربة والإهداء']
      };
    }
  }

  return `
    <section class="gift-ready-panel" aria-label="Gift-ready presentation">
      <div>
        <span class="editorial-sub">${uiText('giftReady')}</span>
        <h2 class="serif-display">${gift.title}</h2>
        <p>${gift.copy}</p>
      </div>
      <div class="gift-ready-points">
        ${gift.bullets.map((bullet, index) => `
          <div class="gift-ready-point">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <p>${bullet}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderUpgradedShop(filterType = 'all') {
  let filtered = getPublicProducts();
  if (filterType !== 'all') {
    filtered = filtered.filter(p => p.type === filterType);
  }

  const catalogHtml = filtered.map(renderShopProductCard).join('');

  return `
    <div class="brand-page-container shop-page-upgraded">
      <section class="container-custom section-padding" aria-label="Fragrances Catalog">
        <div class="shop-intro">
          <span class="editorial-sub">${t('nav_shop')}</span>
          <h1 class="serif-display">${state.lang === 'ar' ? 'المجموعة العطرية' : 'The Scent Collection'}</h1>
          <p>${uiText('shopIntro')}</p>
        </div>

        <div class="shop-summary-bar" aria-label="Shop highlights">
          <span>${uiText('summaryRange')}</span>
          <span>${uiText('summaryGift')}</span>
          <span>${t('vat_note')}</span>
        </div>

        <div class="shop-filters upgraded-shop-filters" aria-label="Filter Fragrances">
          <button class="filter-btn ${filterType === 'all' ? 'active' : ''}" aria-pressed="${filterType === 'all'}" onclick="window.location.hash = '#/shop'">${t('filter_all')}</button>
          <button class="filter-btn ${filterType === 'extrait' ? 'active' : ''}" aria-pressed="${filterType === 'extrait'}" onclick="window.location.hash = '#/shop/extrait'">${t('filter_extrait')}</button>
          <button class="filter-btn ${filterType === 'spray' ? 'active' : ''}" aria-pressed="${filterType === 'spray'}" onclick="window.location.hash = '#/shop/spray'">${t('filter_spray')}</button>
          <button class="filter-btn ${filterType === 'cream' ? 'active' : ''}" aria-pressed="${filterType === 'cream'}" onclick="window.location.hash = '#/shop/cream'">${t('filter_cream')}</button>
          <button class="filter-btn ${filterType === 'sets' ? 'active' : ''}" aria-pressed="${filterType === 'sets'}" onclick="window.location.hash = '#/shop/sets'">${t('filter_sets')}</button>
        </div>

        <div class="catalog-grid upgraded-catalog-grid">
          ${catalogHtml}
        </div>
      </section>
    </div>
  `;
}

function renderUpgradedProductDetail(productId) {
  const product = getProductById(productId);
  if (!product) {
    return `<div class="brand-page-container"><section class="container-custom section-padding">Product not found.</section></div>`;
  }

  // Preload product primary image WebP
  const sources = productImages[product.id];
  if (sources && sources.webp) {
    preloadHeroImage(sources.webp);
  }

  const name = state.lang === 'ar' ? product.nameAr : product.nameEn;
  const desc = state.lang === 'ar' ? product.descAr : product.descEn;
  const merchandising = getProductMerchandising(product);
  const facts = getProductFacts(product);
  const profileCopy = getMerchCopy(product, 'profile');

  if (!state.selectedSize[productId]) {
    state.selectedSize[productId] = getProductStartSize(product);
  }

  const activeSize = state.selectedSize[productId];
  const price = product.prices[activeSize];
  const sizePillsHtml = product.sizes.map(size => `
    <button class="size-pill ${size === activeSize ? 'active' : ''}" aria-label="Select size ${size}" onclick="selectProductSize('${productId}', '${size}')">
      ${size}
    </button>
  `).join('');

  return `
    <div class="brand-page-container product-detail-page-upgraded">
      <section class="container-custom section-padding" aria-label="Product detail: ${name}">
        <a href="#/shop" class="detail-back-link">&larr; ${uiText('backToCollection')}</a>

        <div class="product-detail-grid upgraded-product-detail-grid">
          <div class="product-gallery product-gallery-upgraded">
            ${renderProductPhoto(product, { eager: true })}
          </div>

          <div class="product-detail-copy">
            <div class="detail-kicker-row">
              <span class="brand-tag">${product.brand}</span>
              <span class="badge badge-preorder" style="border: 1px solid var(--gold); color: var(--gold); padding: 0.2rem 0.5rem; font-size: 0.7rem; font-family: var(--font-sans); letter-spacing: 0.05em; font-weight: 500; text-transform: uppercase;">
                ${state.lang === 'ar' ? 'حجز مسبق' : 'PRE-ORDER'}
              </span>
              ${renderLuxuryBadges(product, 'detail-badges')}
            </div>

            <h1 class="serif-display product-detail-title">${name}</h1>
            <p class="product-detail-family">${getProductFamily(product)}</p>

            <div class="detail-price-row">
              <span class="serif-display">${price} ${t('sar')}</span>
              <small>/ ${activeSize}</small>
            </div>

            <!-- Pre-order Counter Visual -->
            <div class="preorder-counter-row" style="display: flex; align-items: center; gap: 0.6rem; margin: 1rem 0 1.5rem; font-size: 0.85rem; color: var(--gold); font-weight: 300; font-family: var(--font-sans); letter-spacing: 0.05em;">
              <span class="pulsing-gold-dot" style="display: inline-block; width: 6px; height: 6px; background-color: var(--gold); border-radius: 50%; box-shadow: 0 0 0 rgba(166,138,86, 0.4); animation: pulse-gold 2s infinite;"></span>
              <span>${state.lang === 'ar' ? `الدفعة B.077 · تم حجز ${CONFIG.RESERVED_COUNT} من أصل 158 زجاجة` : `Batch B.077 · ${CONFIG.RESERVED_COUNT} of 158 bottles reserved`}</span>
            </div>

            <p class="product-detail-lede">${desc}</p>
            ${profileCopy && profileCopy !== desc ? `<p class="product-detail-profile">${profileCopy}</p>` : ''}

            <div class="product-trust-grid">
              ${facts.map(fact => `<span>${fact}</span>`).join('')}
            </div>

            <div class="variant-selector">
              <span class="variant-label">${t('size')}</span>
              <div class="size-pills">
                ${sizePillsHtml}
              </div>
            </div>

            <div class="detail-cta-panel">
              <div>
                <span class="editorial-sub">${uiText('conciergeOrder')}</span>
                <p>${uiText('reserveCopy')}</p>
              </div>
              <div class="detail-cta-actions">
                <button class="btn btn-primary" onclick="addToCart('${product.id}', '${activeSize}', ${price})">
                  ${t('add_to_cart')}
                </button>
                <button type="button" class="btn btn-outline account-wish-toggle ${getWishlist().includes(product.id) ? 'is-saved' : ''}" onclick="toggleWishlist('${product.id}')" aria-pressed="${getWishlist().includes(product.id)}">
                  ${getWishlist().includes(product.id) ? t('wishlist_saved') : t('wishlist_add')}
                </button>
                <button class="btn btn-outline" onclick="openPreorderModal('${product.id}', '${activeSize}', ${price})">
                  ${state.lang === 'ar' ? 'احجز من الدفعة B.077' : 'Reserve from Batch B.077'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <section class="detail-section product-profile-section" aria-label="Scent profile and usage">
          <div class="detail-section-heading">
            <span class="editorial-sub">${uiText('productProfile')}</span>
            <h2 class="serif-display">${uiText('skinTitle')}</h2>
          </div>
          <div class="profile-grid">
            <article class="profile-card profile-card-large">
              <span>${uiText('scentProfile')}</span>
              <p>${getMerchCopy(product, 'profile')}</p>
            </article>
            <article class="profile-card">
              <span>${uiText('whoFor')}</span>
              <p>${getMerchCopy(product, 'who')}</p>
            </article>
            <article class="profile-card">
              <span>${t('how_to_wear')}</span>
              <p>${getMerchCopy(product, 'how')}</p>
            </article>
          </div>
        </section>

        <section class="detail-section notes-profile-section" aria-label="Notes profile">
          <div class="detail-section-heading">
            <span class="editorial-sub">${uiText('notesProfile')}</span>
            <h2 class="serif-display">${uiText('notesTitle')}</h2>
          </div>
          <div class="notes-grid">
            <article class="note-card">
              <span>${t('top_notes')}</span>
              <p>${state.lang === 'ar' ? product.pyramid.topAr : product.pyramid.topEn}</p>
            </article>
            <article class="note-card">
              <span>${t('heart_notes')}</span>
              <p>${state.lang === 'ar' ? product.pyramid.heartAr : product.pyramid.heartEn}</p>
            </article>
            <article class="note-card">
              <span>${t('base_notes')}</span>
              <p>${state.lang === 'ar' ? product.pyramid.baseAr : product.pyramid.baseEn}</p>
            </article>
          </div>
        </section>

        ${renderPairingSection(product)}
        ${renderGiftReadySection(product)}
      </section>
    </div>
  `;
}

// Localization Dictionary (Proper UTF-8 Arabic)
const translations = {
  en: {
    "nav_home": "Home",
    "nav_samr": "SAMR (For Her)",
    "nav_asmr": "ASMR (For Him)",
    "nav_shop": "Shop",
    "nav_story": "Our Story",
    "nav_gifting": "Gifting",
    "nav_contact": "Contact & Pre-order",
    "account_title": "My Account",
    "account_subtitle": "Your details, orders and wishlist — stored only on this device.",
    "acct_profile": "My Details",
    "acct_name": "Full Name",
    "acct_phone": "WhatsApp Number",
    "acct_save": "Save My Details",
    "acct_saved": "Saved — your future orders will be prefilled automatically.",
    "acct_orders": "My Orders & Reservations",
    "acct_no_orders": "No orders yet — they will appear here after your first WhatsApp order.",
    "acct_resend": "Resend via WhatsApp",
    "acct_status_sent": "Sent via WhatsApp — awaiting confirmation",
    "acct_wishlist": "My Wishlist",
    "acct_no_wishlist": "Your wishlist is empty — save scents you are considering from any product page.",
    "acct_view": "View",
    "acct_remove": "Remove",
    "acct_prefs": "Preferences",
    "acct_lang": "Language",
    "acct_clear": "Clear my data on this device",
    "acct_clear_confirm": "This deletes your saved details, order history and wishlist from this device. Continue?",
    "acct_type_cart": "Cart order",
    "acct_type_buynow": "Direct purchase",
    "acct_type_preorder": "Batch B.077 reservation",
    "wishlist_add": "Save to Wishlist",
    "wishlist_saved": "In Your Wishlist ✓",
    "acct_privacy": "Nothing is uploaded — your details live only in this browser.",
    "house_title": "ASMR & SAMR",
    "house_subtitle": "A HIS & HERS FRAGRANCE HOUSE",
    "house_tagline": `Hand-made in ${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia · Numbered Small Batches`,
    "cta_discover_her": "Discover SAMR (For Her)",
    "cta_discover_him": "Discover ASMR (For Him)",
    "vat_note": `Prices exclude 15% VAT · Hand-filled in ${CONFIG.PRODUCTION_CITY_EN}`,
    "vat_inclusive": "+15% VAT calculated at order checkout",
    "numbered_badge": "Batch B.077 · Small Batch",
    "cart_title": "Your Order Drawer",
    "cart_empty": "Your drawer is empty. Closeness begins with a choice.",
    "add_to_cart": "Add to Cart",
    "order_whatsapp": "Order on WhatsApp",
    "join_list": "Pre-order / Join Waitlist",
    "size": "Select Size / Volume",
    "notes_title": "Scent Notes Structure",
    "top_notes": "Top Notes",
    "heart_notes": "Heart Notes",
    "base_notes": "Base Notes",
    "how_to_wear": "How to Wear",
    "story_title": "Two Scents, One Intimate House",
    "story_founder": "The Founder's Story",
    "story_body1": "A husband built a perfume house around his wife. Her scent, SAMR, was composed to capture closeness after sunset—intimate late-night conversations. It is a scent he cannot forget, clinging to skin and hair with warm gourmand vanilla, peach, and soft musk.",
    "story_body2": `His scent, ASMR, was designed to act as a lingering calling card. It is the silence they remember—a refined woody, five-musk trail that remains in the room long after he has departed. Made in small numbered batches in ${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia.`,
    "story_signature": "Handmade by weight, macerated 4-8 weeks, and numbered by hand.",
    "signature_name": `${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia`,
    "first_batch_banner": "Now taking pre-orders for our first numbered batch. Secure your bottle.",
    "filter_all": "All Catalog",
    "filter_extrait": "Extraits de Parfum",
    "filter_spray": "Body Sprays",
    "filter_cream": "Body Creams",
    "filter_sets": "Gift Boxes & Sets",
    "back_to_shop": "Back to Collection",
    "ingredients_safety": "Ingredients & Patch Safety",
    "ingredients_body": "All formulations strictly comply with IFRA standard guidelines. As we utilize high-density natural absolutes, we advise performing a simple skin patch test on your wrist before full application.",
    "compliance_note": "SFDA compliance in progress. Bottled by hand at source.",
    "preorder_title": "Secure Your Batch Number",
    "preorder_subtitle": "Specify your desired scents and sizes. The master blender will number your bottle upon batch filtration.",
    "label_name": "Your Name",
    "label_email": "Email Address",
    "label_phone": "WhatsApp Phone Number",
    "label_interest": "Fragrance of Interest",
    "label_notes": "Personalization Notes (e.g. Gift Wrapping / Anniversary Date)",
    "submit_preorder": "Reserve My Numbered Bottle",
    "waitlist_success": "Thank you. Your request is registered. We will reach out to you on WhatsApp to confirm.",
    "checkout_text": "Submit Checkout",
    "footer_description": "Small-batch extraits about intimacy — stronger than department-store EDPs, priced below global niche.",
    "footer_made": `Hand-made in ${CONFIG.PRODUCTION_CITY_EN}, Saudi Arabia`,
    "footer_rights": "© 2026 ASMR & SAMR Fragrances. All rights reserved.",
    "quick_links": "Quick Exploration",
    "contact_us": "Contact the House",
    "whatsapp_us": "Message on WhatsApp",
    "instagram": "Follow on Instagram",
    "from_sar": "From SAR",
    "sar": "SAR",
    "size_volume": "Size",
    "pairs_with": "Complementary Pairing",
    "trio_set": "Trio Pack (Extrait + Body Spray + Body Cream)",
    "duo_box_offer": "The His & Hers Duo Box contains both 50ml Extraits.",
    "discovery_set_offer": "2 ml SAMR + 2 ml ASMR. Price fully redeemable against a full bottle.",
    "gifts_subtitle": "Immersive treasures crafted for Eid, weddings, and deep bonds.",
    "samr_tagline": "The scent he cannot forget.",
    "asmr_tagline": "The Silence They Remember.",
    "whatsapp_prelaunch_note": "WhatsApp line to be added before launch",
    "whatsapp_demo_label": "WhatsApp Order Line (Pre-launch Demo)"
  },
  ar: {
    "nav_home": "الرئيسية",
    "nav_samr": "سَمَر (لها)",
    "nav_asmr": "أسمر (له)",
    "nav_shop": "المجموعة",
    "nav_story": "قصتنا",
    "nav_gifting": "الهدايا",
    "nav_contact": "الطلب والحجز المسبق",
    "account_title": "حسابي",
    "account_subtitle": "بياناتك وطلباتك ومفضلتك — محفوظة على هذا الجهاز فقط.",
    "acct_profile": "بياناتي",
    "acct_name": "الاسم الكامل",
    "acct_phone": "رقم الواتساب",
    "acct_save": "حفظ بياناتي",
    "acct_saved": "تم الحفظ — سيتم تعبئة طلباتك القادمة تلقائياً.",
    "acct_orders": "طلباتي وحجوزاتي",
    "acct_no_orders": "لا توجد طلبات بعد — ستظهر هنا بعد أول طلب عبر واتساب.",
    "acct_resend": "إعادة الإرسال عبر واتساب",
    "acct_status_sent": "أُرسل عبر واتساب — بانتظار التأكيد",
    "acct_wishlist": "المفضلة",
    "acct_no_wishlist": "قائمتك فارغة — احفظ العطور التي تفكر بها من صفحة أي منتج.",
    "acct_view": "عرض",
    "acct_remove": "إزالة",
    "acct_prefs": "التفضيلات",
    "acct_lang": "اللغة",
    "acct_clear": "مسح بياناتي من هذا الجهاز",
    "acct_clear_confirm": "سيتم حذف بياناتك وسجل طلباتك والمفضلة من هذا الجهاز. هل تريد المتابعة؟",
    "acct_type_cart": "طلب سلة",
    "acct_type_buynow": "شراء مباشر",
    "acct_type_preorder": "حجز من الدفعة B.077",
    "wishlist_add": "حفظ في المفضلة",
    "wishlist_saved": "في المفضلة ✓",
    "acct_privacy": "لا يتم رفع أي شيء — بياناتك محفوظة في هذا المتصفح فقط.",
    "house_title": "أسمر وسَمَر",
    "house_subtitle": "دار العطور للرجل والمرأة",
    "house_tagline": `صُنع يدوياً في ${CONFIG.PRODUCTION_CITY_AR}، المملكة العربية السعودية · دفعات صغيرة مرقمة`,
    "cta_discover_her": "اكتشف عطر سَمَر (لها)",
    "cta_discover_him": "اكتشف عطر أسمر (له)",
    "vat_note": `الأسعار لا تشمل ضريبة القيمة المضافة ١٥٪ · عُبئ يدوياً في ${CONFIG.PRODUCTION_CITY_AR}`,
    "vat_inclusive": "+١٥٪ ضريبة قيمة مضافة تُحسب عند تأكيد الطلب",
    "numbered_badge": "\u062F\u0641\u0639\u0629 \u0660\u0667\u0667 \u00B7 \u062F\u0641\u0639\u0629 \u0635\u063A\u064A\u0631\u0629",
    "cart_title": "حقيبة الطلبات الخاصة بك",
    "cart_empty": "حقيبتك فارغة. يبدأ القرب بخطوة اختيار.",
    "add_to_cart": "إضافة إلى الحقيبة",
    "order_whatsapp": "اطلب عبر واتساب",
    "join_list": "حجز مسبق / الانضمام للقائمة",
    "size": "اختر الحجم / الوزن",
    "notes_title": "الهيكل العطري للعطر",
    "top_notes": "المكونات العليا (القمة)",
    "heart_notes": "المكونات الوسطى (القلب)",
    "base_notes": "المكونات الأساسية (القاعدة)",
    "how_to_wear": "طريقة الارتداء العطري",
    "story_title": "عطران، دار عطور حميمية واحدة",
    "story_founder": "قصة التأسيس للدار",
    "story_body1": "أسس زوج دار عطور فاخرة حول زوجته. عطرها، سَمَر، صُمم خصيصاً ليوثق لحظات القرب بعد غروب الشمس - الأحاديث الليلية الحميمية. إنها رائحة لا يمكنه نسيانها، تعبق على البشرة والشعر بنغمات الفانيليا المزدوجة، الدراق والمسك الناعم.",
    "story_body2": `أما عطره، أسمر، فصُنع ليكون أثراً عطرياً مميزاً يعلن عن وجوده. الصمت الذي يتذكرونه - هالة خشبية دافئة تعتمد على خمس نغمات مسك فريدة تظل عالقة في أرجاء المكان طويلاً بعد رحيله. صُنعت بدفعات مرقمة في ${CONFIG.PRODUCTION_CITY_AR}.`,
    "story_signature": "صُنعت يدوياً بالوزن، عُتقت من ٤ إلى ٨ أسابيع، ورُقمت يدوياً.",
    "signature_name": `${CONFIG.PRODUCTION_CITY_AR}، المملكة العربية السعودية`,
    "first_batch_banner": "نستقبل الآن الحجوزات المسبقة لدفعتنا الأولى المرقمة. احجز زجاجتك الخاصة.",
    "filter_all": "كافة المنتجات",
    "filter_extrait": "مستخلصات العطور الفاخرة",
    "filter_spray": "بخاخات الجسم",
    "filter_cream": "كريمات الجسم المعطرة",
    "filter_sets": "علب الهدايا والمجموعات",
    "back_to_shop": "العودة إلى المجموعة",
    "ingredients_safety": "المكونات وسلامة البشرة",
    "ingredients_body": "جميع تركيباتنا تتوافق بدقة مع معايير الجمعية الدولية للعطور (IFRA). نظراً لاستخدامنا لمستخلصات طبيعية عالية التركيز، ننصح بإجراء اختبار رقعة جلدي بسيط على المعصم قبل الاستخدام الكامل.",
    "compliance_note": "مطابقة الهيئة العامة للغذاء والدواء قيد المتابعة. تُعبأ يدوياً في المصدر.",
    "preorder_title": "اضمن رقم دفعتك الخاصة",
    "preorder_subtitle": "حدد العطور والأحجام التي تفضلها. سيقوم صانع العطور بترقيم زجاجتك يدوياً فور تصفية الدفعة العطرية.",
    "label_name": "الاسم الكامل",
    "label_email": "البريد الإلكتروني",
    "label_phone": "رقم الواتساب للتواصل",
    "label_interest": "العطر المطلوب",
    "label_notes": "ملاحظات إضافية (مثل: تغليف هدايا / كتابة تاريخ خاص)",
    "submit_preorder": "احجز زجاجتي المرقمة الآن",
    "waitlist_success": "شكراً لك. تم تسجيل طلبك بنجاح. سنتواصل معك عبر واتساب قريباً لتأكيد طلبك.",
    "checkout_text": "تأكيد وإرسال الطلب",
    "footer_description": "مستخلصات عطور مركزة مرقمة تركز على الجاذبية والحميمية — أقوى تركيزاً من عطور المتاجر العادية وبأسعار مناسبة.",
    "footer_made": `صُنعت يدوياً في ${CONFIG.PRODUCTION_CITY_AR}، المملكة العربية السعودية`,
    "footer_rights": "© ٢٠٢٦ عطور أسمر وسَمَر. جميع الحقوق محفوظة.",
    "quick_links": "استكشاف سريع للدار",
    "contact_us": "التواصل مع الدار",
    "whatsapp_us": "تواصل معنا عبر واتساب",
    "instagram": "تابعنا على إنستغرام",
    "from_sar": "تبدأ من ريال",
    "sar": "ريال سعودي",
    "size_volume": "الحجم",
    "pairs_with": "تكامل عطري مقترح",
    "trio_set": "المجموعة الثلاثية (عطر + بخاخ + كريم)",
    "duo_box_offer": "صندوق الثنائي يحتوي على زجاجتين بحجم ٥٠ مل لكل من أسمر وسَمَر.",
    "discovery_set_offer": "عينتان بحجم ٢ مل لكل من سَمَر وأسمر. القيمة مستردة بالكامل عند الشراء الرديف.",
    "gifts_subtitle": "تحف عطرية غنية مصممة للأعياد، حفلات الزواج، والمناسبات الغالية.",
    "samr_tagline": "الرائحة التي لا يستطيع نسيانها.",
    "asmr_tagline": "الصمت الذي يتذكرونه.",
    "whatsapp_prelaunch_note": "رقم الواتساب سيضاف قبل الإطلاق",
    "whatsapp_demo_label": "خط طلبات واتساب (عرض ما قبل الإطلاق)"
  }
};

// Helper function to translate static keys
function t(key) {
  const langData = translations[state.lang] || translations.en;
  return langData[key] || key;
}

// Router Management
function initRouter() {
  window.addEventListener('hashchange', () => {
    state.currentRoute = window.location.hash || '#/';
    renderApp();
    window.scrollTo(0, 0);
  });
}

function navigateTo(hash) {
  window.location.hash = hash;
}

// Local Storage Cart Helpers
function saveCart() {
  localStorage.setItem('asmr_samr_cart', JSON.stringify(state.cart));
  updateCartBadge();
  announceToScreenReader(state.lang === 'ar' ? 'تم تحديث السلة' : 'Cart updated');
}

function announceToScreenReader(message) {
  const announcer = document.getElementById('a11y-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
}

function syncCartWithCatalog() {
  const before = JSON.stringify(state.cart);
  state.cart = state.cart
    .map(item => {
      const product = getProductById(item.id);
      if (!product || !product.sizes.includes(item.size)) return null;
      const currentPrice = Number(product.prices[item.size] || item.price || 0);
      if (!currentPrice) return null;
      return {
        ...item,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        brand: product.brand,
        price: currentPrice,
        quantity: Math.max(1, Number(item.quantity) || 1)
      };
    })
    .filter(Boolean);

  if (JSON.stringify(state.cart) !== before) {
    localStorage.setItem('asmr_samr_cart', JSON.stringify(state.cart));
  }
}

function addToCart(productId, size, price) {
  const product = getProductById(productId);
  if (!product) return;
  const currentPrice = Number(product.prices[size] || price || 0);
  if (!product.sizes.includes(size) || !currentPrice) return;

  const cartIndex = state.cart.findIndex(item => item.id === productId && item.size === size);

  if (cartIndex > -1) {
    state.cart[cartIndex].quantity += 1;
  } else {
    state.cart.push({
      id: productId,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      brand: product.brand,
      size: size,
      price: currentPrice,
      quantity: 1
    });
  }

  saveCart();
  renderCartDrawer();
  openCartDrawer();
}

function updateCartQty(id, size, change) {
  const item = state.cart.find(i => i.id === id && i.size === size);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => !(i.id === id && i.size === size));
    }
    saveCart();
    renderCartDrawer();
  }
}

function removeFromCart(id, size) {
  state.cart = state.cart.filter(i => !(i.id === id && i.size === size));
  saveCart();
  renderCartDrawer();
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  const trigger = document.getElementById('cart-trigger-btn');
  if (trigger) {
    trigger.setAttribute('aria-label', `${t('cart_title')} (${count} ${state.lang === 'ar' ? 'عناصر' : 'items'})`);
  }
}

// Drawer Open/Close UI Actions (with accessibility management)

function openCartDrawer() {
  previousActiveElement = document.activeElement;
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  
  drawer.classList.add('open');
  drawer.removeAttribute('aria-hidden');
  drawer.removeAttribute('inert');
  backdrop.classList.add('open');

  const trigger = document.getElementById('cart-trigger-btn');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');

  setTimeout(() => {
    const closeBtn = document.getElementById('cart-close-btn');
    if (closeBtn) closeBtn.focus();
  }, 100);
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  
  if (drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    backdrop.classList.remove('open');

    const trigger = document.getElementById('cart-trigger-btn');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (previousActiveElement) {
        previousActiveElement.focus();
      } else {
        trigger.focus();
      }
    }
  }
}

function openMobileNav() {
  previousActiveElement = document.activeElement;
  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  const backdrop = document.getElementById('drawer-backdrop');
  
  if (mobileToggle && !mobileToggle.classList.contains('open')) {
    mobileToggle.classList.add('open');
    mobileToggle.setAttribute('aria-expanded', 'true');
    navLinks.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    
    setTimeout(() => {
      const firstLink = navLinks.querySelector('a');
      if (firstLink) firstLink.focus();
    }, 100);
  }
}

function closeMobileNav() {
  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  const backdrop = document.getElementById('drawer-backdrop');
  
  if (mobileToggle && mobileToggle.classList.contains('open')) {
    mobileToggle.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    
    if (previousActiveElement) {
      previousActiveElement.focus();
    } else {
      mobileToggle.focus();
    }
  }
}

let preorderContext = null;

function ensurePreorderModal() {
  if (document.getElementById('preorder-modal')) return;

  const modalHtml = `
    <div class="modal-overlay" id="preorder-modal" role="dialog" aria-modal="true" aria-hidden="true" inert style="display: none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="serif-display modal-title" id="preorder-modal-title"></h3>
          <button class="modal-close-btn" id="preorder-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <form id="product-preorder-form" class="preorder-modal-form" novalidate style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="form-group-row" style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-whisper); padding-bottom: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem;">
            <span id="modal-product-summary-label" style="color: var(--taupe);"></span>
            <span id="modal-product-summary-value" class="text-gold" style="font-weight: 500;"></span>
          </div>
          
          <div class="form-field-group" style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label for="modal-form-name" id="modal-label-name" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold);"></label>
            <input type="text" id="modal-form-name" class="form-input" style="width: 100%;" required>
            <span class="form-error" id="modal-err-name" style="display: none; color: #E07A7A; font-size: 0.75rem; margin-top: 0.2rem; text-align: start;"></span>
          </div>
          
          <div class="form-field-group" style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label for="modal-form-phone" id="modal-label-phone" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold);"></label>
            <input type="tel" id="modal-form-phone" class="form-input" style="width: 100%;" placeholder="e.g. +966 50 000 0000" required>
            <span class="form-error" id="modal-err-phone" style="display: none; color: #E07A7A; font-size: 0.75rem; margin-top: 0.2rem; text-align: start;"></span>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1rem; width: 100%;" id="modal-submit-btn">
          </button>
        </form>
      </div>
    </div>
  `;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstElementChild);

  // Bind close event
  document.getElementById('preorder-modal-close').addEventListener('click', closePreorderModal);
  document.getElementById('product-preorder-form').addEventListener('submit', handlePreorderSubmit);
}

function openPreorderModal(productId, size, price) {
  preorderContext = { productId, size, price };
  ensurePreorderModal();

  const product = getProductById(productId);
  if (!product) return;

  const productTitle = state.lang === 'ar' ? product.nameAr : product.nameEn;
  const modalTitle = state.lang === 'ar' ? 'حجز من الدفعة B.077' : 'Reserve from Batch B.077';
  const summaryLabel = state.lang === 'ar' ? 'العطر المختار:' : 'Selected Scent:';
  const summaryValue = `${productTitle} (${size})`;
  const labelName = state.lang === 'ar' ? 'الاسم الكامل' : 'Your Full Name';
  const labelPhone = state.lang === 'ar' ? 'رقم الواتساب للتواصل' : 'WhatsApp Phone Number';
  const submitBtn = state.lang === 'ar' ? 'تأكيد الحجز المسبق' : 'Confirm Pre-order';

  document.getElementById('preorder-modal-title').innerText = modalTitle;
  document.getElementById('modal-product-summary-label').innerText = summaryLabel;
  document.getElementById('modal-product-summary-value').innerText = summaryValue;
  document.getElementById('modal-label-name').innerText = labelName;
  document.getElementById('modal-label-phone').innerText = labelPhone;
  document.getElementById('modal-submit-btn').innerText = submitBtn;

  // Prefill from the saved profile (My Account); clear errors
  const savedProfile = getProfile();
  document.getElementById('modal-form-name').value = savedProfile.name || '';
  document.getElementById('modal-form-phone').value = savedProfile.phone || '';
  document.getElementById('modal-err-name').style.display = 'none';
  document.getElementById('modal-err-phone').style.display = 'none';

  const modal = document.getElementById('preorder-modal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    modal.removeAttribute('inert');
    document.getElementById('modal-form-name').focus();
  }, 50);

  previousActiveElement = document.activeElement;
}

function closePreorderModal() {
  const modal = document.getElementById('preorder-modal');
  if (modal && modal.classList.contains('open')) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    setTimeout(() => {
      modal.style.display = 'none';
      if (previousActiveElement) previousActiveElement.focus();
    }, 400);
  }
}

function handlePreorderSubmit(e) {
  e.preventDefault();
  if (!preorderContext) return;

  const nameInput = document.getElementById('modal-form-name');
  const phoneInput = document.getElementById('modal-form-phone');

  let isValid = true;

  const clearError = (input, errId) => {
    input.classList.remove('invalid');
    const errEl = document.getElementById(errId);
    if (errEl) {
      errEl.innerText = '';
      errEl.style.display = 'none';
    }
  };

  const setError = (input, errId, msg) => {
    input.classList.add('invalid');
    const errEl = document.getElementById(errId);
    if (errEl) {
      errEl.innerText = msg;
      errEl.style.display = 'block';
    }
    isValid = false;
  };

  clearError(nameInput, 'modal-err-name');
  if (!nameInput.value.trim()) {
    setError(nameInput, 'modal-err-name', state.lang === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Please enter your name');
  }

  clearError(phoneInput, 'modal-err-phone');
  if (!phoneInput.value.trim()) {
    setError(phoneInput, 'modal-err-phone', state.lang === 'ar' ? 'يرجى إدخال رقم الواتساب' : 'Please enter your WhatsApp number');
  } else if (!/^\+?[0-9\s\-()]{7,15}$/.test(phoneInput.value.trim())) {
    setError(phoneInput, 'modal-err-phone', state.lang === 'ar' ? 'رقم الهاتف غير صحيح' : 'Invalid phone number format');
  }

  if (!isValid) return;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const product = getProductById(preorderContext.productId);
  const size = preorderContext.size;
  const price = preorderContext.price;
  const total = price + Math.round(price * 0.15);

  const list = JSON.parse(localStorage.getItem('asmr_samr_preorders')) || [];
  list.push({
    name,
    phone,
    productId: product.id,
    productNameEn: product.nameEn,
    productNameAr: product.nameAr,
    size,
    price,
    date: new Date().toISOString()
  });
  localStorage.setItem('asmr_samr_preorders', JSON.stringify(list));
  saveProfileData(name, phone);

  let message = '';
  if (state.lang === 'ar') {
    message = `مرحباً دار عطور أسمر وسَمَر، أود حجز زجاجة من الدفعة B.077:\n\n`;
    message += `المنتج: ${product.nameAr}\n`;
    message += `الحجم: ${size}\n`;
    message += `الاسم: ${name}\n`;
    message += `الهاتف: ${phone}\n`;
    message += `السعر: ${price} ريال سعودي (+ الضريبة: ${total} ريال)\n\n`;
    message += `الرمز المرجعي للدفعة: B.077\n`;
    message += `أرجو تأكيد الحجز وإرسال تفاصيل الدفع والتحويل البنكي للتوصيل ب${CONFIG.PRODUCTION_CITY_AR}. شكراً لكم.`;
  } else {
    message = `Hello ASMR & SAMR, I would like to reserve a bottle from Batch B.077:\n\n`;
    message += `Product: ${product.nameEn}\n`;
    message += `Size: ${size}\n`;
    message += `Name: ${name}\n`;
    message += `WhatsApp: ${phone}\n`;
    message += `Price: ${price} SAR (+ VAT: ${total} SAR)\n\n`;
    message += `Batch Reference: B.077\n`;
    message += `Please confirm my reservation and bank transfer instructions for shipment from ${CONFIG.PRODUCTION_CITY_EN}.`;
  }

  logOrder('preorder',
    [{ id: product.id, name: state.lang === 'ar' ? product.nameAr : product.nameEn, size, qty: 1, price }],
    total, message);

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  closePreorderModal();

  // Redirect to WhatsApp
  setTimeout(() => {
    window.open(whatsappUrl, '_blank');
  }, 200);
}

// ==========================================
// CUSTOMER ACCOUNT / DASHBOARD  (all data device-local)
// ==========================================
function getProfile() {
  try { return JSON.parse(localStorage.getItem('asmr_samr_profile')) || {}; } catch (e) { return {}; }
}

function saveProfileData(name, phone, email, city, address, preference) {
  const current = getProfile();
  const merged = {
    name: name !== undefined ? name : (current.name || ''),
    phone: phone !== undefined ? phone : (current.phone || ''),
    email: email !== undefined ? email : (current.email || ''),
    city: city !== undefined ? city : (current.city || ''),
    address: address !== undefined ? address : (current.address || ''),
    preference: preference !== undefined ? preference : (current.preference || '')
  };
  localStorage.setItem('asmr_samr_profile', JSON.stringify(merged));
}

function getOrders() {
  try { return JSON.parse(localStorage.getItem('asmr_samr_orders')) || []; } catch (e) { return []; }
}

function logOrder(type, items, total, message) {
  const orders = getOrders();
  const order = {
    id: 'B077-' + Date.now().toString(36).toUpperCase(),
    ts: new Date().toISOString(),
    type, items, total, message
  };
  orders.unshift(order);
  localStorage.setItem('asmr_samr_orders', JSON.stringify(orders.slice(0, 50)));
  if (type === 'cart' || type === 'buy-now' || type === 'whatsapp') {
    persistStorefrontOrder(order).catch(() => {});
  }
}

async function persistStorefrontOrder(order) {
  const profile = getProfile();
  await publicSupabaseRequest('rpc/submit_storefront_order', {
    method: 'POST',
    body: {
      p_order_no: order.id,
      p_customer_name: profile.name || null,
      p_customer_phone: profile.phone || null,
      p_type: order.type === 'buy-now' ? 'buy_now' : order.type,
      p_note: order.message || null,
      p_items: (order.items || []).map((item) => ({
        product_id: item.id,
        size: item.size,
        qty: Number(item.qty) || 1
      }))
    }
  });
}

function getWishlist() {
  try { return JSON.parse(localStorage.getItem('asmr_samr_wishlist')) || []; } catch (e) { return []; }
}

function toggleWishlist(productId) {
  let list = getWishlist();
  if (list.includes(productId)) {
    list = list.filter(id => id !== productId);
  } else {
    list.push(productId);
  }
  localStorage.setItem('asmr_samr_wishlist', JSON.stringify(list));
  renderApp();
}

function resendOrder(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order || !order.message) return;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(order.message)}`, '_blank');
}

function saveProfileFromForm(e) {
  e.preventDefault();
  const name = (document.getElementById('acct-name') || {}).value || '';
  const phone = (document.getElementById('acct-phone') || {}).value || '';
  const email = (document.getElementById('acct-email') || {}).value || '';
  const city = (document.getElementById('acct-city') || {}).value || '';
  const address = (document.getElementById('acct-address') || {}).value || '';
  const preference = (document.getElementById('acct-preference') || {}).value || '';
  
  saveProfileData(name.trim(), phone.trim(), email.trim(), city.trim(), address.trim(), preference.trim());
  const fb = document.getElementById('acct-save-feedback');
  if (fb) { fb.style.display = 'block'; fb.innerText = t('acct_saved'); }
}

function clearAccountData() {
  if (!window.confirm(t('acct_clear_confirm'))) return;
  ['asmr_samr_profile', 'asmr_samr_orders', 'asmr_samr_wishlist', 'asmr_samr_notif'].forEach(k => localStorage.removeItem(k));
  state.accountTab = 'overview';
  renderApp();
  showToast(state.lang === 'ar' ? 'تم مسح بياناتك من هذا الجهاز' : 'Your data has been cleared from this device');
}

function saveNotificationPrefs(e) {
  e.preventDefault();
  const prefs = {
    whatsapp: !!(document.getElementById('notif-whatsapp') || {}).checked,
    email: !!(document.getElementById('notif-email') || {}).checked,
    sms: !!(document.getElementById('notif-sms') || {}).checked
  };
  localStorage.setItem('asmr_samr_notif', JSON.stringify(prefs));
  showToast(state.lang === 'ar' ? 'تم تحديث الإشعارات' : 'Notification settings updated');
}

// ==========================================
// ADMIN DASHBOARD / CONTROL PLANE
// ==========================================
const ADMIN_STATE_KEY = 'asmr_samr_admin_state_v1';
const ADMIN_REMOTE_CACHE_KEY = 'asmr_samr_admin_remote_cache_v1';
const ADMIN_SESSION_KEY = 'asmr_samr_admin_supabase_session_v1';
const ADMIN_STAFF_ROLES = ['admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support'];
const ADMIN_TABS = [
  'overview',
  'orders',
  'products',
  'inventory',
  'customers',
  'wishlist',
  'rewards',
  'gifting',
  'preorders',
  'coupons',
  'content',
  'marketing',
  'notifications',
  'reports',
  'roles',
  'settings',
  'status',
  'ingredients',
  'suppliers',
  'purchase-orders',
  'formulas',
  'production',
  'finance',
  'costing',
  'users',
  'campaigns',
  'api-keys',
  'audit'
];
const ADMIN_STATUS_OPTIONS = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const ADMIN_BADGE_OPTIONS = [
  'For Her',
  'For Him',
  'Gift Set',
  'Ritual Set',
  'Best Seller',
  'Discovery',
  'Layering',
  'Limited Batch'
];

const ADMIN_SUPABASE_DEFAULT_URL = 'https://thpuomqhqghqskyegpfj.supabase.co';
let adminRemoteCache = readAdminRemoteCache();
let adminSyncStarted = false;
let adminSyncError = '';

function getAdminSupabaseConfig() {
  const cfg = window.ASMR_SAMR_CONFIG || window.ASMR_SAMR_SUPABASE || {};
  return {
    url: (cfg.supabaseUrl || cfg.SUPABASE_URL || ADMIN_SUPABASE_DEFAULT_URL || '').replace(/\/+$/, ''),
    anonKey: cfg.supabaseAnonKey || cfg.SUPABASE_ANON_KEY || cfg.anonKey || '',
    // Browser configuration never defines authorization. Profile roles and
    // database policies remain authoritative for dashboard operations.
    adminRoles: [...ADMIN_STAFF_ROLES],
    requireAuth: cfg.adminRequireAuth !== false
  };
}

function isAdminSupabaseConfigured() {
  const cfg = getAdminSupabaseConfig();
  return !!(cfg.url && cfg.anonKey);
}

function getStoredAdminSession() {
  const ownSession = readSessionJson(ADMIN_SESSION_KEY, null);
  if (ownSession?.access_token) return ownSession;

  // Migrate the former dashboard token once, then remove its persistent copy.
  const legacySession = readJson(ADMIN_SESSION_KEY, null);
  if (legacySession?.access_token) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(legacySession));
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return legacySession;
  }
  localStorage.removeItem(ADMIN_SESSION_KEY);
  return null;
}

function isAdminAuthorized(profile) {
  const role = profile?.role || getStoredAdminSession()?.user?.app_metadata?.role;
  return getAdminSupabaseConfig().adminRoles.includes(role);
}

async function adminSupabaseRequest(path, options = {}) {
  const cfg = getAdminSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase frontend config is missing.');
  const session = getStoredAdminSession();
  const token = session?.access_token || cfg.anonKey;
  const endpoint = path.startsWith('/auth/')
    ? `${cfg.url}${path}`
    : `${cfg.url}/rest/v1/${path.replace(/^\/+/, '')}`;
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    if (res.status === 401) {
      adminRemoteCache = null;
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Supabase request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function adminLoadProfileForSession() {
  const session = getStoredAdminSession();
  const userId = session?.user?.id;
  if (!userId || !isAdminSupabaseConfigured()) return null;
  const rows = await adminSupabaseRequest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name,email,role,points`);
  return Array.isArray(rows) ? rows[0] : null;
}

function mapSupabaseCacheToAdminState(cache) {
  const stateCopy = getAdminState();
  if (!cache) return stateCopy;
  (cache.products || []).forEach(product => {
    const local = stateCopy.products[product.id] || {};
    const priceRows = (cache.product_prices || []).filter(price => price.product_id === product.id);
    const inventory = (cache.product_inventory || []).find(row => row.product_id === product.id) || {};
    stateCopy.products[product.id] = {
      ...local,
      nameEn: product.name_en || local.nameEn,
      familyEn: product.family_en || local.familyEn,
      descEn: product.desc_en || local.descEn,
      badge: product.badge_en || local.badge,
      heroSize: product.hero_size || local.heroSize,
      isActive: product.is_active !== false,
      featuredOnHome: !!product.featured_on_home,
      sortOrder: product.sort_order || local.sortOrder,
      stock: Number(inventory.stock ?? local.stock ?? 0),
      lowStockAt: Number(inventory.low_stock_at ?? local.lowStockAt ?? 0),
      prices: priceRows.reduce((acc, row) => {
        acc[row.size] = Number(row.price) || 0;
        return acc;
      }, { ...(local.prices || {}) })
    };
  });
  if (Array.isArray(cache.coupons)) {
    stateCopy.coupons = cache.coupons.map(c => ({
      code: c.code,
      kind: c.kind,
      value: Number(c.value) || 0,
      active: c.is_active !== false,
      minTotal: Number(c.min_total) || 0,
      expiresAt: c.expires_at || ''
    }));
  }
  (cache.content_settings || []).forEach(row => {
    if (row.key === 'announcement_banner') {
      stateCopy.settings.bannerEn = row.value_en || stateCopy.settings.bannerEn;
      stateCopy.settings.bannerAr = row.value_ar || stateCopy.settings.bannerAr;
    }
  });
  return stateCopy;
}

async function adminSyncFromSupabase() {
  if (adminSyncStarted || !isAdminSupabaseConfigured()) return;
  adminSyncStarted = true;
  try {
    const cfg = getAdminSupabaseConfig();
    let profile = null;
    if (cfg.requireAuth) {
      profile = await adminLoadProfileForSession();
      if (!isAdminAuthorized(profile)) {
        adminSyncError = 'Sign in with an admin account to sync protected dashboard data.';
        return;
      }
    }
    const [
      productsRemote,
      pricesRemote,
      inventoryRemote,
      couponsRemote,
      ordersRemote,
      orderItemsRemote,
      profilesRemote,
      newsletterRemote,
      contentRemote
    ] = await Promise.all([
      adminSupabaseRequest('products?select=*&order=sort_order.asc'),
      adminSupabaseRequest('product_prices?select=*'),
      adminSupabaseRequest('product_inventory?select=*'),
      adminSupabaseRequest('coupons?select=*'),
      adminSupabaseRequest('orders?select=*&order=created_at.desc&limit=100'),
      adminSupabaseRequest('order_items?select=*'),
      adminSupabaseRequest('profiles?select=id,full_name,phone,email,role,points,created_at&order=created_at.desc&limit=200'),
      adminSupabaseRequest('newsletter_subscribers?select=*&order=created_at.desc&limit=500'),
      adminSupabaseRequest('content_settings?select=*')
    ]);
    adminRemoteCache = {
      syncedAt: new Date().toISOString(),
      profile,
      products: productsRemote || [],
      product_prices: pricesRemote || [],
      product_inventory: inventoryRemote || [],
      coupons: couponsRemote || [],
      orders: ordersRemote || [],
      order_items: orderItemsRemote || [],
      profiles: profilesRemote || [],
      newsletter_subscribers: newsletterRemote || [],
      content_settings: contentRemote || []
    };
    sessionStorage.setItem(ADMIN_REMOTE_CACHE_KEY, JSON.stringify(adminRemoteCache));
    localStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
    persistAdminState(mapSupabaseCacheToAdminState(adminRemoteCache));
    applyAdminState();
    if ((state.currentRoute || '').startsWith('#/admin')) renderApp();
  } catch (error) {
    adminSyncError = error?.message || 'Supabase sync failed.';
  }
}

function ensureAdminSync() {
  if (isAdminSupabaseConfigured()) {
    adminSyncFromSupabase();
  }
}

const BASE_PRODUCT_SNAPSHOT = products.reduce((acc, product, index) => {
  acc[product.id] = {
    nameEn: product.nameEn,
    familyEn: product.familyEn,
    descEn: product.descEn,
    badgeEn: product.badgeEn || '',
    heroSize: product.heroSize,
    prices: { ...product.prices },
    sortOrder: index + 1
  };
  return acc;
}, {});

function adminSafeId(...parts) {
  return parts.join('-').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function readSessionJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function readAdminRemoteCache() {
  const current = readSessionJson(ADMIN_REMOTE_CACHE_KEY, null);
  const legacy = readJson(ADMIN_REMOTE_CACHE_KEY, null);
  if (!current && legacy) {
    sessionStorage.setItem(ADMIN_REMOTE_CACHE_KEY, JSON.stringify(legacy));
  }
  localStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
  return current || legacy;
}

function getPreorders() {
  return readJson('asmr_samr_preorders', []);
}

function getNewsletterSubscribers() {
  return readJson('asmr_samr_newsletter_emails', []);
}

function getDefaultStock(product) {
  return 0;
}

function getDefaultBadge(product) {
  if (product.id === 'duo-box') return 'Gift Set';
  if (product.id === 'discovery-set') return 'Discovery';
  if (product.id.includes('trio')) return 'Ritual Set';
  if (product.id === 'samr-extrait' || product.id === 'asmr-extrait') return 'Best Seller';
  if (product.brand === 'SAMR') return 'For Her';
  if (product.brand === 'ASMR') return 'For Him';
  return 'Limited Batch';
}

function getDefaultAdminState() {
  return {
    updatedAt: new Date().toISOString(),
    settings: {
      bannerEn: 'Now taking pre-orders for our first numbered batch. Secure your bottle.',
      bannerAr: '',
      reservedCount: CONFIG.RESERVED_COUNT,
      batchSize: 77,
      launchMode: 'preorder',
      paymentMode: 'whatsapp',
      fulfillmentCity: CONFIG.PRODUCTION_CITY_EN,
      lowStockGlobal: 8
    },
    products: products.reduce((acc, product, index) => {
      const base = BASE_PRODUCT_SNAPSHOT[product.id] || product;
      acc[product.id] = {
        isActive: true,
        featuredOnHome: product.id === 'samr-extrait' || product.id === 'asmr-extrait',
        bestSeller: product.id === 'samr-extrait' || product.id === 'asmr-extrait',
        stock: getDefaultStock(product),
        lowStockAt: product.id.includes('trio') || product.id === 'duo-box' ? 4 : 8,
        leadTime: product.type === 'sets' || product.id === 'duo-box' ? 'Gift-ready in 2-3 days' : 'Ships in 1-2 days',
        badge: product.badgeEn || getDefaultBadge(product),
        sortOrder: base.sortOrder || index + 1,
        nameEn: base.nameEn,
        familyEn: base.familyEn,
        descEn: base.descEn,
        heroSize: base.heroSize,
        prices: { ...base.prices }
      };
      return acc;
    }, {}),
    orderStatuses: {},
    activity: [],
    coupons: []
  };
}

function mergeAdminState(storedState) {
  const defaults = getDefaultAdminState();
  const stored = storedState && typeof storedState === 'object' ? storedState : {};
  const merged = {
    ...defaults,
    ...stored,
    settings: { ...defaults.settings, ...(stored.settings || {}) },
    products: {},
    orderStatuses: { ...defaults.orderStatuses, ...(stored.orderStatuses || {}) },
    activity: Array.isArray(stored.activity) ? stored.activity : [],
    coupons: Array.isArray(stored.coupons) ? stored.coupons : defaults.coupons
  };

  products.forEach(product => {
    const defaultProduct = defaults.products[product.id] || {};
    const storedProduct = (stored.products || {})[product.id] || {};
    merged.products[product.id] = {
      ...defaultProduct,
      ...storedProduct,
      prices: {
        ...(defaultProduct.prices || {}),
        ...(storedProduct.prices || {})
      }
    };
  });

  return merged;
}

function getAdminState() {
  return mergeAdminState(readJson(ADMIN_STATE_KEY, null));
}

function persistAdminState(adminState) {
  const nextState = {
    ...adminState,
    updatedAt: new Date().toISOString(),
    activity: (adminState.activity || []).slice(0, 40)
  };
  localStorage.setItem(ADMIN_STATE_KEY, JSON.stringify(nextState));
  return nextState;
}

function recordAdminActivity(message, type = 'update') {
  const adminState = getAdminState();
  adminState.activity = [
    { message, type, ts: new Date().toISOString() },
    ...(adminState.activity || [])
  ].slice(0, 40);
  persistAdminState(adminState);
}

function applyAdminState() {
  const adminState = getAdminState();
  products.forEach(product => {
    const base = BASE_PRODUCT_SNAPSHOT[product.id] || product;
    const adminProduct = adminState.products[product.id] || {};
    const prices = { ...base.prices };

    Object.entries(adminProduct.prices || {}).forEach(([size, value]) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        prices[size] = numeric;
      }
    });

    const heroSize = product.sizes.includes(adminProduct.heroSize) ? adminProduct.heroSize : base.heroSize;

    product.nameEn = adminProduct.nameEn || base.nameEn;
    product.familyEn = adminProduct.familyEn || base.familyEn;
    product.descEn = adminProduct.descEn || base.descEn;
    product.badgeEn = adminProduct.badge || base.badgeEn || getDefaultBadge(product);
    product.heroSize = heroSize;
    product.prices = prices;
    product.admin = {
      ...adminProduct,
      prices,
      heroSize
    };
  });

  const reservedCount = Number(adminState.settings?.reservedCount);
  if (Number.isFinite(reservedCount)) {
    CONFIG.RESERVED_COUNT = Math.max(0, reservedCount);
  }
}

function getPublicAnnouncementBanner() {
  const banner = storefrontContent.find((item) => item.content_type === 'homepage_banner');
  const customCopy = state.lang === 'ar'
    ? (banner?.body_ar || banner?.title_ar)
    : (banner?.body_en || banner?.title_en);
  return esc(customCopy || t('first_batch_banner'));
}

function formatSar(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('en-US')} SAR`;
}

function formatAdminDate(value) {
  if (!value) return 'Not recorded';
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Not recorded';
  }
}

function getAdminProductRows() {
  const adminState = getAdminState();
  return products
    .map(product => ({
      product,
      admin: adminState.products[product.id] || {}
    }))
    .sort((a, b) => Number(a.admin.sortOrder || 0) - Number(b.admin.sortOrder || 0));
}

// Real revenue: trailing 6 months bucketed from actually-logged orders (no synthetic data).
function getAdminRevenueSeries(orders) {
  const now = new Date();
  const buckets = [];
  const index = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + d.getMonth();
    const bucket = { key, label: d.toLocaleDateString(state.lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' }), value: 0 };
    buckets.push(bucket);
    index[key] = bucket;
  }
  (orders || []).forEach(order => {
    const d = new Date(order.ts || order.date || Date.now());
    const key = d.getFullYear() + '-' + d.getMonth();
    if (index[key]) index[key].value += Number(order.total) || 0;
  });
  return buckets.map(b => ({ label: b.label, value: b.value }));
}

function getTopAdminProducts(orders, preorders) {
  const totals = {};

  orders.forEach(order => {
    (order.items || []).forEach(item => {
      totals[item.id] = totals[item.id] || { qty: 0, revenue: 0 };
      totals[item.id].qty += Number(item.qty) || 1;
      totals[item.id].revenue += (Number(item.price) || 0) * (Number(item.qty) || 1);
    });
  });

  preorders.forEach(lead => {
    totals[lead.productId] = totals[lead.productId] || { qty: 0, revenue: 0 };
    totals[lead.productId].qty += 1;
    totals[lead.productId].revenue += Number(lead.price) || 0;
  });

  const rows = getAdminProductRows().map(({ product, admin }) => ({
    product,
    admin,
    qty: totals[product.id]?.qty || 0,
    revenue: totals[product.id]?.revenue || 0
  }));

  return rows
    .sort((a, b) => (b.revenue - a.revenue) || (b.qty - a.qty) || (Number(b.admin.bestSeller) - Number(a.admin.bestSeller)))
    .slice(0, 5);
}

// ---- richer admin analytics, based on real device-local and optional Supabase data ----
function productTypeOf(id) {
  const p = products.find(pr => pr.id === id);
  return (p && p.type) || 'set';
}

function getAdminCustomers() {
  const preorders = getPreorders();
  const orders = getOrders();
  const profile = (typeof getProfile === 'function') ? getProfile() : {};
  const map = {};
  const touch = (key, name, phone, ts) => {
    key = (key || 'guest').trim() || 'guest';
    if (!map[key]) map[key] = { name: name || 'Guest', phone: phone || '', count: 0, value: 0, lastTs: ts };
    if (ts && new Date(ts) > new Date(map[key].lastTs || 0)) map[key].lastTs = ts;
    return map[key];
  };
  preorders.forEach(l => {
    const c = touch(l.phone || l.name, l.name, l.phone, l.date);
    c.count += 1; c.value += Number(l.price) || 0;
  });
  if ((profile.name || profile.phone) && orders.length) {
    const c = touch(profile.phone || profile.name, profile.name || 'You', profile.phone, orders[0] && orders[0].ts);
    orders.forEach(o => { c.count += 1; c.value += Number(o.total) || 0; });
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

function getRevenueByCategory(orders, preorders) {
  const labels = { extrait: 'Extraits', spray: 'Body Sprays', cream: 'Body Creams', set: 'Gift Sets' };
  const totals = { extrait: 0, spray: 0, cream: 0, set: 0 };
  orders.forEach(o => (o.items || []).forEach(i => {
    totals[productTypeOf(i.id)] += (Number(i.price) || 0) * (Number(i.qty) || 1);
  }));
  preorders.forEach(l => { totals[productTypeOf(l.productId)] += Number(l.price) || 0; });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.keys(labels).map(k => ({ label: labels[k], value: totals[k], pct: grand ? Math.round((totals[k] / grand) * 100) : 0 }));
}

function getOrderChannels(orders, preorders) {
  const c = { cart: 0, 'buy-now': 0, preorder: 0 };
  orders.forEach(o => { c[o.type] = (c[o.type] || 0) + 1; });
  c.preorder += preorders.length;
  const total = c.cart + c['buy-now'] + c.preorder || 1;
  return [
    { label: 'Cart checkout', value: c.cart, pct: Math.round((c.cart / total) * 100) },
    { label: 'Direct buy', value: c['buy-now'], pct: Math.round((c['buy-now'] / total) * 100) },
    { label: 'Pre-orders', value: c.preorder, pct: Math.round((c.preorder / total) * 100) }
  ];
}

function getAdminCoupons() {
  const list = getAdminState().coupons;
  return Array.isArray(list) ? list : [];
}

function getAdminAnalytics() {
  const adminState = getAdminState();
  const remoteOrders = (adminRemoteCache?.orders || []).map(order => ({
    id: order.order_no || order.id,
    ts: order.created_at,
    type: order.type || order.channel || 'supabase',
    total: Number(order.total) || 0,
    status: order.status,
    items: (adminRemoteCache?.order_items || [])
      .filter(item => item.order_id === order.id)
      .map(item => ({
        id: item.product_id,
        name: item.name_en,
        size: item.size,
        qty: item.qty,
        price: Number(item.unit_price) || 0
      })),
    customerName: order.customer_name,
    customerPhone: order.customer_phone
  }));
  const orders = [...remoteOrders, ...getOrders()];
  const preorders = getPreorders();
  const remoteNewsletter = (adminRemoteCache?.newsletter_subscribers || []).map(row => row.email).filter(Boolean);
  const newsletter = Array.from(new Set([...remoteNewsletter, ...getNewsletterSubscribers()]));
  const productRows = getAdminProductRows();
  const remoteCustomers = (adminRemoteCache?.profiles || [])
    .filter(row => row.role === 'customer')
    .map(row => ({
      name: row.full_name || row.email || 'Customer',
      phone: row.phone || row.email || '',
      count: 0,
      value: 0,
      points: Number(row.points) || 0,
      role: row.role,
      lastTs: row.created_at
    }));
  const customerByKey = {};
  [...remoteCustomers, ...getAdminCustomers()].forEach(customer => {
    const key = customer.phone || customer.name;
    if (!customerByKey[key]) customerByKey[key] = { ...customer };
    else {
      customerByKey[key].count += Number(customer.count) || 0;
      customerByKey[key].value += Number(customer.value) || 0;
      customerByKey[key].points = Math.max(Number(customerByKey[key].points) || 0, Number(customer.points) || 0);
    }
  });
  const customers = Object.values(customerByKey).sort((a, b) => b.value - a.value);
  const repeatCustomers = customers.filter(c => c.count > 1).length;
  const orderRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const preorderValue = preorders.reduce((sum, lead) => sum + (Number(lead.price) || 0), 0);
  const activeProducts = productRows.filter(row => row.admin.isActive !== false).length;
  const lowStockProducts = productRows.filter(row => Number(row.admin.stock) <= Number(row.admin.lowStockAt || 0)).length;
  const totalStock = productRows.reduce((sum, row) => sum + (Number(row.admin.stock) || 0), 0);
  const reservedCount = Number(adminState.settings.reservedCount) || 0;
  const batchSize = Number(adminState.settings.batchSize) || 77;
  const batchProgress = Math.min(100, Math.round((reservedCount / Math.max(1, batchSize)) * 100));

  return {
    adminState,
    orders,
    preorders,
    newsletter,
    productRows,
    orderRevenue,
    preorderValue,
    activeProducts,
    lowStockProducts,
    totalStock,
    reservedCount,
    batchSize,
    batchProgress,
    revenueSeries: getAdminRevenueSeries(orders),
    topProducts: getTopAdminProducts(orders, preorders),
    customers,
    topCustomers: customers.slice(0, 5),
    revenueByCategory: getRevenueByCategory(orders, preorders),
    orderChannels: getOrderChannels(orders, preorders),
    coupons: getAdminCoupons(),
    remote: adminRemoteCache,
    sync: {
      configured: isAdminSupabaseConfigured(),
      syncedAt: adminRemoteCache?.syncedAt || '',
      error: adminSyncError
    },
    insights: {
      totalCustomers: customers.length,
      repeatRate: customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0,
      aov: orders.length ? (orderRevenue / orders.length) : 0,
      refundRate: 0
    }
  };
}

function renderAdminNav(activeTab) {
  const labels = {
    overview: 'Overview',
    orders: 'Orders',
    products: 'Products',
    inventory: 'Inventory',
    customers: 'Customers',
    wishlist: 'Wishlist',
    rewards: 'Rewards',
    gifting: 'Gifting',
    preorders: 'Pre-orders',
    coupons: 'Coupons',
    content: 'Content',
    marketing: 'Marketing',
    notifications: 'Notifications',
    reports: 'Reports',
    roles: 'Roles',
    settings: 'Settings',
    status: 'Status'
  };

  return ADMIN_TABS.map(tab => `
    <a href="#/admin${tab === 'overview' ? '' : '/' + tab}" class="admin-nav-link ${activeTab === tab ? 'active' : ''}">
      <span>${labels[tab]}</span>
    </a>
  `).join('');
}

function renderAdminKpi(label, value, helper, tone = '') {
  return `
    <article class="admin-kpi-card ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${helper}</small>
    </article>
  `;
}

function renderAdmin(activeTab = 'overview') {
  if (window.ASMRSAMRAdmin && typeof window.ASMRSAMRAdmin.render === 'function') {
    return window.ASMRSAMRAdmin.render(activeTab);
  }
  return `
    <main class="admin-unavailable" role="alert">
      <p class="eyebrow">Admin Studio</p>
      <h1>Dashboard unavailable</h1>
      <p>The secure admin application could not be loaded. Refresh the page to try again.</p>
      <a class="btn btn-primary" href="#/">Return to storefront</a>
    </main>
  `;

  /* Legacy dashboard rendering remains below for migration history only. */
  const tab = ADMIN_TABS.includes(activeTab) ? activeTab : 'overview';
  const analytics = getAdminAnalytics();
  const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);

  const content = {
    overview: renderAdminOverview,
    products: renderAdminProducts,
    inventory: renderAdminInventory,
    orders: renderAdminOrders,
    customers: renderAdminCustomers,
    wishlist: renderAdminWishlist,
    rewards: renderAdminRewards,
    gifting: renderAdminGifting,
    preorders: renderAdminPreorders,
    coupons: renderAdminCoupons,
    content: renderAdminContent,
    marketing: renderAdminMarketing,
    notifications: renderAdminNotifications,
    status: renderAdminStatus,
    reports: renderAdminReports,
    roles: renderAdminRoles,
    settings: renderAdminSettings
  }[tab](analytics);

  return `
    <div class="admin-dashboard-wrapper">
      <aside class="admin-sidebar" aria-label="Admin sections">
        <a href="#/" class="admin-brand-lockup" aria-label="Return to storefront">
          <span>A S M R &amp; S A M R</span>
          <small>Admin Studio</small>
        </a>
        <nav class="admin-nav">
          ${renderAdminNav(tab)}
        </nav>
        <div class="admin-sidebar-note">
          <span>${isAdminSupabaseConfigured() ? 'Supabase linked' : 'Local studio mode'}</span>
          <strong>${analytics.activeProducts} active products</strong>
          <small>${analytics.lowStockProducts} low-stock alerts${adminSyncError ? ' / sync attention' : ''}</small>
        </div>
      </aside>

      <main class="admin-main" aria-label="ASMR and SAMR admin dashboard">
        <header class="admin-topbar">
          <div>
            <span class="admin-eyebrow">Control plane</span>
            <h1>${tabLabel}</h1>
            <p>Manage catalog, launch content, WhatsApp orders, and batch readiness from one place.</p>
          </div>
          <div class="admin-topbar-actions">
            <span class="admin-updated">Updated ${formatAdminDate(analytics.adminState.updatedAt)}</span>
            <a href="#/" class="admin-secondary-btn">View site</a>
            <button type="button" class="admin-secondary-btn" onclick="adminRefreshSupabase()">Sync</button>
            <button type="button" class="admin-primary-btn" onclick="adminExportData()">Export data</button>
          </div>
        </header>

        ${content}
      </main>
      <div id="admin-editor-root"></div>
    </div>
  `;
}

function renderAdminOverview(analytics) {
  const maxRevenue = Math.max(...analytics.revenueSeries.map(item => item.value), 1);
  const activities = [
    ...(analytics.adminState.activity || []),
    ...analytics.orders.slice(0, 4).map(order => ({
      message: `Order ${order.id} logged for ${formatSar(order.total)}`,
      type: order.type || 'order',
      ts: order.ts
    })),
    ...analytics.preorders.slice(0, 4).map(lead => ({
      message: `${lead.name || 'Customer'} reserved ${lead.productNameEn || lead.productId}`,
      type: 'preorder',
      ts: lead.date
    }))
  ].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).slice(0, 7);

  return `
    <section class="admin-kpi-grid" aria-label="Admin key metrics">
      ${renderAdminKpi('Revenue logged', formatSar(analytics.orderRevenue + analytics.preorderValue), `${analytics.orders.length} WhatsApp orders and ${analytics.preorders.length} reservations`, 'gold')}
      ${renderAdminKpi('Batch B.077', `${analytics.batchProgress}%`, `${analytics.reservedCount} of ${analytics.batchSize} reserved`, 'stone')}
      ${renderAdminKpi('Active catalog', analytics.activeProducts, `${analytics.productRows.length} total products managed`, 'sand')}
      ${renderAdminKpi('Inventory', analytics.totalStock, `${analytics.lowStockProducts} products need attention`, analytics.lowStockProducts ? 'danger' : 'green')}
    </section>

    <section class="admin-dashboard-grid">
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Revenue overview</span>
            <h2>Launch performance</h2>
          </div>
          <a href="#/admin/reports">Open reports</a>
        </div>
        <div class="admin-revenue-bars">
          ${analytics.revenueSeries.map(item => `
            <div class="admin-bar-row">
              <span>${item.label}</span>
              <div><i style="width: ${item.value > 0 ? Math.max(6, Math.round((item.value / maxRevenue) * 100)) : 0}%"></i></div>
              <strong>${formatSar(item.value)}</strong>
            </div>
          `).join('')}
        </div>
        ${analytics.orderRevenue + analytics.preorderValue === 0
          ? `<p class="admin-muted-note">Awaiting logged sales — this chart fills in as real orders are recorded on this device.</p>`
          : ''}
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Live platform status</span>
            <h2>Storefront health</h2>
          </div>
        </div>
        <div class="admin-status-list">
          <div class="admin-status-row"><span class="status-dot ok"></span><strong>Catalog</strong><small>${analytics.activeProducts} live</small></div>
          <div class="admin-status-row"><span class="status-dot ok"></span><strong>Images</strong><small>${Object.keys(productImages).length} WebP pairs</small></div>
          <div class="admin-status-row"><span class="status-dot ${IS_WHATSAPP_PLACEHOLDER ? 'warn' : 'ok'}"></span><strong>WhatsApp</strong><small>${IS_WHATSAPP_PLACEHOLDER ? 'Placeholder number' : 'Connected'}</small></div>
          <div class="admin-status-row"><span class="status-dot ${analytics.lowStockProducts ? 'warn' : 'ok'}"></span><strong>Stock</strong><small>${analytics.lowStockProducts || 'No'} alerts</small></div>
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Top products</span>
            <h2>Demand signals</h2>
          </div>
          <a href="#/admin/products">Manage</a>
        </div>
        <div class="admin-ranked-list">
          ${analytics.topProducts.map((row, index) => `
            <div class="admin-ranked-row">
              <span>${String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>${esc(row.product.nameEn)}</strong>
                <small>${row.qty ? `${row.qty} units / ${formatSar(row.revenue)}` : `${row.admin.stock} in stock`}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Recent activity</span>
            <h2>Operations feed</h2>
          </div>
        </div>
        <div class="admin-activity-list">
          ${(activities.length ? activities : [{ message: 'No activity has been recorded yet.', type: 'info', ts: new Date().toISOString() }]).map(activity => `
            <div class="admin-activity-row">
              <span>${esc(activity.type || 'update')}</span>
              <div>
                <strong>${esc(activity.message)}</strong>
                <small>${formatAdminDate(activity.ts)}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Order channel</span>
            <h2>Where orders come from</h2>
          </div>
        </div>
        <div class="admin-breakdown-list">
          ${analytics.orderChannels.map(ch => `
            <div class="admin-breakdown-row">
              <span>${ch.label}</span>
              <div><i style="width:${ch.pct}%"></i></div>
              <strong>${ch.pct}%</strong>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Revenue by category</span>
            <h2>Product mix</h2>
          </div>
          <a href="#/admin/reports">Reports</a>
        </div>
        <div class="admin-breakdown-list">
          ${analytics.revenueByCategory.map(cat => `
            <div class="admin-breakdown-row">
              <span>${cat.label}</span>
              <div><i style="width:${cat.pct}%"></i></div>
              <strong>${formatSar(cat.value)}</strong>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Top customers</span>
            <h2>Best buyers</h2>
          </div>
          <a href="#/admin/customers">All</a>
        </div>
        <div class="admin-ranked-list">
          ${analytics.topCustomers.length ? analytics.topCustomers.map((c, i) => `
            <div class="admin-ranked-row">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <div>
                <strong>${esc(c.name)}</strong>
                <small>${c.count} order${c.count === 1 ? '' : 's'} / ${formatSar(c.value)}</small>
              </div>
            </div>
          `).join('') : `<p class="admin-muted-note">No customers yet.</p>`}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Platform insights</span>
            <h2>This device</h2>
          </div>
        </div>
        <div class="admin-insight-grid">
          <div class="admin-insight-cell"><small>New customers</small><strong>${analytics.insights.totalCustomers}</strong></div>
          <div class="admin-insight-cell"><small>Repeat rate</small><strong>${analytics.insights.repeatRate}%</strong></div>
          <div class="admin-insight-cell"><small>Avg order value</small><strong>${formatSar(analytics.insights.aov)}</strong></div>
          <div class="admin-insight-cell"><small>Refund rate</small><strong>${analytics.insights.refundRate}%</strong></div>
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Quick actions</span>
            <h2>Admin shortcuts</h2>
          </div>
        </div>
        <div class="admin-action-list">
          <a href="#/admin/products">Update prices and stock</a>
          <a href="#/admin/coupons">Manage coupons</a>
          <a href="#/admin/content">Change launch banner</a>
          <button type="button" class="danger" onclick="adminResetState()">Reset admin edits</button>
        </div>
      </article>
    </section>
  `;
}

function renderAdminProducts(analytics) {
  return `
    <section class="admin-panel admin-table-panel">
      <div class="admin-panel-heading admin-table-toolbar">
        <div>
          <span class="admin-eyebrow">Catalog management</span>
          <h2>Products, inventory, and merchandising</h2>
        </div>
        <div class="admin-filter-group" aria-label="Product filters">
          <button type="button" class="active" onclick="adminFilterProducts('all', this)">All</button>
          <button type="button" onclick="adminFilterProducts('samr', this)">SAMR</button>
          <button type="button" onclick="adminFilterProducts('asmr', this)">ASMR</button>
          <button type="button" onclick="adminFilterProducts('sets', this)">Sets</button>
          <button type="button" onclick="adminFilterProducts('low', this)">Low stock</button>
          <button type="button" onclick="adminFilterProducts('inactive', this)">Inactive</button>
        </div>
      </div>
      <div class="admin-product-list">
        ${analytics.productRows.map(renderAdminProductRow).join('')}
      </div>
    </section>
  `;
}

function renderAdminProductRow(row) {
  const { product, admin } = row;
  const active = admin.isActive !== false;
  const low = Number(admin.stock) <= Number(admin.lowStockAt || 0);
  const startPrice = admin.prices?.[admin.heroSize] || getProductStartPrice(product);
  const priceFields = product.sizes.map(size => {
    const fieldId = adminSafeId('admin-price', product.id, size);
    return `
      <label class="admin-mini-field" for="${fieldId}">
        <span>${esc(size)}</span>
        <input id="${fieldId}" type="number" min="0" step="1" value="${Number(admin.prices?.[size] || product.prices[size] || 0)}">
      </label>
    `;
  }).join('');

  return `
    <form class="admin-product-row ${active ? '' : 'is-inactive'} ${low ? 'is-low' : ''}" data-admin-product-row data-type="${product.type}" data-brand="${product.brand.toLowerCase()}" data-active="${active}" data-low="${low}" onsubmit="adminSaveProductRow(event, '${product.id}')">
      <div class="admin-product-cell admin-product-identity">
        <div class="admin-product-thumb">
          ${renderProductPhoto(product)}
        </div>
        <div class="admin-product-info">
          <strong>${esc(product.nameEn)}</strong>
          <small>${esc(product.brand)} / ${esc(product.familyEn)}</small>
          <span>${formatSar(startPrice)} from ${esc(admin.heroSize || product.heroSize)}</span>
        </div>
      </div>

      <div class="admin-product-cell admin-price-stack">
        ${priceFields}
      </div>

      <div class="admin-product-cell admin-stock-stack">
        <label class="admin-mini-field" for="${adminSafeId('admin-stock', product.id)}">
          <span>Stock</span>
          <input id="${adminSafeId('admin-stock', product.id)}" type="number" min="0" step="1" value="${Number(admin.stock) || 0}">
        </label>
        <label class="admin-mini-field" for="${adminSafeId('admin-sort', product.id)}">
          <span>Order</span>
          <input id="${adminSafeId('admin-sort', product.id)}" type="number" min="1" step="1" value="${Number(admin.sortOrder) || 1}">
        </label>
      </div>

      <div class="admin-product-cell admin-checks">
        <label><input id="${adminSafeId('admin-active', product.id)}" type="checkbox" ${active ? 'checked' : ''}> Active</label>
        <label><input id="${adminSafeId('admin-featured', product.id)}" type="checkbox" ${admin.featuredOnHome ? 'checked' : ''}> Featured</label>
        <label><input id="${adminSafeId('admin-best', product.id)}" type="checkbox" ${admin.bestSeller ? 'checked' : ''}> Best seller</label>
      </div>

      <div class="admin-product-cell admin-row-actions">
        <button type="submit" class="admin-primary-btn">Save</button>
        <button type="button" class="admin-secondary-btn" onclick="adminOpenProductEditor('${product.id}')">Details</button>
      </div>
    </form>
  `;
}

function renderAdminProductEditor(product) {
  const admin = getAdminState().products[product.id] || {};
  const badgeOptions = ADMIN_BADGE_OPTIONS.map(option => `
    <option value="${esc(option)}" ${admin.badge === option ? 'selected' : ''}>${esc(option)}</option>
  `).join('');
  const sizeOptions = product.sizes.map(size => `
    <option value="${esc(size)}" ${admin.heroSize === size ? 'selected' : ''}>${esc(size)}</option>
  `).join('');

  return `
    <div class="admin-editor-backdrop" role="dialog" aria-modal="true" aria-label="Edit product details">
      <form class="admin-product-editor" onsubmit="adminSaveProductDetails(event, '${product.id}')">
        <button type="button" class="admin-editor-close" onclick="adminCloseProductEditor()" aria-label="Close editor">&times;</button>
        <span class="admin-eyebrow">Product details</span>
        <h2>${esc(product.nameEn)}</h2>
        <div class="admin-editor-grid">
          <label>
            <span>Product name</span>
            <input id="${adminSafeId('detail-name', product.id)}" type="text" value="${esc(admin.nameEn || product.nameEn)}">
          </label>
          <label>
            <span>Fragrance family</span>
            <input id="${adminSafeId('detail-family', product.id)}" type="text" value="${esc(admin.familyEn || product.familyEn)}">
          </label>
          <label>
            <span>Badge</span>
            <select id="${adminSafeId('detail-badge', product.id)}">${badgeOptions}</select>
          </label>
          <label>
            <span>Hero size</span>
            <select id="${adminSafeId('detail-hero', product.id)}">${sizeOptions}</select>
          </label>
          <label>
            <span>Low stock alert</span>
            <input id="${adminSafeId('detail-low', product.id)}" type="number" min="0" step="1" value="${Number(admin.lowStockAt) || 0}">
          </label>
          <label>
            <span>Lead time</span>
            <input id="${adminSafeId('detail-lead', product.id)}" type="text" value="${esc(admin.leadTime || '')}">
          </label>
          <label class="admin-editor-wide">
            <span>Product description</span>
            <textarea id="${adminSafeId('detail-desc', product.id)}" rows="5">${esc(admin.descEn || product.descEn)}</textarea>
          </label>
        </div>
        <div class="admin-editor-actions">
          <button type="button" class="admin-secondary-btn" onclick="adminCloseProductEditor()">Cancel</button>
          <button type="submit" class="admin-primary-btn">Save details</button>
        </div>
      </form>
    </div>
  `;
}

function renderAdminOrders(analytics) {
  return `
    <section class="admin-dashboard-grid">
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Orders</span>
            <h2>WhatsApp checkout log</h2>
          </div>
        </div>
        <div class="admin-order-list">
          ${analytics.orders.length ? analytics.orders.map(order => renderAdminOrderRow(order, analytics.adminState)).join('') : '<p class="admin-empty">No checkout orders yet. Orders created by Add to Cart, Buy Now, and WhatsApp checkout will appear here.</p>'}
        </div>
      </article>

      <article class="admin-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Reservations</span>
            <h2>Preorder leads</h2>
          </div>
        </div>
        <div class="admin-lead-list">
          ${analytics.preorders.length ? analytics.preorders.map(renderAdminLeadRow).join('') : '<p class="admin-empty">No reservations yet.</p>'}
        </div>
      </article>
    </section>
  `;
}

function renderAdminOrderRow(order, adminState) {
  const status = adminState.orderStatuses[order.id] || 'new';
  const items = (order.items || []).map(item => `${esc(item.name || item.id)} x${item.qty || 1}`).join(', ');
  const options = ADMIN_STATUS_OPTIONS.map(option => `
    <option value="${option}" ${status === option ? 'selected' : ''}>${option}</option>
  `).join('');

  return `
    <div class="admin-order-row">
      <div>
        <span class="admin-status-chip ${status}">${status}</span>
        <strong>${esc(order.id || 'Local order')}</strong>
        <small>${formatAdminDate(order.ts)} / ${esc(order.type || 'order')}</small>
      </div>
      <p>${items || 'No item details'}</p>
      <strong>${formatSar(order.total)}</strong>
      <select aria-label="Order status" onchange="adminUpdateOrderStatus('${esc(order.id)}', this.value)">
        ${options}
      </select>
      <button type="button" class="admin-secondary-btn" onclick="resendOrder('${esc(order.id)}')">WhatsApp</button>
    </div>
  `;
}

function renderAdminLeadRow(lead) {
  return `
    <div class="admin-lead-row">
      <div>
        <strong>${esc(lead.name || 'Guest lead')}</strong>
        <small>${esc(lead.phone || 'No phone')} / ${formatAdminDate(lead.date)}</small>
      </div>
      <p>${esc(lead.productNameEn || lead.productId || 'Reservation')} - ${esc(lead.size || '')}</p>
      <strong>${formatSar(lead.price)}</strong>
    </div>
  `;
}

function renderAdminContent(analytics) {
  const settings = analytics.adminState.settings;
  return `
    <section class="admin-panel">
      <div class="admin-panel-heading">
        <div>
          <span class="admin-eyebrow">Launch content</span>
          <h2>Storefront announcement and batch settings</h2>
        </div>
      </div>
      <form class="admin-settings-form" onsubmit="adminSaveSettings(event)">
        <div class="admin-form-grid">
          <label class="admin-form-wide">
            <span>Announcement banner English</span>
            <input id="admin-banner-en" type="text" value="${esc(settings.bannerEn || '')}">
          </label>
          <label class="admin-form-wide">
            <span>Announcement banner Arabic</span>
            <input id="admin-banner-ar" type="text" value="${esc(settings.bannerAr || '')}" dir="rtl">
          </label>
          <label>
            <span>Reserved count</span>
            <input id="admin-reserved-count" type="number" min="0" step="1" value="${Number(settings.reservedCount) || 0}">
          </label>
          <label>
            <span>Batch size</span>
            <input id="admin-batch-size" type="number" min="1" step="1" value="${Number(settings.batchSize) || 77}">
          </label>
          <label>
            <span>Launch mode</span>
            <select id="admin-launch-mode">
              <option value="preorder" ${settings.launchMode === 'preorder' ? 'selected' : ''}>Preorder</option>
              <option value="live" ${settings.launchMode === 'live' ? 'selected' : ''}>Live sales</option>
              <option value="private" ${settings.launchMode === 'private' ? 'selected' : ''}>Private list</option>
            </select>
          </label>
          <label>
            <span>Payment mode</span>
            <select id="admin-payment-mode">
              <option value="whatsapp" ${settings.paymentMode === 'whatsapp' ? 'selected' : ''}>WhatsApp checkout</option>
              <option value="bank" ${settings.paymentMode === 'bank' ? 'selected' : ''}>Bank transfer</option>
              <option value="gateway" ${settings.paymentMode === 'gateway' ? 'selected' : ''}>Payment gateway</option>
            </select>
          </label>
          <label>
            <span>Fulfillment city</span>
            <input id="admin-fulfillment-city" type="text" value="${esc(settings.fulfillmentCity || CONFIG.PRODUCTION_CITY_EN)}">
          </label>
          <label>
            <span>Global low-stock alert</span>
            <input id="admin-low-stock-global" type="number" min="0" step="1" value="${Number(settings.lowStockGlobal) || 8}">
          </label>
        </div>
        <div class="admin-editor-actions">
          <button type="submit" class="admin-primary-btn">Save content settings</button>
        </div>
      </form>
    </section>
  `;
}

function renderAdminCustomers(analytics) {
  const rows = analytics.customers;
  const body = rows.length ? rows.map((c, i) => `
    <div class="admin-table-row">
      <span class="admin-cell-strong">${String(i + 1).padStart(2, '0')} · ${esc(c.name)}</span>
      <span>${esc(c.phone || '—')}</span>
      <span>${c.count} order${c.count === 1 ? '' : 's'}</span>
      <span class="admin-cell-strong">${formatSar(c.value)}</span>
      <span>${formatAdminDate(c.lastTs)}</span>
    </div>
  `).join('') : `<p class="admin-muted-note" style="padding:1.5rem;">No customers yet — reservations and orders will populate this list.</p>`;
  return `
    <section class="admin-kpi-grid" aria-label="Customer metrics">
      ${renderAdminKpi('Customers', analytics.insights.totalCustomers, 'unique buyers on this device', 'gold')}
      ${renderAdminKpi('Repeat rate', `${analytics.insights.repeatRate}%`, 'bought more than once', 'sand')}
      ${renderAdminKpi('Avg order value', formatSar(analytics.insights.aov), `${analytics.orders.length} orders logged`, 'stone')}
      ${renderAdminKpi('Subscribers', analytics.newsletter.length, 'newsletter sign-ups', 'green')}
    </section>
    <section class="admin-dashboard-grid">
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Directory</span><h2>All customers</h2></div><a href="#/admin/marketing">Marketing</a></div>
        <div class="admin-table">
          <div class="admin-table-row admin-table-head"><span>Name</span><span>Phone</span><span>Orders</span><span>Value</span><span>Last seen</span></div>
          ${body}
        </div>
      </article>
    </section>
  `;
}

function renderAdminCoupons(analytics) {
  const rows = analytics.coupons.length ? analytics.coupons.map(c => `
    <div class="admin-table-row">
      <span class="admin-cell-strong">${esc(c.code)}</span>
      <span>${c.kind === 'percent' ? `${c.value}% off` : `${formatSar(c.value)} off`}</span>
      <span>${c.minTotal ? `min ${formatSar(c.minTotal)}` : 'no minimum'}</span>
      <span><em class="admin-chip ${c.active ? 'ok' : 'off'}">${c.active ? 'Active' : 'Paused'}</em></span>
      <span class="admin-row-actions">
        <button type="button" onclick="adminToggleCoupon('${esc(c.code)}')">${c.active ? 'Pause' : 'Activate'}</button>
        <button type="button" class="danger" onclick="adminDeleteCoupon('${esc(c.code)}')">Delete</button>
      </span>
    </div>
  `).join('') : `<p class="admin-muted-note" style="padding:1.5rem;">No coupons yet. Create your first discount code below.</p>`;
  return `
    <section class="admin-dashboard-grid">
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Discounts</span><h2>Coupon codes</h2></div></div>
        <div class="admin-table">
          <div class="admin-table-row admin-table-head"><span>Code</span><span>Value</span><span>Condition</span><span>Status</span><span>Actions</span></div>
          ${rows}
        </div>
      </article>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Create</span><h2>New coupon</h2></div></div>
        <form class="admin-form" onsubmit="adminAddCoupon(event)">
          <label>Code<input type="text" id="coupon-code" placeholder="SUMMER15" required></label>
          <label>Type
            <select id="coupon-kind">
              <option value="percent">Percent %</option>
              <option value="fixed">Fixed SAR</option>
            </select>
          </label>
          <label>Value<input type="number" id="coupon-value" min="0" step="1" value="10" required></label>
          <label>Minimum order (SAR)<input type="number" id="coupon-min" min="0" step="1" value="0"></label>
          <button type="submit" class="admin-primary-btn">Add coupon</button>
        </form>
      </article>
    </section>
  `;
}

function renderAdminMarketing(analytics) {
  const subs = analytics.newsletter;
  const subsBody = subs.length ? subs.map((email, i) => `
    <div class="admin-table-row">
      <span class="admin-cell-strong">${String(i + 1).padStart(2, '0')}</span>
      <span style="grid-column: span 3;">${esc(email)}</span>
      <span><button type="button" onclick="adminCopyEmail('${esc(email)}')">Copy</button></span>
    </div>
  `).join('') : `<p class="admin-muted-note" style="padding:1.5rem;">No subscribers yet — the storefront newsletter form feeds this list.</p>`;
  const mailto = subs.length ? `mailto:?bcc=${encodeURIComponent(subs.join(','))}&subject=${encodeURIComponent('ASMR & SAMR — Batch B.077')}` : '#';
  return `
    <section class="admin-kpi-grid" aria-label="Marketing metrics">
      ${renderAdminKpi('Subscribers', subs.length, 'newsletter list', 'gold')}
      ${renderAdminKpi('Reservations', analytics.preorders.length, `Batch B.077 · ${analytics.batchProgress}% reserved`, 'sand')}
      ${renderAdminKpi('Announcement', analytics.adminState.settings.bannerEn ? 'Custom' : 'Default', 'storefront banner', 'stone')}
    </section>
    <section class="admin-dashboard-grid">
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading">
          <div><span class="admin-eyebrow">Newsletter</span><h2>Subscribers</h2></div>
          <a href="${mailto}"${subs.length ? '' : ' aria-disabled="true"'}>Email all (BCC)</a>
        </div>
        <div class="admin-table">${subsBody}</div>
      </article>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Campaign</span><h2>Quick send</h2></div></div>
        <div class="admin-action-list">
          <a href="#/admin/content">Edit launch banner</a>
          <a href="${mailto}"${subs.length ? '' : ' aria-disabled="true"'}>Compose newsletter email</a>
          <button type="button" onclick="adminExportData()">Export subscribers (JSON)</button>
        </div>
      </article>
    </section>
  `;
}

function renderAdminStatus(analytics) {
  const settings = analytics.adminState.settings;
  const checks = [
    { label: 'Storefront route', value: 'Ready', detail: 'Home, shop, product, cart, and admin routes are client-side hash routes.', ok: true },
    { label: 'Product images', value: `${Object.keys(productImages).length} WebP assets`, detail: 'The catalog uses WebP first and PNG fallback.', ok: Object.keys(productImages).length === products.length },
    { label: 'WhatsApp checkout', value: IS_WHATSAPP_PLACEHOLDER ? 'Needs number' : 'Ready', detail: IS_WHATSAPP_PLACEHOLDER ? 'Replace the placeholder merchant number before launch.' : `Sending to ${WHATSAPP_NUMBER}.`, ok: !IS_WHATSAPP_PLACEHOLDER },
    { label: 'Batch mode', value: settings.launchMode, detail: `${analytics.reservedCount} reservations tracked out of ${analytics.batchSize}.`, ok: true },
    { label: 'Inventory alerts', value: analytics.lowStockProducts ? `${analytics.lowStockProducts} alerts` : 'Clear', detail: `${analytics.totalStock} total stock units across the catalog.`, ok: !analytics.lowStockProducts }
  ];

  return `
    <section class="admin-status-large">
      ${checks.map(check => `
        <article class="admin-panel admin-status-card ${check.ok ? 'ok' : 'warn'}">
          <span class="status-dot ${check.ok ? 'ok' : 'warn'}"></span>
          <div>
            <span class="admin-eyebrow">${esc(check.label)}</span>
            <h2>${esc(check.value)}</h2>
            <p>${esc(check.detail)}</p>
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderAdminReports(analytics) {
  return `
    <section class="admin-dashboard-grid">
      <article class="admin-panel">
        <span class="admin-eyebrow">Sales</span>
        <strong class="admin-report-number">${formatSar(analytics.orderRevenue + analytics.preorderValue)}</strong>
        <p>Includes device-local WhatsApp orders and preorder reservations.</p>
      </article>
      <article class="admin-panel">
        <span class="admin-eyebrow">Audience</span>
        <strong class="admin-report-number">${analytics.newsletter.length}</strong>
        <p>Newsletter signups captured from the storefront.</p>
      </article>
      <article class="admin-panel">
        <span class="admin-eyebrow">Inventory</span>
        <strong class="admin-report-number">${analytics.totalStock}</strong>
        <p>${analytics.lowStockProducts} low-stock product alerts.</p>
      </article>
      <article class="admin-panel admin-wide-panel">
        <div class="admin-panel-heading">
          <div>
            <span class="admin-eyebrow">Batch report</span>
            <h2>B.077 launch readiness</h2>
          </div>
          <button type="button" class="admin-primary-btn" onclick="adminExportData()">Export JSON</button>
        </div>
        <div class="admin-progress-block">
          <div class="admin-progress-track"><i style="width: ${analytics.batchProgress}%"></i></div>
          <p>${analytics.reservedCount} of ${analytics.batchSize} reserved. ${analytics.batchProgress}% batch progress.</p>
        </div>
      </article>
    </section>
  `;
}

function renderAdminInventory(analytics) {
  const rows = analytics.productRows.map(({ product, admin }) => {
    const stock = Number(admin.stock) || 0;
    const low = stock <= Number(admin.lowStockAt || 0);
    return `
      <div class="admin-table-row">
        <span class="admin-cell-strong">${esc(product.nameEn)}</span>
        <span>${esc(product.brand)} / ${esc(product.type)}</span>
        <span>${stock} units</span>
        <span>${Number(admin.lowStockAt) || 0} alert</span>
        <span><em class="admin-chip ${low ? 'off' : 'ok'}">${low ? 'Low stock' : 'Ready'}</em></span>
      </div>
    `;
  }).join('');
  return `
    <section class="admin-kpi-grid">
      ${renderAdminKpi('Total stock', analytics.totalStock, 'sellable units across catalog', 'gold')}
      ${renderAdminKpi('Low-stock alerts', analytics.lowStockProducts, 'needs refill attention', analytics.lowStockProducts ? 'danger' : 'green')}
      ${renderAdminKpi('Active products', analytics.activeProducts, 'visible on storefront', 'sand')}
      ${renderAdminKpi('Image coverage', Object.keys(productImages).length, 'WebP product assets', 'stone')}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Inventory</span><h2>Stock and thresholds</h2></div><a href="#/admin/products">Edit products</a></div>
      <div class="admin-table">
        <div class="admin-table-row admin-table-head"><span>Product</span><span>Group</span><span>Stock</span><span>Low at</span><span>Status</span></div>
        ${rows}
      </div>
    </section>
  `;
}

function renderAdminWishlist(analytics) {
  const savedIds = getWishlist();
  const rows = savedIds.length ? savedIds.map((id, index) => {
    const product = getProductById(id, { includeInactive: true });
    return `
      <div class="admin-table-row">
        <span class="admin-cell-strong">${String(index + 1).padStart(2, '0')}</span>
        <span>${esc(product?.nameEn || id)}</span>
        <span>${esc(product?.brand || 'ASMR & SAMR')}</span>
        <span>${product ? formatSar(getProductStartPrice(product)) : '-'}</span>
        <span><a href="#/product/${esc(id)}">View</a></span>
      </div>
    `;
  }).join('') : `<p class="admin-muted-note" style="padding:1.5rem;">No wishlist activity yet.</p>`;
  return `
    <section class="admin-kpi-grid">
      ${renderAdminKpi('Saved items', savedIds.length, 'wishlist entries on this browser', 'gold')}
      ${renderAdminKpi('Most saved', savedIds[0] || 'None', 'wishlist demand signal', 'sand')}
      ${renderAdminKpi('Discovery path', 'Shop', 'wishlist links stay connected', 'stone')}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Wishlist</span><h2>Saved product demand</h2></div></div>
      <div class="admin-table">
        <div class="admin-table-row admin-table-head"><span>No.</span><span>Product</span><span>Brand</span><span>Price</span><span>Link</span></div>
        ${rows}
      </div>
    </section>
  `;
}

function renderAdminRewards(analytics) {
  const customers = analytics.customers.length ? analytics.customers : [{ name: 'No customers yet', points: 0, value: 0, count: 0 }];
  const rows = customers.slice(0, 12).map(customer => {
    const points = Number(customer.points) || Math.round(Number(customer.value) || 0);
    const tier = points >= 2500 ? 'Signature' : points >= 1000 ? 'Amber' : 'Ivory';
    return `
      <div class="admin-table-row">
        <span class="admin-cell-strong">${esc(customer.name)}</span>
        <span>${tier}</span>
        <span>${points.toLocaleString('en-US')} pts</span>
        <span>${customer.count || 0} orders</span>
        <span>${formatSar(customer.value || 0)}</span>
      </div>
    `;
  }).join('');
  return `
    <section class="admin-kpi-grid">
      ${renderAdminKpi('Members', analytics.customers.length, 'customer profiles and buyers', 'gold')}
      ${renderAdminKpi('Repeat rate', `${analytics.insights.repeatRate}%`, 'returning customers', 'sand')}
      ${renderAdminKpi('Top tier', 'Signature', 'premium membership ceiling', 'stone')}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Rewards</span><h2>Membership tiers</h2></div></div>
      <div class="admin-table">
        <div class="admin-table-row admin-table-head"><span>Customer</span><span>Tier</span><span>Points</span><span>Orders</span><span>Value</span></div>
        ${rows}
      </div>
    </section>
  `;
}

function renderAdminGifting(analytics) {
  const giftRows = analytics.productRows
    .filter(({ product }) => product.id === 'duo-box' || product.id.includes('trio') || product.id === 'discovery-set')
    .map(({ product, admin }) => `
      <div class="admin-product-row" style="grid-template-columns:minmax(220px,1.2fr) 1fr 110px 120px;">
        <div class="admin-product-identity">
          <div class="admin-product-thumb">${renderProductPhoto(product)}</div>
          <div class="admin-product-info"><strong>${esc(product.nameEn)}</strong><small>${esc(admin.badge || getDefaultBadge(product))}</small></div>
        </div>
        <span>${esc(admin.leadTime || 'Gift-ready in 2-3 days')}</span>
        <strong>${Number(admin.stock) || 0} units</strong>
        <a href="#/product/${product.id}" class="admin-secondary-btn">View</a>
      </div>
    `).join('');
  return `
    <section class="admin-kpi-grid">
      ${renderAdminKpi('Gift sets', 4, 'duo, discovery, and trio rituals', 'gold')}
      ${renderAdminKpi('Gift stock', analytics.productRows.filter(r => r.product.id === 'duo-box' || r.product.id.includes('trio')).reduce((s, r) => s + (Number(r.admin.stock) || 0), 0), 'premium packaging units', 'sand')}
      ${renderAdminKpi('Primary hero', 'Duo Box', 'main gifting conversion path', 'stone')}
    </section>
    <section class="admin-panel admin-table-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Gifting</span><h2>Gift boxes and ritual sets</h2></div><a href="#/gifting">Open gifting page</a></div>
      <div class="admin-product-list">${giftRows}</div>
    </section>
  `;
}

function renderAdminPreorders(analytics) {
  return `
    <section class="admin-kpi-grid">
      ${renderAdminKpi('Pre-orders', analytics.preorders.length, 'reservation form leads', 'gold')}
      ${renderAdminKpi('Reserved value', formatSar(analytics.preorderValue), 'estimated lead revenue', 'sand')}
      ${renderAdminKpi('Batch progress', `${analytics.batchProgress}%`, `${analytics.reservedCount} of ${analytics.batchSize}`, 'stone')}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Pre-orders</span><h2>Reservation leads</h2></div><a href="#/contact">Open form</a></div>
      <div class="admin-lead-list">
        ${analytics.preorders.length ? analytics.preorders.map(renderAdminLeadRow).join('') : '<p class="admin-empty">No pre-order leads yet.</p>'}
      </div>
    </section>
  `;
}

function renderAdminNotifications(analytics) {
  const activity = analytics.adminState.activity || [];
  return `
    <section class="admin-dashboard-grid">
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Notifications</span><h2>Operational alerts</h2></div></div>
        <div class="admin-status-list">
          <div class="admin-status-row"><span class="status-dot ${analytics.lowStockProducts ? 'warn' : 'ok'}"></span><strong>Inventory</strong><small>${analytics.lowStockProducts ? `${analytics.lowStockProducts} low-stock products` : 'No stock alerts'}</small></div>
          <div class="admin-status-row"><span class="status-dot ${adminSyncError ? 'warn' : 'ok'}"></span><strong>Supabase sync</strong><small>${adminSyncError || (analytics.sync.syncedAt ? `Last synced ${formatAdminDate(analytics.sync.syncedAt)}` : 'Local mode ready')}</small></div>
          <div class="admin-status-row"><span class="status-dot ${IS_WHATSAPP_PLACEHOLDER ? 'warn' : 'ok'}"></span><strong>WhatsApp</strong><small>${IS_WHATSAPP_PLACEHOLDER ? 'Merchant number required' : 'Order CTA ready'}</small></div>
        </div>
      </article>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Activity</span><h2>Recent changes</h2></div></div>
        <div class="admin-activity-list">
          ${activity.length ? activity.slice(0, 10).map(item => `<div class="admin-activity-row"><span>${esc(item.type || 'log')}</span><div><strong>${esc(item.message)}</strong><small>${formatAdminDate(item.ts)}</small></div></div>`).join('') : '<p class="admin-empty">No admin notifications yet.</p>'}
        </div>
      </article>
    </section>
  `;
}

function renderAdminRoles(analytics) {
  const profiles = adminRemoteCache?.profiles || [];
  const rows = profiles.length ? profiles.map(profile => `
    <div class="admin-table-row">
      <span class="admin-cell-strong">${esc(profile.full_name || profile.email || profile.id)}</span>
      <span>${esc(profile.email || '-')}</span>
      <span>${esc(profile.role || 'customer')}</span>
      <span>${Number(profile.points) || 0} pts</span>
      <span>${formatAdminDate(profile.created_at)}</span>
    </div>
  `).join('') : `<p class="admin-muted-note" style="padding:1.5rem;">Connect Supabase and sign in as an admin to review role assignments.</p>`;
  return `
    <section class="admin-panel">
      <div class="admin-panel-heading"><div><span class="admin-eyebrow">Roles and permissions</span><h2>User access</h2></div></div>
      <p class="admin-muted-note">Admin access follows the existing Supabase <code>profiles.role</code> value. This screen never uses service-role credentials.</p>
      <div class="admin-table">
        <div class="admin-table-row admin-table-head"><span>Name</span><span>Email</span><span>Role</span><span>Points</span><span>Created</span></div>
        ${rows}
      </div>
    </section>
  `;
}

function renderAdminSettings(analytics) {
  const profile = adminRemoteCache?.profile;
  return `
    <section class="admin-dashboard-grid">
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Settings</span><h2>Admin profile and data source</h2></div></div>
        <div class="admin-status-list">
          <div class="admin-status-row"><span class="status-dot ${analytics.sync.configured ? 'ok' : 'warn'}"></span><strong>Supabase frontend config</strong><small>${analytics.sync.configured ? 'Configured' : 'Missing publishable key config'}</small></div>
          <div class="admin-status-row"><span class="status-dot ${profile ? 'ok' : 'warn'}"></span><strong>Admin session</strong><small>${profile ? `${esc(profile.full_name || profile.email || 'Admin')} / ${esc(profile.role)}` : 'No verified admin session in this browser'}</small></div>
          <div class="admin-status-row"><span class="status-dot ok"></span><strong>RLS posture</strong><small>Existing inspected tables have RLS enabled.</small></div>
        </div>
        ${analytics.sync.error ? `<p class="admin-muted-note" style="margin-top:1rem;">${esc(analytics.sync.error)}</p>` : ''}
      </article>
      <article class="admin-panel">
        <div class="admin-panel-heading"><div><span class="admin-eyebrow">Secure sign in</span><h2>Admin Supabase login</h2></div></div>
        <form class="admin-form" onsubmit="adminLogin(event)">
          <label>Email<input id="admin-login-email" type="email" autocomplete="email" required></label>
          <label>Password<input id="admin-login-password" type="password" autocomplete="current-password" required></label>
          <button type="submit" class="admin-primary-btn">Sign in and sync</button>
          <button type="button" class="admin-secondary-btn" onclick="adminLogout()">Sign out</button>
        </form>
      </article>
    </section>
  `;
}

function adminReadProductRow(productId) {
  const adminState = getAdminState();
  const product = getProductById(productId, { includeInactive: true });
  const current = adminState.products[productId] || {};
  const next = {
    ...current,
    prices: { ...(current.prices || {}) }
  };

  if (!product) return { adminState, next };

  next.stock = Math.max(0, Number(document.getElementById(adminSafeId('admin-stock', productId))?.value || 0));
  next.sortOrder = Math.max(1, Number(document.getElementById(adminSafeId('admin-sort', productId))?.value || current.sortOrder || 1));
  next.isActive = !!document.getElementById(adminSafeId('admin-active', productId))?.checked;
  next.featuredOnHome = !!document.getElementById(adminSafeId('admin-featured', productId))?.checked;
  next.bestSeller = !!document.getElementById(adminSafeId('admin-best', productId))?.checked;

  product.sizes.forEach(size => {
    const value = Number(document.getElementById(adminSafeId('admin-price', productId, size))?.value || 0);
    if (Number.isFinite(value)) next.prices[size] = Math.max(0, value);
  });

  return { adminState, next };
}

function adminSaveProductRow(event, productId) {
  if (event) event.preventDefault();
  const { adminState, next } = adminReadProductRow(productId);
  adminState.products[productId] = next;
  adminState.activity = [
    { message: `Updated ${productId} pricing, stock, or storefront status`, type: 'product', ts: new Date().toISOString() },
    ...(adminState.activity || [])
  ];
  persistAdminState(adminState);
  applyAdminState();
  adminPersistProductToSupabase(productId, next);
  showToast('Product updated');
  renderApp();
}

function adminOpenProductEditor(productId) {
  const product = getProductById(productId, { includeInactive: true });
  const root = document.getElementById('admin-editor-root');
  if (!product || !root) return;
  root.innerHTML = renderAdminProductEditor(product);
  document.body.classList.add('admin-editor-open');
}

function adminCloseProductEditor() {
  const root = document.getElementById('admin-editor-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('admin-editor-open');
}

function adminSaveProductDetails(event, productId) {
  if (event) event.preventDefault();
  const adminState = getAdminState();
  const current = adminState.products[productId] || {};
  adminState.products[productId] = {
    ...current,
    nameEn: (document.getElementById(adminSafeId('detail-name', productId))?.value || '').trim() || current.nameEn,
    familyEn: (document.getElementById(adminSafeId('detail-family', productId))?.value || '').trim() || current.familyEn,
    descEn: (document.getElementById(adminSafeId('detail-desc', productId))?.value || '').trim() || current.descEn,
    badge: document.getElementById(adminSafeId('detail-badge', productId))?.value || current.badge,
    heroSize: document.getElementById(adminSafeId('detail-hero', productId))?.value || current.heroSize,
    lowStockAt: Math.max(0, Number(document.getElementById(adminSafeId('detail-low', productId))?.value || current.lowStockAt || 0)),
    leadTime: (document.getElementById(adminSafeId('detail-lead', productId))?.value || '').trim() || current.leadTime
  };
  adminState.activity = [
    { message: `Updated merchandising details for ${productId}`, type: 'product', ts: new Date().toISOString() },
    ...(adminState.activity || [])
  ];
  persistAdminState(adminState);
  applyAdminState();
  adminCloseProductEditor();
  adminPersistProductToSupabase(productId, adminState.products[productId]);
  showToast('Product details saved');
  renderApp();
}

function adminFilterProducts(filter, button) {
  document.querySelectorAll('.admin-filter-group button').forEach(btn => btn.classList.toggle('active', btn === button));
  document.querySelectorAll('[data-admin-product-row]').forEach(row => {
    const show = filter === 'all'
      || row.dataset.type === filter
      || row.dataset.brand === filter
      || (filter === 'low' && row.dataset.low === 'true')
      || (filter === 'inactive' && row.dataset.active === 'false');
    row.hidden = !show;
  });
}

function adminUpdateOrderStatus(orderId, status) {
  const adminState = getAdminState();
  adminState.orderStatuses[orderId] = status;
  adminState.activity = [
    { message: `Order ${orderId} marked ${status}`, type: 'order', ts: new Date().toISOString() },
    ...(adminState.activity || [])
  ];
  persistAdminState(adminState);
  adminPersistOrderStatusToSupabase(orderId, status);
  showToast('Order status updated');
}

function adminSaveSettings(event) {
  if (event) event.preventDefault();
  const adminState = getAdminState();
  adminState.settings = {
    ...adminState.settings,
    bannerEn: (document.getElementById('admin-banner-en')?.value || '').trim(),
    bannerAr: (document.getElementById('admin-banner-ar')?.value || '').trim(),
    reservedCount: Math.max(0, Number(document.getElementById('admin-reserved-count')?.value || 0)),
    batchSize: Math.max(1, Number(document.getElementById('admin-batch-size')?.value || 77)),
    launchMode: document.getElementById('admin-launch-mode')?.value || 'preorder',
    paymentMode: document.getElementById('admin-payment-mode')?.value || 'whatsapp',
    fulfillmentCity: (document.getElementById('admin-fulfillment-city')?.value || CONFIG.PRODUCTION_CITY_EN).trim(),
    lowStockGlobal: Math.max(0, Number(document.getElementById('admin-low-stock-global')?.value || 8))
  };
  adminState.activity = [
    { message: 'Updated storefront launch content and batch settings', type: 'content', ts: new Date().toISOString() },
    ...(adminState.activity || [])
  ];
  persistAdminState(adminState);
  applyAdminState();
  adminPersistContentToSupabase(adminState.settings);
  showToast('Content settings saved');
  renderApp();
}

function adminResetState() {
  if (!window.confirm('Reset all admin edits on this device?')) return;
  localStorage.removeItem(ADMIN_STATE_KEY);
  applyAdminState();
  showToast('Admin edits reset');
  renderApp();
}

function adminAddCoupon(event) {
  event.preventDefault();
  const code = (document.getElementById('coupon-code') || {}).value?.trim().toUpperCase();
  const kind = (document.getElementById('coupon-kind') || {}).value || 'percent';
  const value = Number((document.getElementById('coupon-value') || {}).value);
  const minTotal = Number((document.getElementById('coupon-min') || {}).value) || 0;
  if (!code || !Number.isFinite(value) || value < 0) { showToast('Enter a code and a valid value'); return; }
  const st = getAdminState();
  st.coupons = getAdminCoupons().filter(c => c.code !== code);
  st.coupons.unshift({ code, kind, value, minTotal, active: true });
  persistAdminState(st);
  adminPersistCouponToSupabase({ code, kind, value, minTotal, active: true });
  recordAdminActivity(`Coupon ${code} created`, 'coupon');
  showToast(`Coupon ${code} added`);
  renderApp();
}

function adminToggleCoupon(code) {
  const st = getAdminState();
  st.coupons = getAdminCoupons().map(c => c.code === code ? { ...c, active: !c.active } : c);
  persistAdminState(st);
  const coupon = st.coupons.find(c => c.code === code);
  if (coupon) adminPersistCouponToSupabase(coupon);
  renderApp();
}

function adminDeleteCoupon(code) {
  if (!window.confirm(`Delete coupon ${code}?`)) return;
  const st = getAdminState();
  st.coupons = getAdminCoupons().filter(c => c.code !== code);
  persistAdminState(st);
  adminDeleteCouponFromSupabase(code);
  showToast(`Coupon ${code} deleted`);
  renderApp();
}

function adminCopyEmail(email) {
  if (navigator.clipboard) navigator.clipboard.writeText(email).then(() => showToast('Email copied'));
  else showToast(email);
}

async function adminLogin(event) {
  if (event) event.preventDefault();
  if (!isAdminSupabaseConfigured()) {
    showToast('Add website/config.local.js with the Supabase publishable key first');
    return;
  }
  const email = (document.getElementById('admin-login-email')?.value || '').trim();
  const password = document.getElementById('admin-login-password')?.value || '';
  try {
    const data = await adminSupabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data));
    localStorage.removeItem(ADMIN_SESSION_KEY);
    adminSyncStarted = false;
    adminSyncError = '';
    await adminSyncFromSupabase();
    const profile = await adminLoadProfileForSession();
    if (!isAdminAuthorized(profile)) {
      adminLogout();
      showToast('This account is not authorized for admin access');
      return;
    }
    showToast('Admin signed in');
    renderApp();
  } catch (error) {
    showToast('Admin sign in failed');
  }
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
  adminRemoteCache = null;
  adminSyncStarted = false;
  localStorage.removeItem(ADMIN_REMOTE_CACHE_KEY);
  showToast('Admin signed out');
  renderApp();
}

function adminRefreshSupabase() {
  adminSyncStarted = false;
  adminSyncError = '';
  adminSyncFromSupabase().then(() => {
    showToast(isAdminSupabaseConfigured() ? 'Sync complete' : 'Local admin mode active');
  }).catch(() => showToast('Sync failed'));
}

async function adminPersistProductToSupabase(productId, adminProduct) {
  if (!isAdminSupabaseConfigured()) return;
  try {
    await adminSupabaseRequest(`products?id=eq.${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        name_en: adminProduct.nameEn,
        family_en: adminProduct.familyEn,
        desc_en: adminProduct.descEn,
        hero_size: adminProduct.heroSize,
        is_active: adminProduct.isActive !== false,
        featured_on_home: !!adminProduct.featuredOnHome,
        sort_order: Number(adminProduct.sortOrder) || 1,
        badge_en: adminProduct.badge,
        updated_at: new Date().toISOString()
      })
    });
    await adminSupabaseRequest('product_inventory?on_conflict=product_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        product_id: productId,
        stock: Number(adminProduct.stock) || 0,
        low_stock_at: Number(adminProduct.lowStockAt) || 0
      })
    });
    const priceRows = Object.entries(adminProduct.prices || {}).map(([size, price]) => ({
      product_id: productId,
      size,
      price: Number(price) || 0
    }));
    if (priceRows.length) {
      await adminSupabaseRequest('product_prices?on_conflict=product_id,size', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(priceRows)
      });
    }
  } catch (error) {
    adminSyncError = error?.message || 'Could not save product to Supabase.';
  }
}

async function adminPersistOrderStatusToSupabase(orderId, status) {
  if (!isAdminSupabaseConfigured()) return;
  try {
    await adminSupabaseRequest(`orders?or=(order_no.eq.${encodeURIComponent(orderId)},id.eq.${encodeURIComponent(orderId)})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status })
    });
  } catch (error) {
    adminSyncError = error?.message || 'Could not save order status to Supabase.';
  }
}

async function adminPersistContentToSupabase(settings) {
  if (!isAdminSupabaseConfigured()) return;
  try {
    await adminSupabaseRequest('content_settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key: 'announcement_banner',
        value_en: settings.bannerEn || '',
        value_ar: settings.bannerAr || '',
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    adminSyncError = error?.message || 'Could not save content settings to Supabase.';
  }
}

async function adminPersistCouponToSupabase(coupon) {
  if (!isAdminSupabaseConfigured()) return;
  try {
    await adminSupabaseRequest('coupons?on_conflict=code', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        code: coupon.code,
        kind: coupon.kind,
        value: Number(coupon.value) || 0,
        is_active: coupon.active !== false,
        min_total: Number(coupon.minTotal) || 0,
        expires_at: coupon.expiresAt || null
      })
    });
  } catch (error) {
    adminSyncError = error?.message || 'Could not save coupon to Supabase.';
  }
}

async function adminDeleteCouponFromSupabase(code) {
  if (!isAdminSupabaseConfigured()) return;
  try {
    await adminSupabaseRequest(`coupons?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (error) {
    adminSyncError = error?.message || 'Could not delete coupon from Supabase.';
  }
}

function adminExportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    admin: getAdminState(),
    orders: getOrders(),
    preorders: getPreorders(),
    newsletter: getNewsletterSubscribers()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `asmr-samr-admin-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Admin data exported');
}

function renderLeftSidebar(ar, activeTab, profile) {
  return `
    <aside class="account-sidebar-left">
      <div class="sidebar-brand">
        <h3 class="wordmark" style="font-size: 1.1rem; letter-spacing: 0.15em; font-weight: 500; margin: 0 0 0.2rem 0; color: var(--charcoal-900); font-family: var(--font-sans); white-space: nowrap;">A S M R &nbsp;&&nbsp; S A M R</h3>
        <span style="font-size: 0.6rem; letter-spacing: 0.1em; color: var(--taupe); text-transform: uppercase; font-weight: 600;">Fragrances</span>
      </div>

      <div class="sidebar-user-card">
        <div class="user-avatar-circle">${esc((profile.name || (ar ? 'ض' : 'G')).trim()[0].toUpperCase())}</div>
        <h4 class="user-name-title">${profile.name ? esc(profile.name) : (ar ? 'ضيف' : 'Guest')}</h4>
        <p class="user-email-subtitle">${profile.email ? esc(profile.email) : (ar ? 'أضف بياناتك في التفضيلات' : 'Add your details in Preferences')}</p>
        <a href="#/account" class="view-profile-link" onclick="switchAccountTab(event, 'preferences')">${ar ? 'عرض الملف الشخصي' : 'VIEW PROFILE'}</a>
      </div>

      <nav class="sidebar-nav">
        <a href="#" class="sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}" onclick="switchAccountTab(event, 'overview')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>${ar ? 'لوحة التحكم' : 'OVERVIEW'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'orders' ? 'active' : ''}" onclick="switchAccountTab(event, 'orders')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z"/></svg>
          <span>${ar ? 'الطلبات' : 'ORDERS'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'addresses' ? 'active' : ''}" onclick="switchAccountTab(event, 'addresses')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <span>${ar ? 'العناوين' : 'ADDRESSES'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'payments' ? 'active' : ''}" onclick="switchAccountTab(event, 'payments')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <span>${ar ? 'طرق الدفع' : 'PAYMENT METHODS'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'wishlist' ? 'active' : ''}" onclick="switchAccountTab(event, 'wishlist')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span>${ar ? 'المفضلة' : 'WISHLIST'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'rewards' ? 'active' : ''}" onclick="switchAccountTab(event, 'rewards')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          <span>${ar ? 'المكافآت' : 'REWARDS'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'preferences' ? 'active' : ''}" onclick="switchAccountTab(event, 'preferences')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
          <span>${ar ? 'التفضيلات' : 'PREFERENCES'}</span>
        </a>
        <a href="#" class="sidebar-nav-item ${activeTab === 'notifications' ? 'active' : ''}" onclick="switchAccountTab(event, 'notifications')">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
          <span>${ar ? 'الإشعارات' : 'NOTIFICATIONS'}</span>
        </a>
        <a href="#" class="sidebar-nav-item" onclick="handleAccountLogout(event)">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.78 1.42l-1.42 1.42C18.27 7.2 19 9.01 19 11c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-1.99.73-3.8 2.64-5.16L6.22 4.42C4.24 6.04 3 8.37 3 11c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.63-1.24-4.96-3.22-6.58z"/></svg>
          <span>${ar ? 'تسجيل الخروج' : 'LOG OUT'}</span>
        </a>
      </nav>

      <div class="sidebar-help-box">
        <span>${ar ? 'هل تحتاج لمساعدة؟' : 'NEED HELP?'}</span>
        <p>${ar ? 'فريق خدمة العملاء والكونسيرج في خدمتكم.' : 'Our concierge is here for you.'}</p>
        <a href="mailto:hello@asmrsamr.com">HELLO@ASMRANDSAMR.COM</a>
      </div>
    </aside>
  `;
}

function renderRightSidebar(ar, profile, orders) {
  const rewards = getRewards(orders);
  const points = rewards.points;
  const btnText = ar ? 'عرض الجوائز' : 'VIEW REWARDS';
  const balanceLabel = ar ? 'رصيد النقاط' : 'REWARDS BALANCE';
  const nextTierLabel = rewards.nextThreshold
    ? (ar ? `باقي ${rewards.pointsLeft.toLocaleString('ar-EG')} نقطة للفئة التالية` : `${rewards.pointsLeft.toLocaleString()} points until next tier`)
    : (ar ? 'وصلت لأعلى فئة' : 'Top tier reached');
  const recentOrdersLabel = ar ? 'الطلبات الأخيرة' : 'RECENT ORDERS';
  const viewAllOrdersLabel = ar ? 'عرض جميع الطلبات' : 'VIEW ALL ORDERS';

  const recentOrdersListHtml = orders.slice(0, 3).map(o => {
    const d = new Date(o.ts);
    const when = d.toLocaleDateString(ar ? 'ar-SA' : 'en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
    const firstItem = (o.items || [])[0] || {};
    const qty = firstItem.qty || 1;
    const name = firstItem.name || 'Scent';
    const size = firstItem.size || '';
    const productId = firstItem.id || 'samr-extrait';
    const imgUrl = productImages[productId] ? productImages[productId].webp : '';
    const statusEn = o.status === 'delivered' ? 'DELIVERED' : 'AWAITING CONFIRMATION';
    const statusAr = o.status === 'delivered' ? 'تم التوصيل' : 'بانتظار التأكيد';
    return `
      <div class="recent-order-item">
        <div class="recent-order-thumb">
          <img src="${esc(imgUrl)}" alt="${esc(name)}" loading="lazy">
        </div>
        <div class="recent-order-details">
          <div class="recent-order-meta">${esc(o.id)} · ${when}</div>
          <h4 class="recent-order-name">${qty}× ${esc(name)}${size ? ` (${esc(size)})` : ''}</h4>
          <div class="recent-order-status-row">
            <span>${o.total} ${ar ? 'ريال' : 'SAR'}</span>
            <span class="status-delivered-chip ${o.status === 'delivered' ? '' : 'status-pending-chip'}">${ar ? statusAr : statusEn}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <aside class="account-sidebar-right">
      <div class="acct-card-light">
        <span class="campaign-meta-label" style="color:var(--taupe); font-weight:600;">${balanceLabel}</span>
        <div class="rewards-balance-score">${points.toLocaleString()} <span>${ar ? 'نقطة' : 'POINTS'}</span></div>
        <p style="font-size:0.75rem; color:var(--taupe); margin:0 0 1.2rem 0;">${nextTierLabel}</p>
        <button class="btn btn-primary" style="width:100%; font-size:0.75rem; padding:0.6rem 1rem;" onclick="switchAccountTab(event, 'rewards')">${btnText}</button>

        <div class="rewards-tiers-display">
          <span class="${rewards.tier === 'classic' ? 'active' : ''}">${ar ? 'كلاسيك' : 'CLASSIC'}</span>
          <span class="${rewards.tier === 'select' ? 'active' : ''}">${ar ? 'مختار' : 'SELECT'}</span>
          <span class="${rewards.tier === 'reserve' ? 'active' : ''}">${ar ? 'احتياطي' : 'RESERVE'}</span>
        </div>
      </div>

      <div class="acct-card-light" style="background-color: transparent; border: none; padding: 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 class="quick-access-title" style="margin:0;">${recentOrdersLabel}</h3>
          <a href="#" style="font-size:0.75rem; color:var(--gold); text-decoration:underline;" onclick="switchAccountTab(event, 'orders')">${viewAllOrdersLabel}</a>
        </div>
        <div class="recent-orders-list">
          ${recentOrdersListHtml || `<p style="font-size:0.8rem; color:var(--taupe);">${ar ? 'لا توجد طلبات سابقة.' : 'No recent orders.'}</p>`}
        </div>
      </div>
    </aside>
  `;
}

function renderAccount() {
  const profile = getProfile();
  const orders = getOrders();
  const wishlist = getWishlist();
  const rewards = getRewards(orders);
  const ar = state.lang === 'ar';
  const activeTab = state.accountTab || 'overview';
  let notifPrefs = {};
  try { notifPrefs = JSON.parse(localStorage.getItem('asmr_samr_notif')) || {}; } catch (e) { notifPrefs = {}; }
  
  const typeLabel = { cart: t('acct_type_cart'), 'buy-now': t('acct_type_buynow'), preorder: t('acct_type_preorder') };

  let mainContentHtml = '';

  if (activeTab === 'overview') {
    const points = rewards.points;
    const progressPercent = Math.min(100, (points / 5000) * 100);
    const duoBoxImg = productImages['duo-box'] ? productImages['duo-box'].webp : '';
    const memberSinceStr = rewards.memberSince
      ? rewards.memberSince.toLocaleDateString(ar ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short' })
      : (ar ? 'عضو جديد' : 'New member');
    const tierStr = ar ? rewards.tierAr : rewards.tierEn;

    mainContentHtml = `
      <h1 class="serif-display" style="font-size: clamp(2rem, 3vw, 2.5rem); margin-bottom: 0.5rem; text-transform: uppercase; color: var(--charcoal-900); font-weight: 500;">
        ${ar ? 'مرحباً بعودتك' : 'WELCOME BACK'}
      </h1>
      <p class="account-subtitle" style="margin-bottom: 2rem;">
        ${ar ? 'إدارة الطلبات، البيانات الشخصية والتفضيلات.' : 'Manage your orders, details and preferences.'}
      </p>

      <!-- Campaign Banner Card -->
      <div class="account-campaign-card" style="background-image: url('${duoBoxImg}');">
        <div class="campaign-overlay-content">
          <span class="campaign-meta-label">${ar ? 'عضو منذ' : 'MEMBER SINCE'}</span>
          <div class="campaign-meta-value">${memberSinceStr}</div>

          <span class="campaign-meta-label">${ar ? 'فئة الحساب' : 'ACCOUNT STATUS'}</span>
          <div class="campaign-meta-value">${tierStr}${ar ? '' : ' TIER'}</div>

          <div class="campaign-progress-bar-container">
            <span class="campaign-meta-label">${ar ? 'التقدم للفئة التالية' : 'TIER PROGRESS'}</span>
            <div class="campaign-progress-bar">
              <div class="campaign-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
            <div class="campaign-progress-text">${points.toLocaleString()} / 5,000 ${ar ? 'نقطة' : 'POINTS'}</div>
          </div>
        </div>
      </div>

      <!-- Quick Access Grid -->
      <div class="quick-access-section">
        <h3 class="quick-access-title">${ar ? 'وصول سريع' : 'QUICK ACCESS'}</h3>
        <div class="quick-access-grid">
          <a href="#" class="quick-access-card" onclick="switchAccountTab(event, 'orders')">
            <svg class="quick-card-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z"/></svg>
            <h4 class="quick-card-title">${ar ? 'عرض الطلبات' : 'VIEW ORDERS'}</h4>
            <p class="quick-card-desc">${ar ? 'تتبع شحناتك، الإرجاع، أو الشراء مرة أخرى.' : 'Track, return or buy again.'}</p>
            <span class="quick-card-arrow">&rarr;</span>
          </a>
          
          <a href="#" class="quick-access-card" onclick="switchAccountTab(event, 'addresses')">
            <svg class="quick-card-icon" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <h4 class="quick-card-title">${ar ? 'العناوين' : 'ADDRESSES'}</h4>
            <p class="quick-card-desc">${ar ? 'إدارة عناوين الشحن والتوصيل.' : 'Manage your shipping addresses.'}</p>
            <span class="quick-card-arrow">&rarr;</span>
          </a>
          
          <a href="#" class="quick-access-card" onclick="switchAccountTab(event, 'payments')">
            <svg class="quick-card-icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            <h4 class="quick-card-title">${ar ? 'طرق الدفع' : 'PAYMENT METHODS'}</h4>
            <p class="quick-card-desc">${ar ? 'تحديث بطاقات الدفع المحفوظة.' : 'Update your saved payment methods.'}</p>
            <span class="quick-card-arrow">&rarr;</span>
          </a>
          
          <a href="#" class="quick-access-card" onclick="switchAccountTab(event, 'wishlist')">
            <svg class="quick-card-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <h4 class="quick-card-title">${ar ? 'المفضلة' : 'WISHLIST'}</h4>
            <p class="quick-card-desc">${ar ? 'عطورك المفضلة، المحفوظة لوقت لاحق.' : 'Your favorite scents, saved for later.'}</p>
            <span class="quick-card-arrow">&rarr;</span>
          </a>
        </div>
      </div>

      <!-- Concierge Footer Badges Strip -->
      <div class="concierge-badges-strip">
        <div class="concierge-badge-item">
          <svg class="concierge-badge-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <div class="concierge-badge-text">
            <h4>${ar ? 'عينات مجانية' : 'COMPLIMENTARY SAMPLES'}</h4>
            <p style="margin:0;">${ar ? 'مع كل طلب، مختارة بعناية من إبداعاتنا.' : 'With every order, selected exclusively for you.'}</p>
          </div>
        </div>
        <div class="concierge-badge-item">
          <svg class="concierge-badge-icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <div class="concierge-badge-text">
            <h4>${ar ? 'شحن مجاني' : 'COMPLIMENTARY SHIPPING'}</h4>
            <p style="margin:0;">${ar ? 'شحن مجاني وسريع لكافة الطلبات.' : 'Enjoy complimentary shipping on all orders.'}</p>
          </div>
        </div>
        <div class="concierge-badge-item">
          <svg class="concierge-badge-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <div class="concierge-badge-text">
            <h4>${ar ? 'وصول حصري' : 'EXCLUSIVE ACCESS'}</h4>
            <p style="margin:0;">${ar ? 'كن أول من يعرف عن الدفعات الجديدة والإصدارات الخاصة.' : 'Be the first to discover new creations and limited editions.'}</p>
          </div>
        </div>
        <div class="concierge-badge-item">
          <svg class="concierge-badge-icon" viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>
          <div class="concierge-badge-text">
            <h4>${ar ? 'خدمة كونسيرج مخصصة' : 'CONCIERGE SERVICE'}</h4>
            <p style="margin:0;">${ar ? 'توجيه عطور شخصي ودعم مخصص لحسابك.' : 'Personal fragrance guidance and dedicated support.'}</p>
          </div>
        </div>
      </div>
    `;
  } else if (activeTab === 'orders') {
    const ordersHtml = orders.length === 0
      ? `<p class="account-empty" style="text-align:center; padding:3rem; color:var(--taupe);">${t('acct_no_orders')}</p>`
      : orders.map(o => {
          const d = new Date(o.ts);
          const when = d.toLocaleDateString(ar ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
          const summary = (o.items || []).map(i => `${i.qty}× ${i.name} (${i.size})`).join(' · ');
          return `
            <div class="account-order-row" style="display:flex; justify-content:space-between; align-items:center; padding:1.5rem; border-bottom:1px solid rgba(0,0,0,0.05);">
              <div>
                <span class="account-order-type text-gold" style="font-weight:600; font-size:0.75rem; text-transform:uppercase; display:block; margin-bottom:0.2rem;">${typeLabel[o.type] || o.type}</span>
                <span class="account-order-date" style="font-size:0.8rem; color:var(--taupe);">${when} · ${o.id}</span>
                <p class="account-order-items" style="font-size:0.9rem; margin:0.4rem 0 0; color:var(--charcoal-900);">${summary}</p>
              </div>
              <div style="text-align:right;">
                <span class="account-order-total" style="font-weight:600; display:block; margin-bottom:0.5rem;">${o.total} ${ar ? 'ريال' : 'SAR'}</span>
                <button class="btn btn-outline account-btn-small" style="padding:0.3rem 0.8rem; font-size:0.75rem;" onclick="resendOrder('${o.id}')">${t('acct_resend')}</button>
              </div>
            </div>`;
        }).join('');

    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'سجل الطلبات' : 'Order History'}</h2>
      <div class="acct-card-light" style="padding:0;">
        ${ordersHtml}
      </div>
    `;
  } else if (activeTab === 'addresses') {
    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'عناوين التوصيل' : 'Shipping Addresses'}</h2>
      <div class="acct-card-light">
        <form onsubmit="event.preventDefault(); saveProfileData(undefined, undefined, undefined, document.getElementById('addr-city').value.trim(), document.getElementById('addr-street').value.trim()); showToast(state.lang === 'ar' ? 'تم حفظ العنوان' : 'Address saved'); renderApp();" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label class="account-label" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'الدولة' : 'Country'}</label>
            <input type="text" class="form-input" value="${ar ? 'المملكة العربية السعودية' : 'Saudi Arabia'}" disabled style="opacity:0.6;">
          </div>
          <div>
            <label class="account-label" for="addr-city" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'المدينة' : 'City'}</label>
            <input type="text" id="addr-city" class="form-input" value="${esc(profile.city)}" placeholder="e.g. Riyadh">
          </div>
          <div>
            <label class="account-label" for="addr-street" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'عنوان الشارع والحي' : 'Street & District'}</label>
            <input type="text" id="addr-street" class="form-input" value="${esc(profile.address)}" placeholder="e.g. Al Olaya, Tahlia St.">
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:100%;">${ar ? 'حفظ العنوان' : 'Save Address'}</button>
        </form>
      </div>
    `;
  } else if (activeTab === 'payments') {
    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'طريقة الدفع' : 'How Payment Works'}</h2>
      <div class="acct-card-light" style="display:flex; flex-direction:column; gap:1.5rem;">
        <p style="font-size:0.9rem; color:var(--charcoal-900); margin:0; line-height:1.7;">
          ${ar
            ? 'خلال إطلاق الدفعة B.077، تتم الطلبات عبر واتساب. بعد تأكيد طلبك، نرسل لك تفاصيل الدفع لاختيار الطريقة المناسبة لك:'
            : 'During the Batch B.077 launch, orders are placed over WhatsApp. After we confirm your order, we send you payment details so you can choose the method that suits you:'}
        </p>
        <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1rem;">
          <li style="display:flex; gap:0.8rem; align-items:flex-start;">
            <span style="color:var(--gold); font-size:1.1rem;">✔</span>
            <div>
              <h4 style="font-size:0.9rem; font-weight:600; margin:0 0 0.2rem 0; color:var(--charcoal-900);">${ar ? 'تحويل بنكي مباشر' : 'Direct Bank Transfer'}</h4>
              <p style="font-size:0.8rem; color:var(--taupe); margin:0;">${ar ? 'نرسل تفاصيل الحساب البنكي (IBAN) بعد تأكيد الطلب.' : 'We share our bank (IBAN) details once your order is confirmed.'}</p>
            </div>
          </li>
          <li style="display:flex; gap:0.8rem; align-items:flex-start;">
            <span style="color:var(--gold); font-size:1.1rem;">✔</span>
            <div>
              <h4 style="font-size:0.9rem; font-weight:600; margin:0 0 0.2rem 0; color:var(--charcoal-900);">${ar ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</h4>
              <p style="font-size:0.8rem; color:var(--taupe); margin:0;">${ar ? 'متاح داخل المملكة العربية السعودية.' : 'Available within Saudi Arabia.'}</p>
            </div>
          </li>
        </ul>
        <p style="font-size:0.78rem; color:var(--taupe); margin:0; font-style:italic; line-height:1.5;">
          ${ar ? 'لا نحفظ أي بيانات بطاقات على هذا الموقع.' : 'No card details are stored on this site.'}
        </p>
      </div>
    `;
  } else if (activeTab === 'wishlist') {
    const list = getWishlist();
    const listHtml = list.length === 0
      ? `<p style="text-align:center; padding:3rem; color:var(--taupe); font-size:0.9rem;">${ar ? 'قائمة الأمنيات فارغة.' : 'Your wishlist is empty.'}</p>`
      : list.map(pid => {
          const product = getProductById(pid);
          if (!product) return '';
          const nameLabel = ar ? product.nameAr : product.nameEn;
          const heroSize = product.heroSize || product.sizes[0];
          const price = product.prices[heroSize];
          const imgUrl = productImages[product.id] ? productImages[product.id].webp : '';
          return `
            <div style="display:flex; align-items:center; gap:1.5rem; padding:1.5rem 0; border-bottom:1px solid rgba(0,0,0,0.05);">
              <div style="width:60px; height:60px; background-color:#E8E3D9; border-radius:4px; overflow:hidden;">
                <img src="${imgUrl}" alt="${nameLabel}" style="width:100%; height:100%; object-fit:cover;">
              </div>
              <div style="flex:1;">
                <h4 style="font-size:0.9rem; font-weight:600; margin:0 0 0.2rem 0; color:var(--charcoal-900);">${nameLabel}</h4>
                <p style="font-size:0.75rem; color:var(--taupe); margin:0;">${price} ${t('sar')} / ${heroSize}</p>
              </div>
              <div style="display:flex; gap:0.8rem; align-items:center;">
                <button class="btn btn-primary" style="padding:0.4rem 1rem; font-size:0.75rem;" onclick="addToCart('${product.id}', '${heroSize}', ${price}); showToast(state.lang === 'ar' ? 'تمت الإضافة للسلة' : 'Added to cart');">${t('add_to_cart')}</button>
                <a href="#" style="font-size:0.75rem; color:var(--taupe); text-decoration:underline;" onclick="event.preventDefault(); toggleWishlist('${product.id}');">${ar ? 'إزالة' : 'Remove'}</a>
              </div>
            </div>`;
        }).join('');

    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'قائمة الأمنيات' : 'My Wishlist'}</h2>
      <div class="acct-card-light" style="padding: 0 2rem;">
        ${listHtml}
      </div>
    `;
  } else if (activeTab === 'rewards') {
    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'برنامج المكافآت' : 'Rewards Program'}</h2>
      <div class="acct-card-light" style="display:flex; flex-direction:column; gap:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div>
            <h3 class="serif-display" style="font-size:1.6rem; color:var(--gold); margin:0 0 0.3rem 0;">${ar ? rewards.tierAr : rewards.tierEn} ${ar ? '' : 'TIER'}</h3>
            <p style="font-size:0.8rem; color:var(--taupe); margin:0;">${rewards.points.toLocaleString()} ${ar ? 'نقطة · تُكتسب نقطة لكل ريال تنفقه' : 'points · earn 1 point for every 1 SAR spent'}</p>
          </div>
          <div style="text-align:${ar ? 'left' : 'right'};">
            <div class="rewards-balance-score" style="margin:0;">${rewards.points.toLocaleString()}<span> ${ar ? 'نقطة' : 'PTS'}</span></div>
          </div>
        </div>
        <div>
          <p style="font-size:0.85rem; color:var(--taupe); margin:0; line-height:1.6;">
            ${rewards.nextThreshold
              ? (ar
                  ? `أنفق ما يعادل ${rewards.pointsLeft.toLocaleString('ar-EG')} نقطة إضافية للترقّي إلى الفئة التالية والحصول على مزايا أوسع.`
                  : `Spend ${rewards.pointsLeft.toLocaleString()} SAR more to reach the next tier and unlock further privileges.`)
              : (ar
                  ? 'لقد وصلت إلى أعلى فئة — احتياطي. تتمتع بجميع مزايا الدار.'
                  : 'You have reached our highest tier — Reserve. All house privileges are active for you.')}
          </p>
        </div>
        <div style="border-top:1px solid rgba(0,0,0,0.05); padding-top:1.5rem;">
          <h4 style="font-size:0.85rem; font-weight:600; margin:0 0 0.8rem 0; color:var(--charcoal-900); text-transform:uppercase;">${ar ? 'المزايا النشطة' : 'Active Privileges'}</h4>
          <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:0.6rem; font-size:0.8rem; color:var(--taupe);">
            <li style="display:flex; gap:0.5rem; align-items:center;"><span style="color:var(--gold);">✔</span> ${ar ? 'شحن كونسيرج مجاني لجميع الطلبات في المملكة' : 'Complimentary shipping on all local orders'}</li>
            <li style="display:flex; gap:0.5rem; align-items:center;"><span style="color:var(--gold);">✔</span> ${ar ? 'إمكانية حجز الدفعات القادمة قبل الطرح العام بـ ٤٨ ساعة' : '48-hour reservation priority on upcoming batches'}</li>
            <li style="display:flex; gap:0.5rem; align-items:center;"><span style="color:var(--gold);">✔</span> ${ar ? 'نقش مجاني مخصص بالليزر على زجاجات عطور ١٠٠ مل' : 'Complimentary bottle engraving on all 100ml Extraits'}</li>
          </ul>
        </div>
      </div>
    `;
  } else if (activeTab === 'preferences') {
    mainContentHtml = `
      <h2 class="serif-display" style="font-size: 2rem; color: var(--charcoal-900); margin-bottom: 1.5rem;">${t('acct_profile')}</h2>
      <div class="acct-card-light">
        <form onsubmit="saveProfileFromForm(event)" novalidate style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label class="account-label" for="acct-name" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${t('acct_name')}</label>
            <input type="text" id="acct-name" class="form-input" value="${(profile.name || '').replace(/"/g, '&quot;')}" autocomplete="name" placeholder="e.g. Yousif">
          </div>
          
          <div>
            <label class="account-label" for="acct-phone" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${t('acct_phone')}</label>
            <input type="tel" id="acct-phone" class="form-input" value="${(profile.phone || '').replace(/"/g, '&quot;')}" autocomplete="tel" dir="ltr" style="text-align: start;" placeholder="e.g. +966 50 000 0000">
          </div>

          <div>
            <label class="account-label" for="acct-email" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'البريد الإلكتروني' : 'Email Address'}</label>
            <input type="email" id="acct-email" class="form-input" value="${(profile.email || '').replace(/"/g, '&quot;')}" autocomplete="email" placeholder="e.g. client@brand.com">
          </div>

          <div>
            <label class="account-label" for="acct-city" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'المدينة' : 'City'}</label>
            <input type="text" id="acct-city" class="form-input" value="${(profile.city || '').replace(/"/g, '&quot;')}" placeholder="e.g. Riyadh">
          </div>

          <div>
            <label class="account-label" for="acct-address" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'عنوان التوصيل (الحي، الشارع)' : 'Delivery Address (District, Street)'}</label>
            <input type="text" id="acct-address" class="form-input" value="${(profile.address || '').replace(/"/g, '&quot;')}" placeholder="e.g. Al Olaya, Tahlia St.">
          </div>

          <div>
            <label class="account-label" for="acct-preference" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; display:block;">${ar ? 'تفضيل العطر' : 'Scent Preference'}</label>
            <select id="acct-preference" class="form-select" style="width: 100%; height: 44px; background-color: var(--charcoal-900); border: 1px solid var(--border-whisper); color: var(--ivory-100); padding: 0 1rem; font-family: var(--font-sans);">
              <option value="both" ${profile.preference === 'both' ? 'selected' : ''}>${ar ? 'كلاهما (أسمر وسَمَر)' : 'Both (ASMR & SAMR)'}</option>
              <option value="asmr" ${profile.preference === 'asmr' ? 'selected' : ''}>${ar ? 'أسمر (له)' : 'ASMR (Him)'}</option>
              <option value="samr" ${profile.preference === 'samr' ? 'selected' : ''}>${ar ? 'سَمَر (لها)' : 'SAMR (Her)'}</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 1rem; width: 100%;">${t('acct_save')}</button>
          <p id="acct-save-feedback" class="account-feedback" style="display:none; text-align: center; margin-top: 0.5rem;"></p>
        </form>
        
        <hr style="border:none; border-top:1px solid rgba(0,0,0,0.06); margin: 2rem 0;">
        
        <p class="account-label" style="font-size:0.8rem; color:var(--gold); text-transform:uppercase; margin-bottom:0.6rem;">${t('acct_lang')}</p>
        <button class="btn btn-outline account-btn-small" onclick="document.getElementById('lang-btn').click()">
          ${state.lang === 'en' ? 'العربية' : 'English'}
        </button>
        <hr style="border:none; border-top:1px solid rgba(0,0,0,0.06); margin: 2rem 0;">
        <button class="btn btn-outline account-btn-small account-danger" onclick="clearAccountData()">${t('acct_clear')}</button>
      </div>
    `;
  } else if (activeTab === 'notifications') {
    mainContentHtml = `
      <h2 class="serif-display" style="font-size:2rem; color:var(--charcoal-900); margin-bottom:1.5rem;">${ar ? 'تفضيلات الإشعارات' : 'Notification Preferences'}</h2>
      <form class="acct-card-light" style="display:flex; flex-direction:column; gap:1.2rem;" onsubmit="saveNotificationPrefs(event)">
        <label style="display:flex; align-items:center; gap:0.8rem; font-size:0.85rem; color:var(--charcoal-900); cursor:pointer;">
          <input type="checkbox" id="notif-whatsapp" ${notifPrefs.whatsapp !== false ? 'checked' : ''} style="accent-color:var(--gold); width:18px; height:18px;">
          <span>${ar ? 'رسائل واتساب للمبيعات والكونسيرج' : 'WhatsApp sales & concierge updates'}</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.8rem; font-size:0.85rem; color:var(--charcoal-900); cursor:pointer;">
          <input type="checkbox" id="notif-email" ${notifPrefs.email !== false ? 'checked' : ''} style="accent-color:var(--gold); width:18px; height:18px;">
          <span>${ar ? 'إشعارات حجز الدفعات الجديدة عبر البريد الإلكتروني' : 'Email notifications for upcoming numbered batch releases'}</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.8rem; font-size:0.85rem; color:var(--charcoal-900); cursor:pointer;">
          <input type="checkbox" id="notif-sms" ${notifPrefs.sms !== false ? 'checked' : ''} style="accent-color:var(--gold); width:18px; height:18px;">
          <span>${ar ? 'رسائل تأكيد الطلب الفورية عبر SMS' : 'Instant SMS order status & tracking receipts'}</span>
        </label>
        <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:100%;">${ar ? 'حفظ الخيارات' : 'Save Preferences'}</button>
      </form>
    `;
  }

  return `
    <div class="account-dashboard-wrapper">
      <div class="account-page-layout">
        <!-- Left Sidebar Panel -->
        ${renderLeftSidebar(ar, activeTab, profile)}
        
        <!-- Main Area Panel -->
        <main class="account-main-area">
          ${mainContentHtml}
        </main>
        
        <!-- Right Sidebar Panel -->
        ${renderRightSidebar(ar, profile, orders)}
      </div>
    </div>
  `;
}

// WhatsApp Link Generator
function checkoutToWhatsApp() {
  syncCartWithCatalog();
  if (state.cart.length === 0) return;

  let message = '';
  if (state.lang === 'ar') {
    message = `مرحباً دار عطور أسمر وسَمَر، أود تقديم طلب لشراء المنتجات التالية:\n\n`;
    state.cart.forEach((item, index) => {
      const totalItemVal = item.price * item.quantity;
      message += `${index + 1}. عطر: ${item.nameAr}\n   الحجم: ${item.size}\n   الكمية: ${item.quantity}\n   السعر: ${totalItemVal} ريال سعودي\n\n`;
    });
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = Math.round(subtotal * 0.15);
    const total = subtotal + vat;
    message += `المجموع الفرعي: ${subtotal} ريال سعودي\n`;
    message += `ضريبة القيمة المضافة (15%): ${vat} ريال سعودي\n`;
    message += `المجموع الكلي التقريبي: ${total} ريال سعودي\n\n`;
    message += `الرقم المرجعي للدفعة: B.077\n`;
    message += `يرجى تزويدي بتفاصيل الدفع والحساب البنكي لشحن طلبي من ${CONFIG.PRODUCTION_CITY_AR}. شكراً لكم.`;
  } else {
    message = `Hello ASMR & SAMR Fragrances, I would like to place an order for:\n\n`;
    state.cart.forEach((item, index) => {
      const totalItemVal = item.price * item.quantity;
      message += `${index + 1}. Fragrance: ${item.nameEn}\n   Size: ${item.size}\n   Qty: ${item.quantity}\n   Price: ${totalItemVal} SAR\n\n`;
    });
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = Math.round(subtotal * 0.15);
    const total = subtotal + vat;
    message += `Subtotal: ${subtotal} SAR\n`;
    message += `VAT (15%): ${vat} SAR\n`;
    message += `Total Estimate: ${total} SAR\n\n`;
    message += `Batch Reference: B.077\n`;
    message += `Please provide details to finalize my transfer. Shipped from ${CONFIG.PRODUCTION_CITY_EN}. Thank you.`;
  }

  const profile = getProfile();
  if (profile.name || profile.phone) {
    message += state.lang === 'ar'
      ? `\n\nالاسم: ${profile.name || '-'}\nواتساب: ${profile.phone || '-'}`
      : `\n\nName: ${profile.name || '-'}\nWhatsApp: ${profile.phone || '-'}`;
  }

  const orderSubtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  logOrder('cart',
    state.cart.map(i => ({ id: i.id, name: state.lang === 'ar' ? i.nameAr : i.nameEn, size: i.size, qty: i.quantity, price: i.price })),
    orderSubtotal + Math.round(orderSubtotal * 0.15), message);

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

// Generate single WhatsApp prefill order link directly from product detail page
function buyNowWhatsApp(productId, size, price) {
  const product = getProductById(productId);
  if (!product) return;
  const currentPrice = Number(product.prices[size] || price || 0);
  if (!product.sizes.includes(size) || !currentPrice) return;

  const total = currentPrice + Math.round(currentPrice * 0.15);
  let message = '';
  if (state.lang === 'ar') {
    message = `مرحباً دار عطور أسمر وسَمَر، أود حجز وشراء التالي مباشرة:\n`;
    message += `المنتج: ${product.nameAr}\n`;
    message += `الحجم: ${size}\n`;
    message += `السعر: ${currentPrice} ريال سعودي (+ الضريبة: ${total} ريال)\n\n`;
    message += `الرمز المرجعي للدفعة: B.077\n`;
    message += `أرجو تزويدي بالدفع عبر التحويل البنكي والتوصيل للعنوان الخاص بي.`;
  } else {
    message = `Hello ASMR & SAMR, I would like to purchase directly:\n`;
    message += `Product: ${product.nameEn}\n`;
    message += `Size: ${size}\n`;
    message += `Price: ${currentPrice} SAR (+ VAT: ${total} SAR)\n\n`;
    message += `Batch Reference: B.077\n`;
    message += `Please send payment bank transfer instructions.`;
  }

  logOrder('buy-now',
    [{ id: product.id, name: state.lang === 'ar' ? product.nameAr : product.nameEn, size, qty: 1, price: currentPrice }],
    total, message);

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
}

// Render dynamic site shell & routing templates
function renderHeader() {
  const headerHtml = `
    <div class="announcement-banner">
      ${getPublicAnnouncementBanner()}
    </div>
    <div class="discovery-banner" style="background-color: var(--charcoal-900); border-bottom: 1px solid var(--border-whisper); text-align: center; padding: 0.5rem 1rem; font-size: 0.8rem; font-family: var(--font-sans); letter-spacing: 0.05em; display: flex; justify-content: center; align-items: center; min-height: 32px;">
      <a href="#/product/discovery-set" style="color: var(--gold-light); text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; transition: color var(--transition-smooth); font-weight: 300;">
        <span>${state.lang === 'ar' ? 'جرب العينة الثنائية بـ ٦٠ ريال فقط — تُسترد عند شراء زجاجة كاملة' : 'Try both for 60 SAR — redeemable against your full bottle'}</span>
        <span style="font-size: 0.9rem;">&rarr;</span>
      </a>
    </div>
    <div class="container-custom header-container">
      <button class="mobile-nav-toggle" id="mobile-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <a href="#/" class="wordmark wordmark-link text-ivory" aria-label="${state.lang === 'ar' ? 'أسمر وسَمَر — الصفحة الرئيسية' : 'ASMR & SAMR — home'}" style="font-size: 1.5rem; text-decoration: none; font-weight: 500;"><span style="color: var(--asmr-accent); font-weight: 600;">A S M R</span> &nbsp;&&nbsp; <span style="color: var(--samr-accent); font-weight: 600;">S A M R</span></a>
      <nav id="nav-wrapper">
        <ul class="nav-links" id="nav-links">
          <li><a href="#/" class="${state.currentRoute === '#/' ? 'text-gold' : ''}">${t('nav_home')}</a></li>
          <li><a href="#/samr" class="${state.currentRoute === '#/samr' ? 'text-gold' : ''}">${t('nav_samr')}</a></li>
          <li><a href="#/asmr" class="${state.currentRoute === '#/asmr' ? 'text-gold' : ''}">${t('nav_asmr')}</a></li>
          <li><a href="#/shop" class="${state.currentRoute.startsWith('#/shop') || state.currentRoute.startsWith('#/product') ? 'text-gold' : ''}">${t('nav_shop')}</a></li>
          <li><a href="#/gifting" class="${state.currentRoute === '#/gifting' ? 'text-gold' : ''}">${t('nav_gifting')}</a></li>
          <li><a href="#/story" class="${state.currentRoute === '#/story' ? 'text-gold' : ''}">${t('nav_story')}</a></li>
          <li><a href="#/contact" class="${state.currentRoute === '#/contact' ? 'text-gold' : ''}">${t('nav_contact')}</a></li>
        </ul>
      </nav>
      <div class="nav-controls">
        <button class="nav-btn" id="lang-btn" aria-label="Switch Language / تغيير اللغة">
          <span>${state.lang === 'en' ? 'العربية' : 'EN'}</span>
        </button>
        <a class="nav-btn ${state.currentRoute.startsWith('#/account') ? 'is-active' : ''}" id="account-btn" href="#/account" aria-label="${t('account_title')}" aria-current="${state.currentRoute.startsWith('#/account') ? 'page' : 'false'}" style="display: inline-flex; align-items: center; text-decoration: none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
        <button class="nav-btn cart-trigger" id="cart-trigger-btn" aria-label="${t('cart_title')}" aria-expanded="false" aria-controls="cart-drawer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <span class="cart-badge" id="cart-badge" style="display: none;">0</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById('header-root').innerHTML = headerHtml;

  // Translate static cart drawer labels on language toggle
  const drawerTitle = document.getElementById('cart-title-label');
  if (drawerTitle) drawerTitle.innerText = t('cart_title');
  const drawerVatLabel = document.getElementById('cart-vat-label');
  if (drawerVatLabel) drawerVatLabel.innerText = t('vat_note');
  const drawerCheckoutBtn = document.getElementById('cart-checkout-btn');
  if (drawerCheckoutBtn) drawerCheckoutBtn.innerText = t('checkout_text');

  const subLabel = document.getElementById('cart-label-subtotal');
  if (subLabel) subLabel.innerText = state.lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal';
  const vatLabel = document.getElementById('cart-label-vat');
  if (vatLabel) vatLabel.innerText = state.lang === 'ar' ? 'ضريبة القيمة المضافة (+١٥٪)' : 'VAT (+15%)';
  const totLabel = document.getElementById('cart-label-total');
  if (totLabel) totLabel.innerText = state.lang === 'ar' ? 'المجموع الكلي التقريبي' : 'Total Estimate';

  // Event Listeners for Header Actions
  document.getElementById('lang-btn').addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'ar' : 'en';
    localStorage.setItem('asmr_samr_lang', state.lang);
    document.documentElement.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', state.lang);
    renderApp();
  });

  document.getElementById('cart-trigger-btn').addEventListener('click', openCartDrawer);

  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  mobileToggle.addEventListener('click', () => {
    if (mobileToggle.classList.contains('open')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      closeMobileNav();
    });
  });
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;
  syncCartWithCatalog();

  if (state.cart.length === 0) {
    container.innerHTML = `<div style="text-align: center; margin-top: 4rem; color: var(--taupe);">${t('cart_empty')}</div>`;
    document.getElementById('cart-subtotal').innerText = `0 ${t('sar')}`;
    document.getElementById('cart-vat').innerText = `0 ${t('sar')}`;
    document.getElementById('cart-total').innerText = `0 ${t('sar')}`;
    document.getElementById('cart-checkout-btn').disabled = true;
    document.getElementById('cart-checkout-btn').style.opacity = 0.5;
    return;
  }

  let itemsHtml = '';
  let subtotal = 0;

  state.cart.forEach(item => {
    const totalItemVal = item.price * item.quantity;
    subtotal += totalItemVal;
    const name = state.lang === 'ar' ? item.nameAr : item.nameEn;

    itemsHtml += `
      <div class="cart-item">
        <div class="cart-item-detail">
          <div class="cart-item-name">${name}</div>
          <div class="cart-item-meta">${item.size} — ${item.price} ${t('sar')}</div>
          <div class="cart-item-actions">
            <div style="display: flex; align-items: center; border: 1px solid var(--border-whisper);">
              <button class="qty-btn" onclick="updateCartQty('${item.id}', '${item.size}', -1)" aria-label="Decrease quantity">-</button>
              <span class="qty-val" aria-live="polite">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.id}', '${item.size}', 1)" aria-label="Increase quantity">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}', '${item.size}')">${state.lang === 'ar' ? 'إزالة' : 'Remove'}</button>
          </div>
        </div>
        <div style="font-family: var(--font-serif); font-size: 1.1rem; color: var(--gold);">${totalItemVal} ${t('sar')}</div>
      </div>
    `;
  });

  container.innerHTML = itemsHtml;

  const vat = Math.round(subtotal * 0.15);
  const total = subtotal + vat;

  document.getElementById('cart-subtotal').innerText = `${subtotal} ${t('sar')}`;
  document.getElementById('cart-vat').innerText = `${vat} ${t('sar')}`;
  document.getElementById('cart-total').innerText = `${total} ${t('sar')}`;
  
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  checkoutBtn.disabled = false;
  checkoutBtn.style.opacity = 1;
}

// Page View Creators
function renderHome() {
  preloadHeroImage(heroImages.landing);
  const featured = getFeaturedProducts();
  let featuredHtml = '';

  featured.forEach(p => {
    const name = state.lang === 'ar' ? p.nameAr : p.nameEn;
    const desc = state.lang === 'ar' ? p.descAr : p.descEn;
    const startPrice = p.prices[p.heroSize];

    featuredHtml += `
      <a href="#/product/${p.id}" class="product-card" aria-label="${name} - ${state.lang === 'ar' ? 'عرض التفاصيل والطلب' : 'View details and order'}">
        <span class="card-badge">${t('numbered_badge')}</span>
        <div class="product-card-visual">
          ${renderProductPhoto(p)}
        </div>
        <div>
          <span class="brand-tag">${p.brand}</span>
          <h3 class="product-name">${name}</h3>
          <p class="product-desc">${desc}</p>
        </div>
        <div class="card-action-row">
          <div class="product-price">
            ${startPrice} ${t('sar')}
            <small>/ ${p.heroSize}</small>
          </div>
          <span class="text-gold" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'عرض التفاصيل ←' : 'View Details →'}</span>
        </div>
      </a>
    `;
  });

  return `
    <!-- Editorial Landing Hero -->
    <section class="landing-reference-hero" aria-label="Brand Introduction" style="--landing-hero-photo: url('${heroImages.landing}')">
      <div class="landing-hero-copy">
        <h1 class="landing-title serif-display">
          ${state.lang === 'ar' ? '\u062D\u0636\u0648\u0631<br>\u064A\u0628\u0642\u0649.' : 'Presence<br>that <em>stays</em>.'}
        </h1>
        <div class="landing-rule" aria-hidden="true"></div>
        <span class="landing-kicker">${state.lang === 'ar' ? '\u0637\u0627\u0642\u062A\u0627\u0646. \u062A\u0648\u0642\u064A\u0639 \u0648\u0627\u062D\u062F.' : 'Two energies. One signature.'}</span>
        <p class="landing-subtitle">
          ${state.lang === 'ar' ? '\u0623\u0633\u0645\u0631 \u0648\u0633\u064E\u0645\u064E\u0631 \u062A\u0639\u0628\u064A\u0631\u0627\u0646 \u0645\u062A\u0643\u0627\u0645\u0644\u0627\u0646 \u0639\u0646 \u062B\u0642\u0629 \u0647\u0627\u062F\u0626\u0629 \u0648\u0623\u0646\u0627\u0642\u0629 \u062A\u0628\u0642\u0649.' : 'ASMR & SAMR are complementary expressions of quiet confidence and timeless elegance.'}
        </p>
        <div class="landing-actions">
          <a href="#/asmr" class="landing-btn landing-btn-primary">
            ${state.lang === 'ar' ? '\u0627\u0643\u062A\u0634\u0641 \u0623\u0633\u0645\u0631' : 'Discover ASMR'}
            <span aria-hidden="true">→</span>
          </a>
          <a href="#/samr" class="landing-btn landing-btn-secondary">
            ${state.lang === 'ar' ? '\u0627\u0643\u062A\u0634\u0641 \u0633\u064E\u0645\u064E\u0631' : 'Discover SAMR'}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div class="landing-feature-strip" aria-label="${state.lang === 'ar' ? '\u0642\u064A\u0645 \u0627\u0644\u062F\u0627\u0631' : 'House values'}">
        <article class="landing-feature">
          <span class="feature-icon feature-icon-leaf" aria-hidden="true"></span>
          <div>
            <h3>${state.lang === 'ar' ? '\u0635\u064A\u0627\u063A\u0629 \u0628\u0646\u064A\u0629' : 'Crafted with intention'}</h3>
            <p>${state.lang === 'ar' ? '\u0643\u0644 \u0645\u0643\u0648\u0646 \u064A\u062E\u062A\u0627\u0631 \u0644\u062C\u0648\u062F\u062A\u0647 \u0648\u0646\u0642\u0627\u0626\u0647 \u0648\u0623\u062B\u0631\u0647.' : 'Every ingredient is chosen for its quality, purity and emotion.'}</p>
          </div>
        </article>
        <article class="landing-feature">
          <span class="feature-icon feature-icon-bottle" aria-hidden="true"></span>
          <div>
            <h3>${state.lang === 'ar' ? '\u062F\u0641\u0639\u0627\u062A \u0635\u063A\u064A\u0631\u0629' : 'Made in small batches'}</h3>
            <p>${state.lang === 'ar' ? '\u062A\u0635\u0646\u0639 \u0628\u0643\u0645\u064A\u0627\u062A \u0645\u062D\u062F\u0648\u062F\u0629 \u0644\u062D\u0641\u0638 \u0627\u0644\u062C\u0648\u062F\u0629 \u0648\u0627\u0644\u062A\u0641\u0631\u062F.' : 'Crafted in limited batches to ensure exceptional quality.'}</p>
          </div>
        </article>
        <article class="landing-feature">
          <span class="feature-icon feature-icon-sprout" aria-hidden="true"></span>
          <div>
            <h3>${state.lang === 'ar' ? '\u0637\u0628\u064A\u0639\u064A | \u0646\u0642\u064A | \u0645\u0633\u0624\u0648\u0644' : 'Natural | ethical | pure'}</h3>
            <p>${state.lang === 'ar' ? '\u0645\u0648\u0627\u062F \u0645\u062E\u062A\u0627\u0631\u0629 \u0628\u0648\u0639\u064A \u0648\u062A\u062C\u0631\u0628\u0629 \u0645\u0635\u0646\u0648\u0639\u0629 \u0628\u0639\u0646\u0627\u064A\u0629.' : 'Responsibly sourced materials. Consciously crafted.'}</p>
          </div>
        </article>
        <article class="landing-feature">
          <span class="feature-icon feature-icon-arch" aria-hidden="true"></span>
          <div>
            <h3>${state.lang === 'ar' ? '\u0645\u0635\u0645\u0645 \u0644\u064A\u062A\u0630\u0643\u0631' : 'Designed to be remembered'}</h3>
            <p>${state.lang === 'ar' ? '\u0644\u064A\u0633 \u0645\u062C\u0631\u062F \u0639\u0637\u0631\u060C \u0628\u0644 \u062D\u0636\u0648\u0631 \u064A\u0628\u0642\u0649.' : 'Not just a scent, but a lasting presence.'}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- Founder's Story Block (Full Window) -->
    <section class="story-block full-window-section" aria-label="Founding Story">
      <div class="container-custom story-grid">
        <div class="story-visual-canvas">
          ${renderProductPhoto('duo-box')}
        </div>
        <div class="story-text">
          <span class="editorial-sub" style="margin-bottom: 0.8rem;">${t('story_founder')}</span>
          <span style="font-family: var(--font-sans); font-size: 0.75rem; letter-spacing: 0.1em; color: var(--gold); display: block; margin-bottom: 1.5rem;">
            ${state.lang === 'ar' ? BATCH_MOTIF_AR : BATCH_MOTIF_EN}
          </span>
          <h2>${t('story_title')}</h2>
          <p>${t('story_body1')}</p>
          <p>${t('story_body2')}</p>
          <div class="story-signature">
            <div class="sig-stamp" aria-hidden="true">B.077<br>${CONFIG.PRODUCTION_CITY_EN.toUpperCase()}</div>
            <div>
              <span class="sig-name">${t('story_signature')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Catalog highlights (Full Window) -->
    <section id="featured-extraits" class="full-window-section" style="background-color: var(--charcoal-900);" aria-label="Featured Collection">
      <div class="container-custom" style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;">
        <div style="text-align: center; margin-bottom: 3rem;">
          <span class="editorial-sub">${t('filter_extrait')}</span>
          <h2 class="serif-display" style="font-size: clamp(2rem, 4vw, 3rem);">${state.lang === 'ar' ? 'الإصدارات الخاصة من مستخلصات العطور' : 'The Signature Extraits'}</h2>
        </div>
        <div class="catalog-grid catalog-grid-centered" style="width: 100%;">
          ${featuredHtml}
        </div>
      </div>
    </section>

    <!-- Gifting & Duo Box Section (Full Window, border removed) -->
    <section class="full-window-section" style="background-color: var(--charcoal-800);" aria-label="Gifting Highlights">
      <div class="container-custom">
        <div class="gift-promo-card">
          <div>
            <span class="editorial-sub">${state.lang === 'ar' ? 'مجموعة الهدايا الثنائية' : 'The Gifting Duo'}</span>
            <h2 class="serif-display" style="font-size: 2.5rem; margin-bottom: 1.5rem;">${state.lang === 'ar' ? 'صندوق الثنائي الفاخر' : 'His & Hers Duo Box'}</h2>
            <p style="color: var(--taupe); margin-bottom: 2rem; max-width: 500px;">
              ${t('duo_box_offer')} ${state.lang === 'ar' ? 'صُممت لتجتمع معاً في صندوق خشبي أنيق للمناسبات الخاصة والذكرى السنوية.' : 'Curated for shared intimacy, beautifully layered or worn as custom signatures.'}
            </p>
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
              <span class="serif-display" style="font-size: 1.8rem; color: var(--gold); margin-right: 1.5rem;">599 ${t('sar')} <span style="font-size: 1rem; color: var(--taupe); text-decoration: line-through;">650 ${t('sar')}</span></span>
              <a href="#/product/duo-box" class="btn btn-primary">${state.lang === 'ar' ? 'عرض علبة الثنائي' : 'Explore Duo Box'}</a>
            </div>
          </div>
          <div class="gift-promo-visual">
            ${renderProductPhoto('duo-box')}
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials (Full Window) -->
    <section class="testimonial-block full-window-section" aria-label="Customer Testimonials">
      <div class="container-custom">
        <p class="testimonial-quote">"${state.lang === 'ar' ? 'سألني ما العطر الذي أضعه قبل أن يلقي السلام.' : 'He asked what I was wearing before he said hello.'}"</p>
        <span class="testimonial-author">— ${state.lang === 'ar' ? `سيدة سَمَر، ${CONFIG.PRODUCTION_CITY_AR}` : `SAMR patron, ${CONFIG.PRODUCTION_CITY_EN}`}</span>
      </div>
    </section>

    <!-- Newsletter Intake Block (Full Window) -->
    <section class="newsletter-block full-window-section" style="background-color: var(--charcoal-800);" aria-label="Newsletter Signup">
      <div class="container-custom" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; max-width: 600px;">
        <span class="editorial-sub" style="margin-bottom: 0.8rem;">${state.lang === 'ar' ? 'القائمة العطرية الأولى' : 'Numbered Batch List'}</span>
        <h2 class="serif-display" style="font-size: clamp(2rem, 4vw, 3rem); margin-bottom: 1rem;">
          ${state.lang === 'ar' ? 'انضم إلى الدفعة الأولى المرقمة' : 'Join the first numbered batch'}
        </h2>
        <p style="color: var(--taupe); font-weight: 300; line-height: 1.7; margin-bottom: 2.5rem; font-size: 0.95rem;">
          ${state.lang === 'ar' ?
            'سجل بريدك الإلكتروني لتلقي إشعارات التوفر الحصرية للدفعة B.077 القادمة قبل الجميع.' :
            'Be notified the moment Batch B.077 completes maceration. Gain exclusive booking priority for future numbered extraits.'}
        </p>

        <form id="newsletter-form" class="newsletter-form" onsubmit="submitNewsletter(event)" style="display: flex; width: 100%; gap: 1rem; flex-wrap: wrap;" novalidate>
          <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem;">
            <input type="email" id="newsletter-email" class="form-input newsletter-input" style="width: 100%; height: 50px; background-color: var(--charcoal-900); border: 1px solid var(--border-whisper); color: var(--ivory-100); padding: 0 1.2rem; font-family: var(--font-sans); font-size: 0.9rem;" placeholder="${state.lang === 'ar' ? 'أدخل عنوان بريدك الإلكتروني' : 'Enter your email address'}" required>
            <span class="form-error" id="newsletter-err-email" style="display: none; color: #E07A7A; font-size: 0.75rem; margin-top: 0.2rem; text-align: start;"></span>
          </div>
          <button type="submit" class="btn btn-primary" style="height: 50px; padding: 0 2rem;">
            ${state.lang === 'ar' ? 'انضمام' : 'Join'}
          </button>
        </form>

        <div id="newsletter-feedback" style="display: none; margin-top: 1.5rem; color: var(--gold); font-size: 0.9rem; font-family: var(--font-sans);"></div>

        <p style="font-size: 0.75rem; color: var(--taupe); margin-top: 1.5rem; font-family: var(--font-sans); letter-spacing: 0.05em;">
          ${state.lang === 'ar' ? 
            `أو انضم مباشرة عبر <a href="mailto:concierge@asmrsamr.com?subject=الانضمام إلى الدفعة الأولى المرقمة" style="color: var(--gold); text-decoration: none;">البريد الإلكتروني</a> أو <a href="https://wa.me/${WHATSAPP_NUMBER}?text=مرحباً دار عطور أسمر وسَمَر، يرجى إضافتي للدفعة الأولى المرقمة" target="_blank" rel="noopener" style="color: var(--gold); text-decoration: none;">واتساب</a>` :
            `Or join directly via <a href="mailto:concierge@asmrsamr.com?subject=Join the First Numbered Batch" style="color: var(--gold); text-decoration: none;">Email</a> or <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hello ASMR & SAMR, please add me to the first numbered batch list" target="_blank" rel="noopener" style="color: var(--gold); text-decoration: none;">WhatsApp</a>`}
        </p>
      </div>
    </section>
  `;
}

function renderBrandPage(brandId) {
  const isSamr = brandId === 'samr';
  const brandName = isSamr ? 'SAMR' : 'ASMR';
  const details = getProductById(`${brandId}-extrait`, { includeInactive: true }) || products.find(p => p.id === `${brandId}-extrait`);
  const brandHeroPhoto = heroImages[brandId];
  preloadHeroImage(brandHeroPhoto);
  const campaignTagline = isSamr ? 'THE SCENT HE CANNOT FORGET.' : 'PRESENCE THAT STAYS.';
  const campaignBottom = isSamr ? 'SOFTNESS WITH PRESENCE.<br>ELEGANCE THAT LINGERS.' : 'QUIET CONFIDENCE.<br>STRENGTH WITHOUT NOISE.';

  const brandProducts = getPublicProducts().filter(p => p.brand === brandName);
  let productsHtml = '';

  brandProducts.forEach(p => {
    const name = state.lang === 'ar' ? p.nameAr : p.nameEn;
    const startPrice = p.prices[p.heroSize];
    productsHtml += `
      <a href="#/product/${p.id}" class="product-card" aria-label="${name} - ${state.lang === 'ar' ? 'عرض التفاصيل' : 'View details'}">
        <div class="product-card-visual">
          ${renderProductPhoto(p)}
        </div>
        <div>
          <span class="brand-tag">${p.familyEn}</span>
          <h3 class="product-name">${name}</h3>
        </div>
        <div class="card-action-row">
          <div class="product-price">
            ${startPrice} ${t('sar')}
            <small>/ ${p.heroSize}</small>
          </div>
          <span class="text-gold" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'استكشف ←' : 'Explore →'}</span>
        </div>
      </a>
    `;
  });

  return `
    <div class="brand-page-container">
      <!-- Campaign Brand Hero -->
      <section class="campaign-brand-hero campaign-brand-hero-${brandId}" aria-label="${brandName} campaign presentation">
        <img class="campaign-brand-photo" src="${brandHeroPhoto}" alt="${brandName} extrait de parfum campaign still life" width="1792" height="1024" loading="eager" decoding="async" fetchpriority="high">
        <div class="campaign-brand-overlay" aria-hidden="true"></div>
        <div class="campaign-brand-copy">
          <h1 class="campaign-brand-title serif-display">${brandName}</h1>
          <p class="campaign-brand-subtitle">EXTRAIT DE PARFUM</p>
          <div class="campaign-brand-rule"></div>
          <p class="campaign-brand-tagline">${campaignTagline}</p>
        </div>
        <p class="campaign-brand-bottom">${campaignBottom}</p>
      </section>

      <!-- Note Pyramid Showcase -->
      <section class="section-padding container-custom" aria-label="Fragrance Notes">
        <div style="max-width: 800px; margin: 0 auto; text-align: center; margin-bottom: 4rem;">
          <span class="editorial-sub">${t('notes_title')}</span>
          <h2 class="serif-display" style="font-size: 2.8rem; margin-top: 1rem;">${state.lang === 'ar' ? 'الهندسة المعمارية للنغمات العطرية' : 'The Olfactory Architecture'}</h2>
          <p style="color: var(--taupe); margin-top: 1rem; font-weight: 300;">
            ${state.lang === 'ar' ? 'نسبة تركيز عالية تبلغ ٢٨٪ لتثبيت يدوم طويلاً وتجربة عطرية حية.' : 'Meticulously structured 28% concentration designed to unravel slowly throughout the day.'}
          </p>
        </div>

        <div class="pyramid-container">
          <div class="pyramid-row">
            <div class="pyramid-label">${t('top_notes')}</div>
            <div class="pyramid-notes">${state.lang === 'ar' ? details.pyramid.topAr : details.pyramid.topEn}</div>
          </div>
          <div class="pyramid-row">
            <div class="pyramid-label">${t('heart_notes')}</div>
            <div class="pyramid-notes">${state.lang === 'ar' ? details.pyramid.heartAr : details.pyramid.heartEn}</div>
          </div>
          <div class="pyramid-row">
            <div class="pyramid-label">${t('base_notes')}</div>
            <div class="pyramid-notes">${state.lang === 'ar' ? details.pyramid.baseAr : details.pyramid.baseEn}</div>
          </div>
        </div>
      </section>

      <!-- Brand Ritual / How to wear -->
      <section class="section-padding" style="background-color: var(--charcoal-800); border-top: 1px solid var(--border-whisper);" aria-label="Ritual of wearing">
        <div class="container-custom" style="max-width: 800px; text-align: center;">
          <span class="editorial-sub">${t('how_to_wear')}</span>
          <h2 class="serif-display" style="font-size: 2.5rem; margin: 1.5rem 0;">${state.lang === 'ar' ? 'طقوس التعطر الصحيحة' : 'The Art of Wearing'}</h2>
          <p class="serif-display" style="font-size: 1.35rem; color: var(--gold-light); font-style: italic; line-height: 1.6; margin-bottom: 2rem;">
            "${state.lang === 'ar' ? details.wearAr : details.wearEn}"
          </p>
        </div>
      </section>

      <!-- Brand Range -->
      <section class="section-padding container-custom" aria-label="${brandName} Collection Elements">
        <div style="text-align: center; margin-bottom: 4rem;">
          <span class="editorial-sub">${brandName} Collection</span>
          <h2 class="serif-display" style="font-size: 2.5rem;">${state.lang === 'ar' ? 'مجموعة عطور ومنتجات' : 'The Complete Range'} ${brandName}</h2>
        </div>
        <div class="catalog-grid">
          ${productsHtml}
        </div>
      </section>
    </div>
  `;
}

function renderShop(filterType = 'all') {
  return renderUpgradedShop(filterType);

  let filtered = products;
  if (filterType !== 'all') {
    filtered = products.filter(p => p.type === filterType);
  }

  let catalogHtml = '';
  filtered.forEach(p => {
    const name = state.lang === 'ar' ? p.nameAr : p.nameEn;
    const startPrice = p.prices[p.heroSize];
    const desc = state.lang === 'ar' ? p.descAr : p.descEn;

    catalogHtml += `
      <a href="#/product/${p.id}" class="product-card" aria-label="${name} - View product details">
        <span class="card-badge">${p.badgeEn ? (state.lang === 'ar' ? p.badgeAr : p.badgeEn) : t('numbered_badge')}</span>
        <div class="product-card-visual">
          ${renderProductPhoto(p)}
        </div>
        <div>
          <span class="brand-tag">${p.brand} · ${p.familyEn}</span>
          <h3 class="product-name">${name}</h3>
          <p class="product-desc">${desc}</p>
        </div>
        <div class="card-action-row">
          <div class="product-price">
            ${startPrice} ${t('sar')}
            <small>/ ${p.heroSize}</small>
          </div>
          <span class="text-gold" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'عرض التفاصيل ←' : 'View Details →'}</span>
        </div>
      </a>
    `;
  });

  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" aria-label="Fragrances Catalog">
        <div style="text-align: center; margin-bottom: 4rem;">
          <span class="editorial-sub">${t('nav_shop')}</span>
          <h1 class="serif-display" style="font-size: 3.5rem;">${state.lang === 'ar' ? 'المعرض والمجموعة الكاملة' : 'The Scent Collection'}</h1>
          <p style="color: var(--taupe); margin-top: 1rem;">${t('vat_note')}</p>
        </div>

        <!-- Filter buttons with aria-pressed for active state (No tab role dependency) -->
        <div class="shop-filters" aria-label="Filter Fragrances">
          <button class="filter-btn ${filterType === 'all' ? 'active' : ''}" aria-pressed="${filterType === 'all'}" onclick="window.location.hash = '#/shop'">${t('filter_all')}</button>
          <button class="filter-btn ${filterType === 'extrait' ? 'active' : ''}" aria-pressed="${filterType === 'extrait'}" onclick="window.location.hash = '#/shop/extrait'">${t('filter_extrait')}</button>
          <button class="filter-btn ${filterType === 'spray' ? 'active' : ''}" aria-pressed="${filterType === 'spray'}" onclick="window.location.hash = '#/shop/spray'">${t('filter_spray')}</button>
          <button class="filter-btn ${filterType === 'cream' ? 'active' : ''}" aria-pressed="${filterType === 'cream'}" onclick="window.location.hash = '#/shop/cream'">${t('filter_cream')}</button>
          <button class="filter-btn ${filterType === 'sets' ? 'active' : ''}" aria-pressed="${filterType === 'sets'}" onclick="window.location.hash = '#/shop/sets'">${t('filter_sets')}</button>
        </div>

        <div class="catalog-grid">
          ${catalogHtml}
        </div>
      </section>
    </div>
  `;
}

function renderProductDetail(productId) {
  return renderUpgradedProductDetail(productId);

  const p = products.find(prod => prod.id === productId);
  if (!p) {
    return `<div class="brand-page-container"><section class="container-custom section-padding">Product not found.</section></div>`;
  }

  const name = state.lang === 'ar' ? p.nameAr : p.nameEn;
  const desc = state.lang === 'ar' ? p.descAr : p.descEn;

  // Initialize selected size in state if not set
  if (!state.selectedSize[productId]) {
    state.selectedSize[productId] = p.heroSize || p.sizes[0];
  }
  const activeSize = state.selectedSize[productId];
  const price = p.prices[activeSize];

  // Size pills construction
  let sizePillsHtml = '';
  p.sizes.forEach(sz => {
    sizePillsHtml += `
      <button class="size-pill ${sz === activeSize ? 'active' : ''}" aria-label="${state.lang === 'ar' ? 'اختر حجم' : 'Select size'} ${sz}" onclick="selectProductSize('${productId}', '${sz}')">
        ${sz}
      </button>
    `;
  });

  // Cross sell items
  const crossSellBrand = p.brand === 'SAMR' ? 'ASMR' : (p.brand === 'ASMR' ? 'SAMR' : 'Duo');
  const crossSellProduct = products.find(prod => prod.brand === crossSellBrand && prod.type === p.type);
  let crossSellHtml = '';
  if (crossSellProduct) {
    const csName = state.lang === 'ar' ? crossSellProduct.nameAr : crossSellProduct.nameEn;
    crossSellHtml = `
      <div style="margin-top: 4rem; padding: 2rem; border: 1px solid var(--border-whisper); background-color: var(--charcoal-800);">
        <span class="editorial-sub" style="font-size: 0.7rem;">${t('pairs_with')}</span>
        <h4 class="serif-display" style="font-size: 1.3rem; margin: 0.5rem 0;">${csName}</h4>
        <p style="font-size: 0.85rem; color: var(--taupe); margin-bottom: 1.2rem;">
          ${state.lang === 'ar' ? 'ثنائي متناغم للزوجين. عطر مكمل وتجربة حسية مشتركة.' : 'The complementary scent designed to balance this fragrance.'}
        </p>
        <a href="#/product/${crossSellProduct.id}" class="text-gold" style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; text-decoration: none;">${state.lang === 'ar' ? 'عرض الشريك العطري ←' : 'View Complementary Partner →'}</a>
      </div>
    `;
  }

  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" aria-label="Product detail: ${name}">
        <a href="#/shop" style="display: inline-flex; align-items: center; color: var(--gold); text-decoration: none; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 3rem;">
          ${state.lang === 'ar' ? '← العودة للمجموعة' : '← Back to Collection'}
        </a>

        <div class="product-detail-grid">
          <!-- Gallery visual -->
          <div class="product-gallery">
            ${renderProductPhoto(p, { eager: true })}
          </div>

          <!-- Product Details Form -->
          <div>
            <span class="brand-tag">${p.brand}</span>
            <span style="font-family: var(--font-sans); font-size: 0.7rem; font-weight: 200; letter-spacing: 0.2em; color: var(--taupe); display: block; margin-bottom: 1.2rem; text-transform: uppercase;">
              ${state.lang === 'ar' ? BATCH_MOTIF_AR : BATCH_MOTIF_EN}
            </span>
            <h1 class="serif-display" style="font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 200; letter-spacing: 0.02em; line-height: 1.15; margin-bottom: 1.5rem; color: var(--ivory-100);">${name}</h1>
            
            <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 2.5rem;">
              <span class="serif-display" style="font-size: 1.8rem; font-weight: 300; color: var(--gold-light);">${price} ${t('sar')}</span>
              <span class="card-badge" style="position: static; font-weight: 300; letter-spacing: 0.15em; font-size: 0.6rem;">${state.lang === 'ar' ? p.badgeAr || t('numbered_badge') : p.badgeEn || t('numbered_badge')}</span>
            </div>

            <p style="color: var(--taupe); line-height: 1.8; font-size: 0.95rem; margin-bottom: 2.5rem; font-weight: 200;">
              ${desc}
            </p>

            <!-- Trust notes block -->
            <div style="margin-bottom: 2.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; padding: 1rem 0;">
              <div style="font-size: 0.8rem; color: var(--gold); font-weight: 300; letter-spacing: 0.05em;">
                — ${state.lang === 'ar' ? 'تركيز مستخلص العطر ٢٨٪' : '28% Extrait de Parfum'}
              </div>
              <div style="font-size: 0.8rem; color: var(--gold); font-weight: 300; letter-spacing: 0.05em;">
                — ${state.lang === 'ar' ? `صناعة يدوية بالوزن ب${CONFIG.PRODUCTION_CITY_AR}` : `Hand-filled by weight in ${CONFIG.PRODUCTION_CITY_EN}`}
              </div>
              <div style="font-size: 0.8rem; color: var(--gold); font-weight: 300; letter-spacing: 0.05em;">
                — ${state.lang === 'ar' ? 'تعتيق يمتد من ٤ إلى ٨ أسابيع' : 'Macerated 4–8 Weeks'}
              </div>
              <div style="font-size: 0.8rem; color: var(--gold); font-weight: 300; letter-spacing: 0.05em;">
                — ${state.lang === 'ar' ? 'زجاجات مرقمة دفعات صغيرة' : 'Numbered small batches'}
              </div>
            </div>

            <div class="variant-selector">
              <span class="variant-label">${t('size')}</span>
              <div class="size-pills">
                ${sizePillsHtml}
              </div>
            </div>

            <!-- CTAs -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 3rem;">
              <button class="btn btn-primary" onclick="addToCart('${p.id}', '${activeSize}', ${price})">
                ${t('add_to_cart')}
              </button>
              <button class="btn btn-outline" onclick="buyNowWhatsApp('${p.id}', '${activeSize}', ${price})">
                ${t('order_whatsapp')}
              </button>
            </div>
            
            <button class="btn btn-outline btn-block" onclick="navigateTo('#/contact')" style="margin-top: 1rem; text-align: center; border-color: rgba(196,165,102,0.15);">
              ${t('join_list')}
            </button>

            <!-- Product Specs Accordion -->
            <div class="detail-meta-list">
              <div class="accordion-item active" id="acc-notes">
                <button type="button" class="accordion-header" id="acc-notes-btn" aria-expanded="true" aria-controls="acc-notes-content" onclick="toggleAccordion('acc-notes')">
                  <span>${t('notes_title')}</span>
                  <span class="accordion-icon" aria-hidden="true">+</span>
                </button>
                <div class="accordion-content" id="acc-notes-content" style="max-height: 250px;">
                  <div style="display: flex; flex-direction: column; gap: 0.8rem; font-size: 0.9rem;">
                    <div><strong>${t('top_notes')}:</strong> ${state.lang === 'ar' ? p.pyramid.topAr : p.pyramid.topEn}</div>
                    <div><strong>${t('heart_notes')}:</strong> ${state.lang === 'ar' ? p.pyramid.heartAr : p.pyramid.heartEn}</div>
                    <div><strong>${t('base_notes')}:</strong> ${state.lang === 'ar' ? p.pyramid.baseAr : p.pyramid.baseEn}</div>
                  </div>
                </div>
              </div>

              <div class="accordion-item" id="acc-wear">
                <button type="button" class="accordion-header" id="acc-wear-btn" aria-expanded="false" aria-controls="acc-wear-content" onclick="toggleAccordion('acc-wear')">
                  <span>${t('how_to_wear')}</span>
                  <span class="accordion-icon" aria-hidden="true">+</span>
                </button>
                <div class="accordion-content" id="acc-wear-content">
                  <p style="font-size: 0.9rem;">${state.lang === 'ar' ? p.wearAr : p.wearEn}</p>
                </div>
              </div>

              <div class="accordion-item" id="acc-safety">
                <button type="button" class="accordion-header" id="acc-safety-btn" aria-expanded="false" aria-controls="acc-safety-content" onclick="toggleAccordion('acc-safety')">
                  <span>${t('ingredients_safety')}</span>
                  <span class="accordion-icon" aria-hidden="true">+</span>
                </button>
                <div class="accordion-content" id="acc-safety-content">
                  <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${t('ingredients_body')}</p>
                  <p style="font-size: 0.8rem; color: var(--taupe);">${t('compliance_note')}</p>
                </div>
              </div>
            </div>

            <!-- Complementary Cross Sell -->
            ${crossSellHtml}

          </div>
        </div>
      </section>
    </div>
  `;
}

function selectProductSize(productId, size) {
  state.selectedSize[productId] = size;
  renderApp();
}

function toggleAccordion(elementId) {
  const item = document.getElementById(elementId);
  if (item) {
    const isAct = item.classList.contains('active');
    
    // Close others
    document.querySelectorAll('.accordion-item').forEach(el => {
      el.classList.remove('active');
      const btn = el.querySelector('.accordion-header');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      const content = el.querySelector('.accordion-content');
      if (content) content.style.maxHeight = null;
    });

    if (!isAct) {
      item.classList.add('active');
      const btn = item.querySelector('.accordion-header');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      const content = item.querySelector('.accordion-content');
      if (content) content.style.maxHeight = content.scrollHeight + 'px';
    }
  }
}

function renderStory() {
  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" style="max-width: 900px;" aria-label="Our story detail">
        <div style="text-align: center; margin-bottom: 5rem;">
          <span class="editorial-sub">${t('story_founder')}</span>
          <span style="font-family: var(--font-sans); font-size: 0.8rem; letter-spacing: 0.1em; color: var(--gold); display: block; margin-top: 1rem;">
            ${state.lang === 'ar' ? BATCH_MOTIF_AR : BATCH_MOTIF_EN}
          </span>
          <h1 class="serif-display" style="font-size: clamp(3rem, 6vw, 4.5rem); line-height: 1.1; margin-top: 1.5rem;">
            ${state.lang === 'ar' ? 'صياغة حميمية، دفعة تلو الأخرى' : 'Formulated for Closeness, Built by Hand'}
          </h1>
          <p style="color: var(--taupe); margin-top: 1.5rem; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.85rem;">
            ${t('house_tagline')}
          </p>
        </div>

        <div class="story-text" style="max-width: 100%;">
          <p style="font-size: 1.25rem; line-height: 1.8; margin-bottom: 2.5rem; font-weight: 300;">
            ${state.lang === 'ar' ? 
              'تأسست دار عطور أسمر وسَمَر على فلسفة أن العطر ليس مجرد رائحة، بل هو أثر من الألفة ووثيقة حضور غير منطوق. الفكرة مستوحاة من ثنائية الرجل والمرأة - حضور ممتد للزوج ورائحة لا ينساها لزوجته.' :
              'ASMR & SAMR is built upon the philosophy that fragrance is not a mere cosmetic commodity, but an unspoken signature of physical proximity and lingering memory. The house operates as a dedicated craft workshop.'}
          </p>

          <h3 class="serif-display" style="font-size: 2rem; margin: 3rem 0 1.5rem; color: var(--gold);">${state.lang === 'ar' ? 'مستخلصات العطور النقية ٢٨٪' : 'Pure Extrait Concentration'}</h3>
          <p>
            ${state.lang === 'ar' ?
              'معظم عطور السوق الاستهلاكية تأتي بتركيز خفيف (EDP). نحن نقوم بتصفية وصنع العطر بتركيز ٢٨٪ (Extrait de Parfum)، مما يضمن ثباتاً أطول للبشرة يتنفس بمجرد اقتراب المسافة.' :
              'While mass-market department store perfumes are bottled at lower concentrations, we formulate strictly at 28% Extrait de Parfum. This ensures the scent interacts warmly with body heat and remains a close, personal skin scent for up to 12 hours.'}
          </p>

          <h3 class="serif-display" style="font-size: 2rem; margin: 3rem 0 1.5rem; color: var(--gold);">${state.lang === 'ar' ? 'عملية التعتيق والتعبئة باليد' : 'The Four-Step Maceration Process'}</h3>
          <p>
            ${state.lang === 'ar' ?
              `تخضع كل دفعة صغيرة للتعتيق لمدة تتراوح من ٤ إلى ٨ أسابيع في مكان مظلم وبارد ب${CONFIG.PRODUCTION_CITY_AR}، مما يسمح للزيوت الطبيعية بالاندماج معاً. نقوم بالتعبئة يدوياً بالوزن، لنعطي كل زجاجة بطاقة ورقم تسلسلي خاص بها (على سبيل المثال، الدفعة رقم ١٢ من أصل ١٥٠ زجاجة).` :
              `Every numbered batch is macerated for 4 to 8 weeks in temperature-controlled dark isolation in ${CONFIG.PRODUCTION_CITY_EN}. Upon reaching chemical equilibrium, the batch is filtered and hand-filled by weight. We transcribe the serial batch numbers directly onto the amber bottles, ensuring absolute exclusivity.`}
          </p>

          <div style="margin: 4rem 0; padding: 3rem; border: 1px solid var(--border-whisper); background-color: var(--charcoal-800); border-radius: 4px; text-align: center;">
            <div class="sig-stamp" style="margin: 0 auto 1.5rem;" aria-hidden="true"> B.077 </div>
            <p class="serif-display" style="font-size: 1.25rem; font-style: italic; color: var(--gold-light);">
              "${state.lang === 'ar' ? 'نحترم أسرار الألفة وخصوصية المكونات.' : 'We honor the boundaries of close conversation and natural luxury.'}"
            </p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderGifting() {
  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" aria-label="Gifting catalog">
        <div style="text-align: center; margin-bottom: 5rem;">
          <span class="editorial-sub">${t('nav_gifting')}</span>
          <span style="font-family: var(--font-sans); font-size: 0.8rem; letter-spacing: 0.1em; color: var(--gold); display: block; margin-top: 1rem;">
            ${state.lang === 'ar' ? BATCH_MOTIF_AR : BATCH_MOTIF_EN}
          </span>
          <h1 class="serif-display" style="font-size: 3.5rem; margin-top: 1.5rem;">${state.lang === 'ar' ? 'صناديق ومجموعات الإهداء' : 'Artisanal Gift Sets'}</h1>
          <p style="color: var(--taupe); margin-top: 1rem; max-width: 600px; margin: 1rem auto 0;">
            ${t('gifts_subtitle')}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;">
          <!-- Gift Item 1: Duo Box -->
          <a href="#/product/duo-box" class="product-card" aria-label="His & Hers Duo Box - View details">
            <div class="product-card-visual" style="aspect-ratio: 16/9;">
              ${renderProductPhoto('duo-box', { wide: true })}
            </div>
            <div style="margin-top: 2rem;">
              <span class="brand-tag">ASMR & SAMR Duo</span>
              <h3 class="product-name" style="font-size: 1.8rem;">${state.lang === 'ar' ? 'صندوق الثنائي (له ولها)' : 'His & Hers Duo Box'}</h3>
              <p class="product-desc">${t('duo_box_offer')}</p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem;">
                <span class="serif-display" style="font-size: 1.4rem; color: var(--gold-light);">599 ${t('sar')} <span style="font-size: 0.9rem; text-decoration: line-through; color: var(--taupe);">650 ${t('sar')}</span></span>
                <span class="text-gold" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'حجز الصندوق ←' : 'Order Coffret →'}</span>
              </div>
            </div>
          </a>

          <!-- Gift Item 2: Discovery Set -->
          <a href="#/product/discovery-set" class="product-card" aria-label="Discovery Vial Set - View details">
            <div class="product-card-visual" style="aspect-ratio: 16/9;">
              ${renderProductPhoto('discovery-set', { wide: true })}
            </div>
            <div style="margin-top: 2rem;">
              <span class="brand-tag">Sensory Exploration</span>
              <h3 class="product-name" style="font-size: 1.8rem;">${state.lang === 'ar' ? 'مجموعة الاكتشاف والمطابقة' : 'The Discovery Vial Set'}</h3>
              <p class="product-desc">${t('discovery_set_offer')}</p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem;">
                <span class="serif-display" style="font-size: 1.4rem; color: var(--gold-light);">60 ${t('sar')}</span>
                <span class="text-gold" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'اكتشف النغمات ←' : 'Order Set →'}</span>
              </div>
            </div>
          </a>

          <!-- Gift Item 3: SAMR Trio -->
          <a href="#/product/samr-trio" class="product-card" aria-label="SAMR Trio Ritual Set - View details">
            <div class="product-card-visual" style="aspect-ratio: 16/9;">
              ${renderProductPhoto('samr-trio', { wide: true })}
            </div>
            <div style="margin-top: 2rem;">
              <span class="brand-tag">SAMR Layering</span>
              <h3 class="product-name" style="font-size: 1.8rem;">${state.lang === 'ar' ? 'طقوس سَمَر الثلاثية' : 'SAMR Trio Ritual Set'}</h3>
              <p class="product-desc">${state.lang === 'ar' ? 'ثلاثية كاملة: مستخلص العطر ٥٠ مل، وبخاخ الجسم، وكريم معطر.' : 'Layering elements: Extrait 50ml + Body Spray 100ml + Cream 100g.'}</p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem;">
                <span class="serif-display" style="font-size: 1.4rem; color: var(--gold-light);">379 ${t('sar')}</span>
                <span class="text-gold" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'احجز المجموعه ←' : 'Order Trio →'}</span>
              </div>
            </div>
          </a>

          <!-- Gift Item 4: ASMR Trio -->
          <a href="#/product/asmr-trio" class="product-card" aria-label="ASMR Trio Ritual Set - View details">
            <div class="product-card-visual" style="aspect-ratio: 16/9;">
              ${renderProductPhoto('asmr-trio', { wide: true })}
            </div>
            <div style="margin-top: 2rem;">
              <span class="brand-tag">ASMR Layering</span>
              <h3 class="product-name" style="font-size: 1.8rem;">${state.lang === 'ar' ? 'طقوس أسمر الثلاثية' : 'ASMR Trio Ritual Set'}</h3>
              <p class="product-desc">${state.lang === 'ar' ? 'ثلاثية كاملة للرجل: مستخلص العطر ٥٠ مل، وبخاخ للجسم، وكريم معطر.' : 'Layering elements: Extrait 50ml + Body Spray 100ml + Cream 100g.'}</p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem;">
                <span class="serif-display" style="font-size: 1.4rem; color: var(--gold-light);">499 ${t('sar')}</span>
                <span class="text-gold" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em;">${state.lang === 'ar' ? 'احجز المجموعه ←' : 'Order Trio →'}</span>
              </div>
            </div>
          </a>
        </div>
      </section>
    </div>
  `;
}

function renderContact() {
  // Custom pre-order intake form validation
  window.submitPreorderForm = async function(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('form-name');
    const phoneInput = document.getElementById('form-phone');
    const emailInput = document.getElementById('form-email');
    const interestInput = document.getElementById('form-interest');
    
    let isValid = true;
    let firstInvalidEl = null;

    // Helper to clear error
    const clearError = (input, errId) => {
      input.classList.remove('invalid');
      const errEl = document.getElementById(errId);
      if (errEl) {
        errEl.innerText = '';
        errEl.style.display = 'none';
      }
    };

    // Helper to set error
    const setError = (input, errId, msg) => {
      input.classList.add('invalid');
      const errEl = document.getElementById(errId);
      if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
      }
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = input;
    };

    // Validate Name
    clearError(nameInput, 'err-name');
    if (!nameInput.value.trim()) {
      setError(nameInput, 'err-name', state.lang === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Please enter your name');
    }

    // Validate Phone
    clearError(phoneInput, 'err-phone');
    if (!phoneInput.value.trim()) {
      setError(phoneInput, 'err-phone', state.lang === 'ar' ? 'يرجى إدخال رقم الواتساب' : 'Please enter your WhatsApp number');
    } else if (!/^\+?[0-9\s\-()]{7,15}$/.test(phoneInput.value.trim())) {
      setError(phoneInput, 'err-phone', state.lang === 'ar' ? 'رقم الهاتف غير صحيح' : 'Invalid phone number format');
    }

    // Validate Email
    clearError(emailInput, 'err-email');
    if (!emailInput.value.trim()) {
      setError(emailInput, 'err-email', state.lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email address');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      setError(emailInput, 'err-email', state.lang === 'ar' ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address format');
    }

    if (!isValid) {
      if (firstInvalidEl) firstInvalidEl.focus();
      return;
    }

    // Capture values on successful validation
    const name = nameInput.value;
    const email = emailInput.value;
    const phone = phoneInput.value;
    const interest = interestInput.value;
    const notes = document.getElementById('form-notes').value;

    const interestMap = {
      'SAMR Extrait 50ml': 'samr-extrait', 'ASMR Extrait 50ml': 'asmr-extrait',
      'His & Hers Duo Box': 'duo-box', 'Discovery Set': 'discovery-set',
      'SAMR Trio Set': 'samr-trio', 'ASMR Trio Set': 'asmr-trio'
    };
    const selectedProduct = getProductById(interestMap[interest]);
    if (selectedProduct && getPublicSupabaseConfig().key) {
      try {
        await publicSupabaseRequest('preorders', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: {
            reservation_number: `PRE-${Date.now().toString(36).toUpperCase()}`,
            product_id: selectedProduct.id,
            quantity: 1,
            unit_price: Number(selectedProduct.prices[selectedProduct.heroSize] || getProductStartPrice(selectedProduct) || 0),
            deposit_amount: 0,
            currency: 'SAR',
            status: 'requested',
            source: 'web',
            customer_name: name.trim(),
            customer_email: email.trim().toLowerCase(),
            customer_phone: phone.trim(),
            notes: notes.trim() || null
          }
        });
      } catch (_) {
        const feedback = document.getElementById('form-feedback');
        feedback.style.display = 'block';
        feedback.innerText = state.lang === 'ar' ? '\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0627\u0644\u062d\u062c\u0632 \u0627\u0644\u0622\u0646. \u0633\u064a\u062a\u0645 \u0641\u062a\u062d \u0648\u0627\u062a\u0633\u0627\u0628 \u0644\u0625\u0643\u0645\u0627\u0644 \u0637\u0644\u0628\u0643.' : 'The reservation could not be saved online. WhatsApp will still open so you can complete it.';
      }
    }

    const list = JSON.parse(localStorage.getItem('asmr_samr_preorders')) || [];
    list.push({ name, email, phone, interest, notes, date: new Date().toISOString() });
    localStorage.setItem('asmr_samr_preorders', JSON.stringify(list));

    const resultMessage = state.lang === 'ar' ? 
      `مرحباً دار عطور أسمر وسَمَر، أود تسجيل رغبتي بحجز عطر ${interest}. الاسم: ${name}، هاتف: ${phone}، بريد: ${email}. ملاحظات: ${notes}` :
      `Hello ASMR & SAMR, I have registered my waitlist interest for ${interest}. Name: ${name}, Tel: ${phone}, Email: ${email}. Notes: ${notes}`;
    
    // Auto redirect to WhatsApp with form data pre-filled
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(resultMessage)}`;
    
    // Visual indicator
    const feedback = document.getElementById('form-feedback');
    feedback.style.display = 'block';
    feedback.innerText = t('waitlist_success');
    announceToScreenReader(t('waitlist_success'));
    
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
      document.getElementById('preorder-signup-form').reset();
      feedback.style.display = 'none';
    }, 1500);
  };

  const formattedPhone = `+${CONFIG.WHATSAPP_NUMBER.slice(0,3)} ${CONFIG.WHATSAPP_NUMBER.slice(3,5)} ${CONFIG.WHATSAPP_NUMBER.slice(5,8)} ${CONFIG.WHATSAPP_NUMBER.slice(8)}`;
  const waLinkDisplay = IS_WHATSAPP_PLACEHOLDER 
    ? `<span style="font-size: 0.95rem; color: var(--gold); border: 1px dashed var(--gold); padding: 0.6rem 1rem; display: inline-block;">${t('whatsapp_prelaunch_note')}</span>`
    : `<a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener" style="color: var(--ivory-100); text-decoration: none; font-size: 1.1rem; border: 1px solid var(--border-whisper); padding: 0.6rem 1rem;">${formattedPhone}</a>`;

  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" aria-label="Contact Information">
        <div class="contact-grid">
          <div>
            <span class="editorial-sub">${t('nav_contact')}</span>
            <h1 class="serif-display" style="font-size: 3rem; margin-bottom: 2rem;">
              ${state.lang === 'ar' ? 'تواصل مع دار العطور' : 'Connect with the House'}
            </h1>
            <p style="color: var(--taupe); font-weight: 300; line-height: 1.7; margin-bottom: 2.5rem;">
              ${state.lang === 'ar' ? 
                'بما أننا نعمل بنظام الدفعات الحصرية والصغيرة، فإننا نستقبل الطلبات والاستشارات العطرية مباشرة عبر واتساب لخدمتك بشكل خاص.' :
                'As we operate entirely in manual small batches, we maintain direct communication with each customer to coordinate custom batch numbering and courier delivery across Saudi Arabia.'}
            </p>

            <div style="margin-bottom: 2.5rem;">
              <h4 class="wordmark" style="font-size: 0.8rem; color: var(--gold); margin-bottom: 0.8rem;">${t('whatsapp_us')}</h4>
              ${waLinkDisplay}
            </div>

            <div>
              <h4 class="wordmark" style="font-size: 0.8rem; color: var(--gold); margin-bottom: 0.8rem;">${t('instagram')}</h4>
              <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener" style="color: var(--ivory-100); text-decoration: none; font-size: 1.1rem; border: 1px solid var(--border-whisper); padding: 0.6rem 1rem;">
                @asmr.samr.perfumes
              </a>
            </div>
          </div>

          <!-- Pre-order Intake Form -->
          <div style="background-color: var(--charcoal-800); padding: 3rem; border: 1px solid var(--border-whisper);">
            <h3 class="serif-display" style="font-size: 1.8rem; margin-bottom: 0.5rem;">${t('preorder_title')}</h3>
            <p style="font-size: 0.9rem; color: var(--taupe); margin-bottom: 2rem;">${t('preorder_subtitle')}</p>
            
            <div id="form-feedback" class="announcement-banner" aria-live="polite" style="display: none; margin-bottom: 2rem; border: 1px solid var(--gold); text-transform: none;"></div>

            <form id="preorder-signup-form" onsubmit="submitPreorderForm(event)" class="preorder-form" novalidate>
              <div>
                <label class="form-label" for="form-name">${t('label_name')}</label>
                <input type="text" id="form-name" name="name" autocomplete="name" class="form-input" required placeholder="e.g. Yousif" aria-describedby="err-name">
                <span id="err-name" class="form-error" aria-live="polite"></span>
              </div>
              <div>
                <label class="form-label" for="form-phone">${t('label_phone')}</label>
                <input type="tel" id="form-phone" name="phone" autocomplete="tel" class="form-input" required placeholder="e.g. +966 50 000 0000" aria-describedby="err-phone">
                <span id="err-phone" class="form-error" aria-live="polite"></span>
              </div>
              <div class="form-group-full">
                <label class="form-label" for="form-email">${t('label_email')}</label>
                <input type="email" id="form-email" name="email" autocomplete="email" inputmode="email" class="form-input" required placeholder="e.g. contact@domain.com" aria-describedby="err-email">
                <span id="err-email" class="form-error" aria-live="polite"></span>
              </div>
              <div class="form-group-full">
                <label class="form-label" for="form-interest">${t('label_interest')}</label>
                <select id="form-interest" name="interest" class="form-select" required>
                  <option value="SAMR Extrait 50ml">SAMR Extrait de Parfum (50 ml) — 270 SAR</option>
                  <option value="ASMR Extrait 50ml">ASMR Extrait de Parfum (50 ml) — 380 SAR</option>
                  <option value="His & Hers Duo Box">His & Hers Duo Box — 599 SAR</option>
                  <option value="Discovery Set">Discovery Set (2x 2ml) — 60 SAR</option>
                  <option value="SAMR Trio Set">SAMR Trio Set — 379 SAR</option>
                  <option value="ASMR Trio Set">ASMR Trio Set — 499 SAR</option>
                </select>
              </div>
              <div class="form-group-full">
                <label class="form-label" for="form-notes">${t('label_notes')}</label>
                <textarea id="form-notes" name="notes" class="form-textarea" rows="3" placeholder="${state.lang === 'ar' ? 'تاريخ خاص، رسالة هدية، الخ.' : 'Gift message, specific batch request, etc.'}"></textarea>
              </div>

              <div class="form-group-full" style="margin-top: 1rem;">
                <button type="submit" class="btn btn-primary btn-block">${t('submit_preorder')}</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderIngredients() {
  const name = state.lang === 'ar' ? 'المكونات وسلامة البشرة' : 'Ingredients & Safety';
  return `
    <div class="brand-page-container">
      <section class="container-custom section-padding" aria-label="Ingredients & Patch Safety">
        <span class="editorial-sub">${t('ingredients_safety')}</span>
        <h1 class="serif-display" style="font-size: clamp(2rem, 4vw, 3.5rem); margin-bottom: 2rem;">
          ${state.lang === 'ar' ? 'الشفافية العطرية وسلامة البشرة' : 'Transparency & Skin Safety'}
        </h1>
        
        <div style="max-width: 800px; color: var(--taupe); font-weight: 300; line-height: 1.8; margin-bottom: 4rem; font-size: 1.1rem;">
          <p style="margin-bottom: 1.5rem;">
            ${state.lang === 'ar' ? 
              'تلتزم دار عطور أسمر وسَمَر بالشفافية الكاملة حول تركيبات عطورها. جميع مكوناتنا وزيوتنا العطرية الفاخرة مصممة ومصنوعة بتوافق تام مع المعايير واللوائح الإرشادية الصادرة عن الجمعية الدولية للعطور (IFRA).' :
              'At ASMR & SAMR, we believe true luxury lies in absolute transparency. Every extrait de parfum, body spray, and body cream is hand-weighed, filtered, and bottled in small batches, utilizing premium natural absolutes and safe synthetic aroma-molecules.'}
          </p>
          <p>
            ${state.lang === 'ar' ? 
              'بما أننا نستخدم مستخلصات طبيعية وزيوت خام بتركيز عالي، فإننا نوصي بشدة بإجراء اختبار رقعة جلدي بسيط على معصمك قبل الاستخدام الكامل للمرة الأولى لتفادي الحساسية الجلدية.' :
              'Because we formulate at high concentration levels (28% Extrait de Parfum), we use high-density natural raw materials. We strongly advise performing a simple skin patch test on your inner wrist before applying any fragrance fully.'}
          </p>
        </div>

        <div class="ingredients-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 3rem; margin-bottom: 4rem;">
          <!-- SAMR allergens -->
          <article style="background-color: var(--charcoal-800); border: 1px solid var(--border-whisper); padding: 2.5rem; border-radius: 4px;">
            <h3 class="serif-display" style="font-size: 1.8rem; margin-bottom: 1.5rem; color: var(--samr-accent);">SAMR Extrait</h3>
            <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 0.8rem; font-family: var(--font-sans); letter-spacing: 0.05em;">
              ${state.lang === 'ar' ? 'المركبات المسببة للحساسية المصرح بها' : 'Declared Allergen Compounds'}
            </span>
            <p style="font-size: 1.05rem; font-weight: 400; line-height: 1.7; color: var(--ivory-100); margin-bottom: 1.5rem; font-family: var(--font-sans); letter-spacing: 0.03em;">
              Linalool, Benzyl Salicylate, Alpha-Isomethyl Ionone, Coumarin, Vanillin.
            </p>
            <p style="font-size: 0.8rem; color: var(--taupe); line-height: 1.5; font-style: italic; border-top: 1px solid rgba(196,165,102,0.1); padding-top: 1rem;">
              ${state.lang === 'ar' ? 
                'قائمة المكونات الكاملة (INCI) موجودة على كل ملصق. توثيق التركيبات قيد المراجعة مع المورد الخاص بنا.' :
                'Full INCI list on every label. Composed-accord documentation in progress with our supplier.'}
            </p>
          </article>

          <!-- ASMR allergens -->
          <article style="background-color: var(--charcoal-800); border: 1px solid var(--border-whisper); padding: 2.5rem; border-radius: 4px;">
            <h3 class="serif-display" style="font-size: 1.8rem; margin-bottom: 1.5rem; color: var(--asmr-accent);">ASMR Extrait</h3>
            <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 0.8rem; font-family: var(--font-sans); letter-spacing: 0.05em;">
              ${state.lang === 'ar' ? 'المركبات المسببة للحساسية المصرح بها' : 'Declared Allergen Compounds'}
            </span>
            <p style="font-size: 1.05rem; font-weight: 400; line-height: 1.7; color: var(--ivory-100); margin-bottom: 1.5rem; font-family: var(--font-sans); letter-spacing: 0.03em;">
              Linalool, Benzyl Salicylate, Alpha-Isomethyl Ionone, Santalol, Limonene, Geraniol.
            </p>
            <p style="font-size: 0.8rem; color: var(--taupe); line-height: 1.5; font-style: italic; border-top: 1px solid rgba(196,165,102,0.1); padding-top: 1rem;">
              ${state.lang === 'ar' ? 
                'قائمة المكونات الكاملة (INCI) موجودة على كل ملصق. توثيق التركيبات قيد المراجعة مع المورد الخاص بنا.' :
                'Full INCI list on every label. Composed-accord documentation in progress with our supplier.'}
            </p>
          </article>
        </div>

        <!-- Body Sprays & Creams -->
        <div style="background-color: var(--charcoal-900); border: 1px solid var(--border-whisper); padding: 3rem; border-radius: 4px; max-width: 800px;">
          <h3 class="serif-display" style="font-size: 2rem; margin-bottom: 1.5rem; color: var(--gold);">${state.lang === 'ar' ? 'كريمات وبخاخات الجسم' : 'Body Sprays & Creams'}</h3>
          <p style="color: var(--taupe); line-height: 1.7; font-weight: 300; margin-bottom: 0;">
            ${state.lang === 'ar' ? 
              'تحتوي بخاخات وكريمات الجسم المعطرة من أسمر وسَمَر على نفس المركبات المسببة للحساسية المذكورة أعلاه ولكن بنسب وتركيزات مخففة وآمنة تماماً للبشرة. بالإضافة إلى ذلك، تحتوي كريمات الجسم على حافظة واسعة المجال (broad-spectrum preservative) لحمايتها من الميكروبات وضمان ثبات التركيبة لأطول فترة ممكنة.' :
              'Our scented body sprays and creams contain the same allergen compounds declared above at lower, skin-safe concentration levels suited for daily body application. Additionally, our rich body creams contain a broad-spectrum preservative to ensure microbiological stability and safety over extended storage.'}
          </p>
        </div>
      </section>
    </div>
  `;
}

// Footer Generator
function renderFooter() {
  const footerRoot = document.getElementById('footer-root');
  if (!footerRoot) return;

  const waFooterLink = IS_WHATSAPP_PLACEHOLDER
    ? `<span style="color: var(--taupe); font-size: 0.8rem; font-style: italic;">${t('whatsapp_prelaunch_note')}</span>`
    : `<a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('whatsapp_us')}</a>`;

  footerRoot.innerHTML = `
    <div class="container-custom" style="border-top: 1px solid var(--border-whisper); padding-top: 4rem;">
      <div class="footer-grid">
        <div class="footer-col">
          <h3 class="wordmark" style="font-size: 1.4rem; margin-bottom: 1rem;"><span style="color: var(--asmr-accent); font-weight: 600;">A S M R</span> &nbsp;&&nbsp; <span style="color: var(--samr-accent); font-weight: 600;">S A M R</span></h3>
          <p style="color: var(--taupe); font-size: 0.9rem; max-width: 300px; font-weight: 300; line-height: 1.6; margin-bottom: 1rem;">
            ${t('footer_description')}
          </p>
          <span style="font-family: var(--font-sans); font-size: 0.75rem; color: var(--gold); display: block;">
            ${state.lang === 'ar' ? BATCH_MOTIF_AR : BATCH_MOTIF_EN}
          </span>
        </div>
        <div class="footer-col">
          <h4 class="wordmark" style="font-size: 0.75rem; color: var(--gold); margin-bottom: 1.2rem;">${t('quick_links')}</h4>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 0.6rem;"><a href="#/" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_home')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/samr" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_samr')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/asmr" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_asmr')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/shop" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_shop')}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4 class="wordmark" style="font-size: 0.75rem; color: var(--gold); margin-bottom: 1.2rem;">${t('nav_gifting')}</h4>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 0.6rem;"><a href="#/gifting" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_gifting')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/story" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_story')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/contact" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('nav_contact')}</a></li>
            <li style="margin-bottom: 0.6rem;"><a href="#/ingredients" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('ingredients_safety')}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4 class="wordmark" style="font-size: 0.75rem; color: var(--gold); margin-bottom: 1.2rem;">${t('contact_us')}</h4>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 0.6rem;">${waFooterLink}</li>
            <li style="margin-bottom: 0.6rem;"><a href="${INSTAGRAM_URL}" target="_blank" rel="noopener" style="text-decoration: none; color: var(--taupe); font-size: 0.9rem; transition: color var(--transition-smooth);">${t('instagram')}</a></li>
            <li style="color: var(--taupe); font-size: 0.8rem; margin-top: 1rem; line-height: 1.4;">${t('compliance_note')}</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom" style="margin-top: 4rem; border-top: 1px solid rgba(196,165,102,0.1); padding-top: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <span style="font-size: 0.8rem; color: var(--taupe);">${t('footer_made')}</span>
        <span style="font-size: 0.8rem; color: var(--taupe);">${t('vat_note')}</span>
        <span style="font-size: 0.8rem; color: var(--taupe);">${t('footer_rights')}</span>
      </div>
    </div>
  `;
}

// Router Action
function renderApp() {
  renderHeader();
  renderCartDrawer();
  updateCartBadge();
  renderFooter();

  const mainRoot = document.getElementById('main-root');
  if (!mainRoot) return;

  const route = state.currentRoute;

  if (route === '#/' || route === '') {
    mainRoot.innerHTML = renderHome();
  } else if (route === '#/samr') {
    mainRoot.innerHTML = renderBrandPage('samr');
  } else if (route === '#/asmr') {
    mainRoot.innerHTML = renderBrandPage('asmr');
  } else if (route === '#/shop') {
    mainRoot.innerHTML = renderShop('all');
  } else if (route === '#/shop/extrait') {
    mainRoot.innerHTML = renderShop('extrait');
  } else if (route === '#/shop/spray') {
    mainRoot.innerHTML = renderShop('spray');
  } else if (route === '#/shop/cream') {
    mainRoot.innerHTML = renderShop('cream');
  } else if (route === '#/shop/sets') {
    mainRoot.innerHTML = renderShop('sets');
  } else if (route.startsWith('#/product/')) {
    const prodId = route.substring(10);
    mainRoot.innerHTML = renderProductDetail(prodId);
  } else if (route === '#/story') {
    mainRoot.innerHTML = renderStory();
  } else if (route === '#/gifting') {
    mainRoot.innerHTML = renderGifting();
  } else if (route === '#/contact') {
    mainRoot.innerHTML = renderContact();
  } else if (route === '#/ingredients') {
    mainRoot.innerHTML = renderIngredients();
  } else if (route === '#/admin' || route.startsWith('#/admin/')) {
    const sub = route.startsWith('#/admin/') ? route.substring('#/admin/'.length).replace(/\/+$/, '') : 'overview';
    mainRoot.innerHTML = renderAdmin(sub);
  } else if (route === '#/account' || route.startsWith('#/account/')) {
    // Account tabs are real, linkable sub-routes: #/account/<tab>.
    // This makes direct navigation, refresh, and back/forward work per tab,
    // and prevents any single tab (e.g. rewards) from becoming a fallback.
    const validTabs = ['overview', 'orders', 'addresses', 'payments', 'wishlist', 'rewards', 'preferences', 'notifications'];
    const sub = route.startsWith('#/account/') ? route.substring('#/account/'.length).replace(/\/+$/, '') : 'overview';
    state.accountTab = validTabs.includes(sub) ? sub : 'overview';
    mainRoot.innerHTML = renderAccount();
  } else {
    // 404 fallback - redirect to home
    window.location.hash = '#/';
  }
}

async function submitNewsletter(e) {
  e.preventDefault();
  const emailInput = document.getElementById('newsletter-email');
  const feedback = document.getElementById('newsletter-feedback');
  const errorEl = document.getElementById('newsletter-err-email');
  
  if (!emailInput || !feedback || !errorEl) return;

  emailInput.classList.remove('invalid');
  errorEl.style.display = 'none';
  errorEl.innerText = '';
  feedback.style.display = 'none';
  feedback.innerText = '';

  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    emailInput.classList.add('invalid');
    errorEl.innerText = state.lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email address';
    errorEl.style.display = 'block';
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add('invalid');
    errorEl.innerText = state.lang === 'ar' ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address format';
    errorEl.style.display = 'block';
    return;
  }

  // Store in localStorage
  const list = JSON.parse(localStorage.getItem('asmr_samr_newsletter_emails')) || [];
  if (!list.includes(email)) {
    list.push(email);
    localStorage.setItem('asmr_samr_newsletter_emails', JSON.stringify(list));
  }

  try {
    if (getPublicSupabaseConfig().key) {
      await publicSupabaseRequest('newsletter_subscribers?on_conflict=email', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { email }
      });
    }
  } catch (_) {
    feedback.innerText = state.lang === 'ar' ? '\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644. \u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.' : 'We could not connect. Please try again.';
    feedback.style.display = 'block';
    return;
  }

  feedback.innerText = state.lang === 'ar' ? 'شكراً لك! تم تسجيل بريدك الإلكتروني بنجاح.' : 'Thank you! You have joined the first numbered batch.';
  feedback.style.display = 'block';
  emailInput.value = '';
}

// Global functions attached to window for inline HTML handlers
window.updateCartQty = updateCartQty;
window.submitNewsletter = submitNewsletter;
window.removeFromCart = removeFromCart;
window.addToCart = addToCart;
window.toggleWishlist = toggleWishlist;
window.resendOrder = resendOrder;
window.saveProfileFromForm = saveProfileFromForm;
window.clearAccountData = clearAccountData;
window.selectProductSize = selectProductSize;
window.toggleAccordion = toggleAccordion;
window.buyNowWhatsApp = buyNowWhatsApp;
window.checkoutToWhatsApp = checkoutToWhatsApp;
window.closeCartDrawer = closeCartDrawer;
window.openPreorderModal = openPreorderModal;
window.closePreorderModal = closePreorderModal;
window.switchAccountTab = function(e, tab) {
  if (e) e.preventDefault();
  const target = (tab === 'overview') ? '#/account' : '#/account/' + tab;
  if (window.location.hash === target) {
    // same hash won't fire hashchange — render directly
    state.currentRoute = target;
    renderApp();
  } else {
    window.location.hash = target; // updates URL + history; hashchange -> renderApp
  }
  window.scrollTo(0, 0);
};
window.handleAccountLogout = function(e) { e.preventDefault(); clearAccountData(); };
window.saveNotificationPrefs = saveNotificationPrefs;
window.saveProfileData = saveProfileData;
window.showToast = showToast;

// Init Event Listeners on Load
let asmrSamrAppInitialized = false;
async function initAsmrSamrApp() {
  if (asmrSamrAppInitialized) return;
  asmrSamrAppInitialized = true;

  // Sticky header transition
  window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (!header) return;
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Setup backdrop close
  document.getElementById('drawer-backdrop')?.addEventListener('click', () => {
    closeCartDrawer();
    closeMobileNav();
    closePreorderModal();
  });
  document.getElementById('cart-close-btn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cart-checkout-btn')?.addEventListener('click', checkoutToWhatsApp);

  // Keyboard accessibility listeners (Trap focus and Escape close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeMobileNav();
      closePreorderModal();
    }
    
    // Trap focus inside cart drawer when open
    const drawer = document.getElementById('cart-drawer');
    if (drawer && drawer.classList.contains('open') && e.key === 'Tab') {
      const focusables = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      
      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    }

    // Trap focus inside mobile navigation drawer when open
    const navLinks = document.getElementById('nav-links');
    const mobileToggle = document.getElementById('mobile-toggle');
    if (navLinks && navLinks.classList.contains('open') && window.innerWidth <= 768 && e.key === 'Tab') {
      const focusables = navLinks.querySelectorAll('a, button');
      const allFocusables = [mobileToggle, ...focusables].filter(Boolean);
      const firstFocusable = allFocusables[0];
      const lastFocusable = allFocusables[allFocusables.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    }

    // Trap focus inside preorder modal when open
    const preorderModal = document.getElementById('preorder-modal');
    if (preorderModal && preorderModal.classList.contains('open') && e.key === 'Tab') {
      const focusables = preorderModal.querySelectorAll('input, button');
      const allFocusables = [document.getElementById('preorder-modal-close'), ...focusables].filter(Boolean);
      const firstFocusable = allFocusables[0];
      const lastFocusable = allFocusables[allFocusables.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    }
  });

  // Set RTL direction if Arabic starts active
  document.documentElement.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', state.lang);

  initRouter();
  renderApp();

  loadPublicCatalogFromSupabase().then((loaded) => {
    if (!loaded) return;
    const route = window.location.hash || '#/';
    if (route === '#/' || route.startsWith('#/shop') || route.startsWith('#/product/') || route === '#/gifting') {
      renderApp();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAsmrSamrApp);
} else {
  initAsmrSamrApp();
}
