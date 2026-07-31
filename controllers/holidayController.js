import Holiday from "../models/Holiday.js";

const holidays2026 = [
  { name: "New Year's Day", date: new Date("2026-01-01T00:00:00.000Z") },
  { name: "Makara Sankranti", date: new Date("2026-01-14T00:00:00.000Z") },
  { name: "Republic Day", date: new Date("2026-01-26T00:00:00.000Z") },
  { name: "Holi", date: new Date("2026-03-04T00:00:00.000Z") },
  { name: "Ugadi", date: new Date("2026-03-19T00:00:00.000Z") },
  { name: "Independence Day", date: new Date("2026-08-15T00:00:00.000Z") },
  { name: "Raksha Bandhan", date: new Date("2026-08-28T00:00:00.000Z") },
  { name: "Ganesh Chaturthi", date: new Date("2026-09-14T00:00:00.000Z") },
  { name: "Dusheera", date: new Date("2026-10-20T00:00:00.000Z") },
  { name: "Deepavali (Diwali)", date: new Date("2026-11-08T00:00:00.000Z") },
  { name: "Christmas Day", date: new Date("2026-12-25T00:00:00.000Z") },
];

export const getHolidays = async (req, res) => {
  try {
    let holidays = await Holiday.find().sort({ date: 1 });
    if (holidays.length === 0) {
      await Holiday.insertMany(holidays2026);
      holidays = await Holiday.find().sort({ date: 1 });
    }
    res.status(200).json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
