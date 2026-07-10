import { BuilderProject, DesignItem, ProjectMessage, BuilderPayment, PaymentStage, Invoice } from '../components/BuilderProjectManagement';

// Test Data for TradePro Multi-Trade Platform
// This file contains comprehensive realistic test data for all features

// ===== BUILDERS =====
export const testBuilders = [
  {
    id: 'B001',
    name: 'Mike Wilson',
    email: 'mike.wilson@company.com',
    phone: '07700 900123',
    specialties: ['Microcement', 'Tiling', 'Waterproofing'],
    status: 'active' as const,
    joinedDate: '2024-01-15',
    defaultPaymentType: 'price_work' as const,
    dayRate: 250,
    color: '#3b82f6' // blue
  },
  {
    id: 'B002',
    name: 'Tom Richards',
    email: 'tom.richards@company.com',
    phone: '07700 900456',
    specialties: ['Plumbing', 'Bathroom Fitting', 'Tiling'],
    status: 'active' as const,
    joinedDate: '2024-03-20',
    defaultPaymentType: 'day_rate' as const,
    dayRate: 280,
    color: '#10b981' // green
  },
  {
    id: 'B003',
    name: 'Dave Collins',
    email: 'dave.collins@company.com',
    phone: '07700 900789',
    specialties: ['Carpentry', 'Tiling', 'General Building'],
    status: 'active' as const,
    joinedDate: '2023-11-10',
    defaultPaymentType: 'price_work' as const,
    dayRate: 240,
    color: '#f59e0b' // amber
  },
  {
    id: 'B004',
    name: 'Steve Parker',
    email: 'steve.parker@company.com',
    phone: '07700 901234',
    specialties: ['Microcement', 'Luxury Bathrooms', 'Wetrooms'],
    status: 'active' as const,
    joinedDate: '2023-08-05',
    defaultPaymentType: 'price_work' as const,
    dayRate: 260,
    color: '#8b5cf6' // purple
  },
  {
    id: 'B005',
    name: 'Chris Morgan',
    email: 'chris.morgan@company.com',
    phone: '07700 901567',
    specialties: ['Tiling', 'Plumbing', 'Electrical'],
    status: 'active' as const,
    joinedDate: '2024-02-12',
    defaultPaymentType: 'day_rate' as const,
    dayRate: 245,
    color: '#ec4899' // pink
  },
  {
    id: 'B006',
    name: 'Gary Thompson',
    email: 'gary.thompson@company.com',
    phone: '07700 902345',
    specialties: ['Waterproofing', 'Tiling', 'General Building'],
    status: 'active' as const,
    joinedDate: '2023-06-20',
    defaultPaymentType: 'price_work' as const,
    dayRate: 235,
    color: '#f97316' // orange
  },
  {
    id: 'B007',
    name: 'Mark Stevens',
    email: 'mark.stevens@company.com',
    phone: '07700 903456',
    specialties: ['Microcement', 'Polished Concrete', 'Modern Finishes'],
    status: 'active' as const,
    joinedDate: '2024-04-10',
    defaultPaymentType: 'price_work' as const,
    dayRate: 270,
    color: '#06b6d4' // cyan
  },
  {
    id: 'B008',
    name: 'Paul Henderson',
    email: 'paul.henderson@company.com',
    phone: '07700 904567',
    specialties: ['Traditional Bathrooms', 'Tiling', 'Plumbing'],
    status: 'active' as const,
    joinedDate: '2023-09-15',
    defaultPaymentType: 'day_rate' as const,
    dayRate: 255,
    color: '#84cc16' // lime
  }
];

// ===== CUSTOMERS =====
export const testCustomers = [
  {
    id: 'C001',
    name: 'Emma Clarke',
    email: 'emma.clarke@email.com',
    phone: '07934 567890',
    address: '156 High Street, Birmingham, B4 7SL',
    status: 'won' as const,
    createdAt: '2026-04-10',
    photos: [],
    notes: 'Paid deposit £500. Installation starts 1st May. White microcement.'
  },
  {
    id: 'C002',
    name: 'Daniel White',
    email: 'daniel.white@email.com',
    phone: '07901 234567',
    address: '78 Hill View, Sheffield, S10 3GE',
    status: 'won' as const,
    createdAt: '2026-04-08',
    photos: [],
    notes: 'Repeat customer. Main bathroom. Total £15,800. Deposit paid.'
  },
  {
    id: 'C003',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '07712 345678',
    address: '42 Richmond Road, London, SW15 2TQ',
    status: 'won' as const,
    createdAt: '2026-04-15',
    photos: [],
    notes: 'Ensuite bathroom refresh. Completed April 2026.'
  },
  {
    id: 'C004',
    name: 'James Wilson',
    email: 'james.wilson@email.com',
    phone: '07823 456789',
    address: '23 Park Lane, Manchester, M1 4BT',
    status: 'won' as const,
    createdAt: '2026-04-20',
    photos: [],
    notes: 'Modern bathroom with matte black theme. Started May 2026.'
  },
  {
    id: 'C005',
    name: 'Sophie Anderson',
    email: 'sophie.a@email.com',
    phone: '07856 789012',
    address: '91 Castle Street, Edinburgh, EH1 2ND',
    status: 'won' as const,
    createdAt: '2026-04-18',
    photos: [],
    notes: 'Contemporary ensuite with microcement.'
  },
  {
    id: 'C006',
    name: 'Michael Brown',
    email: 'michael.b@email.com',
    phone: '07967 890123',
    address: '67 Station Road, Newcastle upon Tyne, NE1 3DX',
    status: 'won' as const,
    createdAt: '2026-05-01',
    photos: [],
    notes: 'Family bathroom with wood effect tiles.'
  },
  {
    id: 'C007',
    name: 'Robert Davis',
    email: 'robert.davis@email.com',
    phone: '07678 901234',
    address: '34 Queens Road, Liverpool, L1 1RG',
    status: 'won' as const,
    createdAt: '2026-04-28',
    photos: [],
    notes: 'Luxury master bathroom with freestanding bath.'
  },
  {
    id: 'C008',
    name: 'Lisa Taylor',
    email: 'lisa.taylor@email.com',
    phone: '07789 012345',
    address: '89 Hill View, Sheffield, S1 2GH',
    status: 'won' as const,
    createdAt: '2026-05-03',
    photos: [],
    notes: 'Contemporary bathroom with classic metro tiles.'
  },
  {
    id: 'C009',
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    phone: '07890 123456',
    address: '12 Victoria Place, Cardiff, CF10 3BH',
    status: 'won' as const,
    createdAt: '2026-04-29',
    photos: [],
    notes: 'Industrial-style bathroom with concrete effect.'
  },
  {
    id: 'C010',
    name: 'Amanda Peterson',
    email: 'amanda.peterson@email.com',
    phone: '07901 345678',
    address: '25 Garden Lane, Bristol, BS8 2PL',
    status: 'won' as const,
    createdAt: '2026-04-15',
    photos: [],
    notes: 'Luxury en-suite with pearl microcement and gold fixtures.'
  },
  {
    id: 'C011',
    name: 'Thomas Mitchell',
    email: 'thomas.mitchell@email.com',
    phone: '07912 456789',
    address: '88 Kings Road, Brighton, BN1 2PF',
    status: 'won' as const,
    createdAt: '2026-03-20',
    photos: [],
    notes: 'Complete bathroom renovation. Victorian property.'
  },
  {
    id: 'C012',
    name: 'Rachel Hughes',
    email: 'rachel.hughes@email.com',
    phone: '07923 567890',
    address: '15 Church Street, Cambridge, CB1 1DG',
    status: 'won' as const,
    createdAt: '2026-03-15',
    photos: [],
    notes: 'Wetroom conversion with luxury finishes.'
  },
  {
    id: 'C013',
    name: 'Christopher Lee',
    email: 'chris.lee@email.com',
    phone: '07934 678901',
    address: '52 Market Place, Nottingham, NG1 6HX',
    status: 'won' as const,
    createdAt: '2026-05-10',
    photos: [],
    notes: 'Master bathroom suite with separate shower.'
  },
  {
    id: 'C014',
    name: 'Jennifer Moore',
    email: 'jen.moore@email.com',
    phone: '07945 789012',
    address: '71 Forest Road, Oxford, OX2 6JQ',
    status: 'quoted' as const,
    createdAt: '2026-05-15',
    photos: [],
    notes: 'Quote sent for ensuite conversion. Awaiting decision.'
  },
  {
    id: 'C015',
    name: 'Peter Walker',
    email: 'peter.walker@email.com',
    phone: '07956 890123',
    address: '39 Abbey Lane, Leicester, LE1 3WS',
    status: 'won' as const,
    createdAt: '2026-04-05',
    photos: [],
    notes: 'Small bathroom refurbishment completed.'
  }
];

// ===== STAFF MEMBERS =====
export const testSalesStaff = [
  {
    id: 'S001',
    name: 'Emily Roberts',
    email: 'emily.roberts@bathroompo.com',
    phone: '07700 800001',
    role: 'staff' as const,
    department: 'Sales',
    joinedDate: '2024-01-10',
    status: 'active' as const,
    performance: { leads: 42, quotes: 30, won: 16, lost: 8, pending: 6, revenue: 112000, conversionRate: 53.3, avgDealSize: 7000 },
  },
  {
    id: 'S002',
    name: 'Jack Thompson',
    email: 'jack.thompson@bathroompo.com',
    phone: '07700 800002',
    role: 'staff' as const,
    department: 'Sales',
    joinedDate: '2024-03-15',
    status: 'active' as const,
    performance: { leads: 38, quotes: 28, won: 15, lost: 9, pending: 4, revenue: 98000, conversionRate: 53.6, avgDealSize: 6533 },
  },
  {
    id: 'S003',
    name: 'Hannah Wilson',
    email: 'hannah.wilson@bathroompo.com',
    phone: '07700 800003',
    role: 'staff' as const,
    department: 'Sales',
    joinedDate: '2023-11-20',
    status: 'active' as const,
    performance: { leads: 35, quotes: 26, won: 14, lost: 7, pending: 5, revenue: 91000, conversionRate: 53.8, avgDealSize: 6500 },
  },
  {
    id: 'S004',
    name: 'Oliver Davies',
    email: 'oliver.davies@bathroompo.com',
    phone: '07700 800004',
    role: 'staff' as const,
    department: 'Sales',
    joinedDate: '2024-02-05',
    status: 'active' as const,
    performance: { leads: 29, quotes: 22, won: 11, lost: 7, pending: 4, revenue: 76000, conversionRate: 50.0, avgDealSize: 6909 },
  },
  {
    id: 'S005',
    name: 'Charlotte Evans',
    email: 'charlotte.evans@bathroompo.com',
    phone: '07700 800005',
    role: 'staff' as const,
    department: 'Sales',
    joinedDate: '2024-04-12',
    status: 'active' as const,
    performance: { leads: 31, quotes: 24, won: 13, lost: 6, pending: 5, revenue: 88000, conversionRate: 54.2, avgDealSize: 6769 },
  },
  {
    id: 'S006',
    name: 'George Harris',
    email: 'george.harris@bathroompo.com',
    phone: '07700 800006',
    role: 'staff' as const,
    department: 'Operations',
    joinedDate: '2023-09-08',
    status: 'active' as const,
    performance: { leads: 22, quotes: 18, won: 9, lost: 5, pending: 4, revenue: 62000, conversionRate: 50.0, avgDealSize: 6889 },
  }
];

