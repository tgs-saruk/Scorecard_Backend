async function performBulkUpdate({
  model,
  ids,
  updateData,
  options = {},
  validation,
}) {
  if (!model || !ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error("Invalid input parameters");
  }
  if (validation && typeof validation === "function") {
    const validationError = validation(updateData);
    if (validationError) {
      throw new Error(validationError);
    }
  }
  const result = await model.updateMany(
    { _id: { $in: ids } },
    { $set: updateData },
    { new: true, ...options }
  );

  if (result.modifiedCount === 0) {
    throw new Error("No documents were updated");
  }
  const updatedDocs = await model
    .find({ _id: { $in: ids } })
    .populate(options.populate || []);

  return {
    message: `${result.modifiedCount} documents updated successfully`,
    updatedDocs,
    modifiedCount: result.modifiedCount,
  };
}
async function findMatchingTerm(termRecords, terms, itemDate) {
  if (!itemDate) return null;
  // Ensure we have a proper Date object
  let dateObj = itemDate instanceof Date ? itemDate : new Date(itemDate);
  // If date is invalid, return null
  if (isNaN(dateObj.getTime())) {
    return null;
  }
  // Get ISO string for proper UTC comparison
  const itemDateISO = dateObj.toISOString();
  const itemDateUTC = new Date(itemDateISO);

  // 🔴 Past vote rule
  const pastBoundary = new Date("2019-01-02T23:59:59Z");  
  if (itemDateUTC <= pastBoundary) {
    return { type: "past" };
  }

  let matchFound = false;
  for (const term of termRecords) {
    let termDef = null;

    // If already populated as an object
    if (term && typeof term.termId === "object") {
      termDef = term.termId;
    } else if (term && term.termId) {
      const tid = String(term.termId);

      // Try matching by _id
      termDef = terms.find((t) => String(t._id) === tid);

      // Try matching by name (exact)
      if (!termDef) {
        termDef = terms.find((t) => String(t.name) === tid);
      }

      // Try matching by startYear-endYear format (e.g. "2025-2026")
      if (!termDef && tid.includes("-")) {
        termDef = terms.find(
          (t) => `${t.startYear}-${t.endYear}` === tid || `${t.startYear}-${t.endYear}` === tid.trim()
        );
      }
    }

    if (!termDef) {
      continue;
    }

    const start = new Date(`${termDef.startYear}-01-03T00:00:00Z`);
    const end = new Date(`${termDef.endYear}-01-02T23:59:59Z`);
    if (itemDateUTC >= start && itemDateUTC <= end) {
      matchFound = true;
      return { type: "current", term };
    } else {
      console.log(`      ❌ NO MATCH: Item outside this term bounds`);
    }
  }

  if (!matchFound) {
    console.log(`   ❌ NO MATCHING TERM FOUND`);
  }
  return null;
}

module.exports = {
  performBulkUpdate,
  findMatchingTerm
};
