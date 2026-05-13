import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import KitDistributionScanner from '@/components/features/KitDistributionScanner'
import Link from 'next/link'
import { ChevronLeft, Info } from 'lucide-react'

export default async function KitScannerPage({
  searchParams: propsSearchParams,
}: {
  searchParams: Promise<{ eventId?: string }>
}) {
  const searchParams = await propsSearchParams
  const session = await getSession()
  if (!session?.userId) {
    redirect('/login')
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { role: true },
  })

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'COORDINATOR' && currentUser.role !== 'VOLUNTEER')) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-100/50 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-100/50 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Navigation */}
        <div className="mb-10 flex items-center justify-between">
          <Link 
            href="/staff/volunteerDashboard"
            className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-all"
          >
            <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-200 group-hover:border-blue-200 group-hover:shadow-blue-50 transition-all">
              <ChevronLeft size={20} />
            </div>
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            System Online
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-12 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Operations Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Kit <span className="text-blue-600">Distribution</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-xl leading-relaxed">
            Scan participant QR codes to verify their registration and issue symposium kits. Ensure all items are included before confirming.
          </p>
        </div>

        {/* Alert/Info Section */}
        <div className="mb-10 p-5 bg-indigo-50/50 border border-indigo-100 rounded-3xl flex items-start gap-4">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Info size={20} />
          </div>
          <div>
            <h4 className="font-bold text-indigo-900 mb-1">Operational Protocol</h4>
            <p className="text-indigo-700/80 text-sm leading-relaxed">
              Verify the participant's identity in the results card before clicking <span className="font-bold">ISSUE KIT</span>. Once issued, the status cannot be reversed via this terminal.
            </p>
          </div>
        </div>

        {/* Scanner Component */}
        <div className="w-full">
          <KitDistributionScanner />
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <p className="text-slate-400 text-xs font-medium tracking-widest uppercase">
            Shackles Logistics Terminal &bull; 2026 Edition
          </p>
        </div>
      </div>
    </div>
  )
}

