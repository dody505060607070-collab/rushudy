import { supabase } from "@/integrations/supabase/client";

async function deleteContractImports(contractIds: string[]) {
  if (!contractIds.length) return;
  const imports = await supabase
    .from("contract_imports")
    .select("id, file_path")
    .in("contract_id", contractIds);
  if (imports.error) throw imports.error;

  const paths = (imports.data ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from("contract-files").remove(paths);

  const ids = (imports.data ?? []).map((row) => row.id);
  if (ids.length) {
    const removed = await supabase.from("contract_imports").delete().in("id", ids);
    if (removed.error) throw removed.error;
  }
}

/** فصل المالك عن العقارات والوحدات والمباني قبل حذفه */
async function detachOwner(ids: string[]) {
  const tables = ["properties", "units", "buildings"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).update({ owner_id: null }).in("owner_id", ids);
    if (error) throw error;
  }
}

/** حذف العقود المرتبطة بالملاك المحددين */
export async function deleteContractsOfOwners(ids: string[]) {
  if (!ids.length) return;
  const contracts = await supabase.from("contracts").select("id").in("owner_id", ids);
  if (contracts.error) throw contracts.error;
  await deleteContractImports((contracts.data ?? []).map((contract) => contract.id));
  const { error } = await supabase.from("contracts").delete().in("owner_id", ids);
  if (error) throw error;
}

/** حذف مالك أو أكثر، مع خيار حذف عقودهم */
export async function deleteOwners(ids: string[], alsoContracts: boolean) {
  if (!ids.length) return;
  if (alsoContracts) await deleteContractsOfOwners(ids);
  else {
    const { error } = await supabase.from("contracts").update({ owner_id: null }).in("owner_id", ids);
    if (error) throw error;
  }
  await detachOwner(ids);
  const { error } = await supabase.from("contacts").delete().in("id", ids);
  if (error) throw error;
}

/** حذف عقد، مع خيار حذف المالك المرتبط به */
export async function deleteContractWithOwner(contractId: string, ownerId: string | null, alsoOwner: boolean) {
  await deleteContractImports([contractId]);
  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (error) throw error;
  if (alsoOwner && ownerId) await deleteOwners([ownerId], true);
}
