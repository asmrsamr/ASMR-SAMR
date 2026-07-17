-- Serve the public catalog through an explicit safe projection.
-- Internal costs, stock values, storage paths, and audit fields never leave this RPC.

create or replace function public.get_storefront_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'brand', p.brand,
          'type', p.type,
          'name_en', p.name_en,
          'name_ar', p.name_ar,
          'family_en', p.family_en,
          'family_ar', p.family_ar,
          'desc_en', p.desc_en,
          'desc_ar', p.desc_ar,
          'hero_size', p.hero_size,
          'featured_on_home', p.featured_on_home,
          'sort_order', p.sort_order,
          'image_webp', p.image_webp,
          'image_png', p.image_png,
          'badge_en', p.badge_en,
          'badge_ar', p.badge_ar,
          'gender_identity', p.gender_identity,
          'concentration', p.concentration,
          'availability', p.availability,
          'status', p.status,
          'published_at', p.published_at,
          'scent_profile', p.scent_profile,
          'who_it_is_for', p.who_it_is_for,
          'how_to_wear', p.how_to_wear,
          'longevity', p.longevity,
          'gift_ready_message', p.gift_ready_message,
          'product_prices', coalesce((
            select jsonb_agg(
              jsonb_build_object('size', pp.size, 'price', pp.price)
              order by pp.size
            )
            from public.product_prices pp
            where pp.product_id = p.id
          ), '[]'::jsonb),
          'product_images', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pi.id,
                'public_url', pi.public_url,
                'fallback_url', pi.fallback_url,
                'mime_type', pi.mime_type,
                'is_primary', pi.is_primary,
                'sort_order', pi.sort_order,
                'alt_text', pi.alt_text
              )
              order by pi.sort_order, pi.created_at
            )
            from public.product_images pi
            where pi.product_id = p.id
          ), '[]'::jsonb)
        )
        order by p.sort_order, p.id
      )
      from public.products p
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
    ), '[]'::jsonb),
    'fragrance_notes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', pfn.product_id,
          'phase', pfn.phase,
          'sort_order', pfn.sort_order,
          'fragrance_notes', jsonb_build_object(
            'name_en', fn.name_en,
            'name_ar', fn.name_ar
          )
        )
        order by p.sort_order, pfn.phase, pfn.sort_order
      )
      from public.product_fragrance_notes pfn
      join public.products p on p.id = pfn.product_id
      join public.fragrance_notes fn on fn.id = pfn.note_id
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
    ), '[]'::jsonb),
    'related_products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', rp.product_id,
          'related_product_id', rp.related_product_id,
          'relation_type', rp.relation_type,
          'sort_order', rp.sort_order
        )
        order by p.sort_order, rp.sort_order
      )
      from public.related_products rp
      join public.products p on p.id = rp.product_id
      join public.products related on related.id = rp.related_product_id
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
        and related.is_active
        and related.status = 'published'
        and related.deleted_at is null
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.get_storefront_catalog() from public, anon, authenticated;
grant execute on function public.get_storefront_catalog() to anon, authenticated;

comment on function public.get_storefront_catalog() is
  'Returns the published storefront catalog using an explicit public-field projection.';

drop policy if exists products_public_read on public.products;
drop policy if exists prices_public_read on public.product_prices;
drop policy if exists product_variants_public_read on public.product_variants;
drop policy if exists product_images_public_read on public.product_images;
drop policy if exists fragrance_notes_public_read on public.fragrance_notes;
drop policy if exists product_fragrance_notes_public_read on public.product_fragrance_notes;
drop policy if exists related_products_public_read on public.related_products;
drop policy if exists coupons_public_read on public.coupons;

revoke select on table
  public.products,
  public.product_prices,
  public.product_variants,
  public.product_images,
  public.fragrance_notes,
  public.product_fragrance_notes,
  public.related_products,
  public.coupons
from anon;

revoke select on table
  public.products,
  public.product_prices,
  public.product_variants,
  public.product_images,
  public.fragrance_notes,
  public.product_fragrance_notes,
  public.related_products,
  public.coupons
from public;
