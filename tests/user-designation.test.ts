// Run with: node --test --experimental-test-module-mocks tests/user-designation.test.ts
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);
process.env.DISABLE_CRON = "true";

// The users API asks auth for the signed-in user; here it is always a super admin
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/auth.ts")).href, {
  namedExports: {
    getAuthenticatedUser: async () => ({ _id: new mongoose.Types.ObjectId(), name: "Admin", role: "super admin" }),
  },
});

describe("Admin adds a marketing user with a title", () => {
  let mongod: MongoMemoryServer;
  let users: any;
  let User: any;

  const send = async (method: string, body: any) => {
    const res = await users[method](
      new Request("http://localhost/api/users", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    );
    return { status: res.status, json: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("designation_test");
    users = await import("../src/app/api/users/route");
    User = (await import("../src/models/User")).default;
    await (await import("../src/lib/db")).default();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("creates a marketing user with the chosen title", async () => {
    const { status, json } = await send("POST", {
      name: "Meera",
      email: "meera@example.com",
      password: "secret123",
      role: "marketing executive",
      designation: "  Digital   Marketing Manager ",
    });
    assert.equal(status, 201, JSON.stringify(json));
    assert.equal(json.data.role, "marketing executive");
    assert.equal(json.data.designation, "Digital Marketing Manager");
    assert.equal(json.data.password, undefined);
  });

  test("a marketing user without a title gets the default title", async () => {
    const { json } = await send("POST", { name: "Ravi", email: "ravi@example.com", password: "secret123", role: "marketing executive" });
    assert.equal(json.data.designation, "Marketing Executive");
  });

  test("custom titles are allowed and capped; other roles keep an optional title", async () => {
    const long = "Google Ads Specialist ".repeat(10);
    const { json } = await send("POST", { name: "Kiran", email: "kiran@example.com", password: "secret123", role: "marketing executive", designation: long });
    assert.ok(json.data.designation.startsWith("Google Ads Specialist"));
    assert.ok(json.data.designation.length <= 80);

    const c = await send("POST", { name: "Cara", email: "cara@example.com", password: "secret123", role: "counsellor" });
    assert.equal(c.json.data.designation, "");
  });

  test("editing: title changes, clearing it on a marketing user falls back to the default", async () => {
    const meera = await User.findOne({ email: "meera@example.com" });
    let r = await send("PUT", { id: meera._id, designation: "Head of Marketing" });
    assert.equal(r.json.data.designation, "Head of Marketing");

    r = await send("PUT", { id: meera._id, designation: "" });
    assert.equal(r.json.data.designation, "Marketing Executive");

    // Changing other fields leaves the title alone
    r = await send("PUT", { id: meera._id, phone: "9999999999" });
    assert.equal(r.json.data.designation, "Marketing Executive");
  });
});
