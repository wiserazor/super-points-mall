import MallClient from "./mall-client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <MallClient initialProfile={params.profile === "lilian" ? "lilian" : "luke"} />;
}
