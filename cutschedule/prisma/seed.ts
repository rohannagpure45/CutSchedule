import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Note: Access control is managed by Google OAuth allowed test users
  // No admin table or admin user seeding needed

  // Create default working hours
  const defaultWorkingHours = [
    { dayOfWeek: 0, startTime: '10:00', endTime: '16:00', isActive: false }, // Sunday - Closed
    { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true },  // Monday
    { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isActive: true },  // Tuesday
    { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isActive: true },  // Wednesday
    { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isActive: true },  // Thursday
    { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isActive: true },  // Friday
    { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isActive: true },  // Saturday
  ]

  for (const hours of defaultWorkingHours) {
    const workingHour = await prisma.workingHours.upsert({
      where: {
        dayOfWeek: hours.dayOfWeek,
      },
      update: hours,
      create: hours,
    })

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hours.dayOfWeek]
    const status = hours.isActive ? `${hours.startTime} - ${hours.endTime}` : 'Closed'
    console.log(`✅ ${dayName}: ${status}`)
  }

  console.log('🎉 Database seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })