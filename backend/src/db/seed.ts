import crypto from 'node:crypto';
import type { DbClient } from './index.js';
import { env } from '../config/env.js';
import { hashPassword, encryptSensitive } from '../utils/crypto.js';

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function ensureBaseReferenceData(db: DbClient): Promise<void> {
  const banks = [
    ['HDFC', 'HDFC Bank', 'HDFC', 'https://www.hdfcbank.com', '#004C8F', '#ED1C24'],
    ['ICICI', 'ICICI Bank', 'ICICI', 'https://www.icicibank.com', '#B02A30', '#F37E20'],
    ['SBI', 'SBI Card', 'SBI', 'https://www.sbicard.com', '#1A4B8E', '#00B5EF'],
    ['AXIS', 'Axis Bank', 'Axis', 'https://www.axisbank.com', '#97144D', '#EB1165'],
    ['KOTAK', 'Kotak Mahindra Bank', 'Kotak', 'https://www.kotak.com', '#ED1C24', '#003874'],
    ['IDFC', 'IDFC FIRST Bank', 'IDFC FIRST', 'https://www.idfcfirstbank.com', '#9D1D27', '#F4A261'],
    ['INDUSIND', 'IndusInd Bank', 'IndusInd', 'https://www.indusind.com', '#8A1538', '#C59B27'],
    ['AMEX', 'American Express', 'Amex', 'https://www.americanexpress.com/en-in', '#006FCF', '#4D9DE0'],
    ['AU', 'AU Small Finance Bank', 'AU Bank', 'https://www.aubank.in', '#4A1D6B', '#F26522'],
    ['YES', 'Yes Bank', 'Yes Bank', 'https://www.yesbank.in', '#005197', '#E31837'],
    ['FEDERAL', 'Federal Bank', 'Federal', 'https://www.federalbank.co.in', '#004B87', '#FDB913'],
  ];

  for (const [code, name, shortName, supportUrl, brandColor, accentColor] of banks) {
    const existing = await db.queryOne(`SELECT id FROM banks WHERE code = $1`, [code]);
    if (!existing) {
      await db.execute(
        `INSERT INTO banks (id, code, name, short_name, support_url, brand_color, accent_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), code, name, shortName, supportUrl, brandColor, accentColor]
      );
    }
  }

  const categories = [
    ['Shopping', 'shopping', 'shopping-bag', '#6366F1', 'amazon,flipkart,myntra,ajio,croma,reliance digital,nykaa,meesho,tata cliq,retail,zara,apple'],
    ['Food and Dining', 'food-dining', 'utensils', '#F59E0B', 'swiggy,zomato,restaurant,cafe,starbucks,dominos,mcdonalds,kfc,dining,eats,bakery,haldirams'],
    ['Travel', 'travel', 'plane', '#0EA5E9', 'makemytrip,goibibo,indigo,air india,vistara,irctc,uber,ola,hotel,flight,marriott,taj'],
    ['Fuel', 'fuel', 'fuel', '#EF4444', 'indian oil,iocl,hpcl,bpcl,shell,petrol,diesel,fuel,pump'],
    ['Entertainment', 'entertainment', 'film', '#EC4899', 'bookmyshow,pvr,inox,netflix,spotify,prime video,hotstar,cinema,movie,gaming,sony'],
    ['Groceries', 'groceries', 'shopping-cart', '#10B981', 'blinkit,zepto,instamart,bigbasket,dmart,reliance fresh,supermarket,grocery,nature'],
    ['Bills and Utilities', 'bills-utilities', 'zap', '#8B5CF6', 'electricity,bescom,airtel,jio,vi,broadband,gas,water,recharge,utility,insurance,cred'],
    ['Healthcare', 'healthcare', 'heart-pulse', '#14B8A6', 'apollo,pharmeasy,1mg,hospital,clinic,pharmacy,medical,health,dental,practo'],
    ['Education', 'education', 'graduation-cap', '#3B82F6', 'udemy,coursera,school,college,tuition,books,exam,university,upgrad,byjus'],
    ['Other expenses', 'other', 'receipt', '#64748B', 'misc,other,fee,subscription'],
  ];

  for (const [name, slug, icon, color, keywords] of categories) {
    const existing = await db.queryOne(`SELECT id FROM spending_categories WHERE slug = $1`, [slug]);
    if (!existing) {
      await db.execute(
        `INSERT INTO spending_categories (id, name, slug, icon, color, keywords)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), name, slug, icon, color, keywords]
      );
    }
  }

  const catalogCount = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM card_catalog`);
  if (!catalogCount || Number(catalogCount.c) === 0) {
    const catalog = [
      ['HDFC Bank', 'Infinia Metal Edition', 'Visa', 'Rewards', 12500, 12500, 43.2, 0.5, 3.3, 'Unlimited Domestic & International (Priority Pass)', '20% off via Swiggy Dineout', '5X rewards on SmartBuy / Apple / Nykaa', '3.3% base + 16.5% SmartBuy flights/hotels', '1% fuel surcharge waiver up to ₹1,000/cycle', 'Complimentary Club Marriott 1st year', 2.0, '12,500 bonus points on renewal', 'Income ₹3L+/month or invite-only', 'Travel,Dining,Shopping', 'navy-gold'],
      ['HDFC Bank', 'Millennia Credit Card', 'Mastercard', 'Cashback', 1000, 1000, 43.2, 5.0, 1.0, '8 Domestic lounges/year (₹1L quarterly spend)', '5% cashback on Zomato & Swiggy', '5% cashback on Amazon, Flipkart, Myntra', '1% on PayZapp travel', '1% fuel surcharge waiver', '5% cashback on BookMyShow', 3.5, '₹1,000 gift voucher on ₹1L quarterly spend', 'Income ₹35,000+/month', 'Shopping,Food and Dining,Entertainment', 'emerald-slate'],
      ['ICICI Bank', 'Amazon Pay ICICI Card', 'Visa', 'Lifetime Free', 0, 0, 42.0, 5.0, 1.0, 'No complimentary lounge access', '2% cashback on Swiggy/Zomato via Amazon Pay', '5% unlimited cashback for Prime on Amazon.in', '2% on travel partners via Amazon', '1% fuel surcharge waiver across pumps', '1% on BookMyShow', 3.5, 'No annual fee or milestone lock-in', 'Income ₹25,000+/month, CIBIL 720+', 'Shopping,Groceries,Bills and Utilities', 'obsidian-amber'],
      ['ICICI Bank', 'Sapphiro Credit Card', 'American Express', 'Travel', 3500, 6500, 42.0, 0.5, 2.0, '4 Domestic/quarter + 2 International/year', '15% off partner restaurants', '2X rewards on international spends', 'Complimentary golf + airport spa', '1% fuel surcharge waiver', 'Buy 1 Get 1 on BookMyShow (up to ₹500 twice/month)', 3.5, 'Up to 20,000 bonus points on ₹6L annual spend', 'Income ₹1.5L+/month', 'Entertainment,Travel,Food and Dining', 'royal-indigo'],
      ['SBI Card', 'CASHBACK SBI Card', 'Visa', 'Cashback', 999, 999, 42.0, 5.0, 1.0, 'No complimentary lounge access', '5% cashback on online food orders', '5% flat cashback on all online merchants', '5% cashback on online flight/hotel portals', '1% fuel surcharge waiver (₹500-₹3,000)', '5% cashback on online movie tickets', 3.5, 'Annual fee waived on ₹2L annual spend', 'Income ₹30,000+/month', 'Shopping,Food and Dining,Entertainment', 'cobalt-cyan'],
      ['SBI Card', 'BPCL SBI Card Octane', 'RuPay', 'Fuel', 1499, 1499, 42.0, 6.25, 0.25, '4 Domestic lounges/year', '10X points on dining & groceries', '10X points on departmental stores', 'UPI enabled via RuPay network', '7.25% value back at BPCL pumps (up to ₹10k/mo)', '10X points on movies', 3.5, '₹2,000 Aditya Birla voucher on ₹3L spend', 'Income ₹40,000+/month', 'Fuel,Groceries,Food and Dining', 'crimson-obsidian'],
      ['Axis Bank', 'Axis Bank ACE Card', 'Visa', 'Cashback', 499, 499, 43.2, 4.0, 1.5, '4 Domestic lounges/year (₹50k/3m)', '4% cashback on Swiggy & Zomato', '1.5% unlimited cashback on offline/online', '4% cashback on Ola rides', '1% fuel surcharge waiver', '1.5% on entertainment', 3.5, 'Annual fee waived on ₹2L annual spend', 'Income ₹25,000+/month', 'Bills and Utilities,Food and Dining,Travel', 'plum-rose'],
      ['Axis Bank', 'Atlas Credit Card', 'Visa', 'Travel', 5000, 5000, 43.2, 0.5, 4.0, '8 Domestic + 4 International (Silver tier)', 'EDGE Miles transferable 1:2 to airlines/hotels', '2 EDGE Miles per ₹100 base', '5 EDGE Miles per ₹100 on airlines/hotels', 'No fuel rewards', '2 EDGE Miles per ₹100', 3.5, 'Up to 10,000 bonus EDGE Miles on ₹15L spend', 'Income ₹1.2L+/month', 'Travel,Food and Dining', 'midnight-teal'],
      ['Kotak Mahindra Bank', 'Kotak League Platinum', 'RuPay', 'Lifetime Free', 0, 0, 42.0, 1.0, 1.5, 'No complimentary lounge access', '8X reward points on dining', '8X points on online shopping categories', 'UPI-linked RuPay credit card support', '1% fuel surcharge waiver', '4 free PVR tickets on ₹1.25L/6m spend', 3.5, '10,000 bonus points on ₹1.25L semi-annual spend', 'Income ₹30,000+/month', 'Entertainment,Shopping', 'crimson-navy'],
      ['IDFC FIRST Bank', 'IDFC FIRST Wealth', 'Visa', 'Lifetime Free', 0, 0, 36.0, 1.0, 2.5, '4 Domestic + 4 International/quarter (₹20k/mo)', 'Up to 10X points above ₹20k/mo spend', '10X non-expiring points on online spends', 'Low 1.5% forex markup + travel insurance', '1% fuel surcharge waiver', 'Buy 1 Get 1 up to ₹500 on Paytm Movies', 1.5, 'Non-expiring reward points forever', 'Income ₹3L+/month', 'Travel,Shopping,Other expenses', 'burgundy-gold'],
      ['IndusInd Bank', 'IndusInd Legend Card', 'Visa', 'Lifetime Free', 0, 0, 46.0, 0.75, 1.5, '1 Domestic lounge/quarter', '2X rewards on weekend dining', '1X weekdays, 2X weekends on shopping', 'Discounted 1.8% forex markup', '1% fuel surcharge waiver', 'Buy 1 Get 1 on BookMyShow (up to ₹200)', 1.8, '4,000 bonus points on ₹6L annual spend', 'Income ₹50,000+/month', 'Entertainment,Food and Dining,Travel', 'maroon-gold'],
      ['American Express', 'Amex Membership Rewards', 'American Express', 'Rewards', 4500, 1000, 42.0, 0.5, 2.0, 'Pay-per-use domestic lounge', 'Bonus points on dining via Amex Dining', '2X on Reward Multiplier (Amazon/Flipkart)', 'Points transfer to Marriott & airlines', '0% convenience at HPCL', '1,000 bonus points on 4x ₹1,500 txns/mo', 3.5, '1,000 + 1,000 monthly milestone bonus MR points', 'Income ₹50,000+/month', 'Shopping,Travel,Food and Dining', 'sapphire-silver'],
      ['AU Small Finance Bank', 'AU LIT Credit Card', 'Visa', 'Lifetime Free', 0, 0, 43.0, 5.0, 1.25, 'Customizable paid add-on lounge passes', '5% cashback feature toggle on dining', '5% cashback toggle on apparel/groceries', '10X points toggle on travel', '1% fuel surcharge waiver', 'ZEE5/Amazon Prime add-on packs', 3.5, 'Pay only for features you activate every 90 days', 'Income ₹25,000+/month', 'Groceries,Food and Dining,Shopping', 'violet-orange'],
      ['Yes Bank', 'YES Marquee Credit Card', 'Mastercard', 'Rewards', 4999, 9999, 45.0, 0.5, 4.5, 'Unlimited International + 6 Domestic/quarter', '36 YES Rewardz per ₹200 online', '36 YES Rewardz per ₹200 online shopping', 'Low 1% forex markup + golf', '1% fuel surcharge waiver', 'Buy 1 Get 1 on BookMyShow up to ₹800 (3x/mo)', 1.0, '20,000 bonus points on renewal', 'Income ₹3L+/month', 'Entertainment,Shopping,Travel', 'royal-blue'],
      ['Federal Bank', 'Federal Scapia Credit Card', 'Visa', 'Lifetime Free', 0, 0, 43.8, 0.4, 2.0, 'Unlimited Domestic lounges (₹10k monthly spend)', '10% Scapia coins on travel & dining', '10% Scapia coins on online spends', 'Zero forex markup (0%) on international spends', '1% fuel surcharge waiver', '20% coins on travel bookings in Scapia app', 0.0, 'Zero forex markup + lifetime free', 'Income ₹30,000+/month', 'Travel,Food and Dining', 'navy-amber']
    ];

    for (const c of catalog) {
      await db.execute(
        `INSERT INTO card_catalog (
          id, bank_name, card_name, card_network, card_type, annual_fee, joining_fee,
          interest_rate, cashback_pct, reward_rate_pct, lounge_access, dining_benefits,
          shopping_benefits, travel_benefits, fuel_benefits, movie_benefits,
          forex_markup_pct, milestone_benefits, eligibility_criteria, best_for_categories, color_theme
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [crypto.randomUUID(), ...c]
      );
    }
  }

  const offersCount = await db.queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bank_offers WHERE user_id IS NULL`
  );
  if (!offersCount || Number(offersCount.c) === 0) {
    const today = new Date();
    const demoOffers = [
      ['HDFC Bank', 'Sample: 10% Instant Discount on Amazon Electronics', 'HDFC Millennia, Regalia, Infinia', 'Electronics', 'Amazon', 'Amazon India', 10, 1750, 5000, 'Fri–Sun Weekly Demo Offer', addDays(today, 24), 'Sample demo terms: Max discount ₹1,750 per card on min spend ₹5,000. Not a live bank feed.', 'HDFCAMZ10', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/offers'],
      ['ICICI Bank', 'Sample: Flat 10% Off on Flipkart Big Savings', 'ICICI Coral, Sapphiro, Rubyx', 'Shopping', 'Flipkart', 'Flipkart', 10, 1500, 4999, 'Valid up to expiry date', addDays(today, 18), 'Sample demo terms: Valid once per card during offer window on electronics & fashion.', 'ICICIFK10', 'https://www.icicibank.com/offers'],
      ['Axis Bank', 'Sample: 15% Off on Myntra Style Fest', 'Axis Magnus, Atlas, Flipkart Axis', 'Shopping', 'Myntra', 'Myntra', 15, 1000, 2999, 'App & Web Orders', addDays(today, 12), 'Sample demo terms: Applicable on select apparel and footwear.', 'AXISMYN15', 'https://www.axisbank.com/grab-deals'],
      ['Kotak Mahindra Bank', 'Sample: 10% Instant Savings on Ajio Luxe', 'Kotak League, Zen, Privy League', 'Shopping', 'Ajio', 'Ajio', 10, 1250, 3500, 'Weekend Special', addDays(today, 30), 'Sample demo terms: Max discount ₹1,250 on minimum cart of ₹3,500.', 'KOTAKAJIO', 'https://www.kotak.com/en/personal-banking/cards/credit-cards/offers.html'],
      ['SBI Card', 'Sample: Up to ₹3,000 Cashback on Croma Appliances', 'SBI SimplyCLICK, Cashback, Elite', 'Electronics', 'Croma', 'Croma Retail', 7.5, 3000, 15000, 'In-Store & Croma.com', addDays(today, 22), 'Sample demo terms: Applicable on TVs, laptops, and home appliances.', 'SBICROMA', 'https://www.sbicard.com/en/personal/offers.page'],
      ['IDFC FIRST Bank', 'Sample: 10% Instant Discount at Reliance Digital', 'IDFC FIRST Wealth, Select, Classic', 'Electronics', 'Reliance Digital', 'Reliance Digital', 10, 2500, 12000, 'EMI & Non-EMI Demo', addDays(today, 27), 'Sample demo terms: Applicable once per card per month.', 'IDFCRD10', 'https://www.idfcfirstbank.com/credit-card/offers'],
      ['Axis Bank', 'Sample: Flat ₹150 Off on Swiggy Food Delivery', 'Axis ACE, My Zone, Atlas', 'Food delivery', 'Swiggy', 'Swiggy', 15, 150, 599, 'Valid Twice Monthly', addDays(today, 15), 'Sample demo terms: Apply promo code at Swiggy checkout.', 'AXISSWIGGY', 'https://www.axisbank.com/grab-deals'],
      ['HDFC Bank', 'Sample: Up to 20% Off Zomato Dining', 'HDFC Millennia, Diners Club, Infinia', 'Dining', 'Zomato', 'Zomato', 20, 400, 1200, 'Swiggy Dineout / Zomato Pay', addDays(today, 20), 'Sample demo terms: Valid at participating partner restaurants.', 'HDFCDINE20', 'https://www.hdfcbank.com'],
      ['American Express', 'Sample: 20% Savings on Fine Dining Restaurants', 'Amex Platinum, Gold, MRCC', 'Dining', 'Restaurant', 'Partner Fine Dining', 20, 2000, 4000, 'Pan-India Partner Hotels', addDays(today, 45), 'Sample demo terms: Valid on dine-in bills at participating Taj & Marriott outlets.', 'AMEXDINE', 'https://www.americanexpress.com/en-in/benefits/dining/'],
      ['Federal Bank', 'Sample: 12% Instant Discount on Domestic Flights', 'Federal Scapia, Celesta, Imperio', 'Flights', 'Flights', 'MakeMyTrip', 12, 1800, 5000, 'Wednesdays Travel Demo', addDays(today, 19), 'Sample demo terms: Valid on domestic flight bookings.', 'FEDFLY12', 'https://www.federalbank.co.in'],
      ['IndusInd Bank', 'Sample: 15% Off Luxury Hotel Stays', 'IndusInd Legend, Pinnacle, Pioneer', 'Hotels', 'Hotels', 'Goibibo / Cleartrip', 15, 3500, 8000, 'Prepaid Hotel Bookings', addDays(today, 34), 'Sample demo terms: Applicable on domestic and international hotel bookings.', 'INDUSHOTEL', 'https://www.indusind.com'],
      ['Yes Bank', 'Sample: Complimentary Airport Lounge & Spa Access', 'YES Marquee, Reserv, First Exclusive', 'Travel', 'Airport Lounge', 'DreamFolks / Priority Pass', 100, 2000, 2, 'Quarterly Eligible Spends', addDays(today, 60), 'Sample demo terms: ₹2 verification hold reversed automatically.', 'YESLOUNGE', 'https://www.yesbank.in'],
      ['SBI Card', 'Sample: 10% Cashback on IRCTC Railway Bookings', 'SBI IRCTC Platinum, Premier', 'Travel', 'Railway', 'IRCTC', 10, 500, 1000, 'AC Class Bookings', addDays(today, 28), 'Sample demo terms: Valid via IRCTC web & Rail Connect app.', 'SBIIRCTC', 'https://www.sbicard.com'],
      ['ICICI Bank', 'Sample: Buy 1 Get 1 Free on BookMyShow', 'ICICI Sapphiro, Rubyx, Coral', 'Movies', 'BookMyShow', 'BookMyShow', 50, 500, 500, 'Twice per Month Demo', addDays(today, 40), 'Sample demo terms: Max free ticket value ₹500 on Sapphiro.', 'ICICIBMS', 'https://www.icicibank.com'],
      ['Kotak Mahindra Bank', 'Sample: 25% Off PVR & INOX Movie Tickets + F&B', 'Kotak PVR Gold, Platinum, Privy', 'Entertainment', 'PVR and INOX', 'PVR INOX', 25, 400, 600, 'Fri–Sun Bookings', addDays(today, 21), 'Sample demo terms: Valid on PVR INOX app and website.', 'KOTAKPVR', 'https://www.kotak.com'],
      ['AU Small Finance Bank', 'Sample: 20% Cashback on OTT Subscriptions', 'AU LIT, Zenith, Vetta', 'Cashback', 'Subscriptions', 'Netflix / Prime / Spotify', 20, 250, 499, 'Recurring Card Mandate', addDays(today, 35), 'Sample demo terms: Up to ₹250 cashback per billing statement.', 'AUOTT20', 'https://www.aubank.in'],
      ['HDFC Bank', 'Sample: 0% No-Cost EMI + 5X Reward Multiplier', 'HDFC Regalia Gold, Infinia', 'No-cost EMI', 'SmartBuy', 'SmartBuy Partner Stores', 8, 5000, 10000, '3 & 6 Month Tenures', addDays(today, 26), 'Sample demo terms: Processing fee may apply as per card T&C.', 'HDFCNCE', 'https://offers.smartbuy.hdfcbank.com'],
      ['SBI Card', 'Sample: 1% Fuel Surcharge Waiver + 5% Octane Value Back', 'SBI BPCL Octane, SimplySAVE', 'Fuel', 'Fuel Surcharge Waiver', 'BPCL Fuel Stations', 6.25, 500, 500, 'Min ₹500 to ₹4,000', addDays(today, 55), 'Sample demo terms: Max surcharge waiver ₹100-₹250 per billing cycle.', 'SBIFUEL', 'https://www.sbicard.com'],
    ];

    for (const o of demoOffers) {
      const bankRow = await db.queryOne<{ id: string }>(`SELECT id FROM banks WHERE name = $1`, [o[0]]);
      const offerId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO bank_offers (
          id, user_id, bank_id, bank_name, title, applicable_cards, category, subcategory,
          merchant, discount_percentage, max_discount, min_transaction_amount,
          offer_validity, expiry_date, terms_and_conditions, offer_source, promo_code,
          is_active, source_url, verification_status
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'demo', $15, 1, $16, 'demo')`,
        [offerId, bankRow?.id ?? null, ...o]
      );
    }
  }

  // Bootstrap administrator user if configured (or default local admin in non-production)
  const adminEmail =
    env.adminBootstrapEmail || (env.nodeEnv !== 'production' ? 'admin@cardwise.in' : '');
  const adminPassword =
    env.adminBootstrapPassword || (env.nodeEnv !== 'production' ? 'AdminWise@2026' : '');
  if (adminEmail && adminPassword) {
    const existingAdmin = await db.queryOne<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE email = $1`,
      [adminEmail.toLowerCase()]
    );
    if (!existingAdmin) {
      const adminId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO users (id, email, password_hash, full_name, role, auth_provider, email_verified, is_active)
         VALUES ($1, $2, $3, 'CardWise Administrator', 'admin', 'email', 1, 1)`,
        [adminId, adminEmail.toLowerCase(), hashPassword(adminPassword)]
      );
      await db.execute(
        `INSERT INTO user_profiles (id, user_id, full_name, city) VALUES ($1, $2, 'CardWise Administrator', 'Bengaluru')`,
        [crypto.randomUUID(), adminId]
      );
      await db.execute(
        `INSERT INTO user_preferences (id, user_id, theme, timezone) VALUES ($1, $2, 'dark', 'Asia/Kolkata')`,
        [crypto.randomUUID(), adminId]
      );
    } else if (existingAdmin.role !== 'admin') {
      await db.execute(`UPDATE users SET role = 'admin' WHERE id = $1`, [existingAdmin.id]);
    }
  }
}

