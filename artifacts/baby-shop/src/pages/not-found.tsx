import { Link } from "wouter";
import { StateBlock } from "@/components/store/store-layout";

export default function NotFound() {
  return (
    <div className="px-4">
      <div className="pt-10 text-center font-display text-[7rem] font-extrabold leading-none text-primary sm:text-[10rem]">404</div>
      <StateBlock image={false} title="Ця сторінка кудись поповзла" text="Як шкарпетка після прання — була, і немає. Повернімося туди, де все на місці." action={<div className="flex gap-2"><Link href="/" className="rounded-full bg-foreground px-6 py-3 font-semibold text-background" data-testid="link-404-home">На головну</Link><Link href="/catalog" className="rounded-full border-2 border-foreground px-6 py-3 font-semibold" data-testid="link-404-catalog">Каталог</Link></div>} />
    </div>
  );
}
