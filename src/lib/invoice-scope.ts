export type InvoiceAsset = { id: string; owner_id: string | null; label: string; kind: "building" | "property" | "unit" };

export function forInvoiceOwner<T extends { owner_id: string | null }>(rows: T[], ownerId: string): T[] {
  return ownerId ? rows.filter((row) => row.owner_id === ownerId) : [];
}

export function invoiceAssetLinks(value: string) {
  const [kind, id] = value.split(":");
  return {
    building_id: kind === "building" && id ? id : null,
    property_id: kind === "property" && id ? id : null,
    unit_id: kind === "unit" && id ? id : null,
  };
}

export function invoiceAssetValue(row: { building_id?: string | null; property_id?: string | null; unit_id?: string | null }) {
  if (row.building_id) return `building:${row.building_id}`;
  if (row.property_id) return `property:${row.property_id}`;
  if (row.unit_id) return `unit:${row.unit_id}`;
  return "";
}