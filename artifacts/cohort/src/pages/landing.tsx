import { useEffect } from "react";
import { HomeNav } from "@/components/home/home-nav";
import { HomeHero } from "@/components/home/home-hero";
import { HomeVideo } from "@/components/home/home-video";
import { HomeMercado } from "@/components/home/home-mercado";
import { HomeResolvemos } from "@/components/home/home-resolvemos";
import { HomeFicha } from "@/components/home/home-ficha";
import { HomeAcompanhamento } from "@/components/home/home-acompanhamento";
import { HomeDecisao } from "@/components/home/home-decisao";
import { HomeIntegracoes } from "@/components/home/home-integracoes";
import { HomeCobertura } from "@/components/home/home-cobertura";
import { HomeFechamento } from "@/components/home/home-fechamento";

function rolarParaAncora() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!id) return;
  let tentativas = 0;
  const procurar = () => {
    const alvo = document.getElementById(id);
    if (alvo) {
      alvo.scrollIntoView();
      return;
    }
    if (tentativas++ < 40) window.setTimeout(procurar, 50);
  };
  procurar();
}

export default function LandingPage() {
  useEffect(rolarParaAncora, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <HomeNav />
      <main>
        <HomeHero />
        <HomeVideo />
        <HomeMercado />
        <HomeResolvemos />
        <HomeFicha />
        <HomeAcompanhamento />
        <HomeDecisao />
        <HomeIntegracoes />
        <HomeCobertura />
        {/* Preços fora da home até a decisão de preço (28/10/2026). */}
        <HomeFechamento />
      </main>
    </div>
  );
}
