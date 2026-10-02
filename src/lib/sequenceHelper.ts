import mongoose from "mongoose";
import Counter from "@/models/Counter";

/**
 * Generates an atomic, collision-free sequential ID using MongoDB's $inc operator.
 * When a transaction session is provided, findOneAndUpdate uses that session,
 * guaranteeing that sequence numbers roll back without gaps if the transaction aborts.
 *
 * @param counterName Unique key for the sequence counter (e.g., "admissionId", "enquiryId")
 * @param prefix Text prefix for the formatted ID (e.g., "ADM", "ENQ")
 * @param padLength Total digits to zero-pad (e.g., 6 -> "000123")
 * @param getInitialHighestNumber Optional async fallback to discover the current highest number in the collection
 * @param session Optional active MongoDB ClientSession from the document being saved
 * @returns Formatted sequence string (e.g., "ADM000124")
 */
export async function getNextSequence(
  counterName: string,
  prefix: string,
  padLength: number = 6,
  getInitialHighestNumber?: () => Promise<number>,
  session?: mongoose.ClientSession | null
): Promise<string> {
  const queryOptions: mongoose.QueryOptions = { new: true, upsert: false };
  if (session) {
    queryOptions.session = session;
  }

  // Try atomic increment directly
  let counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    queryOptions
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
      const upsertOptions: mongoose.QueryOptions = { upsert: true, new: true };
      if (session) {
        upsertOptions.session = session;
      }

      counter = await Counter.findOneAndUpdate(
        { name: counterName },
        { $setOnInsert: { seq: initialSeq + 1 } },
        upsertOptions
      );
    } catch (err: any) {
      // Handle potential race during upsert
      if (err.code === 11000) {
        const retryOptions: mongoose.QueryOptions = { new: true };
        if (session) {
          retryOptions.session = session;
        }
        counter = await Counter.findOneAndUpdate(
          { name: counterName },
          { $inc: { seq: 1 } },
          retryOptions
        );
      } else {
        throw err;
      }
    }
  }

  const seqNumber = counter?.seq || 1;
  return `${prefix}${String(seqNumber).padStart(padLength, "0")}`;
}
