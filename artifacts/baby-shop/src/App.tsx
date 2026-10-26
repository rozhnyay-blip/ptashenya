import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { ukUA } from "@clerk/localizations";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart";
import { StoreLayout } from "@/components/store/store-layout";
import { AdminGate } from "@/components/admin/admin-gate";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/store/home";
import CatalogPage from "@/pages/store/catalog";
import ProductPage from "@/pages/store/product";
import CartPage from "@/pages/store/cart";
import CheckoutPage from "@/pages/store/checkout";
import OrderPage from "@/pages/store/order";
import TrackPage from "@/pages/store/track";
import { SignInPage, SignUpPage } from "@/pages/auth";
import DashboardPage from "@/pages/admin/dashboard";
import OrdersPage from "@/pages/admin/orders";
import OrderDetailPage from "@/pages/admin/order-detail";
import ProductsPage from "@/pages/admin/products";
import SyncPage from "@/pages/admin/sync";
import SettingsPage from "@/pages/admin/settings";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } });

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(14 88% 55%)",
    colorForeground: "hsl(285 32% 15%)",
    colorMutedForeground: "hsl(285 10% 40%)",
    colorDanger: "hsl(352 72% 50%)",
    colorBackground: "hsl(40 70% 99%)",
    colorInput: "hsl(38 60% 97%)",
    colorInputForeground: "hsl(285 32% 15%)",
    colorNeutral: "hsl(285 20% 30%)",
    fontFamily: "'Manrope', sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(40_70%_99%)] rounded-[2rem] w-[440px] max-w-full overflow-hidden shadow-[0_30px_80px_-30px_hsl(285_40%_20%/0.45)] border border-[hsl(32_30%_87%)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-['Unbounded'] text-2xl font-bold text-[hsl(285_32%_15%)]",
    headerSubtitle: "text-[hsl(285_10%_40%)]",
    socialButtonsBlockButtonText: "text-[hsl(285_32%_15%)] font-semibold",
    formFieldLabel: "text-[hsl(285_32%_15%)] font-semibold",
    footerActionLink: "text-[hsl(14_88%_50%)] font-bold",
    footerActionText: "text-[hsl(285_10%_40%)]",
    dividerText: "text-[hsl(285_10%_40%)]",
    identityPreviewEditButton: "text-[hsl(14_88%_50%)]",
    formFieldSuccessText: "text-[hsl(165_55%_28%)]",
    alertText: "text-[hsl(285_32%_15%)]",
    logoBox: "flex justify-center",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "rounded-full border border-[hsl(32_30%_84%)] bg-[hsl(38_60%_97%)] h-11",
    formButtonPrimary: "rounded-full h-12 bg-[hsl(14_88%_55%)] text-[hsl(40_80%_99%)] font-bold text-base normal-case",
    formFieldInput: "rounded-xl h-11 bg-[hsl(38_60%_97%)] border border-[hsl(32_28%_84%)] text-[hsl(285_32%_15%)]",
    footerAction: "justify-center",
    dividerLine: "bg-[hsl(32_30%_87%)]",
    alert: "rounded-xl bg-[hsl(14_90%_95%)] border border-[hsl(14_80%_85%)]",
    otpCodeFieldInput: "rounded-xl border border-[hsl(32_28%_84%)]",
    formFieldRow: "mb-1",
    main: "gap-5",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AdminRoutes() {
  return (
    <AdminGate>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/admin" component={DashboardPage} />
          <Route path="/admin/orders" component={OrdersPage} />
          <Route path="/admin/orders/:id" component={OrderDetailPage} />
          <Route path="/admin/products" component={ProductsPage} />
          <Route path="/admin/sync" component={SyncPage} />
          <Route path="/admin/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AdminGate>
  );
}

function StoreRoutes() {
  return (
    <StoreLayout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/catalog" component={CatalogPage} />
          <Route path="/catalog/:categoryId" component={CatalogPage} />
          <Route path="/product/:id" component={ProductPage} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/order/:number" component={OrderPage} />
          <Route path="/track" component={TrackPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </StoreLayout>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>{location === "/admin" || location.startsWith("/admin/") ? <AdminRoutes /> : <StoreRoutes />}</Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        ...ukUA,
        signIn: {
          ...ukUA.signIn,
          start: {
            ...ukUA.signIn?.start,
            title: "Вхід для власника",
            subtitle: "Увійдіть, щоб керувати магазином",
          },
        },
        signUp: {
          ...ukUA.signUp,
          start: {
            ...ukUA.signUp?.start,
            title: "Створити акаунт",
            subtitle: "Реєстрація для власника магазину",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
