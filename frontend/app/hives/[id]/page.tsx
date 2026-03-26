import { fetchHiveDetail } from "@/lib/django";
import { notFound } from "next/navigation";

export default async function HivePage(props: PageProps<"/hives/[id]">) {
  const { id } = await props.params;

  let hive;
  try {
    hive = await fetchHiveDetail(Number(id));
  } catch {
    notFound();
  }

  return (
    <div className="bg-yellow-400 min-h-screen flex items-center justify-center">
      <p className="text-black text-2xl font-bold">Hive #{hive.id} — {hive.name}</p>
    </div>
  );
}
