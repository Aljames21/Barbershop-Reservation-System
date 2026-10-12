
require("dotenv").config();

const mongoose = require("mongoose");
const Appointment = require("../Models/Appointment");
const BookingSlot = require("../Models/BookingSlot");

async function backfillBookingSlots() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const appointments = await Appointment.find({
    status: { $nin: ["Cancelled", "Declined", "Completed"] },
    barber: { $exists: true, $ne: "" }
    }).lean();

    const slots = await BookingSlot.find({}).lean();

    const normalize = (value) =>
      String(value || "").trim().toLowerCase();

    const slotKey = (date, time, barber) =>
      JSON.stringify([
        normalize(date),
        normalize(time),
        normalize(barber)
      ]);

    // Check duplicate appointments first.
    const seen = new Map();
    const conflicts = [];

    for (const appointment of appointments) {
      const key = slotKey(
        appointment.date,
        appointment.time,
        appointment.barber
      );

      if (seen.has(key)) {
        conflicts.push({
          date: appointment.date,
          time: appointment.time,
          barber: appointment.barber,
          appointmentIds: [
            String(seen.get(key)._id),
            String(appointment._id)
          ]
        });
      } else {
        seen.set(key, appointment);
      }
    }

   
if (conflicts.length > 0) {
  console.log("\nDUPLICATE APPOINTMENTS FOUND:");

  const ids = [
    ...new Set(
      conflicts.flatMap((item) => item.appointmentIds)
    )
  ];

  const records = await Appointment.find({
    _id: { $in: ids }
  })
    .select("_id customerName email service barber date time status createdAt")
    .lean();

  console.table(
    records.map((item) => ({
      id: String(item._id),
      customerName: item.customerName,
      service: item.service,
      barber: item.barber || "(empty)",
      date: item.date,
      time: item.time,
      status: item.status,
      createdAt: item.createdAt
    }))
  );

  console.log(
    "\nStopped. No BookingSlot records were added. Review the records before proceeding."
  );
  return;
}


    // Check for conflicts with existing BookingSlot records.
    const existingByAppointment = new Set(
      slots.map((slot) => String(slot.appointmentId))
    );

    const existingByKey = new Map(
      slots.map((slot) => [
        slotKey(slot.date, slot.time, slot.barber),
        slot
      ])
    );

    const toInsert = [];
    const slotConflicts = [];

    for (const appointment of appointments) {
      if (existingByAppointment.has(String(appointment._id))) {
        continue;
      }

      const key = slotKey(
        appointment.date,
        appointment.time,
        appointment.barber
      );

      const existingSlot = existingByKey.get(key);

      if (existingSlot) {
        slotConflicts.push({
          date: appointment.date,
          time: appointment.time,
          barber: appointment.barber,
          appointmentId: String(appointment._id),
          existingAppointmentId: String(existingSlot.appointmentId)
        });
        continue;
      }

      toInsert.push({
        date: appointment.date,
        time: appointment.time,
        barber: normalize(appointment.barber),
        appointmentId: appointment._id
      });

      // Also detect conflicts among records prepared in this run.
      existingByKey.set(key, {
        appointmentId: appointment._id
      });
    }

    if (slotConflicts.length > 0) {
      console.log("\nBOOKING SLOT CONFLICTS FOUND:");
      console.table(slotConflicts);
      console.log(
        "\nStopped. No new BookingSlot records were added. Review the conflicts first."
      );
      return;
    }

    if (toInsert.length > 0) {
      await BookingSlot.insertMany(toInsert, { ordered: true });
    }

    console.log("\nBackfill completed.");
    console.log("Active appointments checked:", appointments.length);
    console.log("New booking slots added:", toInsert.length);
    console.log("Existing slots skipped:", appointments.length - toInsert.length);
  } catch (error) {
    console.error("Backfill failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

backfillBookingSlots();
