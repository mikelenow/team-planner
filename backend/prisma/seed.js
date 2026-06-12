const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getAustrianHolidays } = require('../src/utils/holidays');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Create default admin user ───────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mrnow.at' },
    update: {},
    create: {
      email: 'admin@mrnow.at',
      password: hashedPassword,
      name: 'Admin',
      isAdmin: true,
    },
  });
  console.log('  ✓ Admin user created:', admin.email);

  // ─── Create default roles ─────────────────────────────────────────────────
  const roles = [
    { name: 'Developer', shortName: 'DEV', color: '#3B82F6' },
    { name: 'Project Manager', shortName: 'PM', color: '#10B981' },
    { name: 'Designer', shortName: 'DES', color: '#F59E0B' },
    { name: 'QA Engineer', shortName: 'QA', color: '#8B5CF6' },
    { name: 'DevOps', shortName: 'OPS', color: '#EF4444' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('  ✓ Default roles created');

  // ─── Create default absence types ─────────────────────────────────────────
  const absenceTypes = [
    { name: 'Holiday', color: '#10B981', icon: 'palm-tree', isPaid: true },
    { name: 'Sick Leave', color: '#EF4444', icon: 'thermometer', isPaid: true },
    { name: 'Travelling', color: '#3B82F6', icon: 'plane', isPaid: true },
    { name: 'Training', color: '#8B5CF6', icon: 'graduation-cap', isPaid: true },
    { name: 'Personal Day', color: '#F59E0B', icon: 'user', isPaid: true },
    { name: 'Unpaid Leave', color: '#6B7280', icon: 'calendar-x', isPaid: false },
    { name: 'Parental Leave', color: '#EC4899', icon: 'baby', isPaid: true },
  ];

  for (const type of absenceTypes) {
    await prisma.absenceType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
  }
  console.log('  ✓ Absence types created');

  // ─── Create default teams ─────────────────────────────────────────────────
  const teams = [
    { name: 'Engineering', color: '#3B82F6' },
    { name: 'Product', color: '#10B981' },
    { name: 'Design', color: '#F59E0B' },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: team,
    });
  }
  console.log('  ✓ Default teams created');

  // ─── Seed Austrian holidays for 2026 and 2027 ─────────────────────────────
  const years = [2026, 2027];
  for (const year of years) {
    const holidays = getAustrianHolidays(year);
    for (const holiday of holidays) {
      await prisma.publicHoliday.upsert({
        where: { date: holiday.date },
        update: {},
        create: {
          name: holiday.name,
          date: holiday.date,
          isHalfDay: holiday.isHalfDay,
        },
      });
    }
    console.log(`  ✓ Austrian holidays seeded for ${year}`);
  }

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
