import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronRight, Loader2 } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/owner-section/$sectionId")({
  head: () => ({
    meta: [
      { title: "قسم المالك | الرشودي للعقارات" },
      { name: "description", content: "عرض محتويات قسم المالك من العمارات والوحدات والعقود." },
      { property: "og:title", content: "قسم المالك | الرشودي للعقارات" },
      { property: "og:description", content: "محتويات القسم من عمارات ووحدات وعقود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerSectionPage,
});

const money = (value: number | null | undefined) =>
  value == null ? "—" : `${Number(value).toLocaleString("ar-SA")} ر.س`;
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("ar-SA") : "—";

function OwnerSectionPage() {
  const { sectionId } = Route.useParams();

  const data = useQuery({
    queryKey: ["owner-section", sectionId],
    queryFn: async () => {
      const section = await supabase
        .from("owner_asset_sections")
        .select("id, name, owner_id")
        .eq("id", sectionId)
        .single();
      if (section.error) throw section.error;
      const ownerId = section.data.owner_id;

      const [owner, items, buildings, units, properties, contracts] = await Promise.all([
        supabase.from("contacts").select("id, full_name, phone").eq("id", ownerId).single(),
        supabase
          .from("owner_asset_section_items")
          .select("item_type, item_id")
          .eq("section_id", sectionId),
        supabase
          .from("buildings")
          .select("id, name, city, district, address")
          .eq("owner_id", ownerId),
        supabase
          .from("units")
          .select("id, unit_number, unit_type, floor, area, status, building_id")
          .eq("owner_id", ownerId),
        supabase
          .from("properties")
          .select("id, code, name, city, district, status, building_id")
          .eq("owner_id", ownerId),
        supabase
          .from("contracts")
          .select(
            "id, contract_number, status, start_date, end_date, annual_rent, total_value, unit_id, property_id, tenant:contacts!contracts_tenant_id_fkey(full_name, phone)",
          )
          .eq("owner_id", ownerId),
      ]);
      if (items.error) throw items.error;

      return {
        section: section.data,
        owner: owner.data,
        items: items.data ?? [],
        buildings: buildings.data ?? [],
        units: units.data ?? [],
        properties: properties.data ?? [],
        contracts: contracts.data ?? [],
      };
    },
  });

  if (data.isLoading || !data.data) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        {data.error ? (
          <p className="text-[13px] text-destructive">تعذّر تحميل القسم</p>
        ) : (
          <Loader2 className="size-6 animate-spin text-primary" />
        )}
      </div>
    );
  }

  const { section, owner, items, buildings, units, properties, contracts } = data.data;
  const ids = (type: string) => items.filter((i) => i.item_type === type).map((i) => i.item_id);
  const sectionBuildings = buildings.filter((b) => ids("building").includes(b.id));
  const sectionUnits = units.filter(
    (u) => ids("unit").includes(u.id) || (u.building_id && ids("building").includes(u.building_id)),
  );
  const sectionProperties = properties.filter((p) => ids("property").includes(p.id));
  const contractOfUnit = new Map(
    contracts.filter((c) => c.unit_id && c.status === "active").map((c) => [c.unit_id!, c]),
  );
  const contractOfProperty = new Map(
    contracts.filter((c) => c.property_id && c.status === "active").map((c) => [c.property_id!, c]),
  );

  return (
    <>
      <PageHero
        title={section.name}
        subtitle={`قسم خاص بالمالك ${owner?.full_name ?? ""} — كل ما بداخله من عمارات ووحدات وعقود.`}
        icon={Building2}
        stats={[
          { value: String(sectionBuildings.length), label: "عمارة" },
          { value: String(sectionUnits.length), label: "وحدة" },
          { value: String(sectionProperties.length), label: "عقار" },
        ]}
      />

      <Link
        to="/owners/$ownerId"
        params={{ ownerId: section.owner_id }}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
      >
        <ChevronRight className="size-4" /> رجوع لصفحة المالك
      </Link>

      {sectionBuildings.map((building) => {
        const list = sectionUnits.filter((u) => u.building_id === building.id);
        return (
          <section key={building.id} className="surface-card p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold">{building.name}</h2>
                <p className="text-[12px] text-muted-foreground">
                  {[building.district, building.city, building.address]
                    .filter(Boolean)
                    .join(" ، ") || "—"}
                </p>
              </div>
              <Chip tone="primary">{list.length} وحدة</Chip>
            </header>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {list.map((unit) => {
                const contract = contractOfUnit.get(unit.id);
                return (
                  <article key={unit.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13.5px] font-bold">وحدة رقم {unit.unit_number}</h3>
                      <Chip tone={contract ? "success" : "neutral"}>
                        {contract ? "مؤجرة" : "شاغرة"}
                      </Chip>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {[
                        unit.unit_type,
                        unit.floor ? `الدور ${unit.floor}` : null,
                        unit.area ? `${unit.area} م²` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    {contract ? (
                      <p className="mt-2 text-[12px]">
                        {contract.tenant?.full_name ?? "مستأجر غير مسجل"} · ينتهي{" "}
                        {date(contract.end_date)} ·{" "}
                        {money(contract.annual_rent ?? contract.total_value)}{" "}
                        <Link
                          to="/contracts/$contractId"
                          params={{ contractId: contract.id }}
                          className="font-semibold text-primary"
                        >
                          فتح العقد
                        </Link>
                      </p>
                    ) : null}
                  </article>
                );
              })}
              {!list.length ? <EmptyState icon={Building2} title="لا توجد وحدات في هذه العمارة" /> : null}
            </div>
          </section>
        );
      })}

      {sectionProperties.length || sectionUnits.some((u) => !u.building_id) ? (
        <section className="surface-card p-4">
          <h2 className="text-[15px] font-bold">عقارات ووحدات مفردة داخل القسم</h2>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {sectionProperties.map((property) => {
              const contract = contractOfProperty.get(property.id);
              return (
                <article key={property.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13.5px] font-bold">{property.name}</h3>
                    <Chip tone={contract ? "success" : "neutral"}>
                      {contract ? "مؤجر" : "متاح"}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {[property.code, property.city, property.district]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </article>
              );
            })}
            {sectionUnits
              .filter((u) => !u.building_id)
              .map((unit) => (
                <article key={unit.id} className="rounded-md border border-border p-3">
                  <h3 className="text-[13.5px] font-bold">وحدة رقم {unit.unit_number}</h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">{unit.unit_type ?? "—"}</p>
                </article>
              ))}
          </div>
        </section>
      ) : null}

      {!sectionBuildings.length && !sectionProperties.length && !sectionUnits.length ? (
        <EmptyState icon={Building2} title="القسم فارغ" description="ارجع لصفحة المالك واسحب العناصر داخل هذا القسم." />
      ) : null}
    </>
  );
}
