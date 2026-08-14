import { prisma } from "./prisma.js";
import type { Prisma } from "@prisma/client";

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    bookingId: string;
    serviceName: string;
    contactName: string;
    contactPhone: string;
    bookingDate: Date;
    overlapMinutes: number;
  }>;
}

/**
 * Check for overlapping confirmed bookings within same day + ±1 hour buffer
 * Returns conflict details if found
 */
export async function checkBookingConflicts(
  tenantId: string,
  bookingDate: Date,
  excludeBookingId?: string, // exclude current booking when updating
  durationHours: number = 2, // assume 2h default service duration
): Promise<ConflictResult> {
  const startWindow = new Date(bookingDate.getTime() - 60 * 60 * 1000); // -1h buffer
  const endWindow = new Date(bookingDate.getTime() + (durationHours + 1) * 60 * 60 * 1000); // +1h buffer
  
  const whereClause: Prisma.BookingWhereInput = {
    tenantId,
    status: "confirmed", // only confirmed bookings conflict
    bookingDate: {
      gte: startWindow,
      lte: endWindow,
    },
  };

  if (excludeBookingId) {
    whereClause.id = { not: excludeBookingId };
  }

  const conflictingBookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      contact: true,
    },
  });
  
  const conflicts: ConflictResult["conflicts"] = [];
  
  for (const booking of conflictingBookings) {
    const bookingStart = new Date(booking.bookingDate);
    const bookingEnd = new Date(bookingStart.getTime() + durationHours * 60 * 60 * 1000);
    const newStart = bookingDate;
    const newEnd = new Date(newStart.getTime() + durationHours * 60 * 60 * 1000);
    
    // Check overlap: (startA < endB) AND (startB < endA)
    if (newStart < bookingEnd && bookingStart < newEnd) {
      // Calculate overlap minutes
      const overlapStart = newStart > bookingStart ? newStart : bookingStart;
      const overlapEnd = newEnd < bookingEnd ? newEnd : bookingEnd;
      const overlapMinutes = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
      
      conflicts.push({
        bookingId: booking.id,
        serviceName: booking.serviceName,
        contactName: booking.contact.name,
        contactPhone: booking.contact.phone,
        bookingDate: booking.bookingDate,
        overlapMinutes,
      });
    }
  }
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}
