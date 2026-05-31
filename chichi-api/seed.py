"""Run once to populate chichi.db with mock data. Usage: python seed.py"""
import json
import sqlite3

from auth import hash_password
from database import create_tables, DB_PATH

KENNELS = [
    ('k1', 'Little Royals Chihuahuas', 'little-royals-chihuahuas', 'KUSA', 'LR', '#B5651D',
     'Dedicated KUSA-registered Chihuahua breeders on the Highveld since 2008.', 'Johannesburg, Gauteng',
     'info@littleroyalschis.co.za', '+27 82 555 1234', 'active', '2027-01-15', 8.0, 'approved', None, 'LRC2024'),
    ('k2', 'Cape Miniatura', 'cape-miniatura', 'KUSA', 'CM', '#4A7C59',
     "Cape Town's finest Chihuahua kennel.", 'Cape Town, Western Cape',
     'breed@capeminiatura.co.za', '+27 72 444 5678', 'active', '2026-11-30', 8.0, 'approved', 'k1', 'CMN2024'),
    ('k3', 'Pretoria Chi Palace', 'pretoria-chi-palace', 'KUSA', 'PCP', '#C49A1D',
     'Show-quality Chihuahuas bred for conformation, temperament and longevity.', 'Pretoria, Gauteng',
     'chis@pretorichis.co.za', '+27 83 111 9876', 'active', '2026-08-20', 8.0, 'approved', None, 'PCP2024'),
    ('k4', 'Suncoast Tiny Paws', 'suncoast-tiny-paws', 'Canine SA', 'STP', '#7C5C4A',
     'Family-raised Chihuahuas on the KwaZulu-Natal coast.', 'Durban, KwaZulu-Natal',
     'tinypaws@suncoastchis.co.za', '+27 71 333 2222', 'active', '2027-03-10', 8.0, 'approved', None, 'STP2024'),
    ('k5', 'Joburg Miniature Palace', 'joburg-miniature-palace', 'Canine SA', 'JMP', '#2A1F14',
     'Premium Chihuahua breeders in Sandton specialising in rare colours.', 'Sandton, Gauteng',
     'chis@joburgminiature.co.za', '+27 82 777 4444', 'active', '2026-12-01', 10.0, 'approved', 'k4', 'JMP2024'),
    ('k6', 'Bluebell Chihuahuas', 'bluebell-chihuahuas', 'Canine SA', 'BCH', '#6B4A7C',
     'Exquisite long coat Chihuahuas raised in our home in Stellenbosch.', 'Stellenbosch, Western Cape',
     'hello@bluebellchis.co.za', '+27 73 888 3333', 'pending_payment', None, 8.0, 'pending', None, None),
    ('k_dormant', 'Sundown Chi Breeders', 'sundown-chi-breeders', 'Canine SA', 'SCB', '#8B7355',
     'Inactive kennel — no listings.', 'Bloemfontein, Free State',
     'dormant@sundownchis.co.za', '+27 51 000 0000', 'active', '2026-04-10', 8.0, 'approved', None, None),
]

