import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { db, tx } from './db.js';

// Icon names are Ionicons (https://icons.expo.fyi) used by the mobile app.
const categories = [
  { name: 'Pain & Fever', slug: 'pain-fever', icon: 'thermometer', color: '#E8590C' },
  { name: 'Malaria', slug: 'malaria', icon: 'bug', color: '#2F9E44' },
  { name: 'Cold, Flu & Allergy', slug: 'cold-flu-allergy', icon: 'snow', color: '#1C7ED6' },
  { name: 'Antibiotics', slug: 'antibiotics', icon: 'shield-checkmark', color: '#7048E8' },
  { name: 'Chronic Care', slug: 'chronic-care', icon: 'heart', color: '#E03131' },
  { name: 'Vitamins & Supplements', slug: 'vitamins', icon: 'nutrition', color: '#F08C00' },
  { name: 'Digestive Health', slug: 'digestive', icon: 'water', color: '#0C8599' },
  { name: 'Mother & Baby', slug: 'mother-baby', icon: 'happy', color: '#D6336C' },
  { name: 'First Aid', slug: 'first-aid', icon: 'bandage', color: '#C92A2A' },
  { name: 'Health Devices', slug: 'devices', icon: 'pulse', color: '#495057' },
];

// price is in pesewas (GH₵ x 100)
const products = [
  // Pain & Fever
  ['pain-fever', 'Paracetamol 500mg Tablets', 'Paracetamol', 'Relief of mild to moderate pain and fever, including headache, toothache and body aches.', 'Ernest Chemists', 'Tablet', '500mg', '100 tablets', 1500, 200, 0, 1],
  ['pain-fever', 'Efpac Tablets', 'Paracetamol, Caffeine', 'Fast relief from headache, migraine, period pain and fever.', 'Kinapharma', 'Tablet', '500mg/30mg', '20 tablets', 1200, 150, 0, 0],
  ['pain-fever', 'Ibuprofen 400mg Tablets', 'Ibuprofen', 'Anti-inflammatory pain relief for muscle pain, back pain, and arthritis. Take with food.', 'M&G Pharmaceuticals', 'Tablet', '400mg', '24 tablets', 1800, 120, 0, 0],
  ['pain-fever', 'Diclofenac Gel 1%', 'Diclofenac sodium', 'Topical gel for local relief of joint and muscle pain, sprains and strains.', 'Novartis', 'Gel', '1%', '50g tube', 3500, 60, 0, 0],
  ['pain-fever', 'Tramadol 50mg Capsules', 'Tramadol hydrochloride', 'Strong pain relief. Controlled medicine — a valid prescription is required.', 'Danadams', 'Capsule', '50mg', '10 capsules', 2500, 40, 1, 0],

  // Malaria
  ['malaria', 'Lonart DS Tablets', 'Artemether/Lumefantrine', 'Treatment of uncomplicated malaria in adults. Complete the full 3-day course.', 'Bliss GVS', 'Tablet', '80mg/480mg', '6 tablets', 3000, 180, 0, 1],
  ['malaria', 'Coartem 20/120 Tablets', 'Artemether/Lumefantrine', 'Treatment of acute uncomplicated malaria.', 'Novartis', 'Tablet', '20mg/120mg', '24 tablets', 5500, 90, 0, 0],
  ['malaria', 'Mosquito Repellent Lotion', 'DEET 15%', 'Protects against mosquito bites for up to 8 hours.', 'Mosigard', 'Lotion', '15%', '100ml', 2200, 100, 0, 0],
  ['malaria', 'Malaria Rapid Test Kit', 'mRDT', 'Rapid diagnostic test for malaria. Results in 15 minutes.', 'SD Bioline', 'Test kit', null, '1 test', 1500, 75, 0, 0],

  // Cold, Flu & Allergy
  ['cold-flu-allergy', 'Cetirizine 10mg Tablets', 'Cetirizine', 'Non-drowsy relief of hay fever, runny nose, sneezing and itchy eyes.', 'Letap', 'Tablet', '10mg', '30 tablets', 1400, 140, 0, 0],
  ['cold-flu-allergy', 'Loratadine 10mg Tablets', 'Loratadine', '24-hour allergy relief.', 'Tobinco', 'Tablet', '10mg', '10 tablets', 1000, 110, 0, 0],
  ['cold-flu-allergy', 'Coldrilif Capsules', 'Paracetamol/Chlorpheniramine/Phenylephrine', 'Relief of cold and flu symptoms: blocked nose, fever and aches.', 'Kinapharma', 'Capsule', null, '20 capsules', 1600, 130, 0, 1],
  ['cold-flu-allergy', 'Benylin Cough Syrup', 'Diphenhydramine', 'Soothing relief of chesty and dry coughs.', 'Johnson & Johnson', 'Syrup', '14mg/5ml', '100ml', 4200, 70, 0, 0],
  ['cold-flu-allergy', 'Salbutamol Inhaler', 'Salbutamol', 'Quick relief of asthma symptoms and breathlessness.', 'GSK', 'Inhaler', '100mcg', '200 doses', 6500, 35, 1, 0],

  // Antibiotics (all Rx)
  ['antibiotics', 'Amoxicillin 500mg Capsules', 'Amoxicillin', 'Broad-spectrum antibiotic. Prescription required.', 'Danadams', 'Capsule', '500mg', '21 capsules', 2800, 100, 1, 0],
  ['antibiotics', 'Augmentin 625mg Tablets', 'Amoxicillin/Clavulanic acid', 'Antibiotic for bacterial infections. Prescription required.', 'GSK', 'Tablet', '625mg', '14 tablets', 9500, 45, 1, 0],
  ['antibiotics', 'Ciprofloxacin 500mg Tablets', 'Ciprofloxacin', 'Antibiotic for urinary tract and other infections. Prescription required.', 'Ernest Chemists', 'Tablet', '500mg', '10 tablets', 2200, 80, 1, 0],
  ['antibiotics', 'Azithromycin 500mg Tablets', 'Azithromycin', 'Antibiotic for respiratory and skin infections. Prescription required.', 'Pfizer', 'Tablet', '500mg', '3 tablets', 3500, 60, 1, 0],

  // Chronic care
  ['chronic-care', 'Metformin 500mg Tablets', 'Metformin', 'Controls blood sugar in type 2 diabetes. Prescription required.', 'Merck', 'Tablet', '500mg', '100 tablets', 4500, 90, 1, 0],
  ['chronic-care', 'Amlodipine 5mg Tablets', 'Amlodipine', 'Treats high blood pressure. Prescription required.', 'Pfizer', 'Tablet', '5mg', '30 tablets', 3000, 85, 1, 0],
  ['chronic-care', 'Losartan 50mg Tablets', 'Losartan potassium', 'Treats high blood pressure. Prescription required.', 'Tobinco', 'Tablet', '50mg', '28 tablets', 3800, 70, 1, 0],
  ['chronic-care', 'Glucose Test Strips', null, 'Blood glucose test strips, compatible with Accu-Chek meters.', 'Roche', 'Strips', null, '50 strips', 12000, 30, 0, 0],

  // Vitamins
  ['vitamins', 'Vitamin C 1000mg Effervescent', 'Ascorbic acid', 'Supports immunity. Dissolve one tablet in water daily.', 'Redoxon', 'Effervescent tablet', '1000mg', '10 tablets', 2500, 160, 0, 1],
  ['vitamins', 'Multivitamin Tablets', 'Multivitamins & Minerals', 'Complete daily multivitamin for adults.', 'Centrum', 'Tablet', null, '30 tablets', 8500, 60, 0, 0],
  ['vitamins', 'Zinc 20mg Tablets', 'Zinc sulphate', 'Supports immunity and recovery from diarrhoea.', 'Letap', 'Tablet', '20mg', '10 tablets', 800, 200, 0, 0],
  ['vitamins', 'Folic Acid 5mg Tablets', 'Folic acid', 'Supports healthy pregnancy and red blood cell formation.', 'Ernest Chemists', 'Tablet', '5mg', '100 tablets', 900, 150, 0, 0],
  ['vitamins', 'Ferrous Sulphate 200mg', 'Iron', 'Treats and prevents iron-deficiency anaemia.', 'M&G Pharmaceuticals', 'Tablet', '200mg', '100 tablets', 1100, 120, 0, 0],

  // Digestive
  ['digestive', 'ORS Sachets', 'Oral Rehydration Salts', 'Replaces fluids and salts lost through diarrhoea and vomiting.', 'Ernest Chemists', 'Powder', null, '10 sachets', 1000, 250, 0, 1],
  ['digestive', 'Omeprazole 20mg Capsules', 'Omeprazole', 'Relief of heartburn, acid reflux and ulcers.', 'Kinapharma', 'Capsule', '20mg', '28 capsules', 2000, 100, 0, 0],
  ['digestive', 'Gaviscon Liquid', 'Sodium alginate', 'Fast relief of heartburn and indigestion.', 'Reckitt', 'Suspension', null, '200ml', 5500, 55, 0, 0],
  ['digestive', 'Loperamide 2mg Capsules', 'Loperamide', 'Relief of acute diarrhoea.', 'Letap', 'Capsule', '2mg', '12 capsules', 900, 90, 0, 0],

  // Mother & baby
  ['mother-baby', 'Pregnancy Test Strip', 'hCG test', 'Over 99% accurate from the day of your expected period.', 'Clearblue', 'Test kit', null, '1 test', 1200, 100, 0, 0],
  ['mother-baby', 'Baby Paracetamol Syrup', 'Paracetamol', 'Relief of fever and pain in children from 3 months.', 'Calpol', 'Syrup', '120mg/5ml', '100ml', 2800, 80, 0, 0],
  ['mother-baby', 'Pregnacare Original', 'Prenatal multivitamin', 'Vitamins and minerals for before, during and after pregnancy.', 'Vitabiotics', 'Tablet', null, '30 tablets', 11000, 40, 0, 0],
  ['mother-baby', 'Baby Diapers (Size 3)', null, 'Soft, absorbent diapers for 5-9kg babies.', 'Pampers', 'Diaper', null, '44 pieces', 9500, 50, 0, 0],

  // First aid
  ['first-aid', 'Methylated Spirit', 'Ethanol', 'Antiseptic for cleaning wounds and skin.', 'Ernest Chemists', 'Liquid', null, '200ml', 1200, 90, 0, 0],
  ['first-aid', 'Plasters (Assorted)', null, 'Waterproof adhesive bandages in assorted sizes.', 'Elastoplast', 'Plaster', null, '40 pieces', 1800, 120, 0, 0],
  ['first-aid', 'Crepe Bandage 10cm', null, 'Elastic support bandage for sprains and strains.', 'Medigauze', 'Bandage', null, '1 roll', 900, 100, 0, 0],
  ['first-aid', 'Hand Sanitizer 500ml', 'Ethanol 70%', 'Kills 99.9% of germs without water.', 'Dettol', 'Gel', '70%', '500ml', 3000, 150, 0, 0],

  // Devices
  ['devices', 'Digital Thermometer', null, 'Fast and accurate readings in 10 seconds.', 'Omron', 'Device', null, '1 unit', 4500, 45, 0, 0],
  ['devices', 'Blood Pressure Monitor', null, 'Automatic upper-arm blood pressure monitor with memory.', 'Omron', 'Device', null, '1 unit', 38000, 15, 0, 1],
  ['devices', 'Pulse Oximeter', null, 'Measures blood oxygen (SpO2) and pulse rate.', 'Contec', 'Device', null, '1 unit', 15000, 25, 0, 0],
  ['devices', 'Face Masks (Surgical)', null, '3-ply disposable surgical face masks.', 'Medigauze', 'Mask', null, '50 pieces', 2500, 200, 0, 0],
];

