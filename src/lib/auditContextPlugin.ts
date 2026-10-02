import mongoose, { Schema } from "mongoose";
import { getContextUserId } from "./requestContext";

/**
 * Mongoose plugin applied to all models.
 * Adds:
 *  - timestamps (createdAt, updatedAt)
 *  - createdBy (User ObjectId)
 *  - updatedBy (User ObjectId)
 * Automatically sets createdBy and updatedBy from authenticated request context.
 */
export function auditContextPlugin(schema: Schema) {
  // Ensure schema options include timestamps
  schema.set("timestamps", true);

  // Add createdBy and updatedBy paths if not already defined
  if (!schema.path("createdBy")) {
    schema.add({
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
        required: false,
      },
    });
  }

  if (!schema.path("updatedBy")) {
    schema.add({
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
        required: false,
      },
    });
  }

  // Pre-save hook for document creation and updates
  schema.pre("save", function (this: any) {
    try {
      const currentUserId = getContextUserId() || this.$locals?.userId;
      if (currentUserId) {
        if (this.isNew) {
          if (!this.createdBy) {
            this.createdBy = currentUserId;
          }
          if (!this.updatedBy) {
            this.updatedBy = currentUserId;
          }
        } else if (typeof this.isModified === "function" ? this.isModified() : true) {
          this.updatedBy = currentUserId;
        }
      }
    } catch (_) {
      // Proceed safely without blocking writes
    }
  });

  // Pre hooks for query-based updates (updateOne, findOneAndUpdate, updateMany)
  schema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function (this: any) {
    try {
      const options = typeof this.getOptions === "function" ? this.getOptions() : {};
      const currentUserId = getContextUserId() || options?.userId || options?.userContext?.userId;
      if (currentUserId) {
        const update = this.getUpdate() as any;
        if (update) {
          if (update.$set) {
            update.$set.updatedBy = currentUserId;
          } else if (!Object.keys(update).some((k: string) => k.startsWith("$"))) {
            update.updatedBy = currentUserId;
          } else {
            update.$set = update.$set || {};
            update.$set.updatedBy = currentUserId;
          }
        }
      }
    } catch (_) {
      // Proceed safely
    }
  });
}

/**
 * Registers the auditContextPlugin globally with Mongoose.
 * Also retroactively applies to any already compiled models.
 */
export function applyGlobalAuditContextPlugin() {
  mongoose.plugin(auditContextPlugin);

  // Retroactively apply to any models already compiled
  for (const modelName of Object.keys(mongoose.models)) {
    const model = mongoose.models[modelName];
    if (model && model.schema) {
      auditContextPlugin(model.schema);
    }
  }
}