PUPPIES = [
    ('p1', 'k1', 'Duchess', 'Long Coat', 'Female', 'Cream & White', '2025-12-10', 15500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'CH Little Royals Prince Enzo', 'dam': 'Little Royals Lady Bella',
                 'sireSire': 'INT CH Mariposa El Magnifico', 'sireDam': 'Little Royals Diamante',
                 'damSire': 'SA CH Royal Tiny Prince', 'damDam': 'Little Royals Starlet'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exquisite cream and white long coat female from champion bloodlines.', 'KUSA-2025-CHI-8821'),
    ('p2', 'k1', 'Romeo', 'Smooth Coat', 'Male', 'Fawn with White Markings', '2025-12-10', 12000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'CH Little Royals Prince Enzo', 'dam': 'Little Royals Lady Bella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Classic apple head smooth coat male, deep fawn colouring.', 'KUSA-2025-CHI-8822'),
    ('p3', 'k1', 'Perla', 'Long Coat', 'Female', 'Chocolate & Tan', '2025-11-05', 18000.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80']),
     json.dumps({'sire': 'SA CH Royal Tiny Prince', 'dam': 'Little Royals Lola'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Stunning chocolate & tan long coat female. Now in her forever home.', 'KUSA-2025-CHI-7710'),
    ('p4', 'k2', 'Aurora', 'Long Coat', 'Female', 'Blue Merle', '2025-11-20', 22000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'INT CH Cape Merle Maestro', 'dam': 'Cape Miniatura Serafina'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Rare blue merle long coat female from champion European import sire.', 'KUSA-2025-CHI-5502'),
    ('p5', 'k2', 'Marco', 'Smooth Coat', 'Male', 'Black & Tan', '2025-11-20', 11500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'INT CH Cape Merle Maestro', 'dam': 'Cape Miniatura Serafina'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Classic black & tan smooth coat male.', 'KUSA-2025-CHI-5503'),
    ('p6', 'k3', 'Valentina', 'Long Coat', 'Female', 'Tricolor — Black, White & Tan', '2026-01-05', 17500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'SA CH Pretoria Chi King', 'dam': 'Palace Princess Sofia'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Striking tricolor long coat female with show potential.', 'KUSA-2026-CHI-0191'),
    ('p7', 'k3', 'Zeus', 'Smooth Coat', 'Male', 'Blue Fawn', '2026-01-05', 19000.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'SA CH Pretoria Chi King', 'dam': 'Palace Princess Sofia'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Rare blue fawn smooth coat male — now in his forever home.', 'KUSA-2026-CHI-0192'),
    ('p8', 'k4', 'Coco', 'Long Coat', 'Female', 'Chocolate', '2025-12-15', 9500.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Titan', 'dam': 'Suncoast Lady Rosella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Gorgeous deep chocolate long coat female.', 'CSA-2025-CHI-3319'),
    ('p9', 'k4', 'Bruno', 'Smooth Coat', 'Male', 'White', '2025-12-15', 8500.0, 1, 0,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Titan', 'dam': 'Suncoast Lady Rosella'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Pure white smooth coat male — already in his new home.', 'CSA-2025-CHI-3320'),
    ('p10', 'k4', 'Pixie', 'Long Coat', 'Female', 'Cream', '2026-01-20', 9800.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'Suncoast Tiny Prince', 'dam': 'Suncoast Cream Dream'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Pale cream long coat female with the sweetest temperament.', 'CSA-2026-CHI-0112'),
    ('p11', 'k5', 'Bleu', 'Smooth Coat', 'Male', 'Blue', '2026-01-10', 28000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80']),
     json.dumps({'sire': 'EUR CH Bleu de Paris', 'dam': 'Joburg Palace Diamond'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exceptional rare blue smooth coat male from champion European import sire.', 'CSA-2026-CHI-0534'),
    ('p12', 'k5', 'Lilac Rose', 'Long Coat', 'Female', 'Lilac & Tan', '2026-01-10', 32000.0, 0, 1,
     json.dumps(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80']),
     json.dumps({'sire': 'EUR CH Bleu de Paris', 'dam': 'Joburg Palace Diamond'}),
     json.dumps(['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified']),
     'Exceptionally rare lilac & tan long coat female.', 'CSA-2026-CHI-0535'),
]

SELLERS = [
    ('s1', 'info@littleroyalschis.co.za', 'seller123', 'Johan van der Berg', 'k1', 'approved', '2024-01-15'),
    ('s2', 'breed@capeminiatura.co.za', 'seller123', 'Sandra Mitchell', 'k2', 'approved', '2024-03-22'),
    ('s3', 'chis@pretorichis.co.za', 'seller123', 'Pieter Grobler', 'k3', 'approved', '2024-06-10'),
    ('s4', 'incoming@newkennel.co.za', 'seller123', 'Thabo Nkosi', None, 'pending_verification', '2026-04-28'),
    ('s5', 'dormant@sundownchis.co.za', 'seller123', 'Riaan Botha', 'k_dormant', 'approved', '2025-04-10'),
]

TRANSACTIONS = [
    ('txn1', 'p3', 'Perla', 'k1', 'Little Royals Chihuahuas', 'Sarah Johnson', 'sarah.j@gmail.com',
     18000.0, 1440.0, 16560.0, 1, 1, '2026-04-06', '2026-04-09', '2026-04-09'),
    ('txn2', 'p7', 'Zeus', 'k3', 'Pretoria Chi Palace', 'Mike van der Berg', 'mike.vdb@gmail.com',
     19000.0, 1520.0, 17480.0, 1, 1, '2026-04-12', '2026-04-15', '2026-04-15'),
    ('txn3', 'p9', 'Bruno', 'k4', 'Suncoast Tiny Paws', 'Linda Nkosi', 'linda.n@gmail.com',
     8500.0, 680.0, 7820.0, 0, 0, '2026-04-19', None, None),
]

TESTIMONIALS = [
    ('t1', 'k1', 'Sarah Johnson', 5,
     'Absolutely wonderful experience! Duchess arrived healthy, well-socialised and exactly as described.', '2026-04-10'),
    ('t2', 'k3', 'Mike van der Berg', 5,
     'Zeus is perfect! Pieter kept us updated every step of the way. Highly recommended kennel.', '2026-04-16'),
    ('t3', 'k4', 'Linda Nkosi', 4,
     'Great puppy, very healthy. Communication was good. Would buy again.', '2026-04-22'),
]

LEGAL_CONTENT = """# Chihuahua South Africa Marketplace — Terms & Conditions

**Last updated: April 2026**

Chihuahua South Africa is an online marketplace exclusively for Chihuahua breeders,
connecting KUSA and Canine SA registered kennels with prospective buyers across South Africa.

All breeders listed on Chihuahua South Africa are verified by registry membership before
listing approval is granted. Standard commission rate is 8% of the sale price.
Referral discount: 1.5% commission reduction for referring an approved kennel.
"""


def seed():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    create_tables(conn)

    conn.executemany("""
        INSERT OR IGNORE INTO kennels
        (id, name, slug, registry, initials, color, description, location, contact, phone,
         membership_status, membership_expiry, commission, status, referred_by, referral_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, KENNELS)

    conn.executemany("""
        INSERT OR IGNORE INTO puppies
        (id, kennel_id, name, coat_type, gender, color, dob, price, sold, breeding_rights,
         images, pedigree, health, description, registration_no)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, PUPPIES)

    conn.executemany("""
        INSERT OR IGNORE INTO sellers
        (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES (?,?,?,?,?,?,?)
    """, [(s[0], s[1], hash_password(s[2]), s[3], s[4], s[5], s[6]) for s in SELLERS])

    conn.executemany("""
        INSERT OR IGNORE INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date,
         seller_paid_date, commission_paid_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, TRANSACTIONS)

    conn.executemany("""
        INSERT OR IGNORE INTO testimonials (id, kennel_id, buyer_name, stars, text, date)
        VALUES (?,?,?,?,?,?)
    """, TESTIMONIALS)

    conn.execute("UPDATE legal_text SET content = ? WHERE id = 1", (LEGAL_CONTENT,))

    conn.commit()
    conn.close()
    print('Seed complete.')


if __name__ == '__main__':
    seed()
