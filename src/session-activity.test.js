"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeSessionActivityState,
  patchSessionStoreActivityMerge
} = require("./session-activity");

test("mergeSessionActivityState keeps fresher persisted tab activity during character saves", () => {
  const merged = mergeSessionActivityState(
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      flash: { type: "success", text: "Charakter aktualisiert." },
      last_tab_heartbeat_at: 1_000
    },
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      open_tab_ids: {
        activeTab: 2_000
      },
      last_tab_heartbeat_at: 2_000,
      last_page_path: "/characters/7/edit",
      last_page_title: "Bearbeiten: Test"
    },
    2_100
  );

  assert.deepEqual(merged.open_tab_ids, { activeTab: 2_000 });
  assert.equal(merged.last_tab_heartbeat_at, 2_000);
  assert.equal(merged.last_page_path, "/characters/7/edit");
  assert.equal(merged.last_page_title, "Bearbeiten: Test");
  assert.deepEqual(merged.flash, { type: "success", text: "Charakter aktualisiert." });
});

test("mergeSessionActivityState keeps guestbook editor sessions active while saving", () => {
  const merged = mergeSessionActivityState(
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      flash: { type: "success", text: "Gästebuch gespeichert." },
      preferred_character_ids: { "free-rp": 12 }
    },
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      open_tab_ids: {
        guestbookEditorTab: 7_200
      },
      last_tab_heartbeat_at: 7_200,
      last_page_path: "/characters/12/guestbook/edit?page_id=2",
      last_page_title: "Gästebuch bearbeiten"
    },
    7_250
  );

  assert.deepEqual(merged.open_tab_ids, { guestbookEditorTab: 7_200 });
  assert.equal(merged.last_tab_heartbeat_at, 7_200);
  assert.equal(merged.last_page_path, "/characters/12/guestbook/edit?page_id=2");
  assert.deepEqual(merged.preferred_character_ids, { "free-rp": 12 });
  assert.deepEqual(merged.flash, { type: "success", text: "Gästebuch gespeichert." });
});

test("mergeSessionActivityState honors explicit tab close over stale persisted tabs", () => {
  const merged = mergeSessionActivityState(
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      last_all_tabs_closed_at: 5_000
    },
    {
      cookie: { maxAge: 123 },
      user: { id: 42 },
      open_tab_ids: {
        closedTab: 4_000
      },
      last_tab_heartbeat_at: 4_000
    },
    5_100
  );

  assert.equal("open_tab_ids" in merged, false);
  assert.equal(merged.last_all_tabs_closed_at, 5_000);
  assert.equal(merged.last_tab_heartbeat_at, 4_000);
});

test("patchSessionStoreActivityMerge merges persisted activity before saving", async () => {
  const now = Date.now();
  const calls = [];
  const store = {
    get(sid, callback) {
      callback(null, {
        user: { id: 7 },
        open_tab_ids: {
          editorTab: now
        },
        last_tab_heartbeat_at: now,
        last_page_path: "/characters/9/edit",
        last_page_title: "Bearbeiten: Demo"
      });
    },
    set(sid, sessionData, callback) {
      calls.push({ sid, sessionData });
      callback();
    }
  };

  patchSessionStoreActivityMerge(store);

  await new Promise((resolve, reject) => {
    store.set(
      "abc123",
      {
        user: { id: 7 },
        flash: { type: "success", text: "Gespeichert." }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sid, "abc123");
  assert.deepEqual(calls[0].sessionData.open_tab_ids, { editorTab: now });
  assert.equal(calls[0].sessionData.last_page_path, "/characters/9/edit");
  assert.deepEqual(calls[0].sessionData.flash, { type: "success", text: "Gespeichert." });
});
