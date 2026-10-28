import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rateLimited } from "@/lib/auth/rate-limit";
import { isAdmin, isAdminRole, isOwnerRole, parseRole } from "@/lib/auth/roles";
import { PAGE_SIZE, listQuery, pageCount, parseListFilters } from "@/lib/beheer/list";
import { EDITABLE_COLUMNS, RESTORABLE_COLUMNS, activityEditSchema, bulkPatch, bulkSchema } from "@/lib/beheer/schemas";
import { canChangeState, deriveState, stateToColumns } from "@/lib/beheer/state";

describe("rollen", () => {
  it("kent alleen user, admin en owner (onbekend = user)", () => {
    assert.equal(parseRole("owner"), "owner");
    assert.equal(parseRole("superuser"), "user");
    assert.equal(parseRole(undefined), "user");
    assert.equal(parseRole({ role: "owner" }), "user");
  });
  it("admin en owner zijn beheerder, de rest niet", () => {
    assert.ok(isAdminRole("admin") && isAdminRole("owner"));
    assert.ok(!isAdminRole("user") && !isAdminRole(null) && !isAdminRole("ADMIN") && !isAdminRole(true));
    assert.ok(isOwnerRole("owner") && !isOwnerRole("admin"));
    assert.ok(isAdmin({ role: "admin" }) && !isAdmin({ role: "user" }) && !isAdmin(null) && !isAdmin(undefined) && !isAdmin({}));
  });
});

describe("status", () => {
  it("leidt een begrijpelijke stand af", () => {
    assert.equal(deriveState({ status: "draft", visibility: "private" }), "concept");
    assert.equal(deriveState({ status: "approved", visibility: "public" }), "gepubliceerd");
    assert.equal(deriveState({ status: "approved", visibility: "private" }), "gearchiveerd");
    assert.equal(deriveState({ status: "pending", visibility: "private" }), "in-beoordeling");
    assert.equal(deriveState({ status: "approved", visibility: "public", deleted_at: "2026-01-01" }), "verwijderd");
  });
  it("vertaalt een doelstand naar de kolommen en is rond (roundtrip)", () => {
    for (const target of ["concept", "gepubliceerd", "gearchiveerd"] as const) {
      assert.equal(deriveState(stateToColumns(target)), target);
    }
  });
  it("blokkeert statuswissel voor teamactiviteiten", () => {
    assert.equal(canChangeState({ visibility: "team" }), false);
    assert.equal(canChangeState({ visibility: "public" }), true);
  });
});

describe("lijstfilters", () => {
  it("valt bij onbekende waarden terug op de standaard", () => {
    const f = parseListFilters({ status: "kwaadaardig", sort: "'; drop table", plattegrond: "misschien", pagina: "-3" });
    assert.deepEqual([f.status, f.sort, f.plattegrond, f.page], ["", "bijgewerkt", "", 1]);
  });
  it("haalt tekens met betekenis in PostgREST-filters uit de zoekterm", () => {
    assert.equal(parseListFilters({ q: "tik%,spel()*" }).q, "tik  spel");
  });
  it("bouwt een querystring en telt pagina's", () => {
    const f = parseListFilters({ q: "tik", status: "gepubliceerd", pagina: "3", sort: "titel" });
    assert.equal(listQuery(f), "?q=tik&status=gepubliceerd&sort=titel&pagina=3");
    assert.equal(listQuery(f, { page: 1 }), "?q=tik&status=gepubliceerd&sort=titel");
    assert.equal(pageCount(0), 1);
    assert.equal(pageCount(PAGE_SIZE + 1), 2);
  });
});

describe("validatie van beheerinvoer", () => {
  const valid = { titel: " Tikspel ", doel: "", beginsituatie: null, beschrijving: "x", arrangement: null, aandachtspunten: null, plaatje_praatje: null, deelnemers_regels: null, categorie: "Spel", leerlijn: null, beweegthema: null, niveau: 2, doelgroep: [1, 2], materiaal: ["bal"], base_materials: [], rule_materials: [], regels: [], loopt: [], lukt: [], leeft: [], min_participants: 2, participants_bench: null, afbeelding: "" };
  it("accepteert geldige invoer en normaliseert lege tekst naar null", () => {
    const parsed = activityEditSchema.parse(valid);
    assert.equal(parsed.titel, "Tikspel");
    assert.equal(parsed.doel, null);
    assert.equal(parsed.afbeelding, null);
  });
  it("weigert lege titel, ongeldige afbeelding en te lange lijsten", () => {
    assert.ok(!activityEditSchema.safeParse({ ...valid, titel: "  " }).success);
    assert.ok(!activityEditSchema.safeParse({ ...valid, afbeelding: "javascript:alert(1)" }).success);
    assert.ok(!activityEditSchema.safeParse({ ...valid, afbeelding: "http://x.nl/a.png" }).success);
    assert.ok(!activityEditSchema.safeParse({ ...valid, materiaal: Array(61).fill("a") }).success);
    assert.ok(!activityEditSchema.safeParse({ ...valid, doelgroep: [9] }).success);
  });
  it("laat geen ongeplande kolommen door (mass assignment)", () => {
    const parsed = activityEditSchema.parse({ ...valid, author_id: "x", visibility: "public", deleted_at: "x" }) as Record<string, unknown>;
    assert.ok(!("author_id" in parsed) && !("visibility" in parsed) && !("deleted_at" in parsed));
    assert.ok(!EDITABLE_COLUMNS.includes("author_id" as never));
    assert.ok(RESTORABLE_COLUMNS.includes("titel") && !RESTORABLE_COLUMNS.includes("author_id") && !RESTORABLE_COLUMNS.includes("id"));
  });
  it("bulk: begrensd, minstens één aanpassing, en een voorspelbare patch", () => {
    assert.ok(!bulkSchema.safeParse({ ids: [] , categorie: "x" }).success);
    assert.ok(!bulkSchema.safeParse({ ids: ["a"] }).success);
    assert.ok(!bulkSchema.safeParse({ ids: Array(201).fill("a"), categorie: "x" }).success);
    assert.deepEqual(bulkPatch(bulkSchema.parse({ ids: ["a"], categorie: "Spel", state: "gearchiveerd" })), { categorie: "Spel", status: "approved", visibility: "private" });
  });
});

describe("rate limit", () => {
  it("laat een gewone stroom door en blokkeert een uitbarsting", () => {
    const key = `t-${Math.random()}`;
    assert.ok(!rateLimited(key, 3, 1000, 0) && !rateLimited(key, 3, 1000, 1) && !rateLimited(key, 3, 1000, 2));
    assert.ok(rateLimited(key, 3, 1000, 3));
    assert.ok(!rateLimited(key, 3, 1000, 5000), "na het venster weer toegestaan");
  });
});
