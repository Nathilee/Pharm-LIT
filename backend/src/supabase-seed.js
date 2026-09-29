import bcrypt from 'bcryptjs';
import { supabase } from './supabase.js';

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

const products = [
  ['pain-fever', 'Paracetamol 500mg Tablets', 'Paracetamol', 'Relief of mild to moderate pain and fever, including headache, toothache and body aches.', 'Ernest Chemists', 'Tablet', '500mg', '100 tablets', 1500, 200, false, true],
  ['pain-fever', 'Efpac Tablets', 'Paracetamol, Caffeine', 'Fast relief from headache, migraine, period pain and fever.', 'Kinapharma', 'Tablet', '500mg/30mg', '20 tablets', 1200, 150, false, false],
  ['pain-fever', 'Ibuprofen 400mg Tablets', 'Ibuprofen', 'Anti-inflammatory pain relief for muscle pain, back pain, and arthritis. Take with food.', 'M&G Pharmaceuticals', 'Tablet', '400mg', '24 tablets', 1800, 120, false, false],
  ['pain-fever', 'Diclofenac Gel 1%', 'Diclofenac sodium', 'Topical gel for local relief of joint and muscle pain, sprains and strains.', 'Novartis', 'Gel', '1%', '50g tube', 3500, 60, false, false],
  ['pain-fever', 'Tramadol 50mg Capsules', 'Tramadol hydrochloride', 'Strong pain relief. Controlled medicine — a valid prescription is required.', 'Danadams', 'Capsule', '50mg', '10 capsules', 2500, 40, true, false],
  ['malaria', 'Lonart DS Tablets', 'Artemether/Lumefantrine', 'Treatment of uncomplicated malaria in adults. Complete the full 3-day course.', 'Bliss GVS', 'Tablet', '80mg/480mg', '6 tablets', 3000, 180, false, true],
  ['malaria', 'Coartem 20/120 Tablets', 'Artemether/Lumefantrine', 'Treatment of acute uncomplicated malaria.', 'Novartis', 'Tablet', '20mg/120mg', '24 tablets', 5500, 90, false, false],
  ['malaria', 'Mosquito Repellent Lotion', 'DEET 15%', 'Protects against mosquito bites for up to 8 hours.', 'Mosigard', 'Lotion', '15%', '100ml', 2200, 100, false, false],
  ['malaria', 'Malaria Rapid Test Kit', 'mRDT', 'Rapid diagnostic test for malaria. Results in 15 minutes.', 'SD Bioline', 'Test kit', null, '1 test', 1500, 75, false, false],
  ['cold-flu-allergy', 'Cetirizine 10mg Tablets', 'Cetirizine', 'Non-drowsy relief of hay fever, runny nose, sneezing and itchy eyes.', 'Letap', 'Tablet', '10mg', '30 tablets', 1400, 140, false, false],
  ['cold-flu-allergy', 'Loratadine 10mg Tablets', 'Loratadine', '24-hour allergy relief.', 'Tobinco', 'Tablet', '10mg', '10 tablets', 1000, 110, false, false],
  ['cold-flu-allergy', 'Coldrilif Capsules', 'Paracetamol/Chlorpheniramine/Phenylephrine', 'Relief of cold and flu symptoms: blocked nose, fever and aches.', 'Kinapharma', 'Capsule', null, '20 capsules', 1600, 130, false, true],
  ['cold-flu-allergy', 'Benylin Cough Syrup', 'Diphenhydramine', 'Soothing relief of chesty and dry coughs.', 'Johnson & Johnson', 'Syrup', '14mg/5ml', '100ml', 4200, 70, false, false],
  ['cold-flu-allergy', 'Salbutamol Inhaler', 'Salbutamol', 'Quick relief of asthma symptoms and breathlessness.', 'GSK', 'Inhaler', '100mcg', '200 doses', 6500, 35, true, false],
  ['antibiotics', 'Amoxicillin 500mg Capsules', 'Amoxicillin', 'Broad-spectrum antibiotic. Prescription required.', 'Danadams', 'Capsule', '500mg', '21 capsules', 2800, 100, true, false],
  ['antibiotics', 'Augmentin 625mg Tablets', 'Amoxicillin/Clavulanic acid', 'Antibiotic for bacterial infections. Prescription required.', 'GSK', 'Tablet', '625mg', '14 tablets', 9500, 45, true, false],
  ['antibiotics', 'Ciprofloxacin 500mg Tablets', 'Ciprofloxacin', 'Antibiotic for urinary tract and other infections. Prescription required.', 'Ernest Chemists', 'Tablet', '500mg', '10 tablets', 2200, 80, true, false],
  ['antibiotics', 'Azithromycin 500mg Tablets', 'Azithromycin', 'Antibiotic for respiratory and skin infections. Prescription required.', 'Pfizer', 'Tablet', '500mg', '3 tablets', 3500, 60, true, false],
  ['chronic-care', 'Metformin 500mg Tablets', 'Metformin', 'Controls blood sugar in type 2 diabetes. Prescription required.', 'Merck', 'Tablet', '500mg', '100 tablets', 4500, 90, true, false],
  ['chronic-care', 'Amlodipine 5mg Tablets', 'Amlodipine', 'Treats high blood pressure. Prescription required.', 'Pfizer', 'Tablet', '5mg', '30 tablets', 3000, 85, true, false],
  ['chronic-care', 'Losartan 50mg Tablets', 'Losartan potassium', 'Treats high blood pressure. Prescription required.', 'Tobinco', 'Tablet', '50mg', '28 tablets', 3800, 70, true, false],
  ['chronic-care', 'Glucose Test Strips', null, 'Blood glucose test strips, compatible with Accu-Chek meters.', 'Roche', 'Strips', null, '50 strips', 12000, 30, false, false],
  ['vitamins', 'Vitamin C 1000mg Effervescent', 'Ascorbic acid', 'Supports immunity. Dissolve one tablet in water daily.', 'Redoxon', 'Effervescent tablet', '1000mg', '10 tablets', 2500, 160, false, true],
  ['vitamins', 'Multivitamin Tablets', 'Multivitamins & Minerals', 'Complete daily multivitamin for adults.', 'Centrum', 'Tablet', null, '30 tablets', 8500, 60, false, false],
  ['vitamins', 'Zinc 20mg Tablets', 'Zinc sulphate', 'Supports immunity and recovery from diarrhoea.', 'Letap', 'Tablet', '20mg', '10 tablets', 800, 200, false, false],
  ['vitamins', 'Folic Acid 5mg Tablets', 'Folic acid', 'Supports healthy pregnancy and red blood cell formation.', 'Ernest Chemists', 'Tablet', '5mg', '100 tablets', 900, 150, false, false],
  ['vitamins', 'Ferrous Sulphate 200mg', 'Iron', 'Treats and prevents iron-deficiency anaemia.', 'M&G Pharmaceuticals', 'Tablet', '200mg', '100 tablets', 1100, 120, false, false],
  ['digestive', 'ORS Sachets', 'Oral Rehydration Salts', 'Replaces fluids and salts lost through diarrhoea and vomiting.', 'Ernest Chemists', 'Powder', null, '10 sachets', 1000, 250, false, true],
  ['digestive', 'Omeprazole 20mg Capsules', 'Omeprazole', 'Relief of heartburn, acid reflux and ulcers.', 'Kinapharma', 'Capsule', '20mg', '28 capsules', 2000, 100, false, false],
  ['digestive', 'Gaviscon Liquid', 'Sodium alginate', 'Fast relief of heartburn and indigestion.', 'Reckitt', 'Suspension', null, '200ml', 5500, 55, false, false],
  ['digestive', 'Loperamide 2mg Capsules', 'Loperamide', 'Relief of acute diarrhoea.', 'Letap', 'Capsule', '2mg', '12 capsules', 900, 90, false, false],
  ['mother-baby', 'Pregnancy Test Strip', 'hCG test', 'Over 99% accurate from the day of your expected period.', 'Clearblue', 'Test kit', null, '1 test', 1200, 100, false, false],
  ['mother-baby', 'Baby Paracetamol Syrup', 'Paracetamol', 'Relief of fever and pain in children from 3 months.', 'Calpol', 'Syrup', '120mg/5ml', '100ml', 2800, 80, false, false],
  ['mother-baby', 'Pregnacare Original', 'Prenatal multivitamin', 'Vitamins and minerals for before, during and after pregnancy.', 'Vitabiotics', 'Tablet', null, '30 tablets', 11000, 40, false, false],
  ['mother-baby', 'Baby Diapers (Size 3)', null, 'Soft, absorbent diapers for 5-9kg babies.', 'Pampers', 'Diaper', null, '44 pieces', 9500, 50, false, false],
  ['first-aid', 'Methylated Spirit', 'Ethanol', 'Antiseptic for cleaning wounds and skin.', 'Ernest Chemists', 'Liquid', null, '200ml', 1200, 90, false, false],
  ['first-aid', 'Plasters (Assorted)', null, 'Waterproof adhesive bandages in assorted sizes.', 'Elastoplast', 'Plaster', null, '40 pieces', 1800, 120, false, false],
  ['first-aid', 'Crepe Bandage 10cm', null, 'Elastic support bandage for sprains and strains.', 'Medigauze', 'Bandage', null, '1 roll', 900, 100, false, false],
  ['first-aid', 'Hand Sanitizer 500ml', 'Ethanol 70%', 'Kills 99.9% of germs without water.', 'Dettol', 'Gel', '70%', '500ml', 3000, 150, false, false],
  ['devices', 'Digital Thermometer', null, 'Fast and accurate readings in 10 seconds.', 'Omron', 'Device', null, '1 unit', 4500, 45, false, false],
  ['devices', 'Blood Pressure Monitor', null, 'Automatic upper-arm blood pressure monitor with memory.', 'Omron', 'Device', null, '1 unit', 38000, 15, false, true],
  ['devices', 'Pulse Oximeter', null, 'Measures blood oxygen (SpO2) and pulse rate.', 'Contec', 'Device', null, '1 unit', 15000, 25, false, false],
  ['devices', 'Face Masks (Surgical)', null, '3-ply disposable surgical face masks.', 'Medigauze', 'Mask', null, '50 pieces', 2500, 200, false, false],
];