export const testManagers = [
  {
    id: 'M001',
    name: 'John Smith',
    email: 'john.smith@bathroompo.com',
    phone: '07700 700001',
    role: 'manager' as const,
    department: 'Sales',
    joinedDate: '2023-01-05',
    status: 'active' as const,
    performance: { leads: 45, quotes: 32, won: 18, lost: 8, pending: 6, revenue: 125000, conversionRate: 56.3, avgDealSize: 6944 },
  },
  {
    id: 'M002',
    name: 'Victoria Palmer',
    email: 'victoria.palmer@bathroompo.com',
    phone: '07700 700002',
    role: 'manager' as const,
    department: 'Operations',
    joinedDate: '2023-03-12',
    status: 'active' as const,
    performance: { leads: 28, quotes: 20, won: 12, lost: 5, pending: 3, revenue: 89000, conversionRate: 60.0, avgDealSize: 7417 },
  },
  {
    id: 'M003',
    name: 'Andrew Clarke',
    email: 'andrew.clarke@bathroompo.com',
    phone: '07700 700003',
    role: 'manager' as const,
    department: 'Projects',
    joinedDate: '2023-06-20',
    status: 'active' as const,
    performance: { leads: 18, quotes: 14, won: 8, lost: 4, pending: 2, revenue: 72000, conversionRate: 57.1, avgDealSize: 9000 },
  }
];

export const testRecruitmentStaff = [
  {
    id: 'R001',
    name: 'Rebecca Martinez',
    email: 'rebecca.martinez@bathroompo.com',
    phone: '07700 600001',
    role: 'recruitment' as const,
    department: 'HR',
    joinedDate: '2024-02-01',
    status: 'active' as const
  },
  {
    id: 'R002',
    name: 'David Anderson',
    email: 'david.anderson@bathroompo.com',
    phone: '07700 600002',
    role: 'recruitment' as const,
    department: 'HR',
    joinedDate: '2024-03-18',
    status: 'active' as const
  }
];

