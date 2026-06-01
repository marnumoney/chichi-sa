export const kennels = [
  {
    id: 'k1',
    name: 'Little Royals Chihuahuas',
    slug: 'little-royals-chihuahuas',
    registry: 'KUSA',
    initials: 'LR',
    color: '#B5651D',
    description: 'Dedicated KUSA-registered Chihuahua breeders on the Highveld since 2008. Specialising in apple head and long coat Chihuahuas from international champion bloodlines. All puppies raised in our home.',
    location: 'Johannesburg, Gauteng',
    contact: 'info@littleroyalschis.co.za',
    phone: '+27 82 555 1234',
    membershipStatus: 'active',
    membershipExpiry: '2027-01-15',
    commission: 8,
    status: 'approved',
    referredBy: null,
    referralCode: 'LRC2024',
  },
  {
    id: 'k2',
    name: 'Cape Miniatura',
    slug: 'cape-miniatura',
    registry: 'KUSA',
    initials: 'CM',
    color: '#4A7C59',
    description: 'Cape Town\'s finest Chihuahua kennel. KUSA registered smooth and long coat lines, health tested parents, champion pedigrees going back five generations. Home visits welcome.',
    location: 'Cape Town, Western Cape',
    contact: 'breed@capeminiatura.co.za',
    phone: '+27 72 444 5678',
    membershipStatus: 'active',
    membershipExpiry: '2026-11-30',
    commission: 8,
    status: 'approved',
    referredBy: 'k1',
    referralCode: 'CMN2024',
  },
  {
    id: 'k3',
    name: 'Pretoria Chi Palace',
    slug: 'pretoria-chi-palace',
    registry: 'KUSA',
    initials: 'PCP',
    color: '#C49A1D',
    description: 'Show-quality Chihuahuas bred for conformation, temperament and longevity. Our dogs regularly compete at KUSA shows. Merle and rare colour specialists.',
    location: 'Pretoria, Gauteng',
    contact: 'chis@pretorichis.co.za',
    phone: '+27 83 111 9876',
    membershipStatus: 'active',
    membershipExpiry: '2026-08-20',
    commission: 8,
    status: 'approved',
    referredBy: null,
    referralCode: 'PCP2024',
  },
  {
    id: 'k4',
    name: 'Suncoast Tiny Paws',
    slug: 'suncoast-tiny-paws',
    registry: 'Canine SA',
    initials: 'STP',
    color: '#7C5C4A',
    description: 'Family-raised Chihuahuas on the KwaZulu-Natal coast. Smooth and long coat varieties. Health-tested, well-socialised with children and other pets. Lifetime breeder support.',
    location: 'Durban, KwaZulu-Natal',
    contact: 'tinypaws@suncoastchis.co.za',
    phone: '+27 71 333 2222',
    membershipStatus: 'active',
    membershipExpiry: '2027-03-10',
    commission: 8,
    status: 'approved',
    referredBy: null,
    referralCode: 'STP2024',
  },
  {
    id: 'k5',
    name: 'Joburg Miniature Palace',
    slug: 'joburg-miniature-palace',
    registry: 'Canine SA',
    initials: 'JMP',
    color: '#2A1F14',
    description: 'Premium Chihuahua breeders in Sandton specialising in rare colours — blue, chocolate, merle, and lilac. DNA health panel tested. All puppies microchipped and vaccinated before leaving.',
    location: 'Sandton, Gauteng',
    contact: 'chis@joburgminiature.co.za',
    phone: '+27 82 777 4444',
    membershipStatus: 'active',
    membershipExpiry: '2026-12-01',
    commission: 10,
    status: 'approved',
    referredBy: 'k4',
    referralCode: 'JMP2024',
  },
  {
    id: 'k6',
    name: 'Bluebell Chihuahuas',
    slug: 'bluebell-chihuahuas',
    registry: 'Canine SA',
    initials: 'BCH',
    color: '#6B4A7C',
    description: 'Exquisite long coat Chihuahuas raised in our home in Stellenbosch. Puppy socialisation programme from birth.',
    location: 'Stellenbosch, Western Cape',
    contact: 'hello@bluebellchis.co.za',
    phone: '+27 73 888 3333',
    membershipStatus: 'pending_payment',
    membershipExpiry: null,
    commission: 8,
    status: 'pending',
    referredBy: null,
    referralCode: null,
  },
]

