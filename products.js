// products.js — single source of truth for the shop catalog.
// Used by the homepage teaser, store.html, and cart.html (for price/name/
// image lookups when rendering whatever's in localStorage).
window.UZ_PRODUCTS = [
  {
    id: 'onyx',
    price: 89,
    image: 'assets/products/crate-onyx.webp',
    nameKey: 'shop_onyx_name',
    descKey: 'shop_onyx_desc'
  },
  {
    id: 'ultraviolet',
    price: 89,
    image: 'assets/products/crate-ultraviolet.webp',
    nameKey: 'shop_ultraviolet_name',
    descKey: 'shop_ultraviolet_desc'
  },
  {
    id: 'recon',
    price: 79,
    image: 'assets/products/crate-recon.webp',
    nameKey: 'shop_recon_name',
    descKey: 'shop_recon_desc'
  }
];
