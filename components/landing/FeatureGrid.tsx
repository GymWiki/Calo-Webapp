import { Box, CloudUpload, Download, Move3d, Share2, Smartphone, Triangle } from "lucide-react";

import { ScrollReveal } from "@/components/ScrollReveal";

const FEATURES = [
  { icon: Box, titel: "Bouwen in 3D", tekst: "Sleep toestellen, matten, ballen en doelen uit een bibliotheek van ruim honderd 3D-modellen op de juiste plek in de zaal." },
  { icon: Triangle, titel: "Veld afzetten met pionnen", tekst: "Kies de afmetingen en de afstand. De pionnen worden gelijkmatig verdeeld en geteld, zodat je weet hoeveel je klaar moet zetten." },
  { icon: Move3d, titel: "Draaien en kantelen", tekst: "Draai items om elke as en zet een bank schuin of een mat rechtop met één tik. Ook op een telefoon." },
  { icon: Download, titel: "Exporteren als PNG of PDF", tekst: "Download een afbeelding van de 3D-weergave of het bovenaanzicht, of een PDF met materiaallijst voor in je lesplan." },
  { icon: Share2, titel: "Delen met één link", tekst: "De plattegrond zit gecomprimeerd in de link zelf. Je collega opent hem direct, zonder account en zonder dat er iets op een server staat." },
  { icon: Smartphone, titel: "Op elk apparaat", tekst: "Werkt op telefoon, tablet en computer. Je werk wordt automatisch bewaard op je eigen apparaat." },
] as const;

export function FeatureGrid() {
  return (
    <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, index) => (
        <li key={feature.titel}>
          <ScrollReveal delayMs={(index % 3) * 80} className="h-full">
            <div className="group h-full rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-brand-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
                <feature.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{feature.titel}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.tekst}</p>
            </div>
          </ScrollReveal>
        </li>
      ))}
    </ul>
  );
}

export const ACCOUNT_BENEFITS = [
  { icon: CloudUpload, tekst: "Je plattegronden veilig in de cloud, op elk apparaat" },
  { icon: Box, tekst: "Koppelen aan je lessen en activiteiten" },
  { icon: Share2, tekst: "Delen met je team en collega’s" },
] as const;
