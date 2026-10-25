import { HomeNav } from "@/components/home/home-nav";
import { HomeHero } from "@/components/home/home-hero";
import { HomeMercado } from "@/components/home/home-mercado";
import { HomeResolvemos } from "@/components/home/home-resolvemos";
import { HomeFicha } from "@/components/home/home-ficha";
import { HomeAcompanhamento } from "@/components/home/home-acompanhamento";
import { HomeDecisao } from "@/components/home/home-decisao";
import { HomeIntegracoes } from "@/components/home/home-integracoes";
import { HomeCobertura } from "@/components/home/home-cobertura";
import { HomePrecos } from "@/components/home/home-precos";
import { HomeFechamento } from "@/components/home/home-fechamento";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <HomeNav />
      <main>
        <HomeHero />
        <HomeMercado />
        <HomeResolvemos />
        <HomeFicha />
        <HomeAcompanhamento />
        <HomeDecisao />
        <HomeIntegracoes />
        <HomeCobertura />
        <HomePrecos />
        <HomeFechamento />
      </main>
    </div>
  );
}