export async function seedSupabase() {
  if (!supabase) {
    console.error('Supabase is not configured.');
    return;
  }

  console.log('Seeding Supabase categories...');
  for (const cat of categories) {
    const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'slug' });
    if (error) console.error(`Error inserting category ${cat.name}:`, error.message);
  }

  const { data: dbCategories, error: catErr } = await supabase.from('categories').select('id, slug');
  if (catErr) {
    console.error('Failed to fetch categories:', catErr.message);
    return;
  }

  const catMap = Object.fromEntries(dbCategories.map((c) => [c.slug, c.id]));

  console.log('Seeding Supabase products...');
  for (const [slug, name, generic_name, description, manufacturer, dosage_form, strength, pack_size, price, stock, requires_prescription, featured] of products) {
    const category_id = catMap[slug];
    const { error } = await supabase.from('products').insert({
      category_id,
      name,
      generic_name,
      description,
      manufacturer,
      dosage_form,
      strength,
      pack_size,
      price,
      stock,
      requires_prescription,
      featured,
    });
    if (error) console.error(`Error inserting product ${name}:`, error.message);
  }

  console.log('Seeding completed for Supabase!');
}

if (process.argv[1]?.endsWith('supabase-seed.js')) {
  seedSupabase().then(() => process.exit(0));
}
