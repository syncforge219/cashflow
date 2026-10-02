import mongoose, { Schema } from "mongoose";

export interface ISoftDeleteDocument {
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
}

/**
 * Mongoose plugin implementing soft delete.
 * Adds:
 *  - isDeleted (Boolean, default: false, indexed)
 *  - deletedAt (Date, default: null)
 *  - deletedBy (User ObjectId, default: null)
 *
 * Automatically excludes deleted documents from find, findOne, findOneAndUpdate,
 * countDocuments, distinct, and aggregation queries unless { includeDeleted: true }
 * is passed or isDeleted is explicitly specified in the query filter.
 */
export function softDeletePlugin(schema: Schema) {
  if (!schema.path("isDeleted")) {
    schema.add({
      isDeleted: {
        type: Boolean,
        default: false,
        index: true,
      },
      deletedAt: {
        type: Date,
        default: null,
      },
      deletedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    });
  }

  // Pre-query hooks to filter out soft-deleted records
  const queryOps = ["find", "findOne", "findOneAndUpdate", "countDocuments", "distinct"] as const;

  schema.pre(queryOps, function (this: any) {
    const options = typeof this.getOptions === "function" ? this.getOptions() : {};
    if (options && options.includeDeleted === true) {
      return;
    }

    const filter = typeof this.getFilter === "function" ? this.getFilter() : {};
    if (filter && filter.isDeleted !== undefined) {
      return;
    }

    this.where({ isDeleted: { $ne: true } });
  });

  // Pre-aggregation hook to prepend { $match: { isDeleted: { $ne: true } } }
  schema.pre("aggregate", function (this: any) {
    const options = (this as any).options || {};
    if (options && options.includeDeleted === true) {
      return;
    }

    const pipeline = this.pipeline();
    const firstStage = pipeline[0];
    if (firstStage && firstStage.$match && firstStage.$match.isDeleted !== undefined) {
      return;
    }

    pipeline.unshift({ $match: { isDeleted: { $ne: true } } });
  });

  // Document instance methods
  schema.methods.softDelete = async function (this: any, userId?: any) {
    let resolvedUserId: mongoose.Types.ObjectId | null = null;
    if (userId) {
      if (userId instanceof mongoose.Types.ObjectId) {
        resolvedUserId = userId;
      } else if (mongoose.Types.ObjectId.isValid(String(userId))) {
        resolvedUserId = new mongoose.Types.ObjectId(String(userId));
      }
    }

    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = resolvedUserId;
    return await this.save();
  };

  schema.methods.restore = async function (this: any) {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return await this.save();
  };
}
