import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeRecent } from "@/lib/mobile/offlineCache";

test("nieuwste eerst, geen dubbelen, maximaal N", () => {
  const list = [{ id: "a", title: "A" }, { id: "b", title: "B" }];
  assert.deepEqual(mergeRecent(list, { id: "b", title: "B2" }).map((i) => i.id), ["b", "a"]);
  assert.equal(mergeRecent(list, { id: "c", title: "C" }, 2).length, 2);
});
