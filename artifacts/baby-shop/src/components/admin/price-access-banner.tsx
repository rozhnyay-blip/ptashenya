import { KeyRound } from "lucide-react";

/** Explains why some supplier products are hidden: toysi.ua shows most wholesale prices only to logged-in clients. */
export function PriceAccessBanner({ noPrice, connected }: { noPrice: number; connected: boolean }) {
  if (noPrice <= 0) return null;
  return (
    <div
      className="mb-4 flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-5 sm:flex-row sm:items-center"
      data-testid="banner-no-price"
    >
      <KeyRound className="h-8 w-8 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="font-display font-bold">
          {noPrice.toLocaleString("uk-UA")} товарів приховано — постачальник не показав ціну
        </div>
        <p className="text-sm text-foreground/80">
          {connected
            ? "Оптовий кабінет підключено. Якщо після наступної синхронізації ціни не з'явились — перевірте телефон і пароль від toysi.ua."
            : "toysi.ua показує більшість оптових цін лише клієнтам, що увійшли в кабінет. Підключіть свій оптовий акаунт — і всі товари з'являться в магазині з вашою націнкою. Або встановіть ціну вручну в розділі «Товари»."}
        </p>
      </div>
    </div>
  );
}