// ===== PROJECTS =====
export const testProjects: BuilderProject[] = [
  // COMPLETED PROJECTS (5)
  {
    id: 'P001',
    customerId: 'C003',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@email.com',
    address: '42 Richmond Road, London, SW15 2TQ',
    startDate: '2026-04-15',
    finishDate: '2026-04-25',
    status: 'completed',
    designItems: [
      {
        id: 'D001',
        category: 'tile',
        name: 'White Metro Tiles',
        description: 'Classic white metro tiles 150x75mm with bevelled edge',
        photo: 'white_metro.jpg',
        supplier: 'Tile Giant',
        cost: 580
      },
      {
        id: 'D002',
        category: 'fixture',
        name: 'Chrome Rain Shower',
        description: '250mm chrome rainfall shower head with handheld',
        photo: 'chrome_shower.jpg',
        supplier: 'Victoria Plumb',
        cost: 320
      },
      {
        id: 'D003',
        category: 'fixture',
        name: 'Wall Hung Toilet',
        description: 'Modern wall-mounted toilet with soft-close seat',
        photo: 'wall_toilet.jpg',
        supplier: 'Bathroom City',
        cost: 450
      },
      {
        id: 'D004',
        category: 'accessory',
        name: 'Chrome Towel Rail',
        description: 'Heated chrome towel rail 600x800mm',
        photo: 'towel_rail.jpg',
        supplier: 'Screwfix',
        cost: 180
      }
    ],
    messages: [
      {
        id: 'MSG001',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your project is confirmed to start on 15th April. All materials have been ordered and will be delivered on 14th April.',
        timestamp: '2026-04-10T09:30:00',
        emailSent: true
      },
      {
        id: 'MSG002',
        from: 'Sarah Johnson',
        fromRole: 'customer',
        message: 'Perfect, thank you! Looking forward to it.',
        timestamp: '2026-04-10T14:20:00',
        emailSent: false
      },
      {
        id: 'MSG003',
        from: 'Mike Wilson',
        fromRole: 'builder',
        message: 'Started today! Old bathroom stripped out completely. Waterproofing tomorrow.',
        timestamp: '2026-04-15T17:00:00',
        emailSent: true
      },
      {
        id: 'MSG004',
        from: 'Mike Wilson',
        fromRole: 'builder',
        message: 'Waterproofing complete and tested. Tiling starts tomorrow morning.',
        timestamp: '2026-04-18T16:45:00',
        emailSent: true
      },
      {
        id: 'MSG005',
        from: 'Sarah Johnson',
        fromRole: 'customer',
        message: 'Looking great! The tiles are perfect.',
        timestamp: '2026-04-20T19:30:00',
        emailSent: false
      },
      {
        id: 'MSG006',
        from: 'Mike Wilson',
        fromRole: 'builder',
        message: 'Project complete! All fixtures installed and tested. Please check everything is to your satisfaction.',
        timestamp: '2026-04-25T15:00:00',
        emailSent: true
      },
      {
        id: 'MSG007',
        from: 'Sarah Johnson',
        fromRole: 'customer',
        message: 'Absolutely love it! Thank you so much for the excellent work.',
        timestamp: '2026-04-26T09:00:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B001',
        builderName: 'Mike Wilson',
        paymentType: 'day_rate',
        dayRate: 250,
        daysWorked: 8,
        totalEarned: 2000,
        status: 'paid'
      }
    ],
    paymentStages: [
      {
        id: 'PS001',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 840,
        status: 'paid',
        paidDate: '2026-04-08',
        description: 'Initial deposit to secure project date'
      },
      {
        id: 'PS002',
        name: 'Project Start',
        percentage: 40,
        amount: 2240,
        status: 'paid',
        paidDate: '2026-04-15',
        description: 'Payment on project commencement'
      },
      {
        id: 'PS003',
        name: 'Final Payment',
        percentage: 45,
        amount: 2520,
        status: 'paid',
        paidDate: '2026-04-25',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV001',
        projectId: 'P001',
        type: 'customer',
        amount: 5600,
        issueDate: '2026-04-08',
        dueDate: '2026-04-25',
        paidDate: '2026-04-25',
        status: 'paid'
      }
    ],
    totalCustomerCost: 5600,
    photos: ['p001_before.jpg', 'p001_demo.jpg', 'p001_waterproof.jpg', 'p001_tiling.jpg', 'p001_final1.jpg', 'p001_final2.jpg'],
    description: 'Ensuite bathroom refresh with new shower, metro tiles, and modern fixtures.',
    assignedBuilder: 'Mike Wilson'
  },
  {
    id: 'P002',
    customerId: 'C011',
    customerName: 'Thomas Mitchell',
    customerEmail: 'thomas.mitchell@email.com',
    address: '88 Kings Road, Brighton, BN1 2PF',
    startDate: '2026-04-01',
    finishDate: '2026-04-18',
    status: 'completed',
    designItems: [
      {
        id: 'D005',
        category: 'finish',
        name: 'Sage Green Microcement',
        description: 'Luxury sage green seamless microcement for walls',
        photo: 'sage_microcement.jpg',
        supplier: 'Luxury Finishes Ltd',
        cost: 2800
      },
      {
        id: 'D006',
        category: 'fixture',
        name: 'Victorian Style Suite',
        description: 'Traditional high-level cistern toilet and pedestal basin',
        photo: 'victorian_suite.jpg',
        supplier: 'Heritage Bathrooms',
        cost: 1450
      },
      {
        id: 'D007',
        category: 'fixture',
        name: 'Clawfoot Bath',
        description: 'Cast iron roll-top bath with brass feet',
        photo: 'clawfoot_bath.jpg',
        supplier: 'Heritage Bathrooms',
        cost: 2200
      },
      {
        id: 'D008',
        category: 'accessory',
        name: 'Brass Bathroom Accessories',
        description: 'Complete brass accessory set - towel rails, robe hook, toilet roll holder',
        photo: 'brass_accessories.jpg',
        supplier: 'Period Living',
        cost: 380
      }
    ],
    messages: [
      {
        id: 'MSG008',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Project scheduled for 1st April. Heritage bathroom suite has been specially ordered and will arrive on 28th March.',
        timestamp: '2026-03-25T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG009',
        from: 'Thomas Mitchell',
        fromRole: 'customer',
        message: 'Great! Really excited to see the Victorian style come together.',
        timestamp: '2026-03-25T15:30:00',
        emailSent: false
      },
      {
        id: 'MSG010',
        from: 'Gary Thompson',
        fromRole: 'builder',
        message: 'Day 1 complete. Existing bathroom removed. Victorian property so extra care taken with plasterwork.',
        timestamp: '2026-04-01T18:00:00',
        emailSent: true
      },
      {
        id: 'MSG011',
        from: 'Gary Thompson',
        fromRole: 'builder',
        message: 'Microcement walls looking stunning! The sage green is beautiful. Bath installed tomorrow.',
        timestamp: '2026-04-10T17:30:00',
        emailSent: true
      },
      {
        id: 'MSG012',
        from: 'Thomas Mitchell',
        fromRole: 'customer',
        message: 'Just saw the progress - absolutely amazing! Better than I imagined.',
        timestamp: '2026-04-10T19:00:00',
        emailSent: false
      },
      {
        id: 'MSG013',
        from: 'Gary Thompson',
        fromRole: 'builder',
        message: 'All complete! The clawfoot bath looks perfect against the sage microcement. Ready for your inspection.',
        timestamp: '2026-04-18T16:00:00',
        emailSent: true
      },
      {
        id: 'MSG014',
        from: 'Thomas Mitchell',
        fromRole: 'customer',
        message: 'Inspected today - it\'s absolutely perfect! Thank you for the exceptional work.',
        timestamp: '2026-04-19T10:30:00',
        emailSent: false
      },
      {
        id: 'MSG015',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Thank you for your final payment. We\'d love to feature your bathroom in our portfolio if you\'re happy?',
        timestamp: '2026-04-20T11:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B006',
        builderName: 'Gary Thompson',
        paymentType: 'price_work',
        agreedAmount: 5200,
        totalEarned: 5200,
        status: 'paid'
      }
    ],
    paymentStages: [
      {
        id: 'PS004',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 1935,
        status: 'paid',
        paidDate: '2026-03-20',
        description: 'Deposit to secure project and order materials'
      },
      {
        id: 'PS005',
        name: 'Project Start',
        percentage: 40,
        amount: 5160,
        status: 'paid',
        paidDate: '2026-04-01',
        description: 'Payment on project start'
      },
      {
        id: 'PS006',
        name: 'Mid-Project',
        percentage: 25,
        amount: 3225,
        status: 'paid',
        paidDate: '2026-04-10',
        description: 'Payment at 50% completion'
      },
      {
        id: 'PS007',
        name: 'Final Payment',
        percentage: 20,
        amount: 2580,
        status: 'paid',
        paidDate: '2026-04-18',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV002',
        projectId: 'P002',
        type: 'customer',
        amount: 12900,
        issueDate: '2026-03-20',
        dueDate: '2026-04-18',
        paidDate: '2026-04-18',
        status: 'paid'
      }
    ],
    totalCustomerCost: 12900,
    photos: ['p002_before.jpg', 'p002_demo.jpg', 'p002_microcement1.jpg', 'p002_microcement2.jpg', 'p002_bath_install.jpg', 'p002_final1.jpg', 'p002_final2.jpg', 'p002_final3.jpg'],
    description: 'Complete Victorian bathroom renovation with sage microcement, clawfoot bath, and heritage fittings.',
    assignedBuilder: 'Gary Thompson'
  },
  {
    id: 'P003',
    customerId: 'C012',
    customerName: 'Rachel Hughes',
    customerEmail: 'rachel.hughes@email.com',
    address: '15 Church Street, Cambridge, CB1 1DG',
    startDate: '2026-03-25',
    finishDate: '2026-04-12',
    status: 'completed',
    designItems: [
      {
        id: 'D009',
        category: 'finish',
        name: 'Polished Concrete Microcement',
        description: 'Industrial polished concrete effect microcement',
        photo: 'concrete_microcement.jpg',
        supplier: 'Urban Finishes',
        cost: 3200
      },
      {
        id: 'D010',
        category: 'fixture',
        name: 'Linear Wetroom Drain',
        description: 'Stainless steel linear drain 1500mm for wetroom',
        photo: 'linear_drain.jpg',
        supplier: 'Wetroom Solutions',
        cost: 680
      },
      {
        id: 'D011',
        category: 'fixture',
        name: 'Frameless Glass Screen',
        description: 'Walk-in frameless glass screen 1400mm',
        photo: 'glass_screen.jpg',
        supplier: 'Premium Glass',
        cost: 1950
      },
      {
        id: 'D012',
        category: 'fixture',
        name: 'Black Matte Fixtures',
        description: 'Complete black matte bathroom fixture set',
        photo: 'black_fixtures.jpg',
        supplier: 'Modern Bathrooms',
        cost: 1420
      },
      {
        id: 'D013',
        category: 'accessory',
        name: 'Underfloor Heating',
        description: 'Electric underfloor heating system 8sqm',
        photo: 'ufh.jpg',
        supplier: 'Warmup',
        cost: 890
      }
    ],
    messages: [
      {
        id: 'MSG016',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your wetroom project is confirmed to start 25th March. This is a specialist job requiring expert waterproofing.',
        timestamp: '2026-03-18T09:00:00',
        emailSent: true
      },
      {
        id: 'MSG017',
        from: 'Rachel Hughes',
        fromRole: 'customer',
        message: 'Thank you. I understand it\'s a complex project. Looking forward to the result!',
        timestamp: '2026-03-18T11:30:00',
        emailSent: false
      },
      {
        id: 'MSG018',
        from: 'Mark Stevens',
        fromRole: 'builder',
        message: 'Started today. Floor tanking system being installed. This is critical for wetroom - taking extra time to ensure perfection.',
        timestamp: '2026-03-25T17:30:00',
        emailSent: true
      },
      {
        id: 'MSG019',
        from: 'Mark Stevens',
        fromRole: 'builder',
        message: 'Waterproofing complete and flood tested for 24 hours - all perfect. Underfloor heating installed. Microcement application starts tomorrow.',
        timestamp: '2026-03-29T16:00:00',
        emailSent: true
      },
      {
        id: 'MSG020',
        from: 'Rachel Hughes',
        fromRole: 'customer',
        message: 'Excellent! Really appreciate the thoroughness.',
        timestamp: '2026-03-29T18:20:00',
        emailSent: false
      },
      {
        id: 'MSG021',
        from: 'Mark Stevens',
        fromRole: 'builder',
        message: 'Microcement looking stunning! The polished concrete effect is exactly what you wanted. Glass screen installed tomorrow.',
        timestamp: '2026-04-05T17:15:00',
        emailSent: true
      },
      {
        id: 'MSG022',
        from: 'Mark Stevens',
        fromRole: 'builder',
        message: 'Project complete! All fixtures installed, wetroom fully tested and functional. Ready for final inspection.',
        timestamp: '2026-04-12T15:30:00',
        emailSent: true
      },
      {
        id: 'MSG023',
        from: 'Rachel Hughes',
        fromRole: 'customer',
        message: 'Inspected this morning - it\'s absolutely spectacular! The quality of work is outstanding. Thank you!',
        timestamp: '2026-04-13T10:00:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B007',
        builderName: 'Mark Stevens',
        paymentType: 'price_work',
        agreedAmount: 6800,
        totalEarned: 6800,
        status: 'paid'
      }
    ],
    paymentStages: [
      {
        id: 'PS008',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 2430,
        status: 'paid',
        paidDate: '2026-03-15',
        description: 'Deposit for wetroom conversion'
      },
      {
        id: 'PS009',
        name: 'Project Start',
        percentage: 35,
        amount: 5670,
        status: 'paid',
        paidDate: '2026-03-25',
        description: 'Payment on project commencement'
      },
      {
        id: 'PS010',
        name: 'Mid-Project',
        percentage: 30,
        amount: 4860,
        status: 'paid',
        paidDate: '2026-04-05',
        description: 'Payment at waterproofing completion'
      },
      {
        id: 'PS011',
        name: 'Final Payment',
        percentage: 20,
        amount: 3240,
        status: 'paid',
        paidDate: '2026-04-12',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV003',
        projectId: 'P003',
        type: 'customer',
        amount: 16200,
        issueDate: '2026-03-15',
        dueDate: '2026-04-12',
        paidDate: '2026-04-12',
        status: 'paid'
      }
    ],
    totalCustomerCost: 16200,
    photos: ['p003_before.jpg', 'p003_tanking.jpg', 'p003_ufh.jpg', 'p003_microcement.jpg', 'p003_glass.jpg', 'p003_final1.jpg', 'p003_final2.jpg'],
    description: 'Luxury wetroom conversion with polished concrete microcement, frameless glass, and black matte fixtures.',
    assignedBuilder: 'Mark Stevens'
  },
  {
    id: 'P004',
    customerId: 'C015',
    customerName: 'Peter Walker',
    customerEmail: 'peter.walker@email.com',
    address: '39 Abbey Lane, Leicester, LE1 3WS',
    startDate: '2026-04-05',
    finishDate: '2026-04-16',
    status: 'completed',
    designItems: [
      {
        id: 'D014',
        category: 'tile',
        name: 'Blue Patterned Tiles',
        description: 'Moroccan blue patterned floor tiles 200x200mm',
        photo: 'blue_pattern_tiles.jpg',
        supplier: 'Tile Mountain',
        cost: 720
      },
      {
        id: 'D015',
        category: 'tile',
        name: 'White Gloss Wall Tiles',
        description: 'White gloss ceramic wall tiles 300x600mm',
        photo: 'white_gloss.jpg',
        supplier: 'Tile Mountain',
        cost: 480
      },
      {
        id: 'D016',
        category: 'fixture',
        name: 'Compact Bathroom Suite',
        description: 'Space-saving toilet, basin and shower for small bathroom',
        photo: 'compact_suite.jpg',
        supplier: 'Small Bathroom Co',
        cost: 850
      }
    ],
    messages: [
      {
        id: 'MSG024',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your small bathroom refurbishment starts 5th April. Patterned tiles ordered and look beautiful!',
        timestamp: '2026-03-30T10:30:00',
        emailSent: true
      },
      {
        id: 'MSG025',
        from: 'Paul Henderson',
        fromRole: 'builder',
        message: 'Day 1 done. Old suite removed. Plumbing updated ready for new compact suite.',
        timestamp: '2026-04-05T16:30:00',
        emailSent: true
      },
      {
        id: 'MSG026',
        from: 'Paul Henderson',
        fromRole: 'builder',
        message: 'Wall tiling complete. Floor tiles going down tomorrow - they look fantastic!',
        timestamp: '2026-04-10T17:00:00',
        emailSent: true
      },
      {
        id: 'MSG027',
        from: 'Peter Walker',
        fromRole: 'customer',
        message: 'Just popped in to see - the blue pattern tiles are stunning!',
        timestamp: '2026-04-11T19:00:00',
        emailSent: false
      },
      {
        id: 'MSG028',
        from: 'Paul Henderson',
        fromRole: 'builder',
        message: 'All finished! Compact suite installed and working perfectly. Grouting dried and bathroom ready to use.',
        timestamp: '2026-04-16T15:00:00',
        emailSent: true
      },
      {
        id: 'MSG029',
        from: 'Peter Walker',
        fromRole: 'customer',
        message: 'Perfect job! You\'ve made the small space work brilliantly. Very happy!',
        timestamp: '2026-04-17T09:30:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B008',
        builderName: 'Paul Henderson',
        paymentType: 'day_rate',
        dayRate: 255,
        daysWorked: 9,
        totalEarned: 2295,
        status: 'paid'
      }
    ],
    paymentStages: [
      {
        id: 'PS012',
        name: 'Deposit',
        percentage: 20,
        amount: 880,
        status: 'paid',
        paidDate: '2026-04-02',
        description: 'Deposit payment'
      },
      {
        id: 'PS013',
        name: 'Final Payment',
        percentage: 80,
        amount: 3520,
        status: 'paid',
        paidDate: '2026-04-16',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV004',
        projectId: 'P004',
        type: 'customer',
        amount: 4400,
        issueDate: '2026-04-02',
        dueDate: '2026-04-16',
        paidDate: '2026-04-16',
        status: 'paid'
      }
    ],
    totalCustomerCost: 4400,
    photos: ['p004_before.jpg', 'p004_demo.jpg', 'p004_tiling.jpg', 'p004_final1.jpg', 'p004_final2.jpg'],
    description: 'Small bathroom refurbishment with blue patterned floor tiles and compact suite.',
    assignedBuilder: 'Paul Henderson'
  },
  {
    id: 'P005',
    customerId: 'C002',
    customerName: 'Daniel White',
    customerEmail: 'daniel.white@email.com',
    address: '78 Hill View, Sheffield, S10 3GE',
    startDate: '2026-03-18',
    finishDate: '2026-04-08',
    status: 'completed',
    designItems: [
      {
        id: 'D017',
        category: 'tile',
        name: 'Grey Marble Effect Tiles',
        description: 'Large format 600x1200mm grey marble porcelain tiles',
        photo: 'grey_marble.jpg',
        supplier: 'Tile Warehouse',
        cost: 1800
      },
      {
        id: 'D018',
        category: 'fixture',
        name: 'Freestanding Bath',
        description: 'Modern freestanding bath 1700mm with floor filler tap',
        photo: 'freestanding.jpg',
        supplier: 'Premium Bathrooms',
        cost: 2400
      },
      {
        id: 'D019',
        category: 'fixture',
        name: 'Dual Shower System',
        description: 'Thermostatic shower system with overhead and handheld',
        photo: 'dual_shower.jpg',
        supplier: 'Premium Bathrooms',
        cost: 980
      },
      {
        id: 'D020',
        category: 'fixture',
        name: 'Double Vanity Unit',
        description: 'Wall-mounted double vanity 1400mm in grey oak',
        photo: 'double_vanity.jpg',
        supplier: 'Furniture Bathrooms',
        cost: 1850
      },
      {
        id: 'D021',
        category: 'accessory',
        name: 'Chrome Accessories Set',
        description: 'Complete chrome bathroom accessory set',
        photo: 'chrome_accessories.jpg',
        supplier: 'Accessory World',
        cost: 320
      }
    ],
    messages: [
      {
        id: 'MSG030',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Welcome back Daniel! Your main bathroom project starts 18th March. Freestanding bath and marble tiles ordered.',
        timestamp: '2026-03-10T09:00:00',
        emailSent: true
      },
      {
        id: 'MSG031',
        from: 'Daniel White',
        fromRole: 'customer',
        message: 'Thanks! Always happy with your work. Looking forward to this one!',
        timestamp: '2026-03-10T14:00:00',
        emailSent: false
      },
      {
        id: 'MSG032',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'Day 1 complete. Full strip-out done. Plumbing first fix tomorrow.',
        timestamp: '2026-03-18T18:00:00',
        emailSent: true
      },
      {
        id: 'MSG033',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'Large format tiles going up beautifully. The marble effect is stunning - you\'ll love it!',
        timestamp: '2026-03-25T17:30:00',
        emailSent: true
      },
      {
        id: 'MSG034',
        from: 'Daniel White',
        fromRole: 'customer',
        message: 'Just had a look - incredible! The tiles are even better than the samples.',
        timestamp: '2026-03-26T19:00:00',
        emailSent: false
      },
      {
        id: 'MSG035',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'Freestanding bath installed today. Looks amazing against the marble tiles! Double vanity going in tomorrow.',
        timestamp: '2026-04-02T16:45:00',
        emailSent: true
      },
      {
        id: 'MSG036',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'All complete! Everything installed, tested and ready. One of my favourite projects!',
        timestamp: '2026-04-08T15:00:00',
        emailSent: true
      },
      {
        id: 'MSG037',
        from: 'Daniel White',
        fromRole: 'customer',
        message: 'Absolutely outstanding work! It\'s like a luxury hotel bathroom. Will definitely be using you again!',
        timestamp: '2026-04-09T10:00:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B002',
        builderName: 'Tom Richards',
        paymentType: 'price_work',
        agreedAmount: 6200,
        totalEarned: 6200,
        status: 'paid'
      }
    ],
    paymentStages: [
      {
        id: 'PS014',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 2370,
        status: 'paid',
        paidDate: '2026-03-08',
        description: 'Deposit to secure project'
      },
      {
        id: 'PS015',
        name: 'Project Start',
        percentage: 40,
        amount: 6320,
        status: 'paid',
        paidDate: '2026-03-18',
        description: 'Payment on start'
      },
      {
        id: 'PS016',
        name: 'Mid-Project',
        percentage: 25,
        amount: 3950,
        status: 'paid',
        paidDate: '2026-03-28',
        description: 'Mid-project payment'
      },
      {
        id: 'PS017',
        name: 'Final Payment',
        percentage: 20,
        amount: 3160,
        status: 'paid',
        paidDate: '2026-04-08',
        description: 'Final payment'
      }
    ],
    invoices: [
      {
        id: 'INV005',
        projectId: 'P005',
        type: 'customer',
        amount: 15800,
        issueDate: '2026-03-08',
        dueDate: '2026-04-08',
        paidDate: '2026-04-08',
        status: 'paid'
      }
    ],
    totalCustomerCost: 15800,
    photos: ['p005_before.jpg', 'p005_demo.jpg', 'p005_first_fix.jpg', 'p005_tiling1.jpg', 'p005_tiling2.jpg', 'p005_bath.jpg', 'p005_vanity.jpg', 'p005_final1.jpg', 'p005_final2.jpg', 'p005_final3.jpg'],
    description: 'Luxury main bathroom with grey marble tiles, freestanding bath, dual shower, and double vanity.',
    assignedBuilder: 'Tom Richards'
  },

  // IN PROGRESS PROJECTS (7)
  {
    id: 'P006',
    customerId: 'C001',
    customerName: 'Emma Clarke',
    customerEmail: 'emma.clarke@email.com',
    address: '156 High Street, Birmingham, B4 7SL',
    startDate: '2026-05-01',
    finishDate: '2026-05-15',
    status: 'in_progress',
    designItems: [
      {
        id: 'D022',
        category: 'finish',
        name: 'White Microcement',
        description: 'Smooth white microcement finish for walls and floor',
        photo: 'microcement_white.jpg',
        supplier: 'Luxury Finishes Ltd',
        cost: 2500
      },
      {
        id: 'D023',
        category: 'fixture',
        name: 'Rain Shower Head',
        description: 'Chrome 300mm rainfall shower head',
        photo: 'shower_head.jpg',
        supplier: 'Premium Bathrooms',
        cost: 450
      },
      {
        id: 'D024',
        category: 'fixture',
        name: 'Wall-hung Toilet',
        description: 'Modern wall-mounted toilet with soft-close seat',
        photo: 'toilet.jpg',
        supplier: 'Premium Bathrooms',
        cost: 680
      }
    ],
    messages: [
      {
        id: 'MSG038',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Materials have been delivered to site. Please confirm receipt.',
        timestamp: '2026-04-27T09:00:00',
        emailSent: true
      },
      {
        id: 'MSG039',
        from: 'Emma Clarke',
        fromRole: 'customer',
        message: 'All received, thank you!',
        timestamp: '2026-04-27T11:30:00',
        emailSent: false
      },
      {
        id: 'MSG040',
        from: 'Mike Wilson',
        fromRole: 'builder',
        message: 'Started today! Demo complete, plumbing updated. Waterproofing tomorrow.',
        timestamp: '2026-05-01T17:00:00',
        emailSent: true
      },
      {
        id: 'MSG041',
        from: 'Emma Clarke',
        fromRole: 'customer',
        message: 'When will you start the waterproofing stage?',
        timestamp: '2026-04-28T10:30:00',
        emailSent: false
      },
      {
        id: 'MSG042',
        from: 'Mike Wilson',
        fromRole: 'builder',
        message: 'Starting waterproofing tomorrow morning. Should take 2 days to complete.',
        timestamp: '2026-04-28T14:15:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B001',
        builderName: 'Mike Wilson',
        paymentType: 'price_work',
        agreedAmount: 3500,
        totalEarned: 1750,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS018',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 1084,
        status: 'paid',
        paidDate: '2026-04-10',
        description: 'Booking deposit'
      },
      {
        id: 'PS019',
        name: 'Project Start',
        percentage: 40,
        amount: 2890,
        status: 'paid',
        paidDate: '2026-05-01',
        description: 'Start payment'
      },
      {
        id: 'PS020',
        name: 'Mid-Project',
        percentage: 25,
        amount: 1806,
        status: 'pending',
        dueDate: '2026-05-08',
        description: 'Mid-project payment'
      },
      {
        id: 'PS021',
        name: 'Final Payment',
        percentage: 20,
        amount: 1445,
        status: 'pending',
        dueDate: '2026-05-15',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV006',
        projectId: 'P006',
        type: 'customer',
        amount: 7225,
        issueDate: '2026-04-10',
        dueDate: '2026-05-15',
        status: 'sent'
      }
    ],
    totalCustomerCost: 7225,
    photos: ['p006_progress_1.jpg', 'p006_progress_2.jpg'],
    description: 'Full bathroom renovation with microcement finish, new fixtures, and modern fittings.',
    assignedBuilder: 'Mike Wilson'
  },
  {
    id: 'P007',
    customerId: 'C004',
    customerName: 'James Wilson',
    customerEmail: 'james.wilson@email.com',
    address: '23 Park Lane, Manchester, M1 4BT',
    startDate: '2026-05-05',
    finishDate: '2026-05-18',
    status: 'in_progress',
    designItems: [
      {
        id: 'D025',
        category: 'tile',
        name: 'Black Hexagon Tiles',
        description: 'Matt black hexagonal floor tiles',
        photo: 'hexagon_tiles.jpg',
        supplier: 'Tile Emporium',
        cost: 950
      },
      {
        id: 'D026',
        category: 'fixture',
        name: 'Matte Black Fixtures',
        description: 'Complete matte black tap and shower set',
        photo: 'black_fixtures.jpg',
        supplier: 'Modern Bathrooms',
        cost: 1200
      }
    ],
    messages: [
      {
        id: 'MSG043',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'Tiles arrived today. Starting installation tomorrow.',
        timestamp: '2026-05-04T15:00:00',
        emailSent: true
      },
      {
        id: 'MSG044',
        from: 'James Wilson',
        fromRole: 'customer',
        message: 'Great! The black hexagons should look amazing.',
        timestamp: '2026-05-04T17:30:00',
        emailSent: false
      },
      {
        id: 'MSG045',
        from: 'Tom Richards',
        fromRole: 'builder',
        message: 'Floor tiles looking fantastic! Half the walls tiled. Finishing tomorrow.',
        timestamp: '2026-05-08T16:30:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B002',
        builderName: 'Tom Richards',
        paymentType: 'price_work',
        agreedAmount: 4200,
        totalEarned: 2100,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS022',
        name: 'Deposit',
        percentage: 20,
        amount: 1970,
        status: 'paid',
        paidDate: '2026-04-20',
        description: 'Booking deposit'
      },
      {
        id: 'PS023',
        name: 'Start Payment',
        percentage: 40,
        amount: 3940,
        status: 'paid',
        paidDate: '2026-05-05',
        description: 'Start payment'
      },
      {
        id: 'PS024',
        name: 'Final Payment',
        percentage: 40,
        amount: 3940,
        status: 'pending',
        dueDate: '2026-05-18',
        description: 'Final payment'
      }
    ],
    invoices: [
      {
        id: 'INV007',
        projectId: 'P007',
        type: 'customer',
        amount: 9850,
        issueDate: '2026-04-20',
        dueDate: '2026-05-18',
        status: 'sent'
      }
    ],
    totalCustomerCost: 9850,
    photos: ['p007_day1.jpg', 'p007_tiling.jpg'],
    description: 'Modern bathroom with matte black theme and hexagonal tiles.',
    assignedBuilder: 'Tom Richards'
  },
  {
    id: 'P008',
    customerId: 'C005',
    customerName: 'Sophie Anderson',
    customerEmail: 'sophie.a@email.com',
    address: '91 Castle Street, Edinburgh, EH1 2ND',
    startDate: '2026-05-10',
    finishDate: '2026-05-22',
    status: 'in_progress',
    designItems: [
      {
        id: 'D027',
        category: 'finish',
        name: 'Grey Microcement',
        description: 'Seamless grey microcement walls and floor',
        photo: 'grey_microcement.jpg',
        supplier: 'Luxury Finishes Ltd',
        cost: 2800
      },
      {
        id: 'D028',
        category: 'fixture',
        name: 'Walk-in Shower Enclosure',
        description: 'Frameless glass walk-in shower',
        photo: 'walk_in_shower.jpg',
        supplier: 'Premium Glass',
        cost: 1850
      }
    ],
    messages: [
      {
        id: 'MSG046',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Project on schedule. Microcement application begins Monday.',
        timestamp: '2026-05-09T09:30:00',
        emailSent: true
      },
      {
        id: 'MSG047',
        from: 'Sophie Anderson',
        fromRole: 'customer',
        message: 'Looking forward to seeing the progress!',
        timestamp: '2026-05-09T11:00:00',
        emailSent: false
      },
      {
        id: 'MSG048',
        from: 'Dave Collins',
        fromRole: 'builder',
        message: 'Started microcement today. First coat applied, second coat tomorrow.',
        timestamp: '2026-05-12T17:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B003',
        builderName: 'Dave Collins',
        paymentType: 'price_work',
        agreedAmount: 5000,
        totalEarned: 2500,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS025',
        name: 'Deposit',
        percentage: 15,
        amount: 1860,
        status: 'paid',
        paidDate: '2026-04-18',
        description: 'Booking deposit'
      },
      {
        id: 'PS026',
        name: 'Start Payment',
        percentage: 45,
        amount: 5580,
        status: 'paid',
        paidDate: '2026-05-10',
        description: 'Start payment'
      },
      {
        id: 'PS027',
        name: 'Final Payment',
        percentage: 40,
        amount: 4960,
        status: 'pending',
        dueDate: '2026-05-22',
        description: 'Completion payment'
      }
    ],
    invoices: [
      {
        id: 'INV008',
        projectId: 'P008',
        type: 'customer',
        amount: 12400,
        issueDate: '2026-04-18',
        dueDate: '2026-05-22',
        status: 'sent'
      }
    ],
    totalCustomerCost: 12400,
    photos: ['p008_day1.jpg', 'p008_prep.jpg'],
    description: 'Contemporary ensuite with seamless microcement finish.',
    assignedBuilder: 'Dave Collins'
  },
  {
    id: 'P009',
    customerId: 'C008',
    customerName: 'Lisa Taylor',
    customerEmail: 'lisa.taylor@email.com',
    address: '89 Hill View, Sheffield, S1 2GH',
    startDate: '2026-05-08',
    finishDate: '2026-05-19',
    status: 'in_progress',
    designItems: [
      {
        id: 'D029',
        category: 'tile',
        name: 'Metro White Tiles',
        description: 'Classic white metro tiles with dark grout',
        photo: 'metro_tiles.jpg',
        supplier: 'Tile Emporium',
        cost: 680
      },
      {
        id: 'D030',
        category: 'fixture',
        name: 'Chrome Fixtures',
        description: 'Modern chrome bathroom fixtures',
        photo: 'chrome_fixtures.jpg',
        supplier: 'Modern Bathrooms',
        cost: 750
      }
    ],
    messages: [
      {
        id: 'MSG049',
        from: 'Dave Collins',
        fromRole: 'builder',
        message: 'Metro tiles looking great. Halfway through installation.',
        timestamp: '2026-05-12T16:30:00',
        emailSent: true
      },
      {
        id: 'MSG050',
        from: 'Lisa Taylor',
        fromRole: 'customer',
        message: 'Fantastic work! Very pleased so far.',
        timestamp: '2026-05-13T09:00:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B003',
        builderName: 'Dave Collins',
        paymentType: 'day_rate',
        dayRate: 240,
        daysWorked: 6,
        totalEarned: 1440,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS028',
        name: 'Deposit',
        percentage: 25,
        amount: 1605,
        status: 'paid',
        paidDate: '2026-05-03',
        description: 'Deposit'
      },
      {
        id: 'PS029',
        name: 'Final Payment',
        percentage: 75,
        amount: 4815,
        status: 'pending',
        dueDate: '2026-05-19',
        description: 'Balance on completion'
      }
    ],
    invoices: [
      {
        id: 'INV009',
        projectId: 'P009',
        type: 'customer',
        amount: 6420,
        issueDate: '2026-05-03',
        dueDate: '2026-05-19',
        status: 'sent'
      }
    ],
    totalCustomerCost: 6420,
    photos: ['p009_day1.jpg', 'p009_tiling.jpg'],
    description: 'Contemporary bathroom with classic metro tiles.',
    assignedBuilder: 'Dave Collins'
  },
  {
    id: 'P010',
    tradeId: 'bathroom',
    tradeName: 'Bathroom',
    customerId: 'C010',
    customerName: 'Amanda Peterson',
    customerEmail: 'amanda.peterson@email.com',
    address: '25 Garden Lane, Bristol, BS8 2PL',
    startDate: '2026-05-03',
    finishDate: '2026-05-20',
    status: 'in_progress',
    designItems: [
      {
        id: 'D031',
        category: 'finish',
        name: 'Pearl White Microcement',
        description: 'Luxury pearl white seamless microcement for walls and floor',
        photo: 'pearl_microcement.jpg',
        supplier: 'Luxury Finishes Ltd',
        cost: 3200
      },
      {
        id: 'D032',
        category: 'fixture',
        name: 'Gold Rainfall Shower',
        description: 'Brushed gold 400mm rainfall shower with handheld',
        photo: 'gold_shower.jpg',
        supplier: 'Premium Bathrooms',
        cost: 850
      },
      {
        id: 'D033',
        category: 'fixture',
        name: 'Gold Basin Mixer Tap',
        description: 'Brushed gold basin mixer with pop-up waste',
        photo: 'gold_tap.jpg',
        supplier: 'Premium Bathrooms',
        cost: 320
      },
      {
        id: 'D034',
        category: 'fixture',
        name: 'Wall-mounted Vanity Unit',
        description: 'Oak wall-mounted vanity 1200mm with integrated basin',
        photo: 'oak_vanity.jpg',
        supplier: 'Bathroom Furniture Co',
        cost: 1450
      },
      {
        id: 'D035',
        category: 'accessory',
        name: 'LED Mirror',
        description: 'Heated LED mirror 1000x800mm with demister',
        photo: 'led_mirror.jpg',
        supplier: 'Mirror World',
        cost: 420
      }
    ],
    messages: [
      {
        id: 'MSG051',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Thank you for choosing Bathroom Pro! Your project is scheduled to start on May 3rd. We\'ve ordered all your beautiful materials including the pearl microcement and gold fixtures.',
        timestamp: '2026-04-20T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG052',
        from: 'Amanda Peterson',
        fromRole: 'customer',
        message: 'Thank you! I\'m really excited to get started. Will I be updated on progress?',
        timestamp: '2026-04-20T14:30:00',
        emailSent: false
      },
      {
        id: 'MSG053',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Absolutely! Our builder will send you daily updates and photos. You can also check progress anytime by logging into your account.',
        timestamp: '2026-04-20T15:00:00',
        emailSent: true
      },
      {
        id: 'MSG054',
        from: 'Steve Parker',
        fromRole: 'builder',
        message: 'Hi Amanda, I\'ll be your builder for this project. Started today! Old bathroom stripped out. Waterproofing begins tomorrow.',
        timestamp: '2026-05-03T16:30:00',
        emailSent: true
      },
      {
        id: 'MSG055',
        from: 'Amanda Peterson',
        fromRole: 'customer',
        message: 'Great work today! The space looks completely different already.',
        timestamp: '2026-05-03T18:00:00',
        emailSent: false
      },
      {
        id: 'MSG056',
        from: 'Steve Parker',
        fromRole: 'builder',
        message: 'Waterproofing complete and tested. Microcement application starts tomorrow - this is where it gets exciting!',
        timestamp: '2026-05-06T17:00:00',
        emailSent: true
      },
      {
        id: 'MSG057',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Hi Amanda, your second stage payment is now due. The project is progressing beautifully! You can pay via the link in your email or call the office.',
        timestamp: '2026-05-07T09:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B004',
        builderName: 'Steve Parker',
        paymentType: 'price_work',
        agreedAmount: 4800,
        totalEarned: 2400,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS030',
        name: 'Booking Deposit',
        percentage: 10,
        amount: 1085,
        status: 'paid',
        paidDate: '2026-04-15',
        description: 'Initial booking deposit to secure your project date and order materials'
      },
      {
        id: 'PS031',
        name: 'Project Start Payment',
        percentage: 40,
        amount: 4340,
        status: 'paid',
        dueDate: '2026-05-03',
        paidDate: '2026-05-03',
        description: 'Payment due on project start date'
      },
      {
        id: 'PS032',
        name: 'Mid-Project Payment',
        percentage: 30,
        amount: 3255,
        status: 'due',
        dueDate: '2026-05-10',
        description: 'Payment due when project reaches 50% completion'
      },
      {
        id: 'PS033',
        name: 'Final Completion Payment',
        percentage: 20,
        amount: 2170,
        status: 'pending',
        dueDate: '2026-05-20',
        description: 'Final payment on project completion and your approval'
      }
    ],
    invoices: [
      {
        id: 'INV010',
        projectId: 'P010',
        type: 'customer',
        amount: 10850,
        issueDate: '2026-04-15',
        dueDate: '2026-05-20',
        status: 'sent'
      }
    ],
    totalCustomerCost: 10850,
    photos: ['p010_day1.jpg', 'p010_day3.jpg', 'p010_waterproof.jpg'],
    description: 'Luxury en-suite bathroom renovation with pearl white microcement, brushed gold fixtures, oak vanity, and LED mirror. Modern contemporary design.',
    assignedBuilder: 'Steve Parker'
  },
  {
    id: 'P011',
    customerId: 'C013',
    customerName: 'Christopher Lee',
    customerEmail: 'chris.lee@email.com',
    address: '52 Market Place, Nottingham, NG1 6HX',
    startDate: '2026-05-12',
    finishDate: '2026-05-28',
    status: 'in_progress',
    designItems: [
      {
        id: 'D036',
        category: 'finish',
        name: 'Charcoal Microcement',
        description: 'Dark charcoal microcement for modern aesthetic',
        photo: 'charcoal_microcement.jpg',
        supplier: 'Urban Finishes',
        cost: 3400
      },
      {
        id: 'D037',
        category: 'fixture',
        name: 'Large Walk-in Shower',
        description: 'Oversized walk-in shower 1800mm with rainfall head',
        photo: 'large_walkin.jpg',
        supplier: 'Premium Glass',
        cost: 2200
      },
      {
        id: 'D038',
        category: 'fixture',
        name: 'Freestanding Modern Bath',
        description: 'Contemporary freestanding bath in white',
        photo: 'modern_bath.jpg',
        supplier: 'Bath Emporium',
        cost: 1850
      },
      {
        id: 'D039',
        category: 'accessory',
        name: 'Smart Mirror',
        description: 'Smart mirror with LED, demister, Bluetooth',
        photo: 'smart_mirror.jpg',
        supplier: 'Tech Bathrooms',
        cost: 680
      }
    ],
    messages: [
      {
        id: 'MSG058',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your master bathroom suite project starts 12th May. All premium materials ordered.',
        timestamp: '2026-05-05T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG059',
        from: 'Christopher Lee',
        fromRole: 'customer',
        message: 'Excellent, can\'t wait to see it come together!',
        timestamp: '2026-05-05T14:00:00',
        emailSent: false
      },
      {
        id: 'MSG060',
        from: 'Chris Morgan',
        fromRole: 'builder',
        message: 'Started today. Full strip out complete. Plumbing updated for separate bath and shower.',
        timestamp: '2026-05-12T17:30:00',
        emailSent: true
      },
      {
        id: 'MSG061',
        from: 'Chris Morgan',
        fromRole: 'builder',
        message: 'Waterproofing done. Charcoal microcement first coat applied - looks stunning!',
        timestamp: '2026-05-16T16:45:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B005',
        builderName: 'Chris Morgan',
        paymentType: 'day_rate',
        dayRate: 245,
        daysWorked: 8,
        totalEarned: 1960,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS034',
        name: 'Deposit',
        percentage: 15,
        amount: 2580,
        status: 'paid',
        paidDate: '2026-05-10',
        description: 'Booking deposit'
      },
      {
        id: 'PS035',
        name: 'Start Payment',
        percentage: 40,
        amount: 6880,
        status: 'paid',
        paidDate: '2026-05-12',
        description: 'Start payment'
      },
      {
        id: 'PS036',
        name: 'Mid Payment',
        percentage: 25,
        amount: 4300,
        status: 'pending',
        dueDate: '2026-05-21',
        description: 'Mid-project payment'
      },
      {
        id: 'PS037',
        name: 'Final Payment',
        percentage: 20,
        amount: 3440,
        status: 'pending',
        dueDate: '2026-05-28',
        description: 'Completion payment'
      }
    ],
    invoices: [
      {
        id: 'INV011',
        projectId: 'P011',
        type: 'customer',
        amount: 17200,
        issueDate: '2026-05-10',
        dueDate: '2026-05-28',
        status: 'sent'
      }
    ],
    totalCustomerCost: 17200,
    photos: ['p011_demo.jpg', 'p011_first_fix.jpg', 'p011_microcement.jpg'],
    description: 'Master bathroom suite with charcoal microcement, separate bath and walk-in shower.',
    assignedBuilder: 'Chris Morgan'
  },
  {
    id: 'P012',
    customerId: 'C014',
    customerName: 'Jennifer Moore',
    customerEmail: 'jen.moore@email.com',
    address: '71 Forest Road, Oxford, OX2 6JQ',
    startDate: '2026-05-18',
    finishDate: '2026-05-30',
    status: 'in_progress',
    designItems: [
      {
        id: 'D040',
        category: 'tile',
        name: 'Beige Stone Effect Tiles',
        description: 'Natural beige stone effect large format tiles',
        photo: 'beige_stone.jpg',
        supplier: 'Natural Stone Co',
        cost: 1250
      },
      {
        id: 'D041',
        category: 'fixture',
        name: 'Corner Shower Enclosure',
        description: 'Space-saving corner shower enclosure 900x900mm',
        photo: 'corner_shower.jpg',
        supplier: 'Space Savers',
        cost: 720
      },
      {
        id: 'D042',
        category: 'fixture',
        name: 'Compact Vanity Unit',
        description: 'Wall-mounted compact vanity 600mm',
        photo: 'compact_vanity.jpg',
        supplier: 'Small Bathrooms',
        cost: 580
      }
    ],
    messages: [
      {
        id: 'MSG062',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your ensuite conversion project starts 18th May. All materials ordered.',
        timestamp: '2026-05-12T09:00:00',
        emailSent: true
      },
      {
        id: 'MSG063',
        from: 'Jennifer Moore',
        fromRole: 'customer',
        message: 'Perfect timing! Looking forward to having an ensuite finally.',
        timestamp: '2026-05-12T11:30:00',
        emailSent: false
      },
      {
        id: 'MSG064',
        from: 'Gary Thompson',
        fromRole: 'builder',
        message: 'Started today. Plumbing being installed for ensuite conversion. Tiling starts tomorrow.',
        timestamp: '2026-05-18T17:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B006',
        builderName: 'Gary Thompson',
        paymentType: 'price_work',
        agreedAmount: 3800,
        totalEarned: 1140,
        status: 'approved'
      }
    ],
    paymentStages: [
      {
        id: 'PS038',
        name: 'Deposit',
        percentage: 20,
        amount: 1700,
        status: 'paid',
        paidDate: '2026-05-15',
        description: 'Booking deposit'
      },
      {
        id: 'PS039',
        name: 'Start Payment',
        percentage: 40,
        amount: 3400,
        status: 'paid',
        paidDate: '2026-05-18',
        description: 'Start payment'
      },
      {
        id: 'PS040',
        name: 'Final Payment',
        percentage: 40,
        amount: 3400,
        status: 'pending',
        dueDate: '2026-05-30',
        description: 'Completion payment'
      }
    ],
    invoices: [
      {
        id: 'INV012',
        projectId: 'P012',
        type: 'customer',
        amount: 8500,
        issueDate: '2026-05-15',
        dueDate: '2026-05-30',
        status: 'sent'
      }
    ],
    totalCustomerCost: 8500,
    photos: ['p012_before.jpg', 'p012_plumbing.jpg'],
    description: 'Ensuite bathroom conversion with stone effect tiles and space-saving fixtures.',
    assignedBuilder: 'Gary Thompson'
  },

  // UPCOMING PROJECTS (5)
  {
    id: 'P013',
    customerId: 'C006',
    customerName: 'Michael Brown',
    customerEmail: 'michael.b@email.com',
    address: '67 Station Road, Newcastle upon Tyne, NE1 3DX',
    startDate: '2026-05-25',
    finishDate: '2026-06-08',
    status: 'upcoming',
    designItems: [
      {
        id: 'D043',
        category: 'tile',
        name: 'Wood Effect Porcelain',
        description: 'Oak wood effect porcelain tiles',
        photo: 'wood_tiles.jpg',
        supplier: 'Tile Warehouse',
        cost: 1400
      },
      {
        id: 'D044',
        category: 'fixture',
        name: 'Traditional Suite',
        description: 'Classic white bathroom suite',
        photo: 'trad_suite.jpg',
        supplier: 'Classic Bathrooms',
        cost: 980
      }
    ],
    messages: [
      {
        id: 'MSG065',
        from: 'Office Team',
        fromRole: 'office',
        message: 'All materials ordered. Start date confirmed for May 25th.',
        timestamp: '2026-05-01T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG066',
        from: 'Michael Brown',
        fromRole: 'customer',
        message: 'Great! The family is excited for the new bathroom.',
        timestamp: '2026-05-01T14:30:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B004',
        builderName: 'Steve Parker',
        paymentType: 'day_rate',
        dayRate: 260,
        daysWorked: 0,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS041',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 1298,
        status: 'paid',
        paidDate: '2026-05-01',
        description: 'Deposit to secure project'
      },
      {
        id: 'PS042',
        name: 'Start Payment',
        percentage: 40,
        amount: 3460,
        status: 'pending',
        dueDate: '2026-05-25',
        description: 'Payment on project start'
      },
      {
        id: 'PS043',
        name: 'Final Payment',
        percentage: 45,
        amount: 3892,
        status: 'pending',
        dueDate: '2026-06-08',
        description: 'Final payment on completion'
      }
    ],
    invoices: [
      {
        id: 'INV013',
        projectId: 'P013',
        type: 'customer',
        amount: 8650,
        issueDate: '2026-05-01',
        dueDate: '2026-06-08',
        status: 'draft'
      }
    ],
    totalCustomerCost: 8650,
    photos: [],
    description: 'Family bathroom with wood effect tiles and traditional fixtures.',
    assignedBuilder: 'Steve Parker'
  },
  {
    id: 'P014',
    customerId: 'C007',
    customerName: 'Robert Davis',
    customerEmail: 'robert.davis@email.com',
    address: '34 Queens Road, Liverpool, L1 1RG',
    startDate: '2026-05-28',
    finishDate: '2026-06-15',
    status: 'upcoming',
    designItems: [
      {
        id: 'D045',
        category: 'finish',
        name: 'Beige Microcement',
        description: 'Warm beige microcement throughout',
        photo: 'beige_microcement.jpg',
        supplier: 'Luxury Finishes Ltd',
        cost: 3200
      },
      {
        id: 'D046',
        category: 'fixture',
        name: 'Freestanding Bath',
        description: 'Modern freestanding bath with floor filler',
        photo: 'freestanding_bath.jpg',
        supplier: 'Premium Bathrooms',
        cost: 2400
      },
      {
        id: 'D047',
        category: 'fixture',
        name: 'Brass Shower System',
        description: 'Brushed brass rainfall shower system',
        photo: 'brass_shower.jpg',
        supplier: 'Premium Bathrooms',
        cost: 1180
      }
    ],
    messages: [
      {
        id: 'MSG067',
        from: 'Admin',
        fromRole: 'admin',
        message: 'Project scheduled. Builder assigned. Materials being ordered.',
        timestamp: '2026-04-28T14:00:00',
        emailSent: true
      },
      {
        id: 'MSG068',
        from: 'Robert Davis',
        fromRole: 'customer',
        message: 'Thank you. Really looking forward to this luxury bathroom!',
        timestamp: '2026-04-28T16:30:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B005',
        builderName: 'Chris Morgan',
        paymentType: 'price_work',
        agreedAmount: 6500,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS044',
        name: 'Booking Deposit',
        percentage: 15,
        amount: 2520,
        status: 'paid',
        paidDate: '2026-04-28',
        description: 'Deposit for luxury bathroom'
      },
      {
        id: 'PS045',
        name: 'Start Payment',
        percentage: 40,
        amount: 6720,
        status: 'pending',
        dueDate: '2026-05-28',
        description: 'Payment on start'
      },
      {
        id: 'PS046',
        name: 'Mid Payment',
        percentage: 25,
        amount: 4200,
        status: 'pending',
        dueDate: '2026-06-08',
        description: 'Mid-project payment'
      },
      {
        id: 'PS047',
        name: 'Final Payment',
        percentage: 20,
        amount: 3360,
        status: 'pending',
        dueDate: '2026-06-15',
        description: 'Final payment'
      }
    ],
    invoices: [
      {
        id: 'INV014',
        projectId: 'P014',
        type: 'customer',
        amount: 16800,
        issueDate: '2026-04-28',
        dueDate: '2026-06-15',
        status: 'draft'
      }
    ],
    totalCustomerCost: 16800,
    photos: [],
    description: 'Luxury master bathroom with freestanding bath, beige microcement, and brass fixtures.',
    assignedBuilder: 'Chris Morgan'
  },
  {
    id: 'P015',
    customerId: 'C009',
    customerName: 'Olivia Martin',
    customerEmail: 'olivia.martin@email.com',
    address: '12 Victoria Place, Cardiff, CF10 3BH',
    startDate: '2026-06-02',
    finishDate: '2026-06-20',
    status: 'upcoming',
    designItems: [
      {
        id: 'D048',
        category: 'finish',
        name: 'Concrete Effect Microcement',
        description: 'Industrial concrete-look microcement',
        photo: 'concrete_microcement.jpg',
        supplier: 'Urban Finishes',
        cost: 3500
      },
      {
        id: 'D049',
        category: 'fixture',
        name: 'Industrial Style Fixtures',
        description: 'Black industrial taps and accessories',
        photo: 'industrial_fixtures.jpg',
        supplier: 'Industrial Bathrooms',
        cost: 1350
      },
      {
        id: 'D050',
        category: 'accessory',
        name: 'Exposed Pipe Work',
        description: 'Black exposed industrial pipe shower system',
        photo: 'exposed_pipes.jpg',
        supplier: 'Industrial Bathrooms',
        cost: 880
      }
    ],
    messages: [
      {
        id: 'MSG069',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Design approved. Materials on order for June 2nd start.',
        timestamp: '2026-04-29T11:30:00',
        emailSent: true
      },
      {
        id: 'MSG070',
        from: 'Olivia Martin',
        fromRole: 'customer',
        message: 'Excited for the industrial style! It\'s going to look amazing.',
        timestamp: '2026-04-29T14:00:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B002',
        builderName: 'Tom Richards',
        paymentType: 'price_work',
        agreedAmount: 5800,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS048',
        name: 'Deposit',
        percentage: 15,
        amount: 2130,
        status: 'paid',
        paidDate: '2026-04-29',
        description: 'Booking deposit'
      },
      {
        id: 'PS049',
        name: 'Start Payment',
        percentage: 45,
        amount: 6390,
        status: 'pending',
        dueDate: '2026-06-02',
        description: 'Start payment'
      },
      {
        id: 'PS050',
        name: 'Final Payment',
        percentage: 40,
        amount: 5680,
        status: 'pending',
        dueDate: '2026-06-20',
        description: 'Completion payment'
      }
    ],
    invoices: [
      {
        id: 'INV015',
        projectId: 'P015',
        type: 'customer',
        amount: 14200,
        issueDate: '2026-04-29',
        dueDate: '2026-06-20',
        status: 'draft'
      }
    ],
    totalCustomerCost: 14200,
    photos: [],
    description: 'Industrial-style bathroom with concrete effect microcement and exposed elements.',
    assignedBuilder: 'Tom Richards'
  },
  {
    id: 'P016',
    customerId: 'C001',
    customerName: 'Emma Clarke',
    customerEmail: 'emma.clarke@email.com',
    address: '156 High Street, Birmingham, B4 7SL',
    startDate: '2026-06-10',
    finishDate: '2026-06-24',
    status: 'upcoming',
    designItems: [
      {
        id: 'D051',
        category: 'tile',
        name: 'Large Format Grey Tiles',
        description: 'Large format 600x1200mm grey porcelain tiles',
        photo: 'large_grey.jpg',
        supplier: 'Tile Giant',
        cost: 1650
      },
      {
        id: 'D052',
        category: 'fixture',
        name: 'Modern Suite',
        description: 'Contemporary bathroom suite in white',
        photo: 'modern_suite.jpg',
        supplier: 'Contemporary Bathrooms',
        cost: 1280
      }
    ],
    messages: [
      {
        id: 'MSG071',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Second bathroom project scheduled for June 10th. Materials ordered.',
        timestamp: '2026-05-20T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG072',
        from: 'Emma Clarke',
        fromRole: 'customer',
        message: 'Perfect! Looking forward to working with you again.',
        timestamp: '2026-05-20T12:30:00',
        emailSent: false
      }
    ],
    builderPayments: [
      {
        builderId: 'B001',
        builderName: 'Mike Wilson',
        paymentType: 'price_work',
        agreedAmount: 4200,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS051',
        name: 'Deposit',
        percentage: 20,
        amount: 1980,
        status: 'paid',
        paidDate: '2026-05-20',
        description: 'Deposit for second bathroom'
      },
      {
        id: 'PS052',
        name: 'Start Payment',
        percentage: 40,
        amount: 3960,
        status: 'pending',
        dueDate: '2026-06-10',
        description: 'Start payment'
      },
      {
        id: 'PS053',
        name: 'Final Payment',
        percentage: 40,
        amount: 3960,
        status: 'pending',
        dueDate: '2026-06-24',
        description: 'Final payment'
      }
    ],
    invoices: [
      {
        id: 'INV016',
        projectId: 'P016',
        type: 'customer',
        amount: 9900,
        issueDate: '2026-05-20',
        dueDate: '2026-06-24',
        status: 'draft'
      }
    ],
    totalCustomerCost: 9900,
    photos: [],
    description: 'Second bathroom renovation with large format grey tiles.',
    assignedBuilder: 'Mike Wilson'
  },
  {
    id: 'P017',
    customerId: 'C004',
    customerName: 'James Wilson',
    customerEmail: 'james.wilson@email.com',
    address: '23 Park Lane, Manchester, M1 4BT',
    startDate: '2026-06-15',
    finishDate: '2026-06-28',
    status: 'upcoming',
    designItems: [
      {
        id: 'D053',
        category: 'tile',
        name: 'White Marble Tiles',
        description: 'Carrara white marble effect tiles',
        photo: 'white_marble.jpg',
        supplier: 'Marble Emporium',
        cost: 2100
      },
      {
        id: 'D054',
        category: 'fixture',
        name: 'Gold Fixtures',
        description: 'Brushed gold tap and shower fixtures',
        photo: 'gold_fixtures.jpg',
        supplier: 'Luxury Bathrooms',
        cost: 1580
      }
    ],
    messages: [
      {
        id: 'MSG073',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Ensuite project scheduled for 15th June. Marble tiles and gold fixtures ordered.',
        timestamp: '2026-05-22T09:30:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B007',
        builderName: 'Mark Stevens',
        paymentType: 'price_work',
        agreedAmount: 5200,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS054',
        name: 'Deposit',
        percentage: 15,
        amount: 1845,
        status: 'paid',
        paidDate: '2026-05-22',
        description: 'Booking deposit'
      },
      {
        id: 'PS055',
        name: 'Start Payment',
        percentage: 45,
        amount: 5535,
        status: 'pending',
        dueDate: '2026-06-15',
        description: 'Start payment'
      },
      {
        id: 'PS056',
        name: 'Final Payment',
        percentage: 40,
        amount: 4920,
        status: 'pending',
        dueDate: '2026-06-28',
        description: 'Completion payment'
      }
    ],
    invoices: [
      {
        id: 'INV017',
        projectId: 'P017',
        type: 'customer',
        amount: 12300,
        issueDate: '2026-05-22',
        dueDate: '2026-06-28',
        status: 'draft'
      }
    ],
    totalCustomerCost: 12300,
    photos: [],
    description: 'Ensuite bathroom with white marble and gold fixtures.',
    assignedBuilder: 'Mark Stevens'
  },

  // ON HOLD PROJECTS (3)
  {
    id: 'P018',
    customerId: 'C005',
    customerName: 'Sophie Anderson',
    customerEmail: 'sophie.a@email.com',
    address: '91 Castle Street, Edinburgh, EH1 2ND',
    startDate: '2026-04-15',
    finishDate: '2026-04-28',
    status: 'on_hold',
    designItems: [
      {
        id: 'D055',
        category: 'tile',
        name: 'Blue Feature Tiles',
        description: 'Blue geometric feature tiles for shower area',
        photo: 'blue_feature.jpg',
        supplier: 'Feature Tiles Ltd',
        cost: 890
      }
    ],
    messages: [
      {
        id: 'MSG074',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Your downstairs toilet project is scheduled for 15th April.',
        timestamp: '2026-04-08T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG075',
        from: 'Sophie Anderson',
        fromRole: 'customer',
        message: 'I\'m really sorry but I need to postpone this. Family emergency - can we reschedule for a few weeks?',
        timestamp: '2026-04-12T14:30:00',
        emailSent: false
      },
      {
        id: 'MSG076',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Of course, no problem at all. We hope everything is okay. We\'ve put your project on hold and will contact you in a few weeks to reschedule.',
        timestamp: '2026-04-12T15:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B003',
        builderName: 'Dave Collins',
        paymentType: 'day_rate',
        dayRate: 240,
        daysWorked: 0,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS057',
        name: 'Deposit',
        percentage: 25,
        amount: 975,
        status: 'paid',
        paidDate: '2026-04-08',
        description: 'Booking deposit'
      },
      {
        id: 'PS058',
        name: 'Final Payment',
        percentage: 75,
        amount: 2925,
        status: 'pending',
        dueDate: '2026-04-28',
        description: 'Balance on completion'
      }
    ],
    invoices: [],
    totalCustomerCost: 3900,
    photos: [],
    description: 'Downstairs toilet renovation with blue feature tiles.',
    assignedBuilder: 'Dave Collins'
  },
  {
    id: 'P019',
    customerId: 'C007',
    customerName: 'Robert Davis',
    customerEmail: 'robert.davis@email.com',
    address: '34 Queens Road, Liverpool, L1 1RG',
    startDate: '2026-05-05',
    finishDate: '2026-05-18',
    status: 'on_hold',
    designItems: [
      {
        id: 'D056',
        category: 'tile',
        name: 'Terracotta Floor Tiles',
        description: 'Warm terracotta floor tiles',
        photo: 'terracotta.jpg',
        supplier: 'Mediterranean Tiles',
        cost: 1120
      }
    ],
    messages: [
      {
        id: 'MSG077',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Guest bathroom project confirmed for 5th May start.',
        timestamp: '2026-04-25T09:00:00',
        emailSent: true
      },
      {
        id: 'MSG078',
        from: 'Robert Davis',
        fromRole: 'customer',
        message: 'Hi, we\'ve had some building work issues in another room. Need to delay this bathroom until that\'s sorted. Maybe 3-4 weeks?',
        timestamp: '2026-05-01T16:00:00',
        emailSent: false
      },
      {
        id: 'MSG079',
        from: 'Office Team',
        fromRole: 'office',
        message: 'No problem Robert. We\'ve put your project on hold. Just let us know when you\'re ready and we\'ll reschedule.',
        timestamp: '2026-05-02T09:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B008',
        builderName: 'Paul Henderson',
        paymentType: 'day_rate',
        dayRate: 255,
        daysWorked: 0,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS059',
        name: 'Deposit',
        percentage: 20,
        amount: 1180,
        status: 'paid',
        paidDate: '2026-04-25',
        description: 'Deposit'
      },
      {
        id: 'PS060',
        name: 'Final Payment',
        percentage: 80,
        amount: 4720,
        status: 'pending',
        dueDate: '2026-05-18',
        description: 'Balance'
      }
    ],
    invoices: [],
    totalCustomerCost: 5900,
    photos: [],
    description: 'Guest bathroom with terracotta tiles.',
    assignedBuilder: 'Paul Henderson'
  },
  {
    id: 'P020',
    customerId: 'C013',
    customerName: 'Christopher Lee',
    customerEmail: 'chris.lee@email.com',
    address: '52 Market Place, Nottingham, NG1 6HX',
    startDate: '2026-04-20',
    finishDate: '2026-05-02',
    status: 'on_hold',
    designItems: [
      {
        id: 'D057',
        category: 'fixture',
        name: 'Wetroom Screen',
        description: 'Fixed wetroom glass screen',
        photo: 'wetroom_screen.jpg',
        supplier: 'Wetroom Pro',
        cost: 680
      }
    ],
    messages: [
      {
        id: 'MSG080',
        from: 'Office Team',
        fromRole: 'office',
        message: 'Wetroom project scheduled for 20th April.',
        timestamp: '2026-04-10T10:00:00',
        emailSent: true
      },
      {
        id: 'MSG081',
        from: 'Christopher Lee',
        fromRole: 'customer',
        message: 'Need to postpone - supplier issues with some materials I\'m sourcing separately. Can we delay by 2 weeks?',
        timestamp: '2026-04-16T11:00:00',
        emailSent: false
      },
      {
        id: 'MSG082',
        from: 'Office Team',
        fromRole: 'office',
        message: 'No problem. Project on hold. Contact us when your materials arrive and we\'ll reschedule.',
        timestamp: '2026-04-16T14:00:00',
        emailSent: true
      }
    ],
    builderPayments: [
      {
        builderId: 'B007',
        builderName: 'Mark Stevens',
        paymentType: 'price_work',
        agreedAmount: 3200,
        totalEarned: 0,
        status: 'pending'
      }
    ],
    paymentStages: [
      {
        id: 'PS061',
        name: 'Deposit',
        percentage: 30,
        amount: 1800,
        status: 'paid',
        paidDate: '2026-04-10',
        description: 'Deposit'
      },
      {
        id: 'PS062',
        name: 'Final Payment',
        percentage: 70,
        amount: 4200,
        status: 'pending',
        dueDate: '2026-05-02',
        description: 'Balance'
      }
    ],
    invoices: [],
    totalCustomerCost: 6000,
    photos: [],
    description: 'Small wetroom conversion.',
    assignedBuilder: 'Mark Stevens',
    tradeId: 'bathroom',
    tradeName: 'Bathroom'
  },
  {
    id: 'P021',
    customerId: '6',
    customerName: 'Robert Harris',
    customerEmail: 'robert.harris@email.com',
    tradeId: 'kitchen',
    tradeName: 'Kitchen',
    address: '45 Oak Avenue, Manchester, M1 2AB',
    startDate: '2026-05-15',
    finishDate: '2026-06-28',
    status: 'upcoming',
    designItems: [
      { id: 'DI-K1', category: 'fixture', name: 'Shaker Base Units', description: '600mm units throughout', cost: 4200 },
      { id: 'DI-K2', category: 'finish', name: 'Quartz Worktop', description: 'Calacatta quartz 20mm', cost: 2800 },
    ],
    messages: [],
    builderPayments: [],
    paymentStages: [
      { id: 'PS-K1', name: 'Deposit', percentage: 30, amount: 4500, status: 'paid', paidDate: '2026-04-01', description: 'Deposit' },
      { id: 'PS-K2', name: 'Final', percentage: 70, amount: 10500, status: 'pending', dueDate: '2026-06-28', description: 'Balance' },
    ],
    invoices: [],
    totalCustomerCost: 15000,
    photos: [],
    description: 'Full kitchen refit with quartz worktops.',
    assignedBuilder: 'Dave Collins'
  },
  {
    id: 'P022',
    customerId: '8',
    customerName: 'Lisa Turner',
    customerEmail: 'lisa.turner@email.com',
    tradeId: 'electrical',
    tradeName: 'Electrical',
    address: '12 Elm Street, Leeds, LS1 4DJ',
    startDate: '2026-04-20',
    finishDate: '2026-04-25',
    status: 'in_progress',
    designItems: [],
    messages: [],
    builderPayments: [
      { builderId: 'B005', builderName: 'Chris Morgan', paymentType: 'day_rate', dayRate: 320, daysWorked: 3, totalEarned: 960, status: 'approved' },
    ],
    paymentStages: [
      { id: 'PS-E1', name: 'Full Payment', percentage: 100, amount: 2800, status: 'paid', paidDate: '2026-04-18', description: 'Consumer unit upgrade' },
    ],
    invoices: [],
    totalCustomerCost: 2800,
    photos: [],
    description: 'Consumer unit replacement and RCD upgrade.',
    assignedBuilder: 'Chris Morgan'
  }
];
