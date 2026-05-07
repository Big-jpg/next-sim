"use client";

import dynamic from "next/dynamic";

const OpticsLab = dynamic(() => import("@/components/OpticsLab"), { ssr: false });

export default function Home() {
  return <OpticsLab />;
}
