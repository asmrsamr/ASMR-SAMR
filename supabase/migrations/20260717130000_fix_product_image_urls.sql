-- Point the original catalog image records at the optimized WebP files and PNG backups.
-- Custom admin-uploaded images are not changed.

update public.product_images
set public_url = '/assets/products/consistent-catalog-20260712/' || product_id || '.webp',
    fallback_url = '/assets/products/consistent-catalog-20260712/' || product_id || '.png',
    updated_at = now()
where product_id in (
  'samr-extrait', 'asmr-extrait', 'samr-spray', 'asmr-spray', 'samr-cream',
  'asmr-cream', 'discovery-set', 'duo-box', 'samr-trio', 'asmr-trio'
)
  and public_url = '/assets/products/' || product_id || '.webp';

update public.products
set image_webp = '/assets/products/consistent-catalog-20260712/' || id || '.webp',
    image_png = '/assets/products/consistent-catalog-20260712/' || id || '.png',
    updated_at = now()
where id in (
  'samr-extrait', 'asmr-extrait', 'samr-spray', 'asmr-spray', 'samr-cream',
  'asmr-cream', 'discovery-set', 'duo-box', 'samr-trio', 'asmr-trio'
)
  and image_webp = '/assets/products/' || id || '.webp';
