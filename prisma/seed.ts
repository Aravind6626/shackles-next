import { Permission, PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const activeYear = Number(process.env.ACTIVE_YEAR) || new Date().getUTCFullYear()
  const password = await hash('admin123', 10) // Default password

  const defaultRolePermissions: Array<{ role: Role; permissions: Permission[] }> = [
    {
      role: Role.ADMIN,
      permissions: [
        Permission.SCAN_ATTENDANCE,
        Permission.SCAN_KIT,
        Permission.ONSPOT_INDIVIDUAL_REG,
        Permission.ONSPOT_TEAM_REG,
        Permission.MANAGE_TEAMS,
        Permission.MANAGE_SCORES,
      ],
    },
    {
      role: Role.COORDINATOR,
      permissions: [
        Permission.SCAN_ATTENDANCE,
        Permission.SCAN_KIT,
        Permission.ONSPOT_INDIVIDUAL_REG,
        Permission.ONSPOT_TEAM_REG,
        Permission.MANAGE_TEAMS,
        Permission.MANAGE_SCORES,
      ],
    },
    {
      role: Role.VOLUNTEER,
      permissions: [
        Permission.SCAN_ATTENDANCE,
        Permission.SCAN_KIT,
        Permission.ONSPOT_INDIVIDUAL_REG,
        Permission.ONSPOT_TEAM_REG,
      ],
    },
  ]

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shackles.com' },
    update: {},
    create: {
      email: 'admin@shackles.com',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '0000000000',
      password,
      role: 'ADMIN',
      // Dummy data for required fields
      collegeName: 'ACGCET',
      collegeLoc: 'Karaikudi',
      department: 'Mechanical',
      yearOfStudy: 'IV'
    },
  })

  console.log({ admin })

  await prisma.rolePermission.deleteMany({
    where: {
      role: {
        in: defaultRolePermissions.map((item) => item.role),
      },
    },
  })

  await prisma.rolePermission.createMany({
    data: defaultRolePermissions.flatMap((item) =>
      item.permissions.map((permission) => ({ role: item.role, permission }))
    ),
    skipDuplicates: true,
  })

  console.log('Default role permissions seeded')

  // --- SEED EVENTS ---
  const events = [
    { name: "Paper Presentation", type: "TECHNICAL" },
    { name: "Aqua Missile", type: "NON-TECHNICAL" },
    { name: "CAD Modelling", type: "TECHNICAL" },
    { name: "Treasure Hunt", type: "NON-TECHNICAL" },
    { name: "Workshop: EV Tech", type: "TECHNICAL" }
  ]

  for (const evt of events) {
    await prisma.event.upsert({
      where: { year_name: { year: activeYear, name: evt.name } },
      update: {
        type: evt.type,
        isTemplate: true,
        isArchived: false,
        isActive: false,
        templateSourceId: null,
      },
      create: {
        name: evt.name,
        year: activeYear,
        type: evt.type,
        date: new Date(),
        isTemplate: true,
        isArchived: false,
        isActive: false,
        templateSourceId: null,
      },
    })
  }
  console.log("Template events seeded")
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