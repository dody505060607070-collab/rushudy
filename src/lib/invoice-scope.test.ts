import { describe, expect, it } from "vitest";
import { forInvoiceOwner, invoiceAssetLinks, invoiceAssetValue } from "./invoice-scope";

describe("invoice owner selection", () => {
  it("shows only contracts belonging to the chosen owner", () => {
    expect(forInvoiceOwner([{ id: "contract-a", owner_id: "owner-a" }, { id: "contract-b", owner_id: "owner-b" }, { id: "unassigned", owner_id: null }], "owner-a").map((row) => row.id)).toEqual(["contract-a"]);
  });
  it("shows only buildings and related assets belonging to the chosen owner", () => {
    expect(forInvoiceOwner([{ id: "building-a", owner_id: "owner-a" }, { id: "unit-a", owner_id: "owner-a" }, { id: "property-b", owner_id: "owner-b" }], "owner-a").map((row) => row.id)).toEqual(["building-a", "unit-a"]);
  });
  it("does not show another owner's options before an owner is selected", () => {
    expect(forInvoiceOwner([{ id: "contract-a", owner_id: "owner-a" }], "")).toEqual([]);
  });
  it("preserves the chosen building when the invoice is reopened", () => {
    const links = invoiceAssetLinks("building:building-a");
    expect(links).toEqual({ building_id: "building-a", property_id: null, unit_id: null });
    expect(invoiceAssetValue(links)).toBe("building:building-a");
  });
});