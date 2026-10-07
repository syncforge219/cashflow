import crypto from "crypto";

/**
 * Random API key for a lead connector's webhook. Each installation gets its own key on first use;
 * a fixed key written in the source code would be known to anyone who has seen the code.
 */
export function generateConnectorApiKey(prefix = "JD"): string {
  return `${prefix}-${crypto.randomBytes(18).toString("hex").toUpperCase()}`;
}
