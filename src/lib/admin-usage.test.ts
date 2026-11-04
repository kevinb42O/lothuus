import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { usageInput } from "./admin-usage-validation";
import { usageActions } from "./admin-usage";
import { addCalendarMonths } from "./hosting/terms";
test("usage accepts only named actions and never browser-supplied identities, timestamps or form content", () => {
  const event = {
    id: randomUUID(),
    action: "plan_pro",
    section: "hosting",
    product: "pro_month",
  };
  assert.equal(usageInput.safeParse({ events: [event] }).success, true);
  for (const extra of [
    { actor: "someone" },
    { at: new Date().toISOString() },
    { text: "private field" },
    { url: "/private" },
  ])
    assert.equal(
      usageInput.safeParse({ events: [{ ...event, ...extra }] }).success,
      false,
    );
  assert.equal(
    usageInput.safeParse({ events: [{ ...event, action: "arbitrary_secret" }] })
      .success,
    false,
  );
  assert.equal(
    usageInput.safeParse({ events: Array.from({ length: 21 }, () => event) })
      .success,
    false,
  );
  for (const action of Object.keys(usageActions))
    assert.equal(
      usageInput.safeParse({
        events: [{ id: randomUUID(), action, section: "hosting" }],
      }).success,
      true,
    );
});
test("package calendar terms clamp month ends and reject invalid durations", () => {
  assert.equal(addCalendarMonths(new Date(2027, 0, 31, 12), 1).getDate(), 28);
  assert.equal(addCalendarMonths(new Date(2028, 0, 31, 12), 1).getDate(), 29);
  assert.equal(addCalendarMonths(new Date(2028, 1, 29, 12), 12).getDate(), 28);
  assert.throws(() => addCalendarMonths(new Date(), 0));
  assert.throws(() => addCalendarMonths(new Date("invalid"), 1));
});