export const puppies = [
  // Little Royals Chihuahuas (k1 - KUSA)
  {
    id: 'p1',
    kennelId: 'k1',
    name: 'Duchess',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Cream & White',
    dob: '2025-12-10',
    price: 15500,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'CH Little Royals Prince Enzo',
      dam: 'Little Royals Lady Bella',
      sireSire: 'INT CH Mariposa El Magnifico',
      sireDam: 'Little Royals Diamante',
      damSire: 'SA CH Royal Tiny Prince',
      damDam: 'Little Royals Starlet',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Exquisite cream and white long coat female from champion bloodlines. Full, silky coat with exceptional length. Confident, loving temperament. KUSA registration and five-generation pedigree included.',
    registrationNo: 'KUSA-2025-CHI-8821',
  },
  {
    id: 'p2',
    kennelId: 'k1',
    name: 'Romeo',
    breed: 'Chihuahua',
    coatType: 'Smooth Coat',
    gender: 'Male',
    color: 'Fawn with White Markings',
    dob: '2025-12-10',
    price: 12000,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
    ],
    pedigree: {
      sire: 'CH Little Royals Prince Enzo',
      dam: 'Little Royals Lady Bella',
      sireSire: 'INT CH Mariposa El Magnifico',
      sireDam: 'Little Royals Diamante',
      damSire: 'SA CH Royal Tiny Prince',
      damDam: 'Little Royals Starlet',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Classic apple head smooth coat male, deep fawn colouring with clean white flash. Bold, outgoing character. Parents on premises for viewing.',
    registrationNo: 'KUSA-2025-CHI-8822',
  },
  {
    id: 'p3',
    kennelId: 'k1',
    name: 'Perla',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Chocolate & Tan',
    dob: '2025-11-05',
    price: 18000,
    sold: true,
    breedingRights: false,
    images: [
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'SA CH Royal Tiny Prince',
      dam: 'Little Royals Lola',
      sireSire: 'INT CH Tiny Gold',
      sireDam: "Royal Lady Rose",
      damSire: 'Little Royals Flash',
      damDam: 'Little Royals Venus',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Stunning chocolate & tan long coat female. Now in her forever home.',
    registrationNo: 'KUSA-2025-CHI-7710',
  },
  // Cape Miniatura (k2 - KUSA)
  {
    id: 'p4',
    kennelId: 'k2',
    name: 'Aurora',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Blue Merle',
    dob: '2025-11-20',
    price: 22000,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'INT CH Cape Merle Maestro',
      dam: 'Cape Miniatura Serafina',
      sireSire: 'ESP CH Merle de Andalucia',
      sireDam: "Cape Maestro's Queen",
      damSire: 'Cape Tiny Baron',
      damDam: 'Cape Miniatura Isabella',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Rare blue merle long coat female from champion European import sire. Gorgeous marbled coat pattern, bright blue eyes. Exceptional health clearances. Full KUSA registration.',
    registrationNo: 'KUSA-2025-CHI-5502',
  },
  {
    id: 'p5',
    kennelId: 'k2',
    name: 'Marco',
    breed: 'Chihuahua',
    coatType: 'Smooth Coat',
    gender: 'Male',
    color: 'Black & Tan',
    dob: '2025-11-20',
    price: 11500,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80',
    ],
    pedigree: {
      sire: 'INT CH Cape Merle Maestro',
      dam: 'Cape Miniatura Serafina',
      sireSire: 'ESP CH Merle de Andalucia',
      sireDam: "Cape Maestro's Queen",
      damSire: 'Cape Tiny Baron',
      damDam: 'Cape Miniatura Isabella',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Classic black & tan smooth coat male. Smart, affectionate, and beautifully marked. Vaccinated, microchipped, dewormed.',
    registrationNo: 'KUSA-2025-CHI-5503',
  },
  // Pretoria Chi Palace (k3 - KUSA)
  {
    id: 'p6',
    kennelId: 'k3',
    name: 'Valentina',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Tricolor — Black, White & Tan',
    dob: '2026-01-05',
    price: 17500,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'SA CH Pretoria Chi King',
      dam: 'Palace Princess Sofia',
      sireSire: 'INT CH Tiny Champion Gold',
      sireDam: "Chi King's Rose",
      damSire: 'Palace Baron Rex',
      damDam: 'Palace Lady Diamond',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Striking tricolor long coat female with show potential. Excellent bone structure, well-rounded apple head. Parents both KUSA champions. Ready for her forever home.',
    registrationNo: 'KUSA-2026-CHI-0191',
  },
  {
    id: 'p7',
    kennelId: 'k3',
    name: 'Zeus',
    breed: 'Chihuahua',
    coatType: 'Smooth Coat',
    gender: 'Male',
    color: 'Blue Fawn',
    dob: '2026-01-05',
    price: 19000,
    sold: true,
    breedingRights: false,
    images: [
      'https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80',
    ],
    pedigree: {
      sire: 'SA CH Pretoria Chi King',
      dam: 'Palace Princess Sofia',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Rare blue fawn smooth coat male — now in his forever home.',
    registrationNo: 'KUSA-2026-CHI-0192',
  },
  // Suncoast Tiny Paws (k4 - Canine SA)
  {
    id: 'p8',
    kennelId: 'k4',
    name: 'Coco',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Chocolate',
    dob: '2025-12-15',
    price: 9500,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'Suncoast Tiny Titan',
      dam: 'Suncoast Lady Rosella',
      sireSire: 'Suncoast Champion Choc',
      sireDam: 'Tiny Caramel Dream',
      damSire: 'Suncoast Supreme',
      damDam: 'Rosella Lady KZN',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Gorgeous deep chocolate long coat female, beautifully socialised with children. Ready with full puppy pack: vaccinations, deworming, puppy food, vet card.',
    registrationNo: 'CSA-2025-CHI-3319',
  },
  {
    id: 'p9',
    kennelId: 'k4',
    name: 'Bruno',
    breed: 'Chihuahua',
    coatType: 'Smooth Coat',
    gender: 'Male',
    color: 'White',
    dob: '2025-12-15',
    price: 8500,
    sold: true,
    breedingRights: false,
    images: [
      'https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80',
    ],
    pedigree: {
      sire: 'Suncoast Tiny Titan',
      dam: 'Suncoast Lady Rosella',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Pure white smooth coat male — already in his new home.',
    registrationNo: 'CSA-2025-CHI-3320',
  },
  {
    id: 'p10',
    kennelId: 'k4',
    name: 'Pixie',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Cream',
    dob: '2026-01-20',
    price: 9800,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
    ],
    pedigree: {
      sire: 'Suncoast Tiny Prince',
      dam: 'Suncoast Cream Dream',
      sireSire: 'Suncoast Champion',
      sireDam: 'Tiny Princess Cream',
      damSire: 'Suncoast Gold Duke',
      damDam: 'Lady of the Shore',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Pale cream long coat female with the sweetest temperament. Ideal companion for families or seniors.',
    registrationNo: 'CSA-2026-CHI-0112',
  },
  // Joburg Miniature Palace (k5 - Canine SA)
  {
    id: 'p11',
    kennelId: 'k5',
    name: 'Bleu',
    breed: 'Chihuahua',
    coatType: 'Smooth Coat',
    gender: 'Male',
    color: 'Blue',
    dob: '2026-01-10',
    price: 28000,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1580560009589-cdfea7e01753?w=800&q=80',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
    ],
    pedigree: {
      sire: 'EUR CH Bleu de Paris',
      dam: 'Joburg Palace Diamond',
      sireSire: 'FRA CH Tres Magnifique',
      sireDam: "Bleu de Paris Belle",
      damSire: 'Palace Boss Joburg',
      damDam: 'Palace Princess Diamond',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Exceptional rare blue smooth coat male from champion European import sire. Deep slate-blue pigment, compact apple head, excellent conformation. Full Canine SA papers with five-generation pedigree.',
    registrationNo: 'CSA-2026-CHI-0534',
  },
  {
    id: 'p12',
    kennelId: 'k5',
    name: 'Lilac Rose',
    breed: 'Chihuahua',
    coatType: 'Long Coat',
    gender: 'Female',
    color: 'Lilac & Tan',
    dob: '2026-01-10',
    price: 32000,
    sold: false,
    breedingRights: true,
    images: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80',
      'https://images.unsplash.com/photo-1612195583950-b44b0f558e80?w=800&q=80',
    ],
    pedigree: {
      sire: 'EUR CH Bleu de Paris',
      dam: 'Joburg Palace Diamond',
      sireSire: 'FRA CH Tres Magnifique',
      sireDam: "Bleu de Paris Belle",
      damSire: 'Palace Boss Joburg',
      damDam: 'Palace Princess Diamond',
    },
    health: ['Inoculation Up to Date', 'Deworming Up to Date', 'Vet Checked & Certified'],
    description: 'Exceptionally rare lilac & tan long coat female — one of a kind colouring. Silky, full coat. Top European bloodlines.',
    registrationNo: 'CSA-2026-CHI-0535',
  },
]

export const sellers = [
  {
    id: 's1',
    email: 'info@littleroyalschis.co.za',
    password: 'seller123',
    name: 'Johan van der Berg',
    kennelId: 'k1',
    status: 'approved',
    joinedDate: '2024-01-15',
  },
  {
    id: 's2',
    email: 'breed@capeminiatura.co.za',
    password: 'seller123',
    name: 'Sandra Mitchell',
    kennelId: 'k2',
    status: 'approved',
    joinedDate: '2024-03-22',
  },
  {
    id: 's3',
    email: 'chis@pretorichis.co.za',
    password: 'seller123',
    name: 'Pieter Grobler',
    kennelId: 'k3',
    status: 'approved',
    joinedDate: '2024-06-10',
  },
  {
    id: 's4',
    email: 'incoming@newkennel.co.za',
    password: 'seller123',
    name: 'Thabo Nkosi',
    kennelId: null,
    status: 'pending_verification',
    joinedDate: '2026-04-28',
  },
  {
    id: 's5',
    email: 'dormant@sundownchis.co.za',
    password: 'seller123',
    name: 'Riaan Botha',
    kennelId: 'k_dormant',
    status: 'approved',
    joinedDate: '2025-04-10',
    warningDate: null,
  },
]

export const dormantKennel = {
  id: 'k_dormant',
  name: 'Sundown Chi Breeders',
  slug: 'sundown-chi-breeders',
  registry: 'Canine SA',
  initials: 'SCB',
  color: '#8B7355',
  description: 'Inactive kennel — no listings.',
  location: 'Bloemfontein, Free State',
  contact: 'dormant@sundownchis.co.za',
  phone: '+27 51 000 0000',
  membershipStatus: 'active',
  membershipExpiry: '2026-04-10',
  commission: 8,
  status: 'approved',
  referredBy: null,
  referralCode: null,
}

export const adminSettings = {
  defaultCommission: 8,
  membershipFeeAnnual: 1200,
  referralDiscount: 1.5,
  siteName: 'Chihuahua South Africa',
  tagline: 'South Africa\'s Premier Chihuahua Marketplace',
  adminBankName: '',
  adminAccountHolder: 'Chihuahua South Africa',
  adminAccountNumber: '',
  adminBranchCode: '',
  adminAccountType: 'Cheque / Current',
}

export const legalText = `# Chihuahua South Africa Marketplace — Terms & Conditions

**Last updated: April 2026**

## 1. Platform Overview

Chihuahua South Africa is an online marketplace exclusively for Chihuahua breeders, connecting KUSA and Canine SA registered kennels with prospective buyers across South Africa. All breeders listed on Chihuahua South Africa are verified by registry membership before listing approval is granted.

## 2. Breeder Responsibilities

All breeders (sellers) on the Chihuahua South Africa platform agree to:

- Maintain active membership with their respective registry (KUSA or Canine SA)
- Only list purebred Chihuahuas (Smooth Coat and Long Coat varieties)
- Provide accurate pedigree and health documentation for all listed puppies
- Only list puppies that are at least 8 weeks of age at time of availability date
- Ensure all listed puppies receive appropriate veterinary care, including first vaccinations and deworming
- Honour all sales made through the platform within the agreed timeframe
- Respond to buyer enquiries within 48 hours

## 3. Commission Structure

Chihuahua South Africa charges a commission on each completed sale. The commission percentage is disclosed to the seller before listing submission. The current standard commission rate is **8% of the sale price**. Certain premium kennels or rare-colour specialists may attract a different rate as agreed individually with Chihuahua South Africa.

Referral Discount: Sellers who refer another approved Chihuahua breeder to Chihuahua South Africa receive a **1.5% reduction in their commission rate** on all future sales, applied automatically upon the referred kennel's first sale.

## 4. Breed Standards

All puppies listed on Chihuahua South Africa must be Chihuahuas conforming to either the KUSA (FCI Standard No. 218) or Canine SA breed standard. This includes:
- Apple Head and Deer Head varieties
- Smooth Coat and Long Coat varieties
- All recognised Chihuahua colours and markings

Listings suspected of containing non-Chihuahua or mixed-breed puppies will be immediately removed.

## 5. Buyer Protections

All purchases through Chihuahua South Africa are protected by verified breeder credentials, documented pedigree papers, health guarantee disclosures, and our dispute resolution process.

## 6. Payment & Collection

Payment is processed securely through the Chihuahua South Africa platform. After purchase confirmation, the buyer and seller are directly connected to arrange collection or transport.

Sellers receive payment within **3 business days** of confirmed delivery/collection, less the applicable commission.

## 7. Membership Terms

Breeder memberships are annual. A reminder email will be sent 30 days before expiry. Breeders whose membership has lapsed may not list new puppies until renewal is completed.

## 8. Governing Law

These terms are governed by the laws of the Republic of South Africa.`
