import Counter from "@/models/Counter";

/**
 * Generates an atomic, collision-free sequential ID using MongoDB's $inc operator.
 *
 * @param counterName Unique key for the sequence counter (e.g., "admissionId", "enquiryId")
 * @param prefix Text prefix for the formatted ID (e.g., "ADM", "ENQ")
 * @param padLength Total digits to zero-pad (e.g., 6 -> "000123")
 * @param getInitialHighestNumber Optional async fallback to discover the current highest number in the collection
 * @returns Formatted sequence string (e.g., "ADM000124")
 */
export async function getNextSequence(
  counterName: string,
  prefix: string,
  padLength: number = 6,
  getInitialHighestNumber?: () => Promise<number>
): Promise<string> {
  // Try atomic increment directly
  let counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: false }
  );

  // If counter document does not exist yet, initialize it gracefully from existing collection data
  if (!counter) {
    let initialSeq = 0;
    if (getInitialHighestNumber) {
      try {
        initialSeq = await getInitialHighestNumber();
      } catch (err) {
        console.warn(`[sequenceHelper] Could not determine initial sequence for ${counterName}:`, err);
      }
    }

    try {
      counter = await Counter.findOneAndUpdate(
        { name: counterName },
        { $setOnInsert: { seq: initialSeq + 1 } },
        { upsert: true, new: true }
      );
    } catch (err: any) {
      // Handle potential race during upsert
      if (err.code === 11000) {
        counter = await Counter.findOneAndUpdate(
          { name: counterName },
          { $inc: { seq: 1 } },
          { new: true }
        );
      } else {
        throw err;
      }
    }
  }

  const seqNumber = counter?.seq || 1;
  return `${prefix}${String(seqNumber).padStart(padLength, "0")}`;
}
