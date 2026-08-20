const Member = require("../models/Member.model");

/**
 * Generates a unique, sequential Member ID based on current year.
 * Output format: MEM/0001/2026
 */
const generateMemberId = async (prefix = "MEM") => {
  const currentYear = new Date().getFullYear();

  // Count existing members to determine sequence number
  const count = await Member.countDocuments();

  // Pad counter with leading zeros up to 4 digits (e.g. 1 -> 0001)
  const sequence = String(count + 1).padStart(4, "0");

  // Output format: MEM/0001/2026
  return `${prefix}/${sequence}/${currentYear}`;
};

module.exports = generateMemberId;