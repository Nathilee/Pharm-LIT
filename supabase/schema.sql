-- =============================================================================
-- Pharm-LIT Supabase Schema & Seed Script
-- Project: https://hofyrmeqrppzvpulnlnd.supabase.co
-- Paste this entire script into your Supabase SQL Editor and click "Run".
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table Definitions
-- -----------------------------------------------------------------------------

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'medkit',
  color TEXT NOT NULL DEFAULT '#0E9F6E'
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'pharmacist', 'admin')),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  description TEXT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  manufacturer TEXT,
  dosage_form TEXT,
  strength TEXT,
  pack_size TEXT,
  price INT NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  patient_name TEXT,
  doctor_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN (
    'awaiting_prescription', 'pending_payment', 'processing',
    'out_for_delivery', 'delivered', 'cancelled'
  )),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack', 'cash_on_delivery')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  payment_reference TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  subtotal INT NOT NULL,
  delivery_fee INT NOT NULL,
  total INT NOT NULL,
  delivery_name TEXT NOT NULL,
  delivery_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  notes TEXT,
  prescription_id BIGINT REFERENCES prescriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions(user_id);

-- -----------------------------------------------------------------------------
-- 2. Storage Setup (Private bucket for Prescriptions)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access for categories and active products
CREATE POLICY "Public categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Active products are viewable by everyone" ON products
  FOR SELECT USING (active = true);

-- -----------------------------------------------------------------------------
-- 4. Seed Categories
-- -----------------------------------------------------------------------------
INSERT INTO categories (name, slug, icon, color) VALUES
  ('Pain & Fever', 'pain-fever', 'thermometer', '#E8590C'),
  ('Malaria', 'malaria', 'bug', '#2F9E44'),
  ('Cold, Flu & Allergy', 'cold-flu-allergy', 'snow', '#1C7ED6'),
  ('Antibiotics', 'antibiotics', 'shield-checkmark', '#7048E8'),
  ('Chronic Care', 'chronic-care', 'heart', '#E03131'),
  ('Vitamins & Supplements', 'vitamins', 'nutrition', '#F08C00'),
  ('Digestive Health', 'digestive', 'water', '#0C8599'),
  ('Mother & Baby', 'mother-baby', 'happy', '#D6336C'),
  ('First Aid', 'first-aid', 'bandage', '#C92A2A'),
  ('Health Devices', 'devices', 'pulse', '#495057')
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Seed Demo Users (admin123 and password123)
-- -----------------------------------------------------------------------------
INSERT INTO users (name, email, phone, password_hash, role, address) VALUES
  ('Pharm-LIT Admin', 'admin@pharmlit.com', '0200000000', '$2a$10$w6yZp5x/8n1N1yZ5b2iG.O4T8i/W3kRkeH8j/oG9o9L1F2k3j4l5m', 'admin', 'Pharm-LIT HQ, Accra'),
  ('Ama Mensah', 'ama@example.com', '0241234567', '$2a$10$1J8B9n2k1L8V6M4k0J5p7uL2g6F9y7e4R2t5H8j9K0L1M2N3O4P5Q', 'customer', '12 Oxford Street, Osu, Accra')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Seed Sample Medicines & Healthcare Products
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  cat_pain BIGINT;
  cat_malaria BIGINT;
  cat_cold BIGINT;
  cat_antibiotics BIGINT;
  cat_chronic BIGINT;
  cat_vitamins BIGINT;
  cat_digestive BIGINT;
  cat_mother_baby BIGINT;
  cat_first_aid BIGINT;
  cat_devices BIGINT;
