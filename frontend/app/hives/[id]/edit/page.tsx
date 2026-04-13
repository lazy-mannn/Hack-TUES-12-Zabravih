import { notFound } from "next/navigation";
import { fetchHiveDetail } from "@/lib/django";
import EditForm from "./EditForm";

export default async function EditHivePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const numId = Number(id);

  let hive;
  try {
    hive = await fetchHiveDetail(numId);
  } catch {
    notFound();
  }

  return <EditForm hive={hive} />;
}
