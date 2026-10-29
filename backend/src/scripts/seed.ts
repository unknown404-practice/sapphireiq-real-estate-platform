import mongoose from 'mongoose';
import { User } from '../models/User';
import { Property } from '../models/Property';
import { Appointment } from '../models/Appointment';
import { connectDatabase, disconnectDatabase } from '../config/database';

export async function seedDatabase(): Promise<void> {
  try {
    await connectDatabase();
    console.log('[Seed] Connected to database. Purging existing test records...');

    await User.deleteMany({});
    await Property.deleteMany({});
    await Appointment.deleteMany({});

    console.log('[Seed] Creating demo users...');
    const user1 = await User.create({
      name: 'Aarav Sharma',
      email: 'user1@sapphireiq.local',
      password: 'Password123!',
      role: 'user',
      phone: '+91 98765 43210',
    });

    const user2 = await User.create({
      name: 'Priya Mukherjee',
      email: 'user2@sapphireiq.local',
      password: 'Password123!',
      role: 'user',
      phone: '+91 98765 43211',
    });

    const admin = await User.create({
      name: 'Sapphire Admin',
      email: 'admin@sapphireiq.local',
      password: 'AdminPassword123!',
      role: 'admin',
      phone: '+91 98765 43212',
    });

    console.log('[Seed] Created users:');
    console.log(' - user1@sapphireiq.local (Password123!)');
    console.log(' - user2@sapphireiq.local (Password123!)');
    console.log(' - admin@sapphireiq.local (AdminPassword123!)');

    console.log('[Seed] Creating property catalog...');
    const propertiesData = [
      {
        title: 'Luxurious 3BHK Sea-Facing Haven in Worli',
        description: 'Spectacular panoramic Arabian Sea views with floor-to-ceiling double-glazed windows. Features Italian marble flooring, integrated smart home automation, private elevator access, and a bespoke modular kitchen equipped with German appliances.',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 48500000, // ₹4.85 Cr
        city: 'Mumbai',
        state: 'Maharashtra',
        locality: 'Worli Sea Face',
        pincode: '400018',
        bedrooms: 3,
        bathrooms: 3,
        areaSqFt: 2150,
        amenities: ['Sea View', 'Swimming Pool', 'Gymnasium', '24/7 Security', 'Covered Parking', 'Clubhouse', 'Power Backup'],
        images: [
          { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', caption: 'Living Room' },
          { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', caption: 'Master Suite' },
          { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', caption: 'Balcony View' },
          { url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80', caption: 'Modern Kitchen' },
        ],
        owner: user1._id,
        status: 'published',
        featured: true,
      },
      {
        title: 'Elegant 4BHK Private Villa with Garden in Whitefield',
        description: 'Nestled in a serene gated community in Bengaluru tech corridor. This sprawling villa boasts landscaped private lawns, solar-powered water heating, EV charging port, and a dedicated home office suite.',
        propertyType: 'villa',
        listingType: 'sale',
        price: 32000000, // ₹3.20 Cr
        city: 'Bengaluru',
        state: 'Karnataka',
        locality: 'Whitefield',
        pincode: '560066',
        bedrooms: 4,
        bathrooms: 4,
        areaSqFt: 3400,
        amenities: ['Private Garden', 'Gated Community', 'EV Charger', 'Solar Heating', 'Clubhouse', 'Tennis Court'],
        images: [
          { url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', caption: 'Villa Exterior' },
          { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', caption: 'Lawn & Patio' },
          { url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80', caption: 'Family Lounge' },
          { url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', caption: 'Dining Area' },
        ],
        owner: user1._id,
        status: 'published',
        featured: true,
      },
      {
        title: 'Chic 2BHK High-Rise Apartment near Hiranandani',
        description: 'Tastefully furnished apartment available for executive lease. Walking distance from corporate business parks, metro station, gourmet dining, and international schools. High-speed fiber connectivity installed.',
        propertyType: 'apartment',
        listingType: 'rent',
        price: 65000, // ₹65,000 / month
        city: 'Mumbai',
        state: 'Maharashtra',
        locality: 'Powai',
        pincode: '400076',
        bedrooms: 2,
        bathrooms: 2,
        areaSqFt: 980,
        amenities: ['Furnished', 'High Speed Elevators', 'Gymnasium', 'Covered Parking', 'Intercom', 'Swimming Pool'],
        images: [
          { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', caption: 'Living Area' },
          { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80', caption: 'Bedroom' },
          { url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80', caption: 'Kitchen' },
        ],
        owner: user1._id,
        status: 'published',
        featured: false,
      },
      {
        title: 'Heritage 3BHK Penthouse in South Kolkata',
        description: 'A rare blend of British colonial architectural grandeur and contemporary luxury. Soaring 14-foot ceilings, Burmese teak floorboards, wide verandas, and a private terrace overlooking Victoria Memorial parkland.',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 24500000, // ₹2.45 Cr
        city: 'Kolkata',
        state: 'West Bengal',
        locality: 'Alipore',
        pincode: '700027',
        bedrooms: 3,
        bathrooms: 3,
        areaSqFt: 2600,
        amenities: ['Terrace Garden', 'Teak Woodwork', '24/7 Security', 'Reserved Parking', 'Power Backup'],
        images: [
          { url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80', caption: 'Grand Salon' },
          { url: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80', caption: 'Veranda' },
          { url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80', caption: 'Terrace' },
        ],
        owner: user2._id,
        status: 'published',
        featured: true,
      },
      {
        title: 'Modern 3BHK Duplex in Golf Course Road',
        description: 'Super-premium luxury condo along Gurgaon prime real estate strip. Features VRV air-conditioning, wrap-around balcony with golf course greens views, and 2 designated basement car park slots.',
        propertyType: 'apartment',
        listingType: 'rent',
        price: 110000, // ₹1,10,000 / month
        city: 'Gurugram',
        state: 'Haryana',
        locality: 'Golf Course Road, DLF Phase 5',
        pincode: '122002',
        bedrooms: 3,
        bathrooms: 3,
        areaSqFt: 2200,
        amenities: ['Golf View', 'Concierge Service', 'Swimming Pool', 'Spa & Sauna', 'Clubhouse', 'Valet Parking'],
        images: [
          { url: 'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1200&q=80', caption: 'Condo Interior' },
          { url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80', caption: 'Dining & Bar' },
          { url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', caption: 'Master Bed' },
        ],
        owner: user2._id,
        status: 'published',
        featured: false,
      },
      {
        title: 'Prime Grade-A Commercial IT Office Space',
        description: 'Fully furnished warm shell office floor suitable for fintech or tech startup of 40-70 team members. Equipped with high-efficiency centralized HVAC, dual power redundancy, and access-controlled turnstiles.',
        propertyType: 'commercial',
        listingType: 'rent',
        price: 280000, // ₹2,80,000 / month
        city: 'Hyderabad',
        state: 'Telangana',
        locality: 'HITEC City',
        pincode: '500081',
        bedrooms: 0,
        bathrooms: 4,
        areaSqFt: 4200,
        amenities: ['Central HVAC', '100% DG Backup', 'Cafeteria', 'Conference Rooms', 'High Speed Fiber', 'Security Turnstiles'],
        images: [
          { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', caption: 'Office Floor' },
          { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80', caption: 'Conference Room' },
        ],
        owner: user2._id,
        status: 'published',
        featured: false,
      }
    ];

    const createdProperties = await Property.insertMany(propertiesData);
    console.log(`[Seed] Successfully inserted ${createdProperties.length} properties.`);

    console.log('[Seed] Creating demo viewing appointments...');
    await Appointment.create({
      property: createdProperties[0]._id,
      user: user2._id,
      guestName: user2.name,
      guestEmail: user2.email,
      guestPhone: user2.phone,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      status: 'pending',
      notes: 'Interested in weekend site visit with family.',
    });

    await Appointment.create({
      property: createdProperties[1]._id,
      guestName: 'Rohit Verma',
      guestEmail: 'rohit.verma@example.com',
      guestPhone: '+91 99887 76655',
      scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      status: 'confirmed',
      notes: 'Please confirm if interior tour of guest cottage is included.',
    });

    console.log('[Seed] Seed completed successfully!');
    await disconnectDatabase();
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}
