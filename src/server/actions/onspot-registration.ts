'use server'

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { PaymentCaptureSource, PaymentChannel, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { verifyUserPayment } from '@/server/actions/admin';

type OnSpotListFilters = {
	search?: string;
	status?: PaymentStatus | 'ALL';
	paymentChannel?: PaymentChannel | 'ALL';
	page?: number;
	pageSize?: number;
};

type OnSpotParticipantRow = Prisma.UserGetPayload<{
	include: {
		payment: true;
		onSpotProfile: true;
		registrations: {
			include: {
				event: {
					select: { name: true };
				};
			};
		};
	};
}>;

async function requireAdminActor() {
	const session = await auth();
	if (!session?.user?.id) {
		return { ok: false as const, error: 'Authentication required.' };
	}
	if (session.user.role !== Role.ADMIN) {
		return { ok: false as const, error: 'Admin access required.' };
	}
	return { ok: true as const, actor: { id: session.user.id, role: session.user.role } };
}

export async function approveOnSpotPayment(input: { userId: string; deviceId?: string; note?: string }) {
	const actorResult = await requireAdminActor();
	if (!actorResult.ok) return { success: false, error: actorResult.error };

	const payment = await prisma.payment.findUnique({
		where: { userId: input.userId },
		select: { id: true, captureSource: true },
	});

	if (!payment || payment.captureSource !== PaymentCaptureSource.ON_SPOT) {
		return { success: false, error: 'On-spot payment record not found.' };
	}

	const result = await verifyUserPayment(input.userId, 'APPROVE');
	if (!result.success) {
		return { success: false, error: result.error || 'Unable to approve payment.' };
	}

	await prisma.payment.update({
		where: { userId: input.userId },
		data: {
			verifiedBy: actorResult.actor.id,
			verificationDeviceId: input.deviceId || null,
			verificationNote: input.note || null,
		},
	});

	revalidatePath('/admin/onspot-registration');
	return { success: true };
}

export async function rejectOnSpotPayment(input: { userId: string; reason?: string; note?: string }) {
	const actorResult = await requireAdminActor();
	if (!actorResult.ok) return { success: false, error: actorResult.error };

	const payment = await prisma.payment.findUnique({
		where: { userId: input.userId },
		select: { id: true, captureSource: true },
	});

	if (!payment || payment.captureSource !== PaymentCaptureSource.ON_SPOT) {
		return { success: false, error: 'On-spot payment record not found.' };
	}

	const result = await verifyUserPayment(input.userId, 'REJECT');
	if (!result.success) {
		return { success: false, error: result.error || 'Unable to reject payment.' };
	}

	await prisma.payment.update({
		where: { userId: input.userId },
		data: {
			rejectionReason: input.reason || null,
			verificationNote: input.note || null,
			verifiedBy: actorResult.actor.id,
		},
	});

	revalidatePath('/admin/onspot-registration');
	return { success: true };
}

export async function getOnSpotParticipants(filters: OnSpotListFilters = {}) {
	const actorResult = await requireAdminActor();
	if (!actorResult.ok) {
		return { success: false as const, error: actorResult.error, data: [] as OnSpotParticipantRow[], total: 0 };
	}

	const search = (filters.search || '').trim();
	const status = filters.status || 'ALL';
	const paymentChannel = filters.paymentChannel || 'ALL';
	const page = Math.max(1, filters.page || 1);
	const pageSize = filters.pageSize || 25;

	const where = {
		onSpotProfile: { isNot: null },
		...(search
			? {
					OR: [
						{ firstName: { contains: search, mode: 'insensitive' as const } },
						{ lastName: { contains: search, mode: 'insensitive' as const } },
						{ email: { contains: search, mode: 'insensitive' as const } },
						{ phone: { contains: search, mode: 'insensitive' as const } },
						{ shacklesId: { contains: search, mode: 'insensitive' as const } },
					],
				}
			: {}),
		payment: {
			...(status !== 'ALL' ? { status } : {}),
			...(paymentChannel !== 'ALL' ? { paymentChannel } : {}),
			captureSource: PaymentCaptureSource.ON_SPOT,
		},
	};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			include: {
				payment: true,
				onSpotProfile: true,
				registrations: {
					include: {
						event: {
							select: { name: true },
						},
					},
					orderBy: { createdAt: 'desc' },
					take: 5,
				},
			},
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.user.count({ where }),
	]);

	return { success: true as const, data: users, total };
}

export async function getOnSpotSummary() {
	const actorResult = await requireAdminActor();
	if (!actorResult.ok) {
		return {
			success: false,
			error: actorResult.error,
			data: { total: 0, pending: 0, verified: 0, rejected: 0, cash: 0, online: 0 },
		};
	}

	const [total, pending, verified, rejected, cash, online] = await Promise.all([
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT } }),
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT, status: PaymentStatus.PENDING } }),
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT, status: PaymentStatus.VERIFIED } }),
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT, status: PaymentStatus.REJECTED } }),
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT, paymentChannel: PaymentChannel.CASH } }),
		prisma.payment.count({ where: { captureSource: PaymentCaptureSource.ON_SPOT, paymentChannel: PaymentChannel.ONLINE } }),
	]);

	return {
		success: true,
		data: { total, pending, verified, rejected, cash, online },
	};
}