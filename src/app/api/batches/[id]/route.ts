import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Batch from "@/models/Batch";
import User from "@/models/User";
import { computeBatchStatus } from "@/lib/batchHelper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const batchFilter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { batchId: id };
    const batch = await Batch.findOne(batchFilter).lean();

    if (!batch) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    const calculatedStatus = computeBatchStatus(batch.startDate, batch.endDate, batch.status);
    if (calculatedStatus !== batch.status && batch.status !== "Cancelled") {
      await Batch.updateOne({ _id: batch._id }, { status: calculatedStatus });
      batch.status = calculatedStatus;
    }

    return NextResponse.json({ success: true, data: batch });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batch" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    if (body.teacherId && mongoose.Types.ObjectId.isValid(body.teacherId)) {
      const teacher = await User.findById(body.teacherId);
      if (teacher) {
        body.teacherName = teacher.name;
      }
    }

    if (body.startDate) {
      body.startDate = new Date(body.startDate);
    }
    if (body.endDate) {
      body.endDate = new Date(body.endDate);
    }

    const batchFilter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { batchId: id };
    const oldBatch = await Batch.findOne(batchFilter);
    if (!oldBatch) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    // Determine target status
    const effectiveStart = body.startDate !== undefined ? body.startDate : oldBatch.startDate;
    const effectiveEnd = body.endDate !== undefined ? body.endDate : oldBatch.endDate;
    const explicitStatus = body.status;

    if (!explicitStatus || (explicitStatus !== "Cancelled" && (body.startDate !== undefined || body.endDate !== undefined))) {
      body.status = computeBatchStatus(effectiveStart, effectiveEnd, explicitStatus || oldBatch.status);
    }

    const updatedBatch = await Batch.findByIdAndUpdate(oldBatch._id, body, {
      new: true,
      runValidators: true,
    });

    if (body.batchName && oldBatch.batchName !== body.batchName) {
      const Admission = (await import("@/models/Admission")).default;
      const orList: any[] = [{ batch: oldBatch.batchName }];
      if (oldBatch.batchId) {
        orList.push({ batchId: oldBatch.batchId });
      }
      await Admission.updateMany(
        { $or: orList },
        { $set: { batch: body.batchName.trim(), batchId: oldBatch.batchId || updatedBatch?.batchId } }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch updated successfully",
      data: updatedBatch,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update batch" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const batchFilter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { batchId: id };
    const deletedBatch = await Batch.findOneAndDelete(batchFilter);

    if (!deletedBatch) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete batch" },
      { status: 500 }
    );
  }
}
