import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const BCRYPT_ROUNDS = 10; // Fast for demo seeding while secure

export async function seedFullDemoData() {
  console.log('=== STARTING FULL MAJESTIC BLAZER DEMO DATA SEEDING ===');

  // 0. Ensure Store Settings
  const storeSettings = [
    ['store_name', 'Majestic Blazer', 'Official brand name'],
    ['brand_tagline', 'Style That Speaks', 'Official brand tagline'],
    ['store_address', 'Sathy Road, Kurumbampalayam, Coimbatore - 641107', 'Flagship atelier address'],
    ['store_phone', '8903238882', 'Customer service phone number'],
    ['store_email', 'contact@majesticblazer.com', 'Store contact email'],
    ['tax_percentage', '0', 'GST percentage (0 for inclusive pricing)'],
    ['shipping_fee', '0', 'Complimentary white-glove shipping fee'],
  ];

  for (const [key, value, description] of storeSettings) {
    await pool.query(
      `INSERT INTO store_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`,
      [key, value, description]
    );
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }
  console.log('✓ Store settings configured');

  // 1. Categories (Exact 6 requested categories)
  const categoryDefs = [
    {
      name: 'Formal Blazers',
      slug: 'formal-blazers',
      description: 'Commanding sartorial tailoring for corporate boardrooms and high-stakes executive presence.',
      sort_order: 1,
    },
    {
      name: 'Casual Blazers',
      slug: 'casual-blazers',
      description: 'Unconstructed Irish linen, hopsack wools, and lightweight silhouettes for modern leisure and travel.',
      sort_order: 2,
    },
    {
      name: 'Wedding Blazers',
      slug: 'wedding-blazers',
      description: 'Opulent bandhgalas, jacquard dinner jackets, and regal silhouettes crafted for celebratory matrimony.',
      sort_order: 3,
    },
    {
      name: 'Partywear Blazers',
      slug: 'partywear-blazers',
      description: 'Lustrous Italian cotton velvets, jewel-toned satin lapels, and after-hours eveningwear.',
      sort_order: 4,
    },
    {
      name: 'Premium Blazers',
      slug: 'premium-blazers',
      description: 'Hand-canvassed Super 150s wools, horn buttons, and bespoke finishes from premier European mills.',
      sort_order: 5,
    },
    {
      name: 'Business Blazers',
      slug: 'business-blazers',
      description: 'Wrinkle-resistant twills and versatile navy and charcoal sports coats tailored for daily professional poise.',
      sort_order: 6,
    },
  ];

  const categoryMap = {};
  for (const cat of categoryDefs) {
    const res = await pool.query(
      `INSERT INTO categories (name, slug, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         is_active = true
       RETURNING id, slug`,
      [cat.name, cat.slug, cat.description, cat.sort_order]
    );
    categoryMap[res.rows[0].slug] = res.rows[0].id;
  }
  console.log(`✓ 6 Categories verified (${Object.keys(categoryMap).join(', ')})`);

  // 2. Customers (At least 20 realistic accounts)
  const defaultPasswordHash = await bcrypt.hash('CustomerDemo2026!', BCRYPT_ROUNDS);
  const adminPasswordHash = await bcrypt.hash('MajesticAdmin2026!Secure', BCRYPT_ROUNDS);

  // Ensure Administrator Account
  await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
     VALUES ('Atelier Demo Administrator', 'admin.demo@majesticblazer.com', '8903238882', $1, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true`,
    [adminPasswordHash]
  );

  const customerDefs = [
    { name: 'Demo Patron', email: 'customer.demo@majesticblazer.com', phone: '8903238882', city: 'Coimbatore', state: 'Tamil Nadu', active: true },
    { name: 'Aditya Vikram Singhania', email: 'aditya.singhania@heritage.in', phone: '9840123450', city: 'Chennai', state: 'Tamil Nadu', active: true },
    { name: 'Dr. Siddharth Menon', email: 'siddharth.menon@carehealth.org', phone: '9840123451', city: 'Coimbatore', state: 'Tamil Nadu', active: true },
    { name: 'Raghavan K. Iyer', email: 'raghavan.iyer@fintechcapital.com', phone: '9840123452', city: 'Bengaluru', state: 'Karnataka', active: true },
    { name: 'Karthik Raja Ramasamy', email: 'karthik.raja@solardrive.in', phone: '9840123453', city: 'Coimbatore', state: 'Tamil Nadu', active: true },
    { name: 'Gautam Gambhir Roy', email: 'gautam.roy@lawchambers.com', phone: '9840123454', city: 'Kolkata', state: 'West Bengal', active: true },
    { name: 'Arjun Nambiar', email: 'arjun.nambiar@coastalluxury.in', phone: '9840123455', city: 'Kochi', state: 'Kerala', active: true },
    { name: 'Pranav Venkatesh', email: 'pranav.venkat@cloudscale.io', phone: '9840123456', city: 'Hyderabad', state: 'Telangana', active: true },
    { name: 'Vikramaditya Rao', email: 'vikram.rao@royalestates.co', phone: '9840123457', city: 'Bengaluru', state: 'Karnataka', active: true },
    { name: 'Ashwin Balasubramanian', email: 'ashwin.bala@texmills.in', phone: '9840123458', city: 'Tirupur', state: 'Tamil Nadu', active: true },
    { name: 'Rohan Mehra', email: 'rohan.mehra@atelierstudios.com', phone: '9840123459', city: 'Mumbai', state: 'Maharashtra', active: true },
    { name: 'Harish Chandra Verma', email: 'harish.verma@apexgroup.org', phone: '9840123460', city: 'New Delhi', state: 'Delhi', active: true },
    { name: 'Sanjay Krishnaswamy', email: 'sanjay.k@venturefoundry.vc', phone: '9840123461', city: 'Chennai', state: 'Tamil Nadu', active: true },
    { name: 'Varun Somani', email: 'varun.somani@somanicap.com', phone: '9840123462', city: 'Jaipur', state: 'Rajasthan', active: true },
    { name: 'Naveen Pattabhiraman', email: 'naveen.p@agritechcorp.in', phone: '9840123463', city: 'Madurai', state: 'Tamil Nadu', active: true },
    { name: 'Dr. Alok Nath Mukherjee', email: 'alok.mukherjee@heartinst.ac.in', phone: '9840123464', city: 'Kolkata', state: 'West Bengal', active: true },
    { name: 'Devanathan Sridhar', email: 'devanathan.s@aerospacedef.in', phone: '9840123465', city: 'Bengaluru', state: 'Karnataka', active: true },
    { name: 'Manish Agarwal', email: 'manish.agarwal@textilescorp.in', phone: '9840123466', city: 'Surat', state: 'Gujarat', active: true },
    { name: 'Kishan Chandrasekhar', email: 'kishan.chandra@bioresearch.org', phone: '9840123467', city: 'Hyderabad', state: 'Telangana', active: true },
    { name: 'Zaid Al-Mansoor', email: 'zaid.mansoor@gulfholding.ae', phone: '9840123468', city: 'Dubai', state: 'UAE', active: true },
    { name: 'Rishabh Tandon', email: 'rishabh.tandon@globalarbitrage.com', phone: '9840123469', city: 'Mumbai', state: 'Maharashtra', active: true },
    { name: 'Suresh Kumar Gounder', email: 'suresh.gounder@coimbatoreauto.com', phone: '9840123470', city: 'Coimbatore', state: 'Tamil Nadu', active: false }, // inactive customer example for testing filter
  ];

  const customerMap = [];
  for (let i = 0; i < customerDefs.length; i++) {
    const c = customerDefs[i];
    const registeredDate = new Date(Date.now() - (180 - i * 7) * 24 * 3600 * 1000);
    const res = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'customer', $5, $6, $6)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         is_active = EXCLUDED.is_active
       RETURNING id, full_name, email`,
      [c.name, c.email, c.phone, defaultPasswordHash, c.active, registeredDate]
    );
    const userId = res.rows[0].id;
    customerMap.push({ id: userId, ...c });

    // Ensure 1-2 addresses per customer
    await pool.query(
      `INSERT INTO addresses (user_id, line1, line2, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, '641001', true)
       ON CONFLICT DO NOTHING`,
      [userId, `${10 + i * 2}, Royal Residency Boulevard`, 'Race Course Precinct', c.city, c.state]
    );
  }
  console.log(`✓ ${customerMap.length} Customers verified with saved addresses`);

  // 3. Products (At least 30 realistic men's blazers)
  const blazerImages = [
    { front: '/assets/products/imperial-navy-velvet-front.webp', detail: '/assets/products/imperial-navy-velvet-detail.webp' },
    { front: '/assets/products/crown-oxford-double-breasted-front.webp', detail: '/assets/products/crown-oxford-double-breasted-detail.webp' },
    { front: '/assets/products/regal-black-tuxedo-front.webp', detail: '/assets/products/regal-black-tuxedo-detail.webp' },
    { front: '/assets/products/sovereign-charcoal-check-front.webp', detail: '/assets/products/sovereign-charcoal-check-detail.webp' },
    { front: '/assets/products/monarch-burgundy-bandhgala-front.webp', detail: '/assets/products/monarch-burgundy-bandhgala-detail.webp' },
    { front: '/assets/products/ascot-sand-tan-linen-front.webp', detail: '/assets/products/ascot-sand-tan-linen-detail.webp' },
    { front: '/assets/products/regal-black-tuxedo-front.webp', detail: '/assets/products/regal-black-tuxedo-detail.webp' },
    { front: '/assets/products/imperial-navy-velvet-front.webp', detail: '/assets/products/imperial-navy-velvet-detail.webp' },
  ];

  const productCatalogue = [
    // Formal Blazers (5)
    {
      category: 'formal-blazers',
      name: 'Classic Black Slim Fit Blazer',
      slug: 'classic-black-slim-fit-blazer',
      description: 'The foundation of the modern masculine wardrobe. Woven from Super 130s Merino wool with hand-finished notched lapels, horn buttons, and breathable Bemberg lining.',
      color: 'Obsidian Black',
      material: '100% Super 130s Australian Merino Wool',
      fit: 'Tailored Slim Fit',
      sale_price: 13999, original_price: 16999, rent_price: 1599, deposit: 5000,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'formal-blazers',
      name: 'Crown Classic Double-Breasted Oxford Navy Blazer',
      slug: 'crown-classic-double-breasted-oxford-navy-blazer',
      description: 'An enduring icon of executive authority. Double-breasted six-button stance with peaked silk-canvassed lapels and engraved palladium-plated silver buttons.',
      color: 'Oxford Navy',
      material: '100% Super 140s Italian Wool Worsted',
      fit: 'Classic Tailored Fit',
      sale_price: 15499, original_price: 18999, rent_price: 1699, deposit: 5500,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'formal-blazers',
      name: 'Charcoal Executive Canvassed Wool Blazer',
      slug: 'charcoal-executive-canvassed-wool-blazer',
      description: 'Meticulously crafted half-canvassed construction that molds to your physique over time. Finished with pick stitching and double back vents.',
      color: 'Deep Charcoal Grey',
      material: 'Super 140s Wool with Natural Stretch',
      fit: 'Executive Tailored Fit',
      sale_price: 14499, original_price: 17999, rent_price: 1499, deposit: 5000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'formal-blazers',
      name: 'Midnight Navy Single-Breasted Peak Lapel Blazer',
      slug: 'midnight-navy-single-breasted-peak-lapel-blazer',
      description: 'A striking single-breasted silhouette pairing high peak lapels with a slender waist suppression. Ideal for evening galas and executive summits.',
      color: 'Midnight Navy',
      material: '100% Worsted Wool with Silk Sheen',
      fit: 'Modern Slim Fit',
      sale_price: 14999, original_price: 18499, rent_price: 1649, deposit: 5000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'formal-blazers',
      name: 'Sovereign Anthracite Sharkskin Blazer',
      slug: 'sovereign-anthracite-sharkskin-blazer',
      description: 'Distinguished sharkskin twill weave exhibiting subtle two-tone depth under boardroom illumination. Naturally wrinkle-resistant and travel-ready.',
      color: 'Anthracite Grey',
      material: 'Wool Sharkskin with Cupro Lining',
      fit: 'Tailored Slim Fit',
      sale_price: 13499, original_price: 16499, rent_price: 1399, deposit: 4500,
      featured: false, purchasable: true, rentable: true,
    },

    // Casual Blazers (5)
    {
      category: 'casual-blazers',
      name: 'Riviera Unstructured Sand Linen Blazer',
      slug: 'riviera-unstructured-sand-linen-blazer',
      description: 'Lightweight, unlined luxury tailored from pure Irish linen. Embraces natural creasing with unpadded soft shoulders and patch pockets for relaxed poise.',
      color: 'Sand Tan',
      material: '100% Pure Irish Linen',
      fit: 'Soft Shoulder Unconstructed Fit',
      sale_price: 11999, original_price: 14999, rent_price: 1299, deposit: 4000,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'casual-blazers',
      name: 'Tuscan Textured Hopsack Wool Blazer',
      slug: 'tuscan-textured-hopsack-wool-blazer',
      description: 'An open basketweave hopsack that delivers maximum breathability and wrinkle recovery. Finished with genuine mother-of-pearl buttons.',
      color: 'Rich Cocoa Brown',
      material: '100% High-Twist Hopsack Wool',
      fit: 'Casual Tailored Fit',
      sale_price: 12999, original_price: 15999, rent_price: 1399, deposit: 4500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'casual-blazers',
      name: 'Capri Sky Blue Chambray Summer Blazer',
      slug: 'capri-sky-blue-chambray-summer-blazer',
      description: 'Breathable cotton-linen blend chambray jacket designed for yacht clubs, vineyard lunches, and garden weddings.',
      color: 'Chambray Sky Blue',
      material: '60% Linen, 40% Fine Combed Cotton',
      fit: 'Unstructured Slim Fit',
      sale_price: 11499, original_price: 13999, rent_price: 1199, deposit: 4000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'casual-blazers',
      name: 'Olive Sage Garment-Dyed Cotton Blazer',
      slug: 'olive-sage-garment-dyed-cotton-blazer',
      description: 'Garment-washed Italian cotton twill offering a lived-in patina and supple softness from day one. Pairs seamlessly with selvedge denim.',
      color: 'Sage Olive',
      material: '98% Cotton, 2% Elastane for Comfort',
      fit: 'Modern Casual Fit',
      sale_price: 10999, original_price: 13499, rent_price: 1149, deposit: 3500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'casual-blazers',
      name: 'St. Tropez Off-White Raw Silk Blazer',
      slug: 'st-tropez-off-white-raw-silk-blazer',
      description: 'Artisanal slubbed raw silk blazer radiating effortless Mediterranean confidence. Features hand-stitched barchetta breast pocket.',
      color: 'Off-White Ivory',
      material: '100% Slubbed Mulberry Silk',
      fit: 'Tailored Relaxed Fit',
      sale_price: 16999, original_price: 21999, rent_price: 1899, deposit: 6000,
      featured: false, purchasable: true, rentable: true,
    },

    // Wedding Blazers (6)
    {
      category: 'wedding-blazers',
      name: 'Monarch Royal Burgundy Embroidered Bandhgala',
      slug: 'monarch-royal-burgundy-embroidered-bandhgala',
      description: 'Grand royal heritage silhouette featuring delicate zardozi tonal threadwork on the mandarin collar. Finished with handcrafted antique brass buttons.',
      color: 'Royal Burgundy',
      material: 'Silk Matka with Raw Silk Lining',
      fit: 'Regal Structured Bandhgala Fit',
      sale_price: 18999, original_price: 23999, rent_price: 2299, deposit: 7000,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'wedding-blazers',
      name: 'Imperial Royal Navy Velvet Peak Lapel Blazer',
      slug: 'imperial-royal-navy-velvet-peak-lapel-blazer',
      description: 'Crafted from plush imported Italian cotton velvet, this midnight navy blazer exudes quiet sovereignty. Features silk covered buttons and double vents.',
      color: 'Midnight Navy Velvet',
      material: '100% Cotton Italian Velvet with Silk Bemberg',
      fit: 'Tailored Slim Fit',
      sale_price: 14999, original_price: 18999, rent_price: 1799, deposit: 6000,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'wedding-blazers',
      name: 'Sovereign Ivory Jacquard Wedding Dinner Jacket',
      slug: 'sovereign-ivory-jacquard-wedding-dinner-jacket',
      description: 'Opulent ivory and champagne floral jacquard weave with satin shawl lapel. Tailored for celebratory receptions and grand wedding banquets.',
      color: 'Champagne Ivory',
      material: 'Silk Blend Damask Jacquard',
      fit: 'Sculpted Evening Fit',
      sale_price: 17499, original_price: 21999, rent_price: 2099, deposit: 6500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'wedding-blazers',
      name: 'Maharaja Emerald Brocade Ceremonial Blazer',
      slug: 'maharaja-emerald-brocade-ceremonial-blazer',
      description: 'Woven with subtle antique gold zari accents on rich emerald silk brocade. Creates an unforgettable ceremonial entrance.',
      color: 'Deep Emerald & Gold',
      material: 'Pure Banarasi Silk Brocade',
      fit: 'Bespoke Architectural Fit',
      sale_price: 19999, original_price: 24999, rent_price: 2499, deposit: 8000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'wedding-blazers',
      name: 'Gilded Midnight Black Silk Embroidered Blazer',
      slug: 'gilded-midnight-black-silk-embroidered-blazer',
      description: 'Black-on-black geometric embroidery adorning structured wool shoulders. Understated opulence for black-tie sangeet celebrations.',
      color: 'Pitch Black with Tonal Silk',
      material: 'Wool-Silk Duchesse Satin',
      fit: 'Modern Slim Fit',
      sale_price: 16499, original_price: 19999, rent_price: 1899, deposit: 6000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'wedding-blazers',
      name: 'Peacock Teal Raw Silk Prince Coat',
      slug: 'peacock-teal-raw-silk-prince-coat',
      description: 'Vibrant jewel-toned teal tailored with a high Nehru collar and flared hem. Crafted for high-profile royal destination nuptials.',
      color: 'Jewel Peacock Teal',
      material: 'Handloom Raw Dupioni Silk',
      fit: 'Traditional Prince Coat Silhouette',
      sale_price: 15999, original_price: 19499, rent_price: 1749, deposit: 5500,
      featured: false, purchasable: true, rentable: true,
    },

    // Partywear Blazers (5)
    {
      category: 'partywear-blazers',
      name: 'Heritage Emerald Velvet Shawl Lapel Tuxedo',
      slug: 'heritage-emerald-velvet-shawl-lapel-tuxedo',
      description: 'Deep forest emerald velvet catching every facet of ambient candlelight. Contoured with satin shawl lapels and silk frog buttons.',
      color: 'Forest Emerald',
      material: '100% Italian Cotton Velvet',
      fit: 'Cocktail Slim Fit',
      sale_price: 16499, original_price: 20999, rent_price: 1999, deposit: 6000,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'partywear-blazers',
      name: 'Midnight Blue Astral Jacquard Party Blazer',
      slug: 'midnight-blue-astral-jacquard-party-blazer',
      description: 'Constellation jacquard pattern woven with micro-lustre threads. Command the red carpet and private lounge galas.',
      color: 'Midnight Astral Blue',
      material: 'Silk Blend Micro-Jacquard',
      fit: 'Tapered Partywear Fit',
      sale_price: 15499, original_price: 18999, rent_price: 1799, deposit: 5500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'partywear-blazers',
      name: 'Crimson Velvet Smoking Jacket with Frog Closures',
      slug: 'crimson-velvet-smoking-jacket',
      description: 'Traditional Mayfair smoking jacket featuring quilted black satin lapels and tasselled frog toggle closures.',
      color: 'Venetian Crimson',
      material: 'Plush Cotton Velvet with Quilted Satin',
      fit: 'Relaxed Smoking Jacket Fit',
      sale_price: 17999, original_price: 22999, rent_price: 2199, deposit: 7000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'partywear-blazers',
      name: 'Obsidian Black Sequin Embellished Party Blazer',
      slug: 'obsidian-black-sequin-embellished-blazer',
      description: 'Micro-sequin black detailing catching subtle glimmers under nightclub spotlights without overwhelming classical tailoring.',
      color: 'Jet Black with Micro Sequins',
      material: 'Canvassed Wool-Poly with Sequin Embellishment',
      fit: 'Ultra Slim Evening Fit',
      sale_price: 14999, original_price: 18499, rent_price: 1699, deposit: 5000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'partywear-blazers',
      name: 'Cobalt Blue Satin Faced Cocktail Jacket',
      slug: 'cobalt-blue-satin-faced-cocktail-jacket',
      description: 'Electric cobalt wool contrasting sharply with glossy black satin peak lapels. Statement piece for awards ceremonies.',
      color: 'Cobalt Blue & Black Satin',
      material: 'Super 120s Wool with Duchesse Satin',
      fit: 'Cocktail Tailored Fit',
      sale_price: 13999, original_price: 16999, rent_price: 1499, deposit: 4500,
      featured: false, purchasable: true, rentable: true,
    },

    // Premium Blazers (5)
    {
      category: 'premium-blazers',
      name: 'Sovereign Midnight Black Grosgrain Tuxedo',
      slug: 'sovereign-midnight-black-grosgrain-tuxedo',
      description: 'The pinnacle of black-tie couture. Hand-canvassed Super 150s Tasmanian wool adorned with grosgrain ribbon facings on peak lapels and jetted pockets.',
      color: 'Black Tie Jet Black',
      material: '100% Super 150s Tasmanian Virgin Wool',
      fit: 'Bespoke Atelier Fit',
      sale_price: 24999, original_price: 29999, rent_price: 2799, deposit: 8500,
      featured: true, purchasable: true, rentable: true,
    },
    {
      category: 'premium-blazers',
      name: 'Cashmere & Wool Blend Navy Windowpane Blazer',
      slug: 'cashmere-wool-blend-navy-windowpane-blazer',
      description: 'Sublime blend of 30% Mongolian cashmere and 70% Super 140s wool. Soft, enveloping warmth with a faint silver windowpane grid.',
      color: 'Navy with Silver Windowpane',
      material: '70% Wool, 30% Mongolian Cashmere',
      fit: 'Sartorial Half-Canvassed Fit',
      sale_price: 21999, original_price: 26999, rent_price: 2399, deposit: 7500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'premium-blazers',
      name: 'Savile Row Flannel Double-Breasted Chalkstripe Blazer',
      slug: 'savile-row-flannel-double-breasted-chalkstripe-blazer',
      description: 'Heavyweight British woolen flannel with chalk stripes. Channel timeless Winston Churchill statesman elegance.',
      color: 'Charcoal Grey with White Chalkstripe',
      material: '100% British Wool Flannel (380g/m)',
      fit: 'Traditional Double-Breasted Stance',
      sale_price: 22999, original_price: 27999, rent_price: 2499, deposit: 8000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'premium-blazers',
      name: 'Camel Hair Peak Lapel Sartorial Over-Blazer',
      slug: 'camel-hair-peak-lapel-sartorial-blazer',
      description: 'Un-dyed golden natural baby camel hair sourced from the Gobi desert. Supreme insulating properties with feathery lightness.',
      color: 'Natural Golden Camel',
      material: '100% Pure Gobi Baby Camelhair',
      fit: 'Tailored Sartorial Cut',
      sale_price: 26999, original_price: 32999, rent_price: 2899, deposit: 9000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'premium-blazers',
      name: 'Viceroy Houndstooth Silk-Wool Country Jacket',
      slug: 'viceroy-houndstooth-silk-wool-country-jacket',
      description: 'Sophisticated micro-houndstooth woven with raw tussar silk and worsted wool. Finished with genuine suede elbow patches and leather throat latch.',
      color: 'Olive, Black & Cream Houndstooth',
      material: '50% Silk, 50% Wool with Suede Accents',
      fit: 'Country Gentleman Tailored Fit',
      sale_price: 19499, original_price: 23999, rent_price: 2099, deposit: 6500,
      featured: false, purchasable: true, rentable: true,
    },

    // Business Blazers (5)
    {
      category: 'business-blazers',
      name: 'Executive Navy Travel-Flex Blazer',
      slug: 'executive-navy-travel-flex-blazer',
      description: 'Engineered for the international executive. High-twist wool resists wrinkles during 14-hour flights while hidden interior passport and passport pockets keep essentials secure.',
      color: 'Deep Navy',
      material: 'Super 120s High-Twist Wool with Nanotech Spill Resistance',
      fit: 'Comfort Tailored Fit',
      sale_price: 12999, original_price: 15999, rent_price: 1399, deposit: 4500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'business-blazers',
      name: 'Bankers Grey Subtle Glen Check Blazer',
      slug: 'bankers-grey-subtle-glen-check-blazer',
      description: 'Subtle Prince of Wales Glenurquhart check with a faint blue overcheck. Classic Wall Street and Dalal Street boardroom attire.',
      color: 'Light Slate Grey with Blue Deco',
      material: '100% Super 130s All-Season Wool',
      fit: 'Executive Standard Fit',
      sale_price: 13499, original_price: 16499, rent_price: 1449, deposit: 4500,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'business-blazers',
      name: 'Boardroom Micro-Stripe Charcoal Blazer',
      slug: 'boardroom-micro-stripe-charcoal-blazer',
      description: 'Discrete tonal pin-dot stripe creating a lengthening silhouette for formal boardroom reviews and shareholder presentations.',
      color: 'Charcoal Pin-Stripe',
      material: '100% Worsted Merino Wool',
      fit: 'Structured Slim Fit',
      sale_price: 13999, original_price: 16999, rent_price: 1499, deposit: 5000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'business-blazers',
      name: 'Aviation Blue Poplin Tropical Wool Blazer',
      slug: 'aviation-blue-poplin-tropical-wool-blazer',
      description: 'Featherlight 210g tropical plain-weave wool optimized for humid Asian summers. Half-lined in pure cupro silk.',
      color: 'Aviation Blue',
      material: 'Super 120s Tropical Plain Weave Wool',
      fit: 'Modern Tailored Fit',
      sale_price: 12499, original_price: 14999, rent_price: 1349, deposit: 4000,
      featured: false, purchasable: true, rentable: true,
    },
    {
      category: 'business-blazers',
      name: 'Graphite Twill Modern Notched Lapel Blazer',
      slug: 'graphite-twill-modern-notched-lapel-blazer',
      description: 'Dense twill weave delivering a crisp, sharp architectural drape that stays sharp from 8 AM meetings to midnight cocktails.',
      color: 'Graphite Lead Grey',
      material: '100% Italian Wool Cavalry Twill',
      fit: 'Sharp Contemporary Slim Fit',
      sale_price: 13999, original_price: 16999, rent_price: 1499, deposit: 5000,
      featured: false, purchasable: true, rentable: true,
    },
  ];

  console.log(`Starting insertion of ${productCatalogue.length} luxury blazers...`);

  const createdProducts = [];
  const allVariants = [];
  const SIZES = ['36R', '38R', '40R', '42R', '44R'];

  for (let i = 0; i < productCatalogue.length; i++) {
    const p = productCatalogue[i];
    const catId = categoryMap[p.category];
    const imgPair = blazerImages[i % blazerImages.length];

    const prodRes = await pool.query(
      `INSERT INTO products (
         category_id, name, slug, description, color, material, fit,
         is_purchasable, is_rentable, is_featured, sale_price, original_price,
         rent_price_per_day, security_deposit, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
       ON CONFLICT (slug) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         color = EXCLUDED.color,
         material = EXCLUDED.material,
         fit = EXCLUDED.fit,
         sale_price = EXCLUDED.sale_price,
         original_price = EXCLUDED.original_price,
         rent_price_per_day = EXCLUDED.rent_price_per_day,
         security_deposit = EXCLUDED.security_deposit,
         is_featured = EXCLUDED.is_featured,
         is_active = true
       RETURNING id, name, slug, sale_price, rent_price_per_day, security_deposit`,
      [
        catId, p.name, p.slug, p.description, p.color, p.material, p.fit,
        p.purchasable, p.rentable, p.featured, p.sale_price, p.original_price,
        p.rent_price, p.deposit
      ]
    );

    const product = prodRes.rows[0];
    createdProducts.push(product);

    // Images
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [product.id]);
    await pool.query(
      `INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order)
       VALUES ($1, $2, $3, true, 0), ($1, $4, $5, false, 1)`,
      [product.id, imgPair.front, `${p.name} Front View`, imgPair.detail, `${p.name} Fabric Detail`]
    );

    // Variants for each size
    for (let sIdx = 0; sIdx < SIZES.length; sIdx++) {
      const size = SIZES[sIdx];
      // Generate unique short SKU
      const shortCode = p.slug.split('-').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 4);
      const sku = `MB-${shortCode}-${product.id}-${size}`;

      // Default stock logic:
      // Include specific out-of-stock and low-stock examples for inventory management
      let stock = 6;

      if (i === 1 && size === '36R') {
        stock = 0; // Out of stock example 1
      } else if (i === 4 && size === '44R') {
        stock = 0; // Out of stock example 2
      } else if (i === 7 && size === '38R') {
        stock = 1; // Low stock retail
      } else if (i === 12 && size === '40R') {
        stock = 1; // Low stock retail
      } else if (i === 18 && size === '42R') {
        stock = 2; // Low stock retail
      } else if (i === 25 && size === '36R') {
        stock = 0; // Out of stock retail
      }

      const vRes = await pool.query(
        `INSERT INTO product_variants (product_id, sku, size, stock_quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id, size) DO UPDATE SET
           sku = EXCLUDED.sku,
           stock_quantity = EXCLUDED.stock_quantity
         RETURNING id, product_id, sku, size, stock_quantity`,
        [product.id, sku, size, stock]
      );
      allVariants.push(vRes.rows[0]);
    }
  }
  console.log(`✓ ${createdProducts.length} Products and ${allVariants.length} Variants seeded (including low-stock and out-of-stock records)`);

  // 4. Coupons (8 realistic coupons)
  const couponDefs = [
    { code: 'MAJESTIC10', type: 'percentage', val: 10, min: 5000, max: 2000, active: true },
    { code: 'LUXURY500', type: 'fixed', val: 500, min: 3000, max: 500, active: true },
    { code: 'ROYALRENT', type: 'percentage', val: 15, min: 2000, max: 1500, active: true },
    { code: 'WELCOME10', type: 'percentage', val: 10, min: 0, max: 1000, active: true },
    { code: 'ATELIER20', type: 'percentage', val: 20, min: 15000, max: 5000, active: true },
    { code: 'BLACKTIE1000', type: 'fixed', val: 1000, min: 10000, max: 1000, active: true },
    { code: 'EXECUTIVE15', type: 'percentage', val: 15, min: 8000, max: 2500, active: true },
    { code: 'SUMMERGALA2025', type: 'percentage', val: 25, min: 10000, max: 3000, active: false }, // inactive test coupon
  ];

  for (const c of couponDefs) {
    await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         discount_type = EXCLUDED.discount_type,
         discount_value = EXCLUDED.discount_value,
         min_order_value = EXCLUDED.min_order_value,
         max_discount = EXCLUDED.max_discount,
         is_active = EXCLUDED.is_active`,
      [c.code, c.type, c.val, c.min, c.max, c.active]
    );
  }
  console.log(`✓ ${couponDefs.length} Coupons verified`);

  // 5. Clean up old orders, payments, invoices to cleanly reconstruct connected ledger
  console.log('Reconstructing connected order and payment ledger...');
  await pool.query('DELETE FROM payments');
  await pool.query('DELETE FROM invoices');
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM reviews');

  // 6. Orders (At least 30 sample orders spanning past 90 days)
  const orderStatuses = [
    'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
    'shipped', 'shipped', 'shipped',
    'confirmed', 'confirmed',
    'pending',
    'cancelled'
  ];

  const paymentMethods = ['razorpay', 'razorpay', 'razorpay', 'manual', 'cod'];

  const createdOrders = [];
  const orderCount = 36; // 36 orders

  for (let i = 1; i <= orderCount; i++) {
    const customer = customerMap[(i - 1) % customerMap.length];
    const product = createdProducts[(i * 3) % createdProducts.length];
    const variant = allVariants.find(v => v.product_id === product.id) || allVariants[0];
    const orderNum = `MB-ORD-2026-${String(8100 + i).padStart(4, '0')}`;

    // Stagger dates across past 90 days to create rich chart trends
    const daysAgo = Math.floor((orderCount - i) * 2.4);
    const orderDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - Math.random() * 3600000);
    const status = orderStatuses[(i - 1) % orderStatuses.length];
    const method = paymentMethods[i % paymentMethods.length];

    const quantity = (i % 5 === 0) ? 2 : 1;
    const subtotal = Number(product.sale_price) * quantity;
    const discount = (i % 3 === 0) ? 1000 : (i % 4 === 0) ? 500 : 0;
    const total = subtotal - discount;

    let tracking = null;
    if (status === 'shipped') {
      tracking = `DELHIVERY-EXP-${982000 + i}`;
    } else if (status === 'delivered') {
      tracking = `BLUEDART-PRI-${841000 + i}`;
    }

    const orderRes = await pool.query(
      `INSERT INTO orders (
         order_number, user_id, delivery_type, shipping_address,
         subtotal, discount, tax, shipping, total, status,
         tracking_number, notes, created_at, updated_at
       ) VALUES ($1, $2, 'delivery', $3, $4, $5, 0, 0, $6, $7, $8, $9, $10, $10)
       RETURNING id, order_number, total, status, user_id, created_at`,
      [
        orderNum,
        customer.id,
        `${12 + i}, Highgrove Estate, ${customer.city}, ${customer.state}`,
        subtotal,
        discount,
        total,
        status,
        tracking,
        (i % 4 === 0) ? 'Gift boxed with complimentary cedar hanger.' : null,
        orderDate
      ]
    );

    const order = orderRes.rows[0];
    createdOrders.push(order);

    // Order Item
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, product.id, variant.id, quantity, product.sale_price]
    );

    // Payment Record
    if (status !== 'cancelled') {
      const pmtStatus = (status === 'pending' && method === 'razorpay') ? 'created' : 'paid';
      const paymentRef = `pay_MB_live_${890000 + i}`;

      const pmtRes = await pool.query(
        `INSERT INTO payments (
           order_id, user_id, provider, provider_payment_id,
           amount, currency, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'INR', $6, $7)
         RETURNING id`,
        [order.id, customer.id, method === 'cod' ? 'cod' : method === 'manual' ? 'manual' : 'razorpay', paymentRef, total, pmtStatus, orderDate]
      );

      // Tax Invoice for confirmed, shipped, and delivered orders
      if (pmtStatus === 'paid') {
        const invNum = `INV-2026-${String(7100 + i).padStart(4, '0')}`;
        await pool.query(
          `INSERT INTO invoices (invoice_number, order_id, amount, pdf_path, invoice_data, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            invNum,
            order.id,
            total,
            `/invoices/${invNum}.pdf`,
            JSON.stringify({
              invoiceNumber: invNum,
              orderNumber: order.order_number,
              customerName: customer.name,
              item: product.name,
              quantity,
              total
            }),
            orderDate
          ]
        );
      }
    } else {
      // Cancelled order payment test (1 refunded, 1 failed)
      const pmtStatus = (i % 2 === 0) ? 'refunded' : 'failed';
      await pool.query(
        `INSERT INTO payments (
           order_id, user_id, provider, provider_payment_id,
           amount, currency, status, refund_amount, refund_status, created_at
         ) VALUES ($1, $2, 'razorpay', $3, $4, 'INR', $5, $6, $7, $8)`,
        [
          order.id,
          customer.id,
          `pay_MB_failed_${990000 + i}`,
          total,
          pmtStatus,
          pmtStatus === 'refunded' ? total : 0,
          pmtStatus === 'refunded' ? 'refunded' : null,
          orderDate
        ]
      );
    }
  }
  console.log(`✓ ${createdOrders.length} Sample Orders and corresponding Payments & Invoices seeded across past 90 days`);

  // 7. Reviews (25+ realistic reviews with ratings)
  const reviewComments = [
    { rating: 5, title: 'Savile Row Craftsmanship', comment: 'The canvassing and lapel roll are breathtaking. Wore this for an international summit in Singapore and received non-stop accolades.' },
    { rating: 5, title: 'Impeccable Silhouette & Drape', comment: 'The waist suppression and soft Italian shoulders give a commanding presence without restricting movement. Truly majestic.' },
    { rating: 5, title: 'Masterpiece Velvet Quality', comment: 'The depth of color under banquet lighting is unmatched. The silk Bemberg lining ensures supreme comfort all evening.' },
    { rating: 4, title: 'Superb Fabric & Tailoring', comment: 'Very impressed with the pick stitching and horn buttons. Sizing was exact to the chart.' },
    { rating: 5, title: 'Flawless Bespoke Experience', comment: 'Garment arrived in pristine condition inside a luxury cedar-infused garment bag. Will definitely purchase again.' },
    { rating: 4, title: 'High-Praise Wedding Bandhgala', comment: 'Turned heads throughout my reception. Excellent balance of classical Indian royalty and modern structured lines.' },
    { rating: 5, title: 'Unbeatable Fit & Finish', comment: 'Handcrafted precision is obvious from the moment you drape it over your shoulders. Pure sartorial excellence.' },
    { rating: 3, title: 'Slightly Snug on Shoulders', comment: 'Beautiful fabric and finish, but fits slightly slimmer than standard American cuts. Recommend sizing up.' }
  ];

  let reviewCount = 0;
  for (let i = 0; i < 28; i++) {
    const cust = customerMap[i % customerMap.length];
    const prod = createdProducts[i % createdProducts.length];
    const revDef = reviewComments[i % reviewComments.length];
    const isApproved = revDef.rating >= 4 || (i % 2 === 0);

    await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, title, comment, is_approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - INTERVAL '${i * 3} days')`,
      [cust.id, prod.id, revDef.rating, revDef.title, revDef.comment, isApproved]
    );
    reviewCount++;
  }
  console.log(`✓ ${reviewCount} Patron Reviews seeded across products`);

  console.log('=== FULL MAJESTIC BLAZER DEMO DATA SEEDED SUCCESSFULLY ===');
}

// CLI Execution support
if (process.argv[1]?.endsWith('seedFullDemoData.js')) {
  seedFullDemoData()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await pool.end();
      process.exit(1);
    });
}