BEGIN
  SELECT id INTO cat_pain FROM categories WHERE slug = 'pain-fever';
  SELECT id INTO cat_malaria FROM categories WHERE slug = 'malaria';
  SELECT id INTO cat_cold FROM categories WHERE slug = 'cold-flu-allergy';
  SELECT id INTO cat_antibiotics FROM categories WHERE slug = 'antibiotics';
  SELECT id INTO cat_chronic FROM categories WHERE slug = 'chronic-care';
  SELECT id INTO cat_vitamins FROM categories WHERE slug = 'vitamins';
  SELECT id INTO cat_digestive FROM categories WHERE slug = 'digestive';
  SELECT id INTO cat_mother_baby FROM categories WHERE slug = 'mother-baby';
  SELECT id INTO cat_first_aid FROM categories WHERE slug = 'first-aid';
  SELECT id INTO cat_devices FROM categories WHERE slug = 'devices';

  -- Pain & Fever
  INSERT INTO products (category_id, name, generic_name, description, manufacturer, dosage_form, strength, pack_size, price, stock, requires_prescription, featured)
  VALUES
    (cat_pain, 'Paracetamol 500mg Tablets', 'Paracetamol', 'Relief of mild to moderate pain and fever, including headache, toothache and body aches.', 'Ernest Chemists', 'Tablet', '500mg', '100 tablets', 1500, 200, FALSE, TRUE),
    (cat_pain, 'Efpac Tablets', 'Paracetamol, Caffeine', 'Fast relief from headache, migraine, period pain and fever.', 'Kinapharma', 'Tablet', '500mg/30mg', '20 tablets', 1200, 150, FALSE, FALSE),
    (cat_pain, 'Ibuprofen 400mg Tablets', 'Ibuprofen', 'Anti-inflammatory pain relief for muscle pain, back pain, and arthritis. Take with food.', 'M&G Pharmaceuticals', 'Tablet', '400mg', '24 tablets', 1800, 120, FALSE, FALSE),
    (cat_pain, 'Diclofenac Gel 1%', 'Diclofenac sodium', 'Topical gel for local relief of joint and muscle pain, sprains and strains.', 'Novartis', 'Gel', '1%', '50g tube', 3500, 60, FALSE, FALSE),
    (cat_pain, 'Tramadol 50mg Capsules', 'Tramadol hydrochloride', 'Strong pain relief. Controlled medicine — a valid prescription is required.', 'Danadams', 'Capsule', '50mg', '10 capsules', 2500, 40, TRUE, FALSE),

  -- Malaria
    (cat_malaria, 'Lonart DS Tablets', 'Artemether/Lumefantrine', 'Treatment of uncomplicated malaria in adults. Complete the full 3-day course.', 'Bliss GVS', 'Tablet', '80mg/480mg', '6 tablets', 3000, 180, FALSE, TRUE),
    (cat_malaria, 'Coartem 20/120 Tablets', 'Artemether/Lumefantrine', 'Treatment of acute uncomplicated malaria.', 'Novartis', 'Tablet', '20mg/120mg', '24 tablets', 5500, 90, FALSE, FALSE),
    (cat_malaria, 'Mosquito Repellent Lotion', 'DEET 15%', 'Protects against mosquito bites for up to 8 hours.', 'Mosigard', 'Lotion', '15%', '100ml', 2200, 100, FALSE, FALSE),
    (cat_malaria, 'Malaria Rapid Test Kit', 'mRDT', 'Rapid diagnostic test for malaria. Results in 15 minutes.', 'SD Bioline', 'Test kit', NULL, '1 test', 1500, 75, FALSE, FALSE),

  -- Cold, Flu & Allergy
    (cat_cold, 'Cetirizine 10mg Tablets', 'Cetirizine', 'Non-drowsy relief of hay fever, runny nose, sneezing and itchy eyes.', 'Letap', 'Tablet', '10mg', '30 tablets', 1400, 140, FALSE, FALSE),
    (cat_cold, 'Loratadine 10mg Tablets', 'Loratadine', '24-hour allergy relief.', 'Tobinco', 'Tablet', '10mg', '10 tablets', 1000, 110, FALSE, FALSE),
    (cat_cold, 'Coldrilif Capsules', 'Paracetamol/Chlorpheniramine/Phenylephrine', 'Relief of cold and flu symptoms: blocked nose, fever and aches.', 'Kinapharma', 'Capsule', NULL, '20 capsules', 1600, 130, FALSE, TRUE),
    (cat_cold, 'Benylin Cough Syrup', 'Diphenhydramine', 'Soothing relief of chesty and dry coughs.', 'Johnson & Johnson', 'Syrup', '14mg/5ml', '100ml', 4200, 70, FALSE, FALSE),
    (cat_cold, 'Salbutamol Inhaler', 'Salbutamol', 'Quick relief of asthma symptoms and breathlessness.', 'GSK', 'Inhaler', '100mcg', '200 doses', 6500, 35, TRUE, FALSE),

  -- Antibiotics (all Rx)
    (cat_antibiotics, 'Amoxicillin 500mg Capsules', 'Amoxicillin', 'Broad-spectrum antibiotic. Prescription required.', 'Danadams', 'Capsule', '500mg', '21 capsules', 2800, 100, TRUE, FALSE),
    (cat_antibiotics, 'Augmentin 625mg Tablets', 'Amoxicillin/Clavulanic acid', 'Antibiotic for bacterial infections. Prescription required.', 'GSK', 'Tablet', '625mg', '14 tablets', 9500, 45, TRUE, FALSE),
    (cat_antibiotics, 'Ciprofloxacin 500mg Tablets', 'Ciprofloxacin', 'Antibiotic for urinary tract and other infections. Prescription required.', 'Ernest Chemists', 'Tablet', '500mg', '10 tablets', 2200, 80, TRUE, FALSE),
    (cat_antibiotics, 'Azithromycin 500mg Tablets', 'Azithromycin', 'Antibiotic for respiratory and skin infections. Prescription required.', 'Pfizer', 'Tablet', '500mg', '3 tablets', 3500, 60, TRUE, FALSE),

  -- Chronic care
    (cat_chronic, 'Metformin 500mg Tablets', 'Metformin', 'Controls blood sugar in type 2 diabetes. Prescription required.', 'Merck', 'Tablet', '500mg', '100 tablets', 4500, 90, TRUE, FALSE),
    (cat_chronic, 'Amlodipine 5mg Tablets', 'Amlodipine', 'Treats high blood pressure. Prescription required.', 'Pfizer', 'Tablet', '5mg', '30 tablets', 3000, 85, TRUE, FALSE),
    (cat_chronic, 'Losartan 50mg Tablets', 'Losartan potassium', 'Treats high blood pressure. Prescription required.', 'Tobinco', 'Tablet', '50mg', '28 tablets', 3800, 70, TRUE, FALSE),
    (cat_chronic, 'Glucose Test Strips', NULL, 'Blood glucose test strips, compatible with Accu-Chek meters.', 'Roche', 'Strips', NULL, '50 strips', 12000, 30, FALSE, FALSE),

  -- Vitamins
    (cat_vitamins, 'Vitamin C 1000mg Effervescent', 'Ascorbic acid', 'Supports immunity. Dissolve one tablet in water daily.', 'Redoxon', 'Effervescent tablet', '1000mg', '10 tablets', 2500, 160, FALSE, TRUE),
    (cat_vitamins, 'Multivitamin Tablets', 'Multivitamins & Minerals', 'Complete daily multivitamin for adults.', 'Centrum', 'Tablet', NULL, '30 tablets', 8500, 60, FALSE, FALSE),
    (cat_vitamins, 'Zinc 20mg Tablets', 'Zinc sulphate', 'Supports immunity and recovery from diarrhoea.', 'Letap', 'Tablet', '20mg', '10 tablets', 800, 200, FALSE, FALSE),
    (cat_vitamins, 'Folic Acid 5mg Tablets', 'Folic acid', 'Supports healthy pregnancy and red blood cell formation.', 'Ernest Chemists', 'Tablet', '5mg', '100 tablets', 900, 150, FALSE, FALSE),
    (cat_vitamins, 'Ferrous Sulphate 200mg', 'Iron', 'Treats and prevents iron-deficiency anaemia.', 'M&G Pharmaceuticals', 'Tablet', '200mg', '100 tablets', 1100, 120, FALSE, FALSE),

  -- Digestive
    (cat_digestive, 'ORS Sachets', 'Oral Rehydration Salts', 'Replaces fluids and salts lost through diarrhoea and vomiting.', 'Ernest Chemists', 'Powder', NULL, '10 sachets', 1000, 250, FALSE, TRUE),
    (cat_digestive, 'Omeprazole 20mg Capsules', 'Omeprazole', 'Relief of heartburn, acid reflux and ulcers.', 'Kinapharma', 'Capsule', '20mg', '28 capsules', 2000, 100, FALSE, FALSE),
    (cat_digestive, 'Gaviscon Liquid', 'Sodium alginate', 'Fast relief of heartburn and indigestion.', 'Reckitt', 'Suspension', NULL, '200ml', 5500, 55, FALSE, FALSE),
    (cat_digestive, 'Loperamide 2mg Capsules', 'Loperamide', 'Relief of acute diarrhoea.', 'Letap', 'Capsule', '2mg', '12 capsules', 900, 90, FALSE, FALSE),

  -- Mother & baby
    (cat_mother_baby, 'Pregnancy Test Strip', 'hCG test', 'Over 99% accurate from the day of your expected period.', 'Clearblue', 'Test kit', NULL, '1 test', 1200, 100, FALSE, FALSE),
    (cat_mother_baby, 'Baby Paracetamol Syrup', 'Paracetamol', 'Relief of fever and pain in children from 3 months.', 'Calpol', 'Syrup', '120mg/5ml', '100ml', 2800, 80, FALSE, FALSE),
    (cat_mother_baby, 'Pregnacare Original', 'Prenatal multivitamin', 'Vitamins and minerals for before, during and after pregnancy.', 'Vitabiotics', 'Tablet', NULL, '30 tablets', 11000, 40, FALSE, FALSE),
    (cat_mother_baby, 'Baby Diapers (Size 3)', NULL, 'Soft, absorbent diapers for 5-9kg babies.', 'Pampers', 'Diaper', NULL, '44 pieces', 9500, 50, FALSE, FALSE),

  -- First aid
    (cat_first_aid, 'Methylated Spirit', 'Ethanol', 'Antiseptic for cleaning wounds and skin.', 'Ernest Chemists', 'Liquid', NULL, '200ml', 1200, 90, FALSE, FALSE),
    (cat_first_aid, 'Plasters (Assorted)', NULL, 'Waterproof adhesive bandages in assorted sizes.', 'Elastoplast', 'Plaster', NULL, '40 pieces', 1800, 120, FALSE, FALSE),
    (cat_first_aid, 'Crepe Bandage 10cm', NULL, 'Elastic support bandage for sprains and strains.', 'Medigauze', 'Bandage', NULL, '1 roll', 900, 100, FALSE, FALSE),
    (cat_first_aid, 'Hand Sanitizer 500ml', 'Ethanol 70%', 'Kills 99.9% of germs without water.', 'Dettol', 'Gel', '70%', '500ml', 3000, 150, FALSE, FALSE),

  -- Devices
    (cat_devices, 'Digital Thermometer', NULL, 'Fast and accurate readings in 10 seconds.', 'Omron', 'Device', NULL, '1 unit', 4500, 45, FALSE, FALSE),
    (cat_devices, 'Blood Pressure Monitor', NULL, 'Automatic upper-arm blood pressure monitor with memory.', 'Omron', 'Device', NULL, '1 unit', 38000, 15, FALSE, TRUE),
    (cat_devices, 'Pulse Oximeter', NULL, 'Measures blood oxygen (SpO2) and pulse rate.', 'Contec', 'Device', NULL, '1 unit', 15000, 25, FALSE, FALSE),
    (cat_devices, 'Face Masks (Surgical)', NULL, '3-ply disposable surgical face masks.', 'Medigauze', 'Mask', NULL, '50 pieces', 2500, 200, FALSE, FALSE)
  ON CONFLICT DO NOTHING;
END $$;