export function seed({ reset = false } = {}) {
  tx(() => {
    if (reset) {
      db.exec(`DELETE FROM order_items; DELETE FROM orders; DELETE FROM prescriptions;
               DELETE FROM products; DELETE FROM categories; DELETE FROM users;
               DELETE FROM sqlite_sequence;`);
    }

    const hasAdmin = db.prepare(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!hasAdmin) {
      db.prepare(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
      ).run('Pharm-LIT Admin', config.admin.email, '0200000000', bcrypt.hashSync(config.admin.password, 10));
      db.prepare(
        `INSERT OR IGNORE INTO users (name, email, phone, password_hash, role, address) VALUES (?, ?, ?, ?, 'customer', ?)`,
      ).run('Ama Mensah', 'ama@example.com', '0241234567', bcrypt.hashSync('password123', 10), '12 Oxford Street, Osu, Accra');
    }

    const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
    if (catCount === 0) {
      const insCat = db.prepare('INSERT INTO categories (name, slug, icon, color) VALUES (?, ?, ?, ?)');
      for (const c of categories) insCat.run(c.name, c.slug, c.icon, c.color);

      const catId = Object.fromEntries(
        db.prepare('SELECT id, slug FROM categories').all().map((r) => [r.slug, r.id]),
      );
      const insProd = db.prepare(`INSERT INTO products
        (category_id, name, generic_name, description, manufacturer, dosage_form, strength, pack_size,
         price, stock, requires_prescription, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const [slug, ...rest] of products) insProd.run(catId[slug], ...rest);
    }
  });
}

// Allow `node src/seed.js --reset`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ reset: process.argv.includes('--reset') });
  console.log('Database seeded.');
}
