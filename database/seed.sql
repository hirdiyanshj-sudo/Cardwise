-- ============================================================================
-- CardWise – Indian Banking Reference Seed Data
-- Includes 11 Major Indian Banks, 10 Spending Categories, Card Catalog,
-- and Sample/Demo Bank Offers (clearly marked offer_source = 'demo').
-- ============================================================================

INSERT INTO banks (code, name, short_name, support_url, brand_color, accent_color) VALUES
  ('HDFC', 'HDFC Bank', 'HDFC', 'https://www.hdfcbank.com', '#004C8F', '#ED1C24'),
  ('ICICI', 'ICICI Bank', 'ICICI', 'https://www.icicibank.com', '#B02A30', '#F37E20'),
  ('SBI', 'SBI Card', 'SBI', 'https://www.sbicard.com', '#1A4B8E', '#00B5EF'),
  ('AXIS', 'Axis Bank', 'Axis', 'https://www.axisbank.com', '#97144D', '#EB1165'),
  ('KOTAK', 'Kotak Mahindra Bank', 'Kotak', 'https://www.kotak.com', '#ED1C24', '#003874'),
  ('IDFC', 'IDFC FIRST Bank', 'IDFC FIRST', 'https://www.idfcfirstbank.com', '#9D1D27', '#F4A261'),
  ('INDUSIND', 'IndusInd Bank', 'IndusInd', 'https://www.indusind.com', '#8A1538', '#C59B27'),
  ('AMEX', 'American Express', 'Amex', 'https://www.americanexpress.com/en-in', '#006FCF', '#4D9DE0'),
  ('AU', 'AU Small Finance Bank', 'AU Bank', 'https://www.aubank.in', '#4A1D6B', '#F26522'),
  ('YES', 'Yes Bank', 'Yes Bank', 'https://www.yesbank.in', '#005197', '#E31837'),
  ('FEDERAL', 'Federal Bank', 'Federal', 'https://www.federalbank.co.in', '#004B87', '#FDB913')
ON CONFLICT (code) DO NOTHING;

INSERT INTO spending_categories (name, slug, icon, color, keywords) VALUES
  ('Shopping', 'shopping', 'shopping-bag', '#6366F1', 'amazon,flipkart,myntra,ajio,croma,reliance digital,nykaa,meesho,tata cliq,retail'),
  ('Food and Dining', 'food-dining', 'utensils', '#F59E0B', 'swiggy,zomato,restaurant,cafe,starbucks,dominos,mcdonalds,kfc,dining,eats,bakery'),
  ('Travel', 'travel', 'plane', '#0EA5E9', 'makemytrip,goibibo,indigo,air india,vistara,irctc,uber,ola,hotel,flight,marriott,taj'),
  ('Fuel', 'fuel', 'fuel', '#EF4444', 'indian oil,iocl,hpcl,bpcl,shell,petrol,diesel,fuel,pump'),
  ('Entertainment', 'entertainment', 'film', '#EC4899', 'bookmyshow,pvr,inox,netflix,spotify,prime video,hotstar,cinema,movie,gaming'),
  ('Groceries', 'groceries', 'shopping-cart', '#10B981', 'blinkit,zepto,instamart,bigbasket,dmart,reliance fresh,supermarket,grocery'),
  ('Bills and Utilities', 'bills-utilities', 'zap', '#8B5CF6', 'electricity,bescom,airtel,jio,vi,broadband,gas,water,recharge,utility,insurance'),
  ('Healthcare', 'healthcare', 'heart-pulse', '#14B8A6', 'apollo,pharmeasy,1mg,hospital,clinic,pharmacy,medical,health,dental'),
  ('Education', 'education', 'graduation-cap', '#3B82F6', 'udemy,coursera,school,college,tuition,books,exam,university,upgrad'),
  ('Other expenses', 'other', 'receipt', '#64748B', 'misc,other,transfer,fee,subscription')
ON CONFLICT (slug) DO NOTHING;
