import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PaperSubmissionCard from "@/components/features/PaperSubmissionCard";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDownloadUrl } from "@/lib/storage-url";

export default async function SubmitAbstractPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await getSession();

  if (!session?.userId) {
    redirect(`/login?callbackUrl=/submit-abstract/${teamId}`);
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      event: true,
      paperSubmission: true,
      members: true,
    },
  });

  if (!team) {
    redirect("/userDashboard");
  }

  const isMember = team.members.some((m) => m.userId === session.userId);
  if (!isMember) {
    redirect("/userDashboard");
  }

  const isLeader = team.leaderUserId === session.userId;
  const paperSubmission = team.paperSubmission;

  if (paperSubmission) {
    paperSubmission.abstractUrl = await getDownloadUrl(paperSubmission.abstractUrl) as string | null;
    paperSubmission.presentationUrl = await getDownloadUrl(paperSubmission.presentationUrl) as string | null;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 md:gap-8 px-4 py-8">
      <div className="flex items-center gap-2">
        <Link
          href="/userDashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-xs">
        <div className="mb-6 border-b border-gray-100 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">
            Document Submission
          </p>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {team.event.name}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Team: <span className="font-semibold text-gray-900">{team.name}</span>
          </p>
        </div>

        {paperSubmission ? (
          <div className="max-w-2xl">
            <PaperSubmissionCard
              submission={{
                id: paperSubmission.id,
                teamId: paperSubmission.teamId,
                eventId: paperSubmission.eventId,
                abstractUrl: paperSubmission.abstractUrl,
                abstractSubmittedAt: paperSubmission.abstractSubmittedAt?.toISOString() || null,
                abstractDeadline: paperSubmission.abstractDeadline?.toISOString() || null,
                selectionStatus: paperSubmission.selectionStatus,
                selectedAt: paperSubmission.selectedAt?.toISOString() || null,
                selectionNote: paperSubmission.selectionNote,
                presentationUrl: paperSubmission.presentationUrl,
                presentationSubmittedAt: paperSubmission.presentationSubmittedAt?.toISOString() || null,
                presentationDeadline: paperSubmission.presentationDeadline?.toISOString() || null,
              }}
              isLeader={isLeader}
              teamName={team.name}
              eventName={team.event.name}
            />
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
            <p className="text-sm text-amber-800">
              No submission record found for this team. This event might not require a document submission, or the team is not fully locked yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
