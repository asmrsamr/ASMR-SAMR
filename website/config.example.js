// Copy this file to website/config.local.js for local testing.
// Do not commit config.local.js. Use the Supabase publishable/anon key only.
window.ASMR_SAMR_CONFIG = {
  supabaseUrl: 'https://thpuomqhqghqskyegpfj.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  // Public launch configuration. These are browser-visible values, not secrets.
  whatsappNumber: '966560505651',
  siteDomain: 'https://asmrsamr.com',
  founderName: 'ASMR & SAMR Fragrances',
  instagramUrl: 'https://instagram.com/asmr.samr.perfumes',
  productionCityEn: 'Riyadh',
  productionCityAr: 'الرياض',
  reservedCount: 42,
  // Descriptive only; profile roles and Supabase RLS authorize access.
  adminRoles: ['admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support'],
  adminRequireAuth: true
};