export async function seedDemoPortfolioForUser(db: DbClient, userId: string): Promise<void> {
  const existingCards = await db.queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM credit_cards WHERE user_id = $1`,
    [userId]
  );
  if (existingCards && Number(existingCards.c) > 0) return;

  const today = new Date();
  const banksRows = await db.query<{ id: string; name: string }>(`SELECT id, name FROM banks`);
  const bankMap = new Map(banksRows.map((b) => [b.name, b.id]));
  const catsRows = await db.query<{ id: string; name: string }>(`SELECT id, name FROM spending_categories`);
  const catMap = new Map(catsRows.map((c) => [c.name, c.id]));

  const demoCards = [
    {
      bankName: 'HDFC Bank',
      cardName: 'Infinia Metal Edition (Demo)',
      network: 'Visa',
      type: 'Rewards',
      last4: '4821',
      limit: 600000,
      outstanding: 118450,
      minDue: 5925,
      interest: 43.2,
      annualFee: 12500,
      joiningFee: 12500,
      cycle: '16th - 15th',
      stmtDay: 15,
      dueDay: 5,
      stmtDate: addDays(today, -10),
      dueDate: addDays(today, 5),
      rewards: 48250,
      pointVal: 1.0,
      cashbackInr: 1200,
      status: 'Active',
      theme: 'navy-gold',
    },
    {
      bankName: 'ICICI Bank',
      cardName: 'Amazon Pay ICICI (Demo)',
      network: 'Visa',
      type: 'Lifetime Free',
      last4: '9034',
      limit: 250000,
      outstanding: 42800,
      minDue: 2140,
      interest: 42.0,
      annualFee: 0,
      joiningFee: 0,
      cycle: '19th - 18th',
      stmtDay: 18,
      dueDay: 7,
      stmtDate: addDays(today, -7),
      dueDate: addDays(today, 2),
      rewards: 6420,
      pointVal: 1.0,
      cashbackInr: 3420,
      status: 'Active',
      theme: 'obsidian-amber',
    },
    {
      bankName: 'SBI Card',
      cardName: 'CASHBACK SBI Card (Demo)',
      network: 'Visa',
      type: 'Cashback',
      last4: '7712',
      limit: 180000,
      outstanding: 64900,
      minDue: 3245,
      interest: 42.0,
      annualFee: 999,
      joiningFee: 999,
      cycle: '12th - 11th',
      stmtDay: 11,
      dueDay: 1,
      stmtDate: addDays(today, -14),
      dueDate: addDays(today, -2),
      rewards: 3180,
      pointVal: 1.0,
      cashbackInr: 4180,
      status: 'Active',
      theme: 'cobalt-cyan',
    },
    {
      bankName: 'Axis Bank',
      cardName: 'Axis Atlas Travel (Demo)',
      network: 'Mastercard',
      type: 'Travel',
      last4: '3359',
      limit: 350000,
      outstanding: 28500,
      minDue: 1425,
      interest: 43.2,
      annualFee: 5000,
      joiningFee: 5000,
      cycle: '21st - 20th',
      stmtDay: 20,
      dueDate: addDays(today, 12),
      stmtDate: addDays(today, -5),
      dueDay: 10,
      rewards: 19400,
      pointVal: 0.8,
      cashbackInr: 450,
      status: 'Active',
      theme: 'midnight-teal',
    },
  ];

  const cardIds: string[] = [];

  for (const c of demoCards) {
    const cardId = crypto.randomUUID();
    cardIds.push(cardId);
    const available = Math.max(0, c.limit - c.outstanding);
    await db.execute(
      `INSERT INTO credit_cards (
        id, user_id, bank_id, bank_name, card_name, card_network, card_type,
        last_four_digits, credit_limit, available_credit_limit, used_credit_limit,
        outstanding_balance, minimum_amount_due, interest_rate, annual_fee, joining_fee,
        billing_cycle, statement_generation_day, payment_due_day,
        statement_generation_date, payment_due_date, reward_points_balance,
        reward_point_value_inr, card_status, card_color_theme, is_demo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,1)`,
      [
        cardId,
        userId,
        bankMap.get(c.bankName) ?? null,
        c.bankName,
        c.cardName,
        c.network,
        c.type,
        c.last4,
        c.limit,
        available,
        c.outstanding,
        c.outstanding,
        c.minDue,
        c.interest,
        c.annualFee,
        c.joiningFee,
        c.cycle,
        c.stmtDay,
        c.dueDay,
        c.stmtDate,
        c.dueDate,
        c.rewards,
        c.pointVal,
        c.status,
        c.theme,
      ]
    );

    const cycleId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO card_billing_cycles (
        id, user_id, card_id, cycle_start_date, cycle_end_date,
        statement_generation_date, payment_due_date, opening_balance,
        total_spends, total_payments, closing_balance, minimum_due, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Billed')`,
      [
        cycleId,
        userId,
        cardId,
        addDays(today, -40),
        c.stmtDate,
        c.stmtDate,
        c.dueDate,
        0,
        c.outstanding,
        0,
        c.outstanding,
        c.minDue,
      ]
    );

    const isOverdue = c.dueDate < addDays(today, 0);
    const stmtId = crypto.randomUUID();
    const isPartial = c.bankName === 'Axis Bank';
    const paidAmt = isPartial ? 15000 : 0;
    const totalBill = isPartial ? c.outstanding + 15000 : c.outstanding;
    const status = isOverdue ? 'Overdue' : isPartial ? 'Partially Paid' : 'Pending';

    await db.execute(
      `INSERT INTO statements (
        id, user_id, card_id, billing_cycle_id, statement_month, billing_period,
        statement_generation_date, payment_due_date, previous_balance, new_charges,
        payments_credits, interest_charges, total_amount_due, minimum_amount_due,
        amount_paid, payment_status, reward_points_earned, is_demo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16,1)`,
      [
        stmtId,
        userId,
        cardId,
        cycleId,
        today.toISOString().slice(0, 7),
        `${addDays(today, -40)} to ${c.stmtDate}`,
        c.stmtDate,
        c.dueDate,
        0,
        totalBill,
        paidAmt,
        totalBill,
        c.minDue,
        paidAmt,
        status,
        Math.round(totalBill * 0.03),
      ]
    );

    await db.execute(
      `INSERT INTO statements (
        id, user_id, card_id, statement_month, billing_period,
        statement_generation_date, payment_due_date, previous_balance, new_charges,
        payments_credits, interest_charges, total_amount_due, minimum_amount_due,
        amount_paid, payment_status, reward_points_earned, is_demo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$8,0,$8,$9,$8,'Paid',$10,1)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        addDays(today, -32).slice(0, 7),
        `${addDays(today, -70)} to ${addDays(today, -41)}`,
        addDays(today, -40),
        addDays(today, -25),
        Math.round(c.outstanding * 0.72),
        Math.round(c.outstanding * 0.036),
        Math.round(c.outstanding * 0.02),
      ]
    );

    if (paidAmt > 0) {
      await db.execute(
        `INSERT INTO payments (
          id, user_id, card_id, statement_id, amount, payment_date, payment_method,
          reference_number, payment_type, status, notes, is_demo
        ) VALUES ($1,$2,$3,$4,$5,$6,'UPI',$7,'Partial','Confirmed','Demo partial bill payment',1)`,
        [
          crypto.randomUUID(),
          userId,
          cardId,
          stmtId,
          paidAmt,
          addDaysIso(today, -2),
          `UPI${Math.floor(100000000 + Math.random() * 900000000)}`,
        ]
      );
    }

    const openingEarned = c.rewards + 5000;
    await db.execute(
      `INSERT INTO reward_points (
        id, user_id, card_id, total_earned, total_redeemed, total_expired,
        current_balance, conversion_rate_inr, expiring_soon_points, next_expiry_date, total_cashback_inr
      ) VALUES ($1,$2,$3,$4,4500,500,$5,$6,$7,$8,$9)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        openingEarned,
        c.rewards,
        c.pointVal,
        Math.round(c.rewards * 0.12),
        addDays(today, 29),
        c.cashbackInr,
      ]
    );

    // Ledger-backed reward transactions summing cleanly to opening balance!
    await db.execute(
      `INSERT INTO reward_transactions (
        id, user_id, card_id, action_type, points, inr_value, cashback_inr, description, transaction_date, expiry_date
      ) VALUES ($1,$2,$3,'Earned',$4,$5,$6,$7,$8,$9)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        openingEarned,
        Math.round(openingEarned * c.pointVal),
        c.cashbackInr,
        `Statement rewards & cashback on ${c.cardName}`,
        addDaysIso(today, -6),
        addDays(today, 365),
      ]
    );
    await db.execute(
      `INSERT INTO reward_transactions (
        id, user_id, card_id, action_type, points, inr_value, description, redemption_partner, transaction_date
      ) VALUES ($1,$2,$3,'Redeemed',4500,$4,$5,'SmartBuy / Voucher',$6)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        Math.round(4500 * c.pointVal),
        `Redeemed points on ${c.cardName}`,
        addDaysIso(today, -15),
      ]
    );
    await db.execute(
      `INSERT INTO reward_transactions (
        id, user_id, card_id, action_type, points, inr_value, description, transaction_date
      ) VALUES ($1,$2,$3,'Expired',500,$4,$5,$6)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        Math.round(500 * c.pointVal),
        `Expired points batch on ${c.cardName}`,
        addDaysIso(today, -20),
      ]
    );

    await db.execute(
      `INSERT INTO payment_reminders (
        id, user_id, card_id, statement_id, reminder_stage, due_date, amount_due,
        status, delivery_status, timezone, sent_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Sent','InApp-Delivered','Asia/Kolkata',$8)`,
      [
        crypto.randomUUID(),
        userId,
        cardId,
        stmtId,
        isOverdue ? 'overdue' : '3_days_before',
        c.dueDate,
        c.outstanding,
        addDaysIso(today, -1),
      ]
    );
  }

  const txSamples: Array<[number, string, string, string, number, number]> = [
    [0, 'MakeMyTrip Flights', 'Bengaluru to Mumbai Return', 'Travel', 18450, -3],
    [0, 'Swiggy Dineout', 'Weekend Dinner Indiranagar', 'Food and Dining', 4250, -5],
    [0, 'Apple India Store', 'AirPods Pro & Accessories', 'Shopping', 24900, -11],
    [0, 'Apollo Pharmacy', 'Monthly Wellness & Prescriptions', 'Healthcare', 3180, -14],
    [0, 'Taj West End', 'Staycation Booking', 'Travel', 32500, -24],
    [0, 'BESCOM Electricity', 'Monthly Utility Bill', 'Bills and Utilities', 4850, -35],
    [0, 'Croma Retail', 'Home Audio Soundbar', 'Shopping', 30320, -52],
    [1, 'Amazon India', 'Prime Day Home & Kitchen', 'Shopping', 18400, -2],
    [1, 'Blinkit', 'Weekly Fresh Groceries', 'Groceries', 3450, -4],
    [1, 'Zepto', 'Quick Groceries & Snacks', 'Groceries', 2190, -8],
    [1, 'Airtel Black', 'Fiber + Postpaid Family Plan', 'Bills and Utilities', 2359, -15],
    [1, 'Amazon India', 'Work Monitor Stand', 'Shopping', 16401, -38],
    [2, 'Flipkart', 'Smartphone Exchange Order', 'Shopping', 38900, -6],
    [2, 'Zomato', 'Office Lunch & Team Treats', 'Food and Dining', 5400, -9],
    [2, 'BookMyShow', 'PVR IMAX Weekend Tickets', 'Entertainment', 2280, -12],
    [2, 'Shell Fuel Station', 'V-Power Petrol Refill', 'Fuel', 4820, -18],
    [2, 'Coursera', 'AI Engineering Specialization', 'Education', 13500, -44],
    [3, 'IndiGo Airlines', 'Delhi Business Trip', 'Travel', 14800, -4],
    [3, 'Uber India', 'Airport Cab Rides', 'Travel', 2650, -7],
    [3, 'Starbucks India', 'Client Coffee Meeting', 'Food and Dining', 1550, -10],
    [3, 'Indian Oil IOCL', 'XP95 Petrol Full Tank', 'Fuel', 4500, -20],
    [3, 'Netflix India', '4K Family Plan', 'Entertainment', 649, -28],
    [0, 'Myntra', 'Ethnic & Formal Wear', 'Shopping', 9800, -66],
    [1, 'BigBasket', 'Monthly Pantry Stockup', 'Groceries', 6900, -72],
  ];

  for (const [cardIdx, merchant, desc, catName, amount, daysOffset] of txSamples) {
    const cId = cardIds[cardIdx] || cardIds[0];
    await db.execute(
      `INSERT INTO transactions (
        id, user_id, card_id, category_id, category_name, merchant, description,
        amount, transaction_type, transaction_date, reward_points_earned, is_flagged_unusual, is_demo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Debit',$9,$10,$11,1)`,
      [
        crypto.randomUUID(),
        userId,
        cId,
        catMap.get(catName) ?? null,
        catName,
        merchant,
        desc,
        amount,
        addDaysIso(today, daysOffset),
        Math.round(amount * 0.025),
        amount >= 35000 ? 1 : 0,
      ]
    );
  }

  const demoBudgets: Array<[string, number]> = [
    ['Shopping', 45000],
    ['Food and Dining', 15000],
    ['Travel', 35000],
    ['Groceries', 12000],
    ['Fuel', 8000],
    ['Entertainment', 6000],
  ];
  for (const [catName, limit] of demoBudgets) {
    await db.execute(
      `INSERT INTO budgets (id, user_id, category_id, category_name, monthly_limit, alert_threshold_pct)
       VALUES ($1,$2,$3,$4,$5,80)`,
      [crypto.randomUUID(), userId, catMap.get(catName) ?? null, catName, limit]
    );
  }

  const demoNotifications: Array<[string, string, string, string]> = [
    ['overdue_payment', 'Overdue Bill: CASHBACK SBI Card (•••• 7712)', 'Payment of ₹64,900 was due 2 days ago. Record your payment or check late fee estimator.', 'danger'],
    ['upcoming_bill', 'Due in 2 Days: Amazon Pay ICICI (•••• 9034)', 'Total bill ₹42,800 (Min due ₹2,140) is due soon.', 'warning'],
    ['high_utilisation', 'Utilisation Alert: CASHBACK SBI Card at 36.1%', 'Your SBI Cashback card utilisation exceeds the recommended 30% threshold.', 'warning'],
    ['reward_expiry', '5,790 HDFC Infinia Points Expiring in 29 Days', 'Redeem your points on SmartBuy flights or Apple products before expiry.', 'info'],
    ['payment_confirmation', 'Partial Payment Recorded: Axis Atlas (•••• 3359)', 'Manual payment record of ₹15,000 confirmed via UPI.', 'success'],
    ['unusual_spending', 'High-Value Transaction Alert: ₹38,900 at Flipkart', 'Recorded on CASHBACK SBI Card. Review if this was unexpected.', 'info'],
  ];
  for (const [type, title, msg, severity] of demoNotifications) {
    await db.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, severity, is_read)
       VALUES ($1,$2,$3,$4,$5,$6,0)`,
      [crypto.randomUUID(), userId, type, title, msg, severity]
    );
  }
}

export async function ensureDemoUser(db: DbClient): Promise<string> {
  const email = 'demo@cardwise.in';
  let user = await db.queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (!user) {
    const userId = crypto.randomUUID();
    const passHash = hashPassword('CardWise@2026');
    await db.execute(
      `INSERT INTO users (id, email, password_hash, full_name, mobile_number, role, auth_provider, email_verified, is_active)
       VALUES ($1, $2, $3, 'Aarav Sharma (Demo)', '+919876543210', 'user', 'email', 1, 1)`,
      [userId, email, passHash]
    );
    await db.execute(
      `INSERT INTO user_profiles (id, user_id, full_name, mobile_encrypted, city, monthly_income_bracket, credit_score_self_reported)
       VALUES ($1, $2, 'Aarav Sharma (Demo)', $3, 'Bengaluru', '200000-500000', 792)`,
      [crypto.randomUUID(), userId, encryptSensitive('+919876543210')]
    );
    await db.execute(
      `INSERT INTO user_preferences (id, user_id, theme, timezone) VALUES ($1, $2, 'dark', 'Asia/Kolkata')`,
      [crypto.randomUUID(), userId]
    );
    await seedDemoPortfolioForUser(db, userId);
    return userId;
  }
  return user.id;
}
